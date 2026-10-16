// Line and Markdown helpers shared by the rules. Pure functions.

/** Splits text into lines without their `\n`; a trailing `\r` is kept in `raw`, removed in `text`. */
export function splitLines(text) {
  return text.split('\n').map((raw) => ({ raw, text: raw.endsWith('\r') ? raw.slice(0, -1) : raw }));
}

/** Plain line strings (no `\r`), index 0 = line 1. */
export function lines(text) {
  return splitLines(text).map((l) => l.text);
}

export function isMarkdownPath(p) {
  return p === undefined || p === null || /\.(md|mdx|markdown)$/i.test(p);
}

/**
 * YAML front matter: a block that starts with `---` on line 1 and ends at the next `---` line.
 * Returns the 0-based indexes of the two delimiter lines, or null.
 */
export function frontMatterRange(ls) {
  if (ls.length === 0 || ls[0] !== '---') return null;
  for (let i = 1; i < ls.length; i++) {
    if (ls[i] === '---') return { start: 0, end: i };
  }
  return null;
}

/**
 * CommonMark fenced code blocks: an opening run of three or more backticks or tildes; the block
 * closes only on a run of the same character at least as long, with nothing after it but spaces;
 * an unclosed block runs to the end of the file. Indentation is accepted so that fences inside
 * list items count.
 * Returns {fences: [{start, end}], inside: boolean[]} where `inside[i]` is true for every line of a
 * block, delimiters included (0-based).
 */
export function fencedBlocks(ls) {
  const fences = [];
  const inside = new Array(ls.length).fill(false);
  let open = null;
  for (let i = 0; i < ls.length; i++) {
    const line = ls[i];
    if (open) {
      inside[i] = true;
      const m = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
      if (m && m[1][0] === open.char && m[1].length >= open.length) {
        fences.push({ start: open.start, end: i });
        open = null;
      }
      continue;
    }
    const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
      open = { start: i, char: m[1][0], length: m[1].length };
      inside[i] = true;
    }
  }
  if (open) fences.push({ start: open.start, end: ls.length - 1 });
  return { fences, inside };
}

export function isTableRow(line) {
  return line !== undefined && /^\s*\|/.test(line);
}

export function isBlank(line) {
  return line !== undefined && line.trim() === '';
}
