import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

export const FAVICON_HREF =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🍳%3C/text%3E%3C/svg%3E";

const BASE_STYLE = `
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
`;

export function renderPage(title: string, style: string, body: ReactNode): string {
  return renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{title}</title>
        <link rel="icon" href={FAVICON_HREF} />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#ffffff" />
        <script src="https://unpkg.com/htmx.org@1.9.12" defer></script>
        <style>{`${BASE_STYLE}
${style}`}</style>
      </head>
      <body>{body}</body>
    </html>
  );
}