import { dirname, resolve } from "node:path";
import { loadConfig, parseConfigString } from "./config/load.js";
import type { Config } from "./config/schema.js";
import { discover } from "./content/discover.js";
import { emitIndexes, emitLlmsTxt, emitReadme } from "./emit/index.js";
import {
  formatDiagnostics,
  runValidation,
  summarize,
} from "./validation/index.js";

export interface PipelineOptions {
  config: string;
  cwd?: string;
}

export interface PipelineLogger {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

const defaultLogger: PipelineLogger = {
  info: (msg) => console.log(msg),
  error: (msg) => console.error(msg),
};

export async function runBuild(
  opts: PipelineOptions,
  logger: PipelineLogger = defaultLogger
): Promise<number> {
  const { config, cwd } = await resolveConfig(opts);
  const discovered = await discover(config, cwd);
  const diagnostics = await runValidation(config, discovered, cwd);

  const formatted = formatDiagnostics(diagnostics);
  if (formatted) logger.error(formatted);
  if (summarize(diagnostics).errors > 0) return 1;

  const idx = await emitIndexes(config, discovered.items, cwd);
  const llmsPath = await emitLlmsTxt(config, discovered.items, cwd);
  const readmePath = await emitReadme(config, discovered.items, cwd);

  const written = [...idx.written];
  if (llmsPath) written.push(llmsPath);
  if (readmePath) written.push(readmePath);
  logger.info(
    `Wrote ${written.length} file${written.length === 1 ? "" : "s"} (${discovered.items.length} items).`
  );
  return 0;
}

export async function runValidate(
  opts: PipelineOptions,
  logger: PipelineLogger = defaultLogger
): Promise<number> {
  const { config, cwd } = await resolveConfig(opts);
  const discovered = await discover(config, cwd);
  const diagnostics = await runValidation(config, discovered, cwd);

  const formatted = formatDiagnostics(diagnostics);
  if (formatted) logger.error(formatted);
  const { errors } = summarize(diagnostics);
  if (errors > 0) return 1;
  logger.info(`OK: validated ${discovered.items.length} items.`);
  return 0;
}

async function resolveConfig(
  opts: PipelineOptions
): Promise<{ config: Config; cwd: string }> {
  if (opts.config === "-") {
    const raw = await readStdin();
    const config = parseConfigString(raw, "<stdin>");
    const cwd = opts.cwd ? resolve(opts.cwd) : process.cwd();
    return { config, cwd };
  }
  const baseDir = opts.cwd ? resolve(opts.cwd) : process.cwd();
  const configPath = resolve(baseDir, opts.config);
  const config = await loadConfig(configPath);
  const cwd = opts.cwd ? resolve(opts.cwd) : dirname(configPath);
  return { config, cwd };
}

async function readStdin(): Promise<string> {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}
