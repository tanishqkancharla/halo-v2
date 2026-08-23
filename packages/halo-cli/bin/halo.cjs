#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");
const { resolve } = require("node:path");

const cli = resolve(__dirname, "../src/cli.ts");
const tsx = require.resolve("tsx");
const child = spawn(
  process.execPath,
  ["--import", tsx, cli, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
child.on("exit", (code) => {
  process.exit(code === null ? 1 : code);
});
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
