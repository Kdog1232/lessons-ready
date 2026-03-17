// ✅ FILE: src/main.ts (COPY/PASTE THIS WHOLE FILE)
console.log("✅ src/main.ts loaded");
import { generateDefaultSkillFocus } from "./utils/skillFocus";
import { resolveCanonicalStandard } from "./save-lesson";
// -------------------------
// ✅ CONFIG
// -------------------------
const isGeneratorPage = window.location.pathname.includes("index");
const SUPABASE_URL = "https://pinplfyymnpfctwcpzol.supabase.co";

// ✅ Lesson generation (keep as-is)
const SUPABASE_FN_URL = `${SUPABASE_URL}/functions/v1/generate-lesson`;
const SUPABASE_EXPORT_PACK_FN_URL = `${SUPABASE_URL}/functions/v1/export-lesson-pack`;

// ✅ Checkout MUST use create-checkout-session (tier pricing + correct Stripe session)
const SUPABASE_BILLING_FN_URL =
  `${SUPABASE_URL}/functions/v1/create-checkout-session`;

// ✅ Portal uses dynamic-api
const SUPABASE_PORTAL_FN_URL =
  `${SUPABASE_URL}/functions/v1/dynamic-api`;

// ✅ Status uses dynamic-api (separate const so we never accidentally point it at checkout)
const SUPABASE_STATUS_FN_URL =
  `${SUPABASE_URL}/functions/v1/dynamic-api`;

// ✅ Supabase anon/public key
const SUPABASE_ANON_KEY = "sb_publishable_HsaM0F2t0OJNjHt48hdYgw_OzBD_ylJ";

// ✅ Longer timeout
const HARD_TIMEOUT_MS = 180000; // 3 minutes

// ✅ Stripe publishable key (SAFE in frontend)
const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51SuRvaQu6FSRjIW6zjcH0X7n0jmSi8fOB10P5Oe1c4ZYn5nV5dd7lMeGkQZ4u4mx7mfH5d01bAbqoP8nbs14TyqP00HzRaaPcz";

