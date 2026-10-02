# VoxReader

**A free, open-source AI text-to-speech reader.** Paste text or load a webpage, pick a voice, and listen. Think Natural Reader, but free.

Built with React, TypeScript, Vite, and an Express backend that brokers multiple TTS engines, including a fully offline option that uses your devices built-in TTS's.

This was an excersize in utilizing AI agents and Google Studio to build a fully working application within a week that I could use.

---

## Features

- **Multiple TTS engines**, switchable from Voice Settings:
  - **EdgeTTS**: free, no API key needed, high-quality neural voices
  - **Offline Web Speech**: uses your browser's built-in voices, works without a network connection
  - **Google Gemini TTS**: voices `Kore`, `Puck`, `Fenrir`, `Charon`, `Zephyr`
  - **OpenAI TTS**: bring your own API key
  - **ElevenLabs TTS**: bring your own API key
- **Webpage extraction**: paste a URL and VoxReader pulls out the readable article text (headings, paragraphs, lists, quotes) so you can listen to it
- **Documentation navigation**: detects "Next" / "Previous" links on docs and article pages so you can read page to page
- **Clean text handling**: decodes HTML entities and normalizes curly quotes and typographic symbols so they are read correctly
- **Bring your own keys**: API keys for Gemini, OpenAI, and ElevenLabs can be entered in the UI and are sent per request via headers

### Built-in EdgeTTS voices

| Voice | Locale | Style |
| --- | --- | --- |
| Aria | en-US | Expressive |
| Guy | en-US | Professional |
| Jenny | en-US | Warm & friendly |
| Sonia | en-GB | Sophisticated |
| Ryan | en-GB | Clear |
| Natasha | en-AU | Bright |
| Clara | en-CA | Smooth |

---

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express (TypeScript)
- **TTS / AI:** `node-edge-tts`, `@google/genai`, OpenAI and ElevenLabs REST APIs
- **Package manager:** Bun (a `bun.lock` is included), though npm also works

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (required for the built-in `fetch` and `AbortSignal.timeout`)
- [Bun](https://bun.sh/) (recommended) or npm

### Installation

```bash
git clone https://github.com/Amandaleeanne/VoxReader---AI-TTS-reader.git
cd VoxReader---AI-TTS-reader
bun install        # or: npm install
```

### Configuration

Copy the example environment file and fill in what you need:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | No | Server-side default key for Gemini TTS. Without it, users can still use EdgeTTS, offline Web Speech, or enter their own key in Voice Settings. |
| `PORT` | No | Port the server listens on. Defaults to `3000`. |
| `NODE_ENV` | No | Set to `production` to serve the built `dist/` folder instead of the Vite dev server. |

> EdgeTTS and Web Speech need no keys at all, so the app works out of the box.

### Run in development

```bash
bun run dev        # or: npm run dev
```

The server starts Express with Vite middleware at `http://localhost:3000`.

### Build and run in production

```bash
bun run build      # or: npm run build
NODE_ENV=production bun run server.ts
```

In production mode, Express serves the static files from `dist/`.

> Check `package.json` for the exact script names in your version of the project.

---

## API Reference

All endpoints are served by `server.ts`. TTS endpoints return JSON with `audioBase64`, `mimeType`, and `voice`. Input text is capped at 3,000 characters per request.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Server status, whether a Gemini key is configured, and available voices |
| `POST` | `/api/tts/edge` | Free EdgeTTS synthesis. Body: `{ text, voice? }` |
| `POST` | `/api/tts/gemini` | Gemini TTS. Body: `{ text, voice? }`. Optional header `x-gemini-key` |
| `POST` | `/api/tts/openai` | OpenAI TTS. Body: `{ text, voice?, speed? }`. Requires header `x-openai-key` |
| `POST` | `/api/tts/elevenlabs` | ElevenLabs TTS. Body: `{ text, voiceId? }`. Requires header `x-elevenlabs-key` |
| `POST` | `/api/extract-webpage` | Extracts readable content from a URL. Body: `{ url }`. Returns `title`, `domain`, `url`, `content`, `excerpt`, and optional `docNavigation` |

### Example

```bash
curl -X POST http://localhost:3000/api/tts/edge \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from VoxReader!", "voice": "en-US-AriaNeural"}'
```

---

## Project Structure

```
.
├── src/             # React + TypeScript frontend
├── server.ts        # Express server: TTS proxies, webpage extraction, Vite/static hosting
├── index.html       # App entry HTML
├── vite.config.ts   # Vite configuration
├── tsconfig.json    # TypeScript configuration
├── metadata.json    # App metadata
├── .env.example     # Example environment variables
└── package.json
```

---

## Privacy & Security Notes

- User-provided API keys are forwarded only to the respective provider (Google, OpenAI, ElevenLabs) through your own server instance.
- If you deploy VoxReader publicly, consider adding rate limiting and restricting `/api/extract-webpage` (it fetches arbitrary URLs server-side) to avoid abuse.
- Never commit your `.env` file.

---

## Contributing

Issues and pull requests are welcome. For larger changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push the branch: `git push origin feature/my-feature`
5. Open a pull request

---

## License

MIT

---

## Acknowledgements

- Bootstrapped from the [Google AI Studio repository template](https://github.com/google-gemini/aistudio-repository-template)
- [`node-edge-tts`](https://www.npmjs.com/package/node-edge-tts) for free neural voices
- [Google Gemini](https://ai.google.dev/), [OpenAI](https://platform.openai.com/docs/guides/text-to-speech), and [ElevenLabs](https://elevenlabs.io/) for optional premium voices
