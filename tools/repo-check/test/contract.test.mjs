// R12: pins tools/repo-check/contract/backend-contract.json to a second, literal copy of the
// Platform design's §C13 marker regex and §C20 guard table (design S8, step 1). A change to
// either side is a Revalidation Trigger and needs both edits in one pull request.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const contractDir = path.join(here, '..', 'contract');
const contract = JSON.parse(readFileSync(path.join(contractDir, 'backend-contract.json'), 'utf8'));
const cases = JSON.parse(readFileSync(path.join(contractDir, 'cases.json'), 'utf8'));

// §C13, as printed: "A line is a marker when, after removing a trailing \r, it matches exactly".
const C13_MARKER_REGEX = String.raw`^[ \t]*(?:<!--|//|#|--|/\*)?[ \t]*(/buildpad-backend|buildpad-backend(-file)?:[ \t]*([A-Za-z]+))[ \t]*(?:-->|\*/)?[ \t]*$`;

// §C13 rules, in the order the section names them.
const C13_ISSUE_CODES = [
  'malformed-marker', 'unpaired-open', 'unpaired-close', 'nested', 'unknown-kind',
  'straddles-steering', 'misplaced-file-marker', 'conflicting-scope', 'marker-in-front-matter',
];

// §C20 table, column "Pattern (regex)", copied cell for cell. The table writes `\|` for the
// regex alternation inside Markdown; `unescapeTable` turns it back into `|`.
const C20_TABLE = [
  ['rpc', String.raw`\.rpc\(`],
  ['rest', String.raw`/rest/v1/`],
  ['service-role', String.raw`SUPABASE_SERVICE_ROLE_KEY\|service_role\|serviceRoleKey`],
  ['auth-admin', String.raw`auth\.admin\.`],
  ['client-auth', String.raw`auth\.(updateUser\|exchangeCodeForSession\|verifyOtp\|signInWithOtp\|resetPasswordForEmail)\(`],
  ['stored-supabase', String.raw`createClient\(\s*process\.env\.SUPABASE`],
  ['sql-policy', String.raw`CREATE POLICY\|auth\.uid\(\)\|storage\.objects\|auth\.users`],
  ['migration', String.raw`supabase/migrations/\|supabase (db push\|migration new)`],
  ['storage', String.raw`storage\.(from\|createBucket\|updateBucket)\(`],
  ['service-token-data', String.raw`DAAS_SERVICE_TOKEN\|Bearer \$\{?SERVICE_TOKEN`],
  ['cors-mcp', String.raw`mcp_daas_cors-settings\|"name":\s*"cors-settings"`],
  ['missing-mcp', String.raw`mcp_daas_(smtp-settings\|module_access_keys)\b\|"name":\s*"(smtp-settings\|module_access_keys)"`],
  ['platform-supabase', String.raw`supabaseServiceRoleKey\|supabaseAnonKey\|supabaseUrl`],
];
// §C20 row "path": path matches `(^\|/)supabase/migrations/` or `\.sql$` under a skill.
const C20_PATH_RULE = String.raw`(^\|/)supabase/migrations/`;
const C20_SQL_SUFFIX_RULE = String.raw`\.sql$`;
// §C20 fenced-block rule: a fenced block holding both `credentials:\s*['"]include['"]` and a
// data-API address (`DAAS_URL` or `/items`).
const C20_FENCED_CREDENTIALS = String.raw`credentials:\s*['"]include['"]`;
const C20_FENCED_DATA_API = ['DAAS_URL', '/items'];

// §C13 recorded breaks (design S8), matched by file and target.
const C13_RECORDED_BREAKS = [
  ['create-rbac/SKILL.md', 288, '../../references/module-access-checklist.md', ['repository', 'kiro', 'claude', 'antigravity']],
  ['grant-module-access/SKILL.md', 245, '../../references/module-access-checklist.md', ['repository', 'kiro', 'claude', 'antigravity']],
  ['relational-permissions/SKILL.md', 242, '../../microbuild-supabase-users/docs/RELATIONAL_PERMISSIONS.md', 'all'],
  ['generate-docs/references/documentation.instructions.md', 190, './related1.md', 'all'],
  ['generate-docs/references/documentation.instructions.md', 191, './related2.md', 'all'],
  ['generate-docs/references/documentation.instructions.md', 320, './related1.md', 'all'],
  ['generate-docs/references/documentation.instructions.md', 321, './related2.md', 'all'],
];

const unescapeTable = (cell) => cell.replaceAll('\\|', '|');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('R12: identity of the contract', () => {
  assert.equal(contract.contract, 'buildpad-backend-passages');
  assert.equal(contract.version, 1);
  assert.match(contract.source, /§C13 §C20$/);
});

test('R12: the marker regex equals §C13 character for character', () => {
  assert.equal(contract.markerRegex, C13_MARKER_REGEX);
  assert.doesNotThrow(() => new RegExp(contract.markerRegex));
});

test('R12: token, kinds, directory rule and steering token equal §C13', () => {
  assert.equal(contract.token, 'buildpad-backend');
  assert.deepEqual(contract.kinds, ['engine', 'supabase']);
  assert.deepEqual(contract.onlyDirs, { 'engine-only': 'engine', 'supabase-only': 'supabase' });
  assert.equal(contract.steeringToken, 'kiro-steering:');
});

