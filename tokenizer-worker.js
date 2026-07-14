import {
  AutoTokenizer,
  env,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";
import {
  MAX_PREVIEW_TOKENS,
  TOKENIZER_SOURCE,
  VOCABULARY_SIZE,
  aggregateResults,
  displayToken,
  textStats,
} from "./shared.js";

env.allowLocalModels = false;

let tokenizerPromise;

function getTokenizer(requestId) {
  if (!tokenizerPromise) {
    tokenizerPromise = AutoTokenizer.from_pretrained(TOKENIZER_SOURCE, {
      progress_callback: (event) => {
        self.postMessage({
          type: "progress",
          requestId,
          status: event.status,
          file: event.file,
          progress: event.progress,
        });
      },
    });
  }
  return tokenizerPromise;
}

function normalizeIds(ids) {
  return Array.from(ids, (id) => Number(id));
}

self.addEventListener("message", async (event) => {
  if (event.data?.type !== "count") return;
  const { requestId, model, requests, includeTokens } = event.data;

  try {
    const started = performance.now();
    const tokenizer = await getTokenizer(requestId);
    const results = requests.map((text) => {
      const rawTokens = tokenizer.tokenize(text);
      const tokenIds = normalizeIds(tokenizer.convert_tokens_to_ids(rawTokens));
      const stats = textStats(text);
      const previewLength = Math.min(rawTokens.length, MAX_PREVIEW_TOKENS);
      const tokens = includeTokens
        ? rawTokens.slice(0, previewLength).map((token, index) => ({
            text: displayToken(token),
            tokenId: tokenIds[index],
          }))
        : [];

      return {
        totalTokens: rawTokens.length,
        ...stats,
        tokens,
        previewTruncated: rawTokens.length > previewLength,
      };
    });

    self.postMessage({
      type: "result",
      requestId,
      model,
      vocabularySize: tokenizer.vocab_size || VOCABULARY_SIZE,
      elapsedMs: Math.round((performance.now() - started) * 10) / 10,
      requests: results,
      totals: aggregateResults(results),
    });
  } catch (error) {
    tokenizerPromise = undefined;
    self.postMessage({
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
