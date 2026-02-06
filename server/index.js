import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const OPENAI_VOICES = new Set([
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
]);
const DEFAULT_VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

function extractOutputText(payload) {
  if (payload?.output_text) return payload.output_text;
  if (Array.isArray(payload?.output)) {
    for (const item of payload.output) {
      const content = item?.content || [];
      for (const part of content) {
        if (part?.type === "output_text" && part?.text) return part.text;
        if (part?.type === "text" && part?.text) return part.text;
      }
    }
  }
  return "";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/tts/openai", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "OPENAI_API_KEY missing" });
      return;
    }

    const text = String(req.body?.text || "").trim();
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    const speed = clamp(Number(req.body?.speed || 1), 0.25, 4);
    const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
    const requestedVoice = String(req.body?.voice || "").trim();
    const fallbackVoice = process.env.OPENAI_TTS_VOICE || "alloy";
    const voice = OPENAI_VOICES.has(requestedVoice)
      ? requestedVoice
      : fallbackVoice;

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        speed,
        format: "mp3",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(500).send(errText);
      return;
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (error) {
    res.status(500).json({ error: "OpenAI TTS failed" });
  }
});

app.post("/htr/openai", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "OPENAI_API_KEY missing" });
      return;
    }
    const image = String(req.body?.image || "").trim();
    if (!image) {
      res.status(400).json({ error: "image is required" });
      return;
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_VISION_MODEL,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Trascrivi fedelmente il testo scritto a mano nell'immagine. " +
                  "Restituisci solo il testo, senza commenti.",
              },
              {
                type: "input_image",
                image_url: image,
                detail: "high",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(500).send(errText);
      return;
    }

    const json = await response.json();
    const text = extractOutputText(json);
    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: "HTR failed" });
  }
});

app.post("/tts/gemini", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse?.token;
    if (!accessToken) {
      res.status(500).json({ error: "Google auth failed" });
      return;
    }

    const speakingRate = clamp(Number(req.body?.speed || 1), 0.25, 4);
    const modelName = process.env.GOOGLE_TTS_MODEL || "gemini-2.5-flash-tts";
    const languageCode = process.env.GOOGLE_TTS_LANG || "it-IT";
    const voiceName = process.env.GOOGLE_TTS_VOICE || "";

    const voice = {
      languageCode,
      modelName,
    };
    if (voiceName) voice.name = voiceName;

    const response = await fetch(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          input: { text },
          voice,
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      res.status(500).send(errText);
      return;
    }

    const json = await response.json();
    const audioContent = json.audioContent;
    if (!audioContent) {
      res.status(500).json({ error: "No audioContent" });
      return;
    }

    const audioBuffer = Buffer.from(audioContent, "base64");
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (error) {
    res.status(500).json({ error: "Gemini TTS failed" });
  }
});

app.listen(PORT, () => {
  console.log(`TTS server running on port ${PORT}`);
});
