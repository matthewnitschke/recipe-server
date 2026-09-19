# Recipe Server API

A recipe server that stores recipes as a single Markdown document per recipe
(YAML frontmatter for `name`/`category`, then `## Ingredients` and
`## Instructions` sections).

Base URL: `http://localhost:{PORT}` (default 8080)

## Recipe Markdown format

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

- The YAML frontmatter (`---` delimited) is authoritative for `name` and
  `category`. There is no top-level `#` title heading.
- `## Ingredients` — bullet (`*` or `-`) lines become the ingredient list.
- `## Instructions` — numbered (`1.`) lines become steps. A blockquote (`>`)
  line directly after a step restates that step's ingredients, comma-separated.
- The full document is stored verbatim as the `markdown` column; `name` and
  `category` are mirrored into columns for filtering.

## Endpoints

### Health

```
GET /api/health
```

Response:

```json
{ "ok": true }
```

### Create Recipe

```
POST /api/recipes
```

Accepts the recipe Markdown document as:

- a raw text body, or
- `{ "markdown": "..." }` JSON, or
- a form field named `markdown`.

| Field      | Required | Default | Notes                               |
| ---------- | -------- | ------- | ----------------------------------- |
| `markdown` | yes      | —       | Full recipe document (see above)    |

`name`/`category` are read from the frontmatter.

Response: `201 Created` (empty body). Sets `HX-Redirect: /recipes/:id`.

Errors:
- `400` — missing `markdown` field or body too large
- `413` — body too large

### List Recipes

```
GET /api/recipes
GET /api/recipes?name=pie
GET /api/recipes?category=Dinner
GET /api/recipes?name=pie&category=Dinner
```

Query params use substring matching (SQL `LIKE`) against the `name`/`category`
columns.

Response:

```json
[
  {
    "id": 1,
    "name": "Arayes",
    "category": "mains",
    "markdown": "---\nname: Arayes\ncategory: mains\n---\n\n...",
    "created_at": "2025-01-15 10:30:00"
  }
]
```

### Get Recipe

```
GET /api/recipes/:id
```

Response: The full recipe object (same shape as a list item), including the
`markdown` source.

Error: `404` — `{ "error": "recipe not found" }`

### Update Recipe

```
PUT /api/recipes/:id
```

Accepts the same input as `POST /api/recipes` (raw text, JSON `markdown`, or a
form field). The `markdown`, `name`, and `category` are replaced wholesale.

Response: `200 OK` (empty body). Sets `HX-Redirect: /recipes/:id`.

Errors:
- `400` — missing `markdown` field
- `404` — recipe not found

### Delete Recipe

```
DELETE /api/recipes/:id
```

Response: `200 OK` (empty body). Sets `HX-Redirect: /` header.

Error: `404` — recipe not found

### Toggle Star

```
POST /api/recipes/:id/star
```

Toggles the recipe's `starred` flag in the database. Used by the htmx list UI;
with `name`/`category` form fields present it responds with the (re-filtered)
recipe-list HTML fragment so grouped/sorted output stays consistent.

Response: the recipe-list HTML fragment (`200 OK`).

Error: `404` — recipe not found

## HTML Routes

| Path                    | Description                            |
| ----------------------- | -------------------------------------- |
| `GET /`                 | Home page with recipe list and filters |
| `GET /recipes`          | HTMX fragment — filtered recipe list   |
| `GET /recipes/new`      | Create recipe form page (single textbox) |
| `GET /recipes/:id`      | Recipe view page (rendered)            |
| `GET /recipes/:id/edit` | Edit recipe form page (single textbox) |

## Notes

- Max request body size: 10 MB (configurable via `MAX_BODY_BYTES` env var)
- Database: SQLite at `./data/recipes.db` (configurable via `DB_PATH`)
- All error responses are JSON: `{ "error": "..." }`