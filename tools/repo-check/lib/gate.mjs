// R3 Gate: the canonical Gate (S3, `tools/repo-check/gate.md`), its placement (S4), the Pointer
// line of code assets (S5), and the two link rules that keep a deep link inside a gated file.
// Pure apart from reading gate.md once.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TOOL_DIR } from './contract.mjs';
import { lines, frontMatterRange, isBlank, isMarkdownPath } from './markdown.mjs';
import { parseMarker, onlyDirKind, fileBackend, lineKinds } from './passages.mjs';
import { extractLinks, resolveTarget } from './links.mjs';

export const GATE_PATH = path.join(TOOL_DIR, 'gate.md');
/** The Gate block, line endings normalised to LF, without its final newline. */
export const GATE_TEXT = readFileSync(GATE_PATH, 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '');
const GATE_BEGIN_PREFIX = '<!-- backend-gate:begin';
const GATE_END_PREFIX = '<!-- backend-gate:end';

/** S5, verbatim. */
export const POINTER_LINE =
  '// Backend: before using this file, establish the backend as "Establish the backend first" in this skill\'s SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.';

const POINTER_PATH = /\.(ts|tsx)$/;
// Extensions whose files can hold a comment; any other file in an `*-only` folder is comment-less.
const COMMENTABLE = /\.(md|mdx|markdown|ts|tsx|js|jsx|mjs|cjs|sql|sh|bash|ya?ml|css|scss|html?|py|toml|go)$/i;

export const MESSAGES = {
  'gate-missing': 'this file needs the Gate (S4) and does not hold it',
  'gate-altered': 'the Gate is not byte-identical to tools/repo-check/gate.md',
  'gate-misplaced': 'the Gate is not where S4 places it',
  'gate-duplicate': 'a second copy of the Gate',
  'pointer-missing': 'this asset holds a marker and lacks the Pointer line (S5)',
  'pointer-misplaced': 'the Pointer line must be line 1, or the line after the file marker (S4)',
  'link-into-assets': 'a link from another Skill to a file under assets/ (S4)',
  'link-to-only-file': 'a link to a comment-less *-only file from another Skill or from text not of its kind (S4)',
};

const nextNonBlank = (ls, from) => {
  for (let i = from; i < ls.length; i++) if (!isBlank(ls[i])) return i;
  return -1;
};

function findGates(ls) {
  const gates = [];
  for (let i = 0; i < ls.length; i++) {
    if (!ls[i].trim().startsWith(GATE_BEGIN_PREFIX)) continue;
    let end = -1;
    for (let j = i + 1; j < ls.length; j++) {
      if (ls[j].trim().startsWith(GATE_END_PREFIX)) {
        end = j;
        break;
      }
    }
    gates.push({ start: i, end });
    if (end < 0) break;
    i = end;
  }
  return gates;
}

function fileMarkerIndex(ls) {
  const fm = frontMatterRange(ls);
  const allowed = fm ? nextNonBlank(ls, fm.end + 1) : 0;
  return allowed >= 0 && parseMarker(ls[allowed] ?? '')?.type === 'file' ? allowed : -1;
}

const holdsMarker = (text) => lines(text).some((l) => {
  const m = parseMarker(l);
  return m !== null && m.type !== 'close';
});

/**
 * R3 for one file. `skillFiles` maps every path of the same top-level folder to its text (null for
 * a binary file). `requireGate` makes a SKILL.md need the Gate without a passage (RW+G rows).
 * Returns [{line, code}].
 */
export function gateIssues(p, text, skillFiles, { requireGate = false } = {}) {
  const ls = lines(text);
  const top = p.split('/')[0];
  const markers = ls.map((l) => parseMarker(l));
  const hasOpener = markers.some((m) => m?.type === 'open');
  const fileIdx = fileMarkerIndex(ls);
  const fileMarked = fileIdx >= 0;

  if (isMarkdownPath(p)) {
    const isSkillMd = p === `${top}/SKILL.md`;
    const skillGated = isSkillMd && (requireGate || [...skillFiles].some(([q, t]) => onlyDirKind(q) || (t !== null && holdsMarker(t))));
    if (!(hasOpener || fileMarked || skillGated)) return [];
    const gates = findGates(ls);
    if (gates.length === 0) return [{ line: 1, code: 'gate-missing' }];
    const issues = [];
    const g = gates[0];
    if (g.end < 0 || ls.slice(g.start, g.end + 1).join('\n') !== GATE_TEXT) issues.push({ line: g.start + 1, code: 'gate-altered' });
    for (const extra of gates.slice(1)) issues.push({ line: extra.start + 1, code: 'gate-duplicate' });
    let placed;
    if (fileMarked) {
      placed = g.start === nextNonBlank(ls, fileIdx + 1);
    } else {
      const fm = frontMatterRange(ls);
      const first = nextNonBlank(ls, fm ? fm.end + 1 : 0);
      placed = g.start === first || (ls[first]?.startsWith('# ') && g.start === nextNonBlank(ls, first + 1));
    }
    if (!placed) issues.push({ line: g.start + 1, code: 'gate-misplaced' });
    return issues.sort((a, b) => a.line - b.line);
  }

  if (POINTER_PATH.test(p) && (hasOpener || fileMarked)) {
    const idx = ls.indexOf(POINTER_LINE);
    if (idx < 0) return [{ line: 1, code: 'pointer-missing' }];
    if (idx !== (fileMarked ? fileIdx + 1 : 0)) return [{ line: idx + 1, code: 'pointer-misplaced' }];
  }
  return [];
}

/**
 * R3 over the checked set, with the converted-folder switch (Scope and views): a file is held to
 * R3 only when its top-level folder has `converted/<folder>`; a link rule applies when the folder
 * of the link or of its target is converted.
 * `files`: Map path → text (null for a binary file). Returns findings {rule, path, line, code, message}.
 */
export function gateFindings(files, { converted, gateRequired = new Set() }) {
  const byTop = new Map();
  for (const [p, t] of files) {
    const top = p.split('/')[0];
    if (!byTop.has(top)) byTop.set(top, new Map());
    byTop.get(top).set(p, t);
  }
  const findings = [];
  const push = (p, line, code) => findings.push({ rule: 'R3', path: p, line, code, message: MESSAGES[code] });

  for (const [p, text] of files) {
    const top = p.split('/')[0];
    if (!converted.has(top) || text === null) continue;
    const requireGate = gateRequired.has(top) && p === `${top}/SKILL.md`;
    for (const i of gateIssues(p, text, byTop.get(top), { requireGate })) push(p, i.line, i.code);
  }

  for (const [p, text] of files) {
    if (text === null || !isMarkdownPath(p)) continue;
    const srcTop = p.split('/')[0];
    let kinds = null;
    let srcKind;
    for (const link of extractLinks(text)) {
      const t = resolveTarget(p, link.target);
      if (!t) continue;
      const tTop = t.split('/')[0];
      if (!converted.has(srcTop) && !converted.has(tTop)) continue;
      if (tTop !== srcTop && t.split('/').slice(1, -1).includes('assets')) push(p, link.line, 'link-into-assets');
      const only = onlyDirKind(t);
      if (only && files.has(t) && !COMMENTABLE.test(t)) {
        if (kinds === null) {
          kinds = lineKinds(text);
          srcKind = fileBackend(p, text);
        }
        const textKind = srcKind ?? kinds[link.line - 1];
        if (tTop !== srcTop || textKind !== only) push(p, link.line, 'link-to-only-file');
      }
    }
  }
  return findings;
}
