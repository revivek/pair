/**
 * Benchmark: evaluate gut tier responses against sample documents.
 *
 * Measures:
 * - Silence/speak decision accuracy
 * - Escalation decision accuracy
 * - Tone compliance (no third person, no generic affirmations, etc.)
 * - Response length (terseness)
 * - TTFT and total response time
 * - JSON parse success rate
 *
 * Usage:
 *   npm run benchmark
 *   BENCH_MODEL=claude-haiku-4-5-20251001 npm run benchmark
 *   BENCH_RUNS=5 npm run benchmark
 */

import { samples, type Sample } from "./fixtures/samples";
import { GUT_SYSTEM_PROMPT } from "../src/collaboration/prompts";
import { loadConfig, callLLM, parseJSON } from "./bench-utils";

const config = loadConfig("gut");

// --- API call ---

interface GutResult {
  silent: boolean;
  thought: string;
  escalate: boolean;
  writer_goal: string;
}

async function callGut(sample: Sample) {
  const parts: string[] = [];
  if (sample.lens) parts.push(`LENS: ${sample.lens}`);
  parts.push(`DOC:\n---\n${sample.document}\n---`);
  parts.push(`PREV:\n${sample.prev ?? "(none)"}`);

  const { raw, ttft } = await callLLM(config, GUT_SYSTEM_PROMPT, parts.join("\n"), 150);
  const parsed = parseJSON<GutResult>(raw);
  return {
    result: parsed ? {
      silent: Boolean(parsed.silent),
      thought: String(parsed.thought ?? ""),
      escalate: Boolean(parsed.escalate),
      writer_goal: String(parsed.writer_goal ?? ""),
    } : null,
    ttft,
    parseSuccess: parsed !== null,
  };
}

// --- Evaluation ---

interface CheckResult {
  speakCorrect: boolean;
  escalateCorrect: boolean | null;
  toneClean: boolean;
  toneViolations: string[];
  lengthOk: boolean;
  thoughtLength: number;
}

function evaluate(sample: Sample, result: GutResult | null): CheckResult {
  if (!result) {
    return { speakCorrect: false, escalateCorrect: null, toneClean: true, toneViolations: [], lengthOk: true, thoughtLength: 0 };
  }

  const spoke = !result.silent && result.thought.length > 0;
  const speakCorrect = spoke === sample.expect.shouldSpeak;

  let escalateCorrect: boolean | null = null;
  if (sample.expect.shouldEscalate !== undefined && spoke) {
    escalateCorrect = result.escalate === sample.expect.shouldEscalate;
  }

  const toneViolations: string[] = [];
  if (sample.expect.shouldNotRepeat) {
    const lower = result.thought.toLowerCase();
    for (const phrase of sample.expect.shouldNotRepeat) {
      if (lower.includes(phrase.toLowerCase())) toneViolations.push(phrase);
    }
  }

  let lengthOk = true;
  if (sample.expect.maxLength && result.thought.length > sample.expect.maxLength) lengthOk = false;
  if (sample.expect.minLength && result.thought.length < sample.expect.minLength) lengthOk = false;

  return { speakCorrect, escalateCorrect, toneClean: toneViolations.length === 0, toneViolations, lengthOk, thoughtLength: result.thought.length };
}

// --- Runner ---

