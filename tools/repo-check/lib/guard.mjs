// R1 Guard over one view of one file: §C20's 13 line patterns, its path rule and its fenced-block
// rule (all from the shared contract), plus this repository's own patterns in LOCAL_PATTERNS, which
// are never written to the contract file (design, Rules R1). Pure.
import { contract } from './contract.mjs';
import { lines, fencedBlocks, isMarkdownPath } from './markdown.mjs';

export const GUARD_PATTERNS = contract.guardPatterns.map((p) => ({ id: p.id, re: new RegExp(p.regex) }));

// This repository's own patterns, none at present. The `x-pp29-tool` patterns (the cron, services
// and extensions MCP tools) were removed when PP-29 was met, 23 October 2026 (task 10.4).
export const LOCAL_PATTERNS = [];

const PATH_RE = new RegExp(contract.guardPathRegex);
const SQL_SUFFIX = contract.guardPathSuffixUnderSkill;
const FENCE_CREDENTIALS = new RegExp(contract.fencedBlockRule.credentials);
const FENCE_DATA_API = new RegExp(contract.fencedBlockRule.dataApi);

/** Pattern ids matched by one line, each once, in pattern order. */
export function scanLine(line, { local = true } = {}) {
  const found = [];
  for (const p of local ? [...GUARD_PATTERNS, ...LOCAL_PATTERNS] : GUARD_PATTERNS) {
    if (!found.includes(p.id) && p.re.test(line)) found.push(p.id);
  }
  return found;
}

/** §C20 path rule: a Supabase migration path, or a `.sql` file under a skill folder. */
export function pathMatches(p) {
  return PATH_RE.test(p) || (p.includes('/') && p.endsWith(SQL_SUFFIX));
}

/** Findings for one view of one file: [{line, id}], 1-based lines. */
export function scanView(p, text) {
  const findings = [];
  if (pathMatches(p)) findings.push({ line: 1, id: 'path' });
  const ls = lines(text);
  ls.forEach((line, i) => {
    for (const id of scanLine(line)) findings.push({ line: i + 1, id });
  });
  if (isMarkdownPath(p)) {
    for (const { start, end } of fencedBlocks(ls).fences) {
      const block = ls.slice(start + 1, end + 1);
      if (block.some((l) => FENCE_CREDENTIALS.test(l)) && block.some((l) => FENCE_DATA_API.test(l))) {
        findings.push({ line: start + 1, id: 'fenced-credentials' });
      }
    }
  }
  return findings.sort((a, b) => a.line - b.line);
}
