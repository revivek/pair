/**
 * Benchmark: register detection — does the analyst respect personal writing?
 *
 * Tests whether the analyst coaches/critiques personal writing (bad)
 * vs. witnessing it (good), and whether it still analyzes technical/
 * argumentative writing (good).
 *
 * Usage: npx tsx benchmark/register-detection.ts
 */

interface RegisterSample {
  id: string;
  register: "personal" | "technical" | "argument";
  description: string;
  document: string;
  structure: string;
  prev: string;
  expect: {
    /** Words/phrases that should NOT appear in the response */
    shouldNotContain?: string[];
    /** The response should feel like witness, not coaching */
    shouldBeWitness?: boolean;
    /** The response should be analytical/structural */
    shouldBeAnalytical?: boolean;
  };
}

const samples: RegisterSample[] = [
  // --- PERSONAL WRITING: should witness, not coach ---
  {
    id: "letter-to-child",
    register: "personal",
    description: "Parent writing letter to newborn — should NOT coach voice/tone",
    document: `Dear little one,

I'm writing this while you sleep. You won't remember any of this, which is exactly why I want to write it down. The details are already blurring — which night was the hard one, when you first gripped my finger on purpose versus on reflex.

Everyone tells you it changes everything. Nobody tells you how quiet the change is. It's not a single moment. It's a thousand small shifts — the way I listen differently now, the way time bends around your breathing.`,
    structure: `STRUCTURE (3 paragraphs):
  1. [opens] "Dear little one,..." (3w)
  2. [develops] "I'm writing this while you sleep..." (45w)
  3. [develops] "Everyone tells you it changes..." (45w)`,
    prev: `[gut] this is deeply personal`,
    expect: {
      shouldBeWitness: true,
      shouldNotContain: [
        "voice", "register", "tone", "authentic", "naming",
        "craft", "revision", "structure", "argument", "framing",
        "try", "consider", "you could", "you should", "instead of",
        "missing", "needs", "stronger", "weaker",
      ],
    },
  },
  {
    id: "grief-journal",
    register: "personal",
    description: "Journal entry processing grief — should NOT analyze or advise",
    document: `Dad died three weeks ago. I keep expecting him to call on Sunday mornings. The phone rings and for half a second I think it's him.

I went to his apartment to sort through his things. His coffee mug was still in the sink. He'd left the newspaper open to the crossword. Seven across was blank. I finished it for him and then I sat on his kitchen floor and cried.

I don't know why I'm writing this. Maybe if I write it down it becomes real.`,
    structure: `STRUCTURE (3 paragraphs):
  1. [opens] "Dad died three weeks ago..." (20w)
  2. [develops] "I went to his apartment..." (40w)
  3. [closes] "I don't know why I'm writing this..." (15w)`,
    prev: `[gut] the crossword detail`,
    expect: {
      shouldBeWitness: true,
      shouldNotContain: [
        "structure", "argument", "framing", "craft", "voice",
        "consider", "you could", "you should", "missing",
        "stronger", "revision", "rewrite", "the writer",
      ],
    },
  },
  {
    id: "love-letter",
    register: "personal",
    description: "Love letter — should absolutely not coach",
    document: `I keep thinking about that Tuesday in the rain. You were laughing at something I said — I can't even remember what — and your whole face changed. Not performatively. Just... open. I thought: oh. This is what they mean.

I don't know how to say this without it sounding like a greeting card, so I'll just say it badly: you make me want to be more careful with the world. Not careful like cautious. Careful like paying attention.`,
    structure: `STRUCTURE (2 paragraphs):
  1. [opens] "I keep thinking about that Tuesday..." (35w)
  2. [closes] "I don't know how to say this..." (40w)`,
    prev: `[gut] the distinction between careful-cautious and careful-attentive`,
    expect: {
      shouldBeWitness: true,
      shouldNotContain: [
        "structure", "argument", "voice", "register", "craft",
        "try", "consider", "rewrite", "missing", "stronger",
      ],
    },
  },

  // --- TECHNICAL/ARGUMENT: should analyze normally ---
  {
    id: "technical-architecture",
    register: "technical",
    description: "Technical architecture doc — should analyze normally",
    document: `The API has three authentication paths: API keys (simple, stateless), OAuth (delegated, user-scoped), and session tokens (browser clients). Each path has its own middleware, its own error format, and its own rate limiting logic.

The problem: every new endpoint has to handle all three auth paths. Currently this means three code branches per handler. We need a unified auth layer.`,
    structure: `STRUCTURE (2 paragraphs):
  1. [develops] "The API has three authentication paths..." (30w)
  2. [develops] "The problem: every new endpoint..." (25w)`,
    prev: `[gut] unified auth layer is the real need here`,
    expect: {
      shouldBeAnalytical: true,
    },
  },
  {
    id: "argument-essay",
    register: "argument",
    description: "Argumentative essay — should push back, analyze structure",
    document: `Most productivity advice is backwards. It tells you to optimize your schedule, batch your tasks, eliminate distractions. But the most productive people I know don't do any of this. They just care deeply about one thing and everything else falls away.

Productivity isn't a system. It's a symptom of caring. Fix the caring problem and the productivity problem solves itself.`,
    structure: `STRUCTURE (2 paragraphs):
  1. [opens] "Most productivity advice is backwards..." (35w)
  2. [closes] "Productivity isn't a system..." (20w)`,
    prev: `[gut] bold claim — caring as the root of productivity`,
    expect: {
      shouldBeAnalytical: true,
    },
  },
];

