console.log("🔥 NEW BUILD LOADED");
const SUPABASE_URL = "https://pinplfyymnpfctwcpzol.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_HsaM0F2t0OJNjHt48hdYgw_OzBD_ylJ";
const LR_CURRENT_LESSON_KEY = "lr_current_lesson";
const LS_SESSION_KEY = "lr_supabase_session_v1"; // legacy auth session key for optional Supabase calls
const LS_PRESENT_NOTES_KEY = "lr_present_notes_open_v1";
const LIVE_JOIN_BASE = `${window.location.origin}/join.html`;

function getSavedLessonSafe(): (LessonRow & { slide_definitions?: any[]; slides?: any[]; questions?: any[]; id?: string }) | null {
  try {
    const raw = localStorage.getItem("lr_current_lesson");
    if (!raw) {
      console.warn("⚠️ No saved lesson found in localStorage");
      return null;
    }

    const storedLesson = JSON.parse(raw) as LessonRow & { slide_definitions?: any[]; slides?: any[]; questions?: any[]; id?: string };
    console.log("✅ Loaded saved lesson from localStorage:", storedLesson);
    return storedLesson;
  } catch (e) {
    console.error("❌ Failed to parse saved lesson:", e);
    return null;
  }
}

let prefetchedLessonRow: LessonRow | null = null;

type SlideType =
  | "objective_lock"
  | "verb_definition"
  | "strategy_formula"
  | "model_think_aloud"
  | "guided_dok_ladder"
  | "compare_defend"
  | "independent_transfer"
  | "exit_ticket";

type SlideDefinition = {
  type?: "splash" | "headline" | "split" | "question" | "writing" | "energy" | "discussion";
  stageType?: SlideType;
  heading?: string;
  subtext?: string;
  items?: string[];
  question?: string;
  prompt?: string;
  section?: string;
  notes?: string;
  durationSeconds?: number;
  teacherCue?: string;

  answerChoices?: string[];
  correctIndex?: number;
  distractorRationale?: string[];
};

type PresentSettings = {
  moreDiscussion: boolean;
  moreWriting: boolean;
  short30: boolean;
  interventionPace: boolean;
  coachingMode: boolean;
  includeModel: boolean;
  includeCompareDefend: boolean;
  includeExitTicket: boolean;
  mini15: boolean;
  increaseRigor: boolean;
  theme: "default" | "fortnite" | "sports" | "real_world" | "academic";
  showTeacherNotes: boolean;
};

type SkillType = string;

type MasteryTracker = {
  guidedQuestions: number;
  writingMoments: number;
  turnTalkMoments: number;
  evidencePrompts: number;
};

type LessonRow = {
  lesson_mode?: "bluebonnet" | "amplify" | "generic";
  standard_label?: string;
  canonical_skill?: string;
  cognitive_verb?: string;
  dok_target?: string;
  staar_priority?: string;
  skill_display_name?: string;
  grade_level?: number | string;
  grade?: number | string;
  grade_band?: string;
  lesson_text?: string;
};

type GenerateLessonPayload = {
  grade: string;
  subject: string;
  standard: string;
  curriculumUnit: string;
  curriculumLesson: string;
  skillFocus?: string;
  stream: boolean;
};

type SavedSession = {
  access_token?: string;
  refresh_token?: string;
};

type LiveSessionRow = {
  id: string;
  join_code: string;
};

type ResponseRow = {
  answer_index: number;
};

type SessionStudentRow = {
  id: string;
  student_name?: string;
};

type LiveResultsSnapshot = {
  counts: number[];
  answeredCount: number;
  studentCount: number;
  studentNames: string[];
};

type GradeBand = "3-4" | "5-6" | "7-8";

type ComplexityScaling = {
  evidence_required?: number;
  require_compare?: boolean;
  require_counterargument?: boolean;
  model_required?: boolean;
};

type SkillPlaybookRow = {
  canonical_skill: string;
  objective_template?: string | null;
  hook_template?: string | null;
  vocab_list?: string[] | null;
  writing_template?: string | null;
  exit_template?: string | null;
  strategy_formula?: string | null;
  model_sequence?: string | null;
  tier1_prompt?: string | null;
  tier2_prompt?: string | null;
  tier3_prompt?: string | null;
  impact_on_meaning_prompt?: string | null;
  transfer_constraint?: string | null;
  complexity_notes?: Partial<Record<GradeBand, ComplexityScaling>> | null;
};

type InstructionModeRow = {
  mode: string;
  require_two_evidence?: boolean | null;
  require_compare_defend?: boolean | null;
  skip_model?: boolean | null;
  exit_ticket_level?: string | null;
  auto_turn_talk_after_guided?: boolean | null;
  turn_talk_duration?: number | null;
  require_cer?: boolean | null;
  cer_frame_template?: string | null;
  require_staar_language?: boolean | null;
  staar_scoring_language?: string | null;
  auto_advance?: boolean | null;
};

type ExecutionConfig = {
  objectiveTemplate: string;
  hookTemplate: string;
  vocabList: string[];
  writingTemplate: string;
  exitTemplate: string;
  strategyFormula: string;
  modelSequence: string;
  tier1Prompt: string;
  tier2Prompt: string;
  tier3Prompt: string;
  impactPrompt: string;
  evidenceRequired: number;
  requireCompare: boolean;
  transferConstraint: string;
  skipModel: boolean;
  exitTicketLevel: string;
  autoTurnTalkAfterGuided: boolean;
  turnTalkDuration: number;
  requireCER: boolean;
  cerFrameTemplate: string;
  requireStaarLanguage: boolean;
  staarScoringLanguage: string;
  autoAdvance: boolean;
};

let baseSlides: SlideDefinition[] = [];
let slides: any[] = [];
let currentIndex = 0;
let lessonIdGlobal = "";
let lessonMode: "bluebonnet" | "amplify" | "generic" = "generic";
let notesOpen = localStorage.getItem(LS_PRESENT_NOTES_KEY) === "1";
let revealStep = 0;
let timerInterval: number | null = null;
let turnTalkInterval: number | null = null;
let slideEndsAt = 0;
let currentSkillType: SkillType = "generic";
let currentDok = "";
let currentPriority = "";
let currentTek = "";
let currentVerb = "";
let currentStandard = "";
let currentExecutionConfig: ExecutionConfig | null = null;
let slideContainerEl: HTMLElement | null = null;
let masteryTracker: MasteryTracker = {
  guidedQuestions: 0,
  writingMoments: 0,
  turnTalkMoments: 0,
  evidencePrompts: 0,
};
let countedSignalSlides = new Set<number>();
let liveSessionId = "";
let liveJoinCode = "";
let liveResultsPoll: number | null = null;
let liveRealtimeSocket: WebSocket | null = null;
let liveRealtimeHeartbeat: number | null = null;
let liveRealtimeRef = 1;
const AUTO_RETEACH_THRESHOLD = 0.6;
let activeDockPanel: "responses" | "reteach" | "notes" = "responses";
let latestLiveSnapshot: LiveResultsSnapshot | null = null;


const stageSignals: Record<string, string[]> = {
  objective_lock: [
    "Students restate the objective",
    "Teacher clarifies success criteria",
  ],
  verb_definition: [
    "Students explain the academic verb",
    "Teacher checks understanding of task language",
  ],
  strategy_formula: [
    "Teacher models thinking steps",
    "Students anchor responses to evidence",
  ],
  model_think_aloud: [
    "Teacher demonstrates reasoning process",
    "Students observe strategy application",
  ],
  guided_dok_ladder: [
    "Students justify answers using evidence",
    "Partner discussion reinforces reasoning",
  ],
  compare_defend: [
    "Students defend strongest answer",
    "Multiple pieces of evidence used",
  ],
  independent_transfer: [
    "Students apply strategy independently",
    "Teacher circulates for checks",
  ],
  exit_ticket: [
    "Students demonstrate mastery",
    "Teacher collects formative evidence",
  ],
};

const stageConfidence: Record<string, string> = {
  objective_lock: "Lesson Launch",
  verb_definition: "Skill Clarity",
  strategy_formula: "Strategy Internalization",
  model_think_aloud: "Teacher Modeling",
  guided_dok_ladder: "Student Reasoning",
  compare_defend: "Evidence Justification",
  independent_transfer: "Independent Application",
  exit_ticket: "Mastery Check",
};


const phaseByStage: Record<string, "Objective" | "Modeling" | "Guided" | "Independent" | "Exit"> = {
  objective_lock: "Objective",
  verb_definition: "Objective",
  strategy_formula: "Objective",
  model_think_aloud: "Modeling",
  guided_dok_ladder: "Guided",
  compare_defend: "Guided",
  independent_transfer: "Independent",
  exit_ticket: "Exit",
};

function updatePhaseProgress(stageType?: SlideType, section?: string) {
  const phaseEl = document.getElementById("phase-progress");
  if (!phaseEl) return;

  const stageKey = String(stageType || "");
  let activePhase: string = phaseByStage[stageKey] || "";

  if (!activePhase) {
    const sec = String(section || "").toLowerCase();
    if (sec.includes("objective") || sec.includes("frontload") || sec.includes("hook")) activePhase = "Objective";
    else if (sec.includes("model")) activePhase = "Modeling";
    else if (sec.includes("guided") || sec.includes("discussion") || sec.includes("assessment") || sec.includes("deepen")) activePhase = "Guided";
    else if (sec.includes("independent")) activePhase = "Independent";
    else if (sec.includes("exit")) activePhase = "Exit";
  }

  const items = phaseEl.querySelectorAll(".phaseItem");
  items.forEach((item) => {
    const matches = (item as HTMLElement).dataset.phase === activePhase;
    item.classList.toggle("is-active", matches);
  });
}

const settings: PresentSettings = {
  moreDiscussion: false,
  moreWriting: false,
  short30: false,
  interventionPace: false,
  coachingMode: false,
  includeModel: true,
  includeCompareDefend: true,
  includeExitTicket: true,
  mini15: false,
  increaseRigor: false,
  theme: "default",
  showTeacherNotes: true,
};

function escHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function resetMasteryTracker() {
  masteryTracker = {
    guidedQuestions: 0,
    writingMoments: 0,
    turnTalkMoments: 0,
    evidencePrompts: 0,
  };
  countedSignalSlides = new Set<number>();
}

function getSavedToken(): string {
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as SavedSession;
    return String(parsed?.access_token || "");
  } catch {
    return "";
  }
}

function getSavedSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedSession;
  } catch {
    return null;
  }
}

function setSavedSession(session: SavedSession | null) {
  if (!session) {
    localStorage.removeItem(LS_SESSION_KEY);
    return;
  }
  localStorage.setItem(LS_SESSION_KEY, JSON.stringify(session));
}

function isJwtExpiredError(status: number, body: string): boolean {
  if (status !== 401) return false;
  const text = String(body || "").toLowerCase();
  return text.includes("jwt expired") || text.includes("pgrst303") || text.includes("invalid jwt");
}

async function refreshTokenIfPossible(): Promise<string> {
  const session = getSavedSession();
  const refreshToken = String(session?.refresh_token || "").trim();
  if (!refreshToken) return "";

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const text = await res.text();
    if (!res.ok) return "";
    const parsed = JSON.parse(text) as SavedSession;
    const next: SavedSession = {
      access_token: String(parsed?.access_token || ""),
      refresh_token: String(parsed?.refresh_token || refreshToken),
    };
    if (!next.access_token) return "";
    setSavedSession(next);
    return next.access_token;
  } catch {
    return "";
  }
}

function buildSupabaseHeaders(includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
  };

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  const token = getSavedToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Presenter configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
}

async function parseJsonResponse<T>(res: Response, context: string): Promise<T> {
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`${context} (${res.status}): ${text.slice(0, 180)}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 180);
    if (snippet.trimStart().startsWith("<!doctype") || snippet.trimStart().startsWith("<html")) {
      throw new Error(`${context}: received HTML instead of JSON. Check VITE_SUPABASE_URL endpoint configuration.`);
    }
    throw new Error(`${context}: invalid JSON response (${snippet})`);
  }
}

function themeForMode(mode: string) {
  const m = String(mode || "generic").toLowerCase();
  if (m === "bluebonnet") return { accent: "#2563eb", border: "#1d4ed8", bg: "#0f172a" };
  if (m === "amplify") return { accent: "#7c3aed", border: "#6d28d9", bg: "#1e1b4b" };
  return { accent: "#10b981", border: "#059669", bg: "#0f172a" };
}


function accentForSkill(skillType: SkillType) {
  if (skillType === "inference") return "#10b981";
  if (skillType === "text_structure") return "#f59e0b";
  if (skillType === "theme") return "#a78bfa";
  if (skillType === "context_clues") return "#22d3ee";
  return "";
}

function applyPresentationTheme() {
  const t = themeForMode(lessonMode);
  const root = document.documentElement;
  const skillAccent = accentForSkill(currentSkillType);
  root.style.setProperty("--present-accent", skillAccent || t.accent);
  root.style.setProperty("--present-border", t.border);
  root.style.setProperty("--present-bg", t.bg);
}

function resumeKey(lessonId: string) {
  return `lr_present_resume_${lessonId}`;
}

function cloneSlide(slide: SlideDefinition): SlideDefinition {
  return { ...slide, items: Array.isArray(slide.items) ? [...slide.items] : undefined };
}

function parseLessonTextBlocks(lessonText: string) {

  if (!lessonText) return { passage: "", questions: [] };

  const normalized = String(lessonText || "").trim();
  const jsonMatch = normalized.match(/\{[\s\S]*\}/);
  const jsonCandidate = jsonMatch ? jsonMatch[0] : normalized;

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      passage?: string;
      questions?: Array<{ question?: string; choices?: string[]; correctIndex?: number }>;
    };

    if (parsed && (parsed.passage || Array.isArray(parsed.questions))) {
      return {
        passage: cleanText(String(parsed.passage || "")),
        questions: Array.isArray(parsed.questions)
          ? parsed.questions.map((question) => ({
              raw: JSON.stringify(question),
              question: cleanText(String(question?.question || "Practice Question")),
              choices: Array.isArray(question?.choices) ? question.choices.map((choice) => cleanText(String(choice || ""))).filter(Boolean) : [],
              correctIndex: Number.isInteger(question?.correctIndex) ? Number(question?.correctIndex) : undefined,
            }))
          : [],
      };
    }
  } catch {
    // fall through to text parsing
  }

  const passageMatch =
    normalized.match(/PASSAGE:\s*([\s\S]*?)(?:QUESTION|$)/i);

  const passage = passageMatch ? passageMatch[1].trim() : "";

  const questions =
    normalized.split(/QUESTION/i).slice(1).map(block => ({
      raw: block.trim()
    }));

  return { passage, questions };
}
const TEST_LESSON = `
PASSAGE:

In the heart of the forest, there is an ancient tree that tells stories.

QUESTION

question: What is the central idea?

A) The forest is old
B) Animals gather around the tree
C) The tree is magical
D) The owl tells stories