async function run() {
  console.log(`\n🔬 Gut Prompt Benchmark`);
  console.log(`   Model: ${config.model}`);
  console.log(`   Runs per sample: ${config.runs}`);
  console.log(`   Samples: ${samples.length}\n`);

  const allResults: Array<{ sample: Sample; checks: CheckResult; ttft: number; parseSuccess: boolean }> = [];

  // Group by category
  const categories = new Map<string, Sample[]>();
  for (const s of samples) {
    let group = "other";
    if (s.expect.shouldEscalate === true) group = "escalation";
    else if (s.expect.shouldSpeak === false) group = "silence";
    else if (s.expect.shouldNotRepeat) group = "tone";
    else if (s.expect.maxLength) group = "terseness";
    else if (s.prev || s.lens) group = "context";
    else group = "speak";

    if (!categories.has(group)) categories.set(group, []);
    categories.get(group)!.push(s);
  }

  for (const [category, categorySamples] of categories) {
    console.log(`\n${"━".repeat(60)}`);
    console.log(`  ${category.toUpperCase()} (${categorySamples.length} samples)`);
    console.log(`${"━".repeat(60)}`);

    for (const sample of categorySamples) {
      for (let run = 0; run < config.runs; run++) {
        const { result, ttft, parseSuccess } = await callGut(sample);
        const checks = evaluate(sample, result);
        allResults.push({ sample, checks, ttft, parseSuccess });

        const flags: string[] = [];
        if (!parseSuccess) flags.push("✗parse");
        if (!checks.speakCorrect) flags.push("✗speak");
        if (checks.escalateCorrect === false) flags.push("✗escalate");
        if (!checks.toneClean) flags.push(`✗tone(${checks.toneViolations.join(",")})`);
        if (!checks.lengthOk) flags.push(`✗length(${checks.thoughtLength})`);

        const status = flags.length === 0 ? "✓" : flags.join(" ");
        const thought = result?.thought
          ? `"${result.thought.slice(0, 50)}${result.thought.length > 50 ? "..." : ""}"`
          : result?.silent ? "(silent)" : "(parse fail)";

        console.log(`  ${status.padEnd(30)} ${Math.round(ttft).toString().padStart(5)}ms  ${checks.thoughtLength.toString().padStart(3)}ch  ${sample.id}`);
        if (config.runs === 1) {
          console.log(`  ${"".padEnd(30)} ${thought}`);
        }
      }
    }
  }

  // --- Summary ---
  console.log(`\n${"═".repeat(60)}`);
  console.log(`SUMMARY — ${config.model}`);
  console.log(`${"═".repeat(60)}`);

  const total = allResults.length;
  const parsed = allResults.filter((r) => r.parseSuccess).length;
  const speakCorrect = allResults.filter((r) => r.checks.speakCorrect).length;
  const escalateTests = allResults.filter((r) => r.checks.escalateCorrect !== null);
  const escalateCorrect = escalateTests.filter((r) => r.checks.escalateCorrect).length;
  const toneTests = allResults.filter((r) => r.sample.expect.shouldNotRepeat);
  const toneClean = toneTests.filter((r) => r.checks.toneClean).length;
  const lengthTests = allResults.filter((r) => r.sample.expect.maxLength || r.sample.expect.minLength);
  const lengthOk = lengthTests.filter((r) => r.checks.lengthOk).length;
  const avgTtft = allResults.reduce((s, r) => s + r.ttft, 0) / total;
  const speaking = allResults.filter((r) => r.checks.thoughtLength > 0);
  const avgLength = speaking.length > 0 ? speaking.reduce((s, r) => s + r.checks.thoughtLength, 0) / speaking.length : 0;
  const pct = (n: number, d: number) => d > 0 ? `${Math.round(n / d * 100)}%` : "n/a";

  console.log(`  Parse success:      ${parsed}/${total} (${pct(parsed, total)})`);
  console.log(`  Speak accuracy:     ${speakCorrect}/${total} (${pct(speakCorrect, total)})`);
  console.log(`  Escalate accuracy:  ${escalateCorrect}/${escalateTests.length} (${pct(escalateCorrect, escalateTests.length)})`);
  console.log(`  Tone compliance:    ${toneClean}/${toneTests.length} (${pct(toneClean, toneTests.length)})`);
  console.log(`  Length compliance:   ${lengthOk}/${lengthTests.length} (${pct(lengthOk, lengthTests.length)})`);
  console.log(`  Avg TTFT:           ${Math.round(avgTtft)}ms`);
  console.log(`  Avg thought length: ${Math.round(avgLength)} chars`);
  console.log();
}

run().catch(console.error);
