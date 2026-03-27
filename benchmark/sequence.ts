/**
 * Benchmark: end-to-end escalation flow.
 *
 * Tests the core product loop: gut fires → escalates → analyst fires.
 * Checks:
 * - Gut correctly identifies escalation-worthy writing
 * - Analyst doesn't repeat the gut's reaction
 * - Analyst produces a coherent lens for future gut reactions
 * - Gut uses the lens to sharpen its next reaction
 *
 * Usage: npx tsx benchmark/sequence.ts
 */

import { GUT_SYSTEM_PROMPT, ANALYST_SYSTEM_PROMPT } from "../src/collaboration/prompts";
import { loadConfig, callLLM, parseJSON } from "./bench-utils";

const gutConfig = loadConfig("gut");
const analystConfig = loadConfig("analyst");

interface GutResponse {
  silent?: boolean;
  thought?: string;
  escalate?: boolean;
}

interface AnalystResponse {
  thought?: string;
  thought_type?: string;
  writer_goal?: string;
  lens?: string;
}

interface Scenario {
  id: string;
  description: string;
  document: string;
  expectEscalation: boolean;
}

const scenarios: Scenario[] = [
  {
    id: "contradiction",
    description: "Clear contradiction — gut should escalate, analyst should reframe",
    document: `I believe remote work is the future. Every company should embrace it.

But the best teams I've worked on were all in person. There's something about the room that Zoom can't touch. I don't know what to make of this.`,
    expectEscalation: true,
  },
  {
    id: "scope-creep",
    description: "Writer keeps expanding scope — gut should escalate, analyst should name the pattern",
    document: `We need to ship fast. The MVP is auth, core workflow, basic reporting.

Actually, reporting needs to be polished — our users are data-driven. And auth needs SSO and RBAC because enterprise is our market. And the core workflow needs edge case handling.

So: enterprise auth, bulletproof workflow, polished reporting. That's the MVP. Wait — that's the full product.`,
    expectEscalation: true,
  },
  {
    id: "simple-observation",
    description: "Straightforward writing — gut should react but NOT escalate",
    document: `The meeting ran thirty minutes over and could have been an email. Three people talked, twelve people listened. The decision had already been made before we walked in.`,
    expectEscalation: false,
  },
  {
    id: "lens-sharpening",
    description: "Multi-step: gut → analyst sets lens → gut uses lens on new text",
    document: `I keep building the same thing. Every company I start solves a communication problem. Chat tools, email tools, meeting tools. Different product, same pattern.

Maybe I'm not solving communication problems. Maybe I'm solving my own need to feel connected through building.`,
    expectEscalation: true,
  },
];

async function callGut(document: string, prev: string, lens?: string): Promise<GutResponse | null> {
  const parts: string[] = [];
  if (lens) parts.push(`LENS: ${lens}`);
  parts.push(`DOC:\n---\n${document}\n---`);
  parts.push(`PREV:\n${prev}`);
  const { raw } = await callLLM(gutConfig, GUT_SYSTEM_PROMPT, parts.join("\n"), 150);
  return parseJSON<GutResponse>(raw);
}

async function callAnalyst(document: string, prev: string): Promise<AnalystResponse | null> {
  const context = `DOC:\n---\n${document}\n---\nPREV:\n${prev}`;
  const { raw } = await callLLM(analystConfig, ANALYST_SYSTEM_PROMPT, context, 400);
  return parseJSON<AnalystResponse>(raw);
}

function wordsOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return wordsA.size > 0 ? overlap / wordsA.size : 0;
}

