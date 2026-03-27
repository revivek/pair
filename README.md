# Pair

Pair is a writing collaborator that reads as you write. No send button, no chat interface, no turns. You write; it thinks alongside you, and when it has something worth saying, a quiet note appears in the margin and then recedes. When it has nothing to add, it stays quiet.

<!-- TODO: add screenshot or GIF here -->

Bring a question you're wrestling with and start writing.

> This is a research prototype, not a maintained project. It works, it's fun to write with, and the code is yours to learn from or build on.

## Try it

You'll need Node 22+ and API keys for the model providers you plan to use. The default configuration uses **both** OpenAI (gut tier) and Anthropic (analyst tier), so you'll need keys for both unless you override the models (see [Configuration](#configuration)).

### Prerequisites

- **Node 22+** — an `.nvmrc` is included, so if you use [nvm](https://github.com/nvm-sh/nvm): `nvm use`
- API keys for [OpenAI](https://platform.openai.com/api-keys) and/or [Anthropic](https://console.anthropic.com/)

### Install

```bash
git clone <repo-url> && cd pair
npm install
cp .env.example .env
```

Edit `.env` and replace the placeholder values with your real keys:

```
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
```

> **Tip:** If you only have one provider's key, set both `TIER1_MODEL` and `TIER2_MODEL` to models from that provider. For example, to use only Anthropic: `TIER1_MODEL=claude-haiku-4-5-20251001` and `TIER2_MODEL=claude-opus-4-6`. See [Configuration](#configuration) for details.

### Run

```bash
npm run dev
```

Open `http://localhost:3000`. Start writing.

> If port 3000 is already in use, Vite will automatically pick the next available port and print it in the terminal output.

## How it works

Pair has two tiers of thinking:

- **Gut** — fast, instinctive, fires automatically when you pause. One sentence in the margin. Uses GPT-5.4 mini.
- **Analyst** — deeper, structural, fires when the gut escalates or when you ask (Ctrl+2). Uses Claude Opus 4.6.

Only one note is visible at a time. Notes fade after a few seconds. Click a note to pin it; click again to unpin.

The collaborator adjusts as it reads. It tracks what you've written, what you've deleted, where your cursor is, and what it's already said — so it doesn't repeat itself and its reactions stay relevant to where you are in the piece.

## Keyboard shortcuts

| Shortcut | What it does |
|---|---|
| `Ctrl+1` | Ask for a quick reaction now |
| `Ctrl+2` | Ask for a deeper thought now |
| `Ctrl+K` | Mute / unmute the collaborator |

`Cmd` works in place of `Ctrl` on macOS.

## Configuration

All configuration lives in `.env` (server-side, never sent to the browser):

| Variable | Required | Default |
|---|---|---|
| `OPENAI_API_KEY` | If using any OpenAI model | — |
| `ANTHROPIC_API_KEY` | If using any Anthropic model | — |
| `TIER1_MODEL` | No | `gpt-5.4-mini` |
| `TIER2_MODEL` | No | `claude-opus-4-6` |

Both tiers accept any OpenAI or Anthropic model — the provider is inferred from the model name (`claude-*` → Anthropic, otherwise → OpenAI). You only need the API key(s) for the provider(s) you're actually using.

> **Important:** The default models (`gpt-5.4-mini` and `claude-opus-4-6`) require access to those specific models on your API accounts. If you get API errors at runtime, check that your keys have access to the configured models, or override them with models you do have access to.

## Architecture

Vite + React + TypeScript. Tiptap (ProseMirror) editor. All collaboration timing lives in an orchestrator class — not React — to avoid render/timer race conditions. A Vite dev middleware proxy adds API keys and forwards to OpenAI/Anthropic; keys never reach the browser.

## Benchmarks

Prompt quality is benchmark-driven. We test tone, register detection, escalation decisions, and the full gut-to-analyst flow against sample documents.

```bash
npm run benchmark                        # gut prompt evaluation
npx tsx benchmark/tone-benchmark.ts      # tone and voice
npx tsx benchmark/trailing-text.ts       # incomplete text handling
npx tsx benchmark/register-detection.ts  # personal vs analytical register
npx tsx benchmark/sequence.ts            # end-to-end escalation flow
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Dev server starts but API calls fail silently | Check that `.env` has real API keys (not the placeholder values from `.env.example`) |
| API returns 4xx errors at runtime | Verify your API key has access to the configured model (e.g. `gpt-5.4-mini`). Override with `TIER1_MODEL` / `TIER2_MODEL` if needed |
| "Open localhost:3000" but nothing loads | Check terminal — Vite may have picked a different port if 3000 was in use |
| `npm install` warns about Node version | This project requires Node 22+. Run `nvm use` if you have nvm installed |

## License

[MIT](LICENSE)
