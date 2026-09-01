import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawn, type Subprocess } from "bun";

const execFileAsync = promisify(execFile);

export interface CompileOptions {
  typstBin?: string;
  fontPaths?: string[];
  format?: "pdf" | "png" | "svg";
  /** Extra files written into the compile directory beside main.typ, so `#import` can resolve. Keys are relative paths. */
  files?: Record<string, string>;
  /** Key/value pairs passed to typst as `--input`, readable in the source via `sys.inputs`. */
  inputs?: Record<string, string>;
}

export interface CompileResult {
  pdf: Buffer;
  stderr: string;
  durationMs: number;
}

export type CompileFn = (source: string | Buffer, opts?: CompileOptions) => Promise<CompileResult>;

export async function compileOrThrow(
  compile: CompileFn,
  source: string | Buffer,
  opts?: CompileOptions,
): Promise<{ ok: true; pdf: Uint8Array } | { ok: false; error: string }> {
  try {
    const result = await compile(source, opts);
    return { ok: true, pdf: result.pdf };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function getTypstVersion(bin = process.env.TYPST_BIN ?? "typst"): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(bin, ["--version"]);
    return (stdout.split("\n")[0] ?? "").trim() || null;
  } catch {
    return null;
  }
}

function run(command: string, args: string[], cwd: string): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    let child: Subprocess<"ignore", "ignore", "pipe">;
    try {
      child = spawn<"ignore", "ignore", "pipe">([command, ...args], { cwd, stdout: "ignore", stderr: "pipe" });
    } catch (err) {
      reject(err);
      return;
    }
    const stderrPromise = new Response(child.stderr).text();
    child.exited.then(async (code) => {
      const stderr = (await stderrPromise).trim();
      if (code !== 0) {
        const location = join(cwd, "main.typ");
        reject(new Error(`typst exited with code ${code}\n${stderr}\nFile: ${location}`));
        return;
      }
      resolve({ stderr });
    });
  });
}

export async function compileTypst(source: string | Buffer, opts: CompileOptions = {}): Promise<CompileResult> {
  const typstBin = opts.typstBin ?? process.env.TYPST_BIN ?? "typst";
  const dir = await mkdtemp(join(tmpdir(), "typst-compile-"));
  try {
    const srcPath = join(dir, "main.typ");
    const outPath = join(dir, `main.${opts.format ?? "pdf"}`);
    await writeFile(srcPath, source);

    for (const [name, content] of Object.entries(opts.files ?? {})) {
      const filePath = join(dir, name);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
    }

    const args: string[] = ["compile"];
    for (const fontPath of opts.fontPaths ?? []) {
      args.push("--font-path", fontPath);
    }
    for (const [key, value] of Object.entries(opts.inputs ?? {})) {
      args.push("--input", `${key}=${value}`);
    }
    if (opts.format && opts.format !== "pdf") {
      args.push("--format", opts.format);
    }
    args.push(srcPath, outPath);

    const started = Date.now();
    const res = await run(typstBin, args, dir);
    const durationMs = Date.now() - started;
    const pdf = await readFile(outPath);
    return { pdf, stderr: res.stderr, durationMs };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
