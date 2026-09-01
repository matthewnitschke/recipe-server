import { renderToStaticMarkup } from "react-dom/server";
import type { Recipe } from "../db";

export function renderEditPage(recipe: Recipe): string {
  return renderToStaticMarkup(<EditPage recipe={recipe} />);
}

export function renderNewRecipePage(): string {
  return renderToStaticMarkup(<EditPage recipe={null} />);
}

function EditPage({ recipe }: { recipe: Recipe | null }) {
  const isNew = recipe === null;
  const id = recipe?.id ?? null;
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{isNew ? "New recipe - recipe-server" : `Edit ${recipe.name} - recipe-server`}</title>
        <script src="https://unpkg.com/htmx.org@1.9.12" defer></script>
        <style>{`
          body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
          label { display: block; margin-bottom: .75rem; }
          input[type="text"] { margin-left: .5rem; }
          .delete { background: #fee; margin-top: 1rem; }
          .error { color: #b00; background: #fee; border: 1px solid #d99; border-radius: 4px; padding: .5rem .75rem; }
          .source { margin-top: 1.5rem; }
          .source label { display: block; margin-bottom: .35rem; font-weight: 600; }
          .source textarea {
            width: 100%; min-height: 200px; font-family: ui-monospace, monospace;
            font-size: .85rem; padding: .5rem; box-sizing: border-box; white-space: pre;
            background: #f4f4f4; border: 1px solid #ccc; border-radius: 4px;
          }
        `}</style>
      </head>
      <body>
        <p>
          <a href="/">← back to recipes</a>
        </p>
        <h1 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          {isNew ? "New recipe" : `Edit ${recipe.name}`}

          {!isNew ? (
            <>
              <button
                id="delete-recipe"
                hx-delete={`/api/recipes/${id}`}
                hx-confirm="Delete this recipe?"
                hx-target="#form-status"
                hx-swap="innerHTML"
              >
                Delete
              </button>
            </>
          ) : null}
        </h1>
        <form
          id="edit-form"
          hx-post={isNew ? "/api/recipes" : undefined}
          hx-put={!isNew ? `/api/recipes/${id}` : undefined}
          hx-target="#form-status"
          hx-swap="innerHTML"
          hx-disabled-elt="find button"
        >
          <label>
            Name
            <input type="text" name="name" defaultValue={recipe?.name ?? ""} />
          </label>
          <label>
            Category
            <input type="text" name="category" defaultValue={recipe?.category ?? ""} />
          </label>
          <div className="source">
            <label htmlFor="source">Source</label>
            <textarea id="source" name="source" spellCheck={false} rows={30} defaultValue={recipe?.source ?? ""} />
          </div>
          <p>
            <button type="submit">{isNew ? "Create" : "Save"}</button>
          </p>
        </form>
        <div id="form-status" role="alert"></div>
      </body>
    </html>
  );
}
