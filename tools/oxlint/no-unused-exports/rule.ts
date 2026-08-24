import { defineRule } from "@oxlint/plugins";

import { unusedExportNames } from "./unused-exports.ts";

import type { ESTree } from "@oxlint/plugins";

/** Disallow exporting a binding that no other file in the workspace imports. */
export const noUnusedExportsRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow exports that are never imported by another workspace file. Keep the binding; drop the export.",
		},
		messages: {
			unusedExport:
				"`{{name}}` is exported from this file but never imported elsewhere. Remove the export.",
		},
	},
	createOnce(context) {
		const reportIfUnused = (node: ESTree.Node, name: string) => {
			if (unusedExportNames(context.filename).has(name)) {
				context.report({
					node,
					messageId: "unusedExport",
					data: { name },
				});
			}
		};
		return {
			ExportAllDeclaration(node) {
				if (node.exported === null || node.exported === undefined) {
					reportIfUnused(node, "*");
					return;
				}
				reportIfUnused(node.exported, node.exported.name);
			},
			ExportDefaultDeclaration(node) {
				reportIfUnused(node, "default");
			},
			ExportNamedDeclaration(node) {
				if (node.declaration !== null && node.declaration !== undefined) {
					for (const [exported, name] of declaredExportNames(node.declaration)) {
						reportIfUnused(exported, name);
					}
					return;
				}
				for (const specifier of node.specifiers) {
					reportIfUnused(specifier.exported, specifier.exported.name);
				}
			},
		};
	},
});

function declaredExportNames(
	declaration: ESTree.ExportNamedDeclaration["declaration"],
): Array<[ESTree.Node, string]> {
	if (declaration === null || declaration === undefined) return [];
	if (
		declaration.type === "FunctionDeclaration" ||
		declaration.type === "ClassDeclaration" ||
		declaration.type === "TSTypeAliasDeclaration" ||
		declaration.type === "TSInterfaceDeclaration" ||
		declaration.type === "TSEnumDeclaration" ||
		declaration.type === "TSModuleDeclaration"
	) {
		if (declaration.id === null || declaration.id === undefined) return [];
		if (declaration.id.type !== "Identifier") return [];
		return [[declaration.id, declaration.id.name]];
	}
	if (declaration.type !== "VariableDeclaration") return [];
	const names: Array<[ESTree.Node, string]> = [];
	for (const declarator of declaration.declarations) {
		collectPatternNames(declarator.id, names);
	}
	return names;
}

function collectPatternNames(
	pattern: ESTree.BindingPattern | ESTree.Expression,
	names: Array<[ESTree.Node, string]>,
): void {
	if (pattern.type === "Identifier") {
		names.push([pattern, pattern.name]);
		return;
	}
	if (pattern.type === "ObjectPattern") {
		for (const property of pattern.properties) {
			if (property.type === "Property") collectPatternNames(property.value, names);
			if (property.type === "RestElement") collectPatternNames(property.argument, names);
		}
		return;
	}
	if (pattern.type === "ArrayPattern") {
		for (const element of pattern.elements) {
			if (element !== null) collectPatternNames(element, names);
		}
		return;
	}
	if (pattern.type === "RestElement") {
		collectPatternNames(pattern.argument, names);
		return;
	}
	if (pattern.type === "AssignmentPattern") {
		collectPatternNames(pattern.left, names);
	}
}
