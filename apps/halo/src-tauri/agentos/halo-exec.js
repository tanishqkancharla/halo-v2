export default function haloExec(pi) {
  pi.registerTool({
    name: "exec",
    label: "Exec",
    description: `Run TypeScript in the current AgentOS workspace with these tools:
tools.files.read(path: string): Promise<string>
tools.files.patch(patchText: string): Promise<string>
tools.files.edit(path: string, oldText: string, newText: string, replaceAll?: boolean): Promise<void>
tools.files.write(path: string, content: string): Promise<void>
tools.shell.bash(command: string): Promise<{ stdout: string; stderr: string; exitCode: number | null }>

The code runs inside an async function. Use await for tool calls and return a value when useful.`,
    promptSnippet: "Run TypeScript with workspace file and shell tools",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "TypeScript code to execute",
        },
      },
      required: ["code"],
    },
    async execute(_toolCallId, { code }, signal, _onUpdate, ctx) {
      const input = JSON.stringify({ source: code, cwd: ctx.cwd });
      const result = await pi.exec(
        "agentos-halo",
        ["exec", "--json", input],
        { cwd: ctx.cwd, signal },
      );
      if (result.code !== 0) {
        throw new Error(result.stderr);
      }
      const binding = JSON.parse(result.stdout).result;
      return {
        content: [{ type: "text", text: JSON.stringify(binding) }],
        details: binding,
      };
    },
  });

  pi.on("session_start", () => {
    pi.setActiveTools(["exec"]);
  });
}
