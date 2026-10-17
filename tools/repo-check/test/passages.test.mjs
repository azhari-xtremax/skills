import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  MARKER_REGEX,
  parseMarker,
  validateMarkers,
  validateMarkerPlacement,
  fileBackend,
  stripBackendPassages,
  authoringIssues,
  lineKinds,
} from '../lib/passages.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(path.join(here, '..', 'contract', 'backend-contract.json'), 'utf8'));
const cases = JSON.parse(readFileSync(path.join(here, '..', 'contract', 'cases.json'), 'utf8'));

const O = '<!-- buildpad-backend: engine -->';
const OS = '<!-- buildpad-backend: supabase -->';
const C = '<!-- /buildpad-backend -->';
const L = (...lines) => lines.join('\n') + '\n';
const codes = (issues) => issues.map((i) => `${i.line}:${i.code}`);

test('the marker regex is the contract regex, verbatim', () => {
  assert.equal(MARKER_REGEX.source, new RegExp(contract.markerRegex).source);
  assert.equal(MARKER_REGEX.flags, '');
});

test('each comment opener is accepted in each file type', () => {
  const forms = [
    ['<!-- buildpad-backend: engine -->', '<!-- /buildpad-backend -->'],
    ['// buildpad-backend: engine', '// /buildpad-backend'],
    ['# buildpad-backend: engine', '# /buildpad-backend'],
    ['-- buildpad-backend: engine', '-- /buildpad-backend'],
    ['/* buildpad-backend: engine */', '/* /buildpad-backend */'],
  ];
  for (const file of ['x/SKILL.md', 'x/assets/a.ts', 'x/assets/a.tsx', 'x/assets/a.sql', 'x/assets/a.sh']) {
    for (const [open, close] of forms) {
      const text = L('first', open, 'engine', close, 'last');
      assert.deepEqual(validateMarkers(text), [], `${file} ${open}`);
      assert.deepEqual(validateMarkerPlacement(file, text), [], `${file} ${open}`);
      assert.equal(stripBackendPassages(text, 'supabase').text, L('first', 'last'), `${file} ${open}`);
      assert.equal(stripBackendPassages(text, 'engine').text, L('first', 'engine', 'last'), `${file} ${open}`);
    }
  }
});

test('parseMarker reads openers, closers and file markers', () => {
  assert.deepEqual(parseMarker(O), { type: 'open', kind: 'engine' });
  assert.deepEqual(parseMarker('// buildpad-backend: supabase\r'), { type: 'open', kind: 'supabase' });
  assert.deepEqual(parseMarker(C), { type: 'close', kind: null });
  assert.deepEqual(parseMarker('<!-- buildpad-backend-file: engine -->'), { type: 'file', kind: 'engine' });
  assert.equal(parseMarker('plain text'), null);
  assert.equal(parseMarker('mentions buildpad-backend in prose'), null);
});

test('every markerCases entry of cases.json gives its expected issues', () => {
  for (const c of cases.markerCases) {
    const got = [...validateMarkers(c.text), ...validateMarkerPlacement(c.path, c.text)]
      .sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
    const want = [...c.issues].sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
    assert.deepEqual(got.map(({ line, code }) => ({ line, code })), want, c.name);
  }
});

test('a whole-line marker inside a fence counts', () => {
  const text = L('```md', O, 'x', C, '```');
  assert.deepEqual(validateMarkers(text), []);
  assert.equal(stripBackendPassages(text, 'supabase').text, L('```md', '```'));
});

test('each MarkerIssue code is reported with its line', () => {
  assert.deepEqual(codes(validateMarkers(L('text buildpad-backend text'))), ['1:malformed-marker']);
  assert.deepEqual(codes(validateMarkers(L('<!-- buildpad-backend: other -->', C))), ['1:unknown-kind']);
  assert.deepEqual(codes(validateMarkers(L(O, O, C, C))), ['2:nested']);
  assert.deepEqual(codes(validateMarkers(L('a', O))), ['2:unpaired-open']);
  assert.deepEqual(codes(validateMarkers(L('a', 'b', C))), ['3:unpaired-close']);
  assert.deepEqual(codes(validateMarkers(L(O, 'kiro-steering: x', C))), ['2:straddles-steering']);
  assert.deepEqual(codes(validateMarkers(L('a', '<!-- buildpad-backend-file: engine -->'))), ['2:misplaced-file-marker']);
  assert.deepEqual(
    codes(validateMarkerPlacement('x/supabase-only/a.ts', L('// buildpad-backend-file: supabase'))),
    ['1:misplaced-file-marker'],
  );
  assert.deepEqual(
    codes(validateMarkers(L('<!-- buildpad-backend-file: engine -->', '<!-- buildpad-backend-file: engine -->'))),
    ['2:conflicting-scope'],
  );
  assert.deepEqual(codes(validateMarkers(L('---', `x: ${O}`, '---'))), ['2:marker-in-front-matter']);
});

test('a file marker on line 1 and after front matter', () => {
  const first = L('// buildpad-backend-file: supabase', 'export const a = 1;');
  assert.deepEqual(validateMarkers(first), []);
  assert.equal(fileBackend('x/assets/a.ts', first), 'supabase');
  const afterFm = L('---', 'name: a', 'description: b', '---', '', '<!-- buildpad-backend-file: engine -->', '# A');
  assert.deepEqual(validateMarkers(afterFm), []);
  assert.equal(fileBackend('x/references/a.md', afterFm), 'engine');
  assert.equal(fileBackend('x/references/a.md', L('# A', 'b')), null);
});