// -------------------------
// Helpers
// -------------------------
function getEl<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function getElOpt<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function linkifyHtml(html: string) {
  return (html || "").replace(
    /(^|[\s>(])((https?:\/\/)[^\s<]+)(?=$|[\s)<.,!?])/g,
    (_m, lead, url) =>
      `${lead}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );
}

function htmlToPlainText(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.innerText || "";
}

function safeName(s: string) {
  return (s || "lesson")
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 90);
}

function esc(s: any) {
  return escapeHtml(String(s ?? ""));
}

(window as any).openPresentMode = function (lessonId: string) {
  if (!lessonId) return;
  window.location.href = `/present.html?id=${encodeURIComponent(lessonId)}`;
};

function extractSectionBlocksFromPlainText(text: string) {
  const lines = String(text || "").replaceAll("\r\n", "\n").split("\n");
  const out: Array<{ heading: string; lines: string[] }> = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    const isHeading = /^\d+\)\s+/.test(line);
    if (isHeading) {
      if (current) out.push(current);
      current = { heading: line, lines: [] };
      continue;
    }
    if (!current) continue;
    current.lines.push(raw);
  }
  if (current) out.push(current);
  return out;
}

type PresentSlideDefinition = {
  type: "headline" | "split" | "question" | "writing" | "energy" | "discussion";
  heading: string;
  subtext?: string;
  items?: string[];
  question?: string;
  prompt?: string;
  section?: string;
  notes?: string;
  durationSeconds?: number;
  teacherCue?: string;
};

type StructuredLessonSections = {
  objective?: string;
  successCriteria?: string[];
  vocab?: string[];
  cfu?: { tier1?: string; tier2?: string; tier3?: string };
  modeling?: string;
  guided?: string;
  independent?: string;
  exit?: string;
  rubric?: string;
  reteach?: string;
  misconceptions?: string[];
};

type SlideSupportOptions = {
  eb: boolean;
  sped: boolean;
};

function resolveLessonModeFromPublisher(publisher: string): "bluebonnet" | "amplify" | "generic" {
  const p = String(publisher || "").toLowerCase();
  if (p.includes("bluebonnet")) return "bluebonnet";
  if (p.includes("amplify")) return "amplify";
  return "generic";
}

function buildSlideDefinitionsFromLesson(plainText: string, structuredSections?: StructuredLessonSections, supportOptions?: Partial<SlideSupportOptions>): PresentSlideDefinition[] {
  const text = String(plainText || "").replaceAll("\r\n", "\n");
  const blocks = extractSectionBlocksFromPlainText(text);
  const findBlock = (...patterns: RegExp[]) =>
    blocks.find((b) => patterns.some((p) => p.test(b.heading.toLowerCase())));
  const blockLines = (block?: { heading: string; lines: string[] }) =>
    (block?.lines || []).map((line) => line.trim()).filter(Boolean);
  const firstMeaningfulLine = (lines: string[]) =>
    lines.find((line) => line && !/^[-•]/.test(line) && !/^tier\s*\d+/i.test(line));
  const bulletItems = (lines: string[], limit = 4) =>
    lines
      .map((line) => line.replace(/^[-•]\s*/, "").replace(/^\d+[\).]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, limit);

  const defs: PresentSlideDefinition[] = [];
  const normalizedSections = (structuredSections && typeof structuredSections === "object") ? structuredSections : {};
  const sectionObjective = String(normalizedSections.objective || "").trim();
  const sectionSuccess = Array.isArray(normalizedSections.successCriteria) ? normalizedSections.successCriteria.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const sectionVocab = Array.isArray(normalizedSections.vocab) ? normalizedSections.vocab.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const sectionModeling = String(normalizedSections.modeling || "").trim();
  const sectionGuided = String(normalizedSections.guided || "").trim();
  const sectionIndependent = String(normalizedSections.independent || "").trim();
  const sectionExit = String(normalizedSections.exit || "").trim();
  const sectionCfu = [normalizedSections.cfu?.tier1, normalizedSections.cfu?.tier2, normalizedSections.cfu?.tier3]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const supports: SlideSupportOptions = {
    eb: supportOptions?.eb !== false,
    sped: supportOptions?.sped !== false,
  };
  const withEbStem = (text: string, stem: string) => supports.eb ? `${text} • Sentence stem: ${stem}` : text;
  const withSpedChunk = (text: string, chunk: string) => supports.sped ? `${text} • Steps: ${chunk}` : text;

  const addEnergy = (heading: string, subtext: string, section: string, cue: string, durationSeconds = 30) => {
    defs.push({
      type: "energy",
      heading,
      subtext,
      section,
      notes: "Use this transition to reset class attention and pacing.",
      durationSeconds,
      teacherCue: cue,
    });
  };

  const objectiveBlock = findBlock(/objective|i can/);
  const objectiveText = sectionObjective || firstMeaningfulLine(blockLines(objectiveBlock)) || "Students will demonstrate the target skill with evidence.";
  const questionLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+[\).]\s+/.test(l) && /\?$/.test(l))
    .slice(0, 8);
  const hookQuestion = questionLines[0]?.replace(/^\d+[\).]\s+/, "").trim() || "What big idea should we prove by the end of class?";
  const inferenceQuestion = questionLines[1]?.replace(/^\d+[\).]\s+/, "").trim() || "If a character faces fear, what message might the author be building?";
  const likelyTopic = (objectiveText.match(/theme|courage|fear|friendship|perseverance|kindness/i)?.[0] || "friendship").toLowerCase();
  const incompleteEvidence = sectionModeling || "She walked into the dark forest even though her hands were shaking.";

  addEnergy("🔥 TODAY'S MISSION", "One goal. One focus. One strong lesson.", "Launch", "Open with confidence and name today's mission in one sentence.");

  defs.push({
    type: "question",
    heading: "THEME OR JUST A TOPIC?",
    question: `Is "${likelyTopic}" a theme or just a topic?`,
    prompt: withEbStem("No answer yet. Turn and argue.", "I agree/disagree because ___."),
    section: "Provocation",
    notes: "Create productive tension before students read.",
    durationSeconds: 75,
    teacherCue: withSpedChunk("Push students to justify their side.", "Think 15 sec → turn-and-talk → 2 share-outs."),
  });

  defs.push({
    type: "question",
    heading: "Prediction Pressure",
    question: inferenceQuestion.slice(0, 220),
    prompt: withEbStem("Predict now, then hunt for proof while reading.", "The author might be saying ___ because ___."),
    section: "Pre-Reading",
    notes: "Set a reading mission before students open the text.",
    durationSeconds: 75,
    teacherCue: "Collect 2 predictions and post them for verification later.",
  });

  defs.push({
    type: "question",
    heading: "Incomplete Evidence",
    question: incompleteEvidence.slice(0, 220),
    prompt: withEbStem("Does this prove courage or just action? Defend your choice.", "This proves ___ because line ___ shows ___."),
    section: "Pre-Reading",
    notes: "Students analyze evidence quality before full reading.",
    durationSeconds: 90,
    teacherCue: "Ask: Which exact words in the line support your claim?",
  });

  defs.push({
    type: "discussion",
    heading: "Debate Setup",
    prompt: withEbStem("Agree or disagree: A theme must be clearly stated in the text.", "I agree/disagree because ___."),
    section: "Pre-Reading",
    notes: "Create intellectual posture before the story begins.",
    durationSeconds: 90,
    teacherCue: "Move students to a side and cold call both positions.",
  });

  defs.push({
    type: "headline",
    heading: "Objective",
    subtext: objectiveText.slice(0, 220),
    section: "Objective",
    notes: "Now anchor the mission with explicit lesson target.",
    durationSeconds: 75,
    teacherCue: "Link objective to the debate: 'Today we prove, not guess.'",
  });

  addEnergy("🎯 WHAT SUCCESS LOOKS LIKE", "Build quality before students begin.", "Success Setup", "Tell students they will prove learning with evidence, not guesses.");

  const successBlock = findBlock(/success criteria/);
  const successItems = sectionSuccess.length ? sectionSuccess.slice(0, 5) : bulletItems(blockLines(successBlock), 5);
  for (const [idx, item] of successItems.entries()) {
    defs.push({
      type: "headline",
      heading: `Success Move ${idx + 1}`,
      subtext: item.slice(0, 220),
      section: "Success Criteria",
      notes: "Keep one thought per slide so students focus on this move only.",
      durationSeconds: 60,
      teacherCue: "Ask: 'Show me what this would look like in a strong response.'",
    });
  }

  addEnergy("🧠 LET'S THINK", "Predict first, then prove it.", "Engagement", "Give 20 seconds silent think time before partner talk.");

  defs.push({
    type: "question",
    heading: "Concept Hook",
    question: hookQuestion,
    prompt: withEbStem("Turn and talk: share one answer and one reason.", "I think ___ because ___."),
    section: "Engagement",
    notes: "Activate prior knowledge before explicit instruction.",
    durationSeconds: 75,
    teacherCue: withSpedChunk("Cold call two students and ask each for their proof.", "Think 15 sec → partner share → whole-class response."),
  });

  addEnergy("📚 POWER WORDS", "Say it. Use it. Own it.", "Vocabulary", "Choral read each term, then require one term in the next response.");
  const vocabBlock = findBlock(/academic vocabulary|vocabulary|frontloading/);
  const vocabItems = sectionVocab.length ? sectionVocab.slice(0, 4) : bulletItems(blockLines(vocabBlock));
  for (const term of vocabItems) {
    defs.push({
      type: "headline",
      heading: "Power Word",
      subtext: term.slice(0, 220),
      section: "Vocabulary",
      notes: "One vocabulary focus per moment improves retention.",
      durationSeconds: 45,
      teacherCue: withEbStem("Ask students to use the word in a sentence with evidence language.", "The author shows ___ when ___."),
    });
  }

  const cfuBlock = findBlock(/cfu ladder|checks? for understanding|cfu/);
  const cfuItems = sectionCfu.length ? sectionCfu.slice(0, 3) : bulletItems(blockLines(cfuBlock), 3);
  const cfuPrompts = [
    "Tier 1 checks recall and baseline understanding.",
    "Tier 2 requires evidence and reasoning debate.",
    "Tier 3 pushes transfer: create your own example.",
  ];
  if (cfuItems[0]) {
    addEnergy("⚡ QUICK CHECK", "Tier 1: Show what you know.", "CFU Tier 1", "Pause after first answer and ask: 'Where is your proof?'", 25);
    defs.push({
      type: "question",
      heading: "CFU Tier 1",
      question: cfuItems[0].slice(0, 220),
      prompt: cfuPrompts[0],
      section: "Checks for Understanding",
      notes: "Keep pace tight and verify whole-class readiness.",
      durationSeconds: 75,
      teacherCue: withSpedChunk("No-opt-out if needed; expect concise responses.", "Step 1 identify idea, Step 2 state proof."),
    });
  }

  addEnergy("👀 WATCH ME", "Model the thinking, not just the answer.", "Modeling", "Narrate the decision-making process explicitly.");
  const modelingBlock = findBlock(/modeling|mini-lesson|i do/);
  const modelingText = sectionModeling || firstMeaningfulLine(blockLines(modelingBlock));
  if (modelingText) {
    defs.push({
      type: "question",
      heading: "Modeling Move",
      question: modelingText.slice(0, 220),
      prompt: "Listen for claim → evidence → reasoning in sequence.",
      section: "I Do",
      notes: "Think-aloud and annotate your reasoning path.",
      durationSeconds: 180,
      teacherCue: "Pause midway and ask students to predict the next reasoning step.",
    });
  }

  if (cfuItems[1]) {
    addEnergy("🗣️ EVIDENCE DEBATE", "Tier 2: Defend your evidence.", "CFU Tier 2", "Push students to justify why one piece of evidence is stronger.", 25);
    defs.push({
      type: "discussion",
      heading: "CFU Tier 2",
      prompt: cfuItems[1].slice(0, 220),
      section: "Checks for Understanding",
      notes: "Students compare and defend evidence quality.",
      durationSeconds: 90,
      teacherCue: "Ask: 'Which line proves it best, and why not the other one?'",
    });
  }

  addEnergy("🤝 YOUR TURN", "Now practice with support.", "Guided Practice", "Set 60-second partner rehearsal before share-out.");
  const guidedBlock = findBlock(/guided practice|we do|collaborative practice/);
  const guidedPrompt = sectionGuided || firstMeaningfulLine(blockLines(guidedBlock));
  if (guidedPrompt) {
    defs.push({
      type: "discussion",
      heading: "Guided Practice",
      prompt: withEbStem(guidedPrompt.slice(0, 220), "I claim ___ and the text says ___."),
      section: "We Do",
      notes: "Coach students to refine answers with evidence language.",
      durationSeconds: 180,
      teacherCue: withSpedChunk("Circulate and prompt with: 'What text detail proves your claim?'", "Whisper rehearse → say to partner → write."),
    });
  }

  if (cfuItems[2]) {
    addEnergy("🚀 PROVE IT", "Tier 3: Create and transfer.", "CFU Tier 3", "Require original example creation, then peer response.", 25);
    defs.push({
      type: "writing",
      heading: "CFU Tier 3 Transfer",
      subtext: cfuItems[2].slice(0, 220),
      section: "Checks for Understanding",
      notes: "Students create an original example and justify it.",
      durationSeconds: 120,
      teacherCue: "Ask peers to respond using one agreement or challenge stem.",
    });
  }

  addEnergy("🤫 NOW IT'S QUIET", "Independent thinking time.", "Independent Practice", "Set timer, reduce talk, and conference strategically.");
  const independentBlock = findBlock(/independent practice|you do/);
  const independentPrompt = sectionIndependent || firstMeaningfulLine(blockLines(independentBlock));
  defs.push({
    type: "writing",
    heading: "Independent Practice",
    subtext: withSpedChunk(withEbStem((independentPrompt || "Write a complete response using claim, evidence, and reasoning.").slice(0, 220), "The theme is ___ because line ___ says ___."), "Option A paragraph, Option B sentence frame + evidence line."),
    section: "You Do",
    notes: "Students produce independent written evidence of mastery.",
    durationSeconds: 240,
    teacherCue: "Conference with 2-3 target students and check for explicit evidence.",
  });

  // Keep question-driven practice as optional reinforcement if present.
  for (const [idx, line] of questionLines.slice(1, 4).entries()) {
    defs.push({
      type: "question",
      heading: `Practice Check ${idx + 1}`,
      question: line.replace(/^\d+[\).]\s+/, "").trim().slice(0, 220),
      prompt: withEbStem("Answer in one claim + one evidence sentence.", "I claim ___ because ___."),
      section: "Practice",
      notes: "Use as quick checks to calibrate class readiness.",
      durationSeconds: 90,
      teacherCue: "Call on a student and ask them to cite the exact line.",
    });
  }

  addEnergy("✅ FINAL CHECK", "Show what you learned.", "Exit Ticket", "Give one minute of silent planning before writing.");
  const exitBlock = findBlock(/exit ticket|closure/);
  const exitPrompt = sectionExit || firstMeaningfulLine(blockLines(exitBlock)) || "Summarize the key learning in 2–3 sentences.";
  defs.push({
    type: "writing",
    heading: "Exit Prompt",
    subtext: withEbStem(exitPrompt.slice(0, 220), "Today the author teaches ___ because ___."),
    section: "Exit Ticket",
    notes: "Use exit data to group reteach and extension next lesson.",
    durationSeconds: 120,
    teacherCue: "Collect, sort quickly, and name tomorrow's reteach focus.",
  });

  return defs;
}


function resolveEngagementTemplate(skillFocus: string, subjectValue: string): "neutral" | "sports" | "gaming" | "real-world" | "holiday" {
  const text = `${skillFocus || ""} ${subjectValue || ""}`.toLowerCase();
  if (/(football|basketball|soccer|sports|athlete)/.test(text)) return "sports";
  if (/(gaming|game|fortnite|minecraft|esports)/.test(text)) return "gaming";
  if (/(holiday|winter break|thanksgiving|christmas|new year)/.test(text)) return "holiday";
  if (/(community|real-world|career|workplace|civic)/.test(text)) return "real-world";
  return "neutral";
}


function resolveLessonMode(plainText: string): "bluebonnet" | "amplify" | "generic" {
  const t = (plainText || "").toLowerCase();
  if (t.includes("bluebonnet")) return "bluebonnet";
  if (t.includes("amplify")) return "amplify";
  return "generic";
}

function toLessonExportPayload(opts: {
  plainText: string;
  grade: string;
  subject: string;
  standard: string;
  unit: string;
  lesson: string;
  skillFocus?: string;
}) {
  const blocks = extractSectionBlocksFromPlainText(opts.plainText || "");
  const getBlock = (needle: string) =>
    blocks.find((b) => b.heading.toLowerCase().includes(needle.toLowerCase()));

  const objectiveBlock = getBlock("objective") || getBlock("i can");
  const objective = (objectiveBlock?.lines || [])
    .map((l) => l.trim())
    .find((l) => l && !/^[-•]/.test(l)) || opts.skillFocus || "Students will demonstrate the target skill with evidence.";

  const successBlock = getBlock("success criteria");
  const successCriteria = (successBlock?.lines || [])
    .map((l) => l.trim().replace(/^[-•]\s*/, ""))
    .filter(Boolean)
    .slice(0, 8);

  const vocabBlock = getBlock("academic vocabulary") || getBlock("vocabulary");
  const vocabulary = (vocabBlock?.lines || [])
    .map((l) => l.trim().replace(/^[-•]\s*/, ""))
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => ({ term: line }));

  const qLines = String(opts.plainText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+[\).]\s+/.test(l) && /\?$/.test(l));

  const questions = qLines.slice(0, 20).map((line, idx) => ({
    id: idx + 1,
    prompt: line.replace(/^\d+[\).]\s+/, "").trim(),
    points: idx < 3 ? 2 : idx < 10 ? 3 : 4,
  }));

  const defaultProgressionQuestions = [
    { id: 1, prompt: "What is happening in the text? Summarize the key event or conflict.", points: 2 },
    { id: 2, prompt: "What message or theme is the author teaching?", points: 3 },
    { id: 3, prompt: "What sentence or detail from the text best supports that theme?", points: 3 },
    { id: 4, prompt: "Explain how your evidence supports the theme in 2–3 sentences.", points: 4 },
  ];

  const selectedQuestions = questions.length ? questions : defaultProgressionQuestions;

  const answerKey = selectedQuestions.map((q, idx) => ({
    questionId: q.id,
    prompt: q.prompt,
    answer: idx === 1
      ? "**Claim:** The author teaches that perseverance helps people overcome challenges."
      : "Use text evidence and reasoning to justify the response.",
    evidence: idx === 2 ? "__Evidence:__ \"Even when the path was steep, Maya kept climbing until she reached the top.\"" : undefined,
    rationale: idx === 3
      ? "Teacher explanation: This detail supports the theme because it shows the character choosing persistence despite difficulty."
      : "Teacher explanation: Accept text-based responses that connect claim, evidence, and reasoning.",
  }));

  const title = `${opts.grade} ${opts.subject} — ${opts.standard}`.trim();
  const engagementTemplate = resolveEngagementTemplate(opts.skillFocus || "", opts.subject || "");
  const lessonMode = resolveLessonMode(opts.plainText || "");
  const passageTitle = `${opts.unit || "Unit"} ${opts.lesson || "Lesson"}`.trim();
  const passageText = "Use the generated lesson text/passage content as the reading source for this worksheet pack.";

  return {
    lessonMode,
    meta: {
      teks: opts.standard || "",
      bluebonnetMode: lessonMode === "bluebonnet",
      coldReadSupport: true,
      endOfModulePrep: true,
    },
    header: {
      objective,
      successCriteria: successCriteria.length ? successCriteria : ["I can answer questions using evidence and reasoning."],
      materials: ["Lesson text", "Student notebook", "Annotation tool"],
    },
    alignment: {
      curriculumBridge: [
        {
          connection: `Aligns to ${opts.standard || "target standard"}`,
          supportExplanation: "Students identify theme, justify evidence, and explain reasoning in writing.",
        },
      ],
    },
    instruction: {
      hook: {
        description: "Quick write + turn-and-talk warmup to activate background knowledge.",
      },
      miniLesson: {
        script: "Teacher models how to identify theme and prove it with evidence.",
        modeledExample: "Theme: perseverance. Evidence: character keeps trying after failure.",
      },
      guidedPractice: {
        prompts: selectedQuestions.slice(0, 2).map((q) => q.prompt),
      },
      collaborativePractice: {
        activity: selectedQuestions[2]?.prompt || "Partner discussion: justify strongest evidence.",
      },
      independentPractice: {
        writingPrompt: selectedQuestions[3]?.prompt || "Write a CER response using textual evidence.",
        cerFrame: "Claim: ___ Evidence: ___ Reasoning: ___",
      },
      exitTicket: {
        prompt: selectedQuestions[4]?.prompt || "Connect the theme to a real-life scenario.",
      },
    },
    cfuLadder: {
      tier1: "What happened first in the text?",
      tier2: "Which evidence best supports the theme?",
      tier3: "How does the chosen evidence shape reader understanding?",
    },
    differentiation: {
      ebStems: ["The theme is ___ because ___.", "The text says ___, which shows ___."],
      misconceptions: ["Confusing topic with theme", "Using unrelated details as evidence"],
      reteachPlan: "Reteach in small group with sentence stems and evidence sorting cards.",
    },
    title,
    objective,
    successCriteria: successCriteria.length ? successCriteria : ["I can answer questions using evidence and reasoning."],
    vocabulary,
    passages: [
      {
        title: passageTitle,
        text: passageText,
      },
    ],
    questions: selectedQuestions,
    answerKey,
    exportOptions: { engagementTemplate },
    rubric: {
      title: "Constructed Response Rubric",
      criteria: [
        {
          name: "Claim",
          levels: [
            { label: "Advanced", description: "Clear and precise claim", points: 4 },
            { label: "Proficient", description: "Claim is clear", points: 3 },
            { label: "Developing", description: "Claim is partial", points: 2 },
          ],
        },
        {
          name: "Evidence + Reasoning",
          levels: [
            { label: "Advanced", description: "Strong evidence and reasoning", points: 4 },
            { label: "Proficient", description: "Adequate evidence and reasoning", points: 3 },
            { label: "Developing", description: "Limited evidence/reasoning", points: 2 },
          ],
        },
        {
          name: "Organization",
          levels: [
            { label: "Advanced", description: "Response is logically organized with clear transitions", points: 4 },
            { label: "Proficient", description: "Mostly organized with a clear beginning/middle/end", points: 3 },
            { label: "Developing", description: "Some organization but ideas may be disconnected", points: 2 },
          ],
        },
        {
          name: "Academic Language",
          levels: [
            { label: "Advanced", description: "Uses precise grade-level academic vocabulary", points: 4 },
            { label: "Proficient", description: "Uses some relevant academic language", points: 3 },
            { label: "Developing", description: "Limited or imprecise academic language", points: 2 },
          ],
        },
        {
          name: "Textual Citation Formatting",
          levels: [
            { label: "Advanced", description: "Citations are accurate and consistently formatted", points: 4 },
            { label: "Proficient", description: "Citations are present with minor formatting issues", points: 3 },
            { label: "Developing", description: "Citation attempts are incomplete or inconsistent", points: 2 },
          ],
        },
      ],
      maxPoints: 20,
    },
  };
}


function getAnonKey(): string {
  return (SUPABASE_ANON_KEY || "").trim();
}

function getStripe() {
  const w = window as any;
  if (!w.Stripe) return null;
  return w.Stripe(STRIPE_PUBLISHABLE_KEY);
}

function getPortalReturnUrl() {
  // Stable return url for Stripe Portal + checkout success
  return window.location.origin + window.location.pathname;
}

/** Prevent duplicate listeners when refreshAuthUI runs */
function addOnce(el: HTMLElement | null, key: string, fn: () => void) {
  if (!el) return;
  const anyEl = el as any;
  anyEl.__lr_listeners = anyEl.__lr_listeners || {};
  if (anyEl.__lr_listeners[key]) return;
  anyEl.__lr_listeners[key] = true;
  el.addEventListener("click", fn);
}

/**
 * ✅ PRINT FIX (NORMAL PRINT LAYOUT)
 * This prints ONLY the lesson output, using a clean document in a hidden iframe.
 * It avoids “shrunk/tiny” print caused by app CSS or fixed positioning.
 */
function printOutputHtml(opts: { title: string; metaLine: string; bodyHtml: string }) {
  const { title, metaLine, bodyHtml } = opts;

  const css = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Inter, Arial, sans-serif; }
    .page { padding: 1in; }
    h1 { font-size: 18pt; margin: 0 0 10pt; }
    .meta { font-size: 10.5pt; color: #222; margin: 0 0 12pt; }
    hr { border: 0; border-top: 1px solid #bbb; margin: 10pt 0 14pt; }
    p { margin: 8pt 0; font-size: 11pt; line-height: 1.35; }
    ul, ol { margin: 8pt 0 8pt 18pt; font-size: 11pt; line-height: 1.35; }
    li { margin: 4pt 0; }
    b, strong { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 10pt 0; }
    th, td { border: 1px solid #000; padding: 6pt 6pt; vertical-align: top; font-size: 10.5pt; }
    th { background: #f2f2f2; }
    a { color: #000; text-decoration: underline; }
    .secHead { margin: 12pt 0 6pt; font-weight: 700; font-size: 12pt; }
    /* Page break helpers */
    h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
    table, ul, ol { break-inside: avoid; page-break-inside: avoid; }
    @media print {
      @page { margin: 0; }
      .page { padding: 0.85in; }
    }
  `;

  const doc = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="page">
          <h1>${escapeHtml(title)}</h1>
          <div class="meta">${escapeHtml(metaLine || "")}</div>
          <hr/>
          <div id="content">${bodyHtml || ""}</div>
        </div>
        <script>
          // Ensure fonts/layout settle, then print
          window.onload = () => {
            setTimeout(() => {
              window.focus();
              window.print();
            }, 50);
          };
        </script>
      </body>
    </html>
  `;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");

  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const idoc = iframe.contentDocument || win?.document;
  if (!win || !idoc) {
    iframe.remove();
    throw new Error("Print failed: unable to open print frame.");
  }

  idoc.open();
  idoc.write(doc);
  idoc.close();

  // Cleanup after printing
  const cleanup = () => {
    try {
      iframe.remove();
    } catch {}
    win.removeEventListener("afterprint", cleanup);
  };
  win.addEventListener("afterprint", cleanup);
}

// -------------------------
// ✅ Minimal Supabase Auth (NO supabase-js import)
// -------------------------
type Session = {
  access_token: string;
  refresh_token: string;
  user: { id: string; email?: string | null };
};

const LS_SESSION_KEY = "lr_supabase_session_v1";

function currentSupabaseProjectRef() {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isJwtForCurrentProject(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  const projectRef = currentSupabaseProjectRef();
  if (!projectRef) return true;
  const iss = String(payload.iss || "");
  return iss.includes(`${projectRef}.supabase.co/auth/v1`);
}

function getSessionIfValidForCurrentProject(): Session | null {
  const s = getSavedSession();
  if (!s?.access_token) return null;
  if (!isJwtForCurrentProject(s.access_token)) {
    setSavedSession(null);
    return null;
  }
  return s;
}

function getSavedSession(): Session | null {
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function setSavedSession(s: Session | null) {
  if (!s) localStorage.removeItem(LS_SESSION_KEY);
  else localStorage.setItem(LS_SESSION_KEY, JSON.stringify(s));
}

async function supabaseAuthPOST(path: string, body: any) {
  const anon = getAnonKey();
  if (!anon)
    throw new Error("Missing Supabase anon key in main.ts (SUPABASE_ANON_KEY).");

  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data?.msg || data?.error_description || data?.error || text);
  }
  return data;
}

async function signUp(email: string, password: string) {
  await supabaseAuthPOST("signup", { email, password });
  return await logIn(email, password);
}

async function logIn(email: string, password: string): Promise<Session> {
  const data = await supabaseAuthPOST("token?grant_type=password", {
    email,
    password,
  });

  const session: Session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
  };

  setSavedSession(session);
  console.log("✅ Session saved:", LS_SESSION_KEY);
  return session;
}

async function refreshSessionWithRefreshToken(refreshToken: string): Promise<Session | null> {
  const rt = String(refreshToken || "").trim();
  if (!rt) return null;
  try {
    const data = await supabaseAuthPOST("token?grant_type=refresh_token", {
      refresh_token: rt,
    });
    const session: Session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || rt,
      user: data.user,
    };
    setSavedSession(session);
    return session;
  } catch {
    return null;
  }
}

async function logOut() {
  setSavedSession(null);
}

function requireSession(): Session {
  const s = getSessionIfValidForCurrentProject();
  if (!s?.access_token)
    throw new Error("Please log in again (session missing or from a different Supabase project).");
  return s;
}

function buildFunctionAuthHeaders(accessToken: string): Record<string, string> {
  const token = String(accessToken || "").trim();
  if (!token) throw new Error("No active session token available for function call.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// -------------------------
// PostgREST helper
// -------------------------
async function postgrest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  table: string,
  opts: {
    query?: string;
    body?: any;
    preferReturn?: "representation" | "minimal";
  } = {},
) {
  const anon = getAnonKey();
  if (!anon) throw new Error("Missing Supabase anon key in main.ts.");

  const session = requireSession();

  const url = `${SUPABASE_URL}/rest/v1/${table}${opts.query ? `?${opts.query}` : ""}`;

  const res = await fetch(url, {
    method,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: `return=${opts.preferReturn || "representation"}`,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const raw = typeof data === "string" ? data : JSON.stringify(data || {});
    if (res.status === 401 || raw.includes("INVALID_SESSION")) {
      setSavedSession(null);
      throw new Error("Session expired. Log in again.");
    }
    const msg =
      (typeof data === "object" &&
        (data?.message || data?.hint || data?.details)) ||
      String(data || text || res.statusText);
    throw new Error(msg);
  }

  return data;
}

// -------------------------
// Streaming (SSE) Reader ✅ UPDATED (captures final)
// -------------------------
type StreamHooks = {
  onDelta?: (text: string) => void;
  onFinal?: (obj: any) => void;
  onError?: (obj: any) => void;
};

async function readSSEStream(
  res: Response,
  hooks: StreamHooks,
  signal?: AbortSignal,
) {
  if (!res.body) throw new Error("No response body to stream.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const emitEvent = (eventBlock: string) => {
    const lines = eventBlock.split("\n").map((l) => l.trimEnd());

    // event: <name>
    const eventLine = lines.find((l) => l.startsWith("event:"));
    const eventName = eventLine ? eventLine.slice(6).trim() : "";

    const dataLines = lines
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim());

    for (const d of dataLines) {
      if (!d) continue;
      if (d === "[DONE]") return;

      let obj: any = null;
      try {
        obj = JSON.parse(d);
      } catch {
        obj = { type: "text", text: d };
      }

      // If backend uses explicit event names
      if (eventName === "final") {
        hooks.onFinal?.(obj);
        continue;
      }
      if (eventName === "error") {
        hooks.onError?.(obj);
        continue;
      }

      // If backend encodes event/type inside JSON
      const inferredType =
        String(obj?.type || obj?.event || obj?.kind || "").toLowerCase();

      if (inferredType === "final") {
        hooks.onFinal?.(obj);
        continue;
      }
      if (inferredType === "error") {
        hooks.onError?.(obj);
        continue;
      }

      // Otherwise treat as delta text
      const delta =
        obj?.delta ??
        obj?.text ??
        obj?.output_text ??
        obj?.data?.delta ??
        obj?.data?.text ??
        obj?.content?.delta;

      if (typeof delta === "string" && delta) hooks.onDelta?.(delta);
    }
  };

  while (true) {
    if (signal?.aborted) {
      try {
        await reader.cancel();
      } catch {}
      break;
    }

    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      emitEvent(block);
    }
  }

  if (buffer.trim()) emitEvent(buffer);
}

// -------------------------
// Formatter: raw text -> professional HTML
// -------------------------
const emojiHeadRegex = /^([\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}])\s*(.*)$/u;

function looksLikeTabRow(t: string) {
  return t.includes("\t");
}

function parseTabTable(lines: string[], startIndex: number) {
  const rows: string[][] = [];
  let i = startIndex;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) break;
    if (!looksLikeTabRow(raw)) break;

    const cols = raw.split("\t").map((c) => c.trim());
    if (cols.length < 2) break;
    rows.push(cols);
    i++;
  }

  if (rows.length < 2) return { html: "", nextIndex: startIndex };

  const header = rows[0];
  const body = rows.slice(1);

  const th = header.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const trs = body
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
    )
    .join("");

  const html = `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
  return { html, nextIndex: i };
}

function parsePipeTable(lines: string[], startIndex: number) {
  const tableLines: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const ln = lines[i];
    const trimmed = ln.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2) {
      tableLines.push(trimmed);
      i++;
      continue;
    }
    break;
  }

  if (tableLines.length < 2) return { html: "", nextIndex: startIndex };

  const cleaned = tableLines.filter((r) => {
    const noSpaces = r.replaceAll(" ", "");
    return !/^\|:?-{2,}(:?\|:?-{2,})+\|$/.test(noSpaces);
  });

  if (cleaned.length < 2) return { html: "", nextIndex: i };

  const cells = cleaned.map((r) =>
    r
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim()),
  );
  const header = cells[0];
  const body = cells.slice(1);

  const th = header.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const trs = body
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
    )
    .join("");

  const html = `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
  return { html, nextIndex: i };
}

function formatLessonToHtml(rawText: string) {
  const raw = (rawText || "").replaceAll("\r\n", "\n");
  const cleaned = raw.replace(/^\s*\*\*\s*$/gm, "");

  const escaped = escapeHtml(cleaned);
  const bolded = escaped.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const boldedAndLinkified = linkifyHtml(bolded);

  const lines = boldedAndLinkified.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const flushLists = () => {
    if (inUl) out.push("</ul>");
    if (inOl) out.push("</ol>");
    inUl = false;
    inOl = false;
  };

  const pushSection = (icon: string, title: string) => {
    const safeTitle = title.replace(/<\/?b>/g, "").trim();
    if (!safeTitle) return;
    flushLists();
    out.push(
      `<div class="secHead"><span class="secIcon">${icon}</span><div class="secTitle">${safeTitle}</div></div>`,
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    const emOnly = t.match(emojiHeadRegex);
    if (emOnly && (emOnly[2] ?? "").trim() === "") {
      const icon = emOnly[1];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length) {
        pushSection(icon, lines[j].trim());
        i = j;
        continue;
      }
    }

    if (t.startsWith("|") && t.endsWith("|") && t.length > 2) {
      flushLists();
      const { html, nextIndex } = parsePipeTable(lines, i);
      if (html) {
        out.push(html);
        i = nextIndex - 1;
        continue;
      }
    }

    if (looksLikeTabRow(line)) {
      flushLists();
      const { html, nextIndex } = parseTabTable(lines, i);
      if (html) {
        out.push(html);
        i = nextIndex - 1;
        continue;
      }
    }

    const em = t.match(emojiHeadRegex);
    if (em) {
      const icon = em[1];
      const rest = (em[2] || "").trim();
      if (rest && !rest.includes(":")) {
        pushSection(icon, rest);
        continue;
      }
    }

    const olMatch = t.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (!inOl) {
        flushLists();
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${olMatch[2]}</li>`);
      continue;
    }

    const bulletMatch = t.match(/^(-|•)\s+(.*)$/);
    if (bulletMatch) {
      if (!inUl) {
        flushLists();
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${bulletMatch[2]}</li>`);
      continue;
    }

    const kv = t.match(/^([A-Za-z][A-Za-z\s\/\-&]+):\s*(.+)$/);
    if (kv) {
      if (!inUl) {
        flushLists();
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li><b>${kv[1]}:</b> ${kv[2]}</li>`);
      continue;
    }

    if (!t) {
      flushLists();
      out.push("<br/>");
      continue;
    }

    flushLists();
    out.push(`<p>${line}</p>`);
  }

  flushLists();
  return out.join("\n");
}





