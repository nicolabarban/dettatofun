/* global Tesseract, pdfjsLib */

const els = {
  studentName: document.getElementById("studentName"),
  saveStudent: document.getElementById("saveStudent"),
  progressCard: document.getElementById("progressCard"),
  fileInput: document.getElementById("fileInput"),
  runOcr: document.getElementById("runOcr"),
  ocrStatus: document.getElementById("ocrStatus"),
  ocrText: document.getElementById("ocrText"),
  childText: document.getElementById("childText"),
  rate: document.getElementById("rate"),
  chunk: document.getElementById("chunk"),
  play: document.getElementById("play"),
  pause: document.getElementById("pause"),
  stop: document.getElementById("stop"),
  saveAttempt: document.getElementById("saveAttempt"),
  history: document.getElementById("history"),
};

const STORE_KEY = "dettati-magici";
let currentStudent = null;
let currentUtteranceQueue = [];
let isReading = false;

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
      return `
      <div class="history-card">
        <h3>${new Date(item.date).toLocaleDateString()}</h3>
        <div>Precisione: ${formatPercent(item.accuracy)}</div>
        <div>Parole: ${item.wordCount}</div>
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
  currentUtteranceQueue = [];
  isReading = false;
}

function speakChunks(text, chunkSize, rate) {
  stopReading();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return;
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  currentUtteranceQueue = chunks.map((chunk) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = rate;
    utterance.lang = "it-IT";
    return utterance;
  });

  let index = 0;
  const speakNext = () => {
    if (index >= currentUtteranceQueue.length) {
      isReading = false;
      return;
    }
    isReading = true;
    const utterance = currentUtteranceQueue[index];
    utterance.onend = () => {
      index += 1;
      speakNext();
    };
    window.speechSynthesis.speak(utterance);
  };

  speakNext();
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
  });
  setStudent(student);
  renderProgress();
  renderHistory();
  setStatus("Correzione salvata.");
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

els.runOcr.addEventListener("click", runOcr);

els.play.addEventListener("click", () => {
  const text = els.ocrText.value;
  const rate = Number(els.rate.value);
  const chunkSize = Number(els.chunk.value);
  if (!text.trim()) {
    setStatus("Nessun testo da leggere.");
    return;
  }
  speakChunks(text, chunkSize, rate);
});

els.pause.addEventListener("click", () => {
  if (!isReading) return;
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  } else {
    window.speechSynthesis.pause();
  }
});

els.stop.addEventListener("click", stopReading);
els.saveAttempt.addEventListener("click", saveAttempt);

renderProgress();
renderHistory();
