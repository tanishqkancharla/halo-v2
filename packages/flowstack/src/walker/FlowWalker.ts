import path from "node:path";
import * as errore from "errore";
import ts from "typescript5";
import {
  branch,
  event,
  frame,
  reply,
  returns,
  type Carrier,
  type EventNode,
  type FlowNode,
  type ProcessName,
  type Service,
} from "../model/Program.js";

/**
 * Walks TypeScript from one function and builds a flow tree the same shape
 * as the hand-written ones in `halo.ts`. Plain calls resolve through the
 * type checker. Everything the checker cannot see goes through one of the
 * rules below; each names the mechanism it stands in for.
 */

type FunctionNode = ts.SignatureDeclaration & { body: ts.Node };

type WalkerConfig = {
  repoRoot: string;
  /** tsconfig whose files and options seed the program. */
  tsconfig: string;
  /** Extra root files so the program also loads the other side of a boundary. */
  extraRoots: string[];
  /** Repo-relative path prefixes whose calls are dropped (loggers, ui kits). */
  ignore: string[];
  /**
   * Rule: a node_modules package that is a service of its own. A call into it
   * is an event to that service, with the `.d.ts` declaration as the frame.
   */
  packageServices: {
    prefix: string;
    service: string;
    name: string;
    carrier: Carrier;
  }[];
  /** Rule: a call whose signature comes from this client package runs a router handler in another process. */
  rpc: {
    clientPackage: string;
    routerFile: string;
    routerExport: string;
    carrier: Carrier;
    from: ProcessName;
    to: ProcessName;
  };
  /** Rule: `helper(x).current` reads back `x` (a ref that mirrors a prop). */
  refHelpers: string[];
  /**
   * Rule: when a component's callback prop is set at more than one JSX site,
   * follow only the site inside the named function. One flow, one user path.
   */
  callbackSites: { component: string; within: string }[];
  /** Rule: file paths that mean the disk; calls into them are events. */
  sinks: {
    pathIncludes: string;
    service: string;
    name: string;
    carrier: Carrier;
  }[];
};

type Omitted = { callee: string; where: string; reason: string };

class WalkError extends errore.createTaggedError({
  name: "WalkError",
  message: "$reason",
}) {}

type WalkResult = {
  root: FlowNode;
  services: Service[];
  omitted: Omitted[];
  unresolved: string[];
};

export class FlowWalker {
  private readonly checker: ts.TypeChecker;
  private readonly services = new Map<string, Service>();
  private readonly omitted: Omitted[] = [];
  private readonly unresolved: string[] = [];
  private readonly walked = new Set<ts.Node>();

  static create(config: WalkerConfig) {
    const configPath = path.join(config.repoRoot, config.tsconfig);
    const raw = ts.readConfigFile(configPath, ts.sys.readFile);
    if (raw.error !== undefined) {
      return new WalkError({
        reason: ts.flattenDiagnosticMessageText(raw.error.messageText, "\n"),
      });
    }
    const parsed = ts.parseJsonConfigFileContent(
      raw.config,
      ts.sys,
      path.dirname(configPath),
      undefined,
      configPath,
    );
    const program = ts.createProgram({
      rootNames: [
        ...parsed.fileNames,
        ...config.extraRoots.map((file) => path.join(config.repoRoot, file)),
      ],
      options: parsed.options,
    });
    return new FlowWalker(config, program);
  }

  private constructor(
    private readonly config: WalkerConfig,
    private readonly program: ts.Program,
  ) {
    this.checker = program.getTypeChecker();
  }

  /** Start from the innermost function that contains `file:line`. */
  walkFrom(input: {
    file: string;
    line: number;
    process: ProcessName;
    trigger: { from: string; name: string; carrier: Carrier; detail?: string };
  }): WalkResult | WalkError {
    const sourceFile = this.program.getSourceFile(
      path.join(this.config.repoRoot, input.file),
    );
    if (sourceFile === undefined) {
      return new WalkError({ reason: `${input.file} is not in the program` });
    }
    const fn = functionAtLine(sourceFile, input.line);
    if (fn === undefined) {
      return new WalkError({
        reason: `no function at ${input.file}:${input.line}`,
      });
    }
    const first = this.walk(fn, input.process, []);
    const root = event({
      from: input.trigger.from,
      to: first.service,
      name: input.trigger.name,
      carrier: input.trigger.carrier,
      detail: input.trigger.detail,
      children: [first],
    });
    return {
      root,
      services: [...this.services.values()],
      omitted: this.omitted,
      unresolved: this.unresolved,
    };
  }