test('R12: the nine issue codes equal §C13', () => {
  assert.deepEqual(contract.issueCodes, C13_ISSUE_CODES);
});

test('R12: the 13 guard patterns equal the §C20 table, ids, order and regexes', () => {
  assert.equal(contract.guardPatterns.length, 13);
  assert.deepEqual(
    contract.guardPatterns.map((p) => [p.id, p.regex]),
    C20_TABLE.map(([id, cell]) => [id, unescapeTable(cell)]),
  );
  for (const p of contract.guardPatterns) {
    assert.deepEqual(Object.keys(p).sort(), ['id', 'regex']);
    assert.doesNotThrow(() => new RegExp(p.regex), p.id);
  }
});

test('R12: the path rule and the fenced-block rule equal §C20', () => {
  assert.equal(contract.guardPathRegex, unescapeTable(C20_PATH_RULE));
  assert.equal(`${escapeRegex(contract.guardPathSuffixUnderSkill)}$`, C20_SQL_SUFFIX_RULE);
  assert.deepEqual(contract.fencedBlockRule, {
    credentials: C20_FENCED_CREDENTIALS,
    dataApi: C20_FENCED_DATA_API.join('|'),
  });
});

test('R12: links inside fenced code blocks are not links (§C13)', () => {
  assert.equal(contract.fencedLinksAreLinks, false);
});

test('R12: the seven recorded link breaks equal §C13', () => {
  assert.deepEqual(
    contract.recordedLinkBreaks.map((b) => [b.file, b.lineAtBaseline, b.target, b.layouts]),
    C13_RECORDED_BREAKS,
  );
});

test('R12: the contract holds no key beyond S8', () => {
  assert.deepEqual(Object.keys(contract).sort(), [
    'contract', 'fencedBlockRule', 'fencedLinksAreLinks', 'guardPathRegex',
    'guardPathSuffixUnderSkill', 'guardPatterns', 'issueCodes', 'kinds', 'markerRegex',
    'onlyDirs', 'recordedLinkBreaks', 'source', 'steeringToken', 'token', 'version',
  ]);
});

test('R12: cases.json has the Data Models shape', () => {
  assert.deepEqual(Object.keys(cases).sort(), ['guardCases', 'linkCases', 'markerCases']);
  const names = new Set();
  for (const c of cases.markerCases) {
    assert.equal(typeof c.name, 'string');
    assert.equal(typeof c.path, 'string', c.name);
    assert.equal(typeof c.text, 'string', c.name);
    assert.ok(Array.isArray(c.issues), c.name);
    for (const i of c.issues) {
      assert.ok(Number.isInteger(i.line) && i.line >= 1, c.name);
      assert.ok(contract.issueCodes.includes(i.code), `${c.name}: ${i.code}`);
    }
    assert.ok(!names.has(c.name), `duplicate case name ${c.name}`);
    names.add(c.name);
  }
  const guardIds = new Set(contract.guardPatterns.map((p) => p.id));
  for (const c of cases.guardCases) {
    assert.equal(typeof c.line, 'string', c.name);
    assert.ok(!c.line.includes('\n'), c.name);
    for (const id of c.ids) assert.ok(guardIds.has(id), `${c.name}: ${id}`);
    assert.ok(!names.has(c.name), `duplicate case name ${c.name}`);
    names.add(c.name);
  }
  for (const c of cases.linkCases) {
    assert.equal(typeof c.text, 'string', c.name);
    for (const l of c.links) {
      assert.ok(Number.isInteger(l.line) && l.line >= 1, c.name);
      assert.equal(typeof l.target, 'string', c.name);
    }
    assert.ok(!names.has(c.name), `duplicate case name ${c.name}`);
    names.add(c.name);
  }
  // A positive and a negative for every pattern.
  for (const id of guardIds) {
    assert.ok(cases.guardCases.some((c) => c.ids.includes(id)), `no positive case for ${id}`);
  }
  assert.ok(cases.guardCases.some((c) => c.ids.length === 0), 'no negative guard case');
  for (const code of contract.issueCodes) {
    assert.ok(cases.markerCases.some((c) => c.issues.some((i) => i.code === code)), `no case for ${code}`);
  }
});

// R12, second half (design S8 step 2): every shared case runs through the libraries.
import { validateMarkers, validateMarkerPlacement } from '../lib/passages.mjs';
import { scanLine } from '../lib/guard.mjs';
import { extractLinks } from '../lib/links.mjs';

const byLineCode = (a, b) => a.line - b.line || a.code.localeCompare(b.code);

for (const c of cases.markerCases) {
  test(`R12 marker case: ${c.name}`, () => {
    const got = [...validateMarkers(c.text), ...validateMarkerPlacement(c.path, c.text)].sort(byLineCode);
    assert.deepEqual(got.map(({ line, code }) => ({ line, code })), [...c.issues].sort(byLineCode));
  });
}

for (const c of cases.guardCases) {
  test(`R12 guard case: ${c.name}`, () => {
    assert.deepEqual(scanLine(c.line, { local: false }), c.ids);
  });
}

for (const c of cases.linkCases) {
  test(`R12 link case: ${c.name}`, () => {
    assert.deepEqual(extractLinks(c.text), c.links);
  });
}
