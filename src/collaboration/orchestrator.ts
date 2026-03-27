import type { TierName, GutResponse, AnalystResponse } from "./thoughts";
import type { ThoughtManager } from "./thoughts";
import { SignalTracker, type BehavioralSignals } from "./signals";
import { buildContext } from "./context";
import { analyzeLocally, formatLocalAnalysis } from "./local-analysis";
import { GUT_SYSTEM_PROMPT, ANALYST_SYSTEM_PROMPT } from "./prompts";

type OrchestratorStatus = "idle" | "gut" | "analyst";

export interface OrchestratorCallbacks {
  onStatusChange: (status: OrchestratorStatus) => void;
  onThoughtComplete?: () => void;
  onTypingActivity: (isActive: boolean) => void;
  onError: (message: string) => void;
}

export interface CursorInfo {
  surrounding: string;
}

const PAUSE_DEBOUNCE_MS = 2000;

const TIER_TTL_RANGES: Record<TierName, { min: number; max: number }> = {
  gut: { min: 6_000, max: 10_000 },
  analyst: { min: 8_000, max: 20_000 },
};

const SYSTEM_PROMPTS: Record<TierName, string> = {
  gut: GUT_SYSTEM_PROMPT,
  analyst: ANALYST_SYSTEM_PROMPT,
};

function computeDiff(prev: string, next: string): { added: string; removed: string; direction: "growing" | "shrinking" | "stable" } {
  let prefixLen = 0;
  while (prefixLen < prev.length && prefixLen < next.length && prev[prefixLen] === next[prefixLen]) {
    prefixLen++;
  }
  let suffixLen = 0;
  while (
    suffixLen < prev.length - prefixLen &&
    suffixLen < next.length - prefixLen &&
    prev[prev.length - 1 - suffixLen] === next[next.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }
  const removed = prev.slice(prefixLen, prev.length - suffixLen);
  const added = next.slice(prefixLen, next.length - suffixLen);
  const direction = next.length > prev.length ? "growing" as const
    : next.length < prev.length ? "shrinking" as const
    : "stable" as const;
  return { added, removed, direction };
}

function getVisibleText(): string {
  const pm = document.querySelector(".ProseMirror");
  if (!pm) return "";
  const paragraphs = pm.querySelectorAll("p");
  const viewTop = window.scrollY;
  const viewBottom = viewTop + window.innerHeight;
  const visible: string[] = [];
  paragraphs.forEach((p) => {
    const rect = p.getBoundingClientRect();
    const absTop = rect.top + window.scrollY;
    const absBottom = absTop + rect.height;
    if (absBottom > viewTop && absTop < viewBottom && p.textContent?.trim()) {
      visible.push(p.textContent.trim());
    }
  });
  if (visible.length === 0) return "";
  return `writer is looking at: "${visible.join(" / ").slice(0, 300)}"`;
}

/** Extract the outermost JSON object from a string by counting braces (avoids ReDoS). */
function extractJSON(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) { if (ch === "\\" ) i++; else if (ch === '"') inString = false; continue; }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return raw.slice(start, i + 1); }
  }
  return null;
}

