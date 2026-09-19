const STYLE = `
  .content li, .content blockquote { cursor: text; border-radius: 4px; }
  .content [contenteditable]:focus { outline: 2px solid #09d; outline-offset: 2px; }
  .content .saved { outline-color: #2a9d8f; }
  .content .save-error { outline-color: #c00; }
`;

function scriptBody(recipeId: number): string {
  return `
    (function () {
      var title = document.getElementById('recipe-title');
      var input = document.getElementById('copy-markdown');
      var content = document.querySelector('.content');
      if (!title || !input || !content) return;

      var id = ${recipeId};
      var originalName = textOf(title);
      var saving = false;

      function textOf(node) {
        return (node.textContent || '').replace(/\\s+/g, ' ').trim();
      }

      function isBlock(node) {
        if (!node || node.nodeType !== 1) return false;
        var tag = node.tagName.toUpperCase();
        return tag === 'LI' || tag === 'BLOCKQUOTE';
      }

      function flash(node, className) {
        node.classList.add(className);
        setTimeout(function () { node.classList.remove(className); }, 1500);
      }

      function markdownBody() {
        var lines = [];
        var fence = String.fromCharCode(96).repeat(3);

        function walk(el) {
          var tag = (el.tagName || '').toUpperCase();

          if (/^H[1-6]$/.test(tag)) {
            var heading = textOf(el);
            if (heading) {
              if (lines.length) lines.push('');
              lines.push('#'.repeat(Number(tag[1])) + ' ' + heading);
            }
            return;
          }

          if (tag === 'P') {
            var para = textOf(el);
            if (para) lines.push(para);
            return;
          }

          if (tag === 'UL' || tag === 'OL') {
            var items = [];
            for (var i = 0; i < el.children.length; i++) {
              var li = el.children[i];
              if ((li.tagName || '').toUpperCase() !== 'LI') continue;
              var body = '';
              var quotes = [];
              for (var j = 0; j < li.childNodes.length; j++) {
                var node = li.childNodes[j];
                if (node.nodeType === 3) body += node.textContent;
                else if (node.nodeType === 1) {
                  if ((node.tagName || '').toUpperCase() === 'BLOCKQUOTE') quotes.push(node);
                  else body += node.textContent;
                }
              }
              var clean = body.replace(/\\s+/g, ' ').trim();
              if (!clean) continue;
              var line = (tag === 'UL' ? '*' : (i + 1) + '.') + ' ' + clean;
              for (var k = 0; k < quotes.length; k++) {
                var quote = textOf(quotes[k]);
                if (quote) line += '\\n> ' + quote;
              }
              items.push(line);
            }
            if (items.length) lines.push(items.join('\\n\\n'));
            return;
          }

          if (tag === 'BLOCKQUOTE') {
            var blockquote = textOf(el);
            if (blockquote) lines.push('> ' + blockquote);
            return;
          }

          if (tag === 'PRE') {
            lines.push(fence);
            lines.push((el.textContent || '').replace(/\\n$/, ''));
            lines.push(fence);
            return;
          }

          if (tag === 'HR') {
            lines.push('---');
            return;
          }

          for (var i = 0; i < el.children.length; i++) walk(el.children[i]);
        }

        walk(content);
        return lines.join('\\n');
      }

      function newMarkdown(name) {
        var fmMatch = /^---\\r?\\n([\\s\\S]*?)\\r?\\n---/.exec(input.value);
        var frontmatter = fmMatch ? fmMatch[1].trim() : '';
        var nameLine = 'name: ' + name;
        var next = /^name:/m.test(frontmatter)
          ? frontmatter.replace(/^name:.*$/m, nameLine)
          : (frontmatter ? nameLine + '\\n' + frontmatter : nameLine);
        var out = '---\\n' + next + '\\n---\\n';
        var body = markdownBody();
        if (body) out += '\\n' + body + '\\n';
        return out;
      }

      function commit(source) {
        if (saving) return;
        var name = textOf(title);
        if (!name) {
          title.textContent = originalName;
          return;
        }
        input.value = newMarkdown(name);
        saving = true;
        fetch('/api/recipes/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: input.value }),
        }).then(function (res) {
          saving = false;
          if (!res.ok) {
            window.location.reload();
            return;
          }
          originalName = name;
          document.title = name + ' - recipe-server';
          flash(source, 'saved');
        }).catch(function () {
          saving = false;
          window.location.reload();
        });
      }

      title.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          title.blur();
        }
      });
      title.addEventListener('blur', function () { commit(title); });

      var blocks = content.querySelectorAll('li, blockquote');
      for (var i = 0; i < blocks.length; i++) {
        blocks[i].setAttribute('contenteditable', 'true');
        blocks[i].setAttribute('spellcheck', 'false');
      }

      content.addEventListener('keydown', function (e) {
        var el = e.target.closest ? e.target.closest('li, blockquote') : null;
        if (el && content.contains(el) && e.key === 'Enter') {
          e.preventDefault();
          el.blur();
        }
      });
      content.addEventListener('blur', function (e) {
        if (isBlock(e.target)) commit(e.target);
      }, true);
    })();
  `;
}

export function InlineEditor({ recipeId }: { recipeId: number }) {
  return (
    <>
      <style>{STYLE}</style>
      <script dangerouslySetInnerHTML={{ __html: scriptBody(recipeId) }} />
    </>
  );
}