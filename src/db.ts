import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Recipe {
  id: number;
  name: string;
  category: string | null;
  source: string;
  created_at: string;
}

export interface RecipeRow extends Recipe {
  pdf: Uint8Array;
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
        source TEXT NOT NULL,
        pdf BLOB NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const hasCategory = db
      .query("SELECT COUNT(*) as n FROM pragma_table_info('recipes') WHERE name = 'category'")
      .get() as { n: number };
    if (hasCategory.n === 0) {
      db.exec("ALTER TABLE recipes ADD COLUMN category TEXT");
    }
    return new RecipeStore(db);
  }

  createRecipe(name: string, category: string | null, source: string, pdf: Uint8Array): number {
    const result = this.db
      .query("INSERT INTO recipes (name, category, source, pdf) VALUES (?, ?, ?, ?) RETURNING id")
      .get(name, category ?? null, source, Buffer.from(pdf)) as { id: number };
    return result.id;
  }

  listRecipes(filter: RecipeFilter = {}): Recipe[] {
    const clauses: string[] = [];
    const params: Array<string | null> = [];
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
      .query(`SELECT id, name, category, source, created_at FROM recipes ${where} ORDER BY id DESC`)
      .all(...params) as Recipe[];
    return rows;
  }

  getRecipe(id: number): RecipeRow | null {
    return (this.db
      .query("SELECT id, name, category, source, pdf, created_at FROM recipes WHERE id = ?")
      .get(id) as RecipeRow | undefined) ?? null;
  }

  updateRecipe(id: number, name: string, category: string | null, source?: string, pdf?: Uint8Array): boolean {
    const result = this.db
      .query("UPDATE recipes SET name = ?, category = ?, source = COALESCE(?, source), pdf = COALESCE(?, pdf) WHERE id = ?")
      .run(name, category ?? null, source ?? null, pdf ? Buffer.from(pdf) : null, id);
    return result.changes > 0;
  }

  deleteRecipe(id: number): boolean {
    const result = this.db.query("DELETE FROM recipes WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
