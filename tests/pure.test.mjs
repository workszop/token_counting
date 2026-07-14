import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MODEL,
  SUPPORTED_MODELS,
  aggregateResults,
  displayToken,
  textStats,
} from "../shared.js";

test("supported model IDs are unique and include the default", () => {
  const ids = SUPPORTED_MODELS.map((model) => model.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(DEFAULT_MODEL));
});

test("textStats counts Unicode bytes and words", () => {
  assert.deepEqual(textStats("Zażółć gęślą"), {
    characters: 12,
    words: 2,
    utf8Bytes: 19,
  });
  assert.deepEqual(textStats("A🙂"), {
    characters: 2,
    words: 1,
    utf8Bytes: 5,
  });
});

test("aggregateResults combines request metrics", () => {
  assert.deepEqual(
    aggregateResults([
      { totalTokens: 2, characters: 8, words: 2, utf8Bytes: 8 },
      { totalTokens: 3, characters: 7, words: 1, utf8Bytes: 7 },
    ]),
    {
      totalTokens: 5,
      characters: 15,
      words: 3,
      utf8Bytes: 15,
      charactersPerToken: 3,
    },
  );
});

test("displayToken converts sentencepiece whitespace markers", () => {
  assert.equal(displayToken("▁Hello_World"), " Hello World");
});