correctIndex: 1
`;

console.log("TEST PARSER RESULT:", parseLessonTextBlocks(TEST_LESSON));

function buildPassageBullets(passage: string): string[] {
  return String(passage || "")
    .split(/(?<=[.!?])\s+/)
    .map((part) => cleanText(part))
    .filter(Boolean)
    .slice(0, 5)
    .map((part) => trimInjectedText(part, 120));
}

function trimInjectedText(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text;
}

function normalizeInjectedItems(items: string[]): string[] {
  return items
    .map((item) => cleanText(item))
    .filter(Boolean)
    .map((item) => trimInjectedText(item, 120))
    .slice(0, 5);
}

function isValidQuestion(q: any) {
  return (
    q &&
    typeof q.question === "string" &&
    Array.isArray(q.choices) &&
    q.choices.length === 4 &&
    typeof q.correctIndex === "number"
  );
}

function buildQuestionSlide(q: any): SlideDefinition {
  return {
    type: "question",
    stageType: "guided_dok_ladder",
    heading: "STAAR Check",
    question: trimInjectedText(String(q.question || "Practice Question"), 180),
    answerChoices: normalizeInjectedItems((q.choices || []).slice(0, 4)),
    correctIndex: Number.isInteger(q.correctIndex) ? Number(q.correctIndex) : 0,
    prompt: trimInjectedText(cleanText(String(q.prompt || "")), 180),
    section: "Assessment",
    durationSeconds: 150,
  };
}


function parseQuestionBlock(rawQuestion: string): { question: string; choices: string[] } {
  const lines = String(rawQuestion || "")
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean);

  const questionLine =
    lines.find((line) => /^question\s*:/i.test(line)) ||
    lines.find((line) => /\?$/.test(line)) ||
    lines[0] ||
    "Practice Question";

  const question = trimInjectedText(questionLine.replace(/^question\s*:/i, "").trim() || "Practice Question", 180);
  const choices = lines
    .filter((line) => /^[A-D][).:]/i.test(line))
    .map((line) => line.replace(/^[A-D][).:]\s*/i, "").trim())
    .filter(Boolean)
    .map((choice) => trimInjectedText(choice, 90))
    .slice(0, 4);

  return { question, choices };
}

function applyLessonTextToDeck(deck: SlideDefinition[], lessonText?: string): SlideDefinition[] {
  console.log("Applying lesson text to deck:", lessonText);
  const parsed = parseLessonTextBlocks(String(lessonText || ""));
  if (!parsed.passage && !parsed.questions.length) return deck;

  const next = deck.map(cloneSlide);
  const passageBullets = buildPassageBullets(parsed.passage);
  const shortPassage = trimInjectedText(cleanText(parsed.passage), 220);

  next.forEach((slide) => {
    if (slide.type === "question") return;

    if (!String(slide.subtext || "").trim() && shortPassage) {
      slide.subtext = trimInjectedText(shortPassage, 220);
    }

    if ((!slide.items || slide.items.length === 0) && passageBullets.length > 0) {
      slide.items = normalizeInjectedItems(passageBullets);
    }
  });

  const questionIndexes = next
    .map((slide, idx) => ({ slide, idx }))
    .filter(({ slide }) =>
      slide.type === "question" ||
      slide.stageType === "guided_dok_ladder" ||
      slide.section === "Guided" ||
      slide.section === "Assessment"
    )
    .map(({ idx }) => idx);

  for (let i = 0; i < parsed.questions.length && i < questionIndexes.length; i += 1) {
    const deckIndex = questionIndexes[i];
    const parsedQuestion = parsed.questions[i].question
      ? {
          question: trimInjectedText(String(parsed.questions[i].question || "Practice Question"), 180),
          choices: normalizeInjectedItems((parsed.questions[i].choices || []).slice(0, 4)),
          correctIndex: Number.isInteger(parsed.questions[i].correctIndex) ? Number(parsed.questions[i].correctIndex) : undefined,
        }
      : parseQuestionBlock(parsed.questions[i].raw);
    const current = next[deckIndex];
    current.question = parsedQuestion.question;
    current.answerChoices = parsedQuestion.choices;
    current.correctIndex = parsedQuestion.correctIndex;
    current.prompt = shortPassage ? trimInjectedText(shortPassage, 180) : current.prompt;
  }
  return next;
}

function sanitizeQuestionSlide(slide: SlideDefinition): SlideDefinition {
  if (slide.type !== "question") return slide;

  const choices = Array.isArray(slide.answerChoices)
    ? slide.answerChoices.map((choice) => String(choice || "").trim()).filter(Boolean)
    : [];

  const validCorrect = Number.isInteger(slide.correctIndex)
    ? Number(slide.correctIndex)
    : -1;

  const correctIndex = validCorrect >= 0 && validCorrect < choices.length ? validCorrect : undefined;
  const rationale = Array.isArray(slide.distractorRationale) && slide.distractorRationale.length === choices.length
    ? slide.distractorRationale.map((value) => String(value || ""))
    : undefined;
  
  return {
    ...slide,
    question: String(slide.question || "").trim() || slide.question,
    prompt: String(slide.prompt || "").trim() || slide.prompt,
    answerChoices: choices.length ? choices : undefined,
    correctIndex,
    distractorRationale: rationale,
  };
}

function generateMultipleChoiceBlock(genre: "fiction" | "informational" | "math" | "generic") {
  if (genre === "fiction") {
    return {
      excerpt:
        "Jalen hesitated at the edge of the diving board. The water shimmered below, and doubt crept into his mind. Still, he stepped forward.",
      question: "Which statement best expresses the theme?",
      answerChoices: [
        "Fear always wins.",
        "Courage requires action.",
        "Water can be dangerous.",
        "Diving is stressful.",
      ],
      correctIndex: 1,
      distractorRationale: [
        "This is too absolute and unsupported.",
        "Correct — theme reflects internal growth through action.",
        "This focuses on setting, not message.",
        "This focuses on surface detail.",
      ],
    };
  }

  if (genre === "informational") {
    return {
      excerpt:
        "Rainforests receive steady rainfall throughout the year. This climate allows diverse plant and animal life to thrive.",
      question: "What is the central idea of the paragraph?",
      answerChoices: [
        "Rainforests are humid environments.",
        "Rainforests support diverse ecosystems due to climate.",
        "Animals live in rainforests.",
        "Rainforests are located near the equator.",
      ],
      correctIndex: 1,
      distractorRationale: [
        "This is a detail, not the central idea.",
        "Correct — it captures cause and effect.",
        "Too narrow.",
        "Not supported in paragraph.",
      ],
    };
  }

  if (genre === "math") {
    return {
      excerpt: "A classroom has 42 books arranged equally on 7 shelves.",
      question: "Which operation should be used?",
      answerChoices: ["42 × 7", "42 ÷ 7", "42 − 7", "7 ÷ 42"],
      correctIndex: 1,
      distractorRationale: [
        "Multiplication increases quantity.",
        "Correct — equal groups division.",
        "Subtraction does not represent equal grouping.",
        "Incorrect structure.",
      ],
    };
  }

  return {
    excerpt: "Read the excerpt.",
    question: "Which answer is best supported by evidence?",
    answerChoices: ["A", "B", "C", "D"],
    correctIndex: 0,
    distractorRationale: [
      "Supported by evidence.",
      "Insufficient evidence.",
      "Not text-based.",
      "Irrelevant.",
    ],
  };
}

function normalizeDok(value: string): number {
  const m = String(value || "").toUpperCase().match(/DOK\s*([1-4])/);
  return m ? Number(m[1]) : 2;
}

function normalizeGrade(value: unknown): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.round(numeric);
  const text = String(value || "").toLowerCase();
  const m = text.match(/\b([k]|[0-9]{1,2})\b/);
  if (!m) return 4;
  if (m[1] === "k") return 0;
  return Number(m[1]);
}

function verbDrivenQuestion(verb: string, fallback: string): string {
  const v = String(verb || "").toLowerCase();
  if (v.includes("analy")) return `How/why does the evidence support this answer? ${fallback}`;
  if (v.includes("identify")) return `Identify the best-supported answer. ${fallback}`;
  if (v.includes("evaluat")) return `Evaluate the strongest answer and justify your reasoning. ${fallback}`;
  return fallback;
}

function gradeAdjustedWriting(basePrompt: string, grade: number): string {
  if (grade <= 2) return `Write 1-2 sentences: ${basePrompt}`;
  if (grade <= 5) return `Write one CER paragraph: ${basePrompt}`;
  return `Write a multi-paragraph analysis: ${basePrompt}`;
}

function normalizeVerb(verb: string): string {
  return String(verb || "determine").trim().toLowerCase() || "determine";
}

function studentVerbDefinition(verb: string): string {
  const v = normalizeVerb(verb);
  if (v.includes("infer")) return "figure out what is implied";
  if (v.includes("analy")) return "break apart and explain how parts work together";
  if (v.includes("compar")) return "find similarities and differences that matter";
  if (v.includes("evaluat")) return "judge using criteria";
  if (v.includes("determin")) return "figure out based on evidence";
  if (v.includes("revis")) return "improve for clarity or correctness";
  if (v.includes("identify")) return "find and name the right evidence";
  return "use evidence to explain your thinking";
}

function evidenceSourceForSkill(skillType: SkillType): string {
  if (skillType === "research") return "sources";
  if (skillType === "writing_process" || skillType === "composition") return "language conventions";
  return "text details";
}

function resolveAssessmentInsertIndex(deck: SlideDefinition[]): number {
  const nonSplashIndices = deck
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => slide.type !== "splash")
    .map(({ index }) => index);

  const workingDeck = nonSplashIndices.map((index) => deck[index]);
  const toOriginalInsertIndex = (workingIndex: number) => {
    if (workingIndex < 0) return -1;
    const originalIndex = nonSplashIndices[workingIndex];
    return typeof originalIndex === "number" ? originalIndex + 1 : -1;
  };

  const guidedIndex = workingDeck.findIndex((slide) => /guided|model|mini\s*lesson/.test((slide.heading || "").toLowerCase()));
  const guidedInsert = toOriginalInsertIndex(guidedIndex);
  if (guidedInsert !== -1) return guidedInsert;

  const questionIndex = workingDeck.findIndex((slide) => slide.type === "question");
  const questionInsert = toOriginalInsertIndex(questionIndex);
  if (questionInsert !== -1) return questionInsert;

  const discussionIndex = workingDeck.findIndex((slide) => slide.type === "discussion");
  const discussionInsert = toOriginalInsertIndex(discussionIndex);
  if (discussionInsert !== -1) return discussionInsert;

  if (nonSplashIndices.length > 0) {
    return nonSplashIndices[nonSplashIndices.length - 1] + 1;
  }

  return Math.max(0, deck.length);
}

function generateSkillAlignedMCQ(skillType: SkillType) {
  if (skillType === "context_clues") {
    return {
      excerpt: "The path was obscured by thick fog.",
      question: "What does 'obscured' most nearly mean?",
      answerChoices: ["Hidden", "Bright", "Noisy", "Straight"],
      correctIndex: 0,
      distractorRationale: [
        "Correct — context suggests blocked visibility.",
        "Opposite meaning.",
        "Not supported.",
        "Irrelevant.",
      ],
    };
  }

  if (skillType === "inference") {
    return {
      excerpt: "Maya grabbed her umbrella before stepping outside.",
      question: "What can you infer?",
      answerChoices: ["It is raining.", "It is sunny.", "She is late.", "She dislikes rain."],
      correctIndex: 0,
      distractorRationale: [
        "Correct — umbrella implies rain.",
        "Contradicts text.",
        "Unsupported.",
        "Opinion not stated.",
      ],
    };
  }

  if (skillType === "author_purpose") {
    return {
      excerpt: "The article lists steps readers can follow to save water at home.",
      question: "What is the author's purpose?",
      answerChoices: [
        "To entertain readers",
        "To explain how to conserve water",
        "To criticize water usage",
        "To describe a vacation",
      ],
      correctIndex: 1,
      distractorRationale: [
        "Entertainment is not the goal.",
        "Correct — informational instruction.",
        "No criticism shown.",
        "Irrelevant.",
      ],
    };
  }

  if (skillType === "text_structure") {
    return {
      excerpt: "The storm destroyed several homes. As a result, many families relocated.",
      question: "Which structure is used?",
      answerChoices: ["Cause and effect", "Problem and solution", "Sequence", "Description"],
      correctIndex: 0,
      distractorRationale: [
        "Correct — storm caused relocation.",
        "No explicit solution presented.",
        "Not chronological steps.",
        "Not descriptive.",
      ],
    };
  }

  if (skillType === "theme") {
    return {
      excerpt: "After many failures, he finally succeeded.",
      question: "Which statement best expresses the theme?",
      answerChoices: [
        "Failure is permanent.",
        "Persistence leads to success.",
        "Winning is easy.",
        "Mistakes are embarrassing.",
      ],
      correctIndex: 1,
      distractorRationale: ["Too absolute.", "Correct — message about perseverance.", "Unsupported.", "Emotional reaction."],
    };
  }

  if (skillType === "characterization" || skillType === "character_relationships") {
    return {
      excerpt: "Even after losing the race, Maria congratulated the winner.",
      question: "What trait does Maria show?",
      answerChoices: ["Jealousy", "Sportsmanship", "Anger", "Fear"],
      correctIndex: 1,
      distractorRationale: ["No jealousy shown.", "Correct — respectful behavior.", "No anger.", "Fear not indicated."],
    };
  }

  if (skillType === "central_idea" || skillType === "supporting_details") {
    return {
      excerpt: "The city added bike lanes and bus routes to reduce traffic congestion.",
      question: "What is the central idea?",
      answerChoices: [
        "Cities have roads.",
        "Transit changes can reduce congestion.",
        "Buses are expensive.",
        "Cyclists dislike traffic.",
      ],
      correctIndex: 1,
      distractorRationale: ["Too broad.", "Correct — captures the main point.", "Unsupported.", "Not in text."],
    };
  }

  return generateMultipleChoiceBlock("generic");
}


type ModelExample = {
  excerpt: string;
  questionA: string;
  choicesA: string[];
  correctIndexA: number;
  questionB: string;
  choicesB: string[];
  correctIndexB: number;
  teacherReasoning: string;
};

type SkillPlan = {
  objective: string;
  hook: string;
  model: string;
  guided: string;
  write: string;
  exit: string;
  vocab: string[];
};

function generateModelExample(skill: SkillType, grade: number): ModelExample {
  const g = Number.isFinite(grade) ? grade : 5;

  if (skill === "context_clues") {
    return {
      excerpt: "The hikers moved slowly because the trail was obscured by heavy fog.",
      questionA: "Part A: What does obscured most nearly mean in this sentence?",
      choicesA: ["Hidden", "Sunny", "Wide", "Quiet"],
      correctIndexA: 0,
      questionB: "Part B: Which detail best supports your answer?",
      choicesB: ["hikers moved slowly", "trail was obscured", "heavy fog", "in this sentence"],
      correctIndexB: 2,
      teacherReasoning:
        "I identify the context clue 'heavy fog.' Fog limits visibility, so obscured means hidden. The strongest evidence is the phrase 'heavy fog.'",
    };
  }

  if (skill === "inference") {
    return {
      excerpt: "Jordan set an alarm and packed an umbrella before bed.",
      questionA: "Part A: What can we infer about tomorrow morning?",
      choicesA: ["Rain is expected", "School is canceled", "Jordan is sick", "It will snow"],
      correctIndexA: 0,
      questionB: "Part B: Which detail best supports the inference?",
      choicesB: ["set an alarm", "packed an umbrella", "before bed", "tomorrow morning"],
      correctIndexB: 1,
      teacherReasoning:
        "I combine clues and select the strongest evidence. Packing an umbrella most directly supports the inference that rain is expected.",
    };
  }

  if (skill === "text_structure") {
    return {
      excerpt: "The river flooded after three days of rain. As a result, roads were closed.",
      questionA: "Part A: Which text structure does the excerpt use?",
      choicesA: ["Cause and effect", "Sequence", "Description", "Problem and solution"],
      correctIndexA: 0,
      questionB: "Part B: Which phrase best supports your answer?",
      choicesB: ["river flooded", "three days of rain", "As a result", "roads were closed"],
      correctIndexB: 2,
      teacherReasoning:
        "The signal phrase 'As a result' connects cause to outcome. That phrase is the clearest evidence for cause-and-effect structure.",
    };
  }

  return {
    excerpt: `Students in grade ${g} are analyzing a short task tied to ${String(skill || "the target skill").replaceAll("_", " ")}.`,
    questionA: "Part A: Which choice is best supported by the excerpt?",
    choicesA: ["Choice A", "Choice B", "Choice C", "Choice D"],
    correctIndexA: 0,
    questionB: "Part B: Which detail best supports Part A?",
    choicesB: ["Detail A", "Detail B", "Detail C", "Detail D"],
    correctIndexB: 0,
    teacherReasoning:
      "I answer Part A first, then choose the strongest evidence in Part B that directly proves the Part A answer.",
  };
}

function buildModelSlides(plan: SkillPlan, skillType: SkillType, grade: number): SlideDefinition[] {
  const example = generateModelExample(skillType, grade);

  const partA: SlideDefinition = {
    stageType: "model_think_aloud",
    type: "question",
    heading: "Let's Model This — Part A",
    subtext: example.excerpt,
    question: example.questionA,
    prompt: example.excerpt,
    answerChoices: example.choicesA,
    correctIndex: example.correctIndexA,
    section: "Model",
    durationSeconds: 90,
    teacherCue: "Model the inference/analysis move, then eliminate distractors.",
  };

  const partB: SlideDefinition = {
    stageType: "model_think_aloud",
    type: "question",
    heading: "Let's Model This — Part B (Evidence)",
    question: example.questionB,
    prompt: example.excerpt,
    answerChoices: example.choicesB,
    correctIndex: example.correctIndexB,
    section: "Model",
    durationSeconds: 90,
    teacherCue: `${example.teacherReasoning} ${plan.model}`.trim(),
  };

  return [partA, partB];
}


function buildObjectiveSlide(plan: SkillPlan, objectiveLabel: string): SlideDefinition {
  return { type: "headline", stageType: "objective_lock", heading: "Objective", subtext: `${plan.objective} (${objectiveLabel})`, section: "Objective", durationSeconds: 90 };
}
function buildHookSlide(plan: SkillPlan): SlideDefinition {
  return { type: "energy", heading: "Hook", subtext: plan.hook, section: "Hook", durationSeconds: 60 };
}
function buildFrontloadSlide(plan: SkillPlan): SlideDefinition {
  return {
    type: "split",
    heading: "Vocabulary / Frontload",
    subtext: "Word/Concept • Context • Key clue • Best meaning",
    items: plan.vocab,
    section: "Frontload",
    durationSeconds: 120,
  };
}
function buildGuidedSlide(plan: SkillPlan, mc: ReturnType<typeof generateSkillAlignedMCQ>, cognitiveVerb: string): SlideDefinition {
  return {
    type: "question",
    stageType: "guided_dok_ladder",
    heading: "Guided (We Do)",
    question: `${verbDrivenQuestion(cognitiveVerb, plan.guided)} (Identify → Explain → Justify)`,
    prompt: mc.excerpt,
    answerChoices: mc.answerChoices,
    correctIndex: mc.correctIndex,
    distractorRationale: mc.distractorRationale,
    section: "Guided",
    durationSeconds: 150,
    teacherCue: "Require students to explain why one answer is stronger and another is weaker.",
  };
}
function buildAssessmentSlide(mc: ReturnType<typeof generateSkillAlignedMCQ>, cognitiveVerb: string, dokLevel: number): SlideDefinition {
  return {
    type: "question",
    stageType: "guided_dok_ladder",
    heading: "Assessment Simulation",
    question: verbDrivenQuestion(cognitiveVerb, mc.question),
    prompt: mc.excerpt,
    answerChoices: mc.answerChoices,
    correctIndex: mc.correctIndex,
    distractorRationale: mc.distractorRationale,
    section: "Assessment",
    durationSeconds: dokLevel >= 3 ? 210 : 180,
  };
}
function buildWritingSlide(plan: SkillPlan, grade: number, skillType: SkillType): SlideDefinition {
  return {
    type: "writing",
    stageType: "independent_transfer",
    heading: "Writing (You Do)",
    subtext: `${gradeAdjustedWriting(plan.write, grade)} Use proof from ${evidenceSourceForSkill(skillType)}.`,
    section: "Independent",
    durationSeconds: 150,
  };
}
function buildExitSlide(plan: SkillPlan, cognitiveVerb: string): SlideDefinition {
  const verb = normalizeVerb(cognitiveVerb);
  return {
    type: "writing",
    stageType: "exit_ticket",
    heading: "Exit Ticket",
    subtext: `Use the skill now: ${verb} with evidence. ${plan.exit}`,
    section: "Exit",
    durationSeconds: 120,
  };
}


function buildContextCluesDeckPlan(): SkillPlan {
  return { objective: "I can infer meanings of unfamiliar words using context clues.", hook: "Quick challenge: Which nearby words reveal the unknown word meaning?", model: "Which nearby words help unlock the meaning of the target word?", guided: "Use context clues to select the best meaning of the target word.", write: "Write a CER explaining the meaning of one unfamiliar word using two context clues.", exit: "Choose one unfamiliar word and justify its meaning with context evidence.", vocab: ["obscured", "thick fog covered the path", "thick fog", "hidden"] };
}
function buildThemeDeckPlan(): SkillPlan {
  return { objective: "I can determine a theme and support it with evidence.", hook: "Warm-up: Topic or theme? Sort each statement quickly.", model: "How is a theme different from a topic?", guided: "Which statement best expresses the theme?", write: "Write a CER identifying theme with two supporting details.", exit: "State one theme and cite one line that supports it.", vocab: ["theme", "topic", "evidence", "lesson"] };
}
function buildInferenceDeckPlan(): SkillPlan {
  return { objective: "I can make text-based inferences and justify them.", hook: "Read one line and infer what is implied, not directly stated.", model: "What can we infer that is not stated directly?", guided: "Which inference is best supported by details?", write: "Write a CER making one inference supported by evidence.", exit: "Make one inference and cite the strongest clue.", vocab: ["infer", "evidence", "implied", "conclusion"] };
}
function buildCharacterDeckPlan(): SkillPlan {
  return { objective: "I can analyze character traits and motivations using evidence.", hook: "Which action reveals the character’s motivation most clearly?", model: "Which actions reveal character motivation?", guided: "What trait or motivation is best supported by the text?", write: "Write a CER about a character trait with two pieces of evidence.", exit: "Name a character motivation and support it with evidence.", vocab: ["trait", "motivation", "action", "evidence"] };
}
function buildTextStructureDeckPlan(): SkillPlan {
  return {
    objective: "I can analyze how the author organizes ideas using a specific text structure to develop meaning.",
    hook: "If a paragraph uses cause/effect, the reader understands why events happen; if it uses compare/contrast, the reader evaluates key differences.",
    model: "How does the chosen structure shape what the reader understands first?",
    guided: "Which structure best fits this excerpt, and how does that structure guide meaning?",
    write: "Compare how two different structures would change the reader’s understanding and justify which is more effective.",
    exit: "Identify the structure and explain why with one detail.",
    vocab: [
      "cause/effect: explains why results happen",
      "compare/contrast: highlights meaningful similarities and differences",
      "sequence: clarifies order and process",
      "problem/solution: frames the issue and response",
    ],
  };
}
function buildCentralIdeaDeckPlan(): SkillPlan {
  return { objective: "I can identify central idea and supporting details.", hook: "Find the one sentence that captures the whole paragraph.", model: "Which details are central versus minor?", guided: "Which statement best captures the central idea?", write: "Write a CER naming central idea with two supporting details.", exit: "State the central idea and one strongest detail.", vocab: ["central idea", "supporting detail", "summary", "evidence"] };
}
function buildPoetryDeckPlan(): SkillPlan {
  return { objective: "I can analyze how poetic language and structure create meaning.", hook: "Read one line: what feeling does the language create first?", model: "How does figurative language shape meaning in this line?", guided: "Which interpretation best reflects the poem's language?", write: "Write a CER explaining a poetic device and its effect.", exit: "Identify one device and explain its effect in one sentence.", vocab: ["metaphor", "imagery", "tone", "line break"] };
}
function buildAuthorsCraftDeckPlan(): SkillPlan {
  return { objective: "I can analyze how author choices shape meaning and tone.", hook: "Which author choice affects your understanding most immediately?", model: "Which author choice has the biggest impact on the reader?", guided: "Which option best explains the effect of an author choice?", write: "Write a CER explaining how one craft move affects meaning.", exit: "Name one author choice and explain its effect with evidence.", vocab: ["diction", "tone", "structure", "effect"] };
}
function buildResearchDeckPlan(): SkillPlan {
  return { objective: "I can synthesize information from multiple credible sources.", hook: "Which source appears most credible for this question?", model: "How do we verify source reliability and relevance?", guided: "Which evidence from multiple sources best supports the claim?", write: "Write a synthesis response using evidence from at least two sources.", exit: "Name one credible source and one reason it is trustworthy.", vocab: ["source", "credibility", "synthesize", "citation"] };
}
function buildGenericDeckPlan(): SkillPlan {
  return { objective: "I can analyze text and justify my thinking with evidence.", hook: "Which detail is most important for understanding this text?", model: "What evidence most strongly supports your interpretation?", guided: "Which answer is best supported by textual evidence?", write: "Write a CER that includes a clear claim and evidence.", exit: "Provide one claim and one piece of text evidence.", vocab: ["claim", "evidence", "reasoning", "support"] };
}

function buildUniversalSkillPlan(skillName: string): SkillPlan {
  const label = String(skillName || "generic").replaceAll("_", " ");
  return {
    objective: `I can apply the skill of ${label} using evidence and reasoning.`,
    hook: `What clues help you understand ${label}?`,
    model: `Let's model how to apply ${label} step by step using evidence.`,
    guided: `Which answer best demonstrates ${label}?`,
    write: `Write a CER explaining how you applied ${label}.`,
    exit: `Explain how ${label} helped you solve the task.`,
    vocab: [label, "evidence", "reasoning", "analysis"],
  };
}

