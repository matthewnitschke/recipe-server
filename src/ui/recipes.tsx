import { renderToStaticMarkup } from "react-dom/server";
import type { Recipe } from "../db";

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
      {r.category ? <span className="category">{r.category}</span> : null}
      <a href={`/recipes/${r.id}`}>
        <strong>{r.name}</strong>
      </a>
      <span
        className={`star ${r.starred ? "star-on" : "star-off"}`}
        role="button"
        aria-label={r.starred ? "Unsave" : "Save"}
        hx-post={`/api/recipes/${r.id}/star`}
        hx-include="#filters"
        hx-target="#recipes"
        hx-swap="innerHTML"
      >
        {r.starred ? "★" : "☆"}
      </span>
    </li>
  );

  return (
    <>
      {starred.length > 0 ? (
        <section id="saved">
          <h2>★ Saved</h2>
          <ul>{starred.map(renderItem)}</ul>
        </section>
      ) : null}
      {others.length > 0 ? <ul>{others.map(renderItem)}</ul> : null}
    </>
  );
}