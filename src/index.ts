import { Hono } from "hono";

import { RecipeStore, type RecipeFilter } from "./db.js";
import { getTypstVersion } from "./compile.js";
import { checkBodySize, filterFromQuery, HttpError, parseMarkdownInput } from "./utils.js";
import { renderRecipeList } from "./ui/recipes";
import { renderHomePage } from "./ui/home";
import { renderEditPage, renderNewRecipePage } from "./ui/edit";
import { renderRecipePage } from "./ui/recipe";
import { readFile } from "node:fs/promises";

const PORT = Number(process.env.PORT ?? 8080);
const DB_PATH = process.env.DB_PATH ?? new URL("../data/recipes.db", import.meta.url).pathname;
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 10 * 1024 * 1024);

const store = RecipeStore.open(DB_PATH);

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

function renderHome(filter: RecipeFilter = {}): string {
  const recipes = store.listRecipes(filter);
  return renderHomePage({
    nameValue: filter.name ?? "",
    selectedCategory: filter.category ?? "",
    categories: store.listCategories(),
    recipesHtml: renderRecipeList(recipes),
  });
}

app.get("/", (c) => {
  return c.html(renderHome());
});

app.get("/recipes", (c) => {
  const filter = filterFromQuery(new URL(c.req.url));
  // htmx fragment requests swap just the list; plain navigations (e.g. a
  // reload or back-button visit to a pushed filter URL) get the full shell.
  const isHtmx = c.req.header("HX-Request") !== undefined;
  if (isHtmx) return c.html(renderRecipeList(store.listRecipes(filter)));
  return c.html(renderHome(filter));
});

app.get("/manifest.webmanifest", (c) => {
  const manifest = {
    name: "🍳 The Rotation",
    short_name: "Recipes",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
  return c.json(manifest, 200, { "content-type": "application/manifest+json; charset=utf-8" });
});

const uiFile = (name: string) => Bun.file(new URL(`./ui/${name}`, import.meta.url));

for (const name of ["apple-touch-icon.png", "icon-192.png", "icon-512.png"]) {
  app.get(`/${name}`, (c) => new Response(uiFile(name), { headers: { "content-type": "image/png" } }));
}

app.get("/recipes/new", (c) => {
  return c.html(renderNewRecipePage());
});

app.get("/recipes/:id/edit", (c) => {
  const recipe = store.getRecipe(Number(c.req.param("id")));
  if (!recipe) return c.json({ error: "recipe not found" }, 404);
  return c.html(renderEditPage(recipe));
});

app.get("/recipes/:id", (c) => {
  const recipe = store.getRecipe(Number(c.req.param("id")));
  if (!recipe) return c.json({ error: "recipe not found" }, 404);
  return c.html(renderRecipePage(recipe));
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
  const input = await parseMarkdownInput(c);
  const id = store.createRecipe(input.name, input.category, input.markdown);
  c.header("HX-Redirect", `/recipes/${id}`);
  return c.body(null, 201);
});

app.get("/api/recipes", (c) => {
  const url = new URL(c.req.url);
  return c.json(store.listRecipes(filterFromQuery(url)));
});

app.get("/api/recipes/:id", (c) => {
  const recipe = store.getRecipe(Number(c.req.param("id")));
  if (!recipe) return c.json({ error: "recipe not found" }, 404);
  return c.json(recipe);
});

app.put("/api/recipes/:id", async (c) => {
  const id = Number(c.req.param("id"));
  checkBodySize(c.req.raw, MAX_BODY_BYTES);

  if (!store.getRecipe(id)) return c.html(`<p class="error">recipe not found</p>`, 404);

  const input = await parseMarkdownInput(c);
  store.updateRecipe(id, input.name, input.category, input.markdown);
  c.header("HX-Redirect", `/recipes/${id}`);
  return c.body(null, 200);
});

app.delete("/api/recipes/:id", (c) => {
  const deleted = store.deleteRecipe(Number(c.req.param("id")));
  if (!deleted) return c.html(`<p class="error">recipe not found</p>`, 404);
  c.header("HX-Redirect", "/");
  return c.body(null, 200);
});

app.post("/api/recipes/clear-stars", async (c) => {
  store.clearStars();

  const form = await c.req.parseBody();
  const name = typeof form["name"] === "string" ? form["name"].trim() : undefined;
  const category = typeof form["category"] === "string" ? form["category"].trim() : undefined;
  const filter: RecipeFilter = {
    ...(name ? { name } : {}),
    ...(category ? { category } : {}),
  };
  return c.html(renderRecipeList(store.listRecipes(filter)));
});

app.post("/api/recipes/:id/star", async (c) => {
  const id = Number(c.req.param("id"));
  const recipe = store.getRecipe(id);
  if (!recipe) return c.html(`<p class="error">recipe not found</p>`, 404);

  store.setStarred(id, !recipe.starred);

  const form = await c.req.parseBody();
  const name = typeof form["name"] === "string" ? form["name"].trim() : undefined;
  const category = typeof form["category"] === "string" ? form["category"].trim() : undefined;
  const filter: RecipeFilter = {
    ...(name ? { name } : {}),
    ...(category ? { category } : {}),
  };
  return c.html(renderRecipeList(store.listRecipes(filter)));
});

Bun.serve({ port: PORT, fetch: app.fetch });

console.log(`recipe-server listening on http://localhost:${PORT}`);
console.log(`database: ${DB_PATH}`);