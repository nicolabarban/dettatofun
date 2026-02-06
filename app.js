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
  saveAttempt: document.getElementById("saveAttempt"),
  errorCount: document.getElementById("errorCount"),
  selfNote: document.getElementById("selfNote"),
  saveSelf: document.getElementById("saveSelf"),
  history: document.getElementById("history"),
};

const STORE_KEY = "dettati-magici";
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

function stopReading() {
  window.speechSynthesis.cancel();
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
  readQueue = [];
  readIndex = 0;
  pauseRemaining = 0;
  pauseStartedAt = 0;
  isReading = false;
  isPaused = false;
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
  const voices = window.speechSynthesis.getVoices();
  const italian = voices.filter((v) => v.lang.toLowerCase().startsWith("it"));
  const list = italian.length ? italian : voices;
  els.voice.innerHTML = list
    .map(
      (v, idx) =>
        `<option value="${idx}">${v.name} (${v.lang})</option>`
    )
    .join("");
  selectedVoice = list[0] || null;
}

function updateSelectedVoice() {
  const voices = window.speechSynthesis.getVoices();
  const italian = voices.filter((v) => v.lang.toLowerCase().startsWith("it"));
  const list = italian.length ? italian : voices;
  selectedVoice = list[Number(els.voice.value)] || null;
}

async function loadDettati() {
  try {
    const res = await fetch("dettati.json");
    if (!res.ok) throw new Error("Fetch failed");
    const all = await res.json();
    const curatedIds = new Set(["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"]);
    dettatiList = all.filter((item) => curatedIds.has(item.id));
    if (dettatiList.length === 0) dettatiList = all.slice(0, 6);
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
  if (engine !== "browser") {
    setStatus("Motore non configurato. Uso il browser.");
  }
  speakChunks(text, chunkSize, rate);
});

els.pause.addEventListener("click", () => {
  if (!isReading) return;
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

loadVoices();
window.speechSynthesis.onvoiceschanged = loadVoices;
loadDettati();
renderProgress();
renderHistory();
