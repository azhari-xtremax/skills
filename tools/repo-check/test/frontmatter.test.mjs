import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frontMatterIssues, frontMatterFields, isNameBearing } from '../lib/frontmatter.mjs';

const L = (...ls) => ls.join('\n') + '\n';
const show = (fs) => fs.map((f) => `${f.line}:${f.code}`);

test('R5 applies to SKILL.md files and agents/*.md', () => {
  assert.ok(isNameBearing('create-project/SKILL.md'));
  assert.ok(isNameBearing('agents/code-reviewer.md'));
  assert.ok(!isNameBearing('create-project/references/a.md'));
  assert.ok(!isNameBearing('references/security-checklist.md'));
  assert.ok(!isNameBearing('agents/sub/x.md'));
});

test('front matter with name and description passes in the raw file and both views', () => {
  const text = L('---', 'name: x', 'description: Does x.', '---', '', '# X', '<!-- buildpad-backend: engine -->', 'e', '<!-- /buildpad-backend -->');
  assert.deepEqual(frontMatterIssues('x/SKILL.md', text), []);
  assert.deepEqual(frontMatterIssues('agents/a.md', text), []);
});

test('a missing name, an empty description, and no front matter', () => {
  assert.deepEqual(show(frontMatterIssues('x/SKILL.md', L('---', 'description: d', '---'))), ['1:name-missing']);
  assert.deepEqual(show(frontMatterIssues('x/SKILL.md', L('---', 'name: x', 'description:', '---'))), ['3:description-missing']);
  assert.deepEqual(show(frontMatterIssues('x/SKILL.md', L('---', 'name: x', 'description: ""', '---'))), ['3:description-missing']);
  assert.deepEqual(show(frontMatterIssues('agents/a.md', L('# No front matter'))), ['1:front-matter-missing']);
});

test('block-scalar and quoted descriptions are read', () => {
  const folded = L('---', 'name: x', 'description: >', '  Folded text', '  on two lines.', 'argument-hint: "[a]"', '---');
  assert.deepEqual(frontMatterIssues('x/SKILL.md', folded), []);
  assert.equal(frontMatterFields(folded.split('\n')).get('description').value, 'Folded text on two lines.');
  assert.equal(frontMatterFields(L('---', "name: 'x'", '---').split('\n')).get('name').value, 'x');
});

test('a front matter present in one view only fails in the other', () => {
  const text = L('<!-- buildpad-backend: engine -->', '---', 'name: x', 'description: d', '---', '<!-- /buildpad-backend -->', '# X');
  const issues = frontMatterIssues('x/SKILL.md', text);
  assert.deepEqual(issues.map((i) => i.code), ['front-matter-missing']);
  assert.match(issues[0].message, /raw file.*supabase view/);
  assert.doesNotMatch(issues[0].message, /engine view/);
});

test('a file absent from a view is not checked in that view', () => {
  const engineOnly = L('---', 'name: x', 'description: d', '---', '<!-- buildpad-backend-file: engine -->');
  assert.deepEqual(frontMatterIssues('agents/x.md', engineOnly), []);
});
