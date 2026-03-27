# Pair

Pair is a writing collaborator that reads as you write. No send button, no chat interface, no turns. You write; it thinks alongside you, and when it has something worth saying, a quiet note appears in the margin and then recedes. When it has nothing to add, it stays quiet.

<!-- TODO: add screenshot or GIF here -->

Bring a question you're wrestling with and start writing.

> This is a research prototype, not a maintained project. It works, it's fun to write with, and the code is yours to learn from or build on.

## Try it

You'll need Node 18+ and API keys for the model providers you plan to use. The default configuration uses **both** OpenAI (gut tier) and Anthropic (analyst tier), so you'll need keys for both unless you override the models in `.env`.

### Prerequisites

- **Node 18+**
- API keys for [OpenAI](https://platform.openai.com/api-keys) and/or [Anthropic](https://console.anthropic.com/)

### Install

```bash
git clone https://github.com/revivek/pair.git && cd pair
npm install
cp .env.example .env
```

Edit `.env` and replace the placeholder values with your real keys:

```
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
```

> **Tip:** If you only have one provider's key, set both `TIER1_MODEL` and `TIER2_MODEL` to models from that provider. For example, to use only Anthropic: `TIER1_MODEL=claude-haiku-4-5-20251001` and `TIER2_MODEL=claude-opus-4-6`. See `.env.example` for all options.

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

## Benchmarks

Prompt quality is benchmark-driven. We test tone, register detection, escalation decisions, and the full gut-to-analyst flow against sample documents.

```bash
npm run benchmark
```

This runs all five benchmark suites: gut prompt evaluation, tone and voice, incomplete text handling, register detection, and end-to-end escalation flow.

## Setup with Claude Code

If you have [Claude Code](https://claude.ai/code) installed, you can paste this prompt to set up the project:

> Clone https://github.com/revivek/pair, install dependencies, copy .env.example to .env, ask me for my API keys, add them to .env, and run `npm run dev`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Dev server starts but API calls fail silently | Check that `.env` has real API keys (not the placeholder values from `.env.example`) |
| API returns 4xx errors at runtime | Verify your API key has access to the configured model (e.g. `gpt-5.4-mini`). Override with `TIER1_MODEL` / `TIER2_MODEL` if needed |
| "Open localhost:3000" but nothing loads | Check terminal — Vite may have picked a different port if 3000 was in use |
| `npm install` warns about Node version | This project requires Node 18+ |

## License

[MIT](LICENSE)
