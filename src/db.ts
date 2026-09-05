import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface RecipeStep {
  text: string;
  /** Optional restatement of the quantities involved in this step (from a `>` line). */
  ingredients?: string[];
}

export interface Recipe {
  id: number;
  name: string;
  category: string | null;
  markdown: string;
  created_at: string;
  starred: boolean;
}

interface RecipeRow {
  id: number;
  name: string;
  category: string | null;
  markdown: string;
  created_at: string;
  starred: number;
}

export interface RecipeFilter {
  name?: string;
  category?: string;
}

export class RecipeStore {
  constructor(private readonly db: Database) {}

  static open(path: string): RecipeStore {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }
    const db = new Database(path);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec(`
      CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        markdown TEXT NOT NULL DEFAULT '',
        starred INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const columns = new Set(
      (db.query("SELECT name FROM pragma_table_info('recipes')").all() as { name: string }[]).map((r) => r.name),
    );
    if (!columns.has("markdown")) db.exec("ALTER TABLE recipes ADD COLUMN markdown TEXT NOT NULL DEFAULT ''");
    if (!columns.has("category")) db.exec("ALTER TABLE recipes ADD COLUMN category TEXT");
    if (!columns.has("starred")) db.exec("ALTER TABLE recipes ADD COLUMN starred INTEGER NOT NULL DEFAULT 0");

    return new RecipeStore(db);
  }

  createRecipe(name: string, category: string | null, markdown: string): number {
    const result = this.db
      .query("INSERT INTO recipes (name, category, markdown) VALUES (?, ?, ?) RETURNING id")
      .get(name, category ?? null, markdown) as { id: number };
    return result.id;
  }

  listRecipes(filter: RecipeFilter = {}): Recipe[] {
    const clauses: string[] = [];
    const params: string[] = [];
    if (filter.name) {
      clauses.push("name LIKE ?");
      params.push(`%${filter.name}%`);
    }
    if (filter.category) {
      clauses.push("category LIKE ?");
      params.push(`%${filter.category}%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .query(`SELECT id, name, category, markdown, starred, created_at FROM recipes ${where} ORDER BY id DESC`)
      .all(...params) as RecipeRow[];
    return rows.map((r) => ({ ...r, starred: r.starred === 1 }));
  }

  getRecipe(id: number): Recipe | null {
    const row = this.db
      .query("SELECT id, name, category, markdown, starred, created_at FROM recipes WHERE id = ?")
      .get(id) as RecipeRow | undefined;
    return row ? { ...row, starred: row.starred === 1 } : null;
  }

  listCategories(): string[] {
    const rows = this.db
      .query("SELECT DISTINCT category FROM recipes WHERE category IS NOT NULL AND category != '' ORDER BY category")
      .all() as { category: string }[];
    return rows.map((r) => r.category);
  }

  updateRecipe(id: number, name: string, category: string | null, markdown?: string): boolean {
    const result = this.db
      .query("UPDATE recipes SET name = ?, category = ?, markdown = COALESCE(?, markdown) WHERE id = ?")
      .run(name, category ?? null, markdown ?? null, id);
    return result.changes > 0;
  }

  setStarred(id: number, starred: boolean): boolean {
    const result = this.db.query("UPDATE recipes SET starred = ? WHERE id = ?").run(starred ? 1 : 0, id);
    return result.changes > 0;
  }

  clearStars(): number {
    const result = this.db.query("UPDATE recipes SET starred = 0 WHERE starred = 1").run();
    return result.changes;
  }

  deleteRecipe(id: number): boolean {
    const result = this.db.query("DELETE FROM recipes WHERE id = ?").run(id);
    return result.changes > 0;
  }
}