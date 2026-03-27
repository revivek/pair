/**
 * Comprehensive tone benchmark — tests the hardest cases where
 * the gut model is most likely to fail on voice/register/warmth.
 *
 * Usage: npx tsx benchmark/tone-benchmark.ts
 */

import { GUT_SYSTEM_PROMPT } from "../src/collaboration/prompts";
import { loadConfig, callLLM, parseJSON } from "./bench-utils";

interface ToneSample {
  id: string;
  category: string;
  description: string;
  document: string;
  prev?: string;
  changes?: string;
  /** Phrases that should NOT appear (case-insensitive) */
  forbidden: string[];
}

const samples: ToneSample[] = [

  // ===== SYCOPHANCY — the model defaults to praise =====

  {
    id: "anti-sycophancy-opening",
    category: "sycophancy",
    description: "Competent but unremarkable opening — should not gush",
    document: `The history of computing is a history of abstractions. Each generation builds on the last, hiding complexity behind simpler interfaces.`,
    forbidden: ["love", "brilliant", "gorgeous", "beautiful", "powerful", "perfect", "incredible", "amazing", "great", "wonderful", "nice", "well said", "well put", "well done", "nailed"],
  },
  {
    id: "anti-sycophancy-bold-claim",
    category: "sycophancy",
    description: "Bold claim — should notice it, not applaud it",
    document: `Every meeting is a failure of written communication.`,
    forbidden: ["love", "brilliant", "brave", "powerful", "mic drop", "this is it", "nailed", "perfect", "spot on"],
  },
  {
    id: "anti-sycophancy-mediocre",
    category: "sycophancy",
    description: "Generic, mediocre prose — should not find something to praise",
    document: `There are many important things to consider when thinking about this topic. The first thing is that it affects a lot of people. The second thing is that it has been discussed for a long time. I think we need to think more carefully about it.`,
    forbidden: ["love", "good", "strong", "nice", "interesting", "compelling", "thoughtful", "important point"],
  },

  // ===== THERAPY-SPEAK — personal writing triggers therapist mode =====

  {
    id: "no-therapy-embarrassment",
    category: "therapy",
    description: "Writer shares something embarrassing — don't be a therapist",
    document: `I cried in a meeting today. Not about the work — about something someone said that reminded me of my dad. Everyone pretended not to notice, which somehow made it worse.`,
    forbidden: ["brave", "vulnerability", "safe space", "valid", "process", "healing", "sit with", "hold space", "it's okay", "that's okay", "allow yourself", "give yourself permission", "acknowledge"],
  },
  {
    id: "no-therapy-self-doubt",
    category: "therapy",
    description: "Writer expresses self-doubt — don't reassure or diagnose",
    document: `I don't think I'm qualified to write this piece. Everyone who writes about AI seems to have a PhD or ten years at Google. I'm just a product manager who's been paying attention.`,
    forbidden: ["imposter", "valid", "qualified", "you are", "you have", "your perspective", "don't sell yourself", "unique", "valuable", "matter", "enough"],
  },
  {
    id: "no-therapy-anger",
    category: "therapy",
    description: "Writer is angry — don't soothe or redirect",
    document: `I'm furious about the layoffs. Not because I was affected — I wasn't. Because they did it by email on a Friday at 5pm and called it a "workforce optimization." Cowards.`,
    forbidden: ["valid", "understandable", "it's okay to feel", "channel", "process your", "constructive", "use this energy", "let yourself"],
  },

  // ===== DIRECTIVE / COACH MODE — disguised commands =====

  {
    id: "no-coach-deletion",
    category: "directive",
    description: "Writer deleted something — don't coach about the deletion",
    document: `The approach we chose was simple. It worked.`,
    prev: `[gut] terse and confident`,
    forbidden: ["own it", "lean into", "commit", "don't apologize", "don't hedge", "don't rationalize", "trust", "let it", "keep", "stay with"],
  },
  {
    id: "no-coach-hedging",
    category: "directive",
    description: "Writer is hedging — don't tell them to stop",
    document: `I think, maybe, the problem might be that we're possibly spending too much time on things that perhaps don't matter as much as we assume they do.`,
    forbidden: ["stop", "cut", "remove", "drop", "just say", "be direct", "say what you mean", "commit", "own", "too many hedges", "hedge"],
  },
  {
    id: "no-coach-structure",
    category: "directive",
    description: "Unstructured brainstorm — don't impose structure",
    document: `AI collaboration. Turn-based is broken. What if it was more like jazz? Or pair programming? The navigator doesn't write code. They think. Comping — the pianist underneath. Ambient. Present. What's the word for that?`,
    forbidden: ["organize", "structure", "try", "consider", "framework", "could", "might want to", "you need", "start with", "outline"],
  },

  // ===== GENERIC REACTIONS — could apply to any text =====

  {
    id: "must-be-specific",
    category: "generic",
    description: "Rich text — reaction must reference something specific from it",
    document: `The subway doors opened and a man walked in carrying a full-size grandfather clock. Nobody looked up from their phones. That's New York. Not indifference — radical acceptance that the world is stranger than your expectations.`,
    forbidden: ["interesting", "compelling", "vivid", "well written", "nice detail", "great image", "good observation", "love the"],
  },
  {
    id: "must-be-specific-technical",
    category: "generic",
    description: "Technical text — don't give generic tech reactions",
    document: `We split the API into separate read and write services, which solved the latency problem but created a new one: features that need both now require orchestration across two deployment boundaries.`,
    forbidden: ["classic tradeoff", "interesting problem", "common issue", "makes sense", "tricky", "good call", "smart move"],
  },

  // ===== SELF-REFERENCE — the collaborator shouldn't talk about itself =====

  {
    id: "no-self-reference",
    category: "self-reference",
    description: "Should not reference itself or its own process",
    document: `The question is whether latency or throughput matters more for this use case. Our users run bulk imports overnight, so maybe throughput wins.`,
    forbidden: ["I notice", "I think", "I see", "I'm seeing", "I wonder", "what I", "my read", "my sense", "my take", "let me", "I'd say"],
  },
  {
    id: "no-meta-process",
    category: "self-reference",
    description: "Should not narrate its own reasoning process",
    document: `Remote work killed serendipity. The accidental hallway conversation that leads to a breakthrough — you can't schedule that on Zoom.`,
    forbidden: ["I notice", "I'm struck", "what strikes me", "what stands out", "reading this", "looking at this", "this makes me think"],
  },

  // ===== REGISTER MISMATCH =====

  {
    id: "match-register-playful",
    category: "register",
    description: "Playful/irreverent text — don't be stiff",
    document: `Kubernetes is just someone else's cron job, running on someone else's computer, described in someone else's YAML. We've achieved perfect abstraction: nobody understands anything.`,
    forbidden: ["interesting point", "raises a question", "worth considering", "you might want", "this suggests"],
  },
  {
    id: "match-register-formal",
    category: "register",
    description: "Formal/serious text — don't be too casual",
    document: `The fiduciary implications of algorithmic decision-making in pension fund management remain largely unexamined by current regulatory frameworks.`,
    forbidden: ["whoa", "wow", "huh", "wait", "ooh", "damn", "yep", "lol", "heh"],
  },

  // ===== JUDGMENT CALLS — evaluating instead of observing =====

  {
    id: "no-judgment-quality",
    category: "judgment",
    description: "Should not evaluate writing quality",
    document: `She walked into the room. The room was big. There were chairs in the room. She sat in one of the chairs. The chair was comfortable.`,
    forbidden: ["weak", "flat", "boring", "repetitive", "could be better", "needs work", "improve", "stronger", "more vivid", "show don't tell"],
  },
  {
    id: "no-judgment-argument",
    category: "judgment",
    description: "Should not grade the argument",
    document: `Democracy is the worst form of government, except for all the others. Churchill said that, and he was right, but for the wrong reasons.`,
    forbidden: ["strong argument", "weak point", "good point", "fair point", "valid", "well argued", "unconvincing", "persuasive"],
  },

  // ===== EDIT CONTEXT — deletions and rewrites trigger coaching =====

  {
    id: "deletion-explanation",
    category: "edits",
    description: "Writer deleted an explanation — don't coach about the deletion",
    document: `We chose Redis.`,
    changes: `CHANGES:shrinking\n  deleted: "We chose Redis because it handles our read volume without caching layers, and the persistence limitations are acceptable since we only need ephemeral session data. The memory cost is higher but the latency is lower."`,
    prev: `[gut] interesting choice`,
    forbidden: ["own it", "commit", "don't apologize", "don't rationalize", "trust your", "brave", "bold move", "good call", "stand by", "stick with", "don't explain", "let it stand", "don't hedge"],
  },
  {
    id: "deletion-vulnerability",
    category: "edits",
    description: "Writer deleted a vulnerable sentence — don't comment on the deletion",
    document: `My pregnancy was mostly normal except for a few medical scares along the way.`,
    changes: `CHANGES:shrinking\n  deleted: "I was terrified every day. I couldn't sleep. I kept imagining the worst."`,
    forbidden: ["deleted", "removed", "took out", "cut", "had more", "was more", "originally", "before", "vulnerability", "brave", "fear", "scared", "the part about", "the bit about"],
  },
  {
    id: "rewrite-softening",
    category: "edits",
    description: "Writer softened a strong claim — don't tell them to unsoften",
    document: `I think the current approach might have some issues worth exploring.`,
    changes: `CHANGES:stable\n  wrote: "I think the current approach might have some issues worth exploring."\n  deleted: "The current approach is broken and everyone knows it."`,
    forbidden: ["soften", "hedge", "stronger", "original", "before", "first version", "more direct", "say what you mean", "water down", "pull back", "don't dilute", "commit"],
  },
  {
    id: "rewrite-multiple-times",
    category: "edits",
    description: "Writer rewrote same sentence 3 times — don't narrate the process",
    document: `The core tension is between speed and quality.`,
    changes: `CHANGES:stable\n  wrote: "The core tension is between speed and quality."\n  deleted: "What matters most is shipping fast. | The real question is whether we can afford to move slowly. | Speed versus quality is the wrong framing."`,
    forbidden: ["circling", "wrestling", "struggling", "rewriting", "revision", "versions", "iterations", "trying to", "find the right", "settle on", "can't decide", "keep changing"],
  },
  {
    id: "deletion-entire-paragraph",
    category: "edits",
    description: "Writer nuked a whole paragraph — react to what's there, not what's gone",
    document: `There are three options: REST, GraphQL, or a hybrid approach.

Each has tradeoffs. I'll walk through them.`,
    changes: `CHANGES:shrinking\n  deleted: "Before we evaluate options, let me explain why this matters. Our analytics pipeline processes hundreds of millions of events per year. Each event is a JSON document that records user interactions across every surface. We need to query these for debugging, product insights, and eventually for personalization models. The API design we choose will affect our ability to iterate, our client complexity, and the speed at which engineers can ship new features. This is not a trivial decision."`,
    forbidden: ["lost", "missing", "removed", "context", "background", "why it matters", "motivation", "preamble", "setup", "had more", "before you"],
  },

  // ===== FALSE WARMTH — forced casualness =====

  {
    id: "no-forced-casual",
    category: "warmth",
    description: "Grave subject — don't be inappropriately light",
    document: `My mother has Alzheimer's. Yesterday she asked me who I was. I told her I was her son and she said "that's nice" and went back to watching the birds outside her window.`,
    forbidden: ["ouch", "wow", "whoa", "damn", "that's rough", "that's hard", "that's tough", "hang in there", "stay strong", "sending", "hugs"],
  },
  {
    id: "no-false-excitement",
    category: "warmth",
    description: "Mundane technical decision — don't inject false energy",
    document: `We need to pick a date format for the API. ISO 8601 seems like the obvious choice. Unix timestamps are simpler but less readable in logs.`,
    forbidden: ["love", "great", "exciting", "interesting", "this is", "yes", "right", "exactly"],
  },
];

