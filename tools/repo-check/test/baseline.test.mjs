import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeRepo, change, git, tempDir, L } from './helpers.mjs';
import { checkedSet, checkedSetAtRef, topFolders } from '../lib/checked-set.mjs';
import {
  BaselineError,
  assertRef,
  showAtRef,
  readAtRef,
  supabaseViewParity,
  supabaseViewFindings,
  nameFindings,
} from '../lib/baseline.mjs';
import { GATE_TEXT, POINTER_LINE } from '../lib/gate.mjs';

const FM = (name, description = `The ${name} skill.`) => ['---', `name: ${name}`, `description: ${description}`, '---'];
const SUP = '<!-- buildpad-backend: supabase -->';
const ENG = '<!-- buildpad-backend: engine -->';
const END = '<!-- /buildpad-backend -->';

const BASE = {
  'uc-skill/SKILL.md': L(...FM('uc-skill'), '', '# UC', '', 'Text.'),
  'uc-skill/references/u.md': L('# U'),
  'bp-skill/SKILL.md': L(...FM('bp-skill', 'Build a thing with database migration.'), '', '# BP', '', 'Intro.', '', '## Step 1', '', 'Supabase step text.', '', '## Step 2', '', 'Shared.'),
  'bp-skill/references/r.md': L('# Ref', '', 'Supabase ref.'),
  'bp-skill/assets/a.ts': L('export const a = 1;'),
  'rw-skill/SKILL.md': L(...FM('rw-skill'), '', '# RW', '', 'Old wording.'),
  'agents/a.md': L(...FM('a'), '', '# A'),
  'references/x.md': L('# X'),
  'README.md': L('# Readme'),
  'CHANGELOG.md': L('# Changelog'),
  'tools/repo-check/check.mjs': L('// tool'),
  '.github/workflows/w.yml': L('on: push'),
  '.kiro/specs/s/requirements.md': L('# Spec'),
  'notes/plain.md': L('# Not a skill folder'),
};
const CHECKED = [
  'agents/a.md', 'bp-skill/SKILL.md', 'bp-skill/assets/a.ts', 'bp-skill/references/r.md',
  'references/x.md', 'rw-skill/SKILL.md', 'uc-skill/SKILL.md', 'uc-skill/references/u.md',
];

const currentMap = (root, paths) => new Map(paths.map((p) => [p, readFileSync(path.join(root, p))]));
const r7 = (root, { uc = ['uc-skill'], converted = [], listed = [] } = {}) => {
  const cur = checkedSet(root);
  const base = readAtRef('v1.0.0', checkedSetAtRef('v1.0.0', { repo: root }), { repo: root });
  return supabaseViewFindings({
    current: currentMap(root, cur),
    baseline: base,
    uc: new Set(uc),
    converted: new Set(converted),
    listed: new Set(listed),
  });
};
const show = (fs) => fs.map((f) => `${f.rule} ${f.path}:${f.line} ${f.code}`);

test('checked set from git ls-files: Skill folders, agents/ and references/ only', () => {
  const root = makeRepo(BASE);
  assert.deepEqual(checkedSet(root), CHECKED);
  assert.deepEqual(topFolders(checkedSet(root)), ['agents', 'bp-skill', 'references', 'rw-skill', 'uc-skill']);
  change(root, { 'bp-skill/references/new.md': L('# New') });
  assert.ok(checkedSet(root).includes('bp-skill/references/new.md'));
});

test('checked set of a git archive copy: from git ls-tree of the ref, or else a directory walk', () => {
  const root = makeRepo(BASE);
  const out = tempDir();
  const tar = path.join(tempDir(), 'baseline.tar');
  git(root, 'archive', '--format=tar', '-o', tar, 'v1.0.0');
  execFileSync('tar', ['-xf', tar, '-C', out]);
  assert.deepEqual(checkedSet(out, { ref: 'v1.0.0', repo: root }), CHECKED);
  assert.deepEqual(checkedSet(out), CHECKED);
});

test('a missing baseline ref is a BaselineError with the Error Handling message', () => {
  const root = makeRepo(BASE, { tag: null });
  assert.throws(() => assertRef('v1.0.0', root), (e) => e instanceof BaselineError
    && e.message === 'baseline ref v1.0.0 not found: fetch tags (fetch-depth: 0) or create the tag (S9)');
  const tagged = makeRepo(BASE);
  assert.doesNotThrow(() => assertRef('v1.0.0', tagged));
});

test('showAtRef reads a file at the baseline, or null when it did not exist', () => {
  const root = makeRepo(BASE);
  change(root, { 'uc-skill/SKILL.md': 'changed\n' });
  assert.equal(showAtRef('v1.0.0', 'uc-skill/SKILL.md', { repo: root }).toString('utf8'), BASE['uc-skill/SKILL.md']);
  assert.equal(showAtRef('v1.0.0', 'uc-skill/none.md', { repo: root }), null);
  const many = readAtRef('v1.0.0', ['agents/a.md', 'nope.md'], { repo: root });
  assert.equal(many.get('agents/a.md').toString('utf8'), BASE['agents/a.md']);
  assert.equal(many.get('nope.md'), null);
});

test('R5: a name that differs from the baseline fails; a reworded description does not', () => {
  const root = makeRepo(BASE);
  change(root, {
    'bp-skill/SKILL.md': BASE['bp-skill/SKILL.md'].replace('name: bp-skill', 'name: bp-skill-2'),
    'rw-skill/SKILL.md': BASE['rw-skill/SKILL.md'].replace('The rw-skill skill.', 'Reworded for both kinds.'),
  });
  const cur = checkedSet(root);
  const f = nameFindings({ current: currentMap(root, cur), baseline: readAtRef('v1.0.0', cur, { repo: root }) });
  assert.deepEqual(show(f), ['R5 bp-skill/SKILL.md:2 name-changed']);
});

