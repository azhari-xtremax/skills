// Minimal YAML front-matter reading for `name` and `description` (R5, R7). Pure.
import { frontMatterRange } from './markdown.mjs';

const KEY = /^([A-Za-z0-9_-]+):(?:\s+(.*)|\s*)$/;
const BLOCK_SCALAR = /^[>|][+-]?\d*$/;

const unquote = (v) => {
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) return v.slice(1, -1);
  return v;
};

/**
 * Top-level keys of the front matter of `ls` (lines without `\r`). Returns null when the file has
 * no front matter, else a Map key → {value, start, end}: 0-based indexes of the key line and of the
 * last line of its value.
 */
export function frontMatterFields(ls) {
  const fm = frontMatterRange(ls);
  if (!fm) return null;
  const fields = new Map();
  for (let i = fm.start + 1; i < fm.end; i++) {
    const m = KEY.exec(ls[i]);
    if (!m) continue;
    let j = i;
    while (j + 1 < fm.end && (ls[j + 1].trim() === '' || /^\s/.test(ls[j + 1]))) j++;
    const first = (m[2] ?? '').trim();
    const rest = ls.slice(i + 1, j + 1).map((l) => l.trim()).filter(Boolean).join(' ');
    const value = BLOCK_SCALAR.test(first) ? rest : unquote([first, rest].filter(Boolean).join(' ')).trim();
    if (!fields.has(m[1])) fields.set(m[1], { value, start: i, end: j });
    i = j;
  }
  return fields;
}

/**
 * Removes the value of the front-matter `description` from raw segments ({line, seg}), keeping
 * the key line as `description:` with its own line ending (R7 parity).
 */
export function removeDescriptionValue(kept) {
  const ls = kept.map((k) => (k.seg.endsWith('\r') ? k.seg.slice(0, -1) : k.seg));
  const fields = frontMatterFields(ls);
  const d = fields?.get('description');
  if (!d) return kept;
  const cr = kept[d.start].seg.endsWith('\r') ? '\r' : '';
  return [
    ...kept.slice(0, d.start),
    { line: kept[d.start].line, seg: `description:${cr}` },
    ...kept.slice(d.end + 1),
  ];
}
