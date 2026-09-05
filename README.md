# recipe-server

A server for storing recipes as Markdown documents and viewing them in the
browser.

```
markdown recipe ──> POST /api/recipes ──> stored in sqlite ──> served at /api/recipes/:id
                                                          └──> rendered to HTML at /recipes/:id
```

Provides a _very_ simple [htmx](https://htmx.org) powered website for listing,
viewing, and editing recipes in a single markdown textbox.

## Quick start

```sh
bun install
bun run dev         # http://localhost:8080
```

Open http://localhost:8080 to see the recipe list (server-rendered on load,
filterable by name/category as you type). Click a recipe to view it rendered.
Click **+ Add recipe** or **Edit** to edit the whole recipe as one markdown
document.

## Recipe Markdown format

Recipes are stored as a single Markdown document. The YAML frontmatter is
authoritative for `name`/`category` (no top-level `#` title):

```markdown
---
name: Arayes
category: mains
---

## Ingredients

* 1 medium onion
* 4 pitas

## Instructions

1. Cut the onion into big chunks and put it in a food processor.
> 1 medium onion

2. Process until pasty
```

- `## Ingredients` — bullet (`*`/`-`) lines become the ingredient list.
- `## Instructions` — numbered (`1.`) lines become steps; a `>` blockquote
  line right after a step restates that step's ingredients, comma-separated.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | server-rendered recipe page + htmx filter |
| `POST` | `/api/recipes` | create a recipe from a markdown body (raw text, `{ "markdown" }`, or form field) |
| `GET` | `/api/recipes` | list recipes (JSON); filter with `?name=` / `?category=` |
| `GET` | `/api/recipes/:id` | the full recipe, including `markdown` source |
| `PUT` | `/api/recipes/:id` | update a recipe from a markdown body |
| `DELETE` | `/api/recipes/:id` | delete a recipe |
| `GET` | `/recipes` | filtered recipe list as an HTML fragment (used by the htmx UI) |
| `GET` | `/recipes/:id` | recipe view page (rendered) |
| `GET` | `/recipes/:id/edit` | edit page (single markdown textbox, delete) |
| `GET` | `/recipes/new` | create page |
| `GET` | `/api/health` | `{ ok, typst }` |

## Configuration (env vars)

| Var | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `DB_PATH` | `./data/recipes.db` | sqlite database file (Docker image sets `/data/recipes.db` on the volume) |
| `MAX_BODY_BYTES` | `10485760` | max upload size |

## Storage

Recipes are stored in a sqlite database (via `bun:sqlite`):

```sql
CREATE TABLE recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,           -- optional category, used for filtering
  markdown TEXT NOT NULL DEFAULT '',   -- the full markdown document
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`name`/`category` are mirrored into columns (parsed from the frontmatter at
write time) for list filtering; the `markdown` column is the source of truth.

## Docker

```sh
docker build -t recipe-server .
docker run --rm -p 8080:8080 -v recipe-data:/data recipe-server
```

## Project layout

```
src/index.ts    boots the Bun.serve server with real deps
src/db.ts       bun:sqlite persistence (markdown recipe store)
src/markdown.ts parses the markdown recipe format (frontmatter + sections)
src/utils.ts    request body parsing
src/compile.ts  typst compile subprocess (only health-check used for now)
src/ui/         static HTML shell + TSX components (list, detail, edit)
src/*.test.ts   bun test suite (uses an in-memory db)
```