import { useRef } from "react";
import { motion } from "framer-motion";
import { useTypewriter } from "../hooks/useTypewriter";


type Tier = "gut" | "analyst";

interface MarginNoteProps {
  id: string;
  tier: Tier;
  text: string;
  pinned: boolean;
  onPin: (id: string) => void;
  onDismiss: (id: string) => void;
  decaying: boolean;
  dimmed?: boolean;
  age?: number;
}

const TIER_OPACITY: Record<Tier, number> = {
  gut: 0.7,
  analyst: 0.8,
};

export function MarginNote({
  id,
  tier,
  text,
  pinned,
  onPin,
  onDismiss,
  decaying,
  dimmed = false,
  age = 0,
}: MarginNoteProps) {
  const tierOpacity = TIER_OPACITY[tier];
  const ageFade = pinned ? 0 : age * 0.15;
  const baseOpacity = pinned
    ? 0.95
    : dimmed
      ? tierOpacity * 0.7
      : tierOpacity - ageFade;

  const borderRef = useRef<HTMLDivElement>(null);
  const displayedText = useTypewriter(text);

  const handleClick = () => {
    const el = borderRef.current;
    if (el) {
      el.style.borderLeftWidth = pinned ? "1px" : "3px";
      setTimeout(() => {
        el.style.borderLeftWidth = "2px";
      }, 150);
    }
    onPin(id);
  };

  return (
    <motion.div
      ref={borderRef}
      initial={{ opacity: 0, y: -30, filter: "blur(8px)" }}
      animate={{
        opacity: decaying ? 0 : baseOpacity,
        y: 0,
        filter: "blur(0px)",
      }}
      exit={{
        opacity: 0,
        y: 40,
        transition: {
          opacity: { duration: 0.5, ease: "easeIn" },
          y: { duration: 0.6, ease: [0.4, 0, 1, 0.6] },
        },
      }}
      whileHover={decaying ? undefined : { opacity: 1 }}
      transition={
        decaying
          ? { opacity: { duration: 2.5, ease: "easeOut" } }
          : {
              y: { type: "spring", stiffness: 180, damping: 12, mass: 0.6 },
              opacity: { duration: 0.4, ease: "easeOut" },
            }
      }
      onAnimationComplete={() => {
        if (decaying) onDismiss(id);
      }}
      onClick={handleClick}
      style={{
        cursor: "pointer",
        fontFamily: '"Inter", sans-serif',
        fontSize: 13,
        fontWeight: 300,
        fontStyle: "normal",
        fontOpticalSizing: "auto",
        lineHeight: 1.6,
        color: `var(--tier-${tier}-text)`,
        borderLeft: `2px solid var(--tier-${tier}-${pinned ? "text" : "border"})`,
        transition: "border-color 0.3s ease, border-left-width 0.15s ease",
        paddingLeft: 10,
        paddingTop: 2,
        paddingBottom: 2,
      }}
    >
      {displayedText}
    </motion.div>
  );
}
