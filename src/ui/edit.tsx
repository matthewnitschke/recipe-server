import type { Recipe } from "../db";
import { renderPage } from "./layout";

const STYLE = `
  .delete { background: #fee; margin-top: 1rem; }
  .error { color: #b00; background: #fee; border: 1px solid #d99; border-radius: 4px; padding: .5rem .75rem; }
  textarea {
    width: 100%; font-family: ui-monospace, monospace;
    font-size: .85rem; padding: .5rem; box-sizing: border-box; white-space: pre;
    background: #f4f4f4; border: 1px solid #ccc; border-radius: 4px;
    min-height: 480px;
  }
`;

export function renderEditPage(recipe: Recipe): string {
  return renderPage(`Edit ${recipe.name} - recipe-server`, STYLE, <EditPage recipe={recipe} />);
}

export function renderNewRecipePage(): string {
  return renderPage("New recipe - recipe-server", STYLE, <EditPage recipe={null} />);
}

function EditPage({ recipe }: { recipe: Recipe | null }) {
  const isNew = recipe === null;
  const id = recipe?.id ?? null;
  return (
    <>
      <p>
        <a href={isNew ? "/" : `/recipes/${id}`}>← back{isNew ? " to recipes" : ` to ${recipe?.name}`}</a>
      </p>
      <h1 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        {isNew ? "New recipe" : `Edit ${recipe.name}`}

        {!isNew ? (
          <button
            id="delete-recipe"
            hx-delete={`/api/recipes/${id}`}
            hx-confirm="Delete this recipe?"
            hx-target="#form-status"
            hx-swap="innerHTML"
          >
            Delete
          </button>
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
        <textarea
          id="markdown"
          name="markdown"
          spellCheck={false}
          rows={28}
          defaultValue={recipe?.markdown ?? `---
name: Water
category: Mains
---

## Ingredients

* 1ml water

## Instructions

1. boil water
> 1ml water`}
        />
        <p>
          <button type="submit">{isNew ? "Create" : "Save"}</button>
        </p>
      </form>
      <div id="form-status" role="alert"></div>
    </>
  );
}