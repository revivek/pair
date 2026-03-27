interface BuildContextParams {
  document: string;
  diff: { added: string; removed: string; direction: "growing" | "shrinking" | "stable" };
  signals: string;
  localAnalysis: string;
  recentThoughts: string;
  postReaction: string;
  viewport: string;
  writerGoal: string;
  lens: string;
  tier: "gut" | "analyst";
}

function truncateForGut(doc: string): string {
  if (doc.length <= 1500) return doc;

  const paragraphs = doc.split(/\n\n+/);
  if (paragraphs.length <= 3) return doc;

  const lastParagraphs = paragraphs.slice(-3).join("\n\n");
  const summaryPrefix = `[${paragraphs.length - 3} earlier paragraphs, ${doc.length - lastParagraphs.length} chars omitted]`;
  return `${summaryPrefix}\n\n${lastParagraphs}`;
}

/** Produce a compressed structural map of the document for analyst */
function buildStructuralSummary(doc: string): string {
  const paragraphs = doc.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paragraphs.length <= 2) return "";

  const lines: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!.trim();
    const words = p.split(/\s+/).length;

    // Detect paragraph character
    const hasQuestion = /\?/.test(p);
    const isShort = words < 15;
    const startsWithBut = /^(but|however|yet|though|although)/i.test(p);
    const startsList = /^[-•*]|\d+[.)]/m.test(p);
    const statesPreference = /(I think|I'd go|my preference|I'm leaning|the answer is|I'd choose)/i.test(p);

    let character = "";
    if (i === 0) character = "opens";
    else if (i === paragraphs.length - 1) character = "closes";
    else if (statesPreference) character = "states preference";
    else if (startsList) character = "lists options";
    else if (startsWithBut) character = "pivots";
    else if (hasQuestion && isShort) character = "asks";
    else if (hasQuestion) character = "explores";
    else character = "develops";

    // First ~8 words as a preview
    const preview = p.split(/\s+/).slice(0, 8).join(" ");
    lines.push(`  ${i + 1}. [${character}] "${preview}..." (${words}w)`);
  }

  return `STRUCTURE (${paragraphs.length} paragraphs):\n${lines.join("\n")}`;
}

export function buildContext(params: BuildContextParams): string {
  const {
    document,
    diff,
    signals,
    localAnalysis,
    recentThoughts,
    postReaction,
    viewport,
    writerGoal,
    lens,
    tier,
  } = params;

  const docText = tier === "gut" ? truncateForGut(document) : document;

  const parts: string[] = [];

  if (writerGoal) parts.push(`GOAL: ${writerGoal}`);
  if (lens && tier === "gut") parts.push(`LENS: ${lens}`);

  // Structural summary for analyst — bird's-eye view
  if (tier !== "gut") {
    const structure = buildStructuralSummary(document);
    if (structure) parts.push(structure);
  }

  parts.push(`DOC:\n---\n${docText}\n---`);

  if (diff.added || diff.removed) {
    parts.push(`CHANGES:${diff.direction}`);
    if (diff.added) parts.push(`  wrote: "${diff.added}"`);
    // Only show deletions to the analyst — the gut should react to what's on the page
    if (diff.removed && tier !== "gut") parts.push(`  deleted: "${diff.removed}"`);
  }

  if (viewport) parts.push(`FOCUS: ${viewport}`);
  if (postReaction) parts.push(`AFTER_LAST_REACTION: ${postReaction}`);
  if (signals) parts.push(signals);
  if (localAnalysis) parts.push(localAnalysis);
  parts.push(`PREV:\n${recentThoughts}`);

  return parts.join("\n");
}
