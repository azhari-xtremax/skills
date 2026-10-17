import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frontMatterIssues, frontMatterFields, frontMatterYamlIssues, frontMatterYamlProblems, isNameBearing } from '../lib/frontmatter.mjs';

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

// R14. `fm(...)` wraps lines in front matter; `bad(...)` is the 1-based lines of its problems.
const fm = (...ls) => ['---', ...ls, '---', '', '# X'];
const bad = (...ls) => frontMatterYamlProblems(fm(...ls)).map((p) => p.line);
const detail = (...ls) => frontMatterYamlProblems(fm(...ls)).map((p) => p.detail).join('; ');

test('R14: the valid forms the repository uses pass', () => {
  assert.deepEqual(bad(
    'name: x',
    'description: Plain text, with commas — and dashes; also a:b, e.g. and C# and 50%.',
    'argument-hint: "[component names or --all] [--cwd path/to/project]"',
    'user-invokable: true',
    'allowed-tools: Read, Bash, Grep, Glob, WebSearch, WebFetch',
  ), []);
  assert.deepEqual(bad('name: x', 'description: "Supabase projects only for now: not yet available on the Engine. Use when \\"x\\"."'), []);
  assert.deepEqual(bad('name: x', "description: 'It''s for now: soon'"), []);
  assert.deepEqual(bad('name: x', 'description: >', '  Folded text: with a colon', '  on two lines # not a comment.', 'other: |-', '  kept'), []);
  assert.deepEqual(bad('name: x', 'argument-hint: <feature-name> [task-numbers]', 'b: <project-description> [--auto]'), []);
  assert.deepEqual(bad('name: x', 'metadata:', '  shared-rules: "a.md, b.md"', '  nested:', '    deeper: true'), []);
  assert.deepEqual(bad('name: x', 'description: A plain value', '  that runs on to a second line.'), []);
  assert.deepEqual(bad('name: x', 'description: "A quoted value', '  on two lines: fine."'), []);
  assert.deepEqual(bad('name: x', 'tags: [a, "b, c", {k: v}]  # a comment', 'empty:', '# a comment line', ''), []);
  assert.deepEqual(bad('name: x', 'tools:', '  - Read', '  - name: y', '    with: z', 'more:', '- at the key\'s indent'), []);
});

test('R14: an unquoted `: ` inside a plain value (the add-microfrontend description)', () => {
  assert.deepEqual(bad('name: x', 'description: Compose micro-apps. Supabase projects only for now: not yet available on the Engine.'), [3]);
  assert.match(detail('name: x', 'description: a: b'), /unquoted `: `/);
  assert.deepEqual(bad('name: x', 'description: ends with a colon:'), [3]);
  assert.deepEqual(bad('name: x', 'description: first line', '  second: line'), [4]);
});

test('R14: a flow sequence followed by more text (the add-microfrontend-zones argument-hint)', () => {
  assert.deepEqual(bad('name: x', 'description: d', 'argument-hint: [microapp name] [path prefix, e.g. /iam]'), [4]);
  assert.match(detail('argument-hint: [microapp name] [path prefix, e.g. /iam]'), /text after the flow collection/);
  assert.match(detail('a: [unclosed, list'), /does not close/);
  assert.match(detail('a: {k: v'), /does not close/);
  assert.match(detail('a: [x}'), /closes nothing open/);
});

test('R14: quoted values must close and hold nothing after the quote', () => {
  assert.match(detail('description: "never closed'), /double-quoted value that does not close/);
  assert.match(detail("description: 'never closed"), /single-quoted value that does not close/);
  assert.match(detail('description: "quoted" then text'), /text after the closing quote/);
  assert.match(detail('description: "a \\d escape"'), /not a YAML escape/);
  assert.match(detail('description: "\\x4"'), /hex digits/);
  assert.deepEqual(bad('description: "a\\tb \\u00e9 \\\\ \\x41" # ok'), []);
});

test('R14: ` #`, keys, indentation and value starts', () => {
  assert.match(detail('description: Use C #sharp'), /starts a comment/);
  assert.match(detail('name: x', 'name: y'), /appears twice/);
  assert.match(detail('name: x', 'just text'), /not a `key: value` line/);
  assert.match(detail('  name: x'), /first key is indented/);
  assert.match(detail('name: x', '\tdescription: d'), /tab in the indentation/);
  assert.match(detail('a:', '    b: 1', '  c: 2'), /matches no key above it/);
  assert.match(detail('a: - b'), /cannot start a value/);
  assert.match(detail('a: @b'), /cannot start with `@`/);
  assert.match(detail('a: &anchor b'), /anchor, alias or tag/);
  assert.match(detail('a: > text'), /block scalar indicator/);
  assert.deepEqual(frontMatterYamlProblems(['# no front matter']), []);
});

test('R14 findings name the line and every place, and skip other files', () => {
  const text = L('---', 'name: x', 'description: only for now: not yet', '---', '# X');
  assert.deepEqual(frontMatterYamlIssues('x/SKILL.md', text).map((f) => `${f.rule} ${f.line}:${f.code}`), ['R14 3:front-matter-not-yaml']);
  assert.match(frontMatterYamlIssues('agents/a.md', text)[0].message, /npx skills add.*\(raw file, engine view, supabase view\)$/);
  assert.deepEqual(frontMatterYamlIssues('x/references/a.md', text), []);
  assert.deepEqual(frontMatterIssues('x/SKILL.md', text), []);
});