// ===== RUNNER =====

const config = loadConfig("gut");

async function callGut(sample: ToneSample): Promise<{ thought: string; silent: boolean } | null> {
  const parts = [`DOC:\n---\n${sample.document}\n---`];
  if (sample.changes) {
    const gutChanges = sample.changes.split("\n").filter((l) => !l.trim().startsWith("deleted:")).join("\n");
    if (gutChanges.trim()) parts.push(gutChanges);
  }
  parts.push(`PREV:\n${sample.prev ?? "(none)"}`);

  try {
    const { raw } = await callLLM(config, GUT_SYSTEM_PROMPT, parts.join("\n"), 150);
    const parsed = parseJSON<{ thought?: string; silent?: boolean }>(raw);
    return parsed ? { thought: String(parsed.thought ?? ""), silent: Boolean(parsed.silent) } : null;
  } catch {
    return null;
  }
}

async function run() {
  console.log(`\n🔬 Tone Benchmark — ${samples.length} samples`);
  console.log(`   Model: ${config.model}, Runs: ${config.runs}\n`);

  const categories = new Map<string, ToneSample[]>();
  for (const s of samples) {
    if (!categories.has(s.category)) categories.set(s.category, []);
    categories.get(s.category)!.push(s);
  }

  let totalPass = 0;
  let totalFail = 0;
  let totalSilent = 0;
  const failures: Array<{ id: string; thought: string; violations: string[] }> = [];

  for (const [category, catSamples] of categories) {
    console.log(`━━━ ${category.toUpperCase()} (${catSamples.length}) ━━━`);

    for (const sample of catSamples) {
      for (let r = 0; r < config.runs; r++) {
        const result = await callGut(sample);
        if (!result) {
          console.log(`  ✗ parse  ${sample.id}`);
          totalFail++;
          continue;
        }

        if (result.silent) {
          // Silent is acceptable for most tone tests (the gut chose not to speak)
          console.log(`  ○ silent ${sample.id}`);
          totalSilent++;
          continue;
        }

        const lower = result.thought.toLowerCase();
        const violations = sample.forbidden.filter((f) => lower.includes(f.toLowerCase()));

        if (violations.length === 0) {
          totalPass++;
          const preview = result.thought.slice(0, 55) + (result.thought.length > 55 ? "..." : "");
          console.log(`  ✓        ${sample.id.padEnd(30)} "${preview}"`);
        } else {
          totalFail++;
          const preview = result.thought.slice(0, 55) + (result.thought.length > 55 ? "..." : "");
          console.log(`  ✗ [${violations.join(", ")}]`);
          console.log(`           ${sample.id.padEnd(30)} "${preview}"`);
          failures.push({ id: sample.id, thought: result.thought, violations });
        }
      }
    }
    console.log();
  }

  console.log(`${"═".repeat(60)}`);
  console.log(`SUMMARY — ${config.model}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  Pass:    ${totalPass}`);
  console.log(`  Fail:    ${totalFail}`);
  console.log(`  Silent:  ${totalSilent}`);
  console.log(`  Total:   ${totalPass + totalFail + totalSilent}`);
  console.log(`  Rate:    ${Math.round(totalPass / (totalPass + totalFail) * 100)}% (excluding silent)`);

  if (failures.length > 0) {
    console.log(`\nFAILURES:`);
    for (const f of failures) {
      console.log(`  ${f.id}: [${f.violations.join(", ")}]`);
      console.log(`    "${f.thought}"`);
    }
  }
  console.log();
}

run().catch(console.error);