type OutputAudienceView = "teacher" | "student";

function buildStudentWorksheetHtml(rawText: string, opts?: { includeTopSignals?: boolean }) {
  const source = (rawText || "").replaceAll("\r\n", "\n");
  const lines = source.split("\n");


  const titleFromSection = lines.find((line) => {
    const t = line.trim();
    return /^section\s*\d+/i.test(t) || /student\s+practice/i.test(t);
  });

  const worksheetTitle = titleFromSection?.trim() || "Student Practice: Theme & Evidence";

  const questionSeeds = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^\d+\.\s+/.test(line) || /\?$/.test(line));

  const cleanQuestion = (q: string) =>
    q
      .replace(/^\d+\.\s*/, "")
      .replace(/^DOK\s*[1-4]\s*[:\-]\s*/i, "")
      .replace(/^Question\s*[:\-]\s*/i, "")
      .trim();

  const uniqueQuestions: string[] = [];
  for (const seed of questionSeeds) {
    const q = cleanQuestion(seed);
    if (!q) continue;
    if (!uniqueQuestions.includes(q)) uniqueQuestions.push(q);
  }

  const selected = uniqueQuestions.slice(0, 10);

  const renderedQuestions = selected.length
    ? selected
      .map((q, idx) => {
        const points = idx < 2 ? 2 : idx < 6 ? 3 : 4;
        return `
          <div style="margin:0 0 14px;">
            <div style="font-weight:800; margin-bottom:4px;">${idx + 1}. ${escapeHtml(q)} <span style="font-size:12px; color:rgba(255,255,255,.72);">(${points} pts)</span></div>
            <div style="border-bottom:1px solid rgba(255,255,255,.35); height:18px;"></div>
            <div style="border-bottom:1px solid rgba(255,255,255,.22); height:18px; margin-top:6px;"></div>
          </div>
        `;
      })
      .join("")
    : `
      <div style="margin:0 0 14px;">
        <div style="font-weight:800; margin-bottom:4px;">1. What theme is developed in the text? Use one detail to support your answer. <span style="font-size:12px; color:rgba(255,255,255,.72);">(3 pts)</span></div>
        <div style="border-bottom:1px solid rgba(255,255,255,.35); height:18px;"></div>
        <div style="border-bottom:1px solid rgba(255,255,255,.22); height:18px; margin-top:6px;"></div>
      </div>
    `;

  const optionalTop = opts?.includeTopSignals
    ? `
      <div class="authBox" style="margin:0 0 10px;">
        <div class="sectionTitle" style="margin-top:0;">🧾 Student Worksheet View Active</div>
        <div class="miniHelp" style="margin:0;">Formatted for print-ready student use with response lines and point values.</div>
      </div>
    `
    : "";

  return `
    ${optionalTop}
    <div class="authBox" style="margin:0 0 10px;">
      <div class="sectionTitle" style="margin-top:0;">${escapeHtml(worksheetTitle)}</div>
      <p style="margin-top:0;"><b>Directions:</b> Read each text carefully. Answer each question in complete sentences using text evidence.</p>
      ${renderedQuestions}
      <div style="margin-top:10px; font-size:12px; color:rgba(255,255,255,.78);">Rubric tip: use evidence, reasoning, and academic vocabulary in every response.</div>
    </div>
  `;
}
type CurriculumToneProfile = {
  name: string;
  flowWords: [string, string, string];
  assessmentType: string;
  assessmentLabel: string;
  discussionLanguage: string;
  interventionLanguage: string;
};

function getCurriculumTerms(publisherName: string): CurriculumToneProfile {
  const p = (publisherName || "").toLowerCase();

  if (p.includes("bluebonnet")) {
    return {
      name: "Bluebonnet",
      flowWords: ["Cold Read 1", "Cold Read 2", "End-of-Module Assessment"],
      assessmentType: "short constructed response",
      assessmentLabel: "Bluebonnet weekly assessment format",
      discussionLanguage: "fidelity look-fors",
      interventionLanguage: "module reteach block",
    };
  }

  if (p.includes("amplify")) {
    return {
      name: "Amplify",
      flowWords: ["Close Reading", "Work Time", "Unit Assessment"],
      assessmentType: "text-based written response",
      assessmentLabel: "Amplify unit assessment format",
      discussionLanguage: "discussion protocols",
      interventionLanguage: "targeted support block",
    };
  }

  if (p.includes("houghton") || p.includes("hmh") || p.includes("mcgraw") || p.includes("savvas")) {
    return {
      name: "HMH/McGraw/Savvas",
      flowWords: ["Guided Reading", "Practice Task", "Performance Task"],
      assessmentType: "performance-based written response",
      assessmentLabel: "performance task expectations",
      discussionLanguage: "guided discussion stems",
      interventionLanguage: "small-group reteach cycle",
    };
  }

  return {
    name: "District Curriculum",
    flowWords: ["Core Lesson", "Reteach Routine", "Weekly Assessment"],
    assessmentType: "standards-based written response",
    assessmentLabel: "weekly assessment format",
    discussionLanguage: "curriculum look-fors",
    interventionLanguage: "intervention block",
  };
}

function buildCurriculumBridgeHtml(opts: {
  publisher: string;
  standard: string;
  unit: string;
  lesson: string;
}) {
  const terms = getCurriculumTerms(opts.publisher);
  const publisherLabel = escapeHtml(opts.publisher || "Selected curriculum");
  const unitLabel = escapeHtml(opts.unit || "Current unit");
  const lessonLabel = escapeHtml(opts.lesson || "Today’s lesson");
  const standardLabel = escapeHtml(opts.standard || "Selected standard");

  return `
    <div class="authBox" style="margin-top:12px;">
      <div class="sectionTitle" style="margin-top:0;">Curriculum Bridge Map</div>
      <table>
        <thead>
          <tr>
            <th>Curriculum Connection</th>
            <th>How This Lesson Supports It</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${publisherLabel} • ${unitLabel} • ${lessonLabel}</td>
            <td>Schedule this as a 15-minute bridge after <b>${terms.flowWords[1]}</b> to lock in ${standardLabel} before <b>${terms.flowWords[2]}</b>.</td>
          </tr>
          <tr>
            <td>${terms.assessmentLabel}</td>
            <td>Each response is structured as a <b>${terms.assessmentType}</b> with explicit evidence + reasoning language your assessment expects.</td>
          </tr>
          <tr>
            <td>Cold Read protocol + discussion</td>
            <td>Students annotate independently for 3 minutes, then use partner turn-and-talk with accountable stems during debrief.</td>
          </tr>
          <tr>
            <td>Small-group intervention</td>
            <td>Use DOK 1→3 CFU sequencing for reteach groups, then assign one transfer question as an independent check.</td>
          </tr>
        </tbody>
      </table>

      <div class="sectionTitle" style="margin-top:12px;">📎 Use With Your Curriculum Today</div>
      <ul class="mList" style="margin-top:0;">
        <li>Launch with a <b>3-minute Cold Read</b> (silent annotate), then move into your <b>${terms.interventionLanguage}</b> routine.</li>
        <li>Require a <b>claim + evidence + reasoning</b> response on every prompt so practice mirrors graded writing expectations.</li>
        <li>Use the final question as a <b>4-point mini-rubric check</b> before <b>${terms.flowWords[2]}</b>.</li>
        <li>Listen for and reinforce <b>${terms.discussionLanguage}</b> during partner talk and CFU debriefs.</li>
      </ul>
    </div>
  `;
}

