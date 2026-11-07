const SCALES = [0.5, 1, 1.5, 2, 3, 4];

function scaleLabel(scale: number): string {
  return scale === 0.5 ? "½x" : `${scale}x`;
}

const STYLE = `
  #scale-controls {
    display: flex; align-items: center; flex-wrap: wrap; gap: .35rem;
    margin: .4rem 0 .75rem; font-size: 13px; color: #555;
  }
  #scale-controls .btn { min-width: 2.5rem; text-align: center; }
  #scale-controls .btn[aria-pressed="true"] {
    background: #09d; border-color: #09d; color: #fff;
  }
  @media print { #scale-controls { display: none; } }
`;

/** The scale buttons. Render above the recipe content. */
export function ScaleControls() {
  return (
    <>
      <style>{STYLE}</style>
      <div id="scale-controls">
        <span>Scale:</span>
        {SCALES.map((scale) => (
          <button
            className="btn scale-btn"
            type="button"
            data-scale={scale}
            aria-pressed={scale === 1}
            key={scale}
          >
            {scaleLabel(scale)}
          </button>
        ))}
      </div>
    </>
  );
}

/** The scaling script. Render after the recipe content and the timer links. */
export function RecipeScaler() {
  return <script dangerouslySetInnerHTML={{ __html: scriptBody() }} />;
}

/**
 * Scaling is display-only: the stored markdown is never rewritten. We keep a
 * copy of the original HTML for each ingredient item/blockquote, restore it
 * whenever the scale changes, then rewrite the leading quantities (and the
 * comma-separated quantities in step restatements).
 */
