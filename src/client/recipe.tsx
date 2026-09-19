import { micromark } from "micromark";
import { gfm } from "micromark-extension-gfm";

import type { Recipe } from "../server/db";
import { parseMarkdown, nestStepQuotes, stripFrontmatter } from "../server/markdown";
import { renderPage } from "./layout";

const STYLE = `
  h1 { margin-bottom: .25rem; }
  .category { color: #555; margin-top: 0; }
  .content h2 { margin-top: 1.75rem; border-bottom: 1px solid #ddd; padding-bottom: .25rem; }
  .content p, .content li { line-height: 1.5; }
  .content ul, .content ol { padding-left: 1.5rem; }
  .content { line-height: 1.4; }
  .content p, .content li { line-height: 1.4; margin: 0; }
  .content > ul > li, .content > ol > li { margin-bottom: .7rem}
  .content blockquote {
    margin: .35rem 0 .75rem 0; padding-left: .6rem;
    font-size: .85rem; font-style: italic; color: #09d; border-left: 3px solid #09d;
  }
  .content li > blockquote { margin-block: .15rem 0; padding: 0; border: none; }
  .btn {
    display: inline-block; padding: .1rem .65rem; border: 1px solid #999;
    border-radius: 4px; background: #f4f4f4; color: #111; text-decoration: none;
    cursor: pointer; font-size: 13px; line-height: 1.4;
  }
  .btn:hover { background: #e8e8e8; }
  #recipe-title { cursor: text; min-width: 1ch; border-radius: 4px; }
  #recipe-title:focus { outline: 2px solid #09d; outline-offset: 3px; }
  #recipe-title.saved { outline: 2px solid #2a9d8f; outline-offset: 3px; }
  #recipe-title.save-error { outline: 2px solid #c00; outline-offset: 3px; }
  #recipe-actions { display: flex; gap: .5rem; font-weight: normal; }
  @media print {
    .back-link, #recipe-actions { display: none; }
    body { padding-top: 2rem; }
  }
`;

export function renderRecipePage(recipe: Recipe): string {
  const parsed = parseMarkdown(recipe.markdown);
  const bodyHtml = micromark(nestStepQuotes(stripFrontmatter(recipe.markdown)), { extensions: [gfm()] });

  return renderPage(
    `${recipe.name} - recipe-server`,
    STYLE,
    <>
      <p>
        <a className="back-link" href="/">← back to recipes</a>
      </p>
      <h1 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <span
          id="recipe-title"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          data-id={recipe.id}
        >
          {parsed.name}
        </span>
        <span id="recipe-actions">
          <button className="btn" type="button" id="copy-recipe">Copy</button>
          <a className="btn" href={`/recipes/${recipe.id}/edit`}>Edit</a>
        </span>
      </h1>
      <input type="hidden" id="copy-markdown" name="markdown" value={recipe.markdown} />
      {parsed.category ? <p className="category">{parsed.category}</p> : null}
      <div className="content" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <script dangerouslySetInnerHTML={{ __html: `
        function legacyCopy(text) {
          var area = document.createElement('textarea');
          area.value = text;
          area.readOnly = true;
          area.contentEditable = true;
          area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
          document.body.appendChild(area);
          area.focus();
          area.select();
          area.setSelectionRange(0, 999999);
          var ok = false;
          try { ok = document.execCommand('copy'); } catch (e) {}
          document.body.removeChild(area);
          return ok;
        }
        document.addEventListener('click', function (event) {
          var btn = event.target.closest('#copy-recipe');
          if (!btn) return;
          var text = document.getElementById('copy-markdown').value;
          function done(ok) {
            btn.textContent = ok ? 'Copied!' : 'Copy failed';
            setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
          }
          if (navigator.clipboard && navigator.clipboard.writeText && !window.navigator.standalone) {
            navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(legacyCopy(text)); });
          } else {
            done(legacyCopy(text));
          }
        });
      ` }} />
      <script dangerouslySetInnerHTML={{ __html: `
        (function () {
          var title = document.getElementById('recipe-title');
          if (!title || !title.dataset.id) return;
          var original = title.textContent.replace(/\\s+/g, ' ').trim();
          var saving = false;

          function getNewMarkdown(name) {
            var md = document.getElementById('copy-markdown').value;
            if (/^name:.*$/m.test(md)) return md.replace(/^name:.*$/m, 'name: ' + name);
            var i = md.indexOf('\\n');
            if (i === -1) return 'name: ' + name + '\\n' + md;
            return md.slice(0, i + 1) + 'name: ' + name + '\\n' + md.slice(i + 1);
          }

          function normalize() {
            return title.textContent.replace(/\\s+/g, ' ').trim();
          }

          function commit() {
            if (saving) return;
            var text = normalize();
            if (text === '') {
              title.textContent = original;
              return;
            }
            if (text === original) return;

            var md = getNewMarkdown(text);
            var input = document.getElementById('copy-markdown');
            var oldMarkdown = input.value;
            input.value = md;
            saving = true;
            fetch('/api/recipes/' + title.dataset.id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ markdown: md }),
            }).then(function (res) {
              saving = false;
              if (!res.ok) {
                input.value = oldMarkdown;
                title.textContent = original;
                title.classList.add('save-error');
              } else {
                original = text;
                document.title = text + ' - recipe-server';
                title.classList.add('saved');
              }
              setTimeout(function () {
                title.classList.remove('saved', 'save-error');
              }, 1500);
            }).catch(function () {
              saving = false;
              input.value = oldMarkdown;
              title.textContent = original;
            });
          }

          title.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              title.blur();
            }
          });

          title.addEventListener('blur', commit);
        })();
      ` }} />
    </>,
  );
}