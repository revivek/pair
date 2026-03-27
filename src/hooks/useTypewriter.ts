import { useRef, useState, useEffect } from "react";

/** Typewriter reveal — smoothly reveals text character by character via rAF */
export function useTypewriter(text: string, charsPerSecond = 40): string {
  const [displayed, setDisplayed] = useState("");
  const targetRef = useRef(text);
  const indexRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  targetRef.current = text;

  useEffect(() => {
    // If text shrunk (e.g., new note replaced old), reset
    if (text.length < indexRef.current) {
      indexRef.current = 0;
      setDisplayed("");
    }

    const msPerChar = 1000 / charsPerSecond;

    const tick = (now: number) => {
      // On first frame or after background, seed the time
      if (!lastTimeRef.current) lastTimeRef.current = now;

      const elapsed = now - lastTimeRef.current;

      // If tab was backgrounded (>500ms gap), snap to current position
      if (elapsed > 500) {
        indexRef.current = targetRef.current.length;
        setDisplayed(targetRef.current);
        lastTimeRef.current = now;
      } else {
        // Reveal characters based on elapsed time
        const charsToReveal = Math.floor(elapsed / msPerChar);
        if (charsToReveal > 0 && indexRef.current < targetRef.current.length) {
          indexRef.current = Math.min(indexRef.current + charsToReveal, targetRef.current.length);
          setDisplayed(targetRef.current.slice(0, indexRef.current));
          lastTimeRef.current = now;
        }
      }

      // Early exit — don't re-queue if text is fully revealed
      if (indexRef.current >= targetRef.current.length) return;

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [charsPerSecond]);

  return displayed;
}
