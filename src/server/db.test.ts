import { describe, expect, test } from "bun:test";
import { RecipeStore } from "./db";

const PANCAKES_MD = `---
name: pancakes
category: breakfast
---

## Ingredients

* 1 cup flour
* 2 eggs

## Instructions

1. Mix flour and eggs.
> 1 cup flour

2. Add remaining ingredients.
> 1 cup flour, 2 eggs
`;

describe("RecipeStore", () => {
  test("createRecipe then getRecipe round-trips the markdown", () => {
    const store = RecipeStore.open(":memory:");
    const id = store.createRecipe("pancakes", "breakfast", PANCAKES_MD);

    const recipe = store.getRecipe(id);
    expect(recipe).not.toBeNull();
    expect(recipe!.name).toBe("pancakes");
    expect(recipe!.category).toBe("breakfast");
    expect(recipe!.markdown).toBe(PANCAKES_MD);
  });

  test("listRecipes includes created recipes in desc order", () => {
    const store = RecipeStore.open(":memory:");
    store.createRecipe("a", null, "---\nname: a\n---\n");
    store.createRecipe("b", null, "---\nname: b\n---\n");

    const recipes = store.listRecipes();
    expect(recipes.map((r) => r.name)).toEqual(["b", "a"]);
  });

  test("listRecipes filters by name and category", () => {
    const store = RecipeStore.open(":memory:");
    store.createRecipe("pancakes", "breakfast", "---\nname: pancakes\ncategory: breakfast\n---\n");
    store.createRecipe("omelette", "breakfast", "---\nname: omelette\ncategory: breakfast\n---\n");
    store.createRecipe("stew", "dinner", "---\nname: stew\ncategory: dinner\n---\n");

    expect(store.listRecipes({ name: "pan" }).map((r) => r.name)).toEqual(["pancakes"]);
    expect(store.listRecipes({ category: "breakfast" }).map((r) => r.name)).toEqual([
      "omelette",
      "pancakes",
    ]);
    expect(store.listRecipes({ name: "e", category: "dinner" }).map((r) => r.name)).toEqual(["stew"]);
  });

  test("getRecipe returns null for missing id", () => {
    const store = RecipeStore.open(":memory:");
    expect(store.getRecipe(999)).toBeNull();
  });

  test("updateRecipe replaces name, category, and markdown", () => {
    const store = RecipeStore.open(":memory:");
    const id = store.createRecipe("a", null, "---\nname: a\n---\n");
    const updated = "---\nname: a renamed\ncategory: dinner\n---\n";
    store.updateRecipe(id, "a renamed", "dinner", updated);

    const recipe = store.getRecipe(id);
    expect(recipe!.name).toBe("a renamed");
    expect(recipe!.category).toBe("dinner");
    expect(recipe!.markdown).toBe(updated);
  });

  test("updateRecipe without markdown keeps existing markdown", () => {
    const store = RecipeStore.open(":memory:");
    const id = store.createRecipe("a", null, "---\nname: a\n---\n");
    store.updateRecipe(id, "a", "lunch");

    const recipe = store.getRecipe(id);
    expect(recipe!.markdown).toBe("---\nname: a\n---\n");
    expect(recipe!.category).toBe("lunch");
  });

  test("new recipes are unstarred and setStarred toggles the flag", () => {
    const store = RecipeStore.open(":memory:");
    const id = store.createRecipe("a", null, "---\nname: a\n---\n");
    expect(store.getRecipe(id)!.starred).toBe(false);

    expect(store.setStarred(id, true)).toBe(true);
    expect(store.getRecipe(id)!.starred).toBe(true);
    expect(store.listRecipes().filter((r) => r.starred).map((r) => r.id)).toEqual([id]);

    store.setStarred(id, false);
    expect(store.getRecipe(id)!.starred).toBe(false);
  });
});