const skillBuilders: Record<string, () => SkillPlan> = {
  author_purpose: buildAuthorsCraftDeckPlan,
  central_idea: buildCentralIdeaDeckPlan,
  characterization: buildCharacterDeckPlan,
  character_relationships: buildCharacterDeckPlan,

  composition: buildGenericDeckPlan,
  context_clues: buildContextCluesDeckPlan,
  figurative_language: buildPoetryDeckPlan,

  inference: buildInferenceDeckPlan,

  plot: buildCharacterDeckPlan,
  point_of_view: buildAuthorsCraftDeckPlan,
  setting: buildCharacterDeckPlan,

  supporting_details: buildCentralIdeaDeckPlan,
  text_features: buildTextStructureDeckPlan,
  text_structure: buildTextStructureDeckPlan,

  theme: buildThemeDeckPlan,

  research: buildResearchDeckPlan,

  argument: buildGenericDeckPlan,

  listening_speaking: buildGenericDeckPlan,
  writing_process: buildGenericDeckPlan,

  foundational_literacy: buildGenericDeckPlan,

  generic: buildGenericDeckPlan,
};


function resolveGradeBand(grade: number | string | null): GradeBand {
  const g = Number(grade);
  if (g <= 4) return "3-4";
  if (g <= 6) return "5-6";
  return "7-8";
}

async function fetchSkillPlaybook(
  canonicalSkill: string,
  headers: Record<string, string>
): Promise<SkillPlaybookRow> {

  const selectAttempts = [
    "canonical_skill,objective_template,hook_template,vocab_list,writing_template,exit_template,strategy_formula,model_sequence,tier1_prompt,tier2_prompt,tier3_prompt,impact_on_meaning_prompt,transfer_constraint,complexity_notes",
    "canonical_skill,strategy_formula,model_sequence,tier1_prompt,tier2_prompt,tier3_prompt,impact_on_meaning_prompt,transfer_constraint,complexity_notes"
  ];

  let lastErrorMessage = "";

  for (const select of selectAttempts) {

    const params = new URLSearchParams({
      select,
      canonical_skill: `eq.${canonicalSkill}`,
      limit: "1"
    });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/canonical_skill_playbooks?${params.toString()}`,
      { headers }
    );

    if (!res.ok) {

      const body = await res.text();

      lastErrorMessage =
        `Skill playbook lookup failed (${res.status}): ${body.slice(0,140)}`;

      const missingColumn =
        res.status === 400 &&
        (
          body.includes("objective_template") ||
          body.includes("hook_template") ||
          body.includes("vocab_list")
        );

      if (!missingColumn) {
        throw new Error(lastErrorMessage);
      }

      continue;
    }

    const rows = await res.json();

    const row =
      Array.isArray(rows)
        ? rows[0] || null
        : null;

    if (!row?.canonical_skill) {

      if (canonicalSkill !== "generic") {
        return fetchSkillPlaybook("generic", headers);
      }

      throw new Error(
        `Skill playbook not found for ${canonicalSkill}.`
      );
    }

    return row;
  }

  throw new Error(
    lastErrorMessage || `Skill playbook lookup failed for ${canonicalSkill}.`
  );
}

async function fetchInstructionMode(
  modeName: string,
  headers: Record<string, string>
): Promise<InstructionModeRow> {

  const selectAttempts = [
    "mode,require_two_evidence,require_compare_defend,skip_model,exit_ticket_level,auto_turn_talk_after_guided,turn_talk_duration,require_cer,cer_frame_template,require_staar_language,staar_scoring_language,auto_advance",
    "mode,require_two_evidence,require_compare_defend,skip_model,exit_ticket_level",
  ];

  let lastErrorMessage = "";

  for (const select of selectAttempts) {

    const params = new URLSearchParams({
      select,
      mode: `eq.${modeName}`,
      limit: "1"
    });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/instruction_modes?${params.toString()}`,
      { headers }
    );

    if (!res.ok) {

      const body = await res.text();

      lastErrorMessage =
        `Instruction mode lookup failed (${res.status}): ${body.slice(0,140)}`;

      const missingColumn =
        res.status === 400 &&
        (
          body.includes("auto_turn_talk_after_guided") ||
          body.includes("turn_talk_duration")
        );

      if (!missingColumn) {
        throw new Error(lastErrorMessage);
      }

      continue;
    }

    const rows = await res.json();

    const row =
      Array.isArray(rows)
        ? rows[0] || null
        : null;

    if (!row?.mode) {
      throw new Error(`Instruction mode not found for ${modeName}.`);
    }

    return row;
  }

  throw new Error(
    lastErrorMessage || `Instruction mode lookup failed for ${modeName}.`
  );
}
function buildExecutionConfig(
  plan: SkillPlan,
  skillPlaybook: SkillPlaybookRow,
  scaling: ComplexityScaling,
  mode: InstructionModeRow,
): ExecutionConfig {
  const requireTwoEvidence = Boolean(mode.require_two_evidence);
  const requireCompareDefend = Boolean(mode.require_compare_defend);
  const skipModelFromMode = Boolean(mode.skip_model);

  return {
    objectiveTemplate: String(skillPlaybook.objective_template || plan.objective),
    hookTemplate: String(skillPlaybook.hook_template || plan.hook),
    vocabList: Array.isArray(skillPlaybook.vocab_list) && skillPlaybook.vocab_list.length ? skillPlaybook.vocab_list : plan.vocab,
    writingTemplate: String(skillPlaybook.writing_template || plan.write),
    exitTemplate: String(skillPlaybook.exit_template || plan.exit),
    strategyFormula: String(skillPlaybook.strategy_formula || skillPlaybook.hook_template || plan.hook),
    modelSequence: String(skillPlaybook.model_sequence || plan.model),
    tier1Prompt: String(skillPlaybook.tier1_prompt || plan.guided),
    tier2Prompt: String(skillPlaybook.tier2_prompt || plan.guided),
    tier3Prompt: String(skillPlaybook.tier3_prompt || plan.write),
    impactPrompt: String(skillPlaybook.impact_on_meaning_prompt || "How does this choice impact meaning for the reader?"),
    evidenceRequired: Math.max(Number(scaling.evidence_required || 1), requireTwoEvidence ? 2 : 1),
    requireCompare: Boolean(scaling.require_compare) || requireCompareDefend,
    transferConstraint: String(skillPlaybook.transfer_constraint || ""),
    skipModel: skipModelFromMode || scaling.model_required === false,
    exitTicketLevel: String(mode.exit_ticket_level || "core"),
    autoTurnTalkAfterGuided: Boolean(mode.auto_turn_talk_after_guided),
    turnTalkDuration: Math.max(10, Number(mode.turn_talk_duration || 30)),
    requireCER: Boolean(mode.require_cer),
    cerFrameTemplate: String(mode.cer_frame_template || "CER: Claim → Evidence → Reasoning"),
    requireStaarLanguage: Boolean(mode.require_staar_language),
    staarScoringLanguage: String(mode.staar_scoring_language || ""),
    autoAdvance: Boolean(mode.auto_advance),
  };
}

function applyExecutionConfigToDeck(
  deck: SlideDefinition[],
  executionConfig: ExecutionConfig,
  cognitiveVerb: string,
): SlideDefinition[] {
  let next = deck.map(cloneSlide);

  next = next.map((slide) => {
    if (slide.stageType === "strategy_formula") {
      return {
        ...slide,
        subtext: `${executionConfig.strategyFormula} | What is your proof?`,
      };
    }

    if (slide.stageType === "model_think_aloud") {
      return {
        ...slide,
        prompt: `${executionConfig.impactPrompt}

${executionConfig.modelSequence}`,
      };
    }

    if (slide.stageType === "guided_dok_ladder" && slide.type === "question" && String(slide.section || "").toLowerCase() === "guided") {
      const evidenceCue =
        executionConfig.evidenceRequired >= 2
          ? "Use at least two pieces of evidence to justify your response."
          : "Use one piece of evidence to justify your response.";
      const staarCue = executionConfig.requireStaarLanguage && executionConfig.staarScoringLanguage
        ? ` ${executionConfig.staarScoringLanguage}`
        : "";
      return {
        ...slide,
        question: verbDrivenQuestion(cognitiveVerb, executionConfig.tier2Prompt),
        prompt: `${executionConfig.impactPrompt} ${slide.prompt || ""}`.trim(),
        teacherCue: `${evidenceCue}${staarCue}`.trim(),
      };
    }

    if (slide.stageType === "independent_transfer" && slide.type === "writing") {
      const constraint = executionConfig.transferConstraint ? ` Constraint: ${executionConfig.transferConstraint}` : "";
      const cerLine = executionConfig.requireCER ? `

${executionConfig.cerFrameTemplate}` : "";
      const staarLine = executionConfig.requireStaarLanguage && executionConfig.staarScoringLanguage
        ? `

${executionConfig.staarScoringLanguage}`
        : "";
      return {
        ...slide,
        subtext: `${executionConfig.impactPrompt}

${executionConfig.tier3Prompt}${constraint}${cerLine}${staarLine}`,
      };
    }

    if (slide.stageType === "exit_ticket") {
      const staarCue = executionConfig.requireStaarLanguage && executionConfig.staarScoringLanguage
        ? ` • ${executionConfig.staarScoringLanguage}`
        : "";
      return {
        ...slide,
        teacherCue: `Exit level: ${executionConfig.exitTicketLevel}${staarCue}`,
      };
    }

    if (slide.stageType === "compare_defend") {
      return {
        ...slide,
        prompt: `${executionConfig.impactPrompt}

${slide.prompt || "Compare two options and defend the stronger choice."}`,
      };
    }

    if (slide.type === "question" && String(slide.section || "").toLowerCase() === "assessment" && executionConfig.evidenceRequired >= 2) {
      return {
        ...slide,
        teacherCue: "Students justify the best answer with two pieces of evidence before committing.",
      };
    }

    return slide;
  });

  if (executionConfig.skipModel) {
    next = next.filter((slide) => slide.stageType !== "model_think_aloud");
  }

  if (executionConfig.requireCompare) {
    const hasCompare = next.some((slide) => slide.stageType === "compare_defend");
    if (!hasCompare) {
      const writingIndex = next.findIndex((slide) => slide.stageType === "independent_transfer");
      const insertAt = writingIndex >= 0 ? writingIndex : Math.max(0, next.length - 1);
      next.splice(insertAt, 0, {
        type: "discussion",
        stageType: "compare_defend",
        heading: "Compare & Defend",
        prompt: `${executionConfig.impactPrompt}

Compare two possible structures/answers and defend which is more effective for meaning.`,
        section: "Deepen",
        durationSeconds: 120,
        teacherCue: "Require evidence-based justification and explain impact on meaning.",
      });
    }
  }

  if (executionConfig.autoTurnTalkAfterGuided) {
    const withTurnTalk: SlideDefinition[] = [];
    for (const slide of next) {
      withTurnTalk.push(slide);
      const isGuidedQuestion =
        slide.type === "question" &&
        slide.stageType === "guided_dok_ladder" &&
        String(slide.section || "").toLowerCase() === "guided";

      if (isGuidedQuestion) {
        withTurnTalk.push({
          type: "discussion",
          stageType: "guided_dok_ladder",
          heading: "Turn & Talk",
          prompt: "Partner-share your answer and refine it with stronger evidence.",
          section: "Discussion",
          durationSeconds: executionConfig.turnTalkDuration,
          teacherCue: `Auto-injected turn & talk (${executionConfig.turnTalkDuration}s).`,
        });
      }
    }
    next = withTurnTalk;
  }

  return next;
}

