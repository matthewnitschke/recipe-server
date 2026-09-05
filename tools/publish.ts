import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseMarkdown } from "../src/markdown.js";

const DEFAULT_BASE_URL = "http://localhost:8080";

interface RecipeRecord {
  id: number;
  name: string;
}

/**
 * Upsert a single markdown recipe into the recipe-server.
 *
 * Recipes are matched by the frontmatter `name` (substring list + exact
 * match); existing ones are updated via `PUT /api/recipes/:id`, new ones are
 * created via `POST /api/recipes`.
 */
async function publish(baseUrl: string, markdown: string): Promise<{ action: "created" | "updated"; id: number }> {
  const name = parseMarkdown(markdown).name;
  const body = JSON.stringify({ markdown });

  const listUrl = new URL("/api/recipes", baseUrl);
  listUrl.searchParams.set("name", name);
  const listRes = await fetch(listUrl);
  if (!listRes.ok) {
    throw new Error(`list failed (${listRes.status}): ${await listRes.text()}`);
  }
  const recipes = (await listRes.json()) as RecipeRecord[];
  const existing = recipes.find((r) => r.name === name);

  const target = existing
    ? new URL(`/api/recipes/${existing.id}`, baseUrl)
    : new URL("/api/recipes", baseUrl);
  const res = await fetch(target, {
    method: existing ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  if (!res.ok) {
    throw new Error(`${existing ? "update" : "create"} failed (${res.status}): ${await res.text()}`);
  }

  return { action: existing ? "updated" : "created", id: existing?.id ?? -1 };
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  const pattern = args.find((a, i) => !a.startsWith("--") && !(args[i - 1] === "--base"));
  const baseFlagIndex = args.indexOf("--base");
  const baseFlag = args.find((a) => a.startsWith("--base="));
  const baseUrl = baseFlag
    ? baseFlag.slice("--base=".length)
    : baseFlagIndex >= 0
      ? args[baseFlagIndex + 1]
      : DEFAULT_BASE_URL;
  const dryRun = args.includes("--dry-run");

  if (!pattern) {
    console.error("usage: bun run tools/publish.ts <recipe.md|glob> [--base=URL] [--dry-run]");
    console.error(`  base URL defaults to ${DEFAULT_BASE_URL}`);
    process.exit(1);
  }

  const isGlob = /[*?[\]{}]/.test(pattern);
  const files = isGlob
    ? [...new Bun.Glob(pattern).scanSync({ cwd: process.cwd(), onlyFiles: true })].sort()
    : [resolve(pattern)];

  if (files.length === 0) {
    console.error(`no files matched ${pattern}`);
    process.exit(1);
  }

  let failures = 0;
  for (const file of files) {
    try {
      const markdown = await readFile(file, "utf8");
      const name = parseMarkdown(markdown).name;

      if (dryRun) {
        console.error(`${file} -> [dry-run] ${name}`);
        continue;
      }

      const { action, id } = await publish(baseUrl, markdown);
      console.error(`${file} -> ${action} ${id} (${name})`);
    } catch (err) {
      failures += 1;
      console.error(`${file} -> ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (failures > 0) {
    console.error(`${failures} file(s) failed`);
    process.exit(1);
  }
}