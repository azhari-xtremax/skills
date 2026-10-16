// The baseline (S9, tag v1.0.0): reading files at a ref, R5's name rule and R7's Supabase-view
// parity. Runs git.
import { git } from './checked-set.mjs';
import { lines, decodeUtf8 } from './markdown.mjs';
import { viewLines, fileBackend } from './passages.mjs';
import { POINTER_LINE } from './gate.mjs';
import { frontMatterFields, removeDescriptionValue } from './frontmatter.mjs';

export class BaselineError extends Error {}

export function baselineMessage(ref) {
  return `baseline ref ${ref} not found: fetch tags (fetch-depth: 0) or create the tag (S9)`;
}

/** Throws BaselineError when `ref` names no commit in `repo`. */
export function assertRef(ref, repo = process.cwd()) {
  const out = git(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowFail: true });
  if (out === null) throw new BaselineError(baselineMessage(ref));
}

/** Each path's bytes at `ref` (null where the path holds no file), in one `git cat-file --batch`. */
export function readAtRef(ref, paths, { repo = process.cwd() } = {}) {
  const result = new Map();
  if (paths.length === 0) return result;
  const input = paths.map((p) => `${ref}:${p}\n`).join('');
  const out = git(repo, ['cat-file', '--batch'], { input });
  let pos = 0;
  for (const p of paths) {
    const nl = out.indexOf(0x0a, pos);
    const header = out.subarray(pos, nl).toString('utf8');
    pos = nl + 1;
    const parts = header.split(' ');
    if (parts.length < 3 || parts.at(-1) === 'missing' || header.endsWith(' missing') || header.endsWith(' ambiguous')) {
      result.set(p, null);
      continue;
    }
    const size = Number(parts[2]);
    const content = out.subarray(pos, pos + size);
    pos += size + 1;
    result.set(p, parts[1] === 'blob' ? Buffer.from(content) : null);
  }
  return result;
}

/** One file's bytes at `ref`, or null when it did not exist there. */
export function showAtRef(ref, p, { repo = process.cwd() } = {}) {
  return readAtRef(ref, [p], { repo }).get(p);
}

const GATE_BEGIN = '<!-- backend-gate:begin';
const GATE_END = '<!-- backend-gate:end';
const bare = (seg) => (seg.endsWith('\r') ? seg.slice(0, -1) : seg);

function removeGates(kept) {
  const out = [];
  for (let i = 0; i < kept.length; i++) {
    if (!bare(kept[i].seg).trim().startsWith(GATE_BEGIN)) {
      out.push(kept[i]);
      continue;
    }
    let j = i;
    while (j < kept.length && !bare(kept[j].seg).trim().startsWith(GATE_END)) j++;
    if (j + 1 < kept.length && bare(kept[j + 1].seg).trim() === '') j++;
    i = j;
  }
  return out;
}

/**
 * R7 parity of one file: its Supabase view, with the Gate block plus one following blank line, the
 * Pointer line and the front-matter `description` value removed, against the baseline file with
 * its `description` value removed. `firstDiffLine` is a line of the raw file.
 */
export function supabaseViewParity(p, text, baseline) {
  const baseText = typeof baseline === 'string' ? baseline : baseline.toString('utf8');
  let kept = viewLines(text, 'supabase').kept;
  kept = removeGates(kept).filter((k) => bare(k.seg) !== POINTER_LINE);
  kept = removeDescriptionValue(kept);
  const base = removeDescriptionValue(baseText.split('\n').map((seg, i) => ({ line: i + 1, seg })));
  const n = Math.max(kept.length, base.length);
  for (let i = 0; i < n; i++) {
    if (kept[i]?.seg !== base[i]?.seg) {
      const line = kept[i]?.line ?? (kept.at(-1)?.line ?? 0) + 1;
      return { equal: false, firstDiffLine: line };
    }
  }
  return { equal: true, firstDiffLine: null };
}

function firstDiffLineBytes(cur, base) {
  if (!cur || !base) return 1;
  const a = cur.toString('latin1').split('\n');
  const b = base.toString('latin1').split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i + 1;
  return 1;
}

/**
 * R7 over the checked set. `current` and `baseline`: Map path → Buffer. `uc`: folders whose row is
 * UC (byte-identical, always). `converted`: folders with `converted/<folder>`. `listed`: paths
 * that have an entry in `supabase-view-changes/*.json`.
 */
export function supabaseViewFindings({ current, baseline, uc, converted, listed }) {
  const findings = [];
  const push = (p, line, code, message) => findings.push({ rule: 'R7', path: p, line, code, message });
  const paths = [...new Set([...current.keys(), ...baseline.keys()])].sort();
  for (const p of paths) {
    const top = p.split('/')[0];
    const cur = current.get(p) ?? null;
    const base = baseline.get(p) ?? null;
    if (uc.has(top)) {
      if (!cur || !base || !cur.equals(base)) {
        const what = !cur ? 'removed' : !base ? 'added' : 'changed';
        push(p, firstDiffLineBytes(cur, base), 'unchanged-folder-differs', `file ${what} in a folder that must stay byte-identical to the baseline (UC)`);
      }
      continue;
    }
    if (!converted.has(top) || listed.has(p)) continue;
    const curText = cur ? decodeUtf8(cur) : null;
    const inSupabaseView = cur !== null && (curText === null || fileBackend(p, curText) !== 'engine');
    if (!base) {
      if (inSupabaseView) push(p, 1, 'new-file-unlisted', 'a new file in the Supabase view has no entry in supabase-view-changes/');
      continue;
    }
    if (!inSupabaseView) {
      push(p, 1, 'file-removed-unlisted', 'a baseline file is missing from the Supabase view and has no entry in supabase-view-changes/');
      continue;
    }
    const baseText = decodeUtf8(base);
    if (curText === null || baseText === null) {
      if (!cur.equals(base)) push(p, firstDiffLineBytes(cur, base), 'supabase-view-differs', 'bytes differ from the baseline and the file has no entry in supabase-view-changes/');
      continue;
    }
    const r = supabaseViewParity(p, curText, baseText);
    if (!r.equal) push(p, r.firstDiffLine, 'supabase-view-differs', 'the Supabase view differs from the baseline and the file has no entry in supabase-view-changes/');
  }
  return findings;
}

const nameBearing = (p) => /^[^/]+\/SKILL\.md$/.test(p) || /^agents\/[^/]+\.md$/.test(p);

/** R5's baseline rule: a `name` that differs from `git show <baseline>:<path>`. */
export function nameFindings({ current, baseline }) {
  const findings = [];
  for (const [p, cur] of current) {
    if (!nameBearing(p)) continue;
    const base = baseline.get(p);
    if (!base) continue;
    const curText = decodeUtf8(cur);
    const baseText = decodeUtf8(base);
    if (curText === null || baseText === null) continue;
    const curName = frontMatterFields(lines(curText))?.get('name');
    const baseName = frontMatterFields(lines(baseText))?.get('name');
    if (baseName && curName && curName.value !== baseName.value) {
      findings.push({
        rule: 'R5', path: p, line: curName.start + 1, code: 'name-changed',
        message: `front-matter name "${curName.value}" differs from the baseline "${baseName.value}"`,
      });
    }
  }
  return findings;
}
