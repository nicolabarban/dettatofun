/* global Tesseract, pdfjsLib */

const els = {
  studentName: document.getElementById("studentName"),
  saveStudent: document.getElementById("saveStudent"),
  progressCard: document.getElementById("progressCard"),
  dettatiSelect: document.getElementById("dettatiSelect"),
  loadDettato: document.getElementById("loadDettato"),
  fileInput: document.getElementById("fileInput"),
  runOcr: document.getElementById("runOcr"),
  ocrStatus: document.getElementById("ocrStatus"),
  ocrText: document.getElementById("ocrText"),
  ocrBox: document.getElementById("ocrBox"),
  toggleText: document.getElementById("toggleText"),
  childText: document.getElementById("childText"),
  rate: document.getElementById("rate"),
  pauseLength: document.getElementById("pauseLength"),
  chunk: document.getElementById("chunk"),
  engine: document.getElementById("engine"),
  voice: document.getElementById("voice"),
  play: document.getElementById("play"),
  pause: document.getElementById("pause"),
  stop: document.getElementById("stop"),
  compare: document.getElementById("compare"),
  saveAttempt: document.getElementById("saveAttempt"),
  backendUrl: document.getElementById("backendUrl"),
  saveBackend: document.getElementById("saveBackend"),
  compareResult: document.getElementById("compareResult"),
  handwritingInput: document.getElementById("handwritingInput"),
  runHtr: document.getElementById("runHtr"),
  errorCount: document.getElementById("errorCount"),
  selfNote: document.getElementById("selfNote"),
  saveSelf: document.getElementById("saveSelf"),
  history: document.getElementById("history"),
};

const STORE_KEY = "dettati-magici";
const BACKEND_KEY = "dettati-tts-backend";
const DEFAULT_BACKEND_URL = "https://dettatofun.onrender.com";
const VOICE_KEY = "dettati-tts-voice";
let currentStudent = null;
let isReading = false;
let isPaused = false;
let readQueue = [];
let readIndex = 0;
let pauseTimer = null;
let pauseRemaining = 0;
let pauseStartedAt = 0;
let dettatiList = [];
let selectedVoice = null;
let currentAudio = null;
let cloudMode = false;
let cloudStop = false;

const OPENAI_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
];

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

function loadStore() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return { students: {} };
  try {
    return JSON.parse(raw);
  } catch {
    return { students: {} };
  }
}

function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function getStudent(name) {
  const store = loadStore();
  return store.students[name] || { name, attempts: [] };
}

