import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GATE_TEXT, POINTER_LINE, gateIssues, gateFindings } from '../lib/gate.mjs';
import { scanView } from '../lib/guard.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const gateFile = readFileSync(path.join(here, '..', 'gate.md'), 'utf8');
const L = (...ls) => ls.join('\n') + '\n';
const O = '<!-- buildpad-backend: engine -->';
const OS = '<!-- buildpad-backend: supabase -->';
const C = '<!-- /buildpad-backend -->';
const FM = ['---', 'name: x', 'description: y', '---'];
const G = GATE_TEXT;
const codes = (issues) => issues.map((i) => `${i.line}:${i.code}`);
const skill = (entries) => new Map(Object.entries(entries));

test('gate.md is the S3 block: sentinels, four steps, no-secrets paragraph, parts, stop sentence', () => {
  const ls = gateFile.split('\n');
  assert.equal(ls[0], '<!-- backend-gate:begin v1 -->');
  assert.equal(ls.at(-2), '<!-- backend-gate:end -->');
  assert.equal(ls.at(-1), '', 'ends with one newline');
  assert.equal(gateFile.replace(/\n$/, ''), GATE_TEXT);
  assert.ok(!gateFile.includes('\r'));
  for (const n of ['1. ', '2. ', '3. ', '4. ']) assert.ok(ls.some((l) => l.startsWith(n)), n);
  assert.match(gateFile, /do not open an environment file/);
  assert.match(gateFile, /A part starts at a line that holds only a comment/);
  assert.match(gateFile, /tell the developer so and stop: do not build a substitute\./);
});

test('gate.md gives no guard finding and holds no marker token', () => {
  assert.deepEqual(scanView('x/SKILL.md', gateFile), []);
  assert.ok(!gateFile.includes('buildpad-backend'));
});

test('the Gate present after front matter, and after the first H1', () => {
  const afterFm = L(...FM, '', G, '', '# Title', OS, 'sup', C);
  assert.deepEqual(gateIssues('x/SKILL.md', afterFm, skill({ 'x/SKILL.md': afterFm })), []);
  const afterH1 = L(...FM, '', '# Title', '', G, '', OS, 'sup', C);
  assert.deepEqual(gateIssues('x/SKILL.md', afterH1, skill({ 'x/SKILL.md': afterH1 })), []);
});

test('the Gate absent from a file with a passage', () => {
  const text = L(...FM, '', '# Title', OS, 'sup', C);
  assert.deepEqual(codes(gateIssues('x/SKILL.md', text, skill({ 'x/SKILL.md': text }))), ['1:gate-missing']);
});

test('the Gate altered by one character', () => {
  const altered = G.replace('Establish the backend first.', 'Establish the backend first!');
  const text = L(...FM, '', altered, '', OS, 'sup', C);
  assert.deepEqual(codes(gateIssues('x/SKILL.md', text, skill({ 'x/SKILL.md': text }))), ['6:gate-altered']);
});

test('line endings are normalised before the byte comparison', () => {
  const text = L(...FM, '', G, '', OS, 'sup', C).replaceAll('\n', '\r\n');
  assert.deepEqual(gateIssues('x/SKILL.md', text, skill({ 'x/SKILL.md': text })), []);
});

test('the Gate after the first opener is misplaced', () => {
  const text = L(...FM, '', '# Title', OS, 'sup', C, '', G);
  assert.deepEqual(codes(gateIssues('x/SKILL.md', text, skill({ 'x/SKILL.md': text }))), ['11:gate-misplaced']);
  const later = L(...FM, '', '# Title', '', 'Intro text.', '', G, OS, 'sup', C);
  assert.deepEqual(codes(gateIssues('x/SKILL.md', later, skill({ 'x/SKILL.md': later }))), ['10:gate-misplaced']);
});

test('two copies of the Gate', () => {
  const text = L(...FM, '', G, '', OS, 'sup', C, '', G);
  assert.ok(codes(gateIssues('x/SKILL.md', text, skill({ 'x/SKILL.md': text }))).some((c) => c.endsWith(':gate-duplicate')));
});

