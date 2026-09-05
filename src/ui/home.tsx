import { renderPage } from "./layout";

export interface HomePageOptions {
  nameValue: string;
  selectedCategory: string;
  categories: string[];
  recipesHtml: string;
}

const STYLE = `
  ul { list-style: none; padding: 0; }
  li { padding: .5rem 0; border-bottom: 1px solid #ddd; display: flex; align-items: center; }
  .category { background: #eef; border-radius: 4px; padding: 0 .35rem; margin-right: .4rem; font-size: .85em; }
  li .category { margin-left: auto; }
  li .star { cursor: pointer; font-size: 1.15em; padding-right: .25rem; }
  .star-on { color: #eab308; }
  .star-off { color: lightgrey; }
  #recipes section h2 { font-size: 1.15rem; margin: 1.5rem 0 .25rem; display: flex; justify-content: space-between; align-items: center; }
  .clear-saved { cursor: pointer; color: #c00; background: none; border: none; font-size: 1rem; line-height: 1; padding: 0 .25rem; }
  form#filters { display: flex; gap: .5rem; justify-content: space-between; }
  form#filters input, form#filters select { flex: 1; min-width: 0; }
  form#filters select { max-width: 11rem; }
`;

export function renderHomePage(options: HomePageOptions): string {
  const { nameValue, selectedCategory, categories, recipesHtml } = options;
  return renderPage(
    "recipe-server",
    STYLE,
    <>
      <h1>🍳 The Rotation</h1>

      <form id="filters">
        <input
          type="search"
          name="name"
          placeholder="Filter by name"
          value={nameValue}
          hx-get="/recipes"
          hx-trigger="input changed delay:200ms"
          hx-include="closest form"
          hx-target="#recipes"
          hx-swap="innerHTML"
          hx-push-url="true"
        />
        <select
          name="category"
          hx-get="/recipes"
          hx-trigger="change"
          hx-include="closest form"
          hx-target="#recipes"
          hx-swap="innerHTML"
          hx-push-url="true"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat} selected={cat === selectedCategory}>{cat}</option>
          ))}
        </select>
      </form>

      <div id="recipes" dangerouslySetInnerHTML={{ __html: recipesHtml }} />

      <p>
        <a href="/recipes/new"><strong>+ Add recipe</strong></a>
      </p>
    </>,
  );
}