  private walk(fn: FunctionNode, process: ProcessName, stack: ts.Node[]) {
    const name = frameName(fn);
    const serviceId = this.serviceFor(name, process);
    if (this.walked.has(fn)) {
      return frame({
        service: serviceId,
        entry: name,
        summary: "Walked above; same calls.",
        source: this.sourceOf(fn),
        returns: this.returnTypeOf(fn),
        children: [],
      });
    }
    this.walked.add(fn);
    const children: FlowNode[] = [];
    if (!stack.includes(fn)) {
      children.push(...this.bodyOf(fn.body, process, [...stack, fn]));
    }
    return frame({
      service: serviceId,
      entry: name,
      summary: jsDocSummary(fn),
      source: this.sourceOf(fn),
      returns: this.returnTypeOf(fn),
      children,
    });
  }

  /**
   * The children one body contributes, in source order: the calls it makes,
   * with `at` set to each call's line, a branch node per `if`/`else` that
   * contains something, and a return node per `return`. Two shapes of control
   * flow are folded into the tree: after `if (x) return`, everything later in
   * the body carries the guard `unless (x)`; after an awaited event with a
   * reply, everything later in the body becomes the reply's children, since
   * the reply is what lets it run. Nested functions are deferred work and are
   * skipped unless a sync callback method takes them.
   */
  private bodyOf(
    body: ts.Node,
    process: ProcessName,
    stack: ts.Node[],
  ): FlowNode[] {
    const out: FlowNode[] = [];
    let sink = out;
    const guards: string[] = [];
    const emit = (node: FlowNode) => {
      if (guards.length > 0) node.guards = [...guards];
      sink.push(node);
    };
    const collect = (node: ts.Node) => {
      if (node !== body && isFunctionNode(node) && !isSyncCallback(node)) {
        return;
      }
      if (ts.isIfStatement(node)) {
        collect(node.expression);
        for (const arm of this.branchesOf(node, "if", process, stack)) {
          emit(arm);
        }
        if (alwaysExits(node.thenStatement)) {
          guards.push(guardLabel(node.expression, false));
        }
        return;
      }
      if (ts.isReturnStatement(node)) {
        emit(
          returns({
            label:
              node.expression === undefined
                ? "return"
                : `return ${shortText(node.expression)}`,
            at: lineOf(node.getStart(), node.getSourceFile()),
            children:
              node.expression === undefined
                ? []
                : this.bodyOf(node.expression, process, stack),
          }),
        );
        return;
      }
      if (ts.isCallExpression(node)) {
        const resolved = this.resolveCall(node, process, stack);
        for (const child of resolved) {
          if (child.at === undefined) {
            child.at = lineOf(node.expression.getEnd(), node.getSourceFile());
          }
          emit(child);
        }
        const awaited = isAwaited(node);
        for (const child of resolved) {
          if (!awaited || child.kind !== "event") continue;
          const last = child.children.at(-1);
          if (last !== undefined && last.kind === "reply") sink = last.children;
        }
      }
      ts.forEachChild(node, collect);
    };
    collect(body);
    return out;
  }

  /** `if (...)` and its `else if` / `else` chain, branches with nothing inside dropped. */
  private branchesOf(
    node: ts.IfStatement,
    keyword: "if" | "else if",
    process: ProcessName,
    stack: ts.Node[],
  ): FlowNode[] {
    const result: FlowNode[] = [];
    const then = this.bodyOf(node.thenStatement, process, stack);
    if (then.length > 0) {
      result.push(
        branch({
          label: `${keyword} (${shortText(node.expression)})`,
          guard: guardLabel(node.expression, true),
          at: lineOf(node.getStart(), node.getSourceFile()),
          children: then,
        }),
      );
    }
    if (node.elseStatement === undefined) return result;
    if (ts.isIfStatement(node.elseStatement)) {
      result.push(
        ...this.branchesOf(node.elseStatement, "else if", process, stack),
      );
      return result;
    }
    const otherwise = this.bodyOf(node.elseStatement, process, stack);
    if (otherwise.length > 0) {
      result.push(
        branch({
          label: "else",
          guard: guardLabel(node.expression, false),
          at: lineOf(
            node.elseStatement.getStart(),
            node.elseStatement.getSourceFile(),
          ),
          children: otherwise,
        }),
      );
    }
    return result;
  }

