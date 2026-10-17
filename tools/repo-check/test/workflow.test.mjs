// The CI workflow (design, CI workflow): read as text, since the check has no YAML dependency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.resolve(here, '..', '..', '..', '.github', 'workflows', 'repo-check.yml');
const wf = readFileSync(workflowPath, 'utf8');

const job = (name) => {
  const start = wf.indexOf(`\n  ${name}:\n`);
  assert.ok(start >= 0, `job ${name}`);
  const next = wf.slice(start + 1).search(/\n  [a-z][a-z-]*:\n/);
  return next < 0 ? wf.slice(start) : wf.slice(start, start + 1 + next);
};

test('triggers: pull_request to main, push to main, push of v* tags; never pull_request_target', () => {
  assert.match(wf, /^on:\n  pull_request:\n    branches: \[main\]\n  push:\n    branches: \[main\]\n    tags: \['v\*'\]\n/m);
  assert.doesNotMatch(wf, /pull_request_target/);
});

test('read-only permissions and no secret', () => {
  assert.match(wf, /^permissions:\n  contents: read\n/m);
  assert.doesNotMatch(wf, /secrets\./);
  assert.doesNotMatch(wf, /write/);
});

test('job check: full checkout, Node 22, the tests, then check.mjs with --tag on a tag push', () => {
  const j = job('check');
  assert.match(j, /uses: actions\/checkout@v4\n\s+with:\n\s+fetch-depth: 0/);
  assert.match(j, /uses: actions\/setup-node@v4\n\s+with:\n\s+node-version: 22/);
  const tests = j.indexOf('node --test "tools/repo-check/test/*.test.mjs"');
  const check = j.indexOf('node tools/repo-check/check.mjs');
  assert.ok(tests > 0 && check > tests, 'tests run before the check');
  assert.match(j, /node tools\/repo-check\/check\.mjs --tag "\$GITHUB_REF_NAME"/);
  assert.match(j, /"\$GITHUB_REF_TYPE" = "tag"/);
});

test('job baseline: git archive of v1.0.0, then R4, R5 and R6a on it with the current skill map', () => {
  const j = job('baseline');
  assert.match(j, /uses: actions\/checkout@v4\n\s+with:\n\s+fetch-depth: 0/);
  assert.match(j, /uses: actions\/setup-node@v4\n\s+with:\n\s+node-version: 22/);
  assert.match(j, /git archive v1\.0\.0 \| tar -x -C "\$RUNNER_TEMP\/baseline"/);
  assert.match(j, /node tools\/repo-check\/check\.mjs --root "\$RUNNER_TEMP\/baseline" --baseline-ref v1\.0\.0 --only R4,R5,R6a --skill-map tools\/repo-check\/skill-map\.json/);
});
