// R10 release record and R13 converted folders (S9, Data Models). Pure.
import path from 'node:path';

export const CHANGE_DIR = 'tools/repo-check/supabase-view-changes';
export const CONVERTED_DIR = 'tools/repo-check/converted';
export const ENTRY_KINDS = ['text', 'description', 'new-file', 'removed-link'];
const TAG = /^v\d+\.\d+\.\d+$/;

/**
 * Reads one `supabase-view-changes/<folder>.json`. Returns {file, entries, lines, issues}: `lines`
 * gives each entry's line in the file (the line of its `path` value), `issues` are R10 findings
 * about the file's shape.
 */
export function parseChangeFile(file, text) {
  const issues = [];
  const folder = path.posix.basename(file, '.json');
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { file, entries: [], lines: [], issues: [{ rule: 'R10', path: file, line: 1, code: 'change-file-invalid', message: `not JSON: ${e.message}` }] };
  }
  if (!Array.isArray(data)) {
    return { file, entries: [], lines: [], issues: [{ rule: 'R10', path: file, line: 1, code: 'change-file-invalid', message: 'a change file is an array of entries (Data Models)' }] };
  }
  const textLines = text.split('\n');
  const entries = [];
  const lines = [];
  for (const e of data) {
    const needle = e && typeof e.path === 'string' ? JSON.stringify(e.path) : null;
    const idx = needle ? textLines.findIndex((l) => l.includes(needle)) : -1;
    const line = idx >= 0 ? idx + 1 : 1;
    const valid = e && typeof e.path === 'string' && ENTRY_KINDS.includes(e.kind)
      && typeof e.reason === 'string' && e.reason.trim() !== ''
      && (e.release === 'unreleased' || TAG.test(e.release ?? ''));
    if (!valid) {
      issues.push({ rule: 'R10', path: file, line, code: 'change-entry-invalid', message: 'an entry needs path, kind (text, description, new-file, removed-link), a reason and release "unreleased" or a tag' });
      continue;
    }
    if (e.path.split('/')[0] !== folder) {
      issues.push({ rule: 'R10', path: file, line, code: 'change-entry-wrong-folder', message: `${e.path} belongs in ${CHANGE_DIR}/${e.path.split('/')[0]}.json` });
    }
    entries.push(e);
    lines.push(line);
  }
  return { file, entries, lines, issues };
}

/** CHANGELOG.md sections by tag: Map tag → {line, body}. A missing file has no sections. */
export function changelogSections(changelog) {
  const sections = new Map();
  if (typeof changelog !== 'string') return sections;
  const ls = changelog.split('\n');
  let current = null;
  ls.forEach((l, i) => {
    const m = /^##\s+\[?(v\d+\.\d+\.\d+)\]?(?:\s|$)/.exec(l);
    if (m) {
      current = { tag: m[1], line: i + 1, body: [] };
      if (!sections.has(m[1])) sections.set(m[1], current);
      return;
    }
    if (/^##\s/.test(l)) current = null;
    else if (current) current.body.push(l);
  });
  for (const s of sections.values()) s.body = s.body.join('\n');
  return new Map([...sections].map(([k, v]) => [k, { line: v.line, body: v.body }]));
}

/**
 * R10. `changeFiles`: [{file, entries, lines?}]. On every run, an entry whose `release` is a tag
 * must be named in that tag's CHANGELOG section. With `tag` (a tag push), the tag must have a
 * section and no entry may still be `unreleased`.
 */
export function releaseIssues(changeFiles, changelog, tag) {
  const findings = [];
  const sections = changelogSections(changelog);
  for (const { file, entries, lines = [] } of changeFiles) {
    entries.forEach((e, i) => {
      const line = lines[i] ?? 1;
      if (e.release !== 'unreleased') {
        const s = sections.get(e.release);
        if (!s || !s.body.includes(e.path)) {
          findings.push({ rule: 'R10', path: file, line, code: 'entry-not-in-changelog', message: `${e.path} is released in ${e.release} but that tag's CHANGELOG.md section does not name it` });
        }
      } else if (tag) {
        findings.push({ rule: 'R10', path: file, line, code: 'entry-unreleased-on-tag', message: `${e.path} is still "unreleased" on the push of ${tag}` });
      }
    });
  }
  if (tag && !sections.has(tag)) {
    findings.push({ rule: 'R10', path: 'CHANGELOG.md', line: 1, code: 'changelog-missing-tag-section', message: `CHANGELOG.md has no section for ${tag}` });
  }
  return findings;
}

/** Folders whose row is not UC and that have no `converted/<folder>`. */
export function unconverted(skillMap, converted) {
  return skillMap.filter((r) => r.plan !== 'UC' && !converted.has(r.folder)).map((r) => r.folder);
}

/** R13 findings, for a tag push. */
export function convertedFindings(skillMap, converted) {
  return unconverted(skillMap, converted).map((folder) => ({
    rule: 'R13', path: `${CONVERTED_DIR}/${folder}`, line: 1, code: 'folder-not-converted',
    message: `${folder} is not UC and has no converted file: no release may carry a folder the check has not held to every rule`,
  }));
}
