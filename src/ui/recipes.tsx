import { renderToStaticMarkup } from "react-dom/server";
import type { Recipe } from "../db";

export function renderRecipeList(recipes: Recipe[]): string {
  return renderToStaticMarkup(<RecipeList recipes={recipes} />);
}

export function RecipeList({ recipes }: { recipes: Recipe[] }) {
  if (recipes.length === 0) {
    return <p>No recipes yet.</p>;
  }
  return (
    <ul>
      {recipes.map((r) => (
        <li key={r.id}>
          {r.category ? <span className="category">{r.category}</span> : null}
          <a href={`/api/recipes/${r.id}.pdf`}>
            <strong>{r.name}</strong>
          </a>
          <a className="edit-link" href={`/recipes/${r.id}/edit`}>edit</a>
        </li>
      ))}
    </ul>
  );
}
