/**
 * Shared benchmark utilities — config loading and LLM API calls.
 */

type Provider = "anthropic" | "openai";

export interface BenchConfig {
  model: string;
  provider: Provider;
  apiKey: string;
  runs: number;
}

/** Load benchmark config for a tier. Reads BENCH_MODEL (override), then TIERn_MODEL, then default. */
export function loadConfig(tier: "gut" | "analyst"): BenchConfig {
  const defaultModel = tier === "gut" ? "gpt-5.4-mini" : "claude-opus-4-6";
  const tierEnv = tier === "gut" ? "TIER1_MODEL" : "TIER2_MODEL";
  const model = process.env.BENCH_MODEL ?? process.env[tierEnv] ?? defaultModel;
  const provider: Provider = model.startsWith("claude-") ? "anthropic" : "openai";
  const apiKey = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error(`Missing ${provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"}`);
    process.exit(1);
  }

  return { model, provider, apiKey, runs: Number(process.env.BENCH_RUNS ?? "1") };
}

/** Call an LLM with a system prompt and user context. Returns raw response text and TTFT. */
export async function callLLM(
  config: BenchConfig,
  system: string,
  context: string,
  maxTokens: number,
): Promise<{ raw: string; ttft: number }> {
  const start = performance.now();

  if (config.provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "system", content: system }, { role: "user", content: context }],
        max_completion_tokens: maxTokens,
      }),
    });
    const ttft = performance.now() - start;
    const data = await response.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } };
    if (data.error) throw new Error(data.error.message);
    return { raw: data.choices?.[0]?.message?.content ?? "", ttft };
  }

  // Anthropic
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      system,
      messages: [{ role: "user", content: context }],
      max_tokens: maxTokens,
      stream: false,
    }),
  });
  const ttft = performance.now() - start;
  const data = await response.json() as { content: Array<{ text: string }> };
  return { raw: data.content?.[0]?.text ?? "", ttft };
}

/** Extract and parse JSON from raw LLM response. */
export function parseJSON<T>(raw: string): T | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
