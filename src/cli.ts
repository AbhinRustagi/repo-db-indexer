#!/usr/bin/env node
import { Command } from "commander";
import { runBuild, runValidate } from "./pipeline.js";

interface CliOpts {
  config: string;
  cwd?: string;
}

async function dispatch(
  fn: (opts: CliOpts) => Promise<number>,
  opts: CliOpts
): Promise<never> {
  try {
    process.exit(await fn(opts));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
}

const program = new Command();

program
  .name("repo-db-indexer")
  .description("Build content indexes for git-native content repositories")
  .version("0.2.0");

program
  .command("build", { isDefault: true })
  .description("Discover, validate, and write index files")
  .option(
    "-c, --config <path>",
    "Path to config file, or '-' to read from stdin",
    "repo-db.yaml"
  )
  .option("-C, --cwd <dir>", "Working directory for relative paths")
  .action((opts: CliOpts) => dispatch(runBuild, opts));

program
  .command("validate")
  .description("Discover and validate without writing any files")
  .option(
    "-c, --config <path>",
    "Path to config file, or '-' to read from stdin",
    "repo-db.yaml"
  )
  .option("-C, --cwd <dir>", "Working directory for relative paths")
  .action((opts: CliOpts) => dispatch(runValidate, opts));

program.parseAsync(process.argv);