  private resolveCall(
    call: ts.CallExpression,
    process: ProcessName,
    stack: ts.Node[],
  ): FlowNode[] {
    const query = this.queryRule(call, process, stack);
    if (query !== undefined) return query;

    const signature = this.checker.getResolvedSignature(call);
    const declaration = signature?.declaration;
    if (
      declaration !== undefined &&
      declaration
        .getSourceFile()
        .fileName.includes(`/node_modules/${this.config.rpc.clientPackage}/`)
    ) {
      const rpc = this.rpcRule(call, process, stack);
      if (rpc !== undefined) return [rpc];
    }
    if (declaration !== undefined) {
      const external = this.externalRule(call, declaration, process);
      if (external !== undefined) return external;
    }
    if (declaration !== undefined && isFunctionNode(declaration)) {
      return this.enter(declaration, process, stack, call);
    }

    const callback = this.callbackTarget(call.expression);
    if (callback.length > 0) {
      return callback.flatMap((target) =>
        this.enter(target, process, stack, call),
      );
    }

    if (declaration !== undefined) {
      const file = declaration.getSourceFile().fileName;
      this.omit(call, `declared without a body in ${this.relative(file)}`);
      return [];
    }
    this.unresolved.push(`${call.expression.getText()} at ${this.where(call)}`);
    return [];
  }

  /**
   * A declaration outside the repo: a sink becomes an event to that actor, a
   * package service becomes an event with the `.d.ts` declaration as its
   * frame, the rest is dropped. Returns undefined for declarations inside the
   * repo.
   */
  private externalRule(
    call: ts.CallExpression,
    declaration: ts.Declaration,
    process: ProcessName,
  ): FlowNode[] | undefined {
    const file = declaration.getSourceFile().fileName;
    if (
      !declaration.getSourceFile().isDeclarationFile &&
      !file.includes("/node_modules/")
    ) {
      return undefined;
    }
    const relative = this.relative(file);
    const sink = this.config.sinks.find((entry) =>
      file.includes(entry.pathIncludes),
    );
    if (sink !== undefined) {
      this.outsideService(sink.service, sink.name);
      return [
        event({
          from: this.serviceFor(frameName(enclosingFunction(call)), process),
          to: sink.service,
          name: call.expression.getText().replaceAll(/\s+/g, ""),
          args: argsText(call),
          returns: this.returnTypeOfCall(call),
          carrier: sink.carrier,
          callSite: this.sourceOf(enclosingFunction(call)),
          children: [],
        }),
      ];
    }
    const pkg = this.config.packageServices.find((entry) =>
      relative.startsWith(`node_modules/${entry.prefix}`),
    );
    if (pkg === undefined) {
      this.omit(call, `outside the repo (${relative})`);
      return [];
    }
    if (!ts.isFunctionLike(declaration)) {
      this.omit(call, `not a function declaration (${relative})`);
      return [];
    }
    this.outsideService(pkg.service, pkg.name);
    const name = frameName(declaration);
    return [
      event({
        from: this.serviceFor(frameName(enclosingFunction(call)), process),
        to: pkg.service,
        name,
        args: argsText(call),
        returns: this.returnTypeOfCall(call),
        carrier: pkg.carrier,
        callSite: this.sourceOf(enclosingFunction(call)),
        children: [
          frame({
            service: pkg.service,
            entry: name,
            summary: jsDocSummary(declaration),
            source: this.sourceOf(declaration),
            returns: this.returnTypeOfCall(call),
            children: [],
          }),
        ],
      }),
    ];
  }

