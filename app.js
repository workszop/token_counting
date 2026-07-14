import {
  DEFAULT_MODEL,
  MAX_REQUESTS,
  MAX_PREVIEW_TOKENS,
  SUPPORTED_MODELS,
  VOCABULARY_SIZE,
} from "./shared.js";

const elements = {
  model: document.querySelector("#model"),
  count: document.querySelector("#count"),
  clear: document.querySelector("#clear"),
  addRequest: document.querySelector("#add-request"),
  loadFile: document.querySelector("#load-file"),
  fileInput: document.querySelector("#file-input"),
  dropZone: document.querySelector("#drop-zone"),
  requestList: document.querySelector("#request-list"),
  requestTemplate: document.querySelector("#request-template"),
  showTokens: document.querySelector("#show-tokens"),
  results: document.querySelector(".results-panel"),
  resultState: document.querySelector("#result-state"),
  tokenTotal: document.querySelector("#token-total"),
  modelUsed: document.querySelector("#model-used"),
  characters: document.querySelector("#characters"),
  words: document.querySelector("#words"),
  bytes: document.querySelector("#bytes"),
  requestCount: document.querySelector("#request-count"),
  vocabularySize: document.querySelector("#vocabulary-size"),
  ratio: document.querySelector("#ratio"),
  runtimeNote: document.querySelector("#runtime-note"),
  tokenSection: document.querySelector("#token-section"),
  requestBreakdowns: document.querySelector("#request-breakdowns"),
  toast: document.querySelector("#toast"),
};

const numberFormat = new Intl.NumberFormat();
let worker;
let activeRequestId = 0;
let debounceTimer;
let toastTimer;

function requestCards() {
  return [...elements.requestList.querySelectorAll(".request-card")];
}

function requestTexts() {
  return requestCards().map((card) => card.querySelector("textarea").value);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 5000);
}

function renumberRequests() {
  const cards = requestCards();
  cards.forEach((card, index) => {
    const label = card.querySelector(".request-label");
    const textarea = card.querySelector("textarea");
    const remove = card.querySelector(".remove-request");
    const id = `request-${index + 1}`;
    textarea.id = id;
    label.htmlFor = id;
    label.firstElementChild.textContent = `Request ${index + 1}`;
    remove.hidden = cards.length === 1;
    remove.setAttribute("aria-label", `Remove request ${index + 1}`);
  });
  elements.requestCount.textContent = numberFormat.format(cards.length);
  elements.addRequest.disabled = cards.length >= MAX_REQUESTS;
}

function wireRequestCard(card) {
  if (card.dataset.wired === "true") return;
  card.dataset.wired = "true";
  card.querySelector("textarea").addEventListener("input", scheduleCount);
  card.querySelector(".remove-request").addEventListener("click", () => {
    card.remove();
    renumberRequests();
    countTokens();
  });
}

function addRequest(text = "", focus = true) {
  if (requestCards().length >= MAX_REQUESTS) {
    showToast(`A batch can contain at most ${MAX_REQUESTS} requests.`);
    return null;
  }
  const card = elements.requestTemplate.content.firstElementChild.cloneNode(true);
  const textarea = card.querySelector("textarea");
  textarea.value = text;
  wireRequestCard(card);
  elements.requestList.append(card);
  renumberRequests();
  if (focus) textarea.focus();
  return card;
}

function setBusy(busy, message = "Working locally…") {
  elements.results.setAttribute("aria-busy", String(busy));
  elements.count.disabled = busy;
  elements.count.textContent = busy ? "Counting…" : "Count tokens";
  if (busy) elements.resultState.textContent = message;
}

function renderEmpty() {
  elements.tokenTotal.textContent = "0";
  elements.characters.textContent = "0";
  elements.words.textContent = "0";
  elements.bytes.textContent = "0";
  elements.ratio.textContent = "—";
  elements.requestBreakdowns.replaceChildren();
  elements.tokenSection.hidden = true;
  elements.resultState.textContent = "Ready";
  requestCards().forEach((card) => {
    card.querySelector(".request-token-count").textContent = "Not counted";
  });
  renumberRequests();
}

function createTokenMap(tokens) {
  const map = document.createElement("div");
  map.className = "token-map";
  for (const token of tokens) {
    const chip = document.createElement("span");
    chip.className = "token-chip";
    const text = document.createElement("span");
    text.className = "token-text";
    text.textContent = token.text || "∅";
    const id = document.createElement("span");
    id.className = "token-id";
    id.textContent = token.tokenId;
    chip.append(text, id);
    map.append(chip);
  }
  return map;
}

function renderBreakdowns(requests) {
  elements.requestBreakdowns.replaceChildren();
  requests.forEach((request, index) => {
    const section = document.createElement("article");
    section.className = "request-breakdown";
    const header = document.createElement("div");
    header.className = "request-breakdown-heading";
    const title = document.createElement("h3");
    title.textContent = `Request ${index + 1}`;
    const meta = document.createElement("p");
    const truncated = request.previewTruncated
      ? ` · first ${MAX_PREVIEW_TOKENS} shown`
      : "";
    meta.textContent = `${numberFormat.format(request.totalTokens)} tokens${truncated}`;
    header.append(title, meta);
    section.append(header);
    if (request.tokens.length) {
      section.append(createTokenMap(request.tokens));
    } else {
      const empty = document.createElement("p");
      empty.className = "empty-request";
      empty.textContent = "This request is empty.";
      section.append(empty);
    }
    elements.requestBreakdowns.append(section);
  });
  elements.tokenSection.hidden = requests.length === 0;
}