function buildSkillLockedDeck(
  skillType: SkillType,
  canonicalSkill: string,
  dok: string,
  grade: number,
  cognitiveVerb: string,
  priority: string,
  executionConfig?: ExecutionConfig,
): SlideDefinition[] {
  const dokLevel = normalizeDok(dok);
  const builder =
    skillBuilders[skillType] ||
    skillBuilders["generic"] ||
    (() => buildUniversalSkillPlan(skillType));
  const plan = builder();
  const mc = generateSkillAlignedMCQ(skillType);
  const skillLabel = skillType.replaceAll("_", " ");

  const verb = normalizeVerb(cognitiveVerb);
  const deck: SlideDefinition[] = [
    {
      type: "headline",
      stageType: "objective_lock",
      heading: "TEKS Focus",
      subtext: `Today we will ${verb} the skill of ${skillLabel} using evidence.${executionConfig ? ` ${executionConfig.objectiveTemplate}` : ""}`,
      section: "Objective",
      durationSeconds: 90,
      teacherCue: `${priority} • ${dok}`,
    },
    {
      type: "headline",
      stageType: "verb_definition",
      heading: "What the Verb Means",
      subtext: `${verb}: ${studentVerbDefinition(verb)}.`,
      section: "Frontload",
      durationSeconds: 75,
      teacherCue: "Students restate the verb in their own words before practice.",
    },
    {
      type: "split",
      stageType: "strategy_formula",
      heading: "Strategy Formula",
      subtext: `${executionConfig?.strategyFormula || plan.hook} | What is your proof?`,
      items: executionConfig?.vocabList || plan.vocab,
      section: "Frontload",
      durationSeconds: 120,
      teacherCue: "Anchor every response to proof from text/details/steps.",
    },
    ...buildModelSlides(plan, skillType, grade),
    buildGuidedSlide(plan, mc, cognitiveVerb),
  ];

  if (priority !== "Process") {
    deck.push(buildAssessmentSlide(mc, cognitiveVerb, dokLevel));
  }

  if (priority === "Readiness") {
    deck.push({
      type: "discussion",
      stageType: "guided_dok_ladder",
      heading: "High-Impact STAAR Practice",
      prompt: "Why is this the strongest answer? Justify using two pieces of evidence.",
      section: "Readiness Boost",
      durationSeconds: 120,
      teacherCue: "Push academic response language aligned to STAAR short constructed response.",
    });
  }

  const writingPlan: SkillPlan = executionConfig
    ? { ...plan, write: executionConfig.writingTemplate }
    : plan;
  const exitPlan: SkillPlan = executionConfig
    ? { ...plan, exit: executionConfig.exitTemplate }
    : plan;

  deck.push(buildWritingSlide(writingPlan, grade, skillType), buildExitSlide(exitPlan, cognitiveVerb));

  if (dokLevel >= 3) {
    deck.splice(deck.length - 2, 0, {
      type: "discussion",
      stageType: "compare_defend",
      heading: "Compare & Defend",
      prompt: "Compare two possible answers and defend why one is stronger.",
      section: "Deepen",
      durationSeconds: 120,
      teacherCue: "Require textual evidence in justification.",
    });
  }

  return executionConfig ? applyExecutionConfigToDeck(deck, executionConfig, cognitiveVerb) : deck;
}

function containsThemeLanguage(text: string): boolean {
  const t = String(text || "").toLowerCase();
  return /\btheme\b|\blesson\b|\btopic\b/.test(t);
}

function enforceSkillLock(deck: SlideDefinition[], skillType: SkillType): SlideDefinition[] {
  if (skillType !== "context_clues") return deck;

  const rewritten: SlideDefinition[] = [];
  for (const slide of deck) {
    const source = `${slide.heading || ""} ${slide.subtext || ""} ${slide.prompt || ""} ${slide.question || ""}`;

    if (containsThemeLanguage(source) && slide.type !== "question") {
      // Remove non-assessment theme/drift slides entirely in context-clues mode.
      continue;
    }

    const next: SlideDefinition = { ...slide };

    if (containsThemeLanguage(next.heading || "")) {
      next.heading = "Context Clues Focus";
    }

    if (containsThemeLanguage(next.subtext || "")) {
      next.subtext = "Use nearby words, punctuation, and sentence meaning to infer unfamiliar word meaning.";
    }

    if (containsThemeLanguage(next.prompt || "")) {
      next.prompt = "What context clues around the target word best support its meaning?";
    }

    if (containsThemeLanguage(next.question || "")) {
      next.question = "Which meaning is best supported by context clues in the passage?";
    }

    if (next.type === "writing") {
      const writingText = `${next.subtext || ""} ${next.prompt || ""}`.toLowerCase();
      if (containsThemeLanguage(writingText)) {
        next.subtext = "Write a CER explaining the meaning of one unfamiliar word using two context clues.";
      }
    }

    if ((next.heading || "").toLowerCase().includes("exit")) {
      next.subtext = "Exit Ticket: Choose one unfamiliar word and justify its meaning with context evidence.";
    }

    rewritten.push(next);
  }

  return rewritten;
}


function injectCoachingInsight(deck: SlideDefinition[]): SlideDefinition[] {
  if (!settings.coachingMode) return deck;

  const next = deck.map(cloneSlide);
  const dokLevel = normalizeDok(currentDok);
  const assessmentIndex = next.findIndex((slide) =>
    (slide.heading || "").toLowerCase().includes("assessment simulation"),
  );

  if (assessmentIndex === -1) return next;

  const existingCoachingNearAssessment =
    next[assessmentIndex + 1] &&
    String(next[assessmentIndex + 1].heading || "").toLowerCase() === "why students miss this";

  if (existingCoachingNearAssessment) return next;

  next.splice(assessmentIndex + 1, 0, {
    type: "headline",
    stageType: "guided_dok_ladder",
    heading: "Why Students Miss This",
    subtext: `Common misconception for ${currentSkillType.replaceAll("_", " ")}: students over-rely on first-glance clues.`,
    section: "Coaching",
    durationSeconds: dokLevel >= 3 ? 120 : 90,
    teacherCue:
      dokLevel >= 3
        ? "Push for justification and multiple pieces of evidence."
        : `Prompt with the cognitive verb: ${currentVerb || "explain"}.`,
  });

  return next;
}


function normalizeSlides(deck: SlideDefinition[]) {
  const stageOrder: SlideType[] = [
    "objective_lock",
    "verb_definition",
    "strategy_formula",
    "model_think_aloud",
    "guided_dok_ladder",
    "compare_defend",
    "independent_transfer",
    "exit_ticket",
  ];

  const defaults: Record<SlideType, SlideDefinition> = {
    objective_lock: {
      type: "headline",
      stageType: "objective_lock",
      heading: "Today's Objective",
      subtext: "We will practice a new skill today.",
      section: "Objective",
    },
    verb_definition: {
      type: "split",
      stageType: "verb_definition",
      heading: "What the Verb Means",
      items: ["Explain the academic verb in your own words."],
      section: "Frontload",
    },
    strategy_formula: {
      type: "split",
      stageType: "strategy_formula",
      heading: "Strategy",
      items: ["Identify the task", "Find evidence", "Explain reasoning"],
      section: "Frontload",
    },
    model_think_aloud: {
      type: "question",
      stageType: "model_think_aloud",
      heading: "Model (I Do)",
      question: "Watch how the teacher solves the task step-by-step.",
      section: "Model",
    },
    guided_dok_ladder: {
      type: "question",
      stageType: "guided_dok_ladder",
      heading: "Guided Practice",
      question: "Work with a partner to justify your answer.",
      section: "Guided",
    },
    compare_defend: {
      type: "discussion",
      stageType: "compare_defend",
      heading: "Compare & Defend",
      prompt: "Which answer is stronger and why?",
      section: "Deepen",
    },
    independent_transfer: {
      type: "writing",
      stageType: "independent_transfer",
      heading: "Independent Practice",
      subtext: "Apply the strategy independently.",
      section: "Independent",
    },
    exit_ticket: {
      type: "writing",
      stageType: "exit_ticket",
      heading: "Exit Ticket",
      subtext: "Show what you learned.",
      section: "Exit",
    },
  };

  const slideBuckets: Record<string, SlideDefinition[]> = {};
  for (const slide of deck || []) {
    if (!slide?.stageType) continue;
    if (!slideBuckets[slide.stageType]) slideBuckets[slide.stageType] = [];
    slideBuckets[slide.stageType].push(slide);
  }

  const ordered = stageOrder.flatMap((stageType) => {
    const bucket = slideBuckets[stageType] || [];
    const fallback = defaults[stageType];

    if (!bucket.length) {
      return [fallback];
    }

    return bucket.map((slide) => ({
      ...fallback,
      ...slide,
      type: slide.type || fallback.type,
      stageType,
      heading: slide.heading ?? fallback.heading,
      subtext: slide.subtext ?? fallback.subtext,
      items: slide.items ?? fallback.items,
      question: slide.question ?? fallback.question,
      prompt: slide.prompt ?? fallback.prompt,
      section: slide.section ?? fallback.section,
    }) as SlideDefinition);
  });

  const splash = (deck || []).filter((slide) => slide?.type === "splash");
  const nonStaged = (deck || []).filter((slide) => !slide?.stageType && slide?.type && slide.type !== "splash");
  return [...splash, ...ordered, ...nonStaged];
}

const STAGE_ORDER: SlideType[] = [
  "objective_lock",
  "verb_definition",
  "strategy_formula",
  "model_think_aloud",
  "guided_dok_ladder",
  "compare_defend",
  "independent_transfer",
  "exit_ticket",
];

function dedupeSlides(deck: SlideDefinition[]): SlideDefinition[] {
  const seen = new Set<string>();
  return deck.filter((slide) => {
    const key = [
      slide.stageType || "",
      String(slide.heading || "").trim().toLowerCase(),
      String(slide.question || "").trim().toLowerCase(),
      String(slide.prompt || "").trim().toLowerCase(),
      Array.isArray(slide.items) ? slide.items.map((i) => String(i || "").trim().toLowerCase()).join("|") : "",
    ].join("||");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripJunkSlides(deck: SlideDefinition[]): SlideDefinition[] {
  return deck.filter((slide) => {
    const text = [slide.heading, slide.subtext, slide.question, slide.prompt, slide.notes]
      .map((t) => String(t || ""))
      .join(" ")
      .toLowerCase()
      .trim();

    if (!text) return false;
    if (text.includes("practice question") && text.length < 25) return false;
    if (text.includes("_id:")) return false;
    if (text.includes("correctindex")) return false;
    return true;
  });
}

function sortSlides(deck: SlideDefinition[]): SlideDefinition[] {
  const orderOf = (stage?: SlideType) => {
    const idx = STAGE_ORDER.indexOf(stage as SlideType);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return [...deck].sort((a, b) => orderOf(a.stageType) - orderOf(b.stageType));
}

function capSlides(deck: SlideDefinition[], max = 12): SlideDefinition[] {
  return deck.slice(0, max);
}

function buildSlidesFinal(rawSlides: SlideDefinition[]): SlideDefinition[] {
  return capSlides(sortSlides(dedupeSlides(stripJunkSlides(rawSlides))), 12);
}

function validateDeck(deck: SlideDefinition[]) {
  return deck.filter((slide): slide is SlideDefinition => Boolean(slide && slide.type));
}

function applyTeacherToggles(deck: SlideDefinition[], opts: PresentSettings): SlideDefinition[] {
  let next = deck.map(cloneSlide);

  if (!opts.includeModel) {
    next = next.filter((slide) => slide.stageType !== "model_think_aloud");
  }
  if (!opts.includeCompareDefend) {
    next = next.filter((slide) => slide.stageType !== "compare_defend");
  }
  if (!opts.includeExitTicket) {
    next = next.filter((slide) => slide.stageType !== "exit_ticket");
  }

  if (opts.increaseRigor) {
    next = next.map((slide) => {
      if (slide.type !== "question" && slide.type !== "discussion" && slide.type !== "writing") return slide;
      const promptBits = [slide.question || "", slide.prompt || ""].join(" ").toLowerCase();
      const rigorSuffix = promptBits.includes("justify") ? "" : " Justify with two pieces of evidence (DOK 3).";
      return {
        ...slide,
        prompt: `${slide.prompt || ""}${rigorSuffix}`.trim(),
        teacherCue: `${slide.teacherCue || ""} Push students to compare evidence quality.`.trim(),
      };
    });
  }

  if (opts.mini15) {
    const total = next.reduce((sum, s) => sum + (s.durationSeconds || 90), 0);
    const scale = total > 0 ? 900 / total : 1;
    next = next.map((slide) => ({
      ...slide,
      durationSeconds: Math.max(15, Math.round((slide.durationSeconds || 90) * scale)),
    }));
  }

  return next;
}

function applyTheme(deck: SlideDefinition[], theme: PresentSettings["theme"]): SlideDefinition[] {
  if (theme === "default") return deck;

  const replacements: Record<PresentSettings["theme"], Array<[RegExp, string]>> = {
    default: [],
    fortnite: [
      [/\bstorm\b/gi, "storm circle"],
      [/\bchallenge\b/gi, "quest"],
      [/\bstrategy\b/gi, "loadout strategy"],
    ],
    sports: [
      [/\bstorm\b/gi, "defensive pressure"],
      [/\bchallenge\b/gi, "play"],
      [/\bstrategy\b/gi, "game plan"],
    ],
    real_world: [
      [/\bstorm\b/gi, "real-world pressure"],
      [/\bchallenge\b/gi, "real scenario"],
      [/\bstrategy\b/gi, "decision path"],
    ],
    academic: [
      [/\bstorm\b/gi, "complexity"],
      [/\bchallenge\b/gi, "cognitive demand"],
      [/\bstrategy\b/gi, "analytical method"],
    ],
  };

  const injectTone = (value?: string): string | undefined => {
    if (!value) return value;
    let next = value;
    for (const [pattern, replacement] of replacements[theme]) {
      next = next.replace(pattern, replacement);
    }
    return next;
  };

  const themeLabel: Record<PresentSettings["theme"], string> = {
    default: "",
    fortnite: "🎮 Fortnite Mode",
    sports: "🏈 Sports Mode",
    real_world: "🌍 Real-World Mode",
    academic: "🎓 Academic Mode",
  };

  return deck.map((slide) => ({
    ...slide,
    heading: injectTone(slide.heading),
    subtext: injectTone(slide.subtext),
    question: injectTone(slide.question),
    prompt: injectTone(slide.prompt),
    notes: injectTone(slide.notes),
    teacherCue: injectTone(slide.teacherCue),
    items: Array.isArray(slide.items) ? slide.items.map((item) => injectTone(item) || item) : slide.items,
    section: theme !== "default" ? `${slide.section || "Lesson"} • ${themeLabel[theme]}` : slide.section,
  }));
}

function insertEngagementSlides(deck: SlideDefinition[]): SlideDefinition[] {
  const next: SlideDefinition[] = [];
  let injected = 0;
  for (const slide of deck) {
    next.push(slide);
    if (slide.type !== "question" || slide.stageType !== "guided_dok_ladder") continue;
    if (injected === 0) {
      next.push({
        type: "discussion",
        stageType: "guided_dok_ladder",
        heading: "🗣 Turn & Talk",
        prompt: "Share your answer with a partner, then upgrade one sentence using stronger evidence.",
        section: "Engagement",
        durationSeconds: 60,
        teacherCue: "Listen for evidence language and cold-call one pair.",
      });
      injected += 1;
      continue;
    }
    if (injected === 1) {
      next.push({
        type: "writing",
        stageType: "independent_transfer",
        heading: "✍️ Quick Write",
        subtext: "In 2-3 sentences, explain your answer with claim + evidence + reasoning.",
        section: "Engagement",
        durationSeconds: 90,
        teacherCue: "Have students box the claim and underline evidence.",
      });
      next.push({
        type: "discussion",
        stageType: "compare_defend",
        heading: "🤝 Partner Task",
        prompt: "Swap responses and identify the strongest evidence your partner used.",
        section: "Engagement",
        durationSeconds: 75,
        teacherCue: "Prompt students to defend why one response is strongest.",
      });
      injected += 1;
    }
  }
  return next;
}

function insertEnergyMoments(deck: SlideDefinition[]): SlideDefinition[] {
  const next = [...deck];
  const hasEnergy = next.some((slide) => slide.type === "energy");
  if (hasEnergy) return next;
  const anchor = next.findIndex((slide) => slide.stageType === "guided_dok_ladder");
  const insertAt = anchor >= 0 ? anchor + 1 : Math.min(2, next.length);
  next.splice(insertAt, 0,
    {
      type: "energy",
      stageType: "guided_dok_ladder",
      heading: "⚡ Lightning Round",
      subtext: "Speed Round: You have 20 seconds to justify your choice with one text detail.",
      section: "Challenge Mode",
      durationSeconds: 45,
      teacherCue: "Celebrate fast, evidence-based responses.",
    },
    {
      type: "energy",
      stageType: "guided_dok_ladder",
      heading: "🧠 Brain Boost",
      subtext: "Challenge Mode: Revise one weak answer into a high-rigor response.",
      section: "Energy",
      durationSeconds: 60,
      teacherCue: "Ask what changed and why the revision is stronger.",
    },
  );
  return next;
}

function normalizeSlidesForSettings() {
  let next = baseSlides.map(cloneSlide);
  next = injectCoachingInsight(next);
  next = applyTheme(next, settings.theme);
  next = insertEngagementSlides(next);
  next = insertEnergyMoments(next);

  if (settings.moreDiscussion) {
    const withDiscussion: SlideDefinition[] = [];
    for (const slide of next) {
      withDiscussion.push(slide);
      if (slide.type === "question") {
        withDiscussion.push({
          type: "discussion",
          stageType: "guided_dok_ladder",
          heading: "Partner Check",
          prompt: "Share your answer and improve it with one stronger piece of evidence.",
          section: "Discussion",
          durationSeconds: 45,
          teacherCue: "Cold-call one pair to model evidence-based talk.",
          notes: "Focus students on accountable talk stems.",
        });
      }
    }
    next = withDiscussion;
  }

  if (settings.moreWriting) {
    const withWriting: SlideDefinition[] = [];
    let questionCount = 0;
    for (const slide of next) {
      withWriting.push(slide);
      if (slide.type === "question") {
        questionCount += 1;
        if (questionCount % 2 === 0) {
          withWriting.push({
            type: "writing",
            stageType: "independent_transfer",
            heading: "Quick Write",
            subtext: "Write 2-3 sentences using claim, evidence, and reasoning.",
            section: "Writing Burst",
            durationSeconds: 90,
            teacherCue: "Ask students to underline evidence before sharing.",
            notes: "Collect one exemplar to project and discuss.",
          });
        }
      }
    }
    next = withWriting;
  }

  if (settings.interventionPace) {
    next = next.map((slide) => ({
      ...slide,
      durationSeconds: Math.max(30, Math.round((slide.durationSeconds || 90) * 0.8)),
      notes: `${slide.notes || ""} ${slide.notes ? "•" : ""} Intervention pace: fewer prompts, more checks for understanding.`.trim(),
    }));
  }

  if (settings.short30) {
    const total = next.reduce((sum, s) => sum + (s.durationSeconds || 90), 0);
    const scale = total > 0 ? 1800 / total : 1;
    next = next.map((slide) => ({
      ...slide,
      durationSeconds: Math.max(20, Math.round((slide.durationSeconds || 90) * scale)),
    }));
  }

  const toggled = applyTeacherToggles(next, settings);
  slides = buildSlidesFinal(normalizeSlides(validateDeck(toggled).map(sanitizeQuestionSlide)));
  if (currentIndex >= slides.length) currentIndex = Math.max(0, slides.length - 1);
}

async function logPresentationEvent(slideIndex: number, stageType?: SlideType) {
  if (!lessonIdGlobal) return;
  const token = getSavedToken();
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/lesson_presentations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        lesson_id: lessonIdGlobal,
        slide_index: slideIndex,
        timestamp: new Date().toISOString(),
        stage_type: stageType || null,
      }),
    });
  } catch (e) {
    console.warn("Skipping presentation save:", e);
  }
}