function setStudent(student) {
  const store = loadStore();
  store.students[student.name] = student;
  saveStore(store);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix = Array.from({ length: aLen + 1 }, () => new Array(bLen + 1));
  for (let i = 0; i <= aLen; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= aLen; i += 1) {
    for (let j = 1; j <= bLen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[aLen][bLen];
}

function calcAccuracy(original, attempt) {
  const cleanOriginal = normalizeText(original);
  const cleanAttempt = normalizeText(attempt);
  if (!cleanOriginal || !cleanAttempt) return 0;
  const dist = levenshtein(cleanOriginal, cleanAttempt);
  const maxLen = Math.max(cleanOriginal.length, cleanAttempt.length);
  return Math.max(0, 1 - dist / maxLen);
}

function renderProgress() {
  if (!currentStudent) {
    els.progressCard.innerHTML = "Scegli un nome per iniziare.";
    return;
  }
  const student = getStudent(currentStudent);
  const attempts = student.attempts.length;
  const avg = attempts
    ? student.attempts.reduce((acc, item) => acc + item.accuracy, 0) / attempts
    : 0;
  els.progressCard.innerHTML = `
    <strong>Ciao ${student.name}!</strong>
    <div>Dettati completati: ${attempts}</div>
    <div>Precisione media: ${formatPercent(avg)}</div>
  `;
}

function renderHistory() {
  if (!currentStudent) {
    els.history.innerHTML = "Nessuno storico ancora.";
    return;
  }
  const student = getStudent(currentStudent);
  if (student.attempts.length === 0) {
    els.history.innerHTML = "Nessun dettato salvato.";
    return;
  }
  els.history.innerHTML = student.attempts
    .slice()
    .reverse()
    .map((item) => {
      const errorText =
        typeof item.errorCount === "number"
          ? `<div>Errori autocorretti: ${item.errorCount}</div>`
          : "";
      const noteText = item.selfNote
        ? `<div>Nota: ${item.selfNote}</div>`
        : "";
      return `
      <div class="history-card">
        <h3>${new Date(item.date).toLocaleDateString()}</h3>
        <div>Precisione: ${formatPercent(item.accuracy)}</div>
        <div>Parole: ${item.wordCount}</div>
        ${errorText}
        ${noteText}
      </div>
    `;
    })
    .join("");
}

function setStatus(text) {
  els.ocrStatus.textContent = text;
}

function setCompareResult(text) {
  els.compareResult.textContent = text;
  els.compareResult.classList.remove("hidden");
}

function stopReading() {
  window.speechSynthesis.cancel();
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  readQueue = [];
  readIndex = 0;
  pauseRemaining = 0;
  pauseStartedAt = 0;
  isReading = false;
  isPaused = false;
  cloudStop = true;
}

function buildReadQueue(text, chunkSize, rate, longPauseMs) {
  const parts = text.split("/").map((p) => p.trim()).filter(Boolean);
  const queue = [];
  parts.forEach((part, idx) => {
    const words = part.split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i += chunkSize) {
      queue.push({
        type: "speech",
        text: words.slice(i, i + chunkSize).join(" "),
        rate,
      });
    }
    if (idx < parts.length - 1) {
      queue.push({ type: "pause", ms: longPauseMs });
    }
  });
  return queue;
}

function playQueue() {
  if (readIndex >= readQueue.length) {
    isReading = false;
    isPaused = false;
    return;
  }
  const item = readQueue[readIndex];
  if (item.type === "pause") {
    pauseRemaining = item.ms;
    pauseStartedAt = Date.now();
    pauseTimer = setTimeout(() => {
      pauseTimer = null;
      readIndex += 1;
      playQueue();
    }, pauseRemaining);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(item.text);
  utterance.rate = item.rate;
  utterance.lang = "it-IT";
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.onend = () => {
    readIndex += 1;
    playQueue();
  };
  window.speechSynthesis.speak(utterance);
}

function speakChunks(text, chunkSize, rate) {
  stopReading();
  const longPauseMs = Number(els.pauseLength.value);
  readQueue = buildReadQueue(text, chunkSize, rate, longPauseMs);
  if (readQueue.length === 0) return;
  readIndex = 0;
  isReading = true;
  cloudMode = false;
  playQueue();
}

async function renderPdfToCanvas(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function imageToCanvas(file) {
  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  context.drawImage(img, 0, 0);
  return canvas;
}

async function runOcr() {
  const file = els.fileInput.files[0];
  if (!file) {
    setStatus("Carica prima un file.");
    return;
  }
  setStatus("Sto preparando il file...");
  let canvas;
  try {
    if (file.type === "application/pdf") {
      canvas = await renderPdfToCanvas(file);
    } else {
      canvas = await imageToCanvas(file);
    }
  } catch (error) {
    setStatus("Errore nel file. Prova con una foto chiara.");
    return;
  }

  try {
    const result = await Tesseract.recognize(canvas, "ita", {
      logger: (info) => {
        if (info.status === "recognizing text") {
          const percent = Math.round(info.progress * 100);
          setStatus(`OCR in corso: ${percent}%`);
        }
      },
    });
    els.ocrText.value = result.data.text.trim();
    setStatus("OCR completato.");
  } catch (error) {
    setStatus("OCR non riuscito. Prova con un immagine piu nitida.");
  }
}

function saveAttempt() {
  if (!currentStudent) {
    setStatus("Inserisci prima il nome.");
    return;
  }
  const original = els.ocrText.value;
  const attempt = els.childText.value;
  const accuracy = calcAccuracy(original, attempt);
  const wordCount = normalizeText(attempt).split(" ").filter(Boolean).length;
  const student = getStudent(currentStudent);
  student.attempts.push({
    date: new Date().toISOString(),
    accuracy,
    wordCount,
    errorCount: null,
    selfNote: "",
  });
  setStudent(student);
  renderProgress();
  renderHistory();
  setStatus("Correzione salvata.");
}

function saveSelfCheck() {
  if (!currentStudent) {
    setStatus("Inserisci prima il nome.");
    return;
  }
  const student = getStudent(currentStudent);
  if (student.attempts.length === 0) {
    setStatus("Salva prima la correzione.");
    return;
  }
  const last = student.attempts[student.attempts.length - 1];
  const count = els.errorCount.value.trim();
  last.errorCount = count === "" ? null : Number(count);
  last.selfNote = els.selfNote.value.trim();
  setStudent(student);
  renderHistory();
  setStatus("Autocorrezione salvata.");
}

function loadVoices() {
  if (els.engine.value === "openai") {
    els.voice.innerHTML = OPENAI_VOICES.map(
      (v) => `<option value="${v}">${v}</option>`
    ).join("");
    const saved = localStorage.getItem(VOICE_KEY);
    selectedVoice = OPENAI_VOICES.includes(saved) ? saved : OPENAI_VOICES[0];
    els.voice.value = selectedVoice;
    return;
  }
  const voices = window.speechSynthesis.getVoices();
  const italian = voices.filter((v) => v.lang.toLowerCase().startsWith("it"));
  const list = italian.length ? italian : voices;
  els.voice.innerHTML = list
    .map(
      (v, idx) =>
        `<option value="${idx}">${v.name} (${v.lang})</option>`
    )
    .join("");
  const savedIndex = Number(localStorage.getItem(VOICE_KEY));
  selectedVoice = list[savedIndex] || list[0] || null;
  els.voice.value = String(savedIndex >= 0 ? savedIndex : 0);
}

function updateSelectedVoice() {
  if (els.engine.value === "openai") {
    selectedVoice = els.voice.value;
    localStorage.setItem(VOICE_KEY, selectedVoice);
    return;
  }
  const voices = window.speechSynthesis.getVoices();
  const italian = voices.filter((v) => v.lang.toLowerCase().startsWith("it"));
  const list = italian.length ? italian : voices;
  selectedVoice = list[Number(els.voice.value)] || null;
  localStorage.setItem(VOICE_KEY, els.voice.value);
}

async function loadDettati() {
  try {
    const res = await fetch("dettati.json");
    if (!res.ok) throw new Error("Fetch failed");
    const all = await res.json();
    dettatiList = all;
    els.dettatiSelect.innerHTML = dettatiList
      .map(
        (item, idx) =>
          `<option value="${idx}">${item.id} - ${item.title}</option>`
      )
      .join("");
  } catch (error) {
    els.dettatiSelect.innerHTML = "<option>Dettati non disponibili</option>";
  }
}

function getBackendUrl() {
  return localStorage.getItem(BACKEND_KEY) || DEFAULT_BACKEND_URL;
}

function setBackendUrl(value) {
  localStorage.setItem(BACKEND_KEY, value);
}

async function fetchTtsAudio(engine, text, speed) {
  const baseUrl = getBackendUrl().trim();
  if (!baseUrl) {
    setStatus("Inserisci l'URL del backend TTS.");
    throw new Error("Missing backend URL");
  }
  const endpoint = "/tts/openai";
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, speed, voice: selectedVoice }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || "TTS failed");
  }
  return response.blob();
}

