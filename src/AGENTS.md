# Recipe Server API

A Typst-based recipe compilation server. Submit `.typ` source files, which are compiled to PDF and stored in SQLite.

Base URL: `http://localhost:{PORT}` (default 8080)

## Endpoints

### Health

```
GET /api/health
```

Response:

```json
{ "ok": true, "typst": "v0.11.0" }
```

### Create Recipe

```
POST /api/recipes
```

Compiles a Typst source file to PDF and stores it. Accepts multiple content types:

**JSON:**

```json
POST /api/recipes
Content-Type: application/json

{
  "name": "My Recipe",
  "category": "Dinner",
  "source": "#import \"_template.typ\": *\n#show: recipe-page.with(name: name, category: category)"
}
```

**Multipart form:**

```
POST /api/recipes
Content-Type: multipart/form-data

file: <.typ file>
name: My Recipe
category: Dinner
```

**Form-urlencoded:**

```
POST /api/recipes
Content-Type: application/x-www-form-urlencoded

source=#import "_template.typ": *...&name=My+Recipe&category=Dinner
```

**Raw body:**

```
POST /api/recipes
Content-Type: text/plain

#import "_template.typ": *
#show: recipe-page.with(name: name, category: category)
```

For raw body, pass `name` and `category` as query params: `?name=My+Recipe&category=Dinner`

| Field      | Required | Default | Notes                          |
| ---------- | -------- | ------- | ------------------------------ |
| `source`   | yes      | -       | Typst source text              |
| `name`     | no       | `"job"` | Recipe name                    |
| `category` | no       | `null`  | Category for filtering         |

Response: `201 Created` (empty body). Sets `HX-Redirect: /` header.

Errors:
- `400` — missing `source` or body too large (>10 MB)
- `422` — Typst compilation failed (body contains error message)

### List Recipes

```
GET /api/recipes
GET /api/recipes?name=pie
GET /api/recipes?category=Dinner
GET /api/recipes?name=pie&category=Dinner
```

Query params use substring matching (SQL `LIKE`).

Response:

```json
[
  {
    "id": 1,
    "name": "Apple Pie",
    "category": "Dessert",
    "source": "#import \"_template.typ\": *...",
    "created_at": "2025-01-15 10:30:00"
  }
]
```

### Get Recipe

```
GET /api/recipes/:id
```

Response: Single recipe object (same shape as list item, no `pdf` field).

Error: `404` — `{ "error": "recipe not found" }`

### Download PDF

```
GET /api/recipes/:id.pdf
```

Response: `application/pdf` binary. Content-Disposition is `inline`.

Error: `404` — `{ "error": "recipe not found" }`

### Update Recipe

```
PUT /api/recipes/:id
```

Accepts JSON or form-urlencoded body. Only `name` is required. If `source` is provided, the PDF is recompiled.

| Field      | Required | Notes                                      |
| ---------- | -------- | ------------------------------------------ |
| `name`     | yes      |                                            |
| `category` | no       | Set to `null` to clear                     |
| `source`   | no       | If provided, triggers recompilation to PDF |

Response: `200 OK` (empty body). Sets `HX-Redirect: /` header.

Errors:
- `400` — `name` is missing
- `404` — recipe not found
- `422` — Typst compilation failed

### Delete Recipe

```
DELETE /api/recipes/:id
```

Response: `200 OK` (empty body). Sets `HX-Redirect: /` header.

Error: `404` — recipe not found

## HTML Routes

| Path                | Description                              |
| ------------------- | ---------------------------------------- |
| `GET /`             | Home page with recipe list and filters   |
| `GET /recipes`      | HTMX fragment — filtered recipe list     |
| `GET /recipes/new`  | Create recipe form page                  |
| `GET /recipes/:id/edit` | Edit recipe form page               |

## Notes

- Max request body size: 10 MB (configurable via `MAX_BODY_BYTES` env var)
- Database: SQLite at `./data/recipes.db` (configurable via `DB_PATH`)
- Typst binary must be available on `PATH` (or set `TYPST_BIN`)
- All error responses are JSON: `{ "error": "..." }`
