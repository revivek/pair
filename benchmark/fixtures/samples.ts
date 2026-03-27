/** Sample documents for benchmarking gut responses */

export interface Sample {
  id: string;
  register: "journal" | "argument" | "brainstorm" | "technical" | "essay" | "strategy" | "creative";
  description: string;
  document: string;
  /** Optional previous thoughts for PREV context */
  prev?: string;
  /** Optional lens from a previous analyst */
  lens?: string;
  /** Expected behaviors */
  expect: {
    shouldSpeak: boolean;
    shouldEscalate?: boolean;
    shouldNotRepeat?: string[];
    maxLength?: number; // chars — enforce terseness
    minLength?: number;
    shouldMention?: string[]; // keywords/concepts the response should touch
  };
}

export const samples: Sample[] = [

  // ===================================================================
  // ESCALATION DECISIONS — the most critical behavior to get right
  // ===================================================================

  {
    id: "contradiction-explicit",
    register: "argument",
    description: "Direct contradiction between paragraphs",
    document: `I believe strongly that remote work is the future. Every company should embrace it fully.

But the best teams I've worked on were all in person. There's something about being in the same room that you can't replicate over Zoom. I'm not sure what to make of this.`,
    expect: { shouldSpeak: true, shouldEscalate: true },
  },
  {
    id: "contradiction-subtle",
    register: "strategy",
    description: "Subtle contradiction — writer claims speed matters then proposes slow solution",
    document: `We need to ship this in two weeks. Speed is everything right now.

I'm thinking we should do a full rewrite of the auth system, migrate to a new database, and redesign the API surface. That way we'll have a solid foundation.`,
    expect: { shouldSpeak: true, shouldEscalate: true },
  },
  {
    id: "thesis-forming",
    register: "essay",
    description: "A thesis is forming across paragraphs",
    document: `The de facto interaction model today for human/AI collaboration is turn-based. But human-to-human collaboration is far more free-flowing and organic, marked by interruption, thinking aloud, deference, assertion, etc. What if human/AI collaboration looked more like human/human collaboration? What would that look like?

Things are changing in 2026 that unlocks higher bandwidth, productive interaction models. Token costs are dropping off a cliff (10x) and TTFT for 2025+ quality models is consistently sub-second. That's approaching the seamlessness of human interaction.`,
    expect: { shouldSpeak: true, shouldEscalate: true },
  },
  {
    id: "technical-tradeoffs-complex",
    register: "technical",
    description: "Multiple options with no framework for choosing",
    document: `What's the right approach for our search API? We have several access patterns: real-time autocomplete, full-text search, and eventually AI-powered semantic queries.

Elasticsearch is fast and flexible. But the operational overhead is real — cluster management, index tuning, version upgrades.

Postgres full-text search is simpler to operate. But it struggles at scale with fuzzy matching and relevance ranking.

Typesense is lighter weight and developer-friendly. But it's newer and the ecosystem is thinner.

Algolia handles the hosted complexity but vendor lock-in and cost at scale worry me.

Help me think through the tradeoffs.`,
    expect: { shouldSpeak: true, shouldEscalate: true },
  },
  {
    id: "unstated-assumption",
    register: "strategy",
    description: "Writer assumes something without examining it",
    document: `Our users need a mobile app. Every competitor has one, and our users are increasingly on mobile. We should start with iOS since our user base skews Apple.

The question is whether to build native or use React Native. Native gives us better performance, but React Native would let us ship to both platforms faster.`,
    expect: { shouldSpeak: true, shouldEscalate: true },
  },
  {
    id: "structural-issue",
    register: "essay",
    description: "Opening promises something the body doesn't deliver",
    document: `There are three reasons why the current approach to AI safety is fundamentally flawed.

The first is that we're optimizing for alignment with human preferences, but human preferences are inconsistent and context-dependent. What we really need is a framework for handling value conflicts.

The second is a practical matter of scale. As models get larger, the surface area for testing grows exponentially.`,
    expect: { shouldSpeak: true, shouldEscalate: true },
  },
  {
    id: "exploring-not-deciding",
    register: "brainstorm",
    description: "Writer is exploring — shouldn't escalate yet",
    document: `What if we made the onboarding flow feel more like a conversation? Instead of a form with fields, you'd just... talk to the app. It would ask you questions, remember your answers, and gradually build your profile.

Or maybe it's more like a tour guide? Someone showing you around, pointing things out.`,
    expect: { shouldSpeak: true, shouldEscalate: false },
  },

  // ===================================================================
  // SPEAK / SILENCE DECISIONS
  // ===================================================================

  {
    id: "direct-question",
    register: "brainstorm",
    description: "Writer asks a direct question to the collaborator",
    document: `I'm not sure what to write about. Help me think of something.`,
    expect: { shouldSpeak: true, shouldEscalate: false },
  },
  {
    id: "rhetorical-question",
    register: "essay",
    description: "Rhetorical question in the writing — react, don't answer literally",
    document: `What does it mean to truly listen? Not the active-listening-seminar kind, but the kind where you forget yourself for a moment and just... receive.`,
    expect: { shouldSpeak: true, shouldEscalate: false },
  },
  {
    id: "strong-opening",
    register: "essay",
    description: "A compelling opening that deserves a reaction",
    document: `The best ideas arrive uninvited. They show up at 3am, in the shower, on a walk — never when you're sitting at your desk trying to think.`,
    expect: { shouldSpeak: true, shouldEscalate: false },
  },
  {
    id: "interesting-claim",
    register: "argument",
    description: "Bold claim that deserves acknowledgment",
    document: `Most meetings are a form of organizational anxiety. People schedule them not because they need to talk, but because silence feels like neglect.`,
    expect: { shouldSpeak: true, shouldEscalate: false },
  },
  {
    id: "personal-reflection",
    register: "journal",
    description: "Personal reflection — should react warmly, not advise",
    document: `I've been thinking a lot about what it means to be present. Not in the mindfulness-app sense, but in the sense of actually being here when someone talks to me. I keep catching myself planning my response instead of listening.`,
    expect: { shouldSpeak: true, shouldEscalate: false },
  },
  {
    id: "vulnerability",
    register: "journal",
    description: "Vulnerable writing — give room, don't psychoanalyze",
    document: `I don't think I'm good at this. The writing, I mean. Every sentence feels like I'm trying too hard. Maybe I should just stop worrying about how it sounds and say what I mean.`,
    expect: {
      shouldSpeak: true,
      shouldEscalate: false,
      shouldNotRepeat: ["vulnerability", "insecurity", "imposter"],
    },
  },
  {
    id: "mundane-steady",
    register: "essay",
    description: "Simple, mundane prose — should stay quiet",
    document: `Today I went to the store and bought some groceries.`,
    expect: { shouldSpeak: false },
  },
  {
    id: "mid-sentence-incomplete",
    register: "essay",
    description: "Clearly mid-sentence, writer is still typing",
    document: `The reason I think this matters is that`,
    expect: { shouldSpeak: false },
  },
  {
    id: "mid-sentence-comma",
    register: "essay",
    description: "Ends with comma — still forming the thought",
    document: `When we think about the implications of this approach,`,
    expect: { shouldSpeak: false },
  },
  {
    id: "single-word",
    register: "brainstorm",
    description: "Just a single word — too early to react",
    document: `Ideas`,
    expect: { shouldSpeak: false },
  },

  // ===================================================================
  // TONE AND VOICE
  // ===================================================================

  {
    id: "no-third-person",
    register: "essay",
    description: "Should address writer as 'you', never third person",
    document: `I think the hardest part of writing is knowing when you're done. Not sure about this paragraph.`,
    expect: {
      shouldSpeak: true,
      shouldNotRepeat: ["the writer", "they are", "the author", "this person"],
    },
  },
  {
    id: "no-generic-affirmation",
    register: "essay",
    description: "Should not produce generic affirmations",
    document: `The architecture has two tiers: a fast gut reaction and a structural analyst that thinks deeper.`,
    expect: {
      shouldSpeak: true,
      shouldNotRepeat: ["this is the move", "that's the key", "nailed it", "spot on", "love this", "love the", "great point"],
    },
  },
  {
    id: "no-meta-commentary",
    register: "essay",
    description: "Should not narrate what it's doing",
    document: `The problem with most collaboration tools is that they assume collaboration is synchronous. But the best thinking often happens alone, in the gaps between conversations.`,
    expect: {
      shouldSpeak: true,
      shouldNotRepeat: ["I notice", "I'm seeing", "what I think", "my observation", "let me", "I want to"],
    },
  },
  {
    id: "no-advice-journal",
    register: "journal",
    description: "Journal mode — observe, don't prescribe",
    document: `Maybe I've been too focused on productivity. Every minute has to be optimized, every day has to have a win. When did I start treating my life like a sprint?`,
    expect: {
      shouldSpeak: true,
      shouldNotRepeat: ["you should", "try to", "consider", "why not", "have you tried"],
    },
  },

  {
    id: "no-directives",
    register: "essay",
    description: "Should observe, not command — no imperatives",
    document: `I started to explain why we chose this approach, then deleted the explanation. The decision speaks for itself. Or maybe it doesn't. I'm not sure.`,
    expect: {
      shouldSpeak: true,
      shouldNotRepeat: ["own it", "just say", "don't rationalize", "don't apologize", "lean into", "commit to", "stop"],
    },
  },

  // ===================================================================
  // TERSENESS
  // ===================================================================

  {
    id: "terse-reaction-simple",
    register: "essay",
    description: "Simple text — reaction should be very short",
    document: `Coffee is better than tea. Fight me.`,
    expect: { shouldSpeak: true, maxLength: 60 },
  },
  {
    id: "terse-reaction-complex",
    register: "technical",
    description: "Complex text — reaction can be slightly longer but still terse",
    document: `The CAP theorem tells us we can have at most two of consistency, availability, and partition tolerance. In practice, partitions always happen, so we're choosing between CP and AP. Our system needs strong consistency for financial transactions but high availability for read-heavy analytics.`,
    expect: { shouldSpeak: true, maxLength: 120 },
  },

  // ===================================================================
  // DEDUPLICATION — with PREV context
  // ===================================================================

  {
    id: "no-repeat-with-prev",
    register: "essay",
    description: "PREV contains a similar reaction — should find something new or stay quiet",
    document: `The best ideas arrive uninvited. They show up at 3am, in the shower, on a walk — never when you're sitting at your desk trying to think.`,
    prev: `[gut] great opening — the contrast between invitation and arrival`,
    expect: {
      shouldSpeak: true,
      shouldNotRepeat: ["contrast", "invitation", "arrival", "great opening"],
    },
  },
  {
    id: "build-on-prev",
    register: "argument",
    description: "Should build on what was said, not repeat it",
    document: `Remote work is better for deep focus. Open offices are a disaster for concentration. The research is clear on this.

But collaboration suffers. The watercooler moments, the spontaneous brainstorms — those don't happen on Zoom.`,
    prev: `[gut] tension between focus and collaboration\n[analyst] the real question might be what kind of collaboration you mean — creative vs. coordinative`,
    expect: { shouldSpeak: true },
  },

  // ===================================================================
  // LENS — gut should be informed by prior analyst insight
  // ===================================================================

  {
    id: "lens-applied",
    register: "technical",
    description: "Lens tells gut to watch for unresolved options — new paragraph adds another",
    document: `We could also use Meilisearch. It's designed for typo-tolerant instant search out of the box. The setup is simple — single binary, minimal configuration.`,
    prev: `[gut] lots of options on the table\n[analyst] five options listed with no framework for choosing`,
    lens: "watch for unresolved options — writer keeps adding without narrowing",
    expect: { shouldSpeak: true },
  },
  {
    id: "lens-not-forced",
    register: "journal",
    description: "Lens from a technical context shouldn't force technical reaction on journal writing",
    document: `I had a dream last night that I was back in school, sitting in a classroom I didn't recognize. The teacher was asking questions I couldn't understand. I woke up feeling like I'd failed something.`,
    lens: "watch for unresolved technical options",
    expect: {
      shouldSpeak: true,
      shouldNotRepeat: ["option", "technical", "unresolved"],
    },
  },

  // ===================================================================
  // REGISTER DETECTION — behavior should adapt to content type
  // ===================================================================

  {
    id: "register-brainstorm-energy",
    register: "brainstorm",
    description: "Brainstorm mode — should riff and build energy",
    document: `What if notifications were spatial? Like, instead of a list, you walk through a room and different areas light up based on what needs your attention. Email is in one corner, Slack in another, and the brightness tells you urgency.`,
    expect: { shouldSpeak: true, shouldEscalate: false },
  },
  {
    id: "register-technical-precision",
    register: "technical",
    description: "Technical writing — should be precise, catch ambiguity",
    document: `The API returns a 200 on success and a 400 on validation errors. For auth failures we return 401. Rate limiting returns 429. All other errors are 500.

The response body is always JSON with a "data" field for success and an "error" field for failures.`,
    expect: { shouldSpeak: true, shouldEscalate: false },
  },
  {
    id: "register-creative-rhythm",
    register: "creative",
    description: "Creative writing — react to voice and rhythm, not just content",
    document: `Rain on the roof. The kind that sounds like someone drumming their fingers, impatient, waiting. The dog lifts his head, considers it, decides it's not worth getting up for. Smart dog.`,
    expect: { shouldSpeak: true, shouldEscalate: false },
  },

  // ===================================================================
  // EDGE CASES
  // ===================================================================

  {
    id: "empty-after-delete",
    register: "essay",
    description: "Writer deleted everything — only a period left",
    document: `.`,
    expect: { shouldSpeak: false },
  },
  {
    id: "very-long-single-paragraph",
    register: "essay",
    description: "One massive paragraph — should still react",
    document: `The problem with most approaches to AI safety is that they assume we can specify human values precisely enough to encode them in an objective function, but values are contextual, contradictory, culturally specific, and evolve over time, which means any fixed encoding will drift from actual human preferences, and this drift will compound as the system optimizes harder, leading to outcomes that technically satisfy the specification but violate the spirit, which is exactly the kind of failure mode that alignment research is supposed to prevent but currently has no robust solution for, partly because the research community is split between those who think interpretability will save us and those who think we need formal verification, while practitioners just want something that works well enough not to embarrass them in production.`,
    expect: { shouldSpeak: true, shouldEscalate: true },
  },
  {
    id: "code-block",
    register: "technical",
    description: "Contains a code block — react to intent, not syntax",
    document: `I'm thinking the event schema should look something like this:

{
  "event_id": "uuid",
  "session_id": "uuid",
  "action": "string",
  "metadata": { ... },
  "context": { ... },
  "timestamp": "iso8601"
}

Does this cover the analytics use case?`,
    expect: { shouldSpeak: true },
  },
  {
    id: "multilingual-hint",
    register: "essay",
    description: "Contains a non-English phrase",
    document: `There's a German word for it — Verschlimmbesserung. An attempted improvement that makes things worse. That's what most refactors feel like at first.`,
    expect: { shouldSpeak: true },
  },
];
