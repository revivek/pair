import type { IncomingMessage, ServerResponse } from "node:http";

// ---------------------------------------------------------------------------
// Tier configuration
// ---------------------------------------------------------------------------

type Provider = "anthropic" | "openai";

interface TierConfig {
  provider: Provider;
  model: string;
  keyEnv: string;
  upstream: string;
}

function inferProvider(model: string): Provider {
  return model.startsWith("claude-") ? "anthropic" : "openai";
}

function buildTierConfig(model: string): TierConfig {
  const provider = inferProvider(model);
  return provider === "anthropic"
    ? { provider, model, keyEnv: "ANTHROPIC_API_KEY", upstream: "https://api.anthropic.com" }
    : { provider, model, keyEnv: "OPENAI_API_KEY", upstream: "https://api.openai.com" };
}

const TIERS: Record<string, TierConfig> = {
  gut: buildTierConfig(process.env.TIER1_MODEL ?? "gpt-5.4-mini"),
  analyst: buildTierConfig(process.env.TIER2_MODEL ?? "claude-opus-4-6"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the full request body as a string (capped at 100KB). */
function readBody(req: IncomingMessage): Promise<string> {
  const MAX_BODY = 100 * 1024;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) { req.destroy(); reject(new Error("Request body too large")); }
      else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/** Parse the tier name from a URL like /api/tier/gut */
function parseTierName(url: string): string | null {
  const match = url.match(/^\/api\/tier\/([^/?]+)/);
  return match?.[1] ?? null;
}


// ---------------------------------------------------------------------------
// Build upstream request per provider
// ---------------------------------------------------------------------------

function buildUpstreamRequest(
  tier: TierConfig,
  apiKey: string,
  body: Record<string, unknown>,
): { url: string; headers: Record<string, string>; body: string } {
  if (tier.provider === "openai") {
    // OpenAI uses max_completion_tokens instead of max_tokens
    const { max_tokens, ...rest } = body;
    const payload = {
      ...rest,
      model: tier.model,
      max_completion_tokens: max_tokens ?? 150,
      response_format: { type: "json_object" },
    };
    return {
      url: `${tier.upstream}/v1/chat/completions`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    };
  }

  // Anthropic — extract system message from messages array into top-level field
  const messages = (body.messages ?? []) as Array<{ role: string; content: string }>;
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const payload: Record<string, unknown> = {
    model: tier.model,
    messages: nonSystemMessages,
    max_tokens: body.max_tokens ?? 200,
    stream: body.stream ?? true,
  };
  if (systemMsg) {
    payload.system = systemMsg.content;
  }

  return {
    url: `${tier.upstream}/v1/messages`,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  };
}

// ---------------------------------------------------------------------------
// Middleware (Connect-compatible)
// ---------------------------------------------------------------------------

export function proxyMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  const url = req.url ?? "";

  // Only handle /api/tier/:tierName
  const tierName = parseTierName(url);
  if (!tierName) {
    next();
    return;
  }

  // Only GET and POST
  const method = (req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    next();
    return;
  }

  // Lookup tier
  const tier = TIERS[tierName];
  if (!tier) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Unknown tier: ${tierName}` }));
    return;
  }


  // API key check
  const apiKey = process.env[tier.keyEnv];
  if (!apiKey) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: `Missing environment variable: ${tier.keyEnv}` }),
    );
    return;
  }

  // Handle async work
  handleProxy(req, res, tier, apiKey).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: message }));
  });
}

async function handleProxy(
  req: IncomingMessage,
  res: ServerResponse,
  tier: TierConfig,
  apiKey: string,
): Promise<void> {
  // Read and parse request body (for GET with no body, default to empty object)
  const rawBody = await readBody(req);
  let body: Record<string, unknown>;
  try {
    body = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const upstream = buildUpstreamRequest(tier, apiKey, body);

  const upstreamRes = await fetch(upstream.url, {
    method: "POST",
    headers: upstream.headers,
    body: upstream.body,
  });

  if (!upstreamRes.ok || !upstreamRes.body) {
    const errorText = await upstreamRes.text().catch(() => "Unknown error");
    res.writeHead(upstreamRes.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: errorText }));
    return;
  }

  const contentType =
    upstreamRes.headers.get("content-type") ?? "application/json";
  const isStreaming = contentType.includes("text/event-stream");

  if (!isStreaming) {
    // Non-streaming: pipe through as-is
    res.writeHead(upstreamRes.status, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });
    const reader = upstreamRes.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
      res.end();
    }
    return;
  }

  // Streaming: normalize SSE from any provider into plain text chunks
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;

          // Anthropic format: content_block_delta with delta.text
          if (parsed.type === "content_block_delta") {
            const delta = parsed.delta as Record<string, unknown> | undefined;
            const text = delta?.text;
            if (typeof text === "string" && text.length > 0) {
              const ok = res.write(text);
              if (!ok) await new Promise<void>((r) => res.once("drain", r));
            }
          }

          // OpenAI/Groq format: choices[0].delta.content
          const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
          if (choices?.[0]) {
            const delta = choices[0].delta as Record<string, unknown> | undefined;
            const content = delta?.content;
            if (typeof content === "string" && content.length > 0) {
              const ok = res.write(content);
              if (!ok) await new Promise<void>((r) => res.once("drain", r));
            }
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
}