function extractStreamingThought(accumulated: string): string {
  const marker = '"thought":"';
  const idx = accumulated.indexOf(marker);
  if (idx === -1) return "";
  const start = idx + marker.length;
  let i = start;
  while (i < accumulated.length) {
    if (accumulated[i] === "\\") { i += 2; continue; }
    if (accumulated[i] === '"') return accumulated.slice(start, i).replace(/\\"/g, '"');
    i++;
  }
  return accumulated.slice(start).replace(/\\"/g, '"');
}

export class Orchestrator {
  private callbacks: OrchestratorCallbacks;
  private thoughts: ThoughtManager;
  private tracker = new SignalTracker();
  private status: OrchestratorStatus = "idle";
  private inFlight = false;
  private typingActiveTimer: ReturnType<typeof setTimeout> | null = null;

  // Debounce & diff state — all owned here, not in React
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastDoc = "";
  private lastTriggerDoc = "";
  private deletionBuffer: string[] = [];
  private cursor: CursorInfo = { surrounding: "" };
  private lastReactionDoc = "";
  private lastReactionTime = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleFired = false;

  constructor(callbacks: OrchestratorCallbacks, thoughts: ThoughtManager) {
    this.callbacks = callbacks;
    this.thoughts = thoughts;
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.typingActiveTimer) clearTimeout(this.typingActiveTimer);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }

  private onVisibilityChange = (): void => {
    // Clear stale timers when tab is backgrounded/refocused
    if (document.hidden) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      if (this.idleTimer) clearTimeout(this.idleTimer);
    }
  };

  /** Called by the App on every editor update. The orchestrator owns all timing. */
  onTextChange(text: string, cursor: CursorInfo, muted = false): void {
    // On first call (mount), seed state and return — don't debounce on restored content
    if (!this.lastDoc && text.length > 0) {
      this.lastDoc = text;
      this.lastTriggerDoc = text;
      this.cursor = cursor;
      return;
    }

    const prevDoc = this.lastDoc;
    const added = text.length > prevDoc.length ? text.length - prevDoc.length : 0;
    const deleted = prevDoc.length > text.length ? prevDoc.length - text.length : 0;

    if (added > 0 || deleted > 0) {
      this.tracker.onKeystroke(added, deleted, text.length, text.length);

      // Signal typing activity — notes should dim
      this.callbacks.onTypingActivity(true);
      if (this.typingActiveTimer) clearTimeout(this.typingActiveTimer);
      this.typingActiveTimer = setTimeout(() => {
        this.callbacks.onTypingActivity(false);
      }, 800);
    }

    // Track deletions between triggers
    const keystrokeDiff = computeDiff(prevDoc, text);
    if (keystrokeDiff.removed.trim().length > 0) {
      this.deletionBuffer.push(keystrokeDiff.removed);
    }

    this.cursor = cursor;
    this.lastDoc = text;
    this.idleFired = false;

    // Reset debounce and idle
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);

    if (text.trim().length > 0 && !muted) {
      this.debounceTimer = setTimeout(() => this.onPause(text), PAUSE_DEBOUNCE_MS);
    }
  }

  /** Debounce expired — decide whether to fire the gut. All checks are synchronous, no React. */
  private onPause(text: string): void {
    // Don't fire if tab is backgrounded — timers bunch up and fire in bursts on refocus
    if (document.hidden) return;
    // Don't fire if already in-flight
    if (this.inFlight) return;
    // Don't fire if there are any active thoughts
    if (this.thoughts.getThoughts().length > 0) return;
    // Don't re-trigger on unchanged text
    if (text === this.lastTriggerDoc) return;

    const triggerDiff = computeDiff(this.lastTriggerDoc, text);

    // Don't fire on small changes — need meaningful new content
    const changeSize = triggerDiff.added.length + triggerDiff.removed.length;
    if (changeSize < 30) {
      // Still update lastTriggerDoc so small changes accumulate from the right base
      this.lastTriggerDoc = text;
      return;
    }

    const deletions = this.deletionBuffer.filter((d) => d.trim().length > 0);
    const removed = deletions.length > 0 ? deletions.join(" | ") : triggerDiff.removed;

    const sigs = this.tracker.onPause();
    const sigString = this.tracker.getRelativeSignals(sigs);
    const analysis = formatLocalAnalysis(analyzeLocally(text));

    let postReaction = "";
    if (this.lastReactionDoc && this.lastReactionTime > 0) {
      const sinceReaction = computeDiff(this.lastReactionDoc, text);
      const elapsed = Math.round((Date.now() - this.lastReactionTime) / 1000);
      const actions: string[] = [];
      if (sinceReaction.added) actions.push(`wrote "${sinceReaction.added.slice(0, 200)}"`);
      if (sinceReaction.removed) actions.push(`deleted "${sinceReaction.removed.slice(0, 200)}"`);
      if (actions.length === 0) actions.push("no changes");
      postReaction = `${elapsed}s ago, writer ${actions.join(" and ")}`;
    }

    const cursorInfo = this.cursor.surrounding
      ? `cursor near: "${this.cursor.surrounding.slice(0, 100)}"`
      : "";
    const viewport = `${cursorInfo}\n${getVisibleText()}`;

    this.executeTier("gut", {
      document: text,
      diff: { added: triggerDiff.added, removed, direction: triggerDiff.direction },
      signals: sigs,
      signalString: sigString,
      localAnalysis: analysis,
      postReaction,
      viewport,
    });

    this.lastTriggerDoc = text;
    this.deletionBuffer = [];

    // Start idle timer — if writer goes silent for 30s, fire analyst
    this.startIdleTimer(text);
  }

  private startIdleTimer(text: string): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    // Check every 5s starting at 30s — don't give up if thoughts are still showing
    const check = () => {
      if (document.hidden) return;
      if (this.idleFired) return;
      if (this.inFlight) { this.idleTimer = setTimeout(check, 5000); return; }
      if (this.thoughts.getThoughts().length > 0) { this.idleTimer = setTimeout(check, 5000); return; }
      if (!text.trim()) return;
      // Check that the doc hasn't changed — if writer typed, this timer is stale
      if (text !== this.lastDoc) return;

      this.idleFired = true;

      const sigs = this.tracker.onPause();
      const sigString = this.tracker.getRelativeSignals(sigs);
      const analysis = formatLocalAnalysis(analyzeLocally(text));
      const cursorInfo = this.cursor.surrounding
        ? `cursor near: "${this.cursor.surrounding.slice(0, 100)}"`
        : "";
      const viewport = `${cursorInfo}\n${getVisibleText()}`;

      this.executeTier("analyst", {
        document: text,
        diff: { added: "", removed: "", direction: "stable" },
        signals: sigs,
        signalString: `${sigString} [IDLE: writer has been silent for 30s]`,
        localAnalysis: analysis,
        postReaction: "writer has been idle — no typing for 30 seconds",
        viewport,
      });
    };
    this.idleTimer = setTimeout(check, 30_000);
  }

  /** Force a specific tier — e.g. from Ctrl+1/2/3. Overrides inFlight. */
  forceTier(tier: TierName): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.inFlight = false;
    const text = this.lastDoc;
    if (!text.trim()) return;

    const sigs = this.tracker.onPause();
    const sigString = this.tracker.getRelativeSignals(sigs);
    const analysis = formatLocalAnalysis(analyzeLocally(text));

    this.executeTier(tier, {
      document: text,
      diff: { added: "", removed: "", direction: "stable" },
      signals: sigs,
      signalString: sigString,
      localAnalysis: analysis,
      postReaction: "",
      viewport: "",
    }, { forced: true });
  }

  private async executeTier(tier: TierName, params: TriggerParams, opts?: { forced?: boolean }): Promise<void> {
    this.inFlight = true;
    this.setStatus(tier);

    const context = buildContext({
      document: params.document,
      diff: params.diff,
      signals: params.signalString,
      localAnalysis: params.localAnalysis,
      recentThoughts: this.thoughts.getRecentContext(),
      postReaction: params.postReaction,
      viewport: params.viewport,
      writerGoal: this.thoughts.writerGoal,
      lens: this.thoughts.lens,
      tier,
    });

    const thoughtId = this.thoughts.addStreamingThought(tier);

    let accumulated = "";
    let lastExtracted = "";

    try {
      const response = await fetch(`/api/tier/${tier}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPTS[tier] },
            { role: "user", content: context },
          ],
          max_tokens: tier === "gut" ? 150 : 400,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        const msg = response.status === 401 ? "Invalid API key — check your .env file"
          : response.status === 429 ? "Rate limited — try again in a moment"
          : `API error (${response.status})`;
        this.callbacks.onError(msg);
        this.thoughts.removeThought(thoughtId);
        this.finishTier();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        const extracted = extractStreamingThought(accumulated);
        if (extracted.length > lastExtracted.length) {
          this.thoughts.updateStreamingText(thoughtId, extracted.slice(lastExtracted.length));
          lastExtracted = extracted;
        }
      }

      const parsed = this.parseResponse(tier, accumulated);
      if (!parsed) {
        console.warn(`[${tier}] Failed to parse response:`, accumulated.slice(0, 200));
        this.thoughts.removeThought(thoughtId);
        this.finishTier();
        return;
      }

      // Writer goal: analyst always sets, gut only seeds when empty
      const goal = "writer_goal" in parsed ? (parsed as { writer_goal?: string }).writer_goal : undefined;
      if (goal && (tier !== "gut" || !this.thoughts.writerGoal)) {
        this.thoughts.writerGoal = goal;
      }

      // Update lens — analyst sharpens the gut's focus
      const lens = "lens" in parsed ? (parsed as { lens?: string }).lens : undefined;
      if (lens && tier !== "gut") {
        this.thoughts.lens = lens;
      }

      if (tier === "gut") {
        const gutParsed = parsed as GutResponse;
        if (gutParsed.silent && !opts?.forced) {
          this.thoughts.removeThought(thoughtId);
          this.finishTier();
          return;
        }

        // If escalating with empty thought (gut defers to analyst), skip the gut note
        if (gutParsed.escalate && !gutParsed.thought.trim()) {
          this.thoughts.removeThought(thoughtId);
          this.inFlight = false;
          this.executeTier("analyst", params);
          return;
        }

        this.thoughts.finalizeThought(thoughtId, gutParsed);
        this.applyTtl(thoughtId, tier);
        this.onReactionComplete();

        // Escalate gut → analyst (Opus)
        if (gutParsed.escalate) {
          this.inFlight = false;
          this.executeTier("analyst", params);
          return;
        }
      } else {
        // Analyst finalization
        this.thoughts.finalizeThought(thoughtId, parsed as AnalystResponse);
        this.applyTtl(thoughtId, tier);
        this.onReactionComplete();
      }

      this.finishTier();
    } catch (err) {
      this.callbacks.onError("Connection error — check your network");
      this.thoughts.removeThought(thoughtId);
      this.finishTier();
    }
  }

  private onReactionComplete(): void {
    this.lastReactionDoc = this.lastDoc;
    this.lastReactionTime = Date.now();
    this.callbacks.onThoughtComplete?.();
  }

  private applyTtl(thoughtId: string, tier: TierName): void {
    const thought = this.thoughts.getThoughts().find((t) => t.id === thoughtId);
    if (!thought) return;
    const { min, max } = TIER_TTL_RANGES[tier];
    const len = thought.thought.length;
    thought.ttl = Math.min(Math.max(len * 200, min), max);
  }

  private parseResponse(tier: TierName, raw: string): GutResponse | AnalystResponse | null {
    try {
      const jsonStr = extractJSON(raw);
      if (!jsonStr) return null;
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

      const writerGoal = typeof parsed["writer_goal"] === "string" ? parsed["writer_goal"] : undefined;
      const lensValue = typeof parsed["lens"] === "string" ? parsed["lens"] : undefined;

      if (tier === "gut") {
        return {
          silent: Boolean(parsed["silent"]),
          thought: String(parsed["thought"] ?? ""),
          escalate: Boolean(parsed["escalate"]),
          writer_goal: writerGoal,
        } satisfies GutResponse;
      } else {
        return {
          thought: String(parsed["thought"] ?? ""),
          thought_type: (parsed["thought_type"] as AnalystResponse["thought_type"]) ?? "thought",
          writer_goal: writerGoal,
          lens: lensValue,
        } satisfies AnalystResponse;
      }
    } catch {
      return null;
    }
  }

  private finishTier(): void {
    this.inFlight = false;
    this.setStatus("idle");
  }

  private setStatus(status: OrchestratorStatus): void {
    this.status = status;
    this.callbacks.onStatusChange(status);
  }

  getStatus(): OrchestratorStatus {
    return this.status;
  }
}

interface TriggerParams {
  document: string;
  diff: { added: string; removed: string; direction: "growing" | "shrinking" | "stable" };
  signals: BehavioralSignals;
  signalString: string;
  localAnalysis: string;
  postReaction: string;
  viewport: string;
}
