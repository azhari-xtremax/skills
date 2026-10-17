// Test fixtures: trees and git repositories built in a temporary directory, so no SKILL.md is
// ever committed under tools/ (design, Testing Strategy).
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const GIT_CONFIG = [
  '-c', 'user.name=Repo Check Test', '-c', 'user.email=repo-check@example.invalid',
  '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'core.hooksPath=/dev/null',
  '-c', 'init.defaultBranch=main', '-c', 'core.autocrlf=false',
];

export function tempDir(prefix = 'repo-check-') {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

export function writeTree(root, files) {
  for (const [p, content] of Object.entries(files)) {
    const full = path.join(root, p);
    if (content === null) {
      rmSync(full, { force: true });
      continue;
    }
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

export function git(root, ...args) {
  return execFileSync('git', [...GIT_CONFIG, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** A git repository holding `files`, committed and tagged with an annotated `tag`. */
export function makeRepo(files, { tag = 'v1.0.0' } = {}) {
  const root = tempDir();
  git(root, 'init', '-q');
  writeTree(root, files);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'baseline');
  if (tag) git(root, 'tag', '-a', tag, '-m', 'Baseline_Revision');
  return root;
}

/** Applies `files` to the work tree and stages them, so `git ls-files` sees new files. */
export function change(root, files) {
  writeTree(root, files);
  git(root, 'add', '-A');
}

export function read(root, p) {
  return readFileSync(path.join(root, p), 'utf8');
}

export const L = (...ls) => ls.join('\n') + '\n';