  /** Walk into a function with a body unless its path is ignored. */
  private enter(
    fn: FunctionNode,
    process: ProcessName,
    stack: ts.Node[],
    call: ts.CallExpression,
  ): FlowNode[] {
    const relative = this.relative(fn.getSourceFile().fileName);
    if (this.config.ignore.some((prefix) => relative.startsWith(prefix))) {
      this.omit(call, `ignored path ${relative}`);
      return [];
    }
    return [this.walk(fn, process, stack)];
  }

  /**
   * Rule: oRPC. `api.sessions.prompt(...)` is a proxy typed by the contract,
   * so its call signature lives in `@orpc/client`. The handler is the function
   * passed to `.handler()` at the same property path in the router object on
   * the other side.
   */
  private rpcRule(
    call: ts.CallExpression,
    process: ProcessName,
    stack: ts.Node[],
  ): FlowNode | undefined {
    const segments: string[] = [];
    let expression: ts.Expression = call.expression;
    while (ts.isPropertyAccessExpression(expression)) {
      segments.unshift(expression.name.text);
      expression = expression.expression;
    }
    if (segments.length === 0) return undefined;
    const handler = this.routerHandler(segments);
    if (handler === undefined) {
      this.unresolved.push(
        `router path ${segments.join(".")} at ${this.where(call)}`,
      );
      return undefined;
    }
    const target = this.walk(handler, this.config.rpc.to, stack);
    const caller = this.serviceFor(frameName(enclosingFunction(call)), process);
    const node: EventNode = event({
      from: caller,
      to: target.service,
      name: segments.join("."),
      args: argsText(call),
      carrier: this.config.rpc.carrier,
      callSite: this.sourceOf(enclosingFunction(call)),
      children: [
        target,
        reply({
          from: target.service,
          to: caller,
          carrier: this.config.rpc.carrier,
          value: this.replyValue(call, handler),
          at: lineOf(call.expression.getEnd(), call.getSourceFile()),
          children: [],
        }),
      ],
    });
    return node;
  }

  private routerHandler(segments: string[]): FunctionNode | undefined {
    const file = this.program.getSourceFile(
      path.join(this.config.repoRoot, this.config.rpc.routerFile),
    );
    if (file === undefined) return undefined;
    const moduleSymbol = this.checker.getSymbolAtLocation(file);
    if (moduleSymbol === undefined) return undefined;
    const symbol = this.checker
      .getExportsOfModule(moduleSymbol)
      .find((entry) => entry.name === this.config.rpc.routerExport);
    let node: ts.Node | undefined = symbol?.valueDeclaration;
    for (const segment of segments) {
      const literal = this.objectLiteralOf(node);
      if (literal === undefined) return undefined;
      const property = literal.properties.find(
        (entry) => entry.name !== undefined && entry.name.getText() === segment,
      );
      if (property === undefined) return undefined;
      if (ts.isShorthandPropertyAssignment(property)) {
        node = this.declarationOf(property.name);
      } else if (ts.isPropertyAssignment(property)) {
        node = ts.isIdentifier(property.initializer)
          ? this.declarationOf(property.initializer)
          : property.initializer;
      } else {
        return undefined;
      }
    }
    // `os.prompt.handler(fn)`: the handler is the last argument.
    if (node !== undefined && ts.isCallExpression(node)) {
      const last = node.arguments[node.arguments.length - 1];
      if (last !== undefined && isFunctionNode(last)) return last;
    }
    return undefined;
  }

  /** The object literal a router value is built from, through `os.router({...})`. */
  private objectLiteralOf(node: ts.Node | undefined) {
    let current = node;
    if (current !== undefined && ts.isVariableDeclaration(current)) {
      current = current.initializer;
    }
    if (current !== undefined && ts.isCallExpression(current)) {
      current = current.arguments[0];
    }
    if (current !== undefined && ts.isObjectLiteralExpression(current)) {
      return current;
    }
    return undefined;
  }

