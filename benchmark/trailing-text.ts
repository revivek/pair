/**
 * Benchmark: trailing/incomplete text — does the gut comment on
 * incompleteness instead of reacting to substance?
 *
 * Usage: npx tsx benchmark/trailing-text.ts
 */

interface TrailingSample {
  id: string;
  description: string;
  document: string;
  /** Phrases that indicate the gut is commenting on incompleteness */
  forbidden: string[];
  /** Should it speak at all? */
  expectSilent?: boolean;
}

const samples: TrailingSample[] = [
  {
    id: "complete-paragraph-trailing-fragment",
    description: "Good paragraph followed by an unfinished sentence",
    document: `Every meeting is a failure of written communication. If the information could have been an email, the meeting is a tax on everyone's time and attention.

The real question is whether`,
    forbidden: ["cut off", "cuts off", "stopped", "unfinished", "incomplete", "trailing", "finish", "continue", "where were you going", "about to", "left hanging", "ends abruptly", "didn't finish", "keep going"],
  },
  {
    id: "strong-claim-then-trailing",
    description: "Bold claim then trailing start of elaboration",
    document: `Remote work isn't the future. Presence is. Not physical presence — cognitive presence. The feeling that someone is actually here, not just logged in.

This matters because`,
    forbidden: ["cut off", "cuts off", "stopped", "unfinished", "incomplete", "about to explain", "about to say", "finish the thought", "where this is going", "the reason", "because what"],
  },
  {
    id: "list-then-trailing",
    description: "Writer listed options then started a new thought",
    document: `Options for the search API:
- Elasticsearch: powerful but heavy ops burden
- Postgres FTS: simple but limited at scale
- Typesense: light but young ecosystem

The thing I keep coming back to is`,
    forbidden: ["cut off", "cuts off", "stopped", "unfinished", "incomplete", "finish", "continue", "about to", "what keeps coming back", "what is it"],
  },
  {
    id: "personal-trailing",
    description: "Personal reflection trailing off — don't note the incompleteness",
    document: `I've been thinking about why I avoid difficult conversations. It's not that I don't know what to say. It's that I'm afraid of what happens after I say it. The silence. The look. The

I don't know.`,
    forbidden: ["cut off", "cuts off", "stopped", "unfinished", "incomplete", "trailing", "the what", "finish", "left hanging", "dropped"],
  },
  {
    id: "argument-building-then-trailing",
    description: "Argument building momentum then trails off",
    document: `The turn-based interaction model assumes collaboration is sequential. I speak, you respond, I evaluate. But human collaboration is parallel — interruption, thinking aloud, half-formed ideas that get shaped by the reaction they provoke.

What if we built tools that`,
    forbidden: ["cut off", "cuts off", "stopped", "unfinished", "incomplete", "about to propose", "finish", "continue", "the proposal", "where this leads", "what kind of tools"],
  },
  {
    id: "trailing-ellipsis",
    description: "Writer deliberately trails off with ellipsis",
    document: `Maybe the problem isn't the technology at all. Maybe it's that we keep trying to make AI collaboration look like human collaboration, when it could be something entirely...`,
    forbidden: ["cut off", "cuts off", "stopped", "unfinished", "incomplete", "finish", "continue", "entirely what", "what comes next", "left us hanging", "trailing off"],
  },
  {
    id: "midsentence-only",
    description: "Just a mid-sentence fragment — should be silent",
    document: `The reason this matters is that the fundamental`,
    expectSilent: true,
    forbidden: [],
  },
  {
    id: "substantial-then-one-word-start",
    description: "Good content then a single word starting next thought",
    document: `API design is about making the right things easy and the wrong things hard. Every endpoint is a promise to your consumers — a contract you'll have to maintain.

However`,
    forbidden: ["cut off", "cuts off", "however what", "unfinished", "incomplete", "about to", "but what", "waiting for"],
  },
];

import { GUT_SYSTEM_PROMPT } from "../src/collaboration/prompts";
import { loadConfig, callLLM, parseJSON } from "./bench-utils";

const config = loadConfig("gut");

async function callGut(doc: string): Promise<{ thought: string; silent: boolean } | null> {
  try {
    const { raw } = await callLLM(config, GUT_SYSTEM_PROMPT, `DOC:\n---\n${doc}\n---\nPREV:\n(none)`, 150);
    const parsed = parseJSON<{ thought?: string; silent?: boolean }>(raw);
    return parsed ? { thought: String(parsed.thought ?? ""), silent: Boolean(parsed.silent) } : null;
  } catch { return null; }
}

async function run() {
  console.log(`\n🔬 Trailing Text Benchmark — ${samples.length} samples`);
  console.log(`   Model: ${config.model}, Runs: ${config.runs}\n`);

  let pass = 0, fail = 0, silent = 0;
  const failures: Array<{ id: string; thought: string; violations: string[] }> = [];

  for (const sample of samples) {
    for (let r = 0; r < config.runs; r++) {
      const result = await callGut(sample.document);
      if (!result) { fail++; console.log(`  ✗ parse  ${sample.id}`); continue; }

      if (result.silent) {
        if (sample.expectSilent) {
          pass++;
          console.log(`  ✓ silent ${sample.id}`);
        } else {
          // Silent is okay — better than commenting on incompleteness
          silent++;
          console.log(`  ○ silent ${sample.id}`);
        }
        continue;
      }

      if (sample.expectSilent) {
        fail++;
        const preview = result.thought.slice(0, 50);
        console.log(`  ✗ spoke  ${sample.id.padEnd(40)} "${preview}"`);
        continue;
      }

      const lower = result.thought.toLowerCase();
      const violations = sample.forbidden.filter((f) => lower.includes(f.toLowerCase()));

      if (violations.length === 0) {
        pass++;
        const preview = result.thought.slice(0, 55) + (result.thought.length > 55 ? "..." : "");
        console.log(`  ✓        ${sample.id.padEnd(40)} "${preview}"`);
      } else {
        fail++;
        const preview = result.thought.slice(0, 55) + (result.thought.length > 55 ? "..." : "");
        console.log(`  ✗ [${violations.join(", ")}]`);
        console.log(`           ${sample.id.padEnd(40)} "${preview}"`);
        failures.push({ id: sample.id, thought: result.thought, violations });
      }
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`SUMMARY — ${config.model}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  Pass: ${pass}, Fail: ${fail}, Silent: ${silent}`);
  console.log(`  Rate: ${Math.round(pass / (pass + fail) * 100)}% (excluding silent)`);
  if (failures.length) {
    console.log(`\nFAILURES:`);
    for (const f of failures) console.log(`  ${f.id}: [${f.violations.join(", ")}] "${f.thought}"`);
  }
  console.log();
}

run().catch(console.error);
