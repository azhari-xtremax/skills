import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractLinks, resolveTarget, resolves, makeView, isRecordedBreak, isRelativeTarget } from '../lib/links.mjs';
import { stripBackendPassages } from '../lib/passages.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const contract = JSON.parse(readFileSync(path.join(here, '..', 'contract', 'backend-contract.json'), 'utf8'));
const cases = JSON.parse(readFileSync(path.join(here, '..', 'contract', 'cases.json'), 'utf8'));
const L = (...ls) => ls.join('\n') + '\n';

test('every linkCases entry of cases.json gives its expected links', () => {
  for (const c of cases.linkCases) {
    assert.deepEqual(extractLinks(c.text), c.links, c.name);
  }
});

test('inline and reference-style links, with anchors', () => {
  const text = L(
    'See [one](./one.md#part) and ![two](../b/two.png "t").',
    '[three][3]',
    '',
    '[3]: ../c/SKILL.md',
    '   [4]: <./four.md> "Four"',
  );
  assert.deepEqual(extractLinks(text), [
    { line: 1, target: './one.md#part' },
    { line: 1, target: '../b/two.png' },
    { line: 4, target: '../c/SKILL.md' },
    { line: 5, target: './four.md' },
  ]);
});

test('relative targets only', () => {
  assert.ok(isRelativeTarget('./a.md'));
  assert.ok(isRelativeTarget('a/b.md'));
  assert.ok(isRelativeTarget('../x/SKILL.md#y'));
  for (const t of ['https://x.io', 'http://x', 'mailto:a@b.c', '#anchor', '/abs.md', '', 'tel:1']) {
    assert.ok(!isRelativeTarget(t), t);
  }
});

test('generate-docs: links inside its four-backtick fences are not links', () => {
  const file = 'generate-docs/references/documentation.instructions.md';
  const text = readFileSync(path.join(repoRoot, file), 'utf8');
  const linkLines = new Set(extractLinks(text).map((l) => l.line));
  for (const n of [245, 286, 287, 413]) assert.ok(!linkLines.has(n), `line ${n} is inside a fence`);
  for (const n of [190, 191, 320, 321]) assert.ok(linkLines.has(n), `line ${n} is a link`);
});

test('resolution in a view: files, folders, anchors, and leaving the repository', () => {
  const view = makeView(['a/SKILL.md', 'a/references/r.md', 'b/SKILL.md', 'b/assets/x.ts']);
  assert.equal(resolveTarget('a/SKILL.md', './references/r.md#top'), 'a/references/r.md');
  assert.equal(resolveTarget('a/references/r.md', '../../b/SKILL.md'), 'b/SKILL.md');
  assert.equal(resolveTarget('a/SKILL.md', '../../references/x.md'), null);
  assert.equal(resolveTarget('a/SKILL.md', '../b/my%20file.md'), 'b/my file.md');
  assert.ok(resolves('a/SKILL.md', './references/r.md', view));
  assert.ok(resolves('a/references/r.md', '../../b/SKILL.md', view));
  assert.ok(!resolves('a/SKILL.md', '../../references/x.md', view));
  assert.ok(resolves('a/SKILL.md', '../b', view));
  assert.ok(resolves('a/SKILL.md', '../b/', view));
  assert.ok(resolves('a/SKILL.md', '../b/assets', view));
  assert.ok(!resolves('a/SKILL.md', '../c/SKILL.md', view));
  assert.ok(resolves('a/SKILL.md', './SKILL.md#step', view));
  // A plain Set of paths is accepted as a view.
  assert.ok(resolves('a/SKILL.md', './SKILL.md', new Set(['a/SKILL.md'])));
  assert.ok(!resolves('a/SKILL.md', './OTHER.md', new Set(['a/SKILL.md'])));
});

test('a target removed in one view resolves in the other only', () => {
  const engine = makeView(['a/SKILL.md', 'b/SKILL.md', 'b/references/engine.md']);
  const supabase = makeView(['a/SKILL.md', 'b/SKILL.md', 'b/references/supabase.md']);
  assert.ok(resolves('a/SKILL.md', '../b/references/supabase.md', supabase));
  assert.ok(!resolves('a/SKILL.md', '../b/references/supabase.md', engine));
});

test('a link in one view only is extracted from that view only', () => {
  const raw = L(
    '# A',
    '<!-- buildpad-backend: supabase -->',
    'See [api routes](../create-api-route/references/api-routes.instructions.md).',
    '<!-- /buildpad-backend -->',
    '<!-- buildpad-backend: engine -->',
    'See [create-api-route](../create-api-route/SKILL.md).',
    '<!-- /buildpad-backend -->',
  );
  const sup = extractLinks(stripBackendPassages(raw, 'supabase').text).map((l) => l.target);
  const eng = extractLinks(stripBackendPassages(raw, 'engine').text).map((l) => l.target);
  assert.deepEqual(sup, ['../create-api-route/references/api-routes.instructions.md']);
  assert.deepEqual(eng, ['../create-api-route/SKILL.md']);
});

test('each of the seven recorded breaks is matched by file and target', () => {
  assert.equal(contract.recordedLinkBreaks.length, 7);
  for (const b of contract.recordedLinkBreaks) {
    assert.ok(isRecordedBreak(b.file, b.target, 'repository'), `${b.file} ${b.target}`);
    assert.ok(!isRecordedBreak(b.file, `${b.target}x`, 'repository'));
    assert.ok(!isRecordedBreak(`x/${b.file}`, b.target, 'repository'));
  }
  // Layout lists are honoured.
  assert.ok(isRecordedBreak('create-rbac/SKILL.md', '../../references/module-access-checklist.md', 'kiro'));
  assert.ok(!isRecordedBreak('create-rbac/SKILL.md', '../../references/module-access-checklist.md', 'vscode'));
  assert.ok(isRecordedBreak('generate-docs/references/documentation.instructions.md', './related1.md', 'vscode'));
});

test('the recorded breaks are the only unresolved relative links of generate-docs', () => {
  const file = 'generate-docs/references/documentation.instructions.md';
  const text = readFileSync(path.join(repoRoot, file), 'utf8');
  const view = makeView([file]);
  const broken = extractLinks(text).filter((l) => !resolves(file, l.target, view));
  assert.ok(broken.length > 0);
  for (const l of broken) assert.ok(isRecordedBreak(file, l.target, 'repository'), `${l.line} ${l.target}`);
});

test('a recorded break whose link is gone matches nothing and fails nothing', () => {
  const file = 'relational-permissions/SKILL.md';
  const text = L('# Relational permissions', 'The dead link was removed.');
  const view = makeView([file]);
  const broken = extractLinks(text).filter((l) => !resolves(file, l.target, view));
  assert.deepEqual(broken, []);
  // The entry still exists, but it only excuses that exact file and target.
  assert.ok(isRecordedBreak(file, '../../microbuild-supabase-users/docs/RELATIONAL_PERMISSIONS.md', 'repository'));
  assert.ok(!isRecordedBreak(file, './other.md', 'repository'));
});