async function fetchLessonRow(lessonId: string, headers: Record<string, string>): Promise<LessonRow | null> {
  const selectAttempts = [
    "lesson_mode,canonical_skill,cognitive_verb,dok_target,grade,lesson_text",
    "lesson_mode,standard_label,canonical_skill,cognitive_verb,dok_target,staar_priority,skill_display_name,grade_level,grade,grade_band",
    "lesson_mode,standard_label,canonical_skill,cognitive_verb,dok_target",
    "lesson_mode,standard_label,canonical_skill,cognitive_verb",
    "lesson_mode,standard_label,canonical_skill",
    "lesson_mode,canonical_skill,cognitive_verb,dok_target,staar_priority,skill_display_name,grade_level,grade,grade_band,lesson_text",
    "lesson_mode,canonical_skill,cognitive_verb,dok_target,staar_priority,skill_display_name,grade_level,grade,grade_band",
    "lesson_mode,canonical_skill,cognitive_verb,dok_target",
    "lesson_mode,canonical_skill,cognitive_verb",
    "lesson_mode,canonical_skill",
  ];

  let lastErrorMessage = "";

  for (const select of selectAttempts) {

    const query = `select=${select}&id=eq.${encodeURIComponent(lessonId)}&limit=1`;
    const url = `${SUPABASE_URL}/rest/v1/lessons?${query}`;
    const res = await fetch(url, { headers });

    const body = await res.text();

    if (res.ok) {
      try {
        const rows = JSON.parse(body);
        if (Array.isArray(rows) && rows.length > 0) {
          return rows[0] as LessonRow;
        }
      } catch {
        throw new Error("Lesson JSON parse failed.");
      }
    }

    lastErrorMessage = `Failed to load slides (${res.status}): ${body.slice(0, 120)}`;

    if (isJwtExpiredError(res.status, body)) {
      throw new Error("SESSION_EXPIRED");
    }

    const isMissingColumn =
      res.status === 400 &&
      (body.includes("canonical_skill") ||
        body.includes("cognitive_verb") ||
        body.includes("dok_target") ||
        body.includes("staar_priority") ||
        body.includes("skill_display_name") ||
        body.includes("grade_level") ||
        body.includes("grade") ||
        body.includes("grade_band") ||
        body.includes("standard_label") ||
        body.includes("lesson_text"));

    if (!isMissingColumn) {
      throw new Error(lastErrorMessage);
    }

  }

  throw new Error(lastErrorMessage || "Failed to load slides.");
}
function buildGenerateLessonPayload(params: URLSearchParams): GenerateLessonPayload | null {
  const grade = String(params.get("grade") || "").trim();
  const subject = String(params.get("subject") || "").trim();
  const standard = String(params.get("standard") || "").trim();
  const curriculumUnit = String(params.get("curriculumUnit") || "").trim();
  const curriculumLesson = String(params.get("curriculumLesson") || "").trim();
  const skillFocus = String(params.get("skillFocus") || "").trim();

  if (!grade || !subject || !standard || !curriculumUnit || !curriculumLesson) {
    return null;
  }

  return {
    grade,
    subject,
    standard,
    curriculumUnit,
    curriculumLesson,
    skillFocus: skillFocus || undefined,
    stream: false,
  };
}

function coerceLessonRow(input: unknown): LessonRow | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const row: LessonRow = {
    lesson_mode: String(raw.lesson_mode || raw.lessonMode || "generic") as LessonRow["lesson_mode"],
    standard_label: String(raw.standard_label || raw.standard || "").trim() || undefined,
    canonical_skill: String(raw.canonical_skill || raw.canonicalSkill || raw.skill || raw.skillFocus || "").trim() || undefined,
    cognitive_verb: String(raw.cognitive_verb || raw.cognitiveVerb || raw.verb || "").trim() || undefined,
    dok_target: String(raw.dok_target || raw.dok || "").trim() || undefined,
    staar_priority: String(raw.staar_priority || raw.priority || "").trim() || undefined,
    skill_display_name: String(raw.skill_display_name || raw.skillDisplayName || raw.skillFocus || "").trim() || undefined,
    grade_level: (raw.grade_level ?? raw.gradeLevel ?? raw.grade ?? undefined) as LessonRow["grade_level"],
    grade: (raw.grade ?? raw.grade_level ?? undefined) as LessonRow["grade"],
    grade_band: String(raw.grade_band || raw.gradeBand || "").trim() || undefined,
  };
  if (!row.standard_label && !row.canonical_skill) return null;
  return row;
}

function getLessonId(): string {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("lessonId") || params.get("id") || "").trim();
}

async function loadLesson(lessonId: string): Promise<LessonRow | null> {
  if (!lessonId) return null;

  const token = getSavedToken();
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const lesson = await fetchLessonRow(lessonId, headers);
  if (lesson) {
    localStorage.setItem("lr_current_lesson", JSON.stringify(lesson));
  }
  return lesson;
}

