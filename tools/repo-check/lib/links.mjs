// Relative Markdown links (R6a, R6b): extraction that skips CommonMark fenced code blocks and code
// spans (§C13: a link inside a fenced code block is not a link), resolution per view, and the
// recorded breaks of the shared contract. Pure.
import path from 'node:path';
import { contract } from './contract.mjs';
import { lines, fencedBlocks } from './markdown.mjs';

const INLINE = /\]\(\s*(<[^>\n]*>|[^()\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const DEFINITION = /^ {0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/;

/** A target that names a file in this repository by a relative path. */
export function isRelativeTarget(target) {
  if (!target) return false;
  if (target.startsWith('#') || target.startsWith('/')) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)) return false;
  return true;
}

const unwrap = (t) => (t.startsWith('<') && t.endsWith('>') ? t.slice(1, -1) : t);
const blankCodeSpans = (line) => line.replace(/(`+).*?\1/g, (s) => ' '.repeat(s.length));

/** Relative links of a Markdown text: [{line, target}] (1-based), outside fences and code spans. */
export function extractLinks(text) {
  const ls = lines(text);
  const { inside } = fencedBlocks(ls);
  const links = [];
  ls.forEach((raw, i) => {
    if (inside[i]) return;
    const line = blankCodeSpans(raw);
    const def = DEFINITION.exec(line);
    if (def) {
      const target = unwrap(def[1]);
      if (isRelativeTarget(target)) links.push({ line: i + 1, target });
      return;
    }
    for (const m of line.matchAll(INLINE)) {
      const target = unwrap(m[1]);
      if (isRelativeTarget(target)) links.push({ line: i + 1, target });
    }
  });
  return links;
}

/** The repository path a link points to (anchor and query removed), or null outside the root. */
export function resolveTarget(fromPath, target) {
  let t = target.split('#')[0].split('?')[0];
  try {
    t = decodeURIComponent(t);
  } catch {
    // Keep the target as written.
  }
  if (t === '') return fromPath;
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), t));
  if (joined === '..' || joined.startsWith('../')) return null;
  return joined.replace(/\/$/, '');
}

/** A view: the set of files it holds, and every folder above them. */
export function makeView(paths) {
  const files = new Set(paths);
  const dirs = new Set();
  for (const p of files) {
    let d = path.posix.dirname(p);
    while (d !== '.' && !dirs.has(d)) {
      dirs.add(d);
      d = path.posix.dirname(d);
    }
  }
  return { files, dirs, has: (p) => files.has(p) || dirs.has(p) };
}

/** Whether `target`, linked from `fromPath`, names a file or folder of `view` (a view or a Set). */
export function resolves(fromPath, target, view) {
  const v = view instanceof Set ? makeView(view) : view;
  const resolved = resolveTarget(fromPath, target);
  if (resolved === null) return false;
  return resolved === '.' || v.has(resolved);
}

/** A known existing break (§C13), matched by file and target in the layouts named. */
export function isRecordedBreak(file, target, layout = 'repository') {
  return contract.recordedLinkBreaks.some(
    (b) => b.file === file && b.target === target && (b.layouts === 'all' || b.layouts.includes(layout)),
  );
}
