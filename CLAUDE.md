# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Pair

An AI writing collaborator. The AI reads as you write, thinks alongside you, and murmurs in the margin — ephemeral thoughts that appear, linger, and dissolve. No send button, no chat interface, no turns.

## Stack

Vite + React + TypeScript, Tiptap (ProseMirror) editor, Framer Motion animations, Tailwind CSS for layout, CSS custom properties for theme/typography. Server-side proxy (Vite dev middleware) routes API calls to OpenAI and Anthropic.

## Commands

```bash
npm install          # install dependencies
npm run dev          # start dev server (includes API proxy)
npm run build        # production build
npm run preview      # preview production build
npm run benchmark    # run gut prompt benchmarks (benchmark/)
```

## Architecture

### Two-Tier Cognitive Model

Every pause triggers a pipeline: Gut → (maybe) Analyst.

- **Tier 1 — Gut**: Fast instinct. Fires on every pause (2s debounce, 30-char minimum change since last trigger). Decides SPEAK or STAY QUIET. Decides whether to escalate. Model: GPT-5.4 mini via OpenAI. TTL: 6–10s (length-scaled).
- **Tier 2 — Analyst**: Structural analysis. Fires when Gut sets `escalate: true`, on Ctrl+2, or after 30s writer idle. Full-document context with structural summary. Model: Claude Opus 4.6 via Anthropic. TTL: 8–20s (length-scaled). Also sets `writer_goal` and `lens` to sharpen future gut reactions.

The null response (`silent: true`) is first-class — flow state means the AI shuts up.

### Single Sticky Note

One note visible at a time. Pinned notes take priority; otherwise the oldest active thought shows (FIFO). Thoughts queue behind the active note and display when it expires or is dismissed. Click to pin (persists past TTL); click again to unpin and restart TTL. Swipe up to dismiss on mobile.

### Responsive Layout

Wide screens (>=1100px): margin note in a sticky column to the right of the editor. Narrow screens: fixed bottom overlay with backdrop blur.

### Server Proxy

API keys never reach the client. Browser → `/api/tier/:name` → proxy (adds auth) → upstream provider. The proxy normalizes SSE from OpenAI and Anthropic into plain text chunks. Provider is inferred from model name (`claude-*` → Anthropic, otherwise → OpenAI). Tier-to-model mapping is in `server/proxy.ts`.

### Behavioral Signals

Tracked on every keystroke: typing speed, delete ratio, pause duration, cursor position. First 3 pauses calibrate the writer's baseline. Signals reported relative to baseline after calibration. Also tracks a diff of what changed since the last trigger and since the last AI reaction.

### Local Analysis

Client-side analysis runs on every trigger (zero API cost): word repetition detection, sentence rhythm uniformity, paragraph length outliers. Results are appended to the context sent to the AI.

### Context Building

Gut gets truncated context (last 3 paragraphs for long documents). Analyst gets the full document plus a structural summary (paragraph-by-paragraph character: opens, pivots, asks, develops, etc.). Both tiers receive: diff, behavioral signals, local analysis, recent thought history (PREV), viewport focus, writer goal, and lens.

### Thought Lifecycle

Thoughts stream token-by-token via `extractStreamingThought` (parses `"thought":"..."` from partial JSON). TTL is length-scaled within tier ranges. Thoughts fade out via Framer Motion AnimatePresence, then remove from DOM. Deduplication prevents repeating recent thoughts. History is kept (up to 20) for PREV context even after thoughts expire.

### Pending Queue

Only one tier call in-flight at a time. The orchestrator owns all timing — React just renders. If gut escalates, it chains directly to analyst without returning to idle. A 30s idle timer auto-fires the analyst if the writer stops typing.

## Key Source Layout

- `src/collaboration/orchestrator.ts` — Core loop: debounce, diff, trigger, stream, escalate
- `src/collaboration/thoughts.ts` — ThoughtManager: lifecycle, streaming, dedup, history
- `src/collaboration/signals.ts` — SignalTracker: keystroke tracking, baseline calibration
- `src/collaboration/context.ts` — Context block builder (truncation, structural summary)
- `src/collaboration/prompts.ts` — System prompts per tier
- `src/collaboration/local-analysis.ts` — Client-side text analysis (repetition, rhythm, outliers)
- `src/editor/Editor.tsx` — Tiptap editor with localStorage persistence
- `src/ui/MarginNote.tsx` — Desktop margin annotation (wide screens)
- `src/ui/BottomNote.tsx` — Mobile bottom overlay (narrow screens)
- `src/hooks/useTypewriter.ts` — Typewriter text reveal animation
- `src/App.tsx` — Root: wires orchestrator, thought manager, layout, keyboard shortcuts
- `server/proxy.ts` — API proxy with SSE normalization

## Keyboard Shortcuts

- **Ctrl+K** — Toggle mute (suppress all AI reactions)
- **Ctrl+1** — Force gut tier
- **Ctrl+2** — Force analyst tier

## Design Constraints

- **No meta-commentary**: The AI says the thing, not "I'm going to say the thing." Never narrate reasoning.
- **Register detection is implicit**: No mode picker. The AI reads the room from content. Journal → witness, not coaching. Argument → pressure-test. Brainstorm → riff.
- **Ephemeral by default**: Thoughts dissolve. Pinning is the only persistence mechanism.
- **Context must be lean for Gut tier**: TTFT scales with input tokens. For long documents, send only last 3 paragraphs with a summary prefix. Analyst gets the full document.
- **All tier responses are JSON**: Gut returns `{silent, thought, escalate}`. Analyst returns `{thought, thought_type, writer_goal, lens}`. Stream parsing extracts `thought` from partial JSON as tokens arrive.
- **Plain text only**: No markdown, no formatting in AI responses.
- **Light theme**: Background `#faf8f5`, text `#2c2a25`, accent gold `#9a7b2e`.

## Typography

- Body: Newsreader, 22px, weight 400, line-height 1.85
- Margin annotations: Inter 13px, weight 300, line-height 1.6

## Tier Colors

- Gut: gray tint — `rgba(140,130,110,0.06)` bg, `#7a756b` text
- Analyst: amber tint — `rgba(160,140,50,0.06)` bg, `#8a7a30` text
