// Minimal YAML front-matter reading for `name` and `description` (R5, R7), and a strict check that
// the front matter is YAML a real parser accepts (R14). Pure.
import { frontMatterRange, lines } from './markdown.mjs';
import { fileBackend, stripBackendPassages } from './passages.mjs';

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

// The YAML check. `npx skills add` parses front matter with the `yaml` package and skips a file
// whose front matter it refuses, so the check must refuse at least what that parser refuses. It
// reads the subset front matter uses: block mappings and lists, plain, quoted, block and flow
// values. It is stricter than YAML where a value would parse but not as written (a ` #` cuts a
// plain value, a first key off column 1), and it refuses anchors, aliases and tags.
const ENTRY_KEY = /^([^\s#'"[\]{},&*!|>%@`?:-][^#]*?|[?:-][^\s#][^#]*?)\s*:(?:\s+(.*)|\s*)$/;
const LIST_ENTRY = /^-(?:\s+(.*)|\s*)$/;
const BLOCK_HEADER = /^[|>](?:[1-9][+-]?|[+-][1-9]?)?(?:\s+#.*)?$/;
const ESCAPES = { x: 2, u: 4, U: 8 };
const SIMPLE_ESCAPES = new Set([...'0abtnvfre "/\\N_LP\t']);

const indentOf = (t) => t.length - t.trimStart().length;
const isBlank = (t) => t.trim() === '';
const isComment = (t) => t.trimStart().startsWith('#');
const isContent = (r) => !isBlank(r.t) && !isComment(r.t);

/** Index of the last row of the entry at `i`: the rows after it that are blank or indented more. */
function entryEnd(rows, i, indent, sameIndentList) {
  let j = i;
  while (
    j + 1 < rows.length
    && (isBlank(rows[j + 1].t) || indentOf(rows[j + 1].t) > indent
      || (sameIndentList && indentOf(rows[j + 1].t) === indent && LIST_ENTRY.test(rows[j + 1].t.trim())))
  ) j++;
  return j;
}

/** One row per value line with its text trimmed; `at(k)` is the line of offset k in the joined text. */
function joined(parts) {
  const starts = [];
  let s = '';
  for (const p of parts) {
    if (s) s += ' ';
    starts.push([s.length, p.n]);
    s += p.t.trim();
  }
  const at = (k) => starts.filter(([o]) => o <= k).pop()[1];
  return { s, at };
}

function afterValue(s, k, at, say, what) {
  const rest = s.slice(k);
  if (rest.trim() !== '' && !/^\s+#/.test(rest)) say(at(k), `text after ${what}; quote the whole value`);
}

function quoted(parts, say) {
  const { s, at } = joined(parts);
  const q = s[0];
  for (let i = 1; i < s.length; i++) {
    if (q === '"' && s[i] === '\\') {
      const e = s[i + 1];
      if (ESCAPES[e]) {
        if (!new RegExp(`^[0-9A-Fa-f]{${ESCAPES[e]}}`).test(s.slice(i + 2))) say(at(i), `a \`\\${e}\` escape without ${ESCAPES[e]} hex digits`);
        i += 1 + ESCAPES[e];
      } else {
        if (!SIMPLE_ESCAPES.has(e)) say(at(i), `\`\\${e ?? ''}\` is not a YAML escape; write \`\\\\\` for a backslash`);
        i++;
      }
    } else if (s[i] === q) {
      if (q === "'" && s[i + 1] === "'") i++;
      else return afterValue(s, i + 1, at, say, 'the closing quote');
    }
  }
  say(parts[0].n, `a ${q === '"' ? 'double' : 'single'}-quoted value that does not close`);
}

function flow(parts, say) {
  const { s, at } = joined(parts);
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ((c === '"' || c === "'") && /[\s[{,:]/.test(s[i - 1] ?? ' ')) {
      let k = i + 1;
      while (k < s.length && !(s[k] === c && !(c === "'" && s[k + 1] === "'"))) k += (c === '"' && s[k] === '\\') || (c === "'" && s[k] === "'") ? 2 : 1;
      if (k >= s.length) return say(at(i), 'a quoted string inside a flow collection that does not close');
      i = k;
    } else if (c === '[' || c === '{') {
      stack.push(c === '[' ? ']' : '}');
    } else if (c === ']' || c === '}') {
      if (stack.pop() !== c) return say(at(i), `a \`${c}\` that closes nothing open`);
      if (stack.length === 0) return afterValue(s, i + 1, at, say, `the flow collection that \`${s[0]}\` opens`);
    }
  }
  say(parts[0].n, `\`${s[0]}\` opens a flow collection that does not close; quote the value`);
}

function plain(parts, say) {
  parts.forEach((p, k) => {
    const t = p.t.trim();
    if (/:(\s|$)/.test(t)) say(p.n, 'an unquoted `: ` (or a `:` at the end of a line) inside a plain value; quote the value');
    if (/\s#/.test(t) || (k > 0 && t.startsWith('#'))) say(p.n, 'an unquoted ` #` inside a plain value starts a comment; quote the value');
  });
}

/** The value of an entry: `first` is the text after `key:` or `- ` on line `n`, `children` the rows below. */
function value(first, n, children, say) {
  if (first === '' || first.startsWith('#')) return node(children, say);
  if (/^[|>]/.test(first)) {
    if (!BLOCK_HEADER.test(first)) say(n, 'text after a block scalar indicator (`|` or `>`) on its line');
    return;
  }
  const parts = [{ t: first, n }, ...children.filter((r) => !isBlank(r.t))];
  const c = first[0];
  if (c === '"' || c === "'") return quoted(parts, say);
  if (c === '[' || c === '{') return flow(parts, say);
  if (/^[-?:](\s|$)/.test(first)) return say(n, `\`${c}\` cannot start a value on its key's line`);
  if ('&*!'.includes(c)) return say(n, 'an anchor, alias or tag; front matter here uses none');
  if ('%@`,]}'.includes(c)) return say(n, `a plain value cannot start with \`${c}\`; quote the value`);
  plain(parts, say);
}

function mapping(rows, indent, say) {
  const seen = new Set();
  for (let i = 0; i < rows.length; i++) {
    const { t, n } = rows[i];
    if (!isContent(rows[i])) continue;
    const m = indentOf(t) === indent ? ENTRY_KEY.exec(t.slice(indent)) : null;
    const j = entryEnd(rows, i, indent, m !== null && (m[2] ?? '').trim() === '');
    if (indentOf(t) !== indent) say(n, 'an indentation that matches no key above it');
    else if (!m) say(n, 'not a `key: value` line');
    else {
      if (seen.has(m[1])) say(n, `the key \`${m[1]}\` appears twice`);
      seen.add(m[1]);
      value((m[2] ?? '').trim(), n, rows.slice(i + 1, j + 1), say);
    }
    i = j;
  }
}

function list(rows, indent, say) {
  for (let i = 0; i < rows.length; i++) {
    const { t, n } = rows[i];
    if (!isContent(rows[i])) continue;
    const j = entryEnd(rows, i, indent, false);
    const m = indentOf(t) === indent ? LIST_ENTRY.exec(t.slice(indent)) : null;
    if (indentOf(t) !== indent) say(n, 'an indentation that matches no list entry above it');
    else if (!m) say(n, 'a line that is not a `- ` entry inside a list');
    else {
      // The text after `- ` is a node of its own, indented to where that text starts.
      const rest = m[1] ?? '';
      node([{ t: ' '.repeat(t.length - rest.length) + rest, n }, ...rows.slice(i + 1, j + 1)], say);
    }
    i = j;
  }
}

/** A block node: rows that hold a mapping, a list, or a scalar that starts on the first of them. */
function node(rows, say) {
  const k = rows.findIndex(isContent);
  if (k < 0) return;
  const { t, n } = rows[k];
  const text = t.trim();
  if (LIST_ENTRY.test(text)) return list(rows.slice(k), indentOf(t), say);
  if (ENTRY_KEY.test(text)) return mapping(rows.slice(k), indentOf(t), say);
  value(text, n, rows.slice(k + 1), say);
}

/**
 * Where the front matter of `ls` (lines without `\r`) is not YAML the check accepts: a list of
 * {line, detail}, 1-based lines. Empty when the file has no front matter.
 */
export function frontMatterYamlProblems(ls) {
  const fm = frontMatterRange(ls);
  if (!fm) return [];
  const rows = ls.slice(fm.start + 1, fm.end).map((t, k) => ({ t, n: fm.start + k + 2 }));
  const problems = [];
  const say = (line, detail) => problems.push({ line, detail });
  for (const r of rows) if (!isBlank(r.t) && /^\s*\t/.test(r.t)) say(r.n, 'a tab in the indentation');
  const k = rows.findIndex(isContent);
  if (k >= 0 && indentOf(rows[k].t) !== 0) say(rows[k].n, 'the first key is indented');
  else if (k >= 0 && !ENTRY_KEY.test(rows[k].t)) say(rows[k].n, 'not a `key: value` line');
  else mapping(rows, 0, say);
  return problems;
}

/** R5 and R14 apply to every Skill's SKILL.md and to the personas in agents/. */
export function isNameBearing(p) {
  return /^[^/]+\/SKILL\.md$/.test(p) || /^agents\/[^/]+\.md$/.test(p);
}

const R5_MESSAGES = {
  'front-matter-missing': 'no YAML front matter on line 1',
  'name-missing': 'the front matter has no `name`',
  'description-missing': 'the front matter has no non-empty `description`',
};

/** The raw file and each view that holds it, as [where, text]. */
function placesOf(p, text) {
  const places = [['raw file', text]];
  const kind = fileBackend(p, text);
  for (const keep of ['engine', 'supabase']) {
    if (kind === null || kind === keep) places.push([`${keep} view`, stripBackendPassages(text, keep).text]);
  }
  return places;
}

/**
 * R5's presence rule: `name` and a non-empty `description`, in the raw file and in each view that
 * holds the file. One finding per problem, naming the places it occurs.
 */
export function frontMatterIssues(p, text) {
  if (!isNameBearing(p)) return [];
  const found = new Map();
  const note = (code, line, where) => {
    if (!found.has(code)) found.set(code, { line, where: [] });
    found.get(code).where.push(where);
  };
  for (const [where, t] of placesOf(p, text)) {
    const ls = lines(t);
    const fields = frontMatterFields(ls);
    if (!fields) {
      note('front-matter-missing', 1, where);
      continue;
    }
    const name = fields.get('name');
    if (!name || name.value === '') note('name-missing', name ? name.start + 1 : 1, where);
    const description = fields.get('description');
    if (!description || description.value === '') note('description-missing', description ? description.start + 1 : 1, where);
  }
  return [...found].map(([code, { line, where }]) => ({
    rule: 'R5', path: p, line, code, message: `${R5_MESSAGES[code]} (${where.join(', ')})`,
  }));
}

/**
 * R14: the front matter of a SKILL.md or persona is YAML that `npx skills add` can parse, in the
 * raw file and in each view that holds the file. One finding per problem, naming its places. A
 * file without front matter is R5's finding, not this rule's.
 */
export function frontMatterYamlIssues(p, text) {
  if (!isNameBearing(p)) return [];
  const found = new Map();
  for (const [where, t] of placesOf(p, text)) {
    for (const { line, detail } of frontMatterYamlProblems(lines(t))) {
      const key = `${line} ${detail}`;
      if (!found.has(key)) found.set(key, { line, detail, where: [] });
      found.get(key).where.push(where);
    }
  }
  return [...found.values()].map(({ line, detail, where }) => ({
    rule: 'R14', path: p, line, code: 'front-matter-not-yaml',
    message: `the front matter is not valid YAML, so \`npx skills add\` skips the file: ${detail} (${where.join(', ')})`,
  }));
}