async function fetchGeneratedLessonRow(payload: GenerateLessonPayload, headers: Record<string, string>): Promise<LessonRow | null> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-lesson`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse<Record<string, unknown>>(res, "Failed to generate lesson from function");
  const direct = coerceLessonRow(data);
  if (direct) return direct;
  const nested = coerceLessonRow((data.lesson || data.data || null) as unknown);
  return nested;
}

async function loadSlides(incomingSlides: any[] = []) {
  const params = new URLSearchParams(window.location.search);
  const lessonId = getLessonId();
  lessonIdGlobal = lessonId;

  if (incomingSlides.length > 0) {
    baseSlides = incomingSlides.map(cloneSlide);
    slides = incomingSlides;
    if (!lessonIdGlobal) {
      lessonIdGlobal = "local_storage_lesson";
    }
    normalizeSlidesForSettings();
    currentIndex = 0;
    return;
  }

  let row: LessonRow | null = getSavedLessonSafe() as LessonRow | null;

  const token = getSavedToken();
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let lessonLookupError = "";
  if (lessonId && prefetchedLessonRow) {
    row = prefetchedLessonRow;
  } else if (lessonId) {
    try {
      row = await fetchLessonRow(lessonId, headers);
      if (row) {
        localStorage.setItem("lr_current_lesson", JSON.stringify(row));
      }
    } catch (e: any) {
      lessonLookupError = String(e?.message || e || "");
      if (lessonLookupError === "SESSION_EXPIRED") {
        const refreshedToken = await refreshTokenIfPossible();
        if (refreshedToken) {
          headers.Authorization = `Bearer ${refreshedToken}`;
          row = await fetchLessonRow(lessonId, headers);
          if (row) {
            localStorage.setItem("lr_current_lesson", JSON.stringify(row));
          }
          lessonLookupError = "";
        } else {
          setSavedSession(null);
          throw new Error("Session expired. Please return to the main page, sign in again, and reopen Present mode.");
        }
      }
    }
  }

  if (!row) {
    assertSupabaseConfigured();
    const payload = buildGenerateLessonPayload(params);
    if (!payload) {
      const fallbackHint = lessonLookupError ? ` Lesson lookup failed: ${lessonLookupError}` : "";
      throw new Error(`Missing lesson id and generate-lesson params (grade, subject, standard, curriculumUnit, curriculumLesson).${fallbackHint}`);
    }
    row = await fetchGeneratedLessonRow(payload, headers);
    if (!row) {
      throw new Error("generate-lesson returned no lesson metadata.");
    }
    if (!lessonIdGlobal) {
      lessonIdGlobal = `generated_${Date.now()}`;
    }
  }

  const standardLabel = String(row.standard_label || "").trim();
  currentStandard = standardLabel;
  if (standardLabel && /selected\s+standard/i.test(standardLabel)) {
    throw new Error("Standard label missing.");
  }

  const skillType = (row.canonical_skill || "generic") as SkillType;

  const canonicalSkillRaw = String(row.canonical_skill);
  const verb = String(row.cognitive_verb || "");
  currentVerb = verb;
  const dok = String(row.dok_target || "");
  const priority = String(row.staar_priority || "Process");
  const tekDescription = String(row.skill_display_name || canonicalSkillRaw);
  currentDok = dok;
  currentPriority = priority;
  currentTek = tekDescription;
  const grade = normalizeGrade(row.grade_level ?? row.grade ?? row.grade_band);
  currentSkillType = skillType;
  applyPresentationTheme();

  const selectedMode = String(params.get("instruction_mode") || "core").toLowerCase();
  const skillPlaybook = await fetchSkillPlaybook(skillType, headers);
  const instructionMode = await fetchInstructionMode(selectedMode, headers);
  const gradeBand = resolveGradeBand(grade);
  const scaling = (skillPlaybook.complexity_notes && skillPlaybook.complexity_notes[gradeBand]) || {};
  const executionConfig = buildExecutionConfig(
    (skillBuilders[skillType] || skillBuilders.generic)(),
    skillPlaybook,
    scaling,
    instructionMode,
  );
  currentExecutionConfig = executionConfig;
  renderSkillPanel();
  renderAlignmentProof(row);

  baseSlides = buildSkillLockedDeck(
    skillType,
    tekDescription,
    dok,
    grade,
    verb,
    priority,
    executionConfig,
  ).map(cloneSlide);

  baseSlides = enforceSkillLock(baseSlides, skillType);
  baseSlides.unshift(buildBrandedSplashSlide(
    tekDescription,
    grade,
    priority,
    dok,
  ));

  if (row.lesson_text) {
    const parsedLesson = parseLessonTextBlocks(row.lesson_text);
    baseSlides = applyLessonTextToDeck(baseSlides, row.lesson_text);

    if (parsedLesson.questions.length > 0) {
      const validQuestions = parsedLesson.questions
        .map((question) => {
          if (question.question) {
            return {
              question: question.question,
              choices: question.choices || [],
              correctIndex: question.correctIndex,
              prompt: parsedLesson.passage,
            };
          }

          const parsedQuestion = parseQuestionBlock(question.raw);
          return {
            question: parsedQuestion.question,
            choices: parsedQuestion.choices,
            correctIndex: Number.isInteger(question.correctIndex) ? Number(question.correctIndex) : 0,
            prompt: parsedLesson.passage,
          };
        })
        .filter(isValidQuestion);

      const questionSlides = validQuestions.slice(0, 2).map(buildQuestionSlide);
      baseSlides.splice(2, 0, ...questionSlides);
    }
  }

  const assessmentExists = baseSlides.some((slide) => slide.type === "question");
  if (!assessmentExists) {
    const mc = generateSkillAlignedMCQ(skillType);
    const insertIndex = resolveAssessmentInsertIndex(baseSlides);

    baseSlides.splice(insertIndex, 0, {
      type: "question",
      stageType: "guided_dok_ladder",
      heading: "Check for Understanding",
      question: mc.question,
      answerChoices: mc.answerChoices,
      correctIndex: mc.correctIndex,
      section: "Assessment",
      durationSeconds: 150,
    });
  }

  baseSlides = buildSlidesFinal(baseSlides);
  normalizeSlidesForSettings();
  slides = baseSlides;
  currentIndex = 0;
  console.log("✅ Playbook-driven slides:", slides);
  console.log("🎯 FINAL SLIDES:", slides.map((s) => s.stageType));
  return;
}
function buildBrandedSplashSlide(
  tekDescription: string,
  grade: number,
  priority: string,
  dok: string
): SlideDefinition {

  const gradeLabel = Number.isFinite(grade) ? `Grade ${grade}` : "All Grades";
  const priorityLabel = priority ? `${priority} Standard` : "Priority Standard";
  const dokRaw = String(dok || "").trim();
  const dokLabel = dokRaw
    ? dokRaw.toLowerCase().includes("dok")
      ? dokRaw.toUpperCase()
      : `DOK ${dokRaw}`
    : "DOK aligned";

  return {
    type: "splash",
    heading: "Lessons-Ready",
    subtext: tekDescription,
    section: "Launch",
    notes: `${gradeLabel} • ${priorityLabel} • ${dokLabel}`,
    durationSeconds: 20,
    teacherCue: "Open with objective confidence, then transition into TEKS focus.",
  };

}

function formatSeconds(sec: number) {
  const s = Math.max(0, sec);
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function startSlideTimer(seconds: number) {
  if (timerInterval) window.clearInterval(timerInterval);
  const timerEl = document.getElementById("live-timer");
  if (!timerEl) return;
  slideEndsAt = Date.now() + seconds * 1000;
  let autoAdvanced = false;

  const tick = () => {
    const remaining = Math.round((slideEndsAt - Date.now()) / 1000);
    timerEl.textContent = `Slide timer ${formatSeconds(remaining)}`;

    if (
      remaining <= 0 &&
      !autoAdvanced &&
      currentExecutionConfig?.autoAdvance &&
      currentIndex < slides.length - 1
    ) {
      autoAdvanced = true;
      currentIndex += 1;
      revealStep = 0;
      renderSlide();
    }
  };

  tick();
  timerInterval = window.setInterval(tick, 500);
}

function startTurnTalkCountdown(seconds = 30) {
  if (turnTalkInterval) window.clearInterval(turnTalkInterval);
  const turnEl = document.getElementById("turntalk-timer");
  if (!turnEl) return;
  let remaining = seconds;
  turnEl.textContent = `Turn & talk ${formatSeconds(remaining)}`;
  turnTalkInterval = window.setInterval(() => {
    remaining -= 1;
    turnEl.textContent = `Turn & talk ${formatSeconds(remaining)}`;
    if (remaining <= 0 && turnTalkInterval) {
      window.clearInterval(turnTalkInterval);
      turnTalkInterval = null;
      turnEl.textContent = "Turn & talk complete";
    }
  }, 1000);
}

function currentQuestionId() {
  return `slide${currentIndex + 1}`;
}

function stopLiveResultsPolling() {
  if (liveResultsPoll) {
    window.clearInterval(liveResultsPoll);
    liveResultsPoll = null;
  }
}

function beginLiveResultsPolling() {
  stopLiveResultsPolling();
  liveResultsPoll = window.setInterval(() => {
    refreshLiveResults().catch(() => {});
  }, 3000);
}

function closeLiveRealtime() {
  if (liveRealtimeHeartbeat) {
    window.clearInterval(liveRealtimeHeartbeat);
    liveRealtimeHeartbeat = null;
  }
  if (liveRealtimeSocket) {
    liveRealtimeSocket.close();
    liveRealtimeSocket = null;
  }
}

function realtimeWebsocketUrl() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return "";
  const wsBase = SUPABASE_URL.replace(/^http/i, "ws");
  return `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=1.0.0`;
}

function subscribeLiveResponsesRealtime() {
  closeLiveRealtime();
  stopLiveResultsPolling();

  const wsUrl = realtimeWebsocketUrl();
  if (!wsUrl || !liveSessionId) {
    beginLiveResultsPolling();
    return;
  }

  const socket = new WebSocket(wsUrl);
  liveRealtimeSocket = socket;

  socket.addEventListener("open", () => {
    const joinMsg = {
      topic: "realtime:public:responses",
      event: "phx_join",
      payload: {
        config: {
          broadcast: { self: false },
          presence: { key: "" },
          postgres_changes: [
            {
              event: "INSERT",
              schema: "public",
              table: "responses",
            },
          ],
        },
      },
      ref: String(liveRealtimeRef++),
    };
    socket.send(JSON.stringify(joinMsg));

    liveRealtimeHeartbeat = window.setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          topic: "phoenix",
          event: "heartbeat",
          payload: {},
          ref: String(liveRealtimeRef++),
        }),
      );
    }, 25000);
  });

  socket.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data) as {
        event?: string;
        payload?: {
          eventType?: string;
          new?: { session_id?: string; question_id?: string };
          data?: { eventType?: string; new?: { session_id?: string; question_id?: string } };
        };
      };

      if (msg.event !== "postgres_changes") return;
      const payload = msg.payload || {};
      const row = payload.new || payload.data?.new;
      const eventType = payload.eventType || payload.data?.eventType;
      if (eventType !== "INSERT") return;
      if (!row || row.session_id !== liveSessionId) return;

      if (row.question_id === currentQuestionId()) {
        refreshLiveResults().catch(() => {});
      }
    } catch {
      // ignore malformed realtime payloads
    }
  });

  socket.addEventListener("close", () => {
    closeLiveRealtime();
    beginLiveResultsPolling();
  });

  socket.addEventListener("error", () => {
    closeLiveRealtime();
    beginLiveResultsPolling();
  });
}

function getCorrectPercentFromSnapshot(snapshot?: LiveResultsSnapshot): number {
  const slide = slides[currentIndex];
  if (!snapshot || !slide || slide.type !== "question" || !Array.isArray(snapshot.counts)) return 0;
  if (!Number.isInteger(slide.correctIndex) || slide.correctIndex! < 0 || slide.correctIndex! >= snapshot.counts.length) return 0;
  if (!snapshot.answeredCount) return 0;
  return snapshot.counts[slide.correctIndex as number] / snapshot.answeredCount;
}

function launchAutoReteach() {
  const slide = slides[currentIndex];
  if (!slide || slide.type !== "question") return;

  const nextSlide = slides[currentIndex + 1];
  if (nextSlide?.section === "Auto Reteach") {
    currentIndex += 1;
    revealStep = 0;
    renderSlide();
    return;
  }

  const choices = Array.isArray(slide.answerChoices) ? slide.answerChoices : [];
  const correctIndex = Number.isInteger(slide.correctIndex) ? Number(slide.correctIndex) : -1;
  const correctLetter = correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : "the correct";
  const correctText = correctIndex >= 0 && choices[correctIndex] ? ` (${choices[correctIndex]})` : "";

  const reteachSlides: SlideDefinition[] = [
    {
      type: "headline",
      stageType: "guided_dok_ladder",
      heading: "Auto Reteach Triggered",
      subtext: `Less than ${Math.round(AUTO_RETEACH_THRESHOLD * 100)}% correct. Re-model why ${correctLetter}${correctText} is strongest before retrying.`,
      section: "Auto Reteach",
      durationSeconds: 90,
      teacherCue: "Name the misconception, model elimination, then have students justify the evidence.",
    },
    {
      type: "discussion",
      stageType: "guided_dok_ladder",
      heading: "Reteach Partner Talk",
      prompt: "With a partner, explain why one option is strongest and one distractor is weakest.",
      section: "Auto Reteach",
      durationSeconds: 60,
      teacherCue: "Cold-call a pair to defend their reasoning with evidence.",
    },
    {
      type: "question",
      stageType: "guided_dok_ladder",
      heading: "Try Again",
      question: slide.question,
      prompt: slide.prompt,
      answerChoices: slide.answerChoices,
      correctIndex: slide.correctIndex,
      distractorRationale: slide.distractorRationale,
      section: "Auto Reteach",
      durationSeconds: 120,
      teacherCue: "Require students to restate why the best answer is strongest.",
    },
  ];

  slides.splice(currentIndex + 1, 0, ...reteachSlides);
  currentIndex += 1;
  revealStep = 0;
  renderSlide();
}

function setDockPanelContent(responsesHtml: string, reteachHtml: string) {
  const responsesPanel = document.getElementById("responses-panel");
  const reteachPanel = document.getElementById("reteach-panel");
  if (responsesPanel) responsesPanel.innerHTML = responsesHtml;
  if (reteachPanel) reteachPanel.innerHTML = reteachHtml;
}

function refreshDockVisibility() {
  const dock = document.getElementById("dock-panel");
  if (!dock) return;

  const map: Record<string, string> = {
    responses: "responses-panel",
    reteach: "reteach-panel",
    notes: "dock-notes-panel",
  };

  document.querySelectorAll("#dock-panel .panel").forEach((node) => node.classList.remove("active"));
  const target = document.getElementById(map[activeDockPanel]);
  if (target) target.classList.add("active");
}

function renderLiveSessionPanel(message?: string, snapshot?: LiveResultsSnapshot) {
  const statusEl = document.getElementById("live-session-status");
  const resultsEl = document.getElementById("live-session-results");
  if (!statusEl || !resultsEl) return;

  if (!liveSessionId || !liveJoinCode) {
    statusEl.textContent = "Not started";
    resultsEl.textContent = "";
    setDockPanelContent("<div>Start a live session to view responses.</div>", "<div>Reteach suggestions appear here after responses.</div>");
    refreshDockVisibility();
    return;
  }

  const questionId = currentQuestionId();
  const joinUrl = `${LIVE_JOIN_BASE}?code=${encodeURIComponent(liveJoinCode)}`;
  statusEl.innerHTML = `Join Code: <b>${escHtml(liveJoinCode)}</b><br/>Go to: ${escHtml(joinUrl)}<br/>Current Question: ${escHtml(questionId)}`;

  if (message) {
    resultsEl.textContent = message;
    setDockPanelContent(`<div>${escHtml(message)}</div>`, `<div>${escHtml(message)}</div>`);
    refreshDockVisibility();
    return;
  }

  const counts = snapshot?.counts || [0, 0, 0, 0];
  const answeredCount = snapshot?.answeredCount || 0;
  const studentCount = snapshot?.studentCount || 0;
  const studentNames = snapshot?.studentNames || [];
  const letters = ["A", "B", "C", "D"];
  const total = Math.max(1, answeredCount);

  const rows = counts.map((count, i) => {
    const pct = answeredCount ? Math.round((count / total) * 100) : 0;
    const bars = "█".repeat(Math.max(0, Math.round((pct / 100) * 16)));
    return `<div>${letters[i]} ${escHtml(bars || "░")} ${pct}% (${count})</div>`;
  });

  const progressLine = studentCount > 0
    ? `<div><b>${answeredCount}</b> / <b>${studentCount}</b> students answered</div>`
    : `<div><b>${answeredCount}</b> responses submitted</div>`;

  const correctPct = getCorrectPercentFromSnapshot(snapshot);
  const showReteach = slides[currentIndex]?.type === "question" && answeredCount > 0 && correctPct < AUTO_RETEACH_THRESHOLD;
  const reteachBanner = showReteach
    ? `<div style="margin-top:8px; color:#fbbf24;"><b>⚠ Only ${Math.round(correctPct * 100)}% correct</b><br/>Suggested move: run the reteach slide.</div><button class="reteachButton btn-launch-reteach" data-action="launch-reteach" type="button">▶ Launch Reteach</button>`
    : "";

  const joinedNames = studentNames.length
    ? `<div style="margin-top:8px;"><b>Students Joined</b></div>${studentNames.map((name) => `<div>${escHtml(name)}</div>`).join("")}`
    : "";

  const responsesHtml = `<div><b>Live Results</b></div>${progressLine}${rows.join("")}${joinedNames}`;
  const reteachHtml = `${reteachBanner || "<div><b>Reteach</b><br/>No reteach trigger right now. Keep monitoring accuracy.</div>"}`;
  resultsEl.innerHTML = responsesHtml + reteachBanner;
  setDockPanelContent(responsesHtml, `<div><b>Reteach</b></div>${reteachHtml}`);
  refreshDockVisibility();
}

function renderLiveQuestionResults(snapshot?: LiveResultsSnapshot) {
  const host = document.getElementById("live-question-results");
  const slide = slides[currentIndex];
  if (!host || !slide || slide.type !== "question") return;

  if (!liveSessionId) {
    host.innerHTML = "";
    return;
  }

  const counts = snapshot?.counts || [0, 0, 0, 0];
  const answeredCount = snapshot?.answeredCount || 0;
  const choices = Array.isArray(slide.answerChoices) ? slide.answerChoices : ["A", "B", "C", "D"];
  const letters = ["A", "B", "C", "D"];
  const total = Math.max(1, answeredCount);

  const rows = letters
    .map((letter, i) => {
      if (i >= choices.length) return "";
      const pct = answeredCount ? Math.round((counts[i] / total) * 100) : 0;
      return `<div>${letter}: ${"█".repeat(Math.max(1, Math.round((pct / 100) * 10)))} ${pct}%</div>`;
    })
    .filter(Boolean)
    .join("");

  host.innerHTML = `<div class="notesTitle" style="margin-top:10px;">Live Student Results</div>${rows || "<div>No responses yet.</div>"}`;
}

async function getLiveResults(questionId: string): Promise<LiveResultsSnapshot> {
  if (!liveSessionId) return { counts: [0, 0, 0, 0], answeredCount: 0, studentCount: 0, studentNames: [] };

  const headers = buildSupabaseHeaders(false);
  const responsesQuery = `select=answer_index&session_id=eq.${encodeURIComponent(liveSessionId)}&question_id=eq.${encodeURIComponent(questionId)}`;
  const studentsQuery = `select=id,student_name&session_id=eq.${encodeURIComponent(liveSessionId)}`;

  const [responsesRes, studentsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/responses?${responsesQuery}`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/session_students?${studentsQuery}`, { headers }),
  ]);

  if (!responsesRes.ok) {
    throw new Error(`Unable to load responses (${responsesRes.status})`);
  }
  if (!studentsRes.ok) {
    throw new Error(`Unable to load students (${studentsRes.status})`);
  }

  const responseRows = await parseJsonResponse<ResponseRow[]>(responsesRes, "Failed to load live responses");
  const studentRows = await parseJsonResponse<SessionStudentRow[]>(studentsRes, "Failed to load session students");
  const counts = [0, 0, 0, 0];
  for (const row of responseRows || []) {
    if (Number.isInteger(row.answer_index) && row.answer_index >= 0 && row.answer_index < counts.length) {
      counts[row.answer_index] += 1;
    }
  }

  return {
    counts,
    answeredCount: responseRows?.length || 0,
    studentCount: studentRows?.length || 0,
    studentNames: (studentRows || []).map((row) => String(row.student_name || "").trim()).filter(Boolean),
  };
}

async function refreshLiveResults() {
  if (!liveSessionId) {
    renderLiveSessionPanel();
    return;
  }

  try {
    const snapshot = await getLiveResults(currentQuestionId());
    latestLiveSnapshot = snapshot;
    renderLiveSessionPanel(undefined, snapshot);
    renderLiveQuestionResults(snapshot);
  } catch (e: any) {
    renderLiveSessionPanel(e?.message || "Unable to load live results.");
    renderLiveQuestionResults();
  }
}

async function startLiveSession() {
  if (!lessonIdGlobal) {
    window.alert("Lesson ID not loaded yet.");
    return;
  }

  const joinCode = Math.floor(100000 + Math.random() * 900000).toString();
  const headers = {
    ...buildSupabaseHeaders(true),
    Prefer: "return=representation",
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ lesson_id: lessonIdGlobal, join_code: joinCode }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Unable to start session (${res.status}): ${body.slice(0, 120)}`);
  }

  const rows = await parseJsonResponse<LiveSessionRow[]>(res, "Failed to start live session");
  const session = rows?.[0];
  if (!session?.id || !session.join_code) {
    throw new Error("Session created but response was incomplete.");
  }

  liveSessionId = session.id;
  liveJoinCode = session.join_code;
  renderLiveSessionPanel("Waiting for student responses...");
  subscribeLiveResponsesRealtime();
  await refreshLiveResults();
}

function alignmentChip(slide: SlideDefinition) {
  const section = String(slide.section || "").toLowerCase();
  if (section.includes("discussion")) return "Admin Look-For Covered: Student discourse";
  if (section.includes("objective")) return "Walkthrough alignment: TEKS objective visible";
  if (section.includes("writing") || section.includes("exit")) return "Admin Look-For Covered: Written evidence";
  return "Walkthrough alignment: Active monitoring + checks for understanding";
}



function renderAlignmentProof(lesson: LessonRow) {
  const panel = document.getElementById("alignment-proof-content");
  if (!panel) return;

  const standard = String(lesson.standard_label || currentStandard || "Not set");
  const canonicalSkill = String(lesson.canonical_skill || currentSkillType || "generic").replaceAll("_", " ");
  const dok = String(lesson.dok_target || currentDok || "DOK set");

  panel.innerHTML = `
    <p><b>Standard:</b> ${escHtml(standard)}</p>
    <table class="alignmentTable">
      <tr>
        <th>Lesson Component</th>
        <th>Alignment Explanation</th>
      </tr>
      <tr>
        <td>Objective</td>
        <td>Targets ${escHtml(canonicalSkill)}</td>
      </tr>
      <tr>
        <td>CFU Ladder</td>
        <td>Progresses from DOK 1 → ${escHtml(dok)}</td>
      </tr>
      <tr>
        <td>Writing Task</td>
        <td>Requires evidence and reasoning aligned to the standard</td>
      </tr>
      <tr>
        <td>Exit Ticket</td>
        <td>STAAR-style constructed response</td>
      </tr>
    </table>
  `;
}

function renderSkillPanel() {
  const panel = document.getElementById("skill-panel-content");
  if (!panel) return;

  panel.innerHTML = `
    <p><b>Standard:</b> ${escHtml(currentStandard || "Not set")}</p>
    <p><b>Skill:</b> ${escHtml((currentSkillType || "generic").replaceAll("_", " "))}</p>
    <p><b>Cognitive Verb:</b> ${escHtml(currentVerb || "Not set")}</p>
    <p><b>Depth of Knowledge:</b> ${escHtml(currentDok || "Not set")}</p>
  `;
}



function updateSlideThumbnails() {
  const el = document.getElementById("slide-thumbnails");
  if (!el) return;

  el.innerHTML = slides
    .map((slide, i) => {
      const label = stageLabels[slide.stageType || ""] || slide.section || slide.heading || `Slide ${i + 1}`;
      const active = i === currentIndex ? " is-active" : "";
      return `<button type="button" class="thumbItem${active}" data-slide-index="${i}">${i + 1} ${escHtml(label)}</button>`;
    })
    .join("");
}

