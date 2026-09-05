import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

const INGREDIENT_RE = /#ingredient\[([^\]]*)\]/g;

export interface RecipeStep {
  text: string;
  ingredients?: string[];
}

export interface RecipeData {
  name: string;
  category: string | null;
  ingredients: string[];
  instructions: RecipeStep[];
}

type Section = "ingredients" | "instructions" | null;

function sectionFromTitle(title: string): Section {
  const t = title.toLowerCase();
  if (t.startsWith("ingredient")) return "ingredients";
  if (t.startsWith("instruction")) return "instructions";
  return null;
}

/**
 * Parse the `#show: template.with(...)` block to pull out `name` and `category`
 * (the template's title/grouping, formerly passed via `sys.inputs`).
 *
 * ```typst
 * #show: template.with(
 *   name: "Mozzarella",
 *   category: "Basics",
 *   number: 100
 * )
 * ```
 */
function parseTemplateArgs(source: string): { name?: string; category?: string } {
  const match = /#show:\s*template\.with\(([\s\S]*?)\)/.exec(source);
  if (!match) return {};
  const args = match[1] ?? "";
  const name = /name:\s*"([^"]*)"/.exec(args)?.[1];
  const category = /category:\s*"([^"]*)"/.exec(args)?.[1];
  return {
    ...(name ? { name } : {}),
    ...(category ? { category } : {}),
  };
}

/**
 * Translate a recipe in the original Typst format into a RecipeData structure.
 *
 * Expected source shape:
 *
 * ```typst
 * #import "_template.typ": template, ingredient
 * #show: template.with(name: "Mozzarella", category: "Basics", number: 100)
 *
 * == Ingredients
 * - 1 gal milk
 * - 8g citric acid
 *
 * == Instructions
 * 1. Mix citric acid with water. #ingredient[8g citric acid]
 * ```
 *
 * `name`/`category` come from the `#show: template.with(...)` args (or a `=`
 * title heading / file name as fallbacks). Non-ingredient/instruction sections
 * are ignored.
 */
export function translate(source: string, fallbackName: string): RecipeData {
  const ingredients: string[] = [];
  const instructions: RecipeStep[] = [];
  const args = parseTemplateArgs(source);
  let name = args.name ?? fallbackName;
  let category: string | null = args.category ?? null;
  let section: Section = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const heading = /^(={1,3})\s+(.*)$/.exec(rawLine.trim());
    if (heading) {
      const level = (heading[1] ?? "").length;
      const title = (heading[2] ?? "").trim();
      if (level === 1 && !args.name) {
        name = title;
        section = null;
      } else if (level === 1) {
        section = null;
      } else {
        section = sectionFromTitle(title);
      }
      continue;
    }

    if (section === "ingredients") {
      const bullet = /^-\s+(.*)$/.exec(rawLine.trim());
      if (bullet) {
        const item = (bullet[1] ?? "").trim();
        if (item) ingredients.push(item);
      }
    } else if (section === "instructions") {
      const numbered = /^\d+[.)]\s+(.*)$/.exec(rawLine.trim());
      if (numbered) {
        const body = (numbered[1] ?? "").trim();
        const restatements = [...body.matchAll(INGREDIENT_RE)];
        const text = body.replace(INGREDIENT_RE, "").trim();
        const step: RecipeStep = { text };
        if (restatements.length > 0) {
          step.ingredients = restatements
            .map((m) => (m[1] ?? "").trim())
            .flatMap((part) => part.split(",").map((p) => p.trim()).filter((p) => p.length > 0));
        }
        instructions.push(step);
      }
    }
  }

  return { name, category, ingredients, instructions };
}

/**
 * Serialize a parsed recipe into the markdown recipe format:
 *
 * ```markdown
 * ---
 * name: Mozzarella
 * category: Basics
 * ---
 *
 * ## Ingredients
 *
 * * 1 gal milk
 *
 * ## Instructions
 *
 * 1. Mix citric acid with water.
 * > 8g citric acid
 * ```
 *
 * A step's restated ingredients become a blockquote (`>`) line directly below
 * it, comma-separated. Steps without restatements emit no blockquote.
 */
export function toMarkdown(recipe: RecipeData): string {
  const sections: string[] = [];

  const frontmatter = [`name: ${recipe.name}`];
  if (recipe.category) frontmatter.push(`category: ${recipe.category}`);
  sections.push(`---\n${frontmatter.join("\n")}\n---`);

  if (recipe.ingredients.length > 0) {
    sections.push(`## Ingredients\n\n${recipe.ingredients.map((item) => `* ${item}`).join("\n")}`);
  }

  if (recipe.instructions.length > 0) {
    sections.push(
      `## Instructions\n\n${recipe.instructions
        .map((step, i) => {
          const lines = [`${i + 1}. ${step.text}`];
          if (step.ingredients && step.ingredients.length > 0) {
            lines.push(`> ${step.ingredients.join(", ")}`);
          }
          return lines.join("\n");
        })
        .join("\n\n")}`,
    );
  }

  return `${sections.join("\n\n")}\n`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  const pattern = args.find((a, i) => !a.startsWith("--") && !(args[i - 1] === "--outdir"));
  const outdirFlagIndex = args.indexOf("--outdir");
  const outdirFlag = args.find((a) => a.startsWith("--outdir="));
  const outdir = outdirFlag
    ? outdirFlag.slice("--outdir=".length)
    : outdirFlagIndex >= 0
      ? args[outdirFlagIndex + 1]
      : null;

  if (!pattern) {
    console.error("usage: bun run tools/translator.ts <recipe.typ|glob> [--outdir=DIR]");
    process.exit(1);
  }

  const isGlob = /[*?[\]{}]/.test(pattern);
  const files = isGlob
    ? [...new Bun.Glob(pattern).scanSync({ cwd: process.cwd(), onlyFiles: true })].sort()
    : [resolve(pattern)];

  if (files.length === 0) {
    console.error(`no files matched ${pattern}`);
    process.exit(1);
  }

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const fallbackName = basename(file).replace(/\.(?:typ|typst)$/i, "");
    const recipe = translate(source, fallbackName);

    const outPath = outdir
      ? join(resolve(outdir), relative(process.cwd(), resolve(file)).replace(/\.(?:typ|typst)$/i, ".md"))
      : resolve(file).replace(/\.(?:typ|typst)$/i, ".md");
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, toMarkdown(recipe));
    console.error(`wrote ${outPath}`);
  }
}