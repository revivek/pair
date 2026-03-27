export type TierName = "gut" | "analyst";
export type ThoughtType = "thought" | "note" | "question" | "connection";

export interface Thought {
  id: string;
  tier: TierName;
  thought: string;
  thoughtType: ThoughtType;
  pinned: boolean;
  createdAt: number;
  ttl: number;
  streaming: boolean;
}

export interface GutResponse {
  silent: boolean;
  thought: string;
  escalate: boolean;
  writer_goal?: string;
}

export interface AnalystResponse {
  thought: string;
  thought_type: ThoughtType;
  writer_goal?: string;
  lens?: string;
}

type ThoughtInput = Omit<Thought, "id" | "createdAt" | "pinned" | "streaming">;

let nextId = 0;
function generateId(): string {
  return `thought_${Date.now()}_${nextId++}`;
}

export class ThoughtManager {
  private thoughts = new Map<string, Thought>();
  private history: Array<{ tier: string; thought: string }> = [];
  /** Running inference of what the writer is trying to accomplish */
  writerGoal = "";
  /** Instruction from analyst to sharpen the gut's focus */
  lens = "";
  onChange: (() => void) | null = null;

  addThought(input: ThoughtInput): string {
    const id = generateId();
    const thought: Thought = {
      ...input,
      id,
      createdAt: Date.now(),
      pinned: false,
      streaming: false,
    };
    this.thoughts.set(id, thought);
    this.notify();
    return id;
  }

  addStreamingThought(tier: TierName): string {
    const id = generateId();
    const thought: Thought = {
      id,
      tier,
      thought: "",
      thoughtType: "thought",
      pinned: false,
      createdAt: Date.now(),
      ttl: 0,
      streaming: true,
    };
    this.thoughts.set(id, thought);
    this.notify();
    return id;
  }

  updateStreamingText(id: string, text: string): void {
    const thought = this.thoughts.get(id);
    if (!thought) return;
    thought.thought += text;
    this.notify();
  }

  finalizeThought(id: string, parsed: GutResponse | AnalystResponse): void {
    const thought = this.thoughts.get(id);
    if (!thought) return;

    thought.thought = parsed.thought;
    thought.streaming = false;

    if ("thought_type" in parsed) {
      thought.thoughtType = parsed.thought_type;
    }

    // Deduplicate — if recent history has a very similar message, discard
    if (parsed.thought) {
      const recent = this.history.slice(-5);
      const isDupe = recent.some((h) => {
        const a = h.thought.toLowerCase();
        const b = parsed.thought.toLowerCase();
        return a === b || a.includes(b) || b.includes(a);
      });
      if (isDupe) {
        this.thoughts.delete(id);
        this.notify();
        return;
      }
    }

    // Keep history for PREV context even after thoughts are removed
    if (parsed.thought) {
      this.history.push({
        tier: thought.tier,
        thought: parsed.thought,
      });
      // Cap history
      if (this.history.length > 20) {
        this.history = this.history.slice(-20);
      }
    }

    this.notify();
  }

  pin(id: string): void {
    const thought = this.thoughts.get(id);
    if (!thought) return;
    thought.pinned = true;
    this.notify();
  }

  unpin(id: string): void {
    const thought = this.thoughts.get(id);
    if (!thought) return;
    thought.pinned = false;
    this.notify();
  }

  getExpiredThoughts(): Thought[] {
    const now = Date.now();
    const expired: Thought[] = [];
    for (const thought of this.thoughts.values()) {
      if (!thought.pinned && !thought.streaming && thought.ttl > 0 && now - thought.createdAt > thought.ttl) {
        expired.push(thought);
      }
    }
    return expired;
  }

  removeThought(id: string): void {
    this.thoughts.delete(id);
    this.notify();
  }

  getThought(id: string): Thought | undefined {
    return this.thoughts.get(id);
  }

  getThoughts(): Thought[] {
    return Array.from(this.thoughts.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  getRecentContext(limit = 10): string {
    const recent = this.history.slice(-limit);
    if (recent.length === 0) return "(none)";

    return recent
      .map((t) => `[${t.tier}] ${t.thought}`)
      .join("\n");
  }

  private notify(): void {
    this.onChange?.();
  }
}