test('a file with a file marker carries the marker, then the Gate', () => {
  const ok = L(...FM, '', '<!-- buildpad-backend-file: supabase -->', G, '', '# Ref');
  assert.deepEqual(gateIssues('x/references/r.md', ok, skill({ 'x/references/r.md': ok })), []);
  const blankBetween = L('<!-- buildpad-backend-file: engine -->', '', G, '', '# Ref');
  assert.deepEqual(gateIssues('x/references/r.md', blankBetween, skill({ 'x/references/r.md': blankBetween })), []);
  const wrong = L('<!-- buildpad-backend-file: engine -->', '# Ref', '', G);
  assert.deepEqual(codes(gateIssues('x/references/r.md', wrong, skill({ 'x/references/r.md': wrong }))), ['4:gate-misplaced']);
  const none = L('<!-- buildpad-backend-file: engine -->', '# Ref');
  assert.deepEqual(codes(gateIssues('x/references/r.md', none, skill({ 'x/references/r.md': none }))), ['1:gate-missing']);
});

test('a SKILL.md needs the Gate when any file of its Skill holds a passage, a file marker or an *-only folder', () => {
  const skillMd = L(...FM, '', '# Title', 'Shared only.');
  const ref = L('<!-- buildpad-backend-file: engine -->', G, '', '# Engine ref');
  assert.deepEqual(codes(gateIssues('x/SKILL.md', skillMd, skill({ 'x/SKILL.md': skillMd, 'x/references/e.md': ref }))), ['1:gate-missing']);
  const onlyDir = skill({ 'x/SKILL.md': skillMd, 'x/assets/engine-only/c.json': '{}' });
  assert.deepEqual(codes(gateIssues('x/SKILL.md', skillMd, onlyDir)), ['1:gate-missing']);
  assert.deepEqual(gateIssues('x/SKILL.md', skillMd, skill({ 'x/SKILL.md': skillMd })), []);
});

test('a SKILL.md with no passage needs the Gate when the plan says so (RW+G)', () => {
  const skillMd = L(...FM, '', '# Steering', 'Shared only.');
  assert.deepEqual(codes(gateIssues('x/SKILL.md', skillMd, skill({ 'x/SKILL.md': skillMd }), { requireGate: true })), ['1:gate-missing']);
  const gated = L(...FM, '', '# Steering', '', G, '', 'Shared only.');
  assert.deepEqual(gateIssues('x/SKILL.md', gated, skill({ 'x/SKILL.md': gated }), { requireGate: true }), []);
});

test('the Gate in a persona and in a top-level reference', () => {
  const persona = L('---', 'name: security-auditor', 'description: d', '---', '', '# Auditor', OS, 'sup', C);
  assert.deepEqual(codes(gateIssues('agents/security-auditor.md', persona, skill({ 'agents/security-auditor.md': persona }))), ['1:gate-missing']);
  const personaOk = L('---', 'name: security-auditor', 'description: d', '---', '', G, '', '# Auditor', OS, 'sup', C);
  assert.deepEqual(gateIssues('agents/security-auditor.md', personaOk, skill({ 'agents/security-auditor.md': personaOk })), []);
  const ref = L('# Security checklist', '', G, '', OS, '- sup', C);
  assert.deepEqual(gateIssues('references/security-checklist.md', ref, skill({ 'references/security-checklist.md': ref })), []);
  // Another persona without a passage needs nothing: agents/ has no SKILL.md.
  const plain = L('---', 'name: test-engineer', 'description: d', '---', '# T');
  assert.deepEqual(gateIssues('agents/test-engineer.md', plain, skill({ 'agents/test-engineer.md': plain, 'agents/security-auditor.md': persona })), []);
});

