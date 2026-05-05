# Caccia all'Errore

Un gioco di ortografia italiana per bambini di ~10 anni. Mostra un paragrafo con 1-3 parole sbagliate: il giocatore le tocca e sceglie la versione corretta tra 3 alternative. Mascotte: la gatta **Lily**.

## Come giocare

5 livelli, difficoltà crescente:

1. **Doppie** (palla, piccolo, salsa…)
2. **H del verbo avere** (ho/o, hanno/anno)
3. **Accenti e apostrofi** (perché, è, po')
4. **Suoni difficili** (sc/sci, gn/gl, cqu)
5. **Plurali e mix** (camicie, famiglia, organizzato + tutto)

3 vite per livello. Le stelle finali (1-3) dipendono dalle vite rimaste. Il livello successivo si sblocca con almeno 1 stella.

## Avvio locale

L'app è statica ma usa ES modules + `fetch()`, quindi serve un server HTTP locale (non basta aprire `index.html` da disco).

```bash
# da dentro la cartella del progetto
python3 -m http.server 8000
```

Poi apri http://localhost:8000 nel browser.

In alternativa: `npx serve` o l'estensione **Live Server** di VSCode.

## Struttura

```
index.html           HTML di entry
style.css            Stili (mobile-first)
app.js               Orchestratore
game.js              Stato e logica del gioco
ui.js                Render delle schermate
storage.js           localStorage progressi
mascot.js            SVG e frasi di Lily
data/exercises.json  20 paragrafi · 31 errori
```

## Aggiungere esercizi

Modifica `data/exercises.json`. Ogni esercizio:

```json
{
  "id": "L1-05",
  "level": 1,
  "category": "doppie",
  "paragraph": ["array", "di", "parole", "tokenn"],
  "errors": [
    { "wordIndex": 3, "correct": "tokens", "options": ["tokens", "tokenn", "tokkens"] }
  ]
}
```

Regole:
- Il token con errore non deve avere punteggiatura attaccata (semplifica la sostituzione runtime).
- `correct` deve essere presente in `options`. Le altre 2 sono distrattori plausibili (errori comuni della stessa categoria).
- Le 3 opzioni vengono mescolate a runtime.