function renderResult(data) {
  const { totals } = data;
  elements.tokenTotal.textContent = numberFormat.format(totals.totalTokens);
  elements.characters.textContent = numberFormat.format(totals.characters);
  elements.words.textContent = numberFormat.format(totals.words);
  elements.bytes.textContent = numberFormat.format(totals.utf8Bytes);
  elements.requestCount.textContent = numberFormat.format(data.requests.length);
  elements.vocabularySize.textContent = numberFormat.format(data.vocabularySize);
  elements.ratio.textContent = totals.charactersPerToken ?? "—";
  elements.modelUsed.textContent = data.model;
  elements.resultState.textContent = `${numberFormat.format(data.elapsedMs)} ms`;
  elements.runtimeNote.textContent = "Tokenizer ready. All counting happens in this browser tab.";
  requestCards().forEach((card, index) => {
    card.querySelector(".request-token-count").textContent =
      `${numberFormat.format(data.requests[index]?.totalTokens ?? 0)} tokens`;
  });
  if (elements.showTokens.checked) renderBreakdowns(data.requests);
  else elements.tokenSection.hidden = true;
}

function handleWorkerMessage(event) {
  const data = event.data;
  if (data.requestId !== activeRequestId) return;
  if (data.type === "progress") {
    const percent = Number.isFinite(data.progress) ? ` ${Math.round(data.progress)}%` : "";
    setBusy(true, `Loading tokenizer${percent}`);
    return;
  }
  setBusy(false);
  if (data.type === "result") {
    renderResult(data);
  } else if (data.type === "error") {
    elements.resultState.textContent = "Error";
    showToast(`Tokenizer could not load: ${data.message}`);
  }
}

function ensureWorker() {
  if (!worker) {
    worker = new Worker("./tokenizer-worker.js", { type: "module" });
    worker.addEventListener("message", handleWorkerMessage);
    worker.addEventListener("error", () => {
      setBusy(false);
      elements.resultState.textContent = "Error";
      showToast("The tokenizer worker could not start. Check your network and browser console.");
    });
  }
  return worker;
}

function countTokens() {
  clearTimeout(debounceTimer);
  const requests = requestTexts();
  if (requests.every((text) => !text)) {
    activeRequestId += 1;
    renderEmpty();
    return;
  }
  activeRequestId += 1;
  setBusy(true);
  ensureWorker().postMessage({
    type: "count",
    requestId: activeRequestId,
    model: elements.model.value,
    requests,
    includeTokens: elements.showTokens.checked,
  });
  localStorage.setItem("gemini-pages-token-model", elements.model.value);
}

function scheduleCount() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(countTokens, 650);
}

async function loadTextFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast("Choose a text file smaller than 10 MB.");
    return;
  }
  const text = await file.text();
  const emptyCard = requestCards().find((card) => !card.querySelector("textarea").value);
  const target = emptyCard || addRequest("", false);
  if (!target) return;
  target.querySelector("textarea").value = text;
  countTokens();
}

elements.model.replaceChildren();
for (const model of SUPPORTED_MODELS) {
  const option = document.createElement("option");
  option.value = model.id;
  option.textContent = model.label;
  elements.model.append(option);
}
const storedModel = localStorage.getItem("gemini-pages-token-model");
elements.model.value = SUPPORTED_MODELS.some((model) => model.id === storedModel)
  ? storedModel
  : DEFAULT_MODEL;
elements.modelUsed.textContent = elements.model.value;
elements.vocabularySize.textContent = numberFormat.format(VOCABULARY_SIZE);

elements.count.addEventListener("click", countTokens);
elements.model.addEventListener("change", countTokens);
elements.showTokens.addEventListener("change", countTokens);
elements.addRequest.addEventListener("click", () => addRequest());
elements.clear.addEventListener("click", () => {
  activeRequestId += 1;
  elements.requestList.replaceChildren();
  addRequest();
  renderEmpty();
});
elements.loadFile.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", () => {
  loadTextFile(elements.fileInput.files[0]).catch(() => showToast("Could not read that file."));
  elements.fileInput.value = "";
});
for (const name of ["dragenter", "dragover"]) {
  elements.dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });
}
for (const name of ["dragleave", "drop"]) {
  elements.dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
  });
}
elements.dropZone.addEventListener("drop", (event) => {
  loadTextFile(event.dataTransfer.files[0]).catch(() => showToast("Could not read that file."));
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    countTokens();
  }
});

if (requestCards().length) requestCards().forEach(wireRequestCard);
else addRequest("", false);
renderEmpty();
document.documentElement.dataset.appReady = "true";