  /**
   * Rule: TanStack Query. `useQuery({ queryFn })` runs `queryFn`, so its
   * calls belong to the hook's frame. `invalidateQueries({ queryKey })`
   * reruns every `useQuery` whose literal key starts with that key, so the
   * hook that owns each matching `useQuery` runs again.
   */
  private queryRule(
    call: ts.CallExpression,
    process: ProcessName,
    stack: ts.Node[],
  ): FlowNode[] | undefined {
    if (
      ts.isIdentifier(call.expression) &&
      call.expression.text === "useQuery"
    ) {
      const options = call.arguments[0];
      if (options === undefined || !ts.isObjectLiteralExpression(options)) {
        return undefined;
      }
      const queryFn = options.properties.find(
        (entry) =>
          entry.name !== undefined && entry.name.getText() === "queryFn",
      );
      if (
        queryFn === undefined ||
        !ts.isPropertyAssignment(queryFn) ||
        !isFunctionNode(queryFn.initializer)
      ) {
        return undefined;
      }
      return this.bodyOf(queryFn.initializer.body, process, stack);
    }
    if (
      !ts.isPropertyAccessExpression(call.expression) ||
      call.expression.name.text !== "invalidateQueries"
    ) {
      return undefined;
    }
    const key = queryKeyOf(call.arguments[0]);
    if (key === undefined) return undefined;
    const hooks: FunctionNode[] = [];
    for (const file of this.program.getSourceFiles()) {
      if (file.isDeclarationFile) continue;
      visit(file, (node) => {
        if (
          !ts.isCallExpression(node) ||
          !ts.isIdentifier(node.expression) ||
          node.expression.text !== "useQuery"
        ) {
          return;
        }
        const candidate = queryKeyOf(node.arguments[0]);
        if (candidate === undefined) return;
        if (!key.every((part, index) => candidate[index] === part)) return;
        const owner = enclosingFunction(node);
        if (!hooks.includes(owner)) hooks.push(owner);
      });
    }
    return hooks.map((hook) => this.walk(hook, process, stack));
  }

  /**
   * Rule: React callbacks. A call through a prop (`onSubmit(text)`) or a
   * ref that mirrors a prop (`onSubmitRef.current?.()`) runs whatever each
   * JSX usage of the component passed for that prop. A name destructured
   * from a hook's return (`const { prompt } = useAgentSession()`) is the
   * function the hook returned under that key.
   */
  private callbackTarget(expression: ts.Expression): FunctionNode[] {
    if (
      ts.isPropertyAccessExpression(expression) &&
      expression.name.text === "current"
    ) {
      const declaration = this.declarationOf(expression.expression);
      if (
        declaration !== undefined &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer !== undefined &&
        ts.isCallExpression(declaration.initializer) &&
        this.config.refHelpers.includes(
          declaration.initializer.expression.getText(),
        )
      ) {
        const mirrored = declaration.initializer.arguments[0];
        if (mirrored !== undefined) return this.callbackTarget(mirrored);
      }
    }
    const declaration = this.declarationOf(expression);
    if (declaration === undefined) return [];
    if (isFunctionNode(declaration)) return [declaration];
    if (
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer !== undefined &&
      isFunctionNode(declaration.initializer)
    ) {
      return [declaration.initializer];
    }
    if (ts.isBindingElement(declaration)) {
      const pattern = declaration.parent;
      const owner = pattern.parent;
      const propName = (
        declaration.propertyName === undefined
          ? declaration.name
          : declaration.propertyName
      ).getText();
      if (ts.isParameter(owner)) {
        return this.propTargets(enclosingFunction(owner), propName);
      }
      if (
        ts.isVariableDeclaration(owner) &&
        owner.initializer !== undefined &&
        ts.isCallExpression(owner.initializer)
      ) {
        return this.hookReturnTarget(owner.initializer, propName);
      }
    }
    return [];
  }

