// Backend passages (§C13) and the two views, reimplemented from the shared contract (design S8).
// Function names are the Platform's (BackendPassageStripper); `authoringIssues` adds this
// repository's own authoring rules (S6). Pure: no file system, no git.
import { contract, KINDS, TOKEN, ONLY_DIRS } from './contract.mjs';
import { lines, frontMatterRange, fencedBlocks, isTableRow, isBlank, isMarkdownPath } from './markdown.mjs';

export const MARKER_REGEX = new RegExp(contract.markerRegex);
const STEERING_TOKEN = contract.steeringToken;

/**
 * Reads one line as a marker. Returns {type: 'open'|'close'|'file', kind} or null.
 * The kind is returned as written, so an unknown kind can be reported.
 */
export function parseMarker(line) {
  const text = line.endsWith('\r') ? line.slice(0, -1) : line;
  if (!text.includes(TOKEN)) return null;
  const m = MARKER_REGEX.exec(text);
  if (!m) return null;
  if (m[1].startsWith('/')) return { type: 'close', kind: null };
  return { type: m[2] ? 'file' : 'open', kind: m[3] };
}

/** 0-based index of the one line a file marker may stand on (§C13). */
function fileMarkerLineIndex(ls) {
  const fm = frontMatterRange(ls);
  if (!fm) return 0;
  for (let i = fm.end + 1; i < ls.length; i++) {
    if (!isBlank(ls[i])) return i;
  }
  return -1;
}

/** The kind named by an `engine-only`/`supabase-only` directory segment of `path`, or null. */
export function onlyDirKind(p) {
  const dirs = p.split('/').slice(0, -1);
  for (const d of dirs) {
    if (Object.hasOwn(ONLY_DIRS, d)) return ONLY_DIRS[d];
  }
  return null;
}

const byLine = (a, b) => a.line - b.line || a.code.localeCompare(b.code);

/** §C13 grammar over one file, whatever its type. Returns [{line, code}] (1-based lines). */
export function validateMarkers(text) {
  const ls = lines(text);
  const fm = frontMatterRange(ls);
  const allowed = fileMarkerLineIndex(ls);
  const issues = [];
  const stack = [];
  let fileMarked = false;
  for (let i = 0; i < ls.length; i++) {
    const line = ls[i];
    const n = i + 1;
    if (!line.includes(TOKEN)) {
      if (stack.length && line.includes(STEERING_TOKEN)) issues.push({ line: n, code: 'straddles-steering' });
      continue;
    }
    if (fm && i <= fm.end) {
      issues.push({ line: n, code: 'marker-in-front-matter' });
      continue;
    }
    const mk = parseMarker(line);
    if (!mk) {
      issues.push({ line: n, code: 'malformed-marker' });
      continue;
    }
    if (mk.type !== 'close' && !KINDS.includes(mk.kind)) issues.push({ line: n, code: 'unknown-kind' });
    if (mk.type === 'file') {
      if (i === allowed && !fileMarked) fileMarked = true;
      else issues.push({ line: n, code: fileMarked ? 'conflicting-scope' : 'misplaced-file-marker' });
      continue;
    }
    if (mk.type === 'open') {
      if (fileMarked) issues.push({ line: n, code: 'conflicting-scope' });
      if (stack.length) issues.push({ line: n, code: 'nested' });
      stack.push(n);
      continue;
    }
    if (stack.length) stack.pop();
    else issues.push({ line: n, code: 'unpaired-close' });
  }
  for (const n of stack) issues.push({ line: n, code: 'unpaired-open' });
  return issues.sort(byLine);
}

/** §C13 placement rule that needs the path: no file marker inside an `*-only` folder. */
export function validateMarkerPlacement(p, text) {
  if (!onlyDirKind(p)) return [];
  const ls = lines(text);
  const allowed = fileMarkerLineIndex(ls);
  // A file marker on any other line is already `misplaced-file-marker` by validateMarkers.
  if (allowed >= 0 && parseMarker(ls[allowed])?.type === 'file') {
    return [{ line: allowed + 1, code: 'misplaced-file-marker' }];
  }
  return [];
}