function stripLegacyCurriculumBridgeHtml(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html || "";

  // Remove section headings that look like legacy bridge maps + their immediate table/list blocks
  const secHeads = Array.from(root.querySelectorAll(".secHead"));
  for (const head of secHeads) {
    const titleEl = head.querySelector(".secTitle");
    const title = (titleEl?.textContent || head.textContent || "").toLowerCase();
    const looksLikeBridge =
      title.includes("curriculum bridge") ||
      title.includes("bridge map") ||
      title.includes("curriculum components") ||
      title.includes("curriculum map");

    if (!looksLikeBridge) continue;

    const next = head.nextElementSibling;
    head.remove();

    if (next && ["TABLE", "UL", "OL", "P", "DIV"].includes(next.tagName)) {
      next.remove();
    }
  }

  // Remove bare placeholder lines/divs for Curriculum Bridge Map with no content
  const placeholders = Array.from(root.querySelectorAll("p,div"));
  for (const node of placeholders) {
    const txt = (node.textContent || "").trim().toLowerCase();
    const isBridgePlaceholder = txt === "🗺️ curriculum bridge map" || txt === "curriculum bridge map";
    if (isBridgePlaceholder) node.remove();
  }

  // Remove legacy TEKS-only bridge tables if they still exist
  const tables = Array.from(root.querySelectorAll("table"));
  for (const t of tables) {
    const txt = (t.textContent || "").toLowerCase();
    const looksLikeLegacy =
      (txt.includes("curriculum components") || txt.includes("teks")) &&
      (txt.includes("purpose") || txt.includes("determine theme") || txt.includes("students will"));
    if (looksLikeLegacy) t.remove();
  }

// 🔥 Remove numbered Curriculum Bridge section headings like:
// "2) 🗺️ Curriculum Bridge Map"
const allNodes = Array.from(root.querySelectorAll("*"));
for (const node of allNodes) {
  const txt = (node.textContent || "").trim().toLowerCase();

  const looksNumberedBridge =
    txt.includes("curriculum bridge map") &&
    (txt.startsWith("2)") ||
     txt.startsWith("2.") ||
     txt.match(/^\d+\)/));

  if (looksNumberedBridge) {
    node.remove();
  }
}
return root.innerHTML;
}


function normalizePublisherForBadge(publisherName: string) {
  const p = (publisherName || "").trim();
  if (!p) return "";

  const lower = p.toLowerCase();
  if (lower.includes("savvas")) return "Savvas / Pearson";
  if (lower.includes("bluebonnet")) return "Bluebonnet";
  if (lower.includes("amplify")) return "Amplify";
  if (lower.includes("mcgraw")) return "McGraw Hill";
  if (lower.includes("houghton") || lower.includes("hmh")) return "Houghton Mifflin Harcourt (HMH)";
  if (lower.includes("great minds")) return "Great Minds";
  if (lower.includes("open up")) return "Open Up Resources";
  if (lower.includes("ckla") || lower.includes("core knowledge")) return "CKLA / Core Knowledge";
  if (lower.includes("el education")) return "EL Education";
  if (lower.includes("openscied")) return "OpenSciEd";
  if (lower.includes("curriculum associates") || lower.includes("i-ready")) return "Curriculum Associates (i-Ready)";

  return p;
}

function buildCurriculumModeBadgeHtml(opts: { 
  publisherName: string; 
  standard: string;
  unit?: string;
  lesson?: string;
}) {
  const normalized = normalizePublisherForBadge(opts.publisherName);
  if (!normalized) return "";

  const standardLabel = escapeHtml(opts.standard || "Selected standard");
  const unitLabel = escapeHtml(opts.unit || "");
  const lessonLabel = escapeHtml(opts.lesson || "");

  const supportsLine = (unitLabel && lessonLabel)
    ? `Supports Unit ${unitLabel} • Lesson ${lessonLabel} • ${standardLabel}`
    : `Supports ${standardLabel}`;

  return `
    <div style="
      display:grid;
      gap:4px;
      padding:10px 12px;
      border-radius:14px;
      border:1px solid rgba(56,255,143,0.35);
      background:rgba(56,255,143,0.10);
      color:rgba(255,255,255,0.95);
      margin:0 0 10px;
    ">
      <div style="display:inline-flex; align-items:center; gap:8px; font-size:12px; font-weight:900;">
        <span aria-hidden="true">🟢</span>
        ${escapeHtml(normalized)} Alignment Mode Active
      </div>
      <div style="font-size:12px; font-weight:700; color:rgba(255,255,255,0.90);">
        ${supportsLine}
      </div>
    </div>
  `;
}

function buildEngagementBoostHtml() {
  return `
    <div class="authBox" style="margin:0 0 10px;">
      <div class="sectionTitle" style="margin-top:0;">🔥 Engagement Boost Built In</div>
      <ul class="mList" style="margin-top:0;">
        <li>• Partner talk with structured discourse</li>
        <li>• Tiered CFU questioning (DOK 1–3)</li>
        <li>• Collaborative evidence debate</li>
        <li>• Academic vocabulary usage expectations</li>
      </ul>
    </div>
  `;
}

function injectBridgeIntoSection2(cleanHtml: string, bridgeHtml: string) {
  const root = document.createElement("div");
  root.innerHTML = cleanHtml || "";

  const secHeads = Array.from(root.querySelectorAll(".secHead"));
  const section2Head = secHeads.find((head) => {
    const title = (head.querySelector(".secTitle")?.textContent || head.textContent || "")
      .toLowerCase()
      .trim();
    return /(^|\b)section\s*2(\b|:)/i.test(title) || title.includes("section 2");
  });

  const bridgeWrap = document.createElement("div");
  bridgeWrap.innerHTML = bridgeHtml;
  const bridgeNode = bridgeWrap.firstElementChild;

  if (!bridgeNode) return cleanHtml;

  if (section2Head) {
    // remove empty placeholder block right under section 2 (if present)
    const maybePlaceholder = section2Head.nextElementSibling as HTMLElement | null;
    if (maybePlaceholder) {
      const txt = (maybePlaceholder.textContent || "").trim().toLowerCase();
      const isEmptyPlaceholder =
        (maybePlaceholder.tagName === "P" || maybePlaceholder.tagName === "DIV") &&
        (!txt || txt === "-" || txt === "—" || txt.includes("curriculum bridge map"));
      if (isEmptyPlaceholder) maybePlaceholder.remove();
    }

    section2Head.insertAdjacentElement("afterend", bridgeNode);
    return root.innerHTML;
  }

  // fallback when section 2 heading is not present: place bridge near the top for immediate scan visibility
  const firstSection = root.querySelector(".secHead");
  if (firstSection) {
    firstSection.insertAdjacentElement("beforebegin", bridgeNode);
  } else {
    root.prepend(bridgeNode);
  }
  return root.innerHTML;
}
async function fetchCurriculumAlignment(opts: {
  publisher: string;
  standard: string;
}) {
  try {
    // Step 1: Get program_id from publisher name
    const programRows = await postgrest("GET", "curriculum_programs", {
      query: `select=id&name=eq.${encodeURIComponent(opts.publisher)}&limit=1`,
    });

    if (!Array.isArray(programRows) || !programRows.length) return null;

    const programId = programRows[0].id;

    // Step 2: Find lesson linked to this TEK + program
    const rows = await postgrest("GET", "lesson_standards", {
      query:
        `select=` +
        `lesson_id,` +
        `standards(standard_label),` +
        `curriculum_lessons(` +
          `lesson_code,lesson_order,` +
          `curriculum_units(unit_code,program_id)` +
        `)` +
        `&standards.standard_label=ilike.*${encodeURIComponent(opts.standard)}*` +
        `&curriculum_lessons.curriculum_units.program_id=eq.${programId}` +
        `&limit=1`,
    });

    if (!Array.isArray(rows) || !rows.length) return null;

    const lesson = rows[0].curriculum_lessons;
    const unit = lesson?.curriculum_units;

    return {
      unit: unit?.unit_code || null,
      lesson: lesson?.lesson_code || lesson?.lesson_order || null,
    };
  } catch (e) {
    console.warn("Alignment lookup failed", e);
    return null;
  }
}
function buildWalkthroughLookForsHtml(publisherName: string, standard: string) {
  const normalized = normalizePublisherForBadge(publisherName);
  if (!normalized) return "";

  return `
    <div style="
      margin:0 0 12px;
      padding:10px 12px;
      border-radius:12px;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.08);
      font-size:12px;
    ">
      <div style="font-weight:800; margin-bottom:6px;">
        👀 Walkthrough Look-Fors Covered
      </div>
      <ul style="margin:0; padding-left:16px;">
        <li>Clear objective aligned to ${escapeHtml(standard)}</li>
        <li>Student discourse during collaborative discussion</li>
        <li>Text-based evidence cited in writing and discussion</li>
        <li>Academic vocabulary explicitly reinforced</li>
        <li>CFU ladder with tiered questioning</li>
      </ul>
    </div>
  `;
}
function renderLessonWithCurriculumBridge(lessonText: string, opts: {
  publisher: string;
  standard: string;
  unit: string;
  lesson: string;
  audienceView?: OutputAudienceView;
}) {
  const audienceView = opts.audienceView || "teacher";
  const baseHtml =
    audienceView === "student"
      ? buildStudentWorksheetHtml(lessonText, { includeTopSignals: true })
      : formatLessonToHtml(lessonText);

      const publisherSelected = Boolean((opts.publisher || "").trim());
      if (!publisherSelected) return baseHtml;
      
      const modeBadge = buildCurriculumModeBadgeHtml({
        publisherName: opts.publisher,
        standard: opts.standard,
        unit: opts.unit,
        lesson: opts.lesson,
      });
      
      if (audienceView === "student") {
        return `${modeBadge}${baseHtml}`;
      }
      
      const rewiredHtml = stripLegacyCurriculumBridgeHtml(baseHtml);
      const bridgeHtml = buildCurriculumBridgeHtml(opts);
      const withBridge = injectBridgeIntoSection2(rewiredHtml, bridgeHtml);
      
      const walkthrough = buildWalkthroughLookForsHtml(
        opts.publisher,
        opts.standard
      );
      
      const engagement = buildEngagementBoostHtml();
      const topSignals = `${modeBadge}${walkthrough}${engagement}`;
      
      return `${topSignals}${withBridge}`;
    }
      
    // -------------------------
    // PDF Generation (pdf-lib)
    // -------------------------
