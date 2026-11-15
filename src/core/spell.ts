import nspell from 'nspell';
import { tokenize, type Token } from './tokenize';

type Speller = ReturnType<typeof nspell>;

export interface Misspelling {
  tokenIndex: number;
  original: string;
  /** The word the user has to build. Equals `original` when unfixable. */
  target: string;
  unfixable: boolean;
}

export interface SpellJob {
  text: string;
  tokens: Token[];
  misspellings: Misspelling[];
}

const AFF = 'dict/en_US.aff';
const DIC = 'dict/en_US.dic';

// Chat words Hunspell's en_US lacks. Without these, "ok" is "corrected" to "oi".
const CHAT_WORDS = ['ok', 'okay', 'lol', 'omg', 'btw', 'idk', 'tbh', 'imo', 'thx', 'pls', 'plz', 'ty', 'np', 'brb', 'gonna', 'gotta', 'wanna', 'yeah', 'yep', 'nope', 'hmm', 'haha', 'hahaha', 'emoji', 'lmao'];

let speller: Speller | null = null;
let loading: Promise<Speller> | null = null;

function resourceUrl(path: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) return chrome.runtime.getURL(path);
  // Running outside the extension (e.g. `vite` dev server for the demo page).
  return new URL(`/${path}`, location.href).href;
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(resourceUrl(path));
  if (!response.ok) throw new Error(`ManualCorrect: could not load ${path} (${response.status})`);
  return response.text();
}

export function loadSpeller(): Promise<Speller> {
  loading ??= Promise.all([fetchText(AFF), fetchText(DIC)]).then(([aff, dic]) => {
    const sp = nspell(aff, dic);
    CHAT_WORDS.forEach((word) => sp.add(word));
    speller = sp;
    return sp;
  });
  return loading;
}

/** The loaded speller, or null while the dictionary is still loading. */
export function readySpeller(): Speller | null {
  return speller;
}

/**
 * nspell ranks by its own heuristics, so "teh" comes back as "ten" first.
 * Swapped neighbours are the most common typo by far, so a real word that is
 * one adjacent swap away wins. Everything else keeps nspell's order.
 */
function bestSuggestion(sp: Speller, word: string): string | null {
  const suggestions = sp.suggest(word);
  const letters = Array.from(word);
  const swaps: string[] = [];
  for (let i = 0; i < letters.length - 1; i++) {
    if (letters[i] === letters[i + 1]) continue;
    const swapped = [...letters];
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    const candidate = swapped.join('');
    if (sp.correct(candidate)) swaps.push(candidate);
  }
  const rankedSwap = suggestions.find((s) => swaps.includes(s)) ?? swaps[0];
  return rankedSwap ?? suggestions[0] ?? null;
}

export function analyze(sp: Speller, text: string): SpellJob {
  const tokens = tokenize(text);
  const misspellings: Misspelling[] = [];
  tokens.forEach((token, tokenIndex) => {
    if (!token.check || sp.correct(token.text)) return;
    const suggestion = bestSuggestion(sp, token.text);
    misspellings.push({
      tokenIndex,
      original: token.text,
      target: suggestion ?? token.text,
      unfixable: suggestion === null,
    });
  });
  return { text, tokens, misspellings };
}