/** The backend a whole file holds for: the directory rule, then the file-marker rule (§C13). */
export function fileBackend(p, text) {
  const dirKind = onlyDirKind(p);
  if (dirKind) return dirKind;
  if (text === null || text === undefined) return null;
  const ls = lines(text);
  const allowed = fileMarkerLineIndex(ls);
  if (allowed < 0) return null;
  const mk = parseMarker(ls[allowed]);
  return mk?.type === 'file' && KINDS.includes(mk.kind) ? mk.kind : null;
}

/**
 * The view of one file for `keep`: the other backend's passages are removed, and so is every
 * marker line of both kinds. Each kept line keeps its own line ending; a file with no marker is
 * returned unchanged. `removed` counts the passages removed.
 */
export function stripBackendPassages(text, keep) {
  const { kept, removed, sawMarker } = viewLines(text, keep);
  if (!sawMarker) return { text, removed: 0 };
  return { text: kept.map((k) => k.seg).join('\n'), removed };
}

/**
 * The lines `stripBackendPassages` keeps, each with its 1-based line number in the raw file and
 * its raw segment (line ending `\r` kept, `\n` removed).
 */
export function viewLines(text, keep) {
  const segs = text.split('\n');
  const kept = [];
  let removed = 0;
  let skipping = false;
  let sawMarker = false;
  segs.forEach((seg, i) => {
    const mk = parseMarker(seg);
    if (mk) sawMarker = true;
    if (skipping) {
      if (mk?.type === 'close') skipping = false;
      return;
    }
    if (mk) {
      if (mk.type === 'open' && mk.kind !== keep) {
        skipping = true;
        removed++;
      }
      return;
    }
    kept.push({ line: i + 1, seg });
  });
  return { kept, removed, sawMarker };
}

/**
 * The kind each line holds for: the file's kind (file marker) on every line, otherwise the kind
 * of the passage around it (marker lines included), otherwise null. Index 0 = line 1.
 */
export function lineKinds(text) {
  const ls = lines(text);
  const allowed = fileMarkerLineIndex(ls);
  const fileMk = allowed >= 0 ? parseMarker(ls[allowed]) : null;
  if (fileMk?.type === 'file') return ls.map(() => fileMk.kind);
  const kinds = new Array(ls.length).fill(null);
  let open = null;
  for (let i = 0; i < ls.length; i++) {
    const mk = parseMarker(ls[i]);
    if (mk?.type === 'open' && open === null) open = mk.kind;
    kinds[i] = open;
    if (mk?.type === 'close') open = null;
  }
  return kinds;
}

/**
 * This repository's authoring rules (S6), checked by R2:
 * - `straddles-fence`: a marker line inside a fenced code block (Markdown files);
 * - `marker-in-table`: a marker line whose previous and next lines are table rows (Markdown files);
 * - `gap-between-passages`: blank lines only between a closer and the opener of a passage of the
 *   other kind, which replaces it (every file).
 */
export function authoringIssues(text, p) {
  const ls = lines(text);
  const markdown = isMarkdownPath(p);
  const issues = [];
  const { inside } = markdown ? fencedBlocks(ls) : { inside: [] };
  const markers = ls.map((l) => parseMarker(l));
  let openKind = null;
  let lastClose = null; // {index, kind}
  for (let i = 0; i < ls.length; i++) {
    const mk = markers[i];
    if (!mk) continue;
    const n = i + 1;
    if (markdown && inside[i]) issues.push({ line: n, code: 'straddles-fence' });
    else if (markdown && isTableRow(ls[i - 1]) && isTableRow(ls[i + 1])) issues.push({ line: n, code: 'marker-in-table' });
    if (mk.type === 'open') {
      if (lastClose && i > lastClose.index + 1 && mk.kind !== lastClose.kind) {
        let blanksOnly = true;
        for (let j = lastClose.index + 1; j < i; j++) if (!isBlank(ls[j])) blanksOnly = false;
        if (blanksOnly) issues.push({ line: n, code: 'gap-between-passages' });
      }
      openKind = mk.kind;
      lastClose = null;
    } else if (mk.type === 'close') {
      lastClose = { index: i, kind: openKind };
      openKind = null;
    }
  }
  return issues.sort(byLine);
}
