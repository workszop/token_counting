export const DEFAULT_MODEL = "gemini-3.5-flash";
export const TOKENIZER_SOURCE = "google/gemma-4-E4B-it";
export const VOCABULARY_SIZE = 262_144;
export const MAX_REQUESTS = 25;
export const MAX_PREVIEW_TOKENS = 400;

export const SUPPORTED_MODELS = Object.freeze([
  { id: "gemini-4-flash-preview", label: "Gemini 4 Flash Preview" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
]);

export function textStats(text) {
  return {
    characters: Array.from(text).length,
    words: text.match(/\S+/gu)?.length ?? 0,
    utf8Bytes: new TextEncoder().encode(text).length,
  };
}

export function aggregateResults(results) {
  const totals = results.reduce(
    (sum, result) => ({
      totalTokens: sum.totalTokens + result.totalTokens,
      characters: sum.characters + result.characters,
      words: sum.words + result.words,
      utf8Bytes: sum.utf8Bytes + result.utf8Bytes,
    }),
    { totalTokens: 0, characters: 0, words: 0, utf8Bytes: 0 },
  );
  return {
    ...totals,
    charactersPerToken: totals.totalTokens
      ? Math.round((totals.characters / totals.totalTokens) * 100) / 100
      : null,
  };
}

export function displayToken(token) {
  return String(token).replaceAll("_", " ").replaceAll("▁", " ");
}