function scriptBody(): string {
  return `
    (function () {
      var controls = document.getElementById('scale-controls');
      var content = document.querySelector('.content');
      if (!controls || !content) return;

      var VULGAR = {
        '¼': 1 / 4, '½': 1 / 2, '¾': 3 / 4,
        '⅐': 1 / 7, '⅑': 1 / 9, '⅒': 1 / 10,
        '⅓': 1 / 3, '⅔': 2 / 3, '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5,
        '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8
      };
      var FRACTIONS = '¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞';
      var QTY = '(?:\\\\d+\\\\s+\\\\d+\\\\/\\\\d+|\\\\d+\\\\/\\\\d+|\\\\d*\\\\.\\\\d+|\\\\d+\\\\s*[' + FRACTIONS + ']|[' + FRACTIONS + ']|\\\\d+)';
      var QTY_RE = new RegExp('^(\\\\s*)(' + QTY + ')(?:(\\\\s*[-–]\\\\s*)(' + QTY + '))?');
      var GLYPHS = [
        { value: 1 / 2, text: '½' },
        { value: 1 / 3, text: '⅓' },
        { value: 2 / 3, text: '⅔' },
        { value: 1 / 4, text: '¼' },
        { value: 3 / 4, text: '¾' },
        { value: 1 / 5, text: '⅕' },
        { value: 2 / 5, text: '⅖' },
        { value: 3 / 5, text: '⅗' },
        { value: 4 / 5, text: '⅘' },
        { value: 1 / 6, text: '⅙' },
        { value: 5 / 6, text: '⅚' },
        { value: 1 / 7, text: '⅐' },
        { value: 1 / 8, text: '⅛' },
        { value: 3 / 8, text: '⅜' },
        { value: 5 / 8, text: '⅝' },
        { value: 7 / 8, text: '⅞' },
        { value: 1 / 9, text: '⅑' },
        { value: 1 / 10, text: '⅒' }
      ];
      var DENOMS = [2, 3, 4, 6, 8, 12, 16];
      var currentScale = 1;
      var targets = [];
      var base = new WeakMap();

      function parseQty(token) {
        token = token.trim();
        var m = /^(\\d+)?\\s*([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/.exec(token);
        if (m) return (m[1] ? parseInt(m[1], 10) : 0) + VULGAR[m[2]];
        m = /^(\\d+)\\s+(\\d+)\\/(\\d+)$/.exec(token);
        if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10);
        m = /^(\\d+)\\/(\\d+)$/.exec(token);
        if (m) return parseInt(m[1], 10) / parseInt(m[2], 10);
        m = /^\\d*\\.\\d+$/.exec(token);
        if (m) return parseFloat(token);
        m = /^\\d+$/.exec(token);
        if (m) return parseInt(token, 10);
        return null;
      }

      function asFraction(value, allowAscii) {
        var whole = Math.floor(value + 0.0001);
        var frac = value - whole;
        if (frac < 0.02) return String(whole);

        var best = null;
        for (var g = 0; g < GLYPHS.length; g++) {
          var diff = Math.abs(frac - GLYPHS[g].value);
          if (diff < 0.005 && (best === null || diff < best.diff)) {
            best = { diff: diff, text: GLYPHS[g].text };
          }
        }
        if (best) return (whole > 0 ? String(whole) : '') + best.text;

        if (allowAscii) {
          for (var i = 0; i < DENOMS.length; i++) {
            var den = DENOMS[i];
            var num = Math.round(frac * den);
            if (num <= 0) continue;
            if (num >= den) {
              if (frac > 0.98) return String(whole + 1);
              continue;
            }
            if (Math.abs(frac - num / den) < 0.015) {
              return (whole > 0 ? whole + ' ' : '') + num + '/' + den;
            }
          }
        }
        return null;
      }

      function hasFraction(token) {
        if (token.indexOf('/') >= 0) return true;
        for (var i = 0; i < token.length; i++) {
          if (FRACTIONS.indexOf(token.charAt(i)) >= 0) return true;
        }
        return false;
      }

      function formatQty(value, fraction) {
        value = Math.round(value * 1000) / 1000;
        if (Math.abs(value - Math.round(value)) < 0.001) return String(Math.round(value));
        var mixed = asFraction(value, fraction);
        if (mixed !== null) return mixed;
        return String(Math.round(value * 100) / 100);
      }

      function scaleLeading(text, factor) {
        var m = QTY_RE.exec(text);
        if (!m) return text;
        var rest = text.slice(m[0].length);
        if (/^\\s*%/.test(rest)) return text;
        var low = parseQty(m[2]);
        if (low === null) return text;
        var high = m[4] ? parseQty(m[4]) : null;
        var fraction = hasFraction(m[2]) || (m[4] ? hasFraction(m[4]) : false);
        var out = m[1] + formatQty(low * factor, fraction);
        if (high !== null) out += m[3] + formatQty(high * factor, fraction);
        return out + rest;
      }

      function collect() {
        var headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (var i = 0; i < headings.length; i++) {
          var heading = (headings[i].textContent || '').trim().toLowerCase();
          if (heading.indexOf('ingredient') !== 0) continue;
          var list = headings[i].nextElementSibling;
          while (list && list.tagName !== 'UL' && list.tagName !== 'OL') list = list.nextElementSibling;
          if (!list) continue;
          for (var j = 0; j < list.children.length; j++) {
            if (list.children[j].tagName === 'LI') {
              targets.push({ el: list.children[j], split: false });
            }
          }
        }

        var quotes = content.querySelectorAll('ol > li > blockquote');
        for (var k = 0; k < quotes.length; k++) {
          targets.push({ el: quotes[k], split: true });
        }

        if (targets.length === 0) {
          controls.hidden = true;
          return;
        }
        controls.hidden = false;
        for (var t = 0; t < targets.length; t++) {
          base.set(targets[t].el, targets[t].el.innerHTML);
        }
      }

      function scaleElement(el, factor, split) {
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        var first = true;
        var node;
        while ((node = walker.nextNode())) {
          var parent = node.parentNode;
          if (parent && parent.nodeType === 1 && parent.tagName === 'A') continue;
          var text = node.nodeValue || '';
          if (!text.trim()) continue;
          if (split) {
            node.nodeValue = text.split(',').map(function (part) {
              return scaleLeading(part, factor);
            }).join(',');
          } else if (first) {
            node.nodeValue = scaleLeading(text, factor);
            first = false;
          }
        }
      }

      function apply(next) {
        currentScale = next;
        for (var i = 0; i < targets.length; i++) {
          var target = targets[i];
          var original = base.get(target.el);
          if (original === undefined) continue;
          target.el.innerHTML = original;
          if (next !== 1) scaleElement(target.el, next, target.split);
        }

        var buttons = controls.querySelectorAll('button[data-scale]');
        for (var j = 0; j < buttons.length; j++) {
          var value = Number(buttons[j].getAttribute('data-scale'));
          buttons[j].setAttribute('aria-pressed', value === next ? 'true' : 'false');
        }
      }

      collect();
      if (targets.length === 0) return;

      controls.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('button[data-scale]') : null;
        if (!btn || !controls.contains(btn)) return;
        apply(Number(btn.getAttribute('data-scale')));
      });

      // Editing (including the title, which re-serializes the whole body) must
      // always happen against the unscaled recipe so a save can never persist
      // scaled quantities.
      var title = document.getElementById('recipe-title');
      document.addEventListener('focusin', function (e) {
        if (currentScale === 1) return;
        if (e.target === title || content.contains(e.target)) apply(1);
      });

      content.addEventListener('blur', function (e) {
        if (currentScale === 1 && base.has(e.target)) {
          base.set(e.target, e.target.innerHTML);
        }
      }, true);
    })();
  `;
}
