const STYLE = `
  .content a.timer {
    color: inherit; text-decoration: underline; text-underline-offset: 2px; text-decoration-thickness: 2px;
  }
`;

const SHORTCUT = "shortcuts://run-shortcut?name=Start%20Timer&input=text&text=";

export function minutesFromText(text: string): number | null {
  const re = /(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|hrs?|hour?s?|h(?=\d)|h\b|m\b|sec(?:ond)?s?|s\b)/gi;
  let total = 0;
  let matched = false;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    matched = true;
    const value = Number(match[1]);
    const unit = (match[2] ?? "").toLowerCase();
    if (unit[0] === "h") total += value * 60;
    else if (unit[0] === "m") total += value;
    else total += value / 60;
  }
  if (!matched || total <= 0) return null;
  return Math.round(total * 100) / 100;
}

function scriptBody(): string {
  return `
    (function () {
      var RE = /(\\d+(?:\\.\\d+)?)\\s*(min(?:ute)?s?|hrs?|hour?s?|h(?=\\d)|h\\b|m\\b|sec(?:ond)?s?|s\\b)/gi;
      var SHORTCUT = '${SHORTCUT}';

      function minutesFor(match) {
        var value = parseFloat(match[1]);
        var unit = match[2].toLowerCase();
        var minutes;
        if (unit.charAt(0) === 'h') minutes = value * 60;
        else if (unit.charAt(0) === 'm') minutes = value;
        else minutes = value / 60;
        if (!(minutes > 0)) return null;
        return Math.round(minutes * 100) / 100;
      }

      function wrapDurations(textNode) {
        var text = textNode.textContent;
        var matches = [];
        var match;
        while ((match = RE.exec(text))) matches.push(match);
        if (!matches.length) return;

        var parent = textNode.parentNode;
        var offset = 0;
        for (var i = 0; i < matches.length; i++) {
          var m = matches[i];
          var start = m.index;
          var end = start + m[0].length;
          var minutes = minutesFor(m);
          if (minutes === null) continue;
          if (start > offset) {
            parent.insertBefore(document.createTextNode(text.slice(offset, start)), textNode);
          }
          var link = document.createElement('a');
          link.className = 'timer';
          link.contentEditable = false;
          link.href = SHORTCUT + encodeURIComponent(String(minutes));
          link.textContent = text.slice(start, end);
          parent.insertBefore(link, textNode);
          offset = end;
        }
        if (offset < text.length) {
          parent.insertBefore(document.createTextNode(text.slice(offset)), textNode);
        }
        parent.removeChild(textNode);
      }

      function decorate(el) {
        var child = el.firstChild;
        while (child) {
          var next = child.nextSibling;
          if (child.nodeType === 3) {
            wrapDurations(child);
          } else if (child.nodeType === 1 && (child.tagName || '').toUpperCase() !== 'BLOCKQUOTE') {
            decorate(child);
          }
          child = next;
        }
      }

      var nodes = document.querySelectorAll('.content ol > li, .content blockquote');
      for (var i = 0; i < nodes.length; i++) decorate(nodes[i]);
    })();
  `;
}

export function TimerLinks() {
  return (
    <>
      <style>{STYLE}</style>
      <script dangerouslySetInnerHTML={{ __html: scriptBody() }} />
    </>
  );
}