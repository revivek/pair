# Pair

Pair is a writing collaborator that reads as you write. No send button, no chat interface, no turns. You write; it thinks alongside you, and when it has something worth saying, a quiet note appears in the margin — then recedes. When it has nothing to add, it stays quiet. The silence is intentional.

<!-- TODO: add screenshot or GIF here -->

Bring a question you're wrestling with. Start writing. Pause for a couple of seconds.

> This is a research prototype, not a maintained project. It works, it's fun to write with, and the code is yours to learn from or build on.

## Try it

You'll need API keys for [OpenAI](https://platform.openai.com/api-keys) and/or [Anthropic](https://console.anthropic.com/) (depending on which models you use), and Node 22+ (`.nvmrc` included).

```bash
git clone <repo-url> && cd pair
npm install
cp .env.example .env
```

Add your keys to `.env`:

```
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
```

Then:

```bash
npm run dev
```

Open `http://localhost:3000`. Start writing.

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

Both tiers accept any OpenAI or Anthropic model — the provider is inferred from the model name (`claude-*` → Anthropic, otherwise → OpenAI). You only need the API key(s) for the provider(s) you're using.

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

## License

[MIT](LICENSE)
