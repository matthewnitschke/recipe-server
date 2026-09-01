import type { Context } from "hono";

import type { RecipeFilter } from "./db.js";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function checkBodySize(req: Request, maxBodyBytes: number): void {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > maxBodyBytes) throw new HttpError(413, `request body larger than ${maxBodyBytes} bytes`);
}

export async function parseSource(c: Context): Promise<{ source: string; name: string; category: string | null }> {
  const contentType = (c.req.header("content-type") ?? "").toLowerCase();
  const qName = c.req.query("name")?.trim();
  const qCategory = c.req.query("category")?.trim() || null;

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.parseBody();
    const file = form["file"];
    const source = file instanceof File ? await file.text() : undefined;
    if (!source) throw new HttpError(400, `multipart form must include a "file" entry`);
    return {
      source,
      name: typeof form["name"] === "string" && form["name"].trim() ? form["name"].trim() : "job",
      category: typeof form["category"] === "string" && form["category"].trim() ? form["category"].trim() : qCategory,
    };
  }

  if (contentType.includes("application/json")) {
    const parsed = (await c.req.json()) as Record<string, unknown>;
    const source = typeof parsed.source === "string" ? parsed.source : undefined;
    if (!source) throw new HttpError(400, `json body must include a "source" string field`);
    const category =
      typeof parsed.category === "string" && parsed.category.trim() ? parsed.category.trim() : qCategory;
    const name =
      (typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : undefined) ?? qName;
    return { source, name: name?.trim() ? name.trim() : "job", category };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const parsed = await c.req.parseBody();
    const source = typeof parsed["source"] === "string" ? parsed["source"] : undefined;
    if (!source) throw new HttpError(400, `form must include a "source" field`);
    const category =
      typeof parsed["category"] === "string" && parsed["category"].trim() ? parsed["category"].trim() : qCategory;
    const name =
      (typeof parsed["name"] === "string" && parsed["name"].trim() ? parsed["name"] : undefined) ?? qName;
    return { source, name: name?.trim() ? name.trim() : "job", category };
  }

  const source = await c.req.text();
  if (!source) throw new HttpError(400, "empty request body; send the typst source text");
  return { source, name: qName?.trim() || "job", category: qCategory };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function filterFromQuery(url: URL): RecipeFilter {
  const name = url.searchParams.get("name")?.trim();
  const category = url.searchParams.get("category")?.trim();
  return {
    ...(name ? { name } : {}),
    ...(category ? { category } : {}),
  };
}