test('the Pointer in a .ts asset with a passage or a file marker', () => {
  const ok = L(POINTER_LINE, 'import x from "y";', '// buildpad-backend: supabase', 'a();', '// /buildpad-backend');
  assert.deepEqual(gateIssues('x/assets/a.ts', ok, skill({ 'x/assets/a.ts': ok })), []);
  const afterFileMarker = L('// buildpad-backend-file: supabase', POINTER_LINE, 'export {};');
  assert.deepEqual(gateIssues('x/assets/a.tsx', afterFileMarker, skill({ 'x/assets/a.tsx': afterFileMarker })), []);
  const missing = L('// buildpad-backend-file: supabase', 'export {};');
  assert.deepEqual(codes(gateIssues('x/assets/a.ts', missing, skill({ 'x/assets/a.ts': missing }))), ['1:pointer-missing']);
  const misplaced = L('// buildpad-backend-file: supabase', 'export {};', POINTER_LINE);
  assert.deepEqual(codes(gateIssues('x/assets/a.ts', misplaced, skill({ 'x/assets/a.ts': misplaced }))), ['3:pointer-misplaced']);
  const plain = L('export const a = 1;');
  assert.deepEqual(gateIssues('x/assets/b.ts', plain, skill({ 'x/assets/b.ts': plain, 'x/assets/a.ts': ok })), []);
});

const tree = (entries) => new Map(Object.entries(entries));
const gated = (body) => L(...FM, '', G, '', ...body);

test('a link from another Skill to a file under assets/ fails', () => {
  const files = tree({
    'a/SKILL.md': L(...FM, '# A', 'Use [the asset](../b/assets/x.ts).'),
    'b/SKILL.md': L(...FM, '# B', 'Use [the asset](./assets/x.ts).'),
    'b/assets/x.ts': L('export {};'),
  });
  const f = gateFindings(files, { converted: new Set(['a', 'b']) });
  assert.deepEqual(f.map((x) => `${x.path}:${x.line}:${x.code}`), ['a/SKILL.md:6:link-into-assets']);
});

test('a comment-less *-only file linked from another Skill or from text of the other kind fails', () => {
  const files = tree({
    'b/SKILL.md': gated([
      '# B',
      OS,
      'See [config](./assets/engine-only/config.json).',
      C,
      O,
      'See [config](./assets/engine-only/config.json).',
      C,
    ]),
    'b/assets/engine-only/config.json': '{}\n',
    'a/SKILL.md': L(...FM, '# A', 'See [config](../b/assets/engine-only/config.json).'),
  });
  const f = gateFindings(files, { converted: new Set(['a', 'b']) });
  assert.deepEqual(f.map((x) => `${x.path}:${x.line}:${x.code}`).sort(), [
    'a/SKILL.md:6:link-into-assets',
    'a/SKILL.md:6:link-to-only-file',
    'b/SKILL.md:39:link-to-only-file',
  ]);
});

test('an unconverted folder fails nothing', () => {
  const files = tree({
    'x/SKILL.md': L(...FM, '# X', OS, 'sup', C),
    'x/assets/a.ts': L('// buildpad-backend-file: supabase', 'export {};'),
    'y/SKILL.md': L(...FM, '# Y', 'See [the asset](../x/assets/a.ts).'),
  });
  assert.deepEqual(gateFindings(files, { converted: new Set() }), []);
  const converted = gateFindings(files, { converted: new Set(['x']) });
  assert.deepEqual(converted.map((x) => `${x.path}:${x.code}`).sort(), [
    'x/SKILL.md:gate-missing',
    'x/assets/a.ts:pointer-missing',
    'y/SKILL.md:link-into-assets',
  ]);
});

test('gateFindings applies requireGate to the folders named', () => {
  const files = tree({ 's/SKILL.md': L(...FM, '# S', 'Shared only.') });
  assert.deepEqual(gateFindings(files, { converted: new Set(['s']) }), []);
  assert.deepEqual(
    gateFindings(files, { converted: new Set(['s']), gateRequired: new Set(['s']) }).map((x) => x.code),
    ['gate-missing'],
  );
});
