import type { Context } from "hono";

import type { RecipeFilter } from "./db.js";
import { parseMarkdown } from "./markdown.js";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function checkBodySize(req: Request, maxBodyBytes: number): void {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > maxBodyBytes) throw new HttpError(413, `request body larger than ${maxBodyBytes} bytes`);
}

export interface MarkdownInput {
  markdown: string;
  name: string;
  category: string | null;
}

export async function parseMarkdownInput(c: Context): Promise<MarkdownInput> {
  const contentType = (c.req.header("content-type") ?? "").toLowerCase();

  let raw: string | undefined;

  if (contentType.includes("application/json")) {
    const parsed = (await c.req.json()) as Record<string, unknown>;
    raw = typeof parsed["markdown"] === "string" ? parsed["markdown"] : undefined;
  } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const form = await c.req.parseBody();
    raw = typeof form["markdown"] === "string" ? form["markdown"] : undefined;
  } else {
    raw = await c.req.text();
  }

  if (!raw || !raw.trim()) throw new HttpError(400, "\"markdown\" is required");
  const parsed = parseMarkdown(raw);
  return { markdown: raw, name: parsed.name, category: parsed.category };
}

export function filterFromQuery(url: URL): RecipeFilter {
  const name = url.searchParams.get("name")?.trim();
  const category = url.searchParams.get("category")?.trim();
  return {
    ...(name ? { name } : {}),
    ...(category ? { category } : {}),
  };
}