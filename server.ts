import dotenv from 'dotenv';
import express from 'express';
import os from 'os';
import path from 'path';
import textToSpeech from '@google-cloud/text-to-speech';
import { GoogleGenAI } from '@google/genai';

// Load local environment variables for development. `.env.local` takes
// precedence over `.env`; on AI Studio these are already injected into
// process.env so these calls simply no-op when the files are absent.
dotenv.config({ path: '.env.local' });
dotenv.config();

// The model used for every Gemini request. Kept server-side so the client
// never needs to know (or bundle) API credentials.
const GEMINI_MODEL = 'gemini-2.5-flash';

async function startServer() {
  const app = express();
  // PORT is configurable so the app runs on hosts that assign one
  // (e.g. Cloud Run) and on devices where 3000 may be taken (e.g. Termux).
  const PORT = Number(process.env.PORT) || 3000;

  // Add JSON body parser for POST requests (limit increased for large scripts)
  app.use(express.json({ limit: '10mb' }));

  // API constraints text limits...
  // Google TTS can synthesize up to 5000 characters per request.

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Gemini proxy. All content generation runs here so GEMINI_API_KEY stays
  // on the server and is never shipped in the client bundle. The client sends
  // the same { contents, config } it used to pass to the SDK directly.
  app.post('/api/gemini', async (req, res) => {
    try {
      const { contents, config } = req.body ?? {};

      if (contents === undefined || contents === null) {
        return res.status(400).json({ error: 'Missing contents parameter' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(401).json({
          error: 'GEMINI_API_KEY environment variable is missing on the server.',
          status: 'PERMISSION_DENIED',
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config,
      });

      res.json({ text: response.text ?? '' });
    } catch (error: any) {
      console.error('Gemini Error:', error);
      // Forward the original status/message so the client can keep showing
      // its quota / permission specific messaging.
      const status = error?.status ?? error?.error?.code ?? error?.code;
      res.status(500).json({
        error: error?.message || 'Failed to generate content',
        status,
      });
    }
  });

  // TTS Endpoint
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, voiceName, languageCode } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Missing text parameter' });
      }

      const apiKey = process.env.GOOGLE_TTS_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: 'GOOGLE_TTS_API_KEY environment variable is missing on the server.' });
      }

      // Initialize the client using the API key
      const client = new textToSpeech.TextToSpeechClient({ apiKey });

      // Build request
      const request = {
        input: { text: text.substring(0, 4900) }, // Truncate just in case to avoid limit
        voice: {
          languageCode: languageCode || 'en-US',
          name: voiceName || 'en-US-Journey-D', // Default to Journey premium
        },
        audioConfig: {
          audioEncoding: 'MP3' as const,
        },
      };

      // Perform the TTS request
      const [response] = await client.synthesizeSpeech(request);
      
      const audioContent = response.audioContent;
      if (!audioContent) {
        throw new Error('No audio content returned from Google TTS');
      }

      // Calculate metadata
      const wordCount = text.trim().split(/\s+/).length;
      // Assume average speaking rate of 150 words per minute (2.5 words per second)
      const estimatedDurationSeconds = wordCount / 2.5;
      
      // Convert audioContent to Base64 (audioContent is Uint8Array or Base64 string depending on the API mapping)
      const base64Audio = Buffer.from(audioContent).toString('base64');

      res.json({
        audioBase64: base64Audio,
        wordCount,
        estimatedDurationSeconds
      });

    } catch (error: any) {
      console.error('TTS Error:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate speech' });
    }
  });

  // Vite middleware for development. Imported lazily so the production
  // server can run with runtime-only dependencies installed (no vite) —
  // required for lightweight hosts such as Termux on Android.
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Print LAN addresses so the app can be opened from a phone/tablet on
    // the same network (e.g. an Android tablet browser).
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] ?? []) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`  On your network (${name}): http://${net.address}:${PORT}`);
        }
      }
    }
  });
}

startServer();
