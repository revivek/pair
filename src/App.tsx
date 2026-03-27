import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Editor, type CursorContext } from "./editor/Editor";
import { MarginNote } from "./ui/MarginNote";
import { BottomNote } from "./ui/BottomNote";
import { Orchestrator, type OrchestratorCallbacks } from "./collaboration/orchestrator";
import { ThoughtManager, type Thought } from "./collaboration/thoughts";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function App() {
  const thoughtManagerRef = useRef<ThoughtManager | null>(null);
  const orchestratorRef = useRef<Orchestrator | null>(null);
  const hasMarginSpace = useMediaQuery("(min-width: 1100px)");

  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [status, setStatus] = useState<"idle" | "gut" | "analyst">("idle");
  const [isTyping, setIsTyping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [muted, setMuted] = useState(false);
  const [, setTick] = useState(0);

  const editorWrapRef = useRef<HTMLDivElement>(null);

  const showError = useCallback((msg: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setErrorMsg(msg);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 8000);
  }, []);

  useEffect(() => {
    return () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); };
  }, []);

  useEffect(() => {
    const tm = new ThoughtManager();
    thoughtManagerRef.current = tm;

    tm.onChange = () => {
      setThoughts(tm.getThoughts());
    };

    const callbacks: OrchestratorCallbacks = {
      onStatusChange: (s) => setStatus(s),
      onTypingActivity: (active) => setIsTyping(active),
      onError: showError,
    };

    const orch = new Orchestrator(callbacks, tm);
    orchestratorRef.current = orch;

    return () => {
      orch.destroy();
    };
  }, []);

  const handleEditorUpdate = useCallback(
    (text: string, cursor: CursorContext) => {
      orchestratorRef.current?.onTextChange(text, { surrounding: cursor.surrounding }, muted);
    },
    [muted],
  );

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      if (e.key === "k") {
        e.preventDefault();
        setMuted((m) => !m);
        return;
      }

      const tier = e.key === "1" ? "gut" as const
        : e.key === "2" ? "analyst" as const
        : null;
      if (!tier) return;
      e.preventDefault();
      setMuted(false);
      orchestratorRef.current?.forceTier(tier);
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const handlePin = useCallback((id: string) => {
    const tm = thoughtManagerRef.current;
    if (!tm) return;
    const thought = tm.getThought(id);
    if (thought?.pinned) {
      tm.unpin(id);
      thought.createdAt = Date.now();
    } else {
      tm.pin(id);
    }
  }, []);

  const handleDismiss = useCallback((id: string) => {
    thoughtManagerRef.current?.removeThought(id);
  }, []);

  const allVisible = thoughts.filter((t) => t.thought.length > 0);
  const pinnedNote = allVisible.find((t) => t.pinned);
  const activeNote = pinnedNote ?? allVisible[0] ?? null;

  const activeNoteRef = useRef<string | null>(null);
  if (activeNote && activeNote.id !== activeNoteRef.current) {
    activeNoteRef.current = activeNote.id;
    if (!activeNote.pinned) {
      activeNote.createdAt = Date.now();
    }
  }

  useEffect(() => {
    if (!activeNote) return;
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      // Re-check pinned inside the interval — pin can happen after effect starts
      const current = thoughtManagerRef.current?.getThought(activeNote.id);
      if (!current || current.pinned) return;
      const now = Date.now();
      if (current.ttl > 0 && now - current.createdAt > current.ttl) {
        thoughtManagerRef.current?.removeThought(activeNote.id);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeNote]);

  const isAnalystActive = status === "analyst";

  const age = activeNote && activeNote.ttl > 0
    ? Math.min((Date.now() - activeNote.createdAt) / activeNote.ttl, 1)
    : 0;

  return (
    <div className="relative min-h-screen">
      {/* Persistent gut glow */}
      <div
        className={`pointer-events-none fixed inset-0 z-50${muted ? "" : " glow-breathe"}`}
        style={{
          boxShadow: "inset 0 0 45px 3px oklch(0.58 0.03 85 / 0.2)",
          opacity: muted ? 0 : 1,
          transition: muted ? "opacity 0.4s ease-in" : "opacity 0.3s ease-out",
        }}
      />

      {/* Analyst glow */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          boxShadow: "inset 0 0 50px 3px oklch(0.65 0.1 85 / 0.2)",
          opacity: isAnalystActive ? 1 : 0,
          transition: isAnalystActive ? "opacity 0.6s ease-out" : "opacity 1.2s ease-in",
        }}
      />

      <div ref={editorWrapRef} className={hasMarginSpace ? "editor-column relative" : "editor-narrow relative"}>
        <Editor onUpdate={handleEditorUpdate} />

        {/* Desktop: margin column */}
        {hasMarginSpace && (
          <div
            className="absolute"
            style={{
              top: 0,
              left: "100%",
              marginLeft: 36,
              width: 286,
              height: "100%",
            }}
          >
            <div className="sticky relative" style={{ top: "18vh" }}>
              <AnimatePresence mode="wait">
                {activeNote && (
                  <MarginNote
                    key={activeNote.id}
                    id={activeNote.id}
                    tier={activeNote.tier}
                    text={activeNote.thought}
                    pinned={activeNote.pinned}
                    onPin={handlePin}
                    onDismiss={handleDismiss}
                    decaying={false}
                    dimmed={isTyping}
                    age={age}
                  />
                )}
              </AnimatePresence>
              {errorMsg && !activeNote && (
                <div style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: 12,
                  color: "var(--error-text)",
                  marginTop: 8,
                }}>
                  {errorMsg}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Narrow/mobile: bottom overlay */}
      {!hasMarginSpace && (
        <AnimatePresence mode="wait">
          {activeNote && (
            <BottomNote
              key={activeNote.id}
              id={activeNote.id}
              tier={activeNote.tier}
              text={activeNote.thought}
              pinned={activeNote.pinned}
              onPin={handlePin}
              onDismiss={handleDismiss}
              dimmed={isTyping}
            />
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
