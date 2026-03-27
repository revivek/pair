import { useRef } from "react";
import { motion } from "framer-motion";
import { useTypewriter } from "../hooks/useTypewriter";


type Tier = "gut" | "analyst";

interface BottomNoteProps {
  id: string;
  tier: Tier;
  text: string;
  pinned: boolean;
  onPin: (id: string) => void;
  onDismiss: (id: string) => void;
  dimmed?: boolean;
}

const TIER_OPACITY: Record<Tier, number> = {
  gut: 0.92,
  analyst: 0.96,
};

export function BottomNote({
  id,
  tier,
  text,
  pinned,
  onPin,
  onDismiss,
  dimmed = false,
}: BottomNoteProps) {
  const baseOpacity = pinned ? 0.95 : dimmed ? TIER_OPACITY[tier] * 0.7 : TIER_OPACITY[tier];
  const displayedText = useTypewriter(text);
  const startY = useRef<number | null>(null);

  // Swipe up to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? startY.current;
    const delta = startY.current - endY;
    if (delta > 40) {
      // Swiped up — dismiss
      onDismiss(id);
    }
    startY.current = null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
      animate={{
        opacity: baseOpacity,
        y: 0,
        filter: "blur(0px)",
      }}
      exit={{
        opacity: 0,
        y: 30,
        transition: {
          opacity: { duration: 0.4, ease: "easeIn" },
          y: { duration: 0.5, ease: [0.4, 0, 1, 0.6] },
        },
      }}
      transition={{
        y: { type: "spring", stiffness: 200, damping: 20, mass: 0.5 },
        opacity: { duration: 0.3, ease: "easeOut" },
        filter: { duration: 0.4, ease: "easeOut" },
      }}
      onClick={() => onPin(id)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed z-50"
      style={{
        bottom: 24,
        left: 16,
        right: 16,
        cursor: "pointer",
        fontFamily: '"Inter", sans-serif',
        fontSize: 13,
        fontWeight: 300,
        lineHeight: 1.6,
        color: `var(--tier-${tier}-text)`,
        background: "rgba(250, 248, 245, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderLeft: `2px solid var(--tier-${tier}-${pinned ? "text" : "border"})`,
        borderRadius: 4,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        boxShadow: "0 -2px 20px rgba(0,0,0,0.04)",
        transition: "border-color 0.3s ease",
      }}
    >
      {displayedText}
    </motion.div>
  );
}
