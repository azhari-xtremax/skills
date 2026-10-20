// R4 Skill map, R8 neutral templates, R9 flat references, R11 README. Pure.
import { lines } from './markdown.mjs';
import { scanLine } from './guard.mjs';

export const SKILL_MAP_PATH = 'tools/repo-check/skill-map.json';
export const PLANS = ['BP', 'EF', 'US', 'NY', 'RW', 'RW+G', 'UC'];
export const DEPENDENCES = ['core', 'partial', 'wording only', 'none'];
export const SIZES = ['none', 'small', 'medium', 'large'];
const SHARED_FOLDERS = ['agents', 'references'];

// Rows are written one per line after the opening `[`, so row i stands on line i + 2.
const rowLine = (i) => i + 2;
const folderPath = (folder) => (SHARED_FOLDERS.includes(folder) ? folder : `${folder}/SKILL.md`);

/** The shape of skill-map.json (Data Models). */
export function validateSkillMap(rows) {
  const findings = [];
  if (!Array.isArray(rows)) {
    return [{ rule: 'R4', path: SKILL_MAP_PATH, line: 1, code: 'map-invalid-row', message: 'skill-map.json must be an array of rows' }];
  }
  const seen = new Set();
  rows.forEach((r, i) => {
    const ok = r && typeof r.folder === 'string' && typeof r.treatment === 'string'
      && DEPENDENCES.includes(r.dependence) && SIZES.includes(r.size) && PLANS.includes(r.plan);
    if (!ok) {
      findings.push({ rule: 'R4', path: SKILL_MAP_PATH, line: rowLine(i), code: 'map-invalid-row', message: `row ${i + 1} does not have the Data Models shape` });
      return;
    }
    if (seen.has(r.folder)) {
      findings.push({ rule: 'R4', path: SKILL_MAP_PATH, line: rowLine(i), code: 'map-duplicate-row', message: `a second row for ${r.folder}` });
    }
    seen.add(r.folder);
  });
  return findings;
}

/**
 * R4: `folders` are the checked set's top-level folders; `markers` maps a folder to the marker
 * lines found in it ([{path, line}]). `olderTree` is set when the folders come from the baseline
 * tree and the map is the current one: a row for a Skill added since then names no folder there,
 * so only a folder without a row is reported (the `check` job holds every row to the current tree).
 */
export function mapIssues(skillMap, folders, markers, { olderTree = false } = {}) {
  const findings = [];
  const rows = new Map(skillMap.map((r, i) => [r.folder, { ...r, index: i }]));
  for (const folder of folders) {
    if (!rows.has(folder)) {
      findings.push({ rule: 'R4', path: folderPath(folder), line: 1, code: 'folder-without-row', message: `${folder} has no row in ${SKILL_MAP_PATH}` });
    }
  }
  const present = new Set(folders);
  for (const r of rows.values()) {
    if (!present.has(r.folder) && !olderTree) {
      findings.push({ rule: 'R4', path: SKILL_MAP_PATH, line: rowLine(r.index), code: 'row-without-folder', message: `the row for ${r.folder} names a missing folder` });
    }
    if (r.dependence === 'wording only') {
      for (const m of markers.get(r.folder) ?? []) {
        findings.push({ rule: 'R4', path: m.path, line: m.line, code: 'marker-in-wording-only', message: `${r.folder} is "wording only" in the Skill map and may hold no marker` });
      }
    }
  }
  return findings;
}

const TEMPLATE_PATH = /^[^/]+\/settings-templates\/|^(buildpad-spec-[^/]+|buildpad-steering|buildpad-steering-custom)\/rules\//;

// R8 scope: every settings-templates folder, and the rules folder of the spec and steering Skills.
export function isTemplatePath(p) {
  return TEMPLATE_PATH.test(p);
}

/** R8 over the template texts (`texts`: Map path → text) and R9 over every path. */
export function templateIssues(paths, texts) {
  const findings = [];
  for (const p of paths) {
    if (!isTemplatePath(p)) continue;
    const text = texts.get(p);
    if (typeof text !== 'string') continue;
    lines(text).forEach((line, i) => {
      if (/supabase/i.test(line)) {
        findings.push({ rule: 'R8', path: p, line: i + 1, code: 'supabase-in-template', message: 'a Supabase statement in a Specification_Template or copied rule (5.6)' });
      }
      const ids = scanLine(line, { local: false });
      if (ids.length) {
        findings.push({ rule: 'R8', path: p, line: i + 1, code: 'guard-pattern-in-template', message: `a §C20 pattern (${ids.join(', ')}) in a Specification_Template or copied rule (5.6)` });
      }
    });
  }
  const subfolders = new Set();
  for (const p of paths) {
    const m = /^references\/([^/]+)\/./.exec(p);
    if (m && !subfolders.has(m[1])) {
      subfolders.add(m[1]);
      findings.push({ rule: 'R9', path: p, line: 1, code: 'references-subfolder', message: `references/${m[1]}/ is a subfolder; top-level references/ holds no subfolder (§C13)` });
    }
  }
  return findings;
}

export const BASELINE_COMMAND = 'npx skills add buildpad-ai/skills#v1.0.0';

const normaliseTarget = (t) => t.replace(/^\.\//, '').replace(/\/SKILL\.md$/, '').replace(/\/$/, '');

/** R11: each Skill folder linked from the first cell of exactly one table row; the baseline command. */
export function readmeIssues(readme, skillFolders) {
  if (typeof readme !== 'string') {
    return [{ rule: 'R11', path: 'README.md', line: 1, code: 'readme-missing', message: 'README.md is missing' }];
  }
  const findings = [];
  const rowsByFolder = new Map();
  lines(readme).forEach((line, i) => {
    if (!/^\s*\|/.test(line)) return;
    const firstCell = line.trim().replace(/^\|/, '').split('|')[0];
    for (const m of firstCell.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = normaliseTarget(m[1]);
      if (!rowsByFolder.has(target)) rowsByFolder.set(target, []);
      rowsByFolder.get(target).push(i + 1);
    }
  });
  for (const folder of skillFolders) {
    const rows = rowsByFolder.get(folder) ?? [];
    if (rows.length === 0) {
      findings.push({ rule: 'R11', path: 'README.md', line: 1, code: 'readme-missing-skill', message: `${folder} is missing from the README catalogue` });
    }
    for (const line of rows.slice(1)) {
      findings.push({ rule: 'R11', path: 'README.md', line, code: 'readme-duplicate-skill', message: `${folder} is listed more than once in the README catalogue` });
    }
  }
  if (!readme.includes(BASELINE_COMMAND)) {
    findings.push({ rule: 'R11', path: 'README.md', line: 1, code: 'readme-missing-baseline-command', message: `the README lacks \`${BASELINE_COMMAND}\` (6.4)` });
  }
  return findings;
}
