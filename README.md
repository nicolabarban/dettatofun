# dettatofun

Web app per dettati: OCR da immagini/PDF, lettura lenta e correzione con salvataggio progressi nel browser.

## Uso
1. Apri `index.html` nel browser.
2. Inserisci il nome del bambino e salva.
3. Carica una foto o un PDF.
4. Esegui OCR, poi usa "Leggi" per il dettato.
5. Salva la correzione per vedere i progressi.

## Note
- I progressi sono salvati nel browser del dispositivo (localStorage).
- Per i PDF viene letta la prima pagina.

## Backend TTS (OpenAI + Gemini)
L'app statica su GitHub Pages chiama un backend online che genera l'audio.

### Variabili d'ambiente
Vedi `server/.env.example`.
Per Gemini serve anche `GOOGLE_APPLICATION_CREDENTIALS` (file JSON del service account).

### HTR (scrittura a mano)
L'endpoint `POST /htr/openai` usa il modello vision di OpenAI per trascrivere testo da immagini.

### Avvio locale
```bash
cd /Users/nicolabarban/Library/CloudStorage/Dropbox/dettato_fun/server
npm install
cp .env.example .env
npm start
```

### Deploy online (consigliato per tablet)
Usa un provider tipo Render/Railway/Vercel e imposta le variabili d'ambiente.
Poi inserisci l'URL del backend nel campo “URL backend TTS online” dell'app.