test('a kiro-style copy (front matter and a blank line prepended) keeps its file marker valid', () => {
  const original = L('<!-- buildpad-backend-file: engine -->', '# Engine checklist');
  const kiro = L('---', 'inclusion: always', '---', '') + original;
  assert.deepEqual(validateMarkers(kiro), []);
  assert.equal(fileBackend('.kiro/steering/a.md', kiro), 'engine');
  assert.equal(stripBackendPassages(kiro, 'engine').text, L('---', 'inclusion: always', '---', '', '# Engine checklist'));
});

test('*-only folders give a file its backend by the directory rule', () => {
  assert.equal(fileBackend('x/assets/engine-only/config.json', '{}'), 'engine');
  assert.equal(fileBackend('x/supabase-only/a.md', '# A'), 'supabase');
  assert.equal(fileBackend('x/supabase-only/a.json', null), 'supabase');
  assert.equal(fileBackend('x/engine-only-notes/a.md', '# A'), null);
  assert.equal(fileBackend('x/assets/a.json', null), null);
  assert.deepEqual(validateMarkerPlacement('x/engine-only/a.md', L('# A', O, 'x', C)), []);
});

test('line endings are kept per file (CRLF)', () => {
  const text = `a\r\n${O}\r\nengine\r\n${C}\r\n${OS}\r\nsupabase\r\n${C}\r\nb\r\n`;
  assert.deepEqual(validateMarkers(text), []);
  assert.equal(stripBackendPassages(text, 'engine').text, 'a\r\nengine\r\nb\r\n');
  assert.equal(stripBackendPassages(text, 'supabase').text, 'a\r\nsupabase\r\nb\r\n');
});

test('a file with no marker is unchanged in both views', () => {
  const text = 'a\n\n```\ncode\n```\nno trailing newline';
  for (const keep of ['engine', 'supabase']) {
    const r = stripBackendPassages(text, keep);
    assert.equal(r.text, text);
    assert.equal(r.removed, 0);
  }
});

test('stripping removes the other kind and every marker line, and counts passages removed', () => {
  const text = L('# T', OS, 'sup 1', C, O, 'eng 1', C, 'shared', OS, 'sup 2', C);
  assert.deepEqual(stripBackendPassages(text, 'engine'), { text: L('# T', 'eng 1', 'shared'), removed: 2 });
  assert.deepEqual(stripBackendPassages(text, 'supabase'), { text: L('# T', 'sup 1', 'shared', 'sup 2'), removed: 1 });
  const fileMarked = L('<!-- buildpad-backend-file: supabase -->', '# S');
  assert.equal(stripBackendPassages(fileMarked, 'supabase').text, L('# S'));
});

test('lineKinds gives each line its passage kind or the file kind', () => {
  assert.deepEqual(lineKinds(L('a', O, 'b', C, 'c')), [null, 'engine', 'engine', 'engine', null, null]);
  assert.deepEqual(lineKinds(L('<!-- buildpad-backend-file: supabase -->', 'a')), ['supabase', 'supabase', 'supabase']);
});

test('straddles-fence: a marker line inside a fenced block', () => {
  assert.deepEqual(codes(authoringIssues(L(O, '```ts', 'x', C, '```'))), ['4:straddles-fence']);
  assert.deepEqual(codes(authoringIssues(L('```ts', O, '```', 'x', C))), ['2:straddles-fence']);
  assert.deepEqual(codes(authoringIssues(L('````md', '```', O, '```', '````', C))), ['3:straddles-fence']);
});

test('marker-in-table: a marker line between two table rows', () => {
  const text = L('| a | b |', '|---|---|', O, '| 1 | 2 |', C, '| 3 | 4 |');
  assert.deepEqual(codes(authoringIssues(text)), ['3:marker-in-table', '5:marker-in-table']);
});

test('a passage that ends at a fence or a table on its last line passes', () => {
  assert.deepEqual(authoringIssues(L('# T', O, '```ts', 'x', '```', C, 'after')), []);
  assert.deepEqual(authoringIssues(L('# T', O, '| a |', '|---|', '| 1 |', C, 'after')), []);
  assert.deepEqual(authoringIssues(L('| a |', '|---|', OS, 'x', C)), []);
});

test('gap-between-passages: a blank line between a closer and the opener that replaces it', () => {
  assert.deepEqual(codes(authoringIssues(L(OS, 'sup', C, '', O, 'eng', C))), ['5:gap-between-passages']);
  assert.deepEqual(authoringIssues(L(OS, 'sup', C, O, 'eng', C)), []);
  // Two passages of the same kind separated by shared text or a blank line do not replace each other.
  assert.deepEqual(authoringIssues(L(O, 'a', C, '', O, 'b', C)), []);
  assert.deepEqual(authoringIssues(L(OS, 'a', C, 'shared', O, 'b', C)), []);
});

test('fence and table rules apply to Markdown only; the gap rule to every file', () => {
  const ts = L('// buildpad-backend: supabase', 'const a = `', '```', '`;', '// /buildpad-backend', '', '// buildpad-backend: engine', 'x', '// /buildpad-backend');
  assert.deepEqual(codes(authoringIssues(ts, 'x/assets/a.ts')), ['7:gap-between-passages']);
});
