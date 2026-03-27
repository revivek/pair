/** Client-side analysis that runs on every content change (0ms, no API call) */

export interface LocalSignal {
  type: "repetition" | "rhythm" | "length-outlier";
  message: string;
}

export function analyzeLocally(text: string): LocalSignal[] {
  const signals: LocalSignal[] = [];

  if (text.length < 50) return signals;

  // Word repetition: flag words > 4 chars appearing 5+ times
  const words = text.toLowerCase().match(/\b[a-z]{5,}\b/g);
  if (words) {
    const counts = new Map<string, number>();
    for (const w of words) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    for (const [word, count] of counts) {
      if (count >= 5) {
        signals.push({
          type: "repetition",
          message: `'${word}' appears ${count} times`,
        });
      }
    }
  }

  // Sentence length variance: flag if uniformly same length across paragraphs
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paragraphs.length >= 3) {
    const sentenceCounts = paragraphs.map(
      (p) => (p.match(/[.!?]+/g) ?? []).length,
    );
    const nonZero = sentenceCounts.filter((c) => c > 0);
    if (nonZero.length >= 3) {
      const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
      const allSimilar = nonZero.every(
        (c) => Math.abs(c - avg) <= 1 && avg > 1,
      );
      if (allSimilar) {
        signals.push({
          type: "rhythm",
          message: "paragraphs have uniform sentence length — consider varying rhythm",
        });
      }
    }
  }

  // Paragraph length outliers
  if (paragraphs.length >= 4) {
    const lengths = paragraphs.map((p) => p.length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    for (let i = 0; i < lengths.length; i++) {
      const len = lengths[i]!;
      if (len > avg * 3 && len > 300) {
        signals.push({
          type: "length-outlier",
          message: `paragraph ${i + 1} is notably longer than the rest`,
        });
      }
    }
  }

  return signals;
}

export function formatLocalAnalysis(signals: LocalSignal[]): string {
  if (signals.length === 0) return "";
  return signals.map((s) => `[local] ${s.message}`).join("\n");
}