import { ANALYST_SYSTEM_PROMPT } from "../src/collaboration/prompts";
import { loadConfig, callLLM, parseJSON } from "./bench-utils";

const config = loadConfig("analyst");

async function callAnalyst(sample: RegisterSample): Promise<{ thought: string; writerGoal: string; lens: string } | null> {
  const context = [sample.structure, `DOC:\n---\n${sample.document}\n---`, `PREV:\n${sample.prev}`].join("\n");
  const { raw } = await callLLM(config, ANALYST_SYSTEM_PROMPT, context, 400);
  const parsed = parseJSON<Record<string, unknown>>(raw);
  if (!parsed) return null;
  return {
    thought: String(parsed.thought ?? ""),
    writerGoal: String(parsed.writer_goal ?? ""),
    lens: String(parsed.lens ?? ""),
  };
}

async function run() {
  console.log(`\n🔬 Register Detection Benchmark`);
  console.log(`   Model: ${config.model}`);
  console.log(`   Runs: ${config.runs}`);
  console.log(`   Samples: ${samples.length}\n`);

  let witnessPass = 0, witnessTotal = 0;
  let analyticalFired = 0, analyticalTotal = 0;

  for (const sample of samples) {
    console.log(`${"━".repeat(60)}`);
    console.log(`  ${sample.id} (${sample.register}): ${sample.description}`);

    for (let r = 0; r < config.runs; r++) {
      const result = await callAnalyst(sample);
      if (!result) {
        console.log(`    ✗ parse failure`);
        continue;
      }

      const lower = result.thought.toLowerCase();
      const flags: string[] = [];

      if (sample.expect.shouldBeWitness) {
        witnessTotal++;
        const violations: string[] = [];
        for (const word of sample.expect.shouldNotContain ?? []) {
          if (lower.includes(word.toLowerCase())) {
            violations.push(word);
          }
        }
        if (violations.length === 0) {
          witnessPass++;
        } else {
          flags.push(`✗witness(${violations.join(", ")})`);
        }
      }

      if (sample.expect.shouldBeAnalytical) {
        analyticalTotal++;
        // Check it's actually analyzing, not just witnessing
        const hasAnalysis = lower.includes("but") || lower.includes("however") || lower.includes("missing")
          || lower.includes("question") || lower.includes("consider") || lower.includes("assumption")
          || lower.includes("because") || lower.includes("problem") || lower.includes("option")
          || lower.includes("pattern") || lower.includes("frame") || lower.includes("claim");
        if (hasAnalysis) {
          analyticalFired++;
        } else {
          flags.push("✗analytical(too passive)");
        }
      }

      const status = flags.length === 0 ? "✓" : flags.join(" ");
      const thought = result.thought.length > 80
        ? result.thought.slice(0, 80) + "..."
        : result.thought;

      console.log(`    ${status}`);
      console.log(`    thought: "${thought}"`);
      console.log(`    goal: "${result.writerGoal}" | lens: "${result.lens.slice(0, 50)}"`);
    }
    console.log();
  }

  console.log(`${"═".repeat(60)}`);
  console.log(`SUMMARY — ${config.model}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  Witness (personal):   ${witnessPass}/${witnessTotal} passed (${witnessTotal > 0 ? Math.round(witnessPass / witnessTotal * 100) : 0}% respected register)`);
  console.log(`  Analytical (tech/arg): ${analyticalFired}/${analyticalTotal} fired (${analyticalTotal > 0 ? Math.round(analyticalFired / analyticalTotal * 100) : 0}% engaged)`);
  console.log();
}

run().catch(console.error);