function updateNextSlidePreview() {
  const el = document.getElementById("next-slide-content");
  if (!el) return;

  const next = slides[currentIndex + 1];
  if (!next) {
    el.innerHTML = `<div class="nextPreviewEmpty">No next slide (end of lesson).</div>`;
    return;
  }

  const phase = stageLabels[next.stageType || ""] || String(next.section || "Upcoming");
  const title = next.heading || "Upcoming Slide";
  const summary = next.question || next.prompt || next.subtext || "Get ready for the next phase.";

  el.innerHTML = `
    <div class="nextPreviewPhase">${escHtml(phase)}</div>
    <div class="nextPreviewTitle">${escHtml(title)}</div>
    <div class="nextPreviewText">${escHtml(summary)}</div>
  `;
}

function updateMasteryTracker(stageType?: SlideType) {
  const tracker = document.getElementById("tracker-content");
  if (!tracker) return;

  const key = String(stageType || "");
  const signals = stageSignals[key] || [];
  const dokCoverage = currentDok ? "✓" : "–";
  const rigorScore = Math.min(100, Math.round(
    (masteryTracker.writingMoments * 15) +
      (masteryTracker.turnTalkMoments * 12) +
      (masteryTracker.evidencePrompts * 18) +
      (masteryTracker.guidedQuestions * 10),
  ));
  const engagementScore =
    masteryTracker.writingMoments + masteryTracker.turnTalkMoments + masteryTracker.evidencePrompts + masteryTracker.guidedQuestions;
  const engagementMeter = engagementScore >= 8 ? "🟢 High" : engagementScore >= 4 ? "🟡 Moderate" : "🔴 Low";

  tracker.innerHTML = `
    <div>Guided Questions: ${masteryTracker.guidedQuestions}</div>
    <div>Turn & Talks: ${masteryTracker.turnTalkMoments}</div>
    <div>Writing Moments: ${masteryTracker.writingMoments}</div>
    <div>Evidence Prompts: ${masteryTracker.evidencePrompts}</div>
    <div>DOK Level Target: ${escHtml(currentDok || "DOK set")}</div>
    <div class="trackerScore">Lesson Rigor Score: ${rigorScore}</div>
    <div>DOK Coverage: ${dokCoverage}</div>
    <div>Writing Opportunities: ${masteryTracker.writingMoments}</div>
    <div>Discussion Opportunities: ${masteryTracker.turnTalkMoments}</div>
    <div>Evidence Prompts: ${masteryTracker.evidencePrompts}</div>
    <div class="trackerScore">Engagement Meter: ${engagementMeter}</div>
    <div class="trackerTitle" style="margin-top:6px;">TTESS Evidence</div>
    <div>✓ Academic discourse</div>
    <div>✓ Evidence-based reasoning</div>
    <div>✓ Student writing</div>
    ${signals.map((signal) => `<div>✓ ${escHtml(signal)}</div>`).join("")}
    <div class="confidenceFooter">Stage Focus: ${escHtml(stageConfidence[key] || "")}</div>
  `;
}

function stageClass(stageType?: SlideType): string {
  return stageType ? ` stage--${stageType}` : "";
}

const stageLabels: Record<string, string> = {
  objective_lock: "🎯 Objective",
  verb_definition: "🧠 Skill",
  strategy_formula: "🛠 Strategy",
  model_think_aloud: "👀 I Do",
  guided_dok_ladder: "🤝 We Do",
  compare_defend: "⚖️ Debate",
  independent_transfer: "✍️ You Do",
  exit_ticket: "🚪 Exit Ticket",
};

function stageBadge(stageType?: SlideType): string {
  if (!stageType) return "";
  return `<div class="stageBadge stage-chip">${escHtml(stageLabels[stageType] || "")}</div>`;
}

function getLayoutClass(stageType: string): string {
  const stageLayouts: Record<string, string> = {
    objective_lock: "layout-center",
    verb_definition: "layout-vocab",
    strategy_formula: "layout-center",
    model_think_aloud: "layout-story",
    guided_dok_ladder: "layout-question",
    compare_defend: "layout-debate",
    independent_transfer: "layout-writing",
    exit_ticket: "layout-exit",
  };
  return stageLayouts[stageType] || "layout-default";
}

function cleanText(text: string): string {
  return String(text || "")
    .replace(/_id:.*$/gm, "")
    .replace(/correctIndex:.*$/gm, "")
    .replace(/STAGE:.*$/gm, "")
    .replace(/TEACHER CUE:.*$/gm, "")
    .replace(/choices:/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanItems(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => cleanText(String(item || ""))).filter(Boolean);
}

function limitText(text: string, maxLength = 220): string {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function splitContent(text: string): string[] {
  const cleaned = cleanText(text);
  if (!cleaned) return [];
  const chunks = cleaned.match(/.{1,220}(\s|$)/g) || [];
  return chunks.map((t) => t.trim()).filter(Boolean);
}

function cleanHeading(text: string): string {
  return String(text || "").replace(/Practice Question/gi, "").trim();
}

function limitItems(items: string[], max = 4): string[] {
  return items.slice(0, max);
}

function renderMultipleChoice(
  slide: SlideDefinition,
  extraClass: string,
  layoutClass: string,
  stage: string,
  coachingTag: string,
  coachLine: string,
  alignment: string,
): string {
  const choicesRaw = Array.isArray(slide.answerChoices)
    ? slide.answerChoices
    : Array.isArray((slide as any).choices)
      ? ((slide as any).choices as string[])
      : [];
  const choicesClean = cleanItems(choicesRaw);
  const choices = choicesClean.length
    ? `<ul class="mcChoices answers fade-in" style="animation-delay:0.25s">${choicesClean
        .map((c, i) => `<li class="mcChoice answer${i === slide.correctIndex ? " mcChoice--correct correct" : ""}"><span class="choiceLetter">${String.fromCharCode(65 + i)}.</span> ${escHtml(c)}</li>`)
        .join("")}</ul>`
    : "";

  const rationale =
    revealStep > 0 && slide.distractorRationale
      ? `<div class="whyWinsTitle fade-in" style="animation-delay:0.3s">Why This Answer Wins</div><div class="rationaleGrid fade-in" style="animation-delay:0.35s">${slide.distractorRationale
          .map((r, i) => `<div class="rationaleCard${i === slide.correctIndex ? " rationaleCard--correct" : ""}"><strong>${String.fromCharCode(65 + i)}</strong> ${escHtml(cleanText(r))}</div>`)
          .join("")}</div>`
      : "";

  return `
    <div class="slide slide-content ${layoutClass} slide--question${extraClass}">
      <div class="question-container">
        ${stage}${coachingTag}<h2 class="question-text fade-in" style="animation-delay:0.05s">${escHtml(limitText(cleanText(String(slide.question || "")), 260))}</h2>
        <p class="slideSubtext fade-in" style="animation-delay:0.15s">${escHtml(limitText(cleanText(String(slide.prompt || "")), 220))}</p>
        ${choices}
        <div id="live-question-results" class="liveQuestionResults"></div>
        ${rationale}
        ${coachLine}${alignment}
      </div>
    </div>
  `;
}

function adjustSlideText() {
  const slide = document.querySelector(".slide-content") as HTMLElement | null;
  if (!slide) return;

  let fontSize = 48;
  slide.style.fontSize = `${fontSize}px`;

  while (slide.scrollHeight > slide.clientHeight && fontSize > 24) {
    fontSize -= 2;
    slide.style.fontSize = `${fontSize}px`;
  }
}

function preferredStageDuration(stageType?: SlideType): number {
  if (stageType === "objective_lock") return 90;
  if (stageType === "verb_definition") return 75;
  if (stageType === "strategy_formula") return 120;
  if (stageType === "model_think_aloud") return 110;
  if (stageType === "guided_dok_ladder") return 180;
  if (stageType === "compare_defend") return 120;
  if (stageType === "independent_transfer") return 180;
  if (stageType === "exit_ticket") return 120;
  return 90;
}

function buildRenderedSlideHtml(
  slide: SlideDefinition,
  layoutClass: string,
  extraClass: string,
  stage: string,
  coachingTag: string,
  coachLine: string,
  alignment: string,
): string {
  if (slide.stageType === "model_think_aloud") {
    const modelSource = [
      cleanHeading(String(slide.heading || "")),
      String(slide.subtext || ""),
      String(slide.prompt || ""),
      String(slide.question || ""),
      cleanItems(slide.items || []).join(" "),
      String(slide.notes || ""),
    ]
      .filter(Boolean)
      .join(" ");
    const parts = splitContent(modelSource).slice(0, 3);
    const content = parts.length ? parts : ["Model the reasoning in short, explicit steps and narrate evidence use."];
    return `
      <div class="slide slide-content ${layoutClass} slide--headline${extraClass}">
        ${stage}${coachingTag}
        ${content
          .map(
            (part, i) => `<div class="sectionTag fade-in" style="animation-delay:${0.08 + i * 0.08}s">Model (${i + 1}/${content.length})</div><div class="story-text fade-in" style="animation-delay:${0.14 + i * 0.08}s">${escHtml(limitText(part, 220))}</div>`,
          )
          .join("")}
        ${coachLine}${alignment}
      </div>
    `;
  }

  if (slide.type === "splash") {
    return `
      <div class="slide slide-content ${layoutClass} slide--splash${extraClass}">
        <div class="brandMark">LR</div>
        <div class="brandKicker">Instruction Launch</div>
        <h1 class="fade-in" style="animation-delay:0.05s">${escHtml(limitText(cleanText(String(slide.heading || "Lessons-Ready")), 80))}</h1>
        <p class="splashSubtext fade-in" style="animation-delay:0.15s">${escHtml(limitText(cleanText(String(slide.subtext || "")), 220))}</p>
        <div class="splashMeta fade-in" style="animation-delay:0.25s">${escHtml(limitText(cleanText(String(slide.notes || "")), 180))}</div>
      </div>
    `;
  }

  if (slide.type === "headline") {
    const headlineBody =
      slide.stageType === "verb_definition"
        ? `<div class="vocab-box interactive fade-in" style="animation-delay:0.05s"><h2>${escHtml(cleanHeading(limitText(cleanText(String(slide.heading || "")), 90)) || "Skill Focus")}</h2><p>${escHtml(limitText(cleanText(String(slide.subtext || "")), 240))}</p></div><div class="vocab-box interactive fade-in" style="animation-delay:0.15s"><h2>Student-Friendly Move</h2><p>Say the verb in your own words, then name the evidence you need.</p></div>`
        : `<div class="sectionTag fade-in" style="animation-delay:0.05s">${escHtml(limitText(cleanText(String(slide.section || "")), 40))}</div><h1 class="fade-in" style="animation-delay:0.05s">${escHtml(cleanHeading(limitText(cleanText(String(slide.heading || "")), 90)) || "Lesson Focus")}</h1><p class="fade-in" style="animation-delay:0.15s">${escHtml(limitText(cleanText(String(slide.subtext || "")), 240))}</p>`;

    return `<div class="slide slide-content ${layoutClass} slide--headline${extraClass}">${stage}${coachingTag}${headlineBody}${coachLine}${alignment}</div>`;
  }

  if (slide.type === "split") {
    const items = limitItems(cleanItems(slide.items || []), 5);
    const visibleCount = revealStep > 0 ? Math.min(revealStep, items.length) : Math.min(1, items.length);
    return `
      <div class="slide slide-content ${layoutClass} slide--split${extraClass}">
        ${stage}${coachingTag}
        <h2 class="fade-in" style="animation-delay:0.05s">${escHtml(cleanHeading(limitText(cleanText(String(slide.heading || "")), 80)) || "Key Ideas")}</h2>
        <p class="slideSubtext fade-in" style="animation-delay:0.15s">${escHtml(limitText(cleanText(String(slide.subtext || "")), 220))}</p>
        <ul class="fade-in" style="animation-delay:0.25s">${items.slice(0, visibleCount).map((item) => `<li>${escHtml(limitText(item, 120))}</li>`).join("")}</ul>
        ${coachLine}${alignment}
      </div>
    `;
  }

  if (slide.type === "question") {
    return renderMultipleChoice(slide, extraClass, layoutClass, stage, coachingTag, coachLine, alignment);
  }

  if (slide.type === "writing") {
    const cerFrame = revealStep > 0 ? `<p class="cerFrame">CER: Claim → Evidence → Reasoning</p>` : "";
    const model =
      revealStep > 1
        ? `<p class="revealBlock">${escHtml(currentSkillType === "context_clues" ? "Model paragraph reveal: The word \"obscured\" means hidden because the nearby detail says thick fog blocked visibility." : "Model paragraph reveal: Explain your claim with direct evidence and reasoning from the text.")}</p>`
        : "";

    return `
      <div class="slide slide-content ${layoutClass} slide--writing${extraClass}">
        ${stage}${coachingTag}<h2 class="fade-in" style="animation-delay:0.05s">${escHtml(cleanHeading(limitText(cleanText(String(slide.heading || "")), 80)) || "Writing")}</h2>
        <div class="${slide.stageType === "exit_ticket" ? "question-box" : "writing-box"} interactive fade-in" style="animation-delay:0.15s">
          <p class="promptPrimary">${escHtml(limitText(cleanText(String(slide.subtext || "")), 240))}</p>
          <div class="cerScaffold"><div>Claim</div><div>Evidence</div><div>Reasoning</div></div>
          ${cerFrame}
          ${model}
        </div>
        ${coachLine}${alignment}
      </div>
    `;
  }

  if (slide.type === "energy") {
    const contrastClass = currentIndex % 4 === 0 ? " slide--contrast" : "";
    return `<div class="slide slide-content ${layoutClass} slide--energy${contrastClass}${extraClass}">${stage}${coachingTag}<h1 class="fade-in" style="animation-delay:0.05s">${escHtml(cleanHeading(limitText(cleanText(String(slide.heading || "")), 80)) || "Energy Break")}</h1><p class="fade-in" style="animation-delay:0.15s">${escHtml(limitText(cleanText(String(slide.subtext || "")), 200))}</p>${coachLine}${alignment}</div>`;
  }

  if (slide.type === "discussion") {
    const stem = revealStep > 0 ? `<p class="revealBlock">Sentence stem reveal: "I agree because the text says..."</p>` : "";
    const promptClean = escHtml(limitText(cleanText(String(slide.prompt || "Discuss with your partner.")), 220));
    const discussionBody =
      slide.stageType === "compare_defend"
        ? `<div class="debate-box interactive fade-in" style="animation-delay:0.15s"><h3>Option A</h3><p>${promptClean}</p></div><div class="debate-box interactive fade-in" style="animation-delay:0.25s"><h3>Option B</h3><p>Defend the stronger answer with evidence.</p></div>`
        : `<p class="promptPrimary fade-in" style="animation-delay:0.15s">${promptClean}</p>`;

    return `
      <div class="slide slide-content ${layoutClass} slide--discussion${extraClass}">
        ${stage}${coachingTag}<h2 class="fade-in" style="animation-delay:0.05s">${escHtml(cleanHeading(limitText(cleanText(String(slide.heading || "Discuss")), 80)) || "Discuss")}</h2>
        ${discussionBody}
        ${stem}
        ${coachLine}${alignment}
      </div>
    `;
  }

  return `<div class="slide slide-content ${layoutClass}${extraClass}">${stage}${coachingTag}<h2 class="fade-in" style="animation-delay:0.05s">${escHtml(cleanHeading(limitText(cleanText(String(slide.heading || "Slide")), 80)) || "Slide")}</h2>${coachLine}${alignment}</div>`;
}

function renderSlide() {
  const slide = slides[currentIndex];
  const container = slideContainerEl;
  if (!container) {
    console.error("❌ slide-container not found");
    return;
  }
  const counter = document.getElementById("slide-counter");
  const notesPanel = document.getElementById("teacher-notes");

  if (!slide) {
    container.innerHTML = `<div class="slide slide-content"><h2>No slide found</h2></div>`;
    if (counter) counter.textContent = "";
    if (notesPanel) notesPanel.innerHTML = "";
    return;
  }

  if (!countedSignalSlides.has(currentIndex)) {
    if (slide.type === "question") masteryTracker.guidedQuestions += 1;
    if (slide.type === "writing") masteryTracker.writingMoments += 1;
    if (slide.type === "discussion") masteryTracker.turnTalkMoments += 1;
    if (slide.teacherCue?.toLowerCase().includes("evidence")) masteryTracker.evidencePrompts += 1;
    countedSignalSlides.add(currentIndex);
  }

  updateMasteryTracker(slide.stageType);
  updatePhaseProgress(slide.stageType, slide.section);
  updateNextSlidePreview();
  updateSlideThumbnails();
  if (liveSessionId) {
    refreshLiveResults().catch(() => {});
  } else {
    renderLiveSessionPanel();
  }

  const coachLine = settings.showTeacherNotes && slide.teacherCue
    ? `<div class="coachLine">Coach: ${escHtml(cleanText(slide.teacherCue))}</div>`
    : "";
  const alignment = `<div class="alignmentChip">${escHtml(alignmentChip(slide))}</div>`;
  const stage = stageBadge(slide.stageType);
  const layoutClass = getLayoutClass(String(slide.stageType || ""));
  const coachingTag = String(slide.section || "").toLowerCase().includes("coaching") ? `<div class="coachingTag">Coaching Insight</div>` : "";
  const extraClass = `${stageClass(slide.stageType)}${String(slide.section || "").toLowerCase().includes("coaching") ? " slide--coaching" : ""}`;

  try {
  if (slide.type === "splash") {
    container.innerHTML = `
      <div class="slide slide-content slide--splash${extraClass}">
        <div class="brandMark">LR</div>
        <div class="brandKicker">Instruction Launch</div>
        <h1>${escHtml(slide.heading || "Lessons-Ready")}</h1>
        <p class="splashSubtext">${escHtml(slide.subtext || "")}</p>
        <div class="splashMeta">${escHtml(slide.notes || "")}</div>
      </div>
    `;
  } else if (slide.type === "headline") {
    container.innerHTML = `<div class="slide slide-content slide--headline${extraClass}">${stage}${coachingTag}<div class="sectionTag">${escHtml(slide.section || "")}</div><h1>${escHtml(slide.heading)}</h1><p>${escHtml(slide.subtext)}</p>${coachLine}${alignment}</div>`;
  } else if (slide.type === "split") {
    const items = slide.items || [];
    const visibleCount = revealStep > 0 ? Math.min(revealStep, items.length) : Math.min(1, items.length);
    container.innerHTML = `
      <div class="slide slide-content slide--split${extraClass}">
        ${stage}${coachingTag}
        <h2>${escHtml(slide.heading)}</h2>
        <p class="slideSubtext">${escHtml(slide.subtext)}</p>
        <ul>${items.slice(0, visibleCount).map((item) => `<li>${escHtml(item)}</li>`).join("")}</ul>
        ${coachLine}${alignment}
      </div>
    `;
  } else if (slide.type === "question") {
    const choices =
      slide.answerChoices && slide.answerChoices.length
        ? `<ul class="mcChoices">${slide.answerChoices
            .map((c, i) => `<li class="mcChoice${i === slide.correctIndex ? " mcChoice--correct correct" : ""}"><span class="choiceLetter">${String.fromCharCode(65 + i)}.</span> ${escHtml(c)}</li>`)
            .join("")}</ul>`
        : "";

    const rationale =
      revealStep > 0 && slide.distractorRationale
        ? `<div class="whyWinsTitle">Why This Answer Wins</div><div class="rationaleGrid">${slide.distractorRationale
            .map((r, i) => `<div class="rationaleCard${i === slide.correctIndex ? " rationaleCard--correct" : ""}"><strong>${String.fromCharCode(65 + i)}</strong> ${escHtml(r)}</div>`)
            .join("")}</div>`
        : "";

    container.innerHTML = `
      <div class="slide slide-content slide--question${extraClass}">
        <div class="question-container">
          ${stage}${coachingTag}<h2 class="question-text">${escHtml(slide.question)}</h2>
          <p class="slideSubtext">${escHtml(slide.prompt)}</p>
          ${choices}
          ${rationale}
          ${coachLine}${alignment}
        </div>
      </div>
    `;
  } else if (slide.type === "writing") {
    const cerFrame = revealStep > 0 ? `<p class="cerFrame">CER: Claim → Evidence → Reasoning</p>` : "";
    const model =
      revealStep > 1
        ? `<p class="revealBlock">${escHtml(currentSkillType === "context_clues" ? "Model paragraph reveal: The word \"obscured\" means hidden because the nearby detail says thick fog blocked visibility." : "Model paragraph reveal: Explain your claim with direct evidence and reasoning from the text.")}</p>`
        : "";
    container.innerHTML = `
      <div class="slide slide-content slide--writing${extraClass}">
        ${stage}${coachingTag}<h2>${escHtml(slide.heading)}</h2>
        <p class="promptPrimary">${escHtml(slide.subtext)}</p>
        <div class="cerScaffold"><div>Claim</div><div>Evidence</div><div>Reasoning</div></div>
        ${cerFrame}
        ${model}
        ${coachLine}${alignment}
      </div>
    `;
  } else if (slide.type === "energy") {
    const contrastClass = currentIndex % 4 === 0 ? " slide--contrast" : "";
    container.innerHTML = `<div class="slide slide-content slide--energy${contrastClass}${extraClass}">${stage}${coachingTag}<h1>${escHtml(slide.heading)}</h1><p>${escHtml(slide.subtext || "")}</p>${coachLine}${alignment}</div>`;
  } else if (slide.type === "discussion") {
    const stem = revealStep > 0 ? `<p class="revealBlock">Sentence stem reveal: "I agree because the text says..."</p>` : "";
    container.innerHTML = `
      <div class="slide slide-content slide--discussion${extraClass}">
        ${stage}${coachingTag}<h2>${escHtml(slide.heading || "Discuss")}</h2>
        <p class="promptPrimary">${escHtml(slide.prompt || "Discuss with your partner.")}</p>
        ${stem}
        ${coachLine}${alignment}
      </div>
    `;
  } else {
    container.innerHTML = `<div class="slide slide-content${extraClass}">${stage}${coachingTag}<h2>${escHtml(slide.heading || "Slide")}</h2>${coachLine}${alignment}</div>`;
  }

  } catch (e: any) {
    container.innerHTML = `<div class="slide slide-content"><h2>Slide render error</h2><p>${escHtml(e?.message || e)}</p></div>`;
  }

  const renderedSlide = container.querySelector(".slide") as HTMLElement | null;
  if (renderedSlide) {
    renderedSlide.classList.add("slide-enter");
    if ((slide.items || []).length >= 5) {
      renderedSlide.classList.add("dense");
    }
    requestAnimationFrame(() => {
      renderedSlide.classList.add("slide-enter-active");
    });
  }

  adjustSlideText();

  const section = slide.section ? ` • ${slide.section}` : "";
  const stageDuration = slide.durationSeconds || preferredStageDuration(slide.stageType);
  const timeCue = stageDuration ? ` • Suggested time: ${Math.max(1, Math.round(stageDuration / 60))} min` : "";
  const confidence = `<span class="confidenceFooter">${escHtml(currentTek || "TEKS set")} • ${escHtml(currentDok || "DOK set")} • ${escHtml(currentPriority || "Priority set")}</span>`;
  if (counter) counter.innerHTML = `Slide ${currentIndex + 1} of ${slides.length}${section}${timeCue} ${confidence}`;

  const progressFill = document.querySelector(".progressFill") as HTMLElement | null;
  if (progressFill) {
    const progress = slides.length ? ((currentIndex + 1) / slides.length) * 100 : 0;
    progressFill.style.width = `${progress}%`;
  }

  const noteText = slide.notes ? escHtml(slide.notes) : "No teacher notes for this slide.";
  const cueText = slide.teacherCue ? escHtml(slide.teacherCue) : "Use the prompt and circulate for evidence-based responses.";
  const notesHtml = `
    <div class="notesSection">
      <h3>🎯 Teacher Cue</h3>
      <div class="notesText">${cueText}</div>
    </div>
    <div class="notesSection">
      <h3>⚠️ Misconceptions</h3>
      <div class="notesText">Watch for unsupported claims, text evidence that does not match the claim, or summary without reasoning.</div>
    </div>
    <div class="notesSection">
      <h3>🛠 Reteach Plan</h3>
      <div class="notesText">${noteText}</div>
    </div>
  `;

  if (slide.stageType === "model_think_aloud") notesOpen = true;
  if (slide.stageType === "independent_transfer" || slide.stageType === "exit_ticket") notesOpen = false;
  localStorage.setItem(LS_PRESENT_NOTES_KEY, notesOpen ? "1" : "0");

  if (notesPanel) {
    const content = document.getElementById("teacher-notes-content") as HTMLElement | null;
    if (content) content.innerHTML = notesHtml;
    notesPanel.classList.toggle("is-open", notesOpen);
  }
  const dockNotesPanel = document.getElementById("dock-notes-panel");
  if (dockNotesPanel) dockNotesPanel.innerHTML = notesHtml;

  if (lessonIdGlobal) localStorage.setItem(resumeKey(lessonIdGlobal), String(currentIndex));
  startSlideTimer(slide.durationSeconds || preferredStageDuration(slide.stageType));
  if (slide.stageType) {
    logPresentationEvent(currentIndex, slide.stageType).catch(() => {});
  }
}

function downloadPresentPdf() {
  if (!slides.length) {
    window.alert("No slides available to export yet.");
    return;
  }

  const printWindow = window.open("about:blank", "_blank", "width=1200,height=900");
  if (!printWindow) {
    window.alert("Popup blocked. Please allow popups for this site to download the PDF.");
    return;
  }

  const blocks = slides
    .map((slide, idx) => {
      const heading = escHtml(slide.heading || `Slide ${idx + 1}`);
      const primary = escHtml(slide.question || slide.prompt || slide.subtext || "");
      const items =
        Array.isArray(slide.items) && slide.items.length
          ? `<ul>${slide.items.map((i) => `<li>${escHtml(i)}</li>`).join("")}</ul>`
          : "";
      const stage = slide.stageType ? `<div class="cue">Stage: ${escHtml(slide.stageType.replaceAll("_", " "))}</div>` : "";
      const cue = slide.teacherCue ? `<div class="cue">Teacher Cue: ${escHtml(slide.teacherCue)}</div>` : "";
      return `<section class="page"><h1>${heading}</h1><p>${primary}</p>${items}${stage}${cue}</section>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head><title>Present Mode Deck</title><style>
    @page { size: landscape; margin: 16mm; }
    body { font-family: Inter, Arial, sans-serif; margin:0; color:#111; }
    .page { page-break-after: always; min-height: 92vh; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; }
    .page:last-child { page-break-after: auto; }
    h1 { font-size: 44px; margin: 0 0 18px; }
    p { font-size: 28px; line-height: 1.35; margin: 0 0 14px; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { font-size: 24px; margin: 0 0 10px; padding-left: 12px; border-left: 4px solid #2563eb; }
    .cue { margin-top: 18px; font-size: 14px; color: #374151; text-transform: uppercase; letter-spacing: .04em; }
  </style></head><body>${blocks}</body></html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  if (printWindow.document.readyState === "complete") {
    setTimeout(triggerPrint, 150);
  } else {
    printWindow.addEventListener("load", () => setTimeout(triggerPrint, 150), { once: true });
  }
}

function bindControls() {
  const panelStates: Record<string, boolean> = {
    controls: true,
    "alignment-proof": true,
    "skill-panel": true,
    "mastery-tracker": true,
  };

  const refreshPanelVisibility = () => {
    Object.entries(panelStates).forEach(([id, isOpen]) => {
      const panel = document.getElementById(id);
      if (panel) panel.classList.toggle("is-open", isOpen);
    });
  };

  document.querySelectorAll("[data-panel-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = String((button as HTMLElement).dataset.panelTarget || "");
      if (!id || !(id in panelStates)) return;
      panelStates[id] = !panelStates[id];
      refreshPanelVisibility();
    });
  });
  refreshPanelVisibility();

  const bindToggle = (id: string, key: keyof PresentSettings) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.checked = settings[key];
    el.addEventListener("change", () => {
      settings[key] = el.checked;
      normalizeSlidesForSettings();
      revealStep = 0;
      renderSlide();
    });
  };

  bindToggle("toggle-discussion", "moreDiscussion");
  bindToggle("toggle-writing", "moreWriting");
  bindToggle("toggle-short30", "short30");
  bindToggle("toggle-intervention", "interventionPace");
  bindToggle("toggle-coaching", "coachingMode");
  bindToggle("toggle-include-model", "includeModel");
  bindToggle("toggle-include-compare", "includeCompareDefend");
  bindToggle("toggle-include-exit", "includeExitTicket");
  bindToggle("toggle-mini15", "mini15");
  bindToggle("toggle-rigor", "increaseRigor");
  bindToggle("toggle-teacher-notes", "showTeacherNotes");

  const themeSelect = document.getElementById("theme-select") as HTMLSelectElement | null;
  if (themeSelect) {
    themeSelect.value = settings.theme;
    themeSelect.addEventListener("change", () => {
      settings.theme = themeSelect.value as PresentSettings["theme"];
      normalizeSlidesForSettings();
      revealStep = 0;
      renderSlide();
    });
  }

  document.getElementById("btn-reveal")?.addEventListener("click", () => {
    revealStep += 1;
    renderSlide();
  });

  document.getElementById("btn-turntalk")?.addEventListener("click", () => startTurnTalkCountdown(30));

  const dockPanel = document.getElementById("dock-panel");
  const dockToggle = document.getElementById("dock-toggle");
  document.querySelectorAll("#dock-tabs [data-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = String((button as HTMLElement).dataset.panel || "responses") as "responses" | "reteach" | "notes";
      activeDockPanel = panel;
      if (dockPanel) dockPanel.classList.add("open");
      if (dockToggle) dockToggle.textContent = "▼ Hide Tools";
      refreshDockVisibility();
    });
  });
  dockToggle?.addEventListener("click", () => {
    if (!dockPanel) return;
    const isOpen = dockPanel.classList.toggle("open");
    dockToggle.textContent = isOpen ? "▼ Hide Tools" : "▲ Tools";
    if (isOpen) refreshDockVisibility();
  });
  const bindReteachClick = (containerId: string) => {
    document.getElementById(containerId)?.addEventListener("click", (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest("[data-action='launch-reteach']") as HTMLElement | null;
      if (!btn) return;
      launchAutoReteach();
    });
  };
  bindReteachClick("live-session-results");
  bindReteachClick("reteach-panel");
  document.getElementById("btn-start-session")?.addEventListener("click", async () => {
    try {
      await startLiveSession();
    } catch (e: any) {
      window.alert(e?.message || "Unable to start live session.");
    }
  });
  document.getElementById("btn-fullscreen")?.addEventListener("click", () =>
    document.documentElement.requestFullscreen().catch(() => {}),
  );
  document.getElementById("btn-download-pdf")?.addEventListener("click", downloadPresentPdf);

  document.getElementById("btn-coldcall")?.addEventListener("click", () => {
    const raw = window.prompt("Enter student names separated by commas:", "Ava, Mason, Sofia, Liam");
    if (!raw) return;
    const names = raw
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (!names.length) return;
    const picked = names[Math.floor(Math.random() * names.length)];
    const out = document.getElementById("coldcall-result");
    if (out) out.textContent = `Cold call: ${picked}`;
  });

  document.getElementById("slide-thumbnails")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const btn = target.closest("[data-slide-index]") as HTMLElement | null;
    if (!btn) return;
    const idx = Number(btn.dataset.slideIndex || "-1");
    if (Number.isNaN(idx) || idx < 0 || idx >= slides.length) return;
    currentIndex = idx;
    revealStep = 0;
    renderSlide();
  });

}

function bindKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.key === " ") {
      e.preventDefault();
    }

    if ((e.key === "ArrowRight" || e.key === " ") && currentIndex < slides.length - 1) {
      currentIndex += 1;
      revealStep = 0;
      renderSlide();
    }
    if (e.key === "ArrowLeft" && currentIndex > 0) {
      currentIndex -= 1;
      revealStep = 0;
      renderSlide();
    }
    if (e.key.toLowerCase() === "f") document.documentElement.requestFullscreen().catch(() => {});
    if (e.key.toLowerCase() === "n") {
      notesOpen = !notesOpen;
      localStorage.setItem(LS_PRESENT_NOTES_KEY, notesOpen ? "1" : "0");
      renderSlide();
    }
    if (e.key.toLowerCase() === "r") {
      revealStep += 1;
      renderSlide();
    }
    if (e.key.toLowerCase() === "t") startTurnTalkCountdown(30);
  });
}

async function boot() {
  console.log("🚀 boot starting");

  const lessonId = getLessonId();
  console.log("lessonId:", lessonId);

  const storedLesson = getSavedLessonSafe();

  if (!storedLesson && !lessonId) {
    const container = document.getElementById("slide-container");
    if (container) {
      container.innerHTML = `
        <div class="slide slide-content">
          <h2>No lesson found</h2>
          <p>Go generate a lesson first.</p>
        </div>
      `;
    }
    return;
  }

  let lesson: any = null;

  if (lessonId) {
    lesson = await loadLesson(lessonId);
  } else if (storedLesson) {
    lesson = storedLesson;
  }

  if (!lesson) {
    console.error("❌ No lesson available");
    return;
  }

  prefetchedLessonRow = lesson as LessonRow | null;
  const lessonSlides = lesson.slides || lesson.questions || lesson.slide_definitions || [];
  console.log("lesson:", lesson);
  console.log("slides:", lessonSlides);

  slideContainerEl = document.getElementById("slide-container") as HTMLElement | null;
  if (slideContainerEl) {
    slideContainerEl.innerHTML = `
      <div class="slide slide-content">
        <h2>Loading lesson...</h2>
      </div>
    `;
  }

  try {
    await loadSlides();
    bindControls();
    bindKeys();
    refreshDockVisibility();
    renderSlide();
  } catch (e: any) {
    const container = document.getElementById("slide-container");
    if (container) {
      container.innerHTML = `<div class="slide slide-content"><h2>Loading lesson...</h2><p>${escHtml(e?.message || e)}</p></div>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  boot();
});