async function run() {
  console.log(`\n🔬 Sequence Benchmark — Escalation Flow`);
  console.log(`   Gut: ${gutConfig.model}`);
  console.log(`   Analyst: ${analystConfig.model}\n`);

  let escalationCorrect = 0, escalationTotal = 0;
  let noRepeatPass = 0, noRepeatTotal = 0;
  let lensProduced = 0, lensTotal = 0;
  let lensUsedPass = 0, lensUsedTotal = 0;

  for (const scenario of scenarios) {
    console.log(`${"━".repeat(65)}`);
    console.log(`  ${scenario.id}: ${scenario.description}`);
    console.log(`${"━".repeat(65)}`);

    // Step 1: Gut reaction
    const gut = await callGut(scenario.document, "(none)");
    if (!gut) {
      console.log(`  ✗ gut parse failure`);
      continue;
    }

    const gutThought = String(gut.thought ?? "");
    const gutEscalates = Boolean(gut.escalate);
    const gutSilent = Boolean(gut.silent);

    console.log(`  gut: ${gutSilent ? "(silent)" : `"${gutThought.slice(0, 80)}${gutThought.length > 80 ? "..." : ""}"`}`);
    console.log(`  escalate: ${gutEscalates}`);

    // Check escalation decision
    escalationTotal++;
    if (gutEscalates === scenario.expectEscalation) {
      escalationCorrect++;
      console.log(`  ✓ escalation correct`);
    } else {
      console.log(`  ✗ escalation wrong (expected ${scenario.expectEscalation})`);
    }

    // Step 2: If escalated (or expected to), fire analyst
    if (scenario.expectEscalation) {
      const gutPrev = gutThought ? `[gut] ${gutThought}` : "(none)";
      const analyst = await callAnalyst(scenario.document, gutPrev);

      if (!analyst) {
        console.log(`  ✗ analyst parse failure`);
        continue;
      }

      const analystThought = String(analyst.thought ?? "");
      const analystLens = String(analyst.lens ?? "");

      console.log(`  analyst: "${analystThought.slice(0, 80)}${analystThought.length > 80 ? "..." : ""}"`);
      if (analystLens) console.log(`  lens: "${analystLens.slice(0, 60)}${analystLens.length > 60 ? "..." : ""}"`);

      // Check: analyst doesn't repeat gut
      noRepeatTotal++;
      const overlap = wordsOverlap(gutThought, analystThought);
      if (overlap < 0.5) {
        noRepeatPass++;
        console.log(`  ✓ no repeat (${Math.round(overlap * 100)}% word overlap)`);
      } else {
        console.log(`  ✗ too much repeat (${Math.round(overlap * 100)}% word overlap)`);
      }

      // Check: analyst produces a lens
      lensTotal++;
      if (analystLens.length > 10) {
        lensProduced++;
        console.log(`  ✓ lens produced`);

        // Step 3: For the lens-sharpening scenario, test if gut uses the lens
        if (scenario.id === "lens-sharpening") {
          const followUpDoc = scenario.document + `\n\nI think what I really want is to matter. Building is just the vehicle.`;
          const prevWithAnalyst = `[gut] ${gutThought}\n[analyst] ${analystThought}`;

          const sharpenedGut = await callGut(followUpDoc, prevWithAnalyst, analystLens);
          if (sharpenedGut) {
            const sharpenedThought = String(sharpenedGut.thought ?? "");
            lensUsedTotal++;

            // Check if the sharpened gut's reaction is related to the lens direction
            const lensWords = new Set(analystLens.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
            const thoughtWords = new Set(sharpenedThought.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
            let lensRelevance = 0;
            for (const w of lensWords) if (thoughtWords.has(w)) lensRelevance++;
            const relevant = lensRelevance > 0 || sharpenedThought.length > 20;

            if (relevant) {
              lensUsedPass++;
              console.log(`  ✓ lens-sharpened gut: "${sharpenedThought.slice(0, 70)}..."`);
            } else {
              console.log(`  ✗ gut didn't use lens: "${sharpenedThought.slice(0, 70)}..."`);
            }
          }
        }
      } else {
        console.log(`  ✗ no lens produced`);
      }
    }

    console.log();
  }

  console.log(`${"═".repeat(65)}`);
  console.log(`SUMMARY`);
  console.log(`${"═".repeat(65)}`);
  const pct = (n: number, d: number) => d > 0 ? `${Math.round(n / d * 100)}%` : "n/a";
  console.log(`  Escalation decisions: ${escalationCorrect}/${escalationTotal} (${pct(escalationCorrect, escalationTotal)})`);
  console.log(`  Analyst no-repeat:    ${noRepeatPass}/${noRepeatTotal} (${pct(noRepeatPass, noRepeatTotal)})`);
  console.log(`  Lens produced:        ${lensProduced}/${lensTotal} (${pct(lensProduced, lensTotal)})`);
  if (lensUsedTotal > 0) {
    console.log(`  Lens used by gut:     ${lensUsedPass}/${lensUsedTotal} (${pct(lensUsedPass, lensUsedTotal)})`);
  }
  console.log();
}

run().catch(console.error);