test('R7: an unchanged tree passes', () => {
  const root = makeRepo(BASE);
  assert.deepEqual(r7(root, { converted: ['bp-skill', 'rw-skill'] }), []);
});

test('R7: a UC folder with one changed byte fails, always', () => {
  const root = makeRepo(BASE);
  change(root, { 'uc-skill/SKILL.md': BASE['uc-skill/SKILL.md'].replace('Text.', 'Text!') });
  assert.deepEqual(show(r7(root)), ['R7 uc-skill/SKILL.md:8 unchanged-folder-differs']);
});

test('R7: a UC folder with a file added or removed fails', () => {
  const root = makeRepo(BASE);
  change(root, { 'uc-skill/references/new.md': L('# New'), 'uc-skill/references/u.md': null });
  assert.deepEqual(show(r7(root)).sort(), [
    'R7 uc-skill/references/new.md:1 unchanged-folder-differs',
    'R7 uc-skill/references/u.md:1 unchanged-folder-differs',
  ]);
});

const MOVED = L(
  ...FM('bp-skill', 'Build a thing with its schema.'),
  '',
  '# BP',
  '',
  GATE_TEXT,
  '',
  'Intro.',
  '',
  '## Step 1',
  '',
  SUP,
  'Supabase step text.',
  END,
  ENG,
  'Engine step text.',
  END,
  '',
  '## Step 2',
  '',
  'Shared.',
);

test('R7: a moved-not-rewritten passage passes (Gate and one blank line, description removed)', () => {
  const root = makeRepo(BASE);
  change(root, {
    'bp-skill/SKILL.md': MOVED,
    'bp-skill/references/r.md': L('<!-- buildpad-backend-file: supabase -->', GATE_TEXT, '', '# Ref', '', 'Supabase ref.'),
    'bp-skill/assets/a.ts': L('// buildpad-backend-file: supabase', POINTER_LINE, 'export const a = 1;'),
    'bp-skill/references/engine.md': L('<!-- buildpad-backend-file: engine -->', GATE_TEXT, '', '# Engine ref'),
  });
  assert.deepEqual(r7(root, { converted: ['bp-skill'] }), []);
});

test('R7: supabaseViewParity removes the Gate plus exactly one following blank line', () => {
  const base = L('# BP', '', 'Intro.');
  assert.deepEqual(supabaseViewParity('x/SKILL.md', L('# BP', '', GATE_TEXT, '', 'Intro.'), base), { equal: true, firstDiffLine: null });
  const twoBlanks = supabaseViewParity('x/SKILL.md', L('# BP', '', GATE_TEXT, '', '', 'Intro.'), base);
  assert.equal(twoBlanks.equal, false);
  assert.equal(twoBlanks.firstDiffLine, 34);
});

test('R7: rewritten supabase text fails at its raw line, unless the file has an entry', () => {
  const root = makeRepo(BASE);
  change(root, { 'bp-skill/SKILL.md': MOVED.replace('Supabase step text.', 'Supabase step text, rewritten.') });
  assert.deepEqual(show(r7(root, { converted: ['bp-skill'] })), ['R7 bp-skill/SKILL.md:44 supabase-view-differs']);
  assert.deepEqual(r7(root, { converted: ['bp-skill'], listed: ['bp-skill/SKILL.md'] }), []);
});

test('R7: a reworded file fails without its entry and passes with it', () => {
  const root = makeRepo(BASE);
  change(root, { 'rw-skill/SKILL.md': BASE['rw-skill/SKILL.md'].replace('Old wording.', 'On an Engine project, new wording.') });
  assert.deepEqual(show(r7(root, { converted: ['rw-skill'] })), ['R7 rw-skill/SKILL.md:8 supabase-view-differs']);
  assert.deepEqual(r7(root, { converted: ['rw-skill'], listed: ['rw-skill/SKILL.md'] }), []);
});

test('R7: a new file in the Supabase view needs an entry; a new Engine-only file does not', () => {
  const root = makeRepo(BASE);
  change(root, {
    'bp-skill/references/shared-new.md': L('# Shared new'),
    'bp-skill/references/engine-new.md': L('<!-- buildpad-backend-file: engine -->', GATE_TEXT, '', '# Engine'),
  });
  assert.deepEqual(show(r7(root, { converted: ['bp-skill'] })), ['R7 bp-skill/references/shared-new.md:1 new-file-unlisted']);
  assert.deepEqual(r7(root, { converted: ['bp-skill'], listed: ['bp-skill/references/shared-new.md'] }), []);
});

test('R7: a baseline file removed from the Supabase view needs an entry', () => {
  const root = makeRepo(BASE);
  change(root, { 'bp-skill/references/r.md': null });
  assert.deepEqual(show(r7(root, { converted: ['bp-skill'] })), ['R7 bp-skill/references/r.md:1 file-removed-unlisted']);
});

test('R7: an unconverted folder that is not UC fails nothing', () => {
  const root = makeRepo(BASE);
  change(root, {
    'rw-skill/SKILL.md': L('# Rewritten completely'),
    'bp-skill/references/r.md': null,
    'bp-skill/references/new.md': L('# New'),
  });
  assert.deepEqual(r7(root), []);
});
