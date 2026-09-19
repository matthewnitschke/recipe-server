import { renderToStaticMarkup } from "react-dom/server";
import type { Recipe } from "../server/db";

export function renderRecipeList(recipes: Recipe[]): string {
  return renderToStaticMarkup(<RecipeList recipes={recipes} />);
}

export function RecipeList({ recipes }: { recipes: Recipe[] }) {
  if (recipes.length === 0) {
    return <p>No recipes yet.</p>;
  }

  const starred = recipes.filter((r) => r.starred);
  const others = recipes.filter((r) => !r.starred);

  const renderItem = (r: Recipe) => (
    <li key={r.id}>
      <span
        className={r.starred ? "star star-on" : "star star-off"}
        role="button"
        aria-label={r.starred ? "Unsave" : "Save"}
        hx-post={`/api/recipes/${r.id}/star`}
        hx-include="#filters"
        hx-target="#recipes"
        hx-swap="innerHTML"
      >
        {r.starred ? "★" : "☆"}
      </span>
      <a href={`/recipes/${r.id}`}>
        <strong>{r.name}</strong>
      </a>
      {r.category ? <span className="category">{r.category}</span> : null}
    </li>
  );

  return (
    <>
{starred.length > 0 && others.length > 0 ? (
        <section id="saved">
          <h2 className="section-heading">
            <span>Saved</span>
            <button
              className="clear-saved"
              aria-label="Clear all saved"
              hx-post="/api/recipes/clear-stars"
              hx-include="#filters"
              hx-target="#recipes"
              hx-swap="innerHTML"
            >
              ✕
            </button>
          </h2>
          <ul>{starred.map(renderItem)}</ul>
        </section>
      ) : null}
      {others.length > 0 ? (
        <section>
          {starred.length > 0 ? <h2>All recipes</h2> : null}
          <ul>{others.map(renderItem)}</ul>
        </section>
      ) : null}
    </>
  );
}
