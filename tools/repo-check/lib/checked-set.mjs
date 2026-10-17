// The checked set (design, Scope and views): files under every top-level folder holding
// `SKILL.md`, plus `agents/` and `references/`. Root files, `.github/`, `.kiro/` and `tools/` are
// not in it. Runs git.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export class GitError extends Error {}

/** Runs git in `cwd`; returns stdout as a Buffer, or throws GitError. */
export function git(cwd, args, { input, allowFail = false } = {}) {
  const r = spawnSync('git', args, { cwd, input, maxBuffer: 1 << 30 });
  if (r.error) throw new GitError(`git ${args.join(' ')}: ${r.error.message}`);
  if (r.status !== 0 && !allowFail) {
    throw new GitError(`git ${args.join(' ')} failed: ${r.stderr.toString('utf8').trim()}`);
  }
  return r.status === 0 ? r.stdout : null;
}

const SHARED_FOLDERS = ['agents', 'references'];

/** Keeps the paths of the checked set, sorted. */
export function filterCheckedSet(paths) {
  const skills = new Set();
  for (const p of paths) {
    const parts = p.split('/');
    if (parts.length === 2 && parts[1] === 'SKILL.md' && !parts[0].startsWith('.')) skills.add(parts[0]);
  }
  return paths
    .filter((p) => {
      const parts = p.split('/');
      if (parts.length < 2) return false;
      return skills.has(parts[0]) || SHARED_FOLDERS.includes(parts[0]);
    })
    .sort();
}

/** The sorted top-level folders of a set of paths. */
export function topFolders(paths) {
  return [...new Set(paths.map((p) => p.split('/')[0]))].sort();
}

/** Whether `root` is the top of a git work tree. */
export function isWorkTreeRoot(root) {
  const out = git(root, ['rev-parse', '--show-toplevel'], { allowFail: true });
  if (out === null) return false;
  try {
    return realpathSync(out.toString('utf8').trim()) === realpathSync(root);
  } catch {
    return false;
  }
}

const splitZ = (buf) => buf.toString('utf8').split('\0').filter(Boolean);

function walk(root) {
  const out = [];
  const visit = (dir) => {
    for (const name of readdirSync(path.join(root, dir))) {
      if (name === '.git') continue;
      const rel = dir ? `${dir}/${name}` : name;
      if (statSync(path.join(root, rel)).isDirectory()) visit(rel);
      else out.push(rel);
    }
  };
  visit('');
  return out;
}

/** Every file at `ref`, from `git ls-tree`. */
export function listAtRef(ref, { repo = process.cwd() } = {}) {
  return splitZ(git(repo, ['ls-tree', '-r', '-z', '--name-only', ref]));
}

/** The checked set of the tree at `ref` in `repo`. */
export function checkedSetAtRef(ref, { repo = process.cwd() } = {}) {
  return filterCheckedSet(listAtRef(ref, { repo }));
}

/**
 * The checked set of `root`: `git ls-files` in a work tree; otherwise `git ls-tree -r --name-only
 * <ref>` run in `repo` (a `git archive` copy of that ref); otherwise a directory walk that skips
 * `.git/`. Only files present under `root` are kept.
 */
export function checkedSet(root, { ref, repo = process.cwd() } = {}) {
  let paths;
  if (isWorkTreeRoot(root)) paths = splitZ(git(root, ['ls-files', '-z']));
  else if (ref) paths = listAtRef(ref, { repo });
  else paths = walk(root);
  return filterCheckedSet(paths.filter((p) => existsSync(path.join(root, p))));
}