  /**
   * What each `<Component prop={...}>` in the repo passes for `prop`, or only
   * the site inside the function a `callbackSites` entry names.
   */
  private propTargets(
    component: FunctionNode,
    propName: string,
  ): FunctionNode[] {
    const targets: FunctionNode[] = [];
    const site = this.config.callbackSites.find(
      (entry) => entry.component === frameName(component),
    );
    for (const file of this.program.getSourceFiles()) {
      if (file.isDeclarationFile) continue;
      visit(file, (node) => {
        if (!ts.isJsxOpeningLikeElement(node)) return;
        if (this.declarationOf(node.tagName) !== component) return;
        if (
          site !== undefined &&
          frameName(enclosingFunction(node)) !== site.within
        ) {
          return;
        }
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) continue;
          if (attribute.name.getText() !== propName) continue;
          if (
            attribute.initializer === undefined ||
            !ts.isJsxExpression(attribute.initializer) ||
            attribute.initializer.expression === undefined
          ) {
            continue;
          }
          for (const target of this.callbackTarget(
            attribute.initializer.expression,
          )) {
            if (!targets.includes(target)) targets.push(target);
          }
        }
      });
    }
    return targets;
  }

  /** The function a hook returns under `key` in its `return { ... }`. */
  private hookReturnTarget(
    call: ts.CallExpression,
    key: string,
  ): FunctionNode[] {
    const hook = this.checker.getResolvedSignature(call)?.declaration;
    if (hook === undefined || !isFunctionNode(hook)) return [];
    const targets: FunctionNode[] = [];
    visit(hook.body, (node) => {
      if (!ts.isReturnStatement(node) || node.expression === undefined) return;
      if (!ts.isObjectLiteralExpression(node.expression)) return;
      for (const property of node.expression.properties) {
        if (property.name === undefined || property.name.getText() !== key) {
          continue;
        }
        const value = ts.isShorthandPropertyAssignment(property)
          ? property.name
          : ts.isPropertyAssignment(property)
            ? property.initializer
            : undefined;
        if (value === undefined) continue;
        for (const target of this.callbackTarget(value)) {
          if (!targets.includes(target)) targets.push(target);
        }
      }
    });
    return targets;
  }

  private declarationOf(node: ts.Node): ts.Declaration | undefined {
    let symbol = this.checker.getSymbolAtLocation(node);
    if (symbol === undefined) return undefined;
    if (symbol.flags & ts.SymbolFlags.Alias) {
      symbol = this.checker.getAliasedSymbol(symbol);
    }
    if (
      symbol.valueDeclaration !== undefined &&
      ts.isShorthandPropertyAssignment(symbol.valueDeclaration)
    ) {
      const value = this.checker.getShorthandAssignmentValueSymbol(
        symbol.valueDeclaration,
      );
      if (value !== undefined) symbol = value;
    }
    if (symbol.valueDeclaration !== undefined) return symbol.valueDeclaration;
    return symbol.declarations?.[0];
  }

  private serviceFor(name: string, process: ProcessName) {
    const segment = name.includes(".")
      ? name.slice(0, name.indexOf("."))
      : name;
    const id = `gen:${process}:${segment}`;
    if (!this.services.has(id)) {
      this.services.set(id, {
        id,
        name: segment,
        process,
        description: "Generated from source.",
        state: [],
        composes: [],
      });
    }
    return id;
  }

  private outsideService(id: string, name: string) {
    if (this.services.has(id)) return;
    this.services.set(id, {
      id,
      name,
      process: "outside",
      description: "Generated from source.",
      state: [],
      composes: [],
    });
  }

  /**
   * The wire type of a reply: the client call's type from the contract, or
   * the handler's own return type when the contract leaves it open.
   */
  private replyValue(call: ts.CallExpression, handler: FunctionNode) {
    const contract = this.returnTypeOfCall(call);
    if (
      contract !== undefined &&
      contract !== "unknown" &&
      contract !== "any"
    ) {
      return contract;
    }
    return this.returnTypeOf(handler);
  }

  /** The function's return type as text, `Promise<>` unwrapped, error members dropped. */
  private returnTypeOf(fn: ts.SignatureDeclaration) {
    const signature = this.checker.getSignatureFromDeclaration(fn);
    if (signature === undefined) return undefined;
    return this.typeText(this.checker.getReturnTypeOfSignature(signature));
  }

  private returnTypeOfCall(call: ts.CallExpression) {
    const signature = this.checker.getResolvedSignature(call);
    if (signature === undefined) return undefined;
    return this.typeText(this.checker.getReturnTypeOfSignature(signature));
  }

  private typeText(type: ts.Type) {
    let text = this.checker.typeToString(type);
    // oRPC clients return `PromiseWithError<T, E>`; the value is `T`.
    const promised = /^(?:Promise|PromiseWithError)<(.*)>$/.exec(text);
    if (promised?.[1] !== undefined) {
      const inner = promised[1];
      const comma = topLevelIndex(inner, ", ");
      text = comma === -1 ? inner : inner.slice(0, comma);
    }
    const members = splitUnion(text).filter(
      (member) => !/Error\b/.test(member),
    );
    if (members.length === 0) return text;
    const joined = members.join(" | ").replace(/^undefined$/, "void");
    if (joined === "any" || joined === "unknown") return undefined;
    return joined.length > 48 ? `${joined.slice(0, 47)}…` : joined;
  }

  private sourceOf(node: ts.Node) {
    const file = node.getSourceFile();
    return {
      path: this.relative(file.fileName),
      start: lineOf(node.getStart(), file),
      end: lineOf(node.getEnd(), file),
    };
  }

  private relative(file: string) {
    const marker = file.lastIndexOf("/node_modules/");
    if (marker !== -1) return file.slice(marker + 1);
    return path.relative(this.config.repoRoot, file);
  }

  private where(node: ts.Node) {
    return `${this.relative(node.getSourceFile().fileName)}:${lineOf(node.getStart(), node.getSourceFile())}`;
  }

  private omit(call: ts.CallExpression, reason: string) {
    this.omitted.push({
      callee: call.expression.getText(),
      where: this.where(call),
      reason,
    });
  }
}

