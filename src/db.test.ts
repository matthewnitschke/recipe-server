import { describe, expect, test } from "bun:test";
import { RecipeStore } from "./db";

describe("RecipeStore", () => {
  test("createRecipe then getRecipe round-trips source and pdf", () => {
    const store = RecipeStore.open(":memory:");
    const pdf = new Uint8Array([37, 80, 68, 70, 1, 2, 3]);
    const id = store.createRecipe("pancakes", "breakfast", "= Pancakes\n\nFlour.", pdf);

    const recipe = store.getRecipe(id);
    expect(recipe).not.toBeNull();
    expect(recipe!.name).toBe("pancakes");
    expect(recipe!.category).toBe("breakfast");
    expect(recipe!.source).toBe("= Pancakes\n\nFlour.");
    expect(Array.from(recipe!.pdf)).toEqual(Array.from(pdf));
  });

  test("listRecipes includes created recipes in desc order", () => {
    const store = RecipeStore.open(":memory:");
    store.createRecipe("a", null, "A", new Uint8Array([1]));
    store.createRecipe("b", null, "B", new Uint8Array([2]));

    const recipes = store.listRecipes();
    expect(recipes.map((r) => r.name)).toEqual(["b", "a"]);
  });

  test("listRecipes filters by name and category", () => {
    const store = RecipeStore.open(":memory:");
    store.createRecipe("pancakes", "breakfast", "A", new Uint8Array([1]));
    store.createRecipe("omelette", "breakfast", "B", new Uint8Array([2]));
    store.createRecipe("stew", "dinner", "C", new Uint8Array([3]));

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
});
