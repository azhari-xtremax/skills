import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { templateIssues, isTemplatePath } from '../lib/map.mjs';
import { checkedSet } from '../lib/checked-set.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const show = (fs) => fs.map((f) => `${f.rule} ${f.path}:${f.line} ${f.code}`);
const run = (files) => templateIssues(Object.keys(files), new Map(Object.entries(files)));

test('R8: which paths are Specification_Templates or copied rules', () => {
  assert.ok(isTemplatePath('buildpad-spec-init/settings-templates/specs/design.md'));
  assert.ok(isTemplatePath('buildpad-steering-custom/settings-templates/steering-custom/database.md'));
  assert.ok(isTemplatePath('any-skill/settings-templates/x/y.json'));
  assert.ok(isTemplatePath('buildpad-spec-design/rules/design-principles.md'));
  assert.ok(isTemplatePath('buildpad-steering/rules/steering-principles.md'));
  assert.ok(isTemplatePath('buildpad-steering-custom/rules/steering-principles.md'));
  assert.ok(!isTemplatePath('buildpad-validate-gap/rules/gap-analysis.md'));
  assert.ok(!isTemplatePath('buildpad-spec-design/SKILL.md'));
  assert.ok(!isTemplatePath('create-rbac/references/rules.md'));
});

test('R8: a Supabase statement in a template fails, case-insensitively', () => {
  const f = run({ 'buildpad-steering/settings-templates/steering/tech.md': 'Stack\nBackend: SupaBase\n' });
  assert.deepEqual(show(f), ['R8 buildpad-steering/settings-templates/steering/tech.md:2 supabase-in-template']);
});

test('R8: a §C20 pattern in copied rules fails', () => {
  const f = run({ 'buildpad-spec-tasks/rules/tasks-generation.md': 'x\nCall db.rpc("f")\n' });
  assert.deepEqual(show(f), ['R8 buildpad-spec-tasks/rules/tasks-generation.md:2 guard-pattern-in-template']);
  assert.match(f[0].message, /rpc/);
});

test('R8: neutral templates and files outside the scope pass', () => {
  assert.deepEqual(run({
    'buildpad-steering-custom/settings-templates/steering-custom/database.md': 'Immutable migrations; always add rollback\n',
    'buildpad-validate-gap/rules/gap-analysis.md': 'supabase\n',
    'create-migration/SKILL.md': 'supabase/migrations/\n',
  }), []);
});

test('R9: a subfolder under the top-level references/ fails once per subfolder', () => {
  const f = templateIssues(['references/a.md', 'references/sub/x.md', 'references/sub/y.md', 'create-rbac/references/deep/z.md'], new Map());
  assert.deepEqual(show(f), ['R9 references/sub/x.md:1 references-subfolder']);
});

test('R8 and R9 pass on this repository', () => {
  const paths = checkedSet(repoRoot);
  const texts = new Map(paths.filter(isTemplatePath).map((p) => [p, readFileSync(path.join(repoRoot, p), 'utf8')]));
  assert.deepEqual(templateIssues(paths, texts), []);
});