async function downloadTextAsPdf(opts: {
  title: string;
  metaLine: string;
  body: string;
  filename: string;
}) {
  const PDFLib = (window as any).PDFLib;
  if (!PDFLib)
    throw new Error("pdf-lib not found. (index.html must include it)");

  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  function toWinAnsiSafeText(input: string) {
    return (input || "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[—–]/g, "-")
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const lineHeight = 14;
  const fontSize = 11;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawLine = (text: string, isBold = false) => {
    const f = isBold ? fontBold : font;
    const safe = toWinAnsiSafeText(text);
    page.drawText(safe, {
      x: margin,
      y,
      size: isBold ? 14 : fontSize,
      font: f,
      color: rgb(0, 0, 0),
    });
    y -= isBold ? 20 : lineHeight;
  };

  const wrapText = (text: string, maxWidth: number) => {
    const safeText = toWinAnsiSafeText(text);
    const words = safeText.split(/\s+/);
    const lines: string[] = [];
    let line = "";

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const width = font.widthOfTextAtSize(test, fontSize);
      if (width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  ensureSpace(80);
  drawLine(opts.title, true);
  drawLine(opts.metaLine);
  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 14;

  const maxTextWidth = pageWidth - margin * 2;
  const rawLines = (opts.body || "").replaceAll("\r\n", "\n").split("\n");

  for (const raw of rawLines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      ensureSpace(lineHeight);
      y -= lineHeight;
      continue;
    }

    const wrapped = wrapText(line.replace(/\*\*/g, ""), maxTextWidth);
    for (const wline of wrapped) {
      ensureSpace(lineHeight);
      page.drawText(toWinAnsiSafeText(wline), {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename.endsWith(".pdf")
    ? opts.filename
    : `${opts.filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

// -------------------------
// Whole-lesson de-dupe
// -------------------------
function dedupeWholeTextIfRepeated(t: string) {
  const s = (t || "").trim();
  if (s.length < 200) return t;

  const mid = Math.floor(s.length / 2);
  const a = s.slice(0, mid).trim();
  const b = s.slice(mid).trim();

  if (a.length > 300 && b.startsWith(a.slice(0, Math.min(600, a.length)))) {
    if (b.includes(a)) return b;
    if (a.includes(b)) return a;
  }

  if (b.length > 300 && s.includes(b) && a.includes(b.slice(0, 200))) {
    return a.length >= b.length ? a : b;
  }

  return t;
}

// ✅ UPDATED: supports your new modes + preserves old aliases
function normalizeMode(v: string) {
  const x = (v || "").trim();

  // legacy aliases (safe)
  if (x === "lite") return "one_pager";
  if (x === "full") return "full_lesson";

  // allow these passthrough modes
  if (
    x === "full_lesson" ||
    x === "internalization" ||
    x === "one_pager" ||
    x === "sub_plan" ||
    x === "admin_defense" ||
    x === "admin_toolkit" ||
    x === "pacing_plan"
  ) {
    return x;
  }

  return x || "full_lesson";
}

// -------------------------
// Stripe Checkout + Portal
// -------------------------
async function ensureLoggedInForBilling(
  authEmail: HTMLInputElement,
  authPassword: HTMLInputElement,
) {
  const s = getSavedSession();
  if (s?.access_token) return s;

  const email = authEmail.value.trim();
  const pw = authPassword.value.trim();
  if (!email || !pw) throw new Error("Enter email + password first, then retry.");

  try {
    return await logIn(email, pw);
  } catch {
    return await signUp(email, pw);
  }
}

// -------------------------
// ✅ Subscription state (cached) FIXED (no duplicate types, caches raw status)
// -------------------------
type SubscriptionState = "unknown" | "active" | "inactive";

let subscriptionStatus: SubscriptionState = "unknown";
let subscriptionRawStatus = "unknown"; // "trialing", "active", "canceled", etc.

const LS_SUB_STATUS_KEY = "lr_subscription_status_v1";
const LS_SUB_STATUS_TS_KEY = "lr_subscription_status_ts_v1";

function isTrialing() {
  return subscriptionStatus === "active" && subscriptionRawStatus === "trialing";
}

function isPaidActive() {
  return subscriptionStatus === "active" && subscriptionRawStatus === "active";
}

function isSubscribed(): boolean {
  return subscriptionStatus === "active";
}

function loadCachedSubStatus(maxAgeMs = 60_000) {
  try {
    const ts = Number(localStorage.getItem(LS_SUB_STATUS_TS_KEY) || "0");
    if (!ts || Date.now() - ts > maxAgeMs) return false;

    const parsed = JSON.parse(localStorage.getItem(LS_SUB_STATUS_KEY) || "{}");
    const st = String(parsed?.status || "unknown") as SubscriptionState;
    const raw = String(parsed?.raw || "unknown").toLowerCase();

    if (st === "active" || st === "inactive" || st === "unknown") {
      subscriptionStatus = st;
      subscriptionRawStatus = raw || "unknown";
      return true;
    }
  } catch {}
  return false;
}

function setCachedSubStatus(status: SubscriptionState, raw?: string) {
  subscriptionStatus = status;
  if (raw) subscriptionRawStatus = raw;

  try {
    localStorage.setItem(
      LS_SUB_STATUS_KEY,
      JSON.stringify({ status: subscriptionStatus, raw: subscriptionRawStatus }),
    );
    localStorage.setItem(LS_SUB_STATUS_TS_KEY, String(Date.now()));
  } catch {}
}

let subscriptionStatusLoading = false;

async function fetchSubscriptionStatus(force = false) {
  const s = getSavedSession();
  if (!s?.access_token) {
    setCachedSubStatus("unknown", "unknown");
    return;
  }

  // use cache for 60s unless forced
  if (!force && loadCachedSubStatus(60_000)) return;

  if (subscriptionStatusLoading) return;
  subscriptionStatusLoading = true;

  try {
    const anon = getAnonKey();
    const session = requireSession();

    // ✅ IMPORTANT: STATUS must hit dynamic-api (NOT create-checkout-session)
    const res = await fetch(SUPABASE_STATUS_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: "status" }),
    });

    const rawText = await res.text();
    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { raw: rawText };
    }

    if (
      res.status === 401 ||
      String(data?.error || "").includes("INVALID_SESSION")
    ) {
      setSavedSession(null);
      setCachedSubStatus("unknown", "unknown");
      return;
    }

    const statusStr = String(
      data?.status ??
        data?.subscriptionStatus ??
        data?.subscription?.status ??
        data?.customer?.subscription?.status ??
        data?.data?.status ??
        data?.data?.subscription?.status ??
        "",
    ).toLowerCase();

    const rawStatus = statusStr || "unknown";

    const active =
      Boolean(data?.active) ||
      Boolean(data?.subscribed) ||
      ["active", "trialing"].includes(rawStatus);

    setCachedSubStatus(active ? "active" : "inactive", rawStatus);
  } catch {
    // keep last known; don't break UI
  } finally {
    subscriptionStatusLoading = false;
  }
}

async function beginCheckout(
  authEmail: HTMLInputElement,
  authPassword: HTMLInputElement,
) {
  const anon = getAnonKey();
  if (!anon) throw new Error("Missing Supabase anon key in main.ts.");

  const session = await ensureLoggedInForBilling(authEmail, authPassword);
  const stripe = getStripe();
  if (!stripe)
    console.warn("⚠️ Stripe.js not found (index.html should include it).");

  // ✅ IMPORTANT: create-checkout-session should NOT receive { action: "checkout" }
  const res = await fetch(SUPABASE_BILLING_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      success_url: getPortalReturnUrl() + "?paid=1",
      cancel_url: window.location.href,

      // compatibility if your function expects camelCase
      successUrl: getPortalReturnUrl() + "?paid=1",
      cancelUrl: window.location.href,
    }),
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw || "Checkout error.");
  }

  if (
    res.status === 401 ||
    String(data?.error || "").includes("INVALID_SESSION")
  ) {
    setSavedSession(null);
    throw new Error("Session expired. Log in again, then retry.");
  }

  const url = data?.url || data?.checkout_url || data?.checkoutUrl;
  const ok = data?.ok ?? true;

  if (!res.ok || !ok)
    throw new Error(data?.error || `Checkout failed (${res.status})`);
  if (!url) throw new Error("Checkout URL missing from server response.");

  window.location.href = url;
}

async function openPortal(
  authEmail: HTMLInputElement,
  authPassword: HTMLInputElement,
) {
  const anon = getAnonKey();
  if (!anon) throw new Error("Missing Supabase anon key in main.ts.");

  const session = await ensureLoggedInForBilling(authEmail, authPassword);

  const res = await fetch(SUPABASE_PORTAL_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      action: "portal",
      return_url: getPortalReturnUrl(),

      // compatibility if your function expects camelCase
      returnUrl: getPortalReturnUrl(),
    }),
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(raw || "Portal error.");
  }

  if (
    res.status === 401 ||
    String(data?.error || "").includes("INVALID_SESSION")
  ) {
    setSavedSession(null);
    throw new Error("Session expired. Log in again, then retry.");
  }

  const url = data?.url;
  if (!res.ok || !url)
    throw new Error(data?.error || `Portal failed (${res.status})`);

  window.location.href = url;
}

// -------------------------
// App
// -------------------------
try {
  // Views
  const landingView = getElOpt<HTMLElement>("landingView");
  const appView = getElOpt<HTMLElement>("appView");

  // -------------------------
// Auth UI (SAFE VERSION)
// -------------------------
const authEmail = getElOpt<HTMLInputElement>("authEmail");
const authPassword = getElOpt<HTMLInputElement>("authPassword");
const signUpBtn = getElOpt<HTMLButtonElement>("signUpBtn");
const logInBtn = getElOpt<HTMLButtonElement>("logInBtn");
const logOutBtn = getElOpt<HTMLButtonElement>("logOutBtn");
const forgotPwBtn = getElOpt<HTMLButtonElement>("forgotPwBtn");
const authStatusPill = getElOpt<HTMLElement>("authStatusPill");
const message = getElOpt<HTMLElement>("message");
const messageApp = getElOpt<HTMLElement>("message_app");

// -------------------------
// Safe Event Listeners
// -------------------------
signUpBtn?.addEventListener("click", () => {
  const email = authEmail?.value?.trim();
  const password = authPassword?.value?.trim();

  if (!email || !password) return;

  console.log("Sign up:", email);
});

logInBtn?.addEventListener("click", () => {
  const email = authEmail?.value?.trim();
  const password = authPassword?.value?.trim();

  if (!email || !password) return;

  console.log("Log in:", email);
});

logOutBtn?.addEventListener("click", () => {
  console.log("Log out");
});

forgotPwBtn?.addEventListener("click", () => {
  const email = authEmail?.value?.trim();
  if (!email) return;

  console.log("Reset password for:", email);
});

  // Billing + top buttons (SAFE)
const billingBtnSubscribe = getElOpt<HTMLButtonElement>("billingBtn_subscribe");
const billingBtn = getElOpt<HTMLButtonElement>("billingBtn");
const billingBtnApp = getElOpt<HTMLButtonElement>("billingBtn_app");
const billingBtnApp2 = getElOpt<HTMLButtonElement>("billingBtn_app2");
const logOutBtnApp = getElOpt<HTMLButtonElement>("logOutBtn_app");

// Form / app UI (SAFE)
const statusPill = getElOpt<HTMLElement>("statusPill");
const metaLineEl = getElOpt<HTMLElement>("metaLine");
const mode = getElOpt<HTMLSelectElement>("mode");

// ✅ SAFE MODE HANDLER
function applyModeAvailability() {
  if (!mode) return; // 🔥 prevents crash

  const proAllowed = isPaidActive();
  const opts = Array.from(mode.querySelectorAll("option"));

  for (const opt of opts) {
    const isPro = opt.getAttribute("data-pro") === "1";

    if (isPro) {
      opt.disabled = !proAllowed;

      if (!proAllowed && mode.value === opt.value) {
        mode.value = "full_lesson";
      }
    }
  }
}
function enforceModeAccess() {
  if (!mode) return; // 🔥 prevents crash on presenter

  // Paid users: unlock Pro-marked options
  applyModeAvailability();

  // Keep dropdown enabled for everyone
  mode.disabled = false;

  // If NOT paid and user somehow selected a Pro mode, force fallback
  const selectedOpt = mode.querySelector(
    `option[value="${CSS.escape(mode.value)}"]`,
  );

  if (
    selectedOpt &&
    selectedOpt.getAttribute("data-pro") === "1" &&
    !isPaidActive()
  ) {
    mode.value = "full_lesson";
  }
}

  const outputStyle = getElOpt<HTMLSelectElement>("outputStyle");
  const audienceView = getElOpt<HTMLSelectElement>("audienceView");
  const state = getEl<HTMLSelectElement>("state");
  const publisher = getElOpt<HTMLSelectElement>("publisher");
  publisher?.addEventListener("change", refreshPublisherUI);
  const publisherOtherWrap = getEl<HTMLElement>("publisherOtherWrap");
  const publisherOther = getEl<HTMLInputElement>("publisherOther");

  const grade = getEl<HTMLSelectElement>("grade");
  const subject = getEl<HTMLSelectElement>("subject");
  const standard = getEl<HTMLSelectElement>("standard");
  function getSelectedStandardDisplay(): string {
    const select = standard;
    if (!select) return "";
    const opt = select.options[select.selectedIndex];
    return opt?.textContent || select.value;
  }
 // ================================
// 🔹 Standards Dropdown Loader
// ================================

// 🔒 Prevent race conditions
let standardsRequestCounter = 0;

async function loadStandardsFor(gradeVal: string, subjectVal: string) {
  try {
    const normalizedGrade = gradeVal === "K" ? 0 : Number(gradeVal);

    const anon = getAnonKey();

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/standards_canonical?select=standard_label,skill_display_name,canonical_skill&grade=eq.${normalizedGrade}&subject=eq.${encodeURIComponent(subjectVal)}&order=standard_label.asc`,
      {
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
        },
      }
    );

if (!res.ok) throw new Error(await res.text());

const rows = await res.json();

    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.error("loadStandardsFor error", e);
    return [];
  }
}

async function refreshStandardDropdown(): Promise<void> {
  const requestId = ++standardsRequestCounter;

  const gradeVal = grade?.value;
  const subjectVal = subject?.value;

  if (!gradeVal || !subjectVal) return;

  const data = await loadStandardsFor(gradeVal, subjectVal);

  // 🚨 Ignore stale async responses
  if (requestId !== standardsRequestCounter) return;

  const selects = [
    document.getElementById("standard"),
    document.getElementById("qs_standard"),
  ].filter(Boolean) as HTMLSelectElement[];

  selects.forEach((select) => {
    const previousValue = select.value;

    select.innerHTML = "";

    data.forEach((row: any) => {
      const opt = document.createElement("option");
      opt.value = row.standard_label;
      opt.textContent =
      `${row.standard_label} — ${row.description || row.skill_display_name}`;
      select.appendChild(opt);
    });

    // Restore selection if still valid
    if ([...select.options].some(o => o.value === previousValue)) {
      select.value = previousValue;
    }
  });
}

// Event listeners
grade?.addEventListener("change", refreshStandardDropdown);
subject?.addEventListener("change", refreshStandardDropdown);

// ⚠️ Remove this if you still see flicker
// refreshStandardDropdown();
// ================================
// 🔹 Quick Panel Sync → Main Form
// ================================

const qsGrade = getElOpt<HTMLSelectElement>("qs_grade");
const qsSubject = getElOpt<HTMLSelectElement>("qs_subject");
const qsStandard = getElOpt<HTMLSelectElement>("qs_standard");

// Sync Quick → Advanced (Grade)
qsGrade?.addEventListener("change", () => {
  if (!grade) return;
  grade.value = qsGrade.value;

  // 🔥 TRIGGER actual change event
  grade.dispatchEvent(new Event("change", { bubbles: true }));
});

// Sync Quick → Advanced (Subject)
qsSubject?.addEventListener("change", () => {
  if (!subject) return;
  subject.value = qsSubject.value;

  // 🔥 TRIGGER actual change event
  subject.dispatchEvent(new Event("change", { bubbles: true }));
});

// Sync Quick → Advanced (Standard)
qsStandard?.addEventListener("change", () => {
  if (!standard) return;
  standard.value = qsStandard.value;
});
  const unit = getEl<HTMLInputElement>("unit");
  const lesson = getEl<HTMLInputElement>("lesson");
  const skillFocus = getElOpt<HTMLTextAreaElement>("skillFocus");
  const supportingStandards = getElOpt<HTMLInputElement>("supportingStandards");
  const lessonLength = getElOpt<HTMLInputElement>("lessonLength");
  const includeStaar = getElOpt<HTMLSelectElement>("includeStaar");
  const subNotes = getElOpt<HTMLTextAreaElement>("subNotes");
  const lessonCycleTemplate = getElOpt<HTMLSelectElement>("lessonCycleTemplate");
  const publisherComponents = getElOpt<HTMLTextAreaElement>("publisherComponents");
    // ✅ Skill Focus Auto-Fill (removes activation friction)
  function autoFillSkillFocusIfBlank() {
    if (!skillFocus) return;

    // Only auto-fill if user hasn't typed anything
    if (skillFocus.value.trim().length > 0) return;

    const generated = generateDefaultSkillFocus({
      state: state?.value,
      standard: standard?.value,
      grade: grade?.value,
      subject: subject?.value,
    });

    skillFocus.value = generated;
  }

  // Auto-fill when user changes inputs
  standard?.addEventListener("change", autoFillSkillFocusIfBlank);
  grade?.addEventListener("change", autoFillSkillFocusIfBlank);
  subject?.addEventListener("change", autoFillSkillFocusIfBlank);
  state?.addEventListener("change", autoFillSkillFocusIfBlank);

  // ✅ Campus / Program (DB-powered accuracy) — optional inputs/hidden fields
  const campusId = getElOpt<HTMLInputElement>("campusId"); // hidden or input (not present in your HTML, safe)
  const programName = getElOpt<HTMLInputElement>("programName"); // hidden or input (not present in your HTML, safe)
  const curriculumLessonCode = getElOpt<HTMLInputElement>("curriculumLessonCode"); // optional (not present in your HTML, safe)

  const ebSupport = getElOpt<HTMLInputElement>("ebSupport");
  const spedSupport = getElOpt<HTMLInputElement>("spedSupport");
  const vocabularyFocus = getElOpt<HTMLInputElement>("vocabularyFocus");
  const checksForUnderstanding = getElOpt<HTMLInputElement>("checksForUnderstanding");
  const writingExtension = getElOpt<HTMLInputElement>("writingExtension");

  const practiceToggle = getElOpt<HTMLInputElement>("practiceToggle");
  const practiceGenre = getElOpt<HTMLSelectElement>("practiceGenre");
  const slangLevel = getElOpt<HTMLSelectElement>("slangLevel");
  const practiceTopic = getElOpt<HTMLInputElement>("practiceTopic");
  const allowTrendy = getElOpt<HTMLSelectElement>("allowTrendy");

  const worksheetToggle = getElOpt<HTMLInputElement>("worksheetToggle");
  const worksheetBeginnerCount = getElOpt<HTMLInputElement>("worksheetBeginnerCount");
  const worksheetIntermediateCount = getElOpt<HTMLInputElement>("worksheetIntermediateCount");
  const worksheetAdvancedCount = getElOpt<HTMLInputElement>("worksheetAdvancedCount");

  const presetName = getElOpt<HTMLInputElement>("presetName");
  const savePresetBtn = getElOpt<HTMLButtonElement>("savePresetBtn");
  const presetSelect = getElOpt<HTMLSelectElement>("presetSelect");
  const loadPresetBtn = getElOpt<HTMLButtonElement>("loadPresetBtn");
  const deletePresetBtn = getElOpt<HTMLButtonElement>("deletePresetBtn");

  const testMode = getEl<HTMLInputElement>("testMode");

  const generateBtn = getEl<HTMLButtonElement>("generateBtn");
  const openLibraryBtn = getEl<HTMLButtonElement>("openLibraryBtn");
  const closeLibraryBtn = getEl<HTMLButtonElement>("closeLibraryBtn");

  // Output actions
  const outputView = getEl<HTMLElement>("outputView");
  const libraryView = getEl<HTMLElement>("libraryView");
  const librarySearch = getEl<HTMLInputElement>("librarySearch");
  const libraryList = getEl<HTMLElement>("libraryList");

  const favoriteBtn = getEl<HTMLButtonElement>("favoriteBtn");
  const copyBtn = getEl<HTMLButtonElement>("copyBtn");
  const copyDocsBtn = getElOpt<HTMLButtonElement>("copyDocsBtn");
  const printBtn = getElOpt<HTMLButtonElement>("printBtn");
  const downloadPdfBtn = getEl<HTMLButtonElement>("downloadPdfBtn");
  const exportPackBtn = getElOpt<HTMLButtonElement>("exportPackBtn");

  const output = getEl<HTMLElement>("output");

  // Feedback Garage (HTML has it — but backend endpoint/table might not yet exist, so it’s optional/safe)
  const submitFeedbackBtn = getElOpt<HTMLButtonElement>("submitFeedbackBtn");
  const feedbackCategory = getElOpt<HTMLSelectElement>("feedbackCategory");
  const feedbackText = getElOpt<HTMLTextAreaElement>("feedbackText");
  const feedbackStatus = getElOpt<HTMLElement>("feedbackStatus");

  let lastLessonPlainText = "";
  let activeStreamAbort: AbortController | null = null;
  let lastLessonId: string | null = null;
  let lastLessonFavorite = false;

  // -------------------------
  // UI helpers
  // -------------------------
  function setStatus(text: string) {
    statusPill.textContent = text;
  }

  function activeMessageEl(): HTMLElement {
    const appIsVisible = appView ? appView.style.display !== "none" : false;
    if (appIsVisible && messageApp) return messageApp;
    return message;
  }

  function showMessage(html: string, ok = true) {
    const target = activeMessageEl();
    target.innerHTML = `<div class="${ok ? "ok" : "error"}">${html}</div>`;
  }

  function clearMessage() {
    message.innerHTML = "";
    if (messageApp) messageApp.innerHTML = "";
  }

  function setMeta(text: string) {
    metaLineEl.textContent = text;
  }

  function setView(isLoggedIn: boolean) {
  if (!landingView || !appView) return;

  if (landingView) landingView.style.display = "none";
  if (appView) appView.style.display = "block";

  if (isLoggedIn) {
    document.body.classList.add("logged-in");
  } else {
    document.body.classList.remove("logged-in");
  }
}
  function refreshPublisherUI() {
    publisherOtherWrap.style.display = publisher.value === "Other" ? "block" : "none";
  }

  function showLibrary(show: boolean) {
    outputView.style.display = show ? "none" : "block";
    libraryView.style.display = show ? "block" : "none";
    openLibraryBtn.style.display = show ? "none" : "inline-block";
    closeLibraryBtn.style.display = show ? "inline-block" : "none";
  }

  async function refreshBillingUI(forceStatus = false) {
    const s = getSavedSession();
    const loggedIn = Boolean(s?.access_token);

    if (!loggedIn) {
      setCachedSubStatus("unknown", "unknown");
    } else {
      await fetchSubscriptionStatus(forceStatus);
      enforceModeAccess();
    }

    // Landing view subscribe button (only when logged OUT)
    if (billingBtnSubscribe) {
      billingBtnSubscribe.style.display = loggedIn ? "none" : "inline-block";
    }

    // ✅ Hide legacy button
    if (billingBtn) {
      billingBtn.style.display = "none";
    }

    // ✅ Single source of truth: billingBtn_app
    if (billingBtnApp) {
      billingBtnApp.style.display = loggedIn ? "inline-block" : "none";
      billingBtnApp.textContent = isSubscribed() ? "Manage Subscription" : "Subscribe";
    }

    // ✅ Always hide duplicate (if it exists)
    if (billingBtnApp2) {
      billingBtnApp2.style.display = "none";
    }
  }

  function refreshAuthUI() {
    const s = getSavedSession();
    const loggedIn = Boolean(s?.access_token);

    authStatusPill.textContent = loggedIn
      ? `Logged in: ${s?.user?.email || s?.user?.id}`
      : "Not logged in";

    signUpBtn.style.display = loggedIn ? "none" : "inline-block";
    logInBtn.style.display = loggedIn ? "none" : "inline-block";
    if (forgotPwBtn) forgotPwBtn.style.display = loggedIn ? "none" : "inline-block";
    logOutBtn.style.display = loggedIn ? "inline-block" : "none";

    setView(loggedIn);
    favoriteBtn.disabled = !loggedIn || !lastLessonId;

    // billing UI is async (status call)
    refreshBillingUI(false).catch(() => {});
  }

  refreshPublisherUI();
  publisher?.addEventListener("change", refreshPublisherUI);

  // ✅ Keep mode access correct if user changes mode
  mode?.addEventListener("change", () => enforceModeAccess());

  // -------------------------
  // ✅ BUTTON WIRING
  // -------------------------
  addOnce(signUpBtn, "signup", async () => {
    try {
      clearMessage();
      const email = authEmail.value.trim();
      const pw = authPassword.value.trim();
      if (!email || !pw) return showMessage("Enter email + password.", false);

      await signUp(email, pw);
      showMessage("Account created ✅ Logged in.", true);
      await refreshBillingUI(true);
      enforceModeAccess();

      refreshAuthUI();
    } catch (e: any) {
      showMessage(`Sign up failed: ${esc(e?.message || e)}`, false);
    }
  });

  addOnce(logInBtn, "login", async () => {
    try {
      clearMessage();
      const email = authEmail.value.trim();
      const pw = authPassword.value.trim();
      if (!email || !pw) return showMessage("Enter email + password.", false);

      await logIn(email, pw);
      showMessage("Logged in ✅", true);
      await refreshBillingUI(true);
      enforceModeAccess();

      refreshAuthUI();
    } catch (e: any) {
      showMessage(`Login failed: ${esc(e?.message || e)}`, false);
    }
  });

  if (forgotPwBtn) {
    addOnce(forgotPwBtn, "forgot", async () => {
      try {
        clearMessage();
        const email = authEmail.value.trim();
        if (!email) return showMessage("Enter your email first.", false);
        await supabaseAuthPOST("recover", { email });
        showMessage("Password reset email sent ✅ Check your inbox.", true);
      } catch (e: any) {
        showMessage(`Reset failed: ${esc(e?.message || e)}`, false);
      }
    });
  }

  async function doLogout() {
  await logOut();
  showMessage("Logged out ✅", true);
  lastLessonId = null;
  lastLessonFavorite = false;
  favoriteBtn.textContent = "☆ Favorite";
  favoriteBtn.disabled = true;

  setCachedSubStatus("unknown", "unknown");
  enforceModeAccess();
  refreshAuthUI();
}

  addOnce(logOutBtn, "logout", doLogout);
  if (logOutBtnApp) addOnce(logOutBtnApp, "logout_app", doLogout);

  // ✅ Landing subscribe button (if present)
  if (billingBtnSubscribe) {
    addOnce(billingBtnSubscribe, "checkout_subscribe", async () => {
      try {
        clearMessage();
        showMessage("💳 Opening secure checkout…", true);
        await beginCheckout(authEmail, authPassword);
      } catch (e: any) {
        showMessage(`Billing: ${esc(e?.message || e)}`, false);
      }
    });
  }

  // ✅ App primary billing button -> Subscribe (checkout) OR Manage (portal)
  async function handleAppBillingClick() {
    try {
      clearMessage();
      requireSession();

      // Always refresh status right before deciding
      await refreshBillingUI(true);

      if (!isSubscribed()) {
        showMessage("💳 Starting subscription…", true);
        await beginCheckout(authEmail, authPassword);
        return;
      }

      showMessage("🔐 Opening Stripe Customer Portal…", true);
      await openPortal(authEmail, authPassword);
    } catch (e: any) {
      showMessage(`${isSubscribed() ? "Portal" : "Subscribe"}: ${esc(e?.message || e)}`, false);
    }
  }

  if (billingBtnApp) addOnce(billingBtnApp, "app_billing", handleAppBillingClick);
  if (billingBtnApp2) addOnce(billingBtnApp2, "app_billing2", handleAppBillingClick);

  // Paid banner -> also refresh subscription status
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("paid") === "1") {
      showMessage("Payment successful ✅ Checking subscription status…", true);
      url.searchParams.delete("paid");
      window.history.replaceState({}, "", url.toString());
      refreshBillingUI(true).then(() => {
        showMessage(
          isSubscribed()
            ? "Subscription active ✅"
            : "Payment completed ✅ (If you still see Subscribe, refresh once or open Manage Subscription)",
          true,
        );
        refreshAuthUI();
      });
    }
  } catch {}

  // -------------------------
  // Presets
  // -------------------------
  const LS_PRESETS_KEY = "lr_presets_v1";

  type Preset = {
    name: string;
    createdAt: number;
    data: Record<string, any>;
  };

  function loadPresets(): Preset[] {
    try {
      const raw = localStorage.getItem(LS_PRESETS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Preset[]) : [];
    } catch {
      return [];
    }
  }

  function savePresets(presets: Preset[]) {
    localStorage.setItem(LS_PRESETS_KEY, JSON.stringify(presets.slice(0, 30)));
  }

  function upsertPreset(name: string, data: Record<string, any>) {
    const presets = loadPresets();
    const i = presets.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    const next: Preset = { name, createdAt: Date.now(), data };
    if (i >= 0) presets[i] = next;
    else presets.unshift(next);
    savePresets(presets);
  }

  function deletePreset(name: string) {
    const presets = loadPresets().filter((p) => p.name.toLowerCase() !== name.toLowerCase());
    savePresets(presets);
  }

  function collectFormState(): Record<string, any> {
    return {
      mode: mode.value,
      outputStyle: outputStyle?.value ?? "default",
      audienceView: audienceView?.value ?? "teacher",
      state: state.value,
      publisher: publisher.value,
      publisherOther: publisherOther.value,
      grade: grade.value,
      subject: subject.value,
      standard: standard.value,
      unit: unit.value,
      lesson: lesson.value,
      skillFocus: skillFocus?.value ?? "",
      supportingStandards: supportingStandards?.value ?? "",
      lessonLength: lessonLength?.value ?? "45",
      includeStaar: includeStaar?.value ?? "no",
      subNotes: subNotes?.value ?? "",
      lessonCycleTemplate: lessonCycleTemplate?.value ?? "",
      publisherComponents: publisherComponents?.value ?? "",

      campusId: campusId?.value ?? "",
      programName: programName?.value ?? "",
      curriculumLessonCode: curriculumLessonCode?.value ?? "",

      ebSupport: ebSupport?.checked ?? true,
      spedSupport: spedSupport?.checked ?? true,
      vocabularyFocus: vocabularyFocus?.checked ?? true,
      checksForUnderstanding: checksForUnderstanding?.checked ?? true,
      writingExtension: writingExtension?.checked ?? false,
      practiceToggle: practiceToggle?.checked ?? false,
      practiceGenre: practiceGenre?.value ?? "informational",
      slangLevel: slangLevel?.value ?? "light",
      practiceTopic: practiceTopic?.value ?? "",
      allowTrendy: allowTrendy?.value ?? "yes",
      worksheetToggle: worksheetToggle?.checked ?? false,
      worksheetBeginnerCount: worksheetBeginnerCount?.value ?? "6",
      worksheetIntermediateCount: worksheetIntermediateCount?.value ?? "6",
      worksheetAdvancedCount: worksheetAdvancedCount?.value ?? "4",
      testMode: testMode.checked ?? false,
    };
  }

  function applyFormState(data: Record<string, any>) {
    if (data.mode) mode.value = data.mode;
    if (outputStyle && data.outputStyle) outputStyle.value = data.outputStyle;
    if (audienceView && data.audienceView) audienceView.value = data.audienceView;
    if (data.state !== undefined) state.value = data.state;
    if (data.publisher) publisher.value = data.publisher;
    if (data.publisherOther !== undefined) publisherOther.value = data.publisherOther;
    if (data.grade) grade.value = data.grade;
    if (data.subject) subject.value = data.subject;
    if (data.standard !== undefined) standard.value = data.standard;
    if (data.unit !== undefined) unit.value = data.unit;
    if (data.lesson !== undefined) lesson.value = data.lesson;

    if (skillFocus && data.skillFocus !== undefined) skillFocus.value = data.skillFocus;
    if (supportingStandards && data.supportingStandards !== undefined)
      supportingStandards.value = data.supportingStandards;
    if (lessonLength && data.lessonLength !== undefined) lessonLength.value = String(data.lessonLength);
    if (includeStaar && data.includeStaar !== undefined) includeStaar.value = data.includeStaar;

    if (subNotes && data.subNotes !== undefined) subNotes.value = data.subNotes;
    if (lessonCycleTemplate && data.lessonCycleTemplate !== undefined)
      lessonCycleTemplate.value = data.lessonCycleTemplate;
    if (publisherComponents && data.publisherComponents !== undefined)
      publisherComponents.value = data.publisherComponents;

    if (campusId && data.campusId !== undefined) campusId.value = String(data.campusId || "");
    if (programName && data.programName !== undefined) programName.value = String(data.programName || "");
    if (curriculumLessonCode && data.curriculumLessonCode !== undefined)
      curriculumLessonCode.value = String(data.curriculumLessonCode || "");

    if (ebSupport && data.ebSupport !== undefined) ebSupport.checked = !!data.ebSupport;
    if (spedSupport && data.spedSupport !== undefined) spedSupport.checked = !!data.spedSupport;
    if (vocabularyFocus && data.vocabularyFocus !== undefined) vocabularyFocus.checked = !!data.vocabularyFocus;
    if (checksForUnderstanding && data.checksForUnderstanding !== undefined)
      checksForUnderstanding.checked = !!data.checksForUnderstanding;
    if (writingExtension && data.writingExtension !== undefined) writingExtension.checked = !!data.writingExtension;

    if (practiceToggle && data.practiceToggle !== undefined) practiceToggle.checked = !!data.practiceToggle;
    if (practiceGenre && data.practiceGenre !== undefined) practiceGenre.value = data.practiceGenre;
    if (slangLevel && data.slangLevel !== undefined) slangLevel.value = data.slangLevel;
    if (practiceTopic && data.practiceTopic !== undefined) practiceTopic.value = data.practiceTopic;
    if (allowTrendy && data.allowTrendy !== undefined) allowTrendy.value = data.allowTrendy;

    if (worksheetToggle && data.worksheetToggle !== undefined) worksheetToggle.checked = !!data.worksheetToggle;
    if (worksheetBeginnerCount && data.worksheetBeginnerCount !== undefined)
      worksheetBeginnerCount.value = String(data.worksheetBeginnerCount);
    if (worksheetIntermediateCount && data.worksheetIntermediateCount !== undefined)
      worksheetIntermediateCount.value = String(data.worksheetIntermediateCount);
    if (worksheetAdvancedCount && data.worksheetAdvancedCount !== undefined)
      worksheetAdvancedCount.value = String(data.worksheetAdvancedCount);

    if (data.testMode !== undefined) testMode.checked = !!data.testMode;

    refreshPublisherUI();
    enforceModeAccess();
  }

  function refreshPresetDropdown() {
    if (!presetSelect) return;
    const presets = loadPresets();
    presetSelect.innerHTML =
      `<option value="" selected>Select preset…</option>` +
      presets
        .map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`)
        .join("");
  }

  refreshPresetDropdown();

  if (savePresetBtn && presetName) {
    savePresetBtn.addEventListener("click", () => {
      const name = presetName.value.trim();
      if (!name) return showMessage("Type a preset name first.", false);
      upsertPreset(name, collectFormState());
      presetName.value = "";
      refreshPresetDropdown();
      showMessage("Preset saved ✅", true);
    });
  }

  if (loadPresetBtn && presetSelect) {
    loadPresetBtn.addEventListener("click", () => {
      const name = presetSelect.value.trim();
      if (!name) return showMessage("Choose a preset first.", false);
      const p = loadPresets().find((x) => x.name === name);
      if (!p) return showMessage("Preset not found.", false);
      applyFormState(p.data || {});
      showMessage(`Preset loaded ✅ (${esc(name)})`, true);
    });
  }

  if (deletePresetBtn && presetSelect) {
    deletePresetBtn.addEventListener("click", () => {
      const name = presetSelect.value.trim();
      if (!name) return showMessage("Choose a preset first.", false);
      if (!confirm(`Delete preset "${name}"?`)) return;
      deletePreset(name);
      refreshPresetDropdown();
      showMessage("Preset deleted ✅", true);
    });
  }

  // -------------------------
  // Library + Output actions + Generate
  // -------------------------
  async function loadLibrary() {
    clearMessage();
    requireSession();

    const q = librarySearch.value.trim().toLowerCase();

    const rows = await postgrest("GET", "lessons", {
      query:
     "select=id,created_at,grade,subject,standard_label,curriculum_unit,curriculum_lesson,publisher,state,lesson_text,is_favorite" +
     "&order=created_at.desc" +
     "&limit=50",
    });

    let data = Array.isArray(rows) ? rows : [];

    if (q) {
      data = data.filter((r: any) => {
        const blob = [
          r.standard_label,
          r.subject,
          r.curriculum_unit,
          r.curriculum_lesson,
          r.publisher,
          r.state,
          r.lesson_text,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }

    if (!data.length) {
      libraryList.innerHTML = `<div class="pill">No saved lessons yet.</div>`;
      return;
    }

    libraryList.innerHTML = data
      .map((r: any) => {
        const title = `Grade ${r.grade ?? "?"} • ${r.subject ?? ""} • ${r.standard_label ?? ""}`.trim();
        const metaTxt =
          `${r.publisher ?? ""}${r.state ? ` • ${r.state}` : ""} • ${r.curriculum_unit ?? ""} ${r.curriculum_lesson ?? ""}`.trim();
        const star = r.is_favorite ? "★" : "☆";

        return `
          <div class="libraryCard" data-id="${esc(r.id)}">
            <div class="libraryTop">
              <div>
                <div class="libraryTitle">${esc(title)}</div>
                <div class="libraryMeta">${esc(metaTxt)}</div>
              </div>
              <div class="libraryBtns">
                <button class="smallBtn" data-action="star" type="button">${star} Favorite</button>
                <button class="smallBtn" data-action="open" type="button">Open</button>
                <button class="smallBtn present-btn" data-action="present" data-id="${esc(r.id)}" onclick="openPresentMode('${esc(r.id)}')" type="button">🎥 Present Mode</button>
                <button class="smallBtn" data-action="pdf" type="button">PDF</button>
                <button class="smallBtn danger" data-action="delete" type="button">Delete</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  openLibraryBtn.addEventListener("click", async () => {
    try {
      showLibrary(true);
      await loadLibrary();
    } catch (e: any) {
      showMessage(`Library: ${esc(e?.message || e)}`, false);
    }
  });

  closeLibraryBtn.addEventListener("click", () => showLibrary(false));
  librarySearch.addEventListener("input", () => {
    loadLibrary().catch(() => {});
  });

  libraryList.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const btnEl = target.closest("button");
    if (!btnEl) return;

    const card = target.closest(".libraryCard") as HTMLElement | null;
    if (!card) return;

    const lessonId = card.getAttribute("data-id");
    const action = btnEl.getAttribute("data-action");
    if (!lessonId || !action) return;

    try {
      requireSession();

      if (action === "open" || action === "pdf") {
        const rows = await postgrest("GET", "lessons", {
          query:
            "select=id,is_favorite,lesson_text,lesson_html,grade,subject,standard_label,curriculum_unit,curriculum_lesson" +
            `&id=eq.${encodeURIComponent(lessonId)}` +
            "&limit=1",
        });

        const data = Array.isArray(rows) ? rows[0] : null;
        if (!data) return showMessage("Lesson not found.", false);

        showLibrary(false);

        lastLessonId = data.id;
        lastLessonFavorite = Boolean(data.is_favorite);
        favoriteBtn.disabled = false;
        favoriteBtn.textContent = lastLessonFavorite ? "★ Favorited" : "☆ Favorite";

        output.innerHTML = renderLessonWithCurriculumBridge(data.lesson_text || "", {
          publisher: publisher.value === "Other"
            ? (publisherOther.value.trim() || "Other")
            : publisher.value,
          standard: data.standard_label || "",
          unit: data.curriculum_unit || "",
          lesson: data.curriculum_lesson || "",
          audienceView: (audienceView?.value as OutputAudienceView) || "teacher",
        });
        lastLessonPlainText = htmlToPlainText(output.innerHTML);
        downloadPdfBtn.disabled = !lastLessonPlainText.trim();
        if (exportPackBtn) exportPackBtn.disabled = !lastLessonPlainText.trim();

        // ✅ Show Feedback Garage when opening a saved lesson
        const feedbackGarage = getElOpt<HTMLElement>("feedbackGarage");
        if (feedbackGarage) feedbackGarage.style.display = "block";

        if (action === "pdf") {
          const filename = safeName(
            `${data.grade}-${data.subject}-${data.standard}-${data.curriculum_unit}-${data.curriculum_lesson}`,
          );
          await downloadTextAsPdf({
            title: "Lessons-Ready Lesson Plan",
            metaLine: metaLineEl.textContent || "",
            body: lastLessonPlainText,
            filename,
          });
        }
        return;
      }


      if (action === "present") {
        const presentLessonId = btnEl.getAttribute("data-id") || lessonId;
        (window as any).openPresentMode(presentLessonId);
        return;
      }

      if (action === "star") {
        const rows = await postgrest("GET", "lessons", {
          query: `select=is_favorite&id=eq.${encodeURIComponent(lessonId)}&limit=1`,
        });
        const current = Array.isArray(rows) ? rows[0] : null;
        if (!current) return showMessage("Lesson not found.", false);

        const next = !current.is_favorite;

        await postgrest("PATCH", "lessons", {
          query: `id=eq.${encodeURIComponent(lessonId)}`,
          body: { is_favorite: next },
        });

        showMessage(next ? "Saved ⭐" : "Un-saved ✓", true);
        await loadLibrary();
        return;
      }

      if (action === "delete") {
        if (!confirm("Delete this saved lesson?")) return;

        await postgrest("DELETE", "lessons", {
          query: `id=eq.${encodeURIComponent(lessonId)}`,
          preferReturn: "minimal",
        });

        showMessage("Deleted ✅", true);

        if (lastLessonId === lessonId) {
          lastLessonId = null;
          lastLessonFavorite = false;
          favoriteBtn.textContent = "☆ Favorite";
          favoriteBtn.disabled = true;
        }

        await loadLibrary();
        return;
      }
    } catch (e2: any) {
      showMessage(`Library action failed: ${esc(e2?.message || e2)}`, false);
    }
  });

  copyBtn.addEventListener("click", async () => {
    const text = htmlToPlainText(output.innerHTML || "").trim();
    if (!text || text === "(nothing yet)") {
      showMessage("Nothing to copy yet. Generate a lesson first.", false);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showMessage("Copied ✅", true);
    } catch {
      showMessage("Copy failed. Select text and copy manually.", false);
    }
  });

  if (copyDocsBtn) {
    copyDocsBtn.addEventListener("click", async () => {
      const text = htmlToPlainText(output.innerHTML || "").trim();
      if (!text || text === "(nothing yet)") {
        showMessage("Nothing to copy yet. Generate a lesson first.", false);
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        showMessage("Copied for Google Docs ✅", true);
      } catch {
        showMessage("Copy failed. Select text and copy manually.", false);
      }
    });
  }

  // ✅ PRINT (FIXED): uses iframe clean print doc
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      const text = htmlToPlainText(output.innerHTML || "").trim();
      if (!text || text === "(nothing yet)") {
        showMessage("Generate a lesson first, then print.", false);
        return;
      }

      try {
        printOutputHtml({
          title: "Lessons-Ready Lesson Plan",
          metaLine: metaLineEl.textContent || "",
          bodyHtml: output.innerHTML || "",
        });
      } catch (e: any) {
        // fallback
        console.warn("Print iframe failed, falling back to window.print()", e);
        window.print();
      }
    });
  }

  downloadPdfBtn.addEventListener("click", async () => {
    const text = (lastLessonPlainText || "").trim();
    if (!text)
      return showMessage("Generate a lesson first, then download the PDF.", false);

    const filename = safeName(
      `${grade.value}-${subject.value}-${standard.value}-${unit.value}-${lesson.value}`,
    );

    try {
      showMessage("📄 Building PDF…", true);
      await downloadTextAsPdf({
        title: "Lessons-Ready Lesson Plan",
        metaLine: metaLineEl.textContent || "",
        body: text,
        filename,
      });
      showMessage("PDF downloaded ✅", true);
    } catch (e: any) {
      showMessage(`PDF error: ${esc(e?.message || e)}`, false);
    }
  });

  if (exportPackBtn) {
    exportPackBtn.addEventListener("click", async () => {
      const text = (lastLessonPlainText || htmlToPlainText(output.innerHTML || "")).trim();
      if (!text) return showMessage("Generate a lesson first, then export the lesson pack.", false);

      try {
        const lessonPayload = toLessonExportPayload({
          plainText: text,
          grade: grade.value,
          subject: subject.value.trim(),
          standard: standard.value.trim(),
          unit: unit.value.trim(),
          lesson: lesson.value.trim(),
          skillFocus: skillFocus?.value?.trim(),
        });

        showMessage("📦 Building lesson pack ZIP…", true);
        exportPackBtn.disabled = true;

        const validSession = getSessionIfValidForCurrentProject();
        if (!validSession?.access_token) {
          throw new Error(
            "Missing authorization header: please log in again (session missing/expired or from another Supabase project).",
          );
        }

        const callExport = async (token: string) => {
          const headers = buildFunctionAuthHeaders(token);
          if (!headers.Authorization?.startsWith("Bearer ")) {
            throw new Error("Authorization header missing for export request.");
          }
          return await fetch(SUPABASE_EXPORT_PACK_FN_URL, {
            method: "POST",
            headers,
            body: JSON.stringify({ lesson: lessonPayload }),
          });
        };

        let res = await callExport(validSession.access_token);
        if (res.status === 401) {
          const refreshed = await refreshSessionWithRefreshToken(validSession.refresh_token);
          if (refreshed?.access_token) {
            res = await callExport(refreshed.access_token);
          }
        }

        if (!res.ok) {
          const raw = await res.text();
          if (res.status === 401) {
            throw new Error(
              `Export failed (401): ${raw.slice(0, 220) || "Invalid JWT. Please log in again."}`,
            );
          }
          throw new Error(`Export failed (${res.status}): ${raw.slice(0, 220)}`);
        }

        const blob = await res.blob();
        const fileName = safeName(`${grade.value}-${subject.value}-${standard.value}-lesson-pack`) + ".zip";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        showMessage("Lesson pack exported ✅", true);
      } catch (e: any) {
        showMessage(`Export error: ${esc(e?.message || e)}`, false);
      } finally {
        exportPackBtn.disabled = !((lastLessonPlainText || "").trim());
      }
    });
  }

  favoriteBtn.addEventListener("click", async () => {
    try {
      clearMessage();
      if (!lastLessonId)
        return showMessage("Generate or open a saved lesson first.", false);

      requireSession();
      const next = !lastLessonFavorite;

      await postgrest("PATCH", "lessons", {
        query: `id=eq.${encodeURIComponent(lastLessonId)}`,
        body: { is_favorite: next },
      });

      lastLessonFavorite = next;
      favoriteBtn.textContent = next ? "★ Favorited" : "☆ Favorite";
      showMessage(next ? "Saved ⭐" : "Un-saved ✓", true);
    } catch (e: any) {
      showMessage(`Favorite failed: ${esc(e?.message || e)}`, false);
    }
  });

  function validateSkillFocus(): { ok: boolean; message?: string } {
    if (!skillFocus) return { ok: true };
    const sf = skillFocus.value.trim();
    if (!sf)
      return {
        ok: false,
        message: "Skill Focus is required (1–2 sentences).",
      };
    if (sf.length > 420)
      return {
        ok: false,
        message: "Skill Focus is too long. Keep it under ~420 characters.",
      };
    return { ok: true };
  }

  function getPublisher() {
    const p = publisher.value;
    if (p === "Other") {
      const other = publisherOther.value.trim();
      return {
        publisher: "Other",
        publisherOther: other || "Other (unspecified)",
      };
    }
    return { publisher: p };
  }

  function buildQualityGuardrailsNotes(selectedStandard: string) {
    const std = (selectedStandard || "").trim();
    const isThemeStandard = /4\.8b/i.test(std) || /theme/i.test(std);

    const base = `
QUALITY GUARDRAILS:
- Keep every comprehension question anchored to the target standard, not generic plot recall.
- For question wording, prioritize "how/why" prompts tied directly to the standard language.
- Provide a robust answer key with text-based evidence (quoted/paraphrased detail) and a brief reasoning sentence.
- When possible, cite where evidence appears (e.g., line/paragraph reference) to strengthen instructional trust.
`;

    if (!isThemeStandard) return base;

    return base + `
THEME-SPECIFIC FOCUS (${std || "theme"}):
- Avoid plot-only prompts like "What obstacle did the character face?"
- Rewrite toward theme analysis: "How does the obstacle develop the theme? Use evidence."
- In answer keys, explicitly name the theme and explain how the selected detail supports that theme.
`;
  }

  function getWorksheetPackFromUI() {
    const enabled = worksheetToggle ? !!worksheetToggle.checked : false;
    if (!enabled) return null;

    const b = worksheetBeginnerCount ? Number(worksheetBeginnerCount.value) : NaN;
    const i = worksheetIntermediateCount ? Number(worksheetIntermediateCount.value) : NaN;
    const a = worksheetAdvancedCount ? Number(worksheetAdvancedCount.value) : NaN;

    return {
      enabled: true,
      levels: ["beginner", "intermediate", "advanced"],
      questionCount: {
        beginner: Number.isFinite(b) && b > 0 ? b : 6,
        intermediate: Number.isFinite(i) && i > 0 ? i : 6,
        advanced: Number.isFinite(a) && a > 0 ? a : 4,
      },
    };
  }

  function applyStreamChunk(current: string, chunk: string, lastChunk?: string) {
    const c = (chunk || "").toString();
    if (!c) return { text: current, lastChunk };
    if (lastChunk && c === lastChunk) return { text: current, lastChunk };

    if (c.includes(current) && c.length >= current.length)
      return { text: c, lastChunk: c };
    if (current.includes(c) && c.length > 20)
      return { text: current, lastChunk: c };

    const maxOverlap = Math.min(1200, current.length, c.length);
    for (let k = maxOverlap; k >= 10; k--) {
      if (current.endsWith(c.slice(0, k)))
        return { text: current + c.slice(k), lastChunk: c };
    }
    return { text: current + c, lastChunk: c };
  }

  generateBtn.addEventListener("click", async () => {
    if (activeStreamAbort) activeStreamAbort.abort();
    activeStreamAbort = new AbortController();

    clearMessage();
    output.innerHTML = "";
    lastLessonPlainText = "";
    downloadPdfBtn.disabled = true;
    if (exportPackBtn) exportPackBtn.disabled = true;

    // ✅ Hide Feedback Garage until we have a fresh lesson
    const garage = getElOpt<HTMLElement>("feedbackGarage");
    if (garage) garage.style.display = "none";
    const fbStatus = getElOpt<HTMLElement>("feedbackStatus");
    if (fbStatus) fbStatus.innerHTML = "";

    generateBtn.disabled = true;
    setStatus("Working…");

    const timeoutId = setTimeout(() => {
      try {
        activeStreamAbort?.abort();
      } catch {}
    }, HARD_TIMEOUT_MS);

    try {
      const anon = getAnonKey();
      if (!anon) throw new Error("Missing Supabase anon key in main.ts.");

      const session = requireSession();
      const { publisher: pub, publisherOther: pubOther } = getPublisher();
      const st = state.value;

      const wantsStream = !testMode.checked;
      
      autoFillSkillFocusIfBlank();
      const check = validateSkillFocus();
      if (!check.ok) {
        showMessage(esc(check.message), false);
        setStatus("Idle");
        return;
      }

      const lessonLengthNum = lessonLength ? Number(lessonLength.value) : 45;
      const includeStaarBool = includeStaar ? includeStaar.value === "yes" : false;

      const style = outputStyle ? outputStyle.value : "default";
      const chosenMode = normalizeMode(mode.value);

      // ✅ FIX: grade "K" should not become NaN
      const gradeValue = grade.value === "K" ? 0 : Number(grade.value);

      const payload: any = {
        model: "gpt-4o-mini",
        mode: chosenMode,
        testMode: testMode.checked,
        stream: wantsStream,

        publisher: pub,
        publisherOther: pubOther,
        state: st,

        grade: gradeValue,
        gradeLabel: grade.value,
        subject: subject.value.trim(),
        standard: standard.value.trim(),
        curriculumUnit: unit.value.trim() || "Not specified",
        curriculumLesson: lesson.value.trim() || "Not specified",

        campusId: campusId?.value?.trim() || null,
        programName: programName?.value?.trim() || null,
        curriculumLessonCode: curriculumLessonCode?.value?.trim() || null,

        outputStyle: style,

        lessonLengthMinutes: Number.isFinite(lessonLengthNum) ? lessonLengthNum : 45,
        includeStaarStyleQuestions: includeStaarBool,
      };

            // ✅ Always include a Skill Focus (auto-filled if user left blank)
      const finalSkillFocus =
        skillFocus && skillFocus.value.trim().length > 0
          ? skillFocus.value.trim()
          : generateDefaultSkillFocus({
              state: state?.value,
              standard: standard?.value,
              grade: grade?.value,
              subject: subject?.value,
            });

      payload.skillFocus = finalSkillFocus;

      // If field exists and was blank, show what we used
      if (skillFocus && skillFocus.value.trim().length === 0) {
        skillFocus.value = finalSkillFocus;
      }
      if (subNotes) payload.subNotes = subNotes.value.trim();
      if (lessonCycleTemplate) payload.districtLessonCycleName = lessonCycleTemplate.value || "";
      if (publisherComponents) payload.publisherComponents = publisherComponents.value.trim();
      if (supportingStandards) payload.supportingStandards = supportingStandards.value.trim();

      payload.options = {
        ebSupport: ebSupport ? !!ebSupport.checked : true,
        spedSupport: spedSupport ? !!spedSupport.checked : true,
        vocabularyFocus: vocabularyFocus ? !!vocabularyFocus.checked : true,
        checksForUnderstanding: checksForUnderstanding ? !!checksForUnderstanding.checked : true,
        writingExtension: writingExtension ? !!writingExtension.checked : false,
        subNotes: subNotes ? subNotes.value.trim() : "",
      };

      const wantsPractice = practiceToggle ? !!practiceToggle.checked : false;
      payload.practice = {
        enabled: wantsPractice,
        genre: practiceGenre ? practiceGenre.value : "informational",
        slangLevel: slangLevel ? slangLevel.value : "none",
        topic: practiceTopic ? practiceTopic.value.trim() : "",
        allowTrendy: allowTrendy ? allowTrendy.value : "yes",
      };

      const worksheetPack = getWorksheetPackFromUI();
      if (worksheetPack) payload.worksheetPack = worksheetPack;

      payload.teacherNotes =
        (payload.teacherNotes || "") +
        `
${buildQualityGuardrailsNotes(standard.value.trim())}`;

      // ✅ NEW: inject Admin Defense/Toolkit instructions (frontend-only, safe)
      if (chosenMode === "admin_defense" || chosenMode === "admin_toolkit") {
        payload.teacherNotes =
          (payload.teacherNotes || "") +
          `

ADMIN DEFENSE MODE:
Generate a coach/admin-facing artifact pack (NOT a student lesson).

Include:
• 1-page lesson defense overview aligned to observation look-fors
• T-TESS high-level alignment (Domains I–IV) in plain language
• “If asked by admin…” talking points (brief, professional)
• Evidence list: what artifacts would exist (plans, CFUs, student work)
• Walkthrough look-fors checklist + quick rubric (Basic/Proficient/Distinguished)
• Red flags to avoid (compliance, pacing, vague objectives)
`;
      }

      setMeta(
        `${pub}${pub === "Other" ? ` (${pubOther || ""})` : ""} • ${st || "n/a"} • Output: ${style} • Mode: ${chosenMode}${
          testMode.checked ? " • Test Mode" : " • Live"
        }`,
      );

      showMessage("🧠 Generating lesson…", true);

      const res = await fetch(SUPABASE_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
          Authorization: `Bearer ${session.access_token}`,
          ...(wantsStream ? { Accept: "text/event-stream" } : {}),
        },
        body: JSON.stringify(payload),
        signal: activeStreamAbort.signal,
      });

      if (!res.ok) {
        const raw = await res.text();
        if (res.status === 401 || raw.includes("INVALID_SESSION")) {
          setSavedSession(null);
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(`Request failed (${res.status}): ${raw}`);
      }

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      let lessonText = "";
      let lessonSections: StructuredLessonSections | undefined;

      if (wantsStream && contentType.includes("text/event-stream")) {
        let liveText = "";
        let lastChunk = "";
        let lastRendered = "";
        let finalLessonText = "";
        let finalLessonSections: StructuredLessonSections | undefined;

        output.classList.add("typing");
        output.textContent = " ";

        await readSSEStream(
          res,
          {
            onDelta: (chunk) => {
              const merged = applyStreamChunk(liveText, chunk, lastChunk);
              liveText = merged.text;
              lastChunk = merged.lastChunk || lastChunk;

              if (liveText !== lastRendered) {
                lastRendered = liveText;
                output.innerHTML = (audienceView?.value === "student")
                  ? buildStudentWorksheetHtml(liveText, { includeTopSignals: true })
                  : formatLessonToHtml(liveText);
              }
            },

            onFinal: (obj) => {
              const candidate =
                obj?.lesson_plan ??
                obj?.lessonPlan ??
                obj?.data?.lesson_plan ??
                obj?.data?.lessonPlan ??
                obj?.result?.lesson_plan ??
                obj?.result?.lessonPlan ??
                "";

              if (typeof candidate === "string" && candidate.trim()) {
                finalLessonText = candidate;
              }
              const candidateSections =
                obj?.sections ??
                obj?.data?.sections ??
                obj?.result?.sections;
              if (candidateSections && typeof candidateSections === "object") {
                finalLessonSections = candidateSections as StructuredLessonSections;
              }
            },

            onError: (obj) => {
              const msg = obj?.error || obj?.message || obj?.detail || JSON.stringify(obj || {});
              throw new Error(String(msg));
            },
          },
          activeStreamAbort.signal,
        );

        output.classList.remove("typing");

        lessonText = (finalLessonText || liveText) as string;
        lessonSections = finalLessonSections;
        output.innerHTML = renderLessonWithCurriculumBridge(lessonText, {
          publisher: pub,
          standard: standard.value.trim(),
          unit: unit.value.trim(),
          lesson: lesson.value.trim(),
          audienceView: (audienceView?.value as OutputAudienceView) || "teacher",
        });
      } else {
        const raw = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error("Response was not JSON.");
        }
        if (!data.ok) throw new Error(data.error || "Unknown error");
        lessonText = (data.lesson_plan || data.prompt_preview || "") as string;
        if (data.sections && typeof data.sections === "object") lessonSections = data.sections as StructuredLessonSections;
      }

      lessonText = dedupeWholeTextIfRepeated(lessonText);
      // Render lesson + curriculum bridge
    output.innerHTML = renderLessonWithCurriculumBridge(lessonText, {
     publisher: pub,
     standard: getSelectedStandardDisplay(),
    unit: unit.value.trim() || "",
    lesson: lesson.value.trim() || "",
});
      
      lastLessonPlainText = htmlToPlainText(output.innerHTML);
      downloadPdfBtn.disabled = !lastLessonPlainText.trim();
      if (exportPackBtn) exportPackBtn.disabled = !lastLessonPlainText.trim();

      // ✅ Show Feedback Garage after output renders
      if (garage) garage.style.display = "block";

      const slideDefs = buildSlideDefinitionsFromLesson(lessonText, lessonSections, {
        eb: ebSupport ? !!ebSupport.checked : true,
        sped: spedSupport ? !!spedSupport.checked : true,
      });
      const lessonModeForRow = resolveLessonModeFromPublisher(pub);
      
 // 🔹 CANONICAL RESOLUTION (STRICT MATCH)
const standardLabel = standard.value.trim();
const subjectValue = subject.value.trim();

const canonicalQuery =
  `standard_label=eq.${encodeURIComponent(standardLabel)}` +
  `&grade=eq.${gradeValue}` +
  `&subject=ilike.${encodeURIComponent(subjectValue)}`+
  `&select=canonical_skill,cognitive_verb,dok_target,staar_priority,skill_display_name` +
  `&limit=1`;

const canonicalRows = await postgrest("GET", "standards_canonical", {
  query: canonicalQuery,
});

if (!Array.isArray(canonicalRows) || !canonicalRows.length) {
  throw new Error(
    `Canonical mapping not found for ${standardLabel} (grade ${gradeValue}, subject ${subjectValue})`
  );
}

const canonical = canonicalRows[0];
const row = {
        user_id: session.user.id,
        publisher: pub,
        publisher_other: pub === "Other" ? pubOther || null : null,
        state: st || null,
        grade: grade.value || null,
        subject: subject.value.trim() || null,
        standard_label: standard.value.trim() || null,
        canonical_skill: canonical.canonical_skill,
        cognitive_verb: canonical.cognitive_verb || null,
        dok_target: canonical.dok_target || null,
        staar_priority: canonical.staar_priority || null,
        skill_display_name: canonical.skill_display_name || null,
        curriculum_unit: unit.value.trim() || null,
        curriculum_lesson: lesson.value.trim() || null,
        lesson_text: lessonText || "(empty)",
        lesson_html: output.innerHTML || null,
        structured_sections: lessonSections || null,
        slide_definitions: slideDefs,
        lesson_mode: lessonModeForRow,
        is_favorite: false,
      };

      let inserted: any;
      try {
        inserted = await postgrest("POST", "lessons", {
          body: row,
          preferReturn: "representation",
        });
      } catch (e: any) {
        const msg = String(e?.message || e || "").toLowerCase();
        const missingSlideCols =
          (msg.includes("slide_definitions") || msg.includes("lesson_mode") || msg.includes("structured_sections")) &&
          (msg.includes("does not exist") || msg.includes("42703") || msg.includes("column"));

        if (!missingSlideCols) throw e;

        console.warn("lessons insert fallback (missing slide columns):", {
          lesson_mode: lessonModeForRow,
          slide_count: Array.isArray(slideDefs) ? slideDefs.length : 0,
        });

        const fallbackRow = {
          ...row,
          structured_sections: undefined,
          slide_definitions: undefined,
          lesson_mode: undefined,
        };

        inserted = await postgrest("POST", "lessons", {
          body: fallbackRow,
          preferReturn: "representation",
        });
      }

      const saved = Array.isArray(inserted) ? inserted[0] : inserted;
      lastLessonId = saved?.id || null;
      lastLessonFavorite = false;

      favoriteBtn.disabled = !lastLessonId;
favoriteBtn.textContent = "☆ Favorite";

// ✅ USAGE TRACKING (logs only successful generations)
try {
  await postgrest("POST", "usage_events", {
    body: {
      user_id: session.user.id,
      event_type: "lesson_generated",
      lesson_id: lastLessonId,
      publisher: pub,
      state: st || null,
      grade: grade.value || null,
      subject: subject.value.trim() || null,
      standard_label: standard.value.trim() || null,
    },
    preferReturn: "minimal",
  });
} catch (e) {
  // don't break the user experience if tracking fails
  console.warn("usage_events insert failed", e);
}

showMessage("Success ✅ Saved to Library", true);
setStatus("Done");
    } catch (err: any) {
      const msg =
        err?.name === "AbortError"
          ? "Timed out. Try again (first request can be slower)."
          : String(err?.message || err);

      showMessage(esc(msg), false);
      output.classList.remove("typing");
      output.innerHTML = `<pre style="white-space:pre-wrap;margin:0;">${escapeHtml(msg)}</pre>`;
      setStatus("Error");
    } finally {
      clearTimeout(timeoutId);
      generateBtn.disabled = false;
      if (statusPill.textContent === "Working…") setStatus("Idle");
      refreshAuthUI();
    }
  });

  // -------------------------
  // Feedback (safe/no-crash)
  // -------------------------
  if (submitFeedbackBtn && feedbackCategory && feedbackText && feedbackStatus) {
    submitFeedbackBtn.addEventListener("click", async () => {
      try {
        feedbackStatus.innerHTML = "";
        requireSession();

        const cat = feedbackCategory.value.trim();
        const txt = feedbackText.value.trim();
        if (!cat) {
          feedbackStatus.innerHTML = `<div class="error">Pick a focus area.</div>`;
          return;
        }
        if (!txt) {
          feedbackStatus.innerHTML = `<div class="error">Type feedback first.</div>`;
          return;
        }

        await postgrest("POST", "feedback", {
          body: {
            category: cat,
            text: txt,
            lesson_id: lastLessonId,
            meta: { publisher: publisher.value, state: state.value, mode: mode.value },
          },
          preferReturn: "minimal",
        });

        feedbackText.value = "";
        feedbackCategory.value = "";
        feedbackStatus.innerHTML = `<div class="ok">Feedback submitted ✅</div>`;
      } catch (e: any) {
        feedbackStatus.innerHTML = `<div class="error">Feedback not saved (table not set up yet) — but your lesson is fine.</div>`;
      }
    });
  }

  // ✅ Load subscription cache ASAP so UI doesn’t flash “unknown”
  loadCachedSubStatus(60_000);

  // Initial UI state
  setStatus("Idle");
  setMeta("Ready when you are.");
  refreshAuthUI();
  enforceModeAccess();
} catch (err: any) {
  console.error("❌ main.ts crashed:", err);
  alert(String(err?.message || err));
}