function isFunctionNode(node: ts.Node): node is FunctionNode {
  return ts.isFunctionLike(node) && "body" in node && node.body !== undefined;
}

function functionAtLine(file: ts.SourceFile, line: number) {
  let found: FunctionNode | undefined;
  visit(file, (node) => {
    if (!isFunctionNode(node)) return;
    const start = lineOf(node.getStart(), file);
    const end = lineOf(node.getEnd(), file);
    if (start <= line && line <= end) {
      if (found === undefined || node.getWidth() < found.getWidth())
        found = node;
    }
  });
  return found;
}

function enclosingFunction(node: ts.Node): FunctionNode {
  let current: ts.Node | undefined = node.parent;
  while (current !== undefined) {
    if (isFunctionNode(current)) return current;
    current = current.parent;
  }
  throw new Error(`no enclosing function for ${node.getText()}`);
}

/**
 * Callbacks these methods take run as part of the same flow; any other
 * nested function is deferred (an event handler, a tool's `execute`) and is
 * not part of this frame.
 */
const syncCallbackMethods = new Set([
  "then",
  "catch",
  "finally",
  "map",
  "flatMap",
  "forEach",
  "filter",
  "find",
  "some",
  "every",
  "reduce",
  "sort",
  "toSorted",
]);

function isSyncCallback(node: FunctionNode) {
  const parent = node.parent;
  return (
    ts.isCallExpression(parent) &&
    parent.arguments.some((argument) => argument === node) &&
    ts.isPropertyAccessExpression(parent.expression) &&
    syncCallbackMethods.has(parent.expression.name.text)
  );
}

/**
 * `Container.own`: the function's own name (or the property or variable it is
 * assigned to), under the class or named function it sits in. At module
 * level the container is the variable whose value holds it (`sessionsRouter`).
 */
function frameName(fn: ts.SignatureDeclaration): string {
  const own = ownName(fn);
  let current: ts.Node | undefined = fn.parent;
  let moduleVariable: string | undefined;
  while (current !== undefined) {
    if (ts.isClassDeclaration(current) && current.name !== undefined) {
      return `${current.name.text}.${own}`;
    }
    if (isFunctionNode(current)) {
      const outer = ownName(current);
      return outer === own ? own : `${outer}.${own}`;
    }
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      moduleVariable = current.name.text;
    }
    current = current.parent;
  }
  if (moduleVariable !== undefined && moduleVariable !== own) {
    return `${moduleVariable}.${own}`;
  }
  return own;
}

