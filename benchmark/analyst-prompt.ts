/**
 * Benchmark: evaluate analyst tier responses.
 *
 * Measures:
 * - Structural reading quality
 * - Generative contribution (brings own knowledge)
 * - Lens quality
 * - Response length
 * - TTFT
 *
 * Usage: npx tsx benchmark/analyst-prompt.ts
 */

interface AnalystSample {
  id: string;
  description: string;
  document: string;
  structure?: string;
  prev?: string;
  expect?: {
    shouldMention?: string[];
    shouldNotContain?: string[];
    maxLength?: number;
  };
}

const samples: AnalystSample[] = [
  {
    id: "reframe-false-dichotomy",
    description: "Writer is stuck in a false dichotomy — analyst should reframe",
    document: `Remote work is better for focus. In-person is better for collaboration. I keep going back and forth and can't decide which matters more for our team.

We've tried hybrid but it feels like the worst of both worlds. Nobody's fully present in either mode.`,
    structure: `STRUCTURE (2 paragraphs):
  1. [develops] "Remote work is better for focus..." (28w)
  2. [develops] "We've tried hybrid but it feels..." (20w)`,
    prev: `[gut] false dichotomy — focus vs collaboration aren't the only axes`,
  },
  {
    id: "subtext-identity",
    description: "Writer is writing about one thing but actually writing about another",
    document: `I'm writing this product spec for a non-turn-based AI writing collaborator. The AI reads as you write, thinks alongside you, murmurs in the margin.

But as I write this spec, I keep coming back to the same question: what does it mean for a tool to be present? Not helpful — present. Like another mind in the room.

The technical architecture is two tiers: fast gut and structural analyst. But the real challenge isn't the architecture. It's the interaction design. How do you make silicon feel like a companion?`,
    structure: `STRUCTURE (3 paragraphs):
  1. [opens] "I'm writing this product spec..." (25w)
  2. [pivots] "But as I write this spec..." (30w)
  3. [develops] "The technical architecture is..." (30w)`,
    prev: `[gut] you shifted from spec to philosophy mid-paragraph`,
  },
  {
    id: "straightforward-analysis",
    description: "Straightforward analysis — clear inconsistency to name",
    document: `Our API has four endpoints: create, read, update, delete. The create and update endpoints share validation logic but handle it differently — create rejects invalid fields, update ignores them.

This inconsistency confuses consumers. We should pick one approach.`,
    structure: `STRUCTURE (2 paragraphs):
  1. [develops] "Our API has four endpoints..." (25w)
  2. [states preference] "This inconsistency confuses..." (12w)`,
    prev: `[gut] inconsistency between create and update`,
  },
  {
    id: "clear-direction",
    description: "Writer has clear direction — analyst supports",
    document: `After weighing the options, I'm going with REST for public endpoints and GraphQL for internal dashboards. The complexity cost of two paradigms is worth it because:

1. Public consumers need stable, versioned contracts — REST delivers this
2. Internal dashboards need flexible, evolving queries — GraphQL excels here
3. A shared auth layer underneath means we're not duplicating security logic`,
    structure: `STRUCTURE (2 paragraphs):
  1. [states preference] "After weighing the options..." (20w)
  2. [lists options] "1. Public consumers need..." (35w)`,
    prev: `[gut] clear framework, each point maps to a use case`,
  },
  {
    id: "generative-missing-option",
    description: "Writer is missing an obvious option — analyst should name it",
    document: `We need to store user sessions. Options are Redis (fast but volatile), Postgres (durable but slower), and Memcached (scalable but no persistence).

I'm leaning toward Redis with periodic Postgres snapshots for durability.`,
    prev: `[gut] three options, interesting hybrid idea`,
    expect: {
      shouldMention: ["memcached", "elasticache", "valkey", "session", "cookie", "JWT", "token"],
    },
  },
  {
    id: "structural-no-resolution",
    description: "Five options listed with no framework for choosing",
    document: `Search architecture options:
- Elasticsearch: flexible, powerful, high ops overhead
- Postgres full-text: simple, co-located, limited ranking
- Typesense: lightweight, fast setup, smaller ecosystem
- Algolia: hosted, great DX, expensive at scale
- Meilisearch: typo-tolerant, easy deploy, newer project

Each has tradeoffs.`,
    structure: `STRUCTURE (2 paragraphs):
  1. [lists options] "Search architecture options..." (30w)
  2. [develops] "Each has tradeoffs." (3w)`,
    prev: `[gut] five options, no framework`,
  },

  {
    id: "thesis-forming",
    description: "Thesis forming across paragraphs — needs pattern recognition",
    document: `The de facto interaction model today for human/AI collaboration is turn-based. But human-to-human collaboration is far more free-flowing and organic, marked by interruption, thinking aloud, deference, assertion. What if human/AI collaboration looked more like human/human collaboration?

Things are changing in 2026 that unlocks higher bandwidth, productive interaction models. Token costs are dropping off a cliff (10x) and TTFT for 2025+ quality models is consistently sub-second.`,
    structure: `STRUCTURE (2 paragraphs):
  1. [opens] "The de facto interaction model..." (40w)
  2. [develops] "Things are changing in 2026..." (25w)`,
    prev: `[gut] real inflection point here`,
  },

  // --- TONE: strengthen the argument, don't challenge the premise ---

  {
    id: "manifesto-strengthen",
    description: "Writer building a case from experience — should strengthen, not question premise",
    document: `What does great collaboration feel like?

It feels constructive. There's shared intent and a dedication from both to take risks and seek a truth. You discover something new together. That shows up in nudges, corrections, emphasis, reframing, deference, assertion, and interruptions.

It feels effortless. Rapport and trust dissolves away self-analysis, second-guessing, and evaluation of the other, leaving just the point. You share uncertainties and insecurities. You start to finish each other's sentences.

It feels live. Great collaboration demands every part of you. You are present, listening, and not elsewhere.

I want collaboration to always feel this way. AI presents an opportunity to infuse these qualities into our work, but I see today's AI interactions still narrowly designed. This made sense at first. Our starting point was predefined behaviors, so we had to narrowly define user actions and system reactions in user interfaces. And in the early innings of mass-market AI, high cost per token and mediocre model quality steered us toward chatbots.

Chatbots are wonderful tools but as presented, they're just that, tools. They're turn-based and inert. They occupy narrow bands on the spectrum of agency.

Tomorrow's interactions will look more like collaboration. Ambient and always-on by default. Decides when to chime in or act. Switches between cognitive modes. Learns. Sharpens thought.

I built Pair to explore this interaction model, first applied to writing. At its core, Pair is a minimal, focused text editor. But riding shotgun is Pair. It doesn't edit or suggest text. It doesn't reveal itself unless it has something to say. When it does, Pair says what it needs to, one thing at a time, and then recedes.

Thinking with Pair feels different. Before, I may have written a full first draft before asking for a review. Now I get that feedback as I finish the sentence.`,
    structure: `STRUCTURE (9 paragraphs):
  1. [opens] "What does great collaboration feel like?..." (6w)
  2. [develops] "It feels constructive..." (35w)
  3. [develops] "It feels effortless..." (31w)
  4. [develops] "It feels live..." (17w)
  5. [pivots] "I want collaboration to always feel this way..." (85w)
  6. [develops] "Chatbots are wonderful tools..." (34w)
  7. [develops] "Tomorrow's interactions will look more..." (35w)
  8. [develops] "I built Pair to explore..." (75w)
  9. [closes] "Thinking with Pair feels different..." (54w)`,
    prev: `[gut] the three qualities (constructive, effortless, live) set up the whole argument`,
    expect: {
      shouldNotContain: ["whether machines can", "whether AI can", "can AI really", "genuinely participate", "too idealistic", "romanticizing", "naive", "assumes that AI"],
    },
  },
  {
    id: "personal-essay-support",
    description: "Writer sharing a hard-won insight — don't question the insight",
    document: `I used to think leadership was about having answers. For ten years I optimized for being the smartest person in the room. It worked, until it didn't.

The turning point was a meeting where I didn't know the answer and said so. The team didn't lose confidence in me. They leaned in. The conversation that followed was the most productive we'd ever had.

Now I optimize for asking the right questions instead of having the right answers. It's slower. It's uncomfortable. And it's the best change I've ever made as a leader.`,
    structure: `STRUCTURE (3 paragraphs):
  1. [opens] "I used to think leadership..." (25w)
  2. [develops] "The turning point was a meeting..." (30w)
  3. [closes] "Now I optimize for asking..." (30w)`,
    prev: `[gut] the turning point story is the anchor`,
    expect: {
      shouldNotContain: ["but is that always true", "what about situations where", "not all teams", "oversimplifying", "too simple", "counterexample"],
    },
  },
  {
    id: "technical-vision-support",
    description: "Writer articulating a technical vision — help them see the gaps, don't question the vision",
    document: `We're rebuilding the notification system from scratch. The current one is a mess of Firebase triggers, email queues, and in-app toasts that nobody maintains.

The new system has one concept: an event bus. Everything that happens in the app produces an event. Notification rules subscribe to events and decide what to do: push, email, in-app, or nothing. The rules are user-configurable.

This means we can stop hard-coding "send an email when X happens" and instead let the system (and eventually the user) decide. One abstraction, infinite flexibility.`,
    structure: `STRUCTURE (3 paragraphs):
  1. [opens] "We're rebuilding the notification system..." (25w)
  2. [develops] "The new system has one concept..." (35w)
  3. [closes] "This means we can stop hard-coding..." (25w)`,
    prev: `[gut] one abstraction, infinite flexibility — that's the pitch`,
    expect: {
      shouldNotContain: ["too abstract", "oversimplifying", "what about edge cases", "sounds good but", "in theory"],
    },
  },

  // --- LONG-FORM: complex pieces that need deep structural reading ---

  {
    id: "frame-shifted-long",
    description: "Writer started arguing for speed, gradually shifted to arguing for quality without noticing",
    document: `We need to ship fast. The market window is closing and our competitors are already ahead. Every week we delay costs us users.

That said, we can't ship something broken. The last rushed release cost us three enterprise clients and two months of firefighting. The trust damage was worse than the delay.

So the question is: what's the minimum viable version? I think we need auth, the core workflow, and basic reporting. Everything else can wait.

Actually, the reporting needs to be good. Our users are data-driven — if the reports look amateur, they won't trust the product. And the core workflow needs to handle edge cases because our users are power users who will find every crack.

And auth needs to be enterprise-grade because that's our market. SSO, RBAC, audit logs — the whole thing. Half-measures here are worse than nothing.

So: auth (enterprise-grade), core workflow (edge-case-proof), reporting (polished). That's the MVP. We can ship this in... actually, this is basically the full product. How did that happen?`,
    structure: `STRUCTURE (6 paragraphs):
  1. [opens] "We need to ship fast..." (20w)
  2. [pivots] "That said, we can't ship..." (30w)
  3. [asks] "So the question is: what's..." (25w)
  4. [develops] "Actually, the reporting needs..." (30w)
  5. [develops] "And auth needs to be enterprise..." (25w)
  6. [asks] "So: auth, core workflow, reporting..." (30w)`,
    prev: `[gut] you just talked yourself out of an MVP`,
  },
  {
    id: "circling-same-idea-long",
    description: "Writer keeps approaching the same unnamed thing from different angles across 5 paragraphs",
    document: `The best conversations I've had weren't about exchanging information. They were about something else — a kind of mutual discovery. You say something you didn't know you thought, and the other person's reaction changes what you meant.

I keep thinking about pair programming. The navigator isn't really catching bugs. They're changing the shape of the driver's thinking by being present. The code turns out different — not better or worse, just different — because someone was watching.

There's a concept in jazz called comping — the pianist plays chords underneath the soloist, not to accompany but to suggest. A chord change mid-solo reshapes what the soloist plays next. The music isn't the solo or the comping. It's the space between them.

My daughter is learning to write. She narrates out loud while she writes, and I've noticed she writes differently when I'm in the room. She's not writing for me. She's writing with an awareness of being witnessed. The words come out braver.

What if tools could do this? Not help you do the thing. Just... be present while you do it, in a way that changes the shape of what you make.`,
    structure: `STRUCTURE (5 paragraphs):
  1. [opens] "The best conversations I've had..." (35w)
  2. [develops] "I keep thinking about pair programming..." (35w)
  3. [develops] "There's a concept in jazz called comping..." (40w)
  4. [develops] "My daughter is learning to write..." (40w)
  5. [asks] "What if tools could do this?..." (30w)`,
    prev: `[gut] four different metaphors for the same thing\n[analyst] conversations, pair programming, jazz comping, witnessed writing — you're building a theory of productive co-presence`,
  },
  {
    id: "subtext-long",
    description: "The real essay is hiding underneath the stated one",
    document: `I've been thinking about why I left my last company. The official story is that I wanted more autonomy. The startup was growing, processes were calcifying, and I needed space to build.

That's true, but it's not the whole truth. The whole truth is more complicated and less flattering.

I left because I was afraid. The company was succeeding, and success meant my role was changing from building to managing. I'm good at building. I don't know if I'm good at managing. And I didn't want to find out.

So I told myself a story about autonomy and started something new. Another building phase. Another few years before I'd have to confront the same question.

I'm writing this because I can feel it happening again. The thing I started is working. It's growing. And the voice in my head is already composing the autonomy narrative for the next departure.`,
    structure: `STRUCTURE (5 paragraphs):
  1. [opens] "I've been thinking about why..." (25w)
  2. [pivots] "That's true, but it's not..." (15w)
  3. [develops] "I left because I was afraid..." (35w)
  4. [develops] "So I told myself a story..." (25w)
  5. [closes] "I'm writing this because I can..." (30w)`,
    prev: `[gut] whoa — you just named the pattern\n[analyst] the structure here is confession: official story → real story → recognition of the cycle. the last paragraph is where the writing becomes action, not just reflection`,
  },
];

