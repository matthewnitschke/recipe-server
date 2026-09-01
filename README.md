# recipe-server

A server for accepting `.typ` files, compiling them to PDFs with
[Typst](https://typst.app), and storing them in a sqlite database.

Provides a _very_ simple [htmx](https://htmx.org) powered website for listing
all the recipes and downloading their PDFs.

```
.typ source ──> POST /api/recipes ──> typst compile ──> PDF stored in sqlite ──> served at /api/recipes/:id.pdf
```

## Quick start

```sh
bun install
bun run dev          # http://localhost:8080
```

Open http://localhost:8080 to see the recipe list (server-rendered on load,
filterable by name/category as you type). Click **+ Add recipe** to open the
new-recipe page, where you type the name, category, and `.typ` source directly
in the browser. You can also add recipes from the CLI (the raw `.typ` source is
the request body, or as JSON):

```sh
curl -X POST -F "name=pancakes" -F "category=breakfast" -F "file=@pancakes.typ" \
     http://localhost:8080/api/recipes
curl -H 'Content-Type: application/json' \
     -d '{"name":"pancakes","category":"breakfast","source":"= Pancakes"}' \
     http://localhost:8080/api/recipes
```

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | server-rendered recipe page + htmx filter |
| `POST` | `/api/recipes` | create a recipe. Accepts multipart form-data (`name`, `category` fields + `file`), or JSON `{ "source", "name", "category" }`, or the raw `.typ` source as the body (`name`/`category` via query params) |
| `GET` | `/api/recipes` | list recipes (metadata only, JSON); filter with `?name=` / `?category=` |
| `GET` | `/api/recipes/:id` | recipe metadata + source (JSON) |
| `PUT` | `/api/recipes/:id` | update name/category (JSON `{ "name", "category" }`). Include `source` to also recompile the `.typ` and regenerate the PDF (422 on compile error) |
| `DELETE` | `/api/recipes/:id` | delete a recipe |
| `GET` | `/api/recipes/:id.pdf` | the compiled PDF |
| `GET` | `/recipes/new` | create page (empty name, category, source) |
| `GET` | `/recipes/:id/edit` | edit page (name, category, editable `.typ` source, delete) |
| `GET` | `/api/health` | `{ ok, typst }` |
| `GET` | `/recipes` | filtered recipe list as an HTML fragment (used by the htmx UI) |

## Configuration (env vars)

| Var | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `DB_PATH` | `./data/recipes.db` | sqlite database file (Docker image sets `/data/recipes.db` on the volume) |
| `TYPST_BIN` | `typst` | path to the typst binary |
| `MAX_BODY_BYTES` | `10485760` | max upload size |

## Storage

Recipes are stored in a sqlite database (via `bun:sqlite`):

```sql
CREATE TABLE recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,          -- optional category, used for filtering
  source TEXT NOT NULL,   -- original .typ source
  pdf  BLOB NOT NULL,     -- compiled PDF
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Docker

```sh
docker build -t recipe-server .
docker run --rm -p 8080:8080 -v recipe-data:/data recipe-server
```

## Project layout

```
src/index.ts    boots the Bun.serve server with real deps
src/app.ts      createApp factory: router + API routes (testable deps)
src/compile.ts  typst compile subprocess (Bun.spawn)
src/db.ts       bun:sqlite persistence
src/ui/          static HTML shell + TSX components (list, edit page)
src/*.test.ts   bun test suite (uses an in-memory db + fake compiler)
```