async function fetchHtrText(imageBase64) {
  const baseUrl = getBackendUrl().trim();
  if (!baseUrl) {
    setStatus("Inserisci l'URL del backend TTS.");
    throw new Error("Missing backend URL");
  }
  const response = await fetch(`${baseUrl}/htr/openai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageBase64 }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || "HTR failed");
  }
  const json = await response.json();
  return json.text || "";
}

function playAudioBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      resolve();
    };
    audio.onerror = (err) => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      reject(err);
    };
    audio.play();
  });
}

async function sleepWithPause(ms) {
  let remaining = ms;
  while (remaining > 0 && !cloudStop) {
    if (isPaused) {
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    const chunk = Math.min(200, remaining);
    const start = Date.now();
    await new Promise((r) => setTimeout(r, chunk));
    remaining -= Date.now() - start;
  }
}

async function playCloudQueue(text, chunkSize, speed, longPauseMs, engine) {
  stopReading();
  cloudMode = true;
  cloudStop = false;
  isReading = true;
  const parts = text.split("/").map((p) => p.trim()).filter(Boolean);
  const queue = [];
  parts.forEach((part, idx) => {
    const words = part.split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i += chunkSize) {
      queue.push({ type: "speech", text: words.slice(i, i + chunkSize).join(" ") });
    }
    if (idx < parts.length - 1) {
      queue.push({ type: "pause", ms: longPauseMs });
    }
  });

  for (const item of queue) {
    if (cloudStop) break;
    while (isPaused) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (item.type === "pause") {
      await sleepWithPause(item.ms);
      continue;
    }
    const blob = await fetchTtsAudio(engine, item.text, speed);
    await playAudioBlob(blob);
  }
  isReading = false;
  cloudMode = false;
}

els.saveStudent.addEventListener("click", () => {
  const name = els.studentName.value.trim();
  if (!name) {
    setStatus("Scrivi un nome valido.");
    return;
  }
  currentStudent = name;
  const student = getStudent(name);
  setStudent(student);
  renderProgress();
  renderHistory();
  setStatus(`Benvenuto ${name}!`);
});

els.toggleText.addEventListener("click", () => {
  const hidden = els.ocrBox.classList.toggle("hidden");
  els.toggleText.textContent = hidden ? "Mostra testo" : "Nascondi testo";
});

els.saveBackend.addEventListener("click", () => {
  const value = els.backendUrl.value.trim();
  if (!value) {
    setStatus("Inserisci un URL valido.");
    return;
  }
  setBackendUrl(value);
  setStatus("URL backend salvato.");
});

els.engine.addEventListener("change", () => {
  loadVoices();
});

els.loadDettato.addEventListener("click", () => {
  const idx = Number(els.dettatiSelect.value);
  const dettato = dettatiList[idx];
  if (!dettato) {
    setStatus("Seleziona un dettato.");
    return;
  }
  els.ocrText.value = dettato.text;
  if (els.ocrBox.classList.contains("hidden")) {
    els.ocrBox.classList.remove("hidden");
    els.toggleText.textContent = "Nascondi testo";
  }
  els.childText.value = "";
  setStatus(`Dettato caricato: ${dettato.title}`);
});

els.runOcr.addEventListener("click", runOcr);

els.play.addEventListener("click", () => {
  const text = els.ocrText.value;
  const rate = Number(els.rate.value);
  const chunkSize = Number(els.chunk.value);
  const engine = els.engine.value;
  if (!text.trim()) {
    setStatus("Nessun testo da leggere.");
    return;
  }
  if (engine === "browser") {
    speakChunks(text, chunkSize, rate);
    return;
  }
  playCloudQueue(text, chunkSize, rate, Number(els.pauseLength.value), "openai").catch(
    (err) => {
      setStatus("Errore TTS online.");
      console.error(err);
    }
  );
});

els.compare.addEventListener("click", () => {
  const original = els.ocrText.value;
  const attempt = els.childText.value;
  if (!original.trim() || !attempt.trim()) {
    setCompareResult("Inserisci sia il testo letto sia il testo del bambino.");
    return;
  }
  const accuracy = calcAccuracy(original, attempt);
  const origWords = normalizeText(original).split(" ").filter(Boolean).length;
  const attWords = normalizeText(attempt).split(" ").filter(Boolean).length;
  setCompareResult(
    `Confronto: precisione ${formatPercent(accuracy)}. Parole: ${attWords}/${origWords}.`
  );
});

els.pause.addEventListener("click", () => {
  if (!isReading) return;
  if (cloudMode) {
    if (isPaused) {
      if (currentAudio) currentAudio.play();
      isPaused = false;
    } else {
      if (currentAudio) currentAudio.pause();
      isPaused = true;
    }
    return;
  }

  if (isPaused) {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    if (pauseRemaining > 0) {
      pauseStartedAt = Date.now();
      pauseTimer = setTimeout(() => {
        pauseTimer = null;
        readIndex += 1;
        playQueue();
      }, pauseRemaining);
    }
    isPaused = false;
    return;
  }
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
  }
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
    pauseRemaining = Math.max(0, pauseRemaining - (Date.now() - pauseStartedAt));
  }
  isPaused = true;
});

els.stop.addEventListener("click", stopReading);
els.saveAttempt.addEventListener("click", saveAttempt);
els.saveSelf.addEventListener("click", saveSelfCheck);
els.voice.addEventListener("change", updateSelectedVoice);

els.runHtr.addEventListener("click", async () => {
  const file = els.handwritingInput.files[0];
  if (!file) {
    setStatus("Carica una foto del quaderno.");
    return;
  }
  setStatus("Trascrizione in corso...");
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const base64 = reader.result;
      const text = await fetchHtrText(base64);
      els.childText.value = text.trim();
      setStatus("Trascrizione completata.");
    } catch (error) {
      setStatus("Errore nella trascrizione.");
    }
  };
  reader.readAsDataURL(file);
});

loadVoices();
window.speechSynthesis.onvoiceschanged = loadVoices;
loadDettati();
renderProgress();
renderHistory();

els.backendUrl.value = getBackendUrl();