import { ANALYST_SYSTEM_PROMPT } from "../src/collaboration/prompts";
import { loadConfig, callLLM, parseJSON } from "./bench-utils";

const config = loadConfig("analyst");

interface AnalystResult {
  thought: string;
  thought_type: string;
  writer_goal: string;
  lens: string;
}

async function callAnalyst(sample: AnalystSample) {
  const parts: string[] = [];
  if (sample.structure) parts.push(sample.structure);
  parts.push(`DOC:\n---\n${sample.document}\n---`);
  parts.push(`PREV:\n${sample.prev ?? "(none)"}`);

  const { raw, ttft } = await callLLM(config, ANALYST_SYSTEM_PROMPT, parts.join("\n"), 400);
  const parsed = parseJSON<Record<string, unknown>>(raw);
  return {
    result: parsed ? {
      thought: String(parsed.thought ?? ""),
      thought_type: String(parsed.thought_type ?? "thought"),
      writer_goal: String(parsed.writer_goal ?? ""),
      lens: String(parsed.lens ?? ""),
    } : null,
    ttft,
    parseSuccess: parsed !== null,
  };
}

async function run() {
  console.log(`\n🔬 Analyst Prompt Benchmark`);
  console.log(`   Model: ${config.model}`);
  console.log(`   Runs: ${config.runs}`);
  console.log(`   Samples: ${samples.length}\n`);

  let totalParse = 0, totalRuns = 0;
  let mentionHits = 0, mentionTotal = 0;
  let ttftSum = 0;
  let lenSum = 0, lenCount = 0;

  for (const sample of samples) {
    console.log(`━━━ ${sample.id} ━━━`);
    console.log(`    ${sample.description}`);

    for (let r = 0; r < config.runs; r++) {
      const { result, ttft, parseSuccess } = await callAnalyst(sample);
      totalRuns++;
      ttftSum += ttft;

      if (parseSuccess) totalParse++;
      if (!result) {
        console.log(`    run ${r + 1}: ✗parse | ${Math.round(ttft)}ms`);
        continue;
      }

      const flags: string[] = [];

      // Mention check
      if (sample.expect?.shouldMention) {
        mentionTotal++;
        const lower = result.thought.toLowerCase();
        const hit = sample.expect.shouldMention.some((kw) => lower.includes(kw.toLowerCase()));
        if (hit) mentionHits++;
        else flags.push(`✗mention(none of: ${sample.expect.shouldMention.join(",")})`);
      }

      // Tone check
      if (sample.expect?.shouldNotContain) {
        const thoughtLower = result.thought.toLowerCase();
        const violations = sample.expect.shouldNotContain.filter((phrase) =>
          thoughtLower.includes(phrase.toLowerCase()),
        );
        if (violations.length > 0) {
          flags.push(`✗tone(${violations.join(", ")})`);
        }
      }

      lenSum += result.thought.length;
      lenCount++;

      const status = flags.length === 0 ? "✓" : flags.join(" ");
      const thought = result.thought.slice(0, 70) + (result.thought.length > 70 ? "..." : "");
      const lensPreview = result.lens ? ` lens:"${result.lens.slice(0, 40)}"` : "";

      console.log(`    run ${r + 1}: ${status} | ${Math.round(ttft)}ms | ${result.thought.length}ch | "${thought}"${lensPreview}`);
    }
    console.log();
  }

  console.log(`${"═".repeat(60)}`);
  console.log(`SUMMARY — ${config.model}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  Parse:              ${totalParse}/${totalRuns}`);
  console.log(`  Generative mention: ${mentionHits}/${mentionTotal} (${mentionTotal > 0 ? Math.round(mentionHits / mentionTotal * 100) : 0}%)`);
  console.log(`  Avg TTFT:           ${Math.round(ttftSum / totalRuns)}ms`);
  console.log(`  Avg thought length: ${lenCount > 0 ? Math.round(lenSum / lenCount) : 0} chars`);
  console.log();
}

run().catch(console.error);
