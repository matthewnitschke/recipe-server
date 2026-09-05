import type { RecipeStep } from "./db";

export interface ParsedMarkdown {
  name: string;
  category: string | null;
  ingredients: string[];
  instructions: RecipeStep[];
}

/**
 * Parse a recipe stored in the markdown format:
 *
 * ```markdown
 * ---
 * name: Arayes
 * category: mains
 * ---
 *
 * ## Ingredients
 *
 * * 1 medium onion
 * * 4 pitas
 *
 * ## Instructions
 *
 * 1. Cut the onion.
 * > 1 medium onion
 * ```
 *
 * `name` and `category` come from the frontmatter (a top-level `#` heading, if
 * any, is ignored for naming). Bullet lines in `## Ingredients` become the
 * ingredient list; numbered lines in `## Instructions` become steps, with
 * blockquote (`>`) lines attaching that step's restated ingredients.
 */
export function parseMarkdown(source: string): ParsedMarkdown {
  const frontmatter = extractFrontmatter(source);
  const body = stripFrontmatter(source);

  const name = frontmatter.name?.trim() || "job";
  const category = frontmatter.category?.trim() || null;

  const ingredients: string[] = [];
  const instructions: RecipeStep[] = [];
  let section: "ingredients" | "instructions" | null = null;
  let current: RecipeStep | null = null;

  for (const rawLine of body.split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.*)$/.exec(rawLine.trim());
    if (heading) {
      section = sectionFromHeading((heading[1] ?? "").trim());
      continue;
    }

    if (section === "ingredients") {
      const bullet = /^[-*]\s+(.*)$/.exec(rawLine.trim());
      if (bullet) {
        const item = (bullet[1] ?? "").trim();
        if (item) ingredients.push(item);
      }
    } else if (section === "instructions") {
      const numbered = /^\d+[.)]\s+(.*)$/.exec(rawLine.trim());
      if (numbered) {
        if (current?.text) instructions.push(current);
        current = { text: (numbered[1] ?? "").trim() };
        continue;
      }
      const quote = /^>\s?(.*)$/.exec(rawLine.trim());
      if (quote && current) {
        const items = (quote[1] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (items.length > 0) {
          current.ingredients = [...(current.ingredients ?? []), ...items];
        }
      }
    }
  }

  if (current?.text) instructions.push(current);
  return { name, category, ingredients, instructions };
}

function sectionFromHeading(title: string): "ingredients" | "instructions" | null {
  const t = title.toLowerCase();
  if (t.startsWith("ingredient")) return "ingredients";
  if (t.startsWith("instruction")) return "instructions";
  return null;
}

function extractFrontmatter(source: string): { name?: string; category?: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return {};
  const fm = match[1] ?? "";
  const name = /^name:\s*(.*)$/m.exec(fm)?.[1];
  const category = /^category:\s*(.*)$/m.exec(fm)?.[1];
  return {
    ...(name && name.trim() ? { name: name.trim() } : {}),
    ...(category && category.trim() ? { category: category.trim() } : {}),
  };
}

export function stripFrontmatter(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

const STEP_ITEM_RE = /^(\s*)(\d+)[.)]\s+\S.*$/;
const QUOTE_RE = /^\s*>/;

/**
 * Render-time transform: in the recipe format a step's restated ingredients are
 * a blockquote directly after the numbered item:
 *
 * ```markdown
 * 1. Cut the onion
 * > 1 medium onion
 * ```
 *
 * CommonMark only nests that blockquote inside the `<li>` when it is indented to
 * the item's content column, so re-indent those lines before handing the body
 * to the markdown renderer. Without this each step becomes its own `<ol>` and
 * the numbering restarts.
 */
export function nestStepQuotes(source: string): string {
  const out: string[] = [];
  let contentIndent: number | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const item = STEP_ITEM_RE.exec(rawLine);
    if (item) {
      contentIndent = (item[1] ?? "").length + (item[2] ?? "").length + 2;
      out.push(rawLine);
      continue;
    }

    if (contentIndent !== null && QUOTE_RE.test(rawLine)) {
      out.push(" ".repeat(contentIndent) + rawLine.trim());
      continue;
    }

    if (rawLine.trim() !== "") contentIndent = null;
    out.push(rawLine);
  }

  return out.join("\n");
}