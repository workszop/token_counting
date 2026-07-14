# Gemini Token Counter — GitHub Pages edition

A fully static JavaScript port of the local Gemini token counter. It runs the
Gemma 4 tokenizer in a browser Web Worker and supports multiple requests,
aggregate totals, vocabulary size, and per-request token IDs.

## Publish on GitHub Pages

This directory has no build step. Publish it as the root of a Pages site, or
copy its contents into a repository's `docs/` directory and configure GitHub
Pages to deploy from that folder.

For a quick local preview:

```bash
cd token-counter-pages
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Do not open `index.html` directly with a `file://` URL. Browser security rules
block JavaScript modules and Web Workers from loading local files that way.

## Network and privacy

On first use, the page loads:

- `@huggingface/transformers` 4.2.0 from jsDelivr
- `google/gemma-4-E4B-it` tokenizer files from Hugging Face

Tokenization then runs locally in a Web Worker. Request text is not sent to
either service. Browser caching normally avoids downloading the tokenizer again.
The tokenizer file is approximately 32 MB.

The selected Gemini models currently share the Gemma 4 text tokenizer. This is
a text-only estimate; Gemini API usage metadata remains the source of truth for
billing and configured requests may include additional hidden tokens.

## Verify

```bash
node --test tests/pure.test.mjs
node --check app.js
node --check tokenizer-worker.js
```
