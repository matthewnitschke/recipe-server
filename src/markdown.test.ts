import { describe, expect, test } from "bun:test";
import { nestStepQuotes, parseMarkdown } from "./markdown";

describe("parseMarkdown", () => {
  test("reads name/category from frontmatter and ignores a top-level # heading", () => {
    const { name, category, ingredients, instructions } = parseMarkdown(`---
name: Arayes
category: mains
---

# Some Other Title

## Ingredients

* 1 medium onion
* 4 pitas

## Instructions

1. Cut the onion.
> 1 medium onion

2. Process until pasty
`);
    expect(name).toBe("Arayes");
    expect(category).toBe("mains");
    expect(ingredients).toEqual(["1 medium onion", "4 pitas"]);
    expect(instructions).toEqual([
      { text: "Cut the onion.", ingredients: ["1 medium onion"] },
      { text: "Process until pasty" },
    ]);
  });
});

describe("nestStepQuotes", () => {
  test("indents blockquotes following numbered items to nest inside the <li>", () => {
    const md = "1. Cut the onion.\n> 1 medium onion\n\n2. Process until pasty";
    expect(nestStepQuotes(md)).toBe("1. Cut the onion.\n   > 1 medium onion\n\n2. Process until pasty");
  });

  test("leaves items without a blockquote alone", () => {
    const md = "1. foobar\n2. carfar";
    expect(nestStepQuotes(md)).toBe(md);
  });

  test("computes content indent for two-digit numbers", () => {
    expect(nestStepQuotes("10. mix\n> 1 cup")).toBe("10. mix\n    > 1 cup");
  });

  test("resets after a non-quote line so unrelated blockquotes stay top-level", () => {
    const md = "1. step\nplain paragraph\n> not a restatement";
    expect(nestStepQuotes(md)).toBe(md);
  });
});