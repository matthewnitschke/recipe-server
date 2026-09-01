import { Hono } from "hono";

import { RecipeStore } from "./db.js";
import { compileOrThrow, compileTypst, getTypstVersion } from "./compile.js";
import { checkBodySize, escapeHtml, filterFromQuery, HttpError, parseSource } from "./utils.js";
import { renderRecipeList } from "./ui/recipes";
import { renderEditPage, renderNewRecipePage } from "./ui/edit";
import { readFile } from "node:fs/promises";

const PORT = Number(process.env.PORT ?? 8080);
const DB_PATH = process.env.DB_PATH ?? new URL("../data/recipes.db", import.meta.url).pathname;
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 10 * 1024 * 1024);

const TEMPLATE_PATH = new URL("./templates/_template.typ", import.meta.url).pathname;

const store = RecipeStore.open(DB_PATH);
const page = Bun.file(new URL("./ui/index.html", import.meta.url));
const template = await readFile(TEMPLATE_PATH, "utf8");

function compileOptions(name: string, category: string | null): Parameters<typeof compileTypst>[1] {
  return {
    files: { "_template.typ": template },
    inputs: {
      ...(category ? { category } : {}),
      name,
    },
  };
}

const app = new Hono();

app.onError((err) => {
  if (err instanceof HttpError) return new Response(JSON.stringify({ error: err.message }), { status: err.status, headers: { "content-type": "application/json; charset=utf-8" } });
  if (err instanceof SyntaxError) return new Response(JSON.stringify({ error: "invalid JSON in request body" }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
  const message = err instanceof Error ? err.message : String(err);
  return new Response(JSON.stringify({ error: `internal server error: ${message}` }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
});

app.notFound((c) => {
  return new Response(JSON.stringify({ error: `no route for ${c.req.method} ${c.req.path}` }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
});

// --- HTML routes ---

app.get("/", async (c) => {
  const list = renderRecipeList(store.listRecipes());
  const shell = (await page.text()).replace("{{recipes}}", list);
  return c.html(shell);
});

app.get("/recipes", (c) => {
  const url = new URL(c.req.url);
  return c.html(renderRecipeList(store.listRecipes(filterFromQuery(url))));
});

app.get("/recipes/new", (c) => {
  return c.html(renderNewRecipePage());
});

app.get("/recipes/:id/edit", (c) => {
  const recipe = store.getRecipe(Number(c.req.param("id")));
  if (!recipe) return c.json({ error: "recipe not found" }, 404);
  return c.html(renderEditPage(recipe));
});

// --- API routes ---

app.get("/api/spec", async (c) => {
  const spec = await readFile(new URL("./AGENTS.md", import.meta.url), "utf8");
  return c.text(spec, 200, { "content-type": "text/markdown; charset=utf-8" });
});

app.get("/api/health", async (c) => {
  return c.json({ ok: true, typst: await getTypstVersion() });
});

app.post("/api/recipes", async (c) => {
  checkBodySize(c.req.raw, MAX_BODY_BYTES);
  const input = await parseSource(c);
  const result = await compileOrThrow(compileTypst, input.source, compileOptions(input.name, input.category));
  if (!result.ok) return c.html(`<p class="error">typst compilation failed: ${escapeHtml(result.error)}</p>`, 422);
  store.createRecipe(input.name, input.category, input.source, result.pdf);
  c.header("HX-Redirect", "/");
  return c.body(null, 201);
});

app.get("/api/recipes", (c) => {
  const url = new URL(c.req.url);
  return c.json(store.listRecipes(filterFromQuery(url)));
});

app.get("/api/recipes/:path{^\\d+\\.pdf$}", (c) => {
  const id = Number(c.req.param("path").replace(/\.pdf$/, ""));
  const recipe = store.getRecipe(id);
  if (!recipe) return c.json({ error: "recipe not found" }, 404);
  return new Response(new Uint8Array(recipe.pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${recipe.name}.pdf"`,
    },
  });
});

app.get("/api/recipes/:id", (c) => {
  const recipe = store.getRecipe(Number(c.req.param("id")));
  if (!recipe) return c.json({ error: "recipe not found" }, 404);
  return c.json({ id: recipe.id, name: recipe.name, category: recipe.category, source: recipe.source, created_at: recipe.created_at });
});

app.put("/api/recipes/:id", async (c) => {
  const id = Number(c.req.param("id"));
  checkBodySize(c.req.raw, MAX_BODY_BYTES);

  let parsed: Record<string, unknown>;
  const contentType = (c.req.header("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/json")) {
    parsed = (await c.req.json()) as Record<string, unknown>;
  } else {
    parsed = await c.req.parseBody();
  }

  const name = typeof parsed.name === "string" && parsed.name ? parsed.name.trim() : undefined;
  if (!name) return c.html(`<p class="error">"name" is required</p>`, 400);
  const category = typeof parsed.category === "string" ? (parsed.category.trim() || null) : null;

  const rawSource = parsed.source;
  const hasSource = typeof rawSource === "string";
  const source: string | undefined = hasSource ? rawSource : undefined;

  if (!store.getRecipe(id)) return c.html(`<p class="error">recipe not found</p>`, 404);

  if (source !== undefined) {
    const result = await compileOrThrow(compileTypst, source, compileOptions(name, category));
    if (!result.ok) return c.html(`<p class="error">typst compilation failed: ${escapeHtml(result.error)}</p>`, 422);
    store.updateRecipe(id, name, category, source, result.pdf);
  } else {
    store.updateRecipe(id, name, category);
  }
  c.header("HX-Redirect", "/");
  return c.body(null, 200);
});

app.delete("/api/recipes/:id", (c) => {
  const deleted = store.deleteRecipe(Number(c.req.param("id")));
  if (!deleted) return c.html(`<p class="error">recipe not found</p>`, 404);
  c.header("HX-Redirect", "/");
  return c.body(null, 200);
});

Bun.serve({ port: PORT, fetch: app.fetch });

console.log(`recipe-server listening on http://localhost:${PORT}`);
console.log(`database: ${DB_PATH}`);
