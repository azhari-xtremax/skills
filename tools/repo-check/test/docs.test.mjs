// CONTRIBUTING.md and CHANGELOG.md at the root (task 3.2). Both sit outside the checked set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { changelogSections } from '../lib/release.mjs';
import { GATE_TEXT, POINTER_LINE } from '../lib/gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

test('CHANGELOG.md holds the v1.0.0 section, naming the Baseline_Revision, and no other', () => {
  const changelog = read('CHANGELOG.md');
  const sections = changelogSections(changelog);
  assert.deepEqual([...sections.keys()], ['v1.0.0']);
  assert.match(sections.get('v1.0.0').body, /Baseline_Revision/);
  assert.match(sections.get('v1.0.0').body, /7ed910f/);
  assert.match(changelog, /Supabase projects/);
});

test('CONTRIBUTING.md documents every topic of task 3.2', () => {
  const c = read('CONTRIBUTING.md');
  // §C13 marker forms (S6).
  for (const form of [
    '<!-- buildpad-backend: engine -->', '<!-- buildpad-backend: supabase -->', '<!-- /buildpad-backend -->',
    '// buildpad-backend: supabase', '// /buildpad-backend', '<!-- buildpad-backend-file: engine -->',
    '// buildpad-backend-file: supabase', 'engine-only', 'supabase-only',
  ]) assert.ok(c.includes(form), form);
  // Authoring rules (S6) and the issue codes R2 reports.
  for (const code of ['straddles-fence', 'marker-in-table', 'gap-between-passages', 'malformed-marker', 'marker-in-front-matter']) {
    assert.ok(c.includes(code), code);
  }
  // The Gate and its placement (S4), the Pointer (S5).
  assert.ok(c.includes('tools/repo-check/gate.md'));
  assert.ok(c.includes(GATE_TEXT.split('\n')[0]));
  assert.match(c, /## The Gate/);
  assert.match(c, /### Where the Gate goes/);
  assert.ok(c.includes(POINTER_LINE));
  // The Engine statement set.
  for (let n = 1; n <= 16; n++) assert.match(c, new RegExp(`\\| ES-${n}[nm]? \\|`), `ES-${n}`);
  assert.match(c, /### Engine runtime \(ES-10\)/);
  // Change files and converted files.
  assert.ok(c.includes('tools/repo-check/supabase-view-changes/<folder>.json'));
  assert.ok(c.includes('tools/repo-check/converted/<folder>'));
  // Platform fields named otherwise in Engine text.
  assert.ok(c.includes('`authUrl`') && c.includes('`publicKey`'));
  // How to add a Skill.
  assert.match(c, /## Add a skill/);
  assert.ok(c.includes('tools/repo-check/skill-map.json'));
  assert.match(c, /Requirements 1 to 4/);
  // How to run the check.
  assert.ok(c.includes('node --test "tools/repo-check/test/*.test.mjs"'));
  assert.ok(c.includes('node tools/repo-check/check.mjs'));
});