function ownName(fn: ts.SignatureDeclaration): string {
  if (
    (ts.isFunctionDeclaration(fn) ||
      ts.isMethodDeclaration(fn) ||
      ts.isMethodSignature(fn)) &&
    fn.name !== undefined
  ) {
    return fn.name.getText();
  }
  let current: ts.Node | undefined = fn.parent;
  while (current !== undefined) {
    if (ts.isPropertyAssignment(current) || ts.isPropertySignature(current)) {
      return current.name.getText();
    }
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      return current.name.text;
    }
    if (isFunctionNode(current) || ts.isObjectLiteralExpression(current)) break;
    current = current.parent;
  }
  return "(anonymous)";
}

function jsDocSummary(fn: ts.SignatureDeclaration) {
  const docs = ts.getJSDocCommentsAndTags(fn);
  for (const doc of docs) {
    if (!ts.isJSDoc(doc) || doc.comment === undefined) continue;
    const text = ts.getTextOfJSDocComment(doc.comment);
    if (text === undefined) return undefined;
    return text.split("\n")[0];
  }
  return undefined;
}

/** The string literal prefix of a `queryKey: [...]` array in an options object. */
function queryKeyOf(options: ts.Expression | undefined) {
  if (options === undefined || !ts.isObjectLiteralExpression(options)) {
    return undefined;
  }
  const property = options.properties.find(
    (entry) => entry.name !== undefined && entry.name.getText() === "queryKey",
  );
  if (property === undefined || !ts.isPropertyAssignment(property)) {
    return undefined;
  }
  if (!ts.isArrayLiteralExpression(property.initializer)) return undefined;
  const key: string[] = [];
  for (const element of property.initializer.elements) {
    if (!ts.isStringLiteral(element)) break;
    key.push(element.text);
  }
  return key;
}

/** Source text on one line, cut so a label stays readable. */
function shortText(node: ts.Node) {
  const text = node.getText().replaceAll(/\s+/g, " ");
  return text.length > 72 ? `${text.slice(0, 71)}…` : text;
}

function argsText(call: ts.CallExpression) {
  if (call.arguments.length === 0) return undefined;
  const text = call.arguments.map((argument) => shortText(argument)).join(", ");
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

/**
 * The condition a folded branch adds: `if (x)` for the arm that runs when
 * `x` holds, `unless (x)` for the arm that runs when it does not. A negated
 * condition flips so the label stays positive.
 */
function guardLabel(condition: ts.Expression, holds: boolean) {
  let expression = condition;
  let positive = holds;
  while (ts.isParenthesizedExpression(expression)) {
    expression = expression.expression;
  }
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.ExclamationToken
  ) {
    expression = expression.operand;
    positive = !positive;
  }
  return `${positive ? "if" : "unless"} (${shortText(expression)})`;
}

/** A statement after which the rest of the body cannot run. */
function alwaysExits(statement: ts.Statement): boolean {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
    return true;
  }
  if (ts.isBlock(statement)) {
    const last = statement.statements.at(-1);
    return last !== undefined && alwaysExits(last);
  }
  return false;
}

/** Whether the call's value is awaited, through `.then` / `.catch` chains. */
function isAwaited(call: ts.CallExpression) {
  let current: ts.Node = call;
  while (
    ts.isPropertyAccessExpression(current.parent) ||
    ts.isCallExpression(current.parent)
  ) {
    current = current.parent;
  }
  return ts.isAwaitExpression(current.parent);
}

/** Top-level members of a union type's text. */
function splitUnion(text: string) {
  const members: string[] = [];
  let rest = text;
  for (;;) {
    const index = topLevelIndex(rest, " | ");
    if (index === -1) break;
    members.push(rest.slice(0, index));
    rest = rest.slice(index + 3);
  }
  members.push(rest);
  return members;
}

/** First index of `separator` outside any brackets, or -1. */
function topLevelIndex(text: string, separator: string) {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "<" || char === "(" || char === "[" || char === "{")
      depth += 1;
    if (char === ">" || char === ")" || char === "]" || char === "}")
      depth -= 1;
    if (depth === 0 && text.startsWith(separator, index)) return index;
  }
  return -1;
}

function lineOf(position: number, file: ts.SourceFile) {
  return file.getLineAndCharacterOfPosition(position).line + 1;
}

function visit(node: ts.Node, fn: (node: ts.Node) => void) {
  fn(node);
  ts.forEachChild(node, (child) => visit(child, fn));
}
