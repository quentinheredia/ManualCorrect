/**
 * Splits text into word and non-word tokens so that joining every token's
 * text gives back the original string exactly (whitespace, punctuation,
 * emoji and all). Only word tokens with `check: true` go to the spellchecker.
 */
export interface Token {
  text: string;
  check: boolean;
}

// Letters, marks and digits, with inner apostrophes ("don't", "rock’n’roll").
const WORD = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;

// Whitespace-delimited chunks that are never prose: URLs, emails, @mentions,
// #hashtags, $cashtags and bare domains. The whole chunk is kept verbatim.
const NON_PROSE_CHUNK = [
  /^[a-z][a-z0-9+.-]*:\/\//i,
  /^www\./i,
  /@/,
  /^#[\p{L}\p{N}_]/u,
  /^\$\p{L}/u,
  /^[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}(?:\/\S*)?$/i,
];

const MIN_WORD_LENGTH = 2;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const chunk of text.split(/(\s+)/)) {
    if (!chunk) continue;
    if (/^\s+$/.test(chunk) || NON_PROSE_CHUNK.some((re) => re.test(chunk))) {
      tokens.push({ text: chunk, check: false });
      continue;
    }
    let cursor = 0;
    for (const match of chunk.matchAll(WORD)) {
      const start = match.index ?? 0;
      if (start > cursor) tokens.push({ text: chunk.slice(cursor, start), check: false });
      tokens.push({ text: match[0], check: isCheckable(match[0]) });
      cursor = start + match[0].length;
    }
    if (cursor < chunk.length) tokens.push({ text: chunk.slice(cursor), check: false });
  }
  return tokens;
}

function isCheckable(word: string): boolean {
  if (Array.from(word).length < MIN_WORD_LENGTH) return false;
  if (/\p{N}/u.test(word)) return false;
  const isAllCaps = word === word.toUpperCase() && word !== word.toLowerCase();
  return !isAllCaps;
}

export function rebuild(tokens: Token[], replacements: Map<number, string>): string {
  return tokens.map((token, i) => replacements.get(i) ?? token.text).join('');
}
