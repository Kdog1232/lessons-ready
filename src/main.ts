// ✅ FILE: src/main.ts (COPY/PASTE THIS WHOLE FILE)
console.log("✅ src/main.ts loaded");
console.log("🧪 test branch build validation active");
import { generateDefaultSkillFocus } from "./utils/skillFocus";
import { resolveCanonicalStandard } from "./save-lessons";
import { createClient } from "@supabase/supabase-js";
// -------------------------
// ✅ CONFIG
// -------------------------
const path = window.location.pathname;
<<<<<<< codex/fix-multiple-issues-in-main.ts-3i9guy

// ✅ ONLY presenter if explicitly present page
const isPresenterPage =
  path === "/present.html" ||
  path.startsWith("/present");

// ✅ ONLY generator if root or index
const isGeneratorPage =
  path === "/" ||
  path === "/index.html";

// 🔍 Debug log (keep this for now)
console.log("PATH:", path);
console.log("isPresenterPage:", isPresenterPage);
console.log("isGeneratorPage:", isGeneratorPage);
=======
const isGeneratorPage =
  path === "/" ||
  path.includes("index");

const isPresenterPage = path.includes("present");
>>>>>>> main
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
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✅ Longer timeout
const HARD_TIMEOUT_MS = 180000;
const STREAM_TIMEOUT_MS = 25000; // 25 seconds to allow backend/OpenAI startup latency

// ✅ Stripe publishable key (SAFE in frontend)
const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51SuRvaQu6FSRjIW6zjcH0X7n0jmSi8fOB10P5Oe1c4ZYn5nV5dd7lMeGkQZ4u4mx7mfH5d01bAbqoP8nbs14TyqP00HzRaaPcz";


// -------------------------
// Helpers
// -------------------------
function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);

  if (!el) {
    console.warn(`Missing element: ${id}`);

    // Safe fallback element to prevent crashes
    return {
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      value: "",
      textContent: "",
    } as unknown as T;
  }

  return el as T;
}

function getElOpt<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}
// ✅ ADD IT RIGHT HERE
function setDisplay(el: HTMLElement | null, value: string) {
  if (!el) return;
  el.style.display = value;
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

function setButtonBusy(
  btn: HTMLButtonElement | null | undefined,
  busy: boolean,
  busyLabel?: string,
) {
  if (!btn) return;
  const anyBtn = btn as any;
  if (busy) {
    if (!anyBtn.__originalLabel) anyBtn.__originalLabel = btn.textContent || "";
    btn.disabled = true;
    if (busyLabel) btn.textContent = busyLabel;
    btn.setAttribute("aria-busy", "true");
    return;
  }
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
  if (anyBtn.__originalLabel) btn.textContent = anyBtn.__originalLabel;
}

function validateEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
}

function renderEmptyLessonStateHtml(mode: "idle" | "generating" = "idle") {
  if (mode === "generating") {
    return `
      <div class="authBox" style="margin:0;">
        <div class="sectionTitle" style="margin-top:0;">Preparing your lesson…</div>
        <div class="miniHelp" style="margin:0;">Please keep this tab open while we build a classroom-ready teacher plan.</div>
      </div>
    `;
  }

  return `
    <div class="authBox" style="margin:0;">
      <div class="sectionTitle" style="margin-top:0;">Your lesson will appear here</div>
      <div class="miniHelp" style="margin:0;">Set your lesson inputs, then click <b>Generate</b> to create a teacher-ready plan.</div>
    </div>
  `;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

(window as any).openPresentMode = function (lessonId: string) {
  const existing = document.getElementById("presentLaunchToast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "presentLaunchToast";
  toast.innerHTML = `<div class="pill" style="position:fixed;right:16px;bottom:16px;z-index:9999;">Launching Presenter View…</div>`;
  document.body.appendChild(toast);

  const launch = () => {
    if (toast.parentElement) toast.remove();
    if (!lessonId) {
      window.location.href = "/present.html";
      return;
    }
    window.location.href = `/present.html?lessonId=${encodeURIComponent(lessonId)}`;
  };

  window.setTimeout(launch, 180);
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

type SlideQuestion = {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  standard: string;
  dok: string;
};

type StructuredLessonForSlides = {
  doNow: string;
  objective: string;
  vocab: string[];
  model: {
    passage: string;
    thinkAloud: string;
  };
  guided: {
    questions: SlideQuestion[];
  };
  strategy: {
    steps: string[];
  };
  collaborativeTask: string;
  independent: {
    questions: SlideQuestion[];
  };
  exitTicket: {
    questions: SlideQuestion[];
  };
};

function buildStructuredLessonForSlides(opts: {
  lessonText: string;
  lessonSections?: any;
  standardValue?: string;
  dokValue?: string;
}): StructuredLessonForSlides {
  const lessonText = String(opts.lessonText || "").trim();
  const standardValue = String(opts.standardValue || "");
  const dokValue = String(opts.dokValue || "");
  const fallbackSource = lessonText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  const blocks = extractSectionBlocksFromPlainText(lessonText);
  const sections = opts.lessonSections && typeof opts.lessonSections === "object"
    ? opts.lessonSections
    : {};

  const getBlockLines = (needles: string[]) => {
    const hit = blocks.find((b) =>
      needles.some((needle) => b.heading.toLowerCase().includes(needle.toLowerCase())),
    );
    return (hit?.lines || []).map((l) => l.trim()).filter(Boolean);
  };
  const sectionValue = (keys: string[]) => {
    for (const key of keys) {
      const value = (sections as any)?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  const sectionList = (keys: string[]) => {
    for (const key of keys) {
      const value = (sections as any)?.[key];
      if (Array.isArray(value)) {
        const out = value.map((v) => String(v || "").trim()).filter(Boolean);
        if (out.length) return out;
      }
    }
    return [] as string[];
  };

  const clampChoices = (choices: string[]) => {
    const sanitized = choices
      .map((c) => String(c || "").trim())
      .filter(Boolean)
      .slice(0, 4);
    while (sanitized.length < 4) sanitized.push(`Option ${sanitized.length + 1}`);
    return sanitized;
  };

  const makeQuestion = (seed: {
    question: string;
    choices?: string[];
    correctIndex?: number;
  }, idx: number): SlideQuestion => {
    const clean = String(seed.question || "").replace(/^\d+[\).:\-]?\s*/, "").trim();
    const prompt = clean || `Question ${idx + 1}`;
    const choices = clampChoices(seed.choices && seed.choices.length ? seed.choices : [
      "Use strong text evidence.",
      "Use one weak detail only.",
      "Restate without evidence.",
      "Give an unrelated opinion.",
    ]);
    const validCorrect = Number.isInteger(seed.correctIndex) ? Number(seed.correctIndex) : 0;
    const correctIndex = Math.min(3, Math.max(0, validCorrect));
    return {
      id: `q_${idx + 1}`,
      question: prompt.endsWith("?") ? prompt : `${prompt}?`,
      choices,
      correctIndex,
      standard: standardValue || "",
      dok: dokValue || "",
    };
  };

  const parseQuestionsFromLines = (lines: string[]) => {
    const normalized = lines.map((l) => String(l || "").trim()).filter(Boolean);
    const results: Array<{ question: string; choices: string[]; correctIndex?: number }> = [];
    let current: { question: string; choices: string[]; correctIndex?: number } | null = null;

    const pushCurrent = () => {
      if (!current?.question) return;
      results.push(current);
      current = null;
    };

    for (const raw of normalized) {
      const line = raw.replace(/^[-•]\s*/, "").trim();
      const qMatch = line.match(/^(?:q(?:uestion)?\s*)?(\d+[\).:\-]?\s*)?(.+\?)$/i);
      const choiceMatch = line.match(/^[A-D][\).:\-]\s*(.+)$/i);
      const answerMatch = line.match(/^answer\s*[:\-]\s*([A-D1-4])/i);

      if (qMatch && !choiceMatch) {
        pushCurrent();
        current = { question: qMatch[2].trim(), choices: [] };
        continue;
      }

      if (choiceMatch) {
        if (!current) current = { question: "Select the best answer.", choices: [] };
        current.choices.push(choiceMatch[1].trim());
        continue;
      }

      if (answerMatch && current) {
        const rawAnswer = answerMatch[1].toUpperCase();
        const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
        current.correctIndex = map[rawAnswer] ?? 0;
        continue;
      }

      if (line.includes("?")) {
        pushCurrent();
        current = { question: line, choices: [] };
      }
    }
    pushCurrent();

    return results.slice(0, 12);
  };

  const fallbackQuestions = () => {
    const base = [
      "Which detail best supports the lesson objective?",
      "What inference is most supported by the evidence?",
      "Which revision most improves the response using academic vocabulary?",
    ];
    return base.map((q, idx) => makeQuestion({ question: q }, idx));
  };

  const objective =
    sectionValue(["objective", "learningObjective"]) ||
    getBlockLines(["objective", "i can"]).find((l) => !/^[-•]/.test(l)) ||
    "Students will demonstrate mastery of the target skill using evidence.";

  const doNow =
    sectionValue(["doNow", "warmup", "opening"]) ||
    getBlockLines(["do now", "warm-up", "warm up", "opening", "hook", "rehearsal"]).join(" ") ||
    "Complete a quick warm-up that previews today’s objective.";

  const vocabFromSections = sectionList(["vocab", "vocabulary", "academicVocabulary"]);
  const vocab = vocabFromSections.length
    ? vocabFromSections
    : getBlockLines(["academic vocabulary", "vocabulary"])
      .map((l) => l.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 8);

  const modelPassage =
    sectionValue(["modelPassage", "passage"]) ||
    getBlockLines(["model", "passage"]).join(" ") ||
    `Use this anchor text excerpt for modeling: ${fallbackSource || "Teacher models close reading of a short passage."}`;

  const modelThinkAloud =
    sectionValue(["modelThinkAloud", "thinkAloud", "teacherModel"]) ||
    getBlockLines(["think aloud", "modeling", "teacher notes"]).join(" ") ||
    "Model a think-aloud that cites evidence, explains reasoning, and connects to the objective.";

  const strategyStepsFromSections = sectionList(["strategySteps", "steps", "successCriteria"]);
  const strategySteps = strategyStepsFromSections.length
    ? strategyStepsFromSections
    : getBlockLines(["strategy", "success criteria", "steps"])
      .map((l) => l.replace(/^[-•\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 6);
  const normalizedStrategySteps = strategySteps.length
    ? strategySteps
    : [
      "Read the prompt and annotate key words.",
      "Select the strongest evidence from the text.",
      "Write a response that explains reasoning clearly.",
    ];

  const collaborativeTask =
    sectionValue(["collaborativeTask", "guidedPractice"]) ||
    getBlockLines(["collaborative", "guided practice", "turn and talk"]).join(" ") ||
    "Work with a partner to compare evidence and justify your best answer choice.";

  const guidedQuestionsRaw = parseQuestionsFromLines(
    getBlockLines(["guided", "guided practice", "cfu", "check for understanding"]),
  );
  const independentQuestionsRaw = parseQuestionsFromLines(
    getBlockLines(["independent", "independent practice"]),
  );
  const exitQuestionsRaw = parseQuestionsFromLines(
    getBlockLines(["exit ticket", "closure"]),
  );

  const guidedQuestions = guidedQuestionsRaw.map((q, idx) => makeQuestion(q, idx));
  const independentQuestions = independentQuestionsRaw.map((q, idx) => makeQuestion(q, idx));
  const exitQuestions = exitQuestionsRaw.map((q, idx) => makeQuestion(q, idx));

  return {
    doNow,
    objective,
    vocab: (Array.isArray(vocab) ? vocab : []).slice(0, 12),
    model: {
      passage: modelPassage,
      thinkAloud: modelThinkAloud,
    },
    guided: {
      questions: guidedQuestions.length ? guidedQuestions : fallbackQuestions(),
    },
    strategy: {
      steps: normalizedStrategySteps,
    },
    collaborativeTask,
    independent: {
      questions: independentQuestions.length ? independentQuestions : fallbackQuestions(),
    },
    exitTicket: {
      questions: exitQuestions.length ? exitQuestions : fallbackQuestions(),
    },
  };
}

function resolveEngagementTemplate(skillFocus: string, subjectValue: string): "neutral" | "sports" | "gaming" | "real-world" | "holiday" {
  const text = `${skillFocus || ""} ${subjectValue || ""}`.toLowerCase();
  if (/(football|basketball|soccer|sports|athlete)/.test(text)) return "sports";
  if (/(gaming|game|fortnite|minecraft|esports)/.test(text)) return "gaming";
  if (/(holiday|winter break|thanksgiving|christmas|new year)/.test(text)) return "holiday";
  if (/(community|real-world|real_world|career|workplace|civic)/.test(text)) return "real_world";
  return "neutral";
}


function resolveLessonMode(plainText: string): "bluebonnet" | "amplify" | "generic" {
  const t = (plainText || "").toLowerCase();
  if (t.includes("bluebonnet")) return "bluebonnet";
  if (t.includes("amplify")) return "amplify";
  return "generic";
}

function resolveLessonModeFromPublisher(publisher: string): "standard" {
  if (!publisher) return "standard";
  if (publisher.toLowerCase().includes("bluebonnet")) return "standard";
  return "standard";
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
    exportOptions: {
      engagementTemplate,
      engagementTemplateLegacy: engagementTemplate.replace("_", "-"),
    },
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
  // TEMP FIX: disable strict project validation
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

  const anon = getAnonKey();
  if (!anon) throw new Error("Missing Supabase anon key in main.ts.");

  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${token}`,
  };
}

async function saveSlideDefinitionsToLesson(
  lessonId: string,
  slideDefinitions: any[],
) {
  const session = requireSession();

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/lessons?id=eq.${encodeURIComponent(lessonId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: getAnonKey(),
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        slide_definitions: Array.isArray(slideDefinitions)
          ? slideDefinitions
          : [],
      }),
    },
  );

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Failed to save slide_definitions (${res.status}): ${text}`);
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
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
  onStart?: (obj: any) => void;
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
      if (eventName === "start") {
        hooks.onStart?.(obj);
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
      if (inferredType === "start" || inferredType === "starting") {
        hooks.onStart?.(obj);
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

  const numberedSectionRegex = /^\s*\d+\s*[\)\.]\s+\S.+$/;

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

    if (numberedSectionRegex.test(t)) {
      flushLists();
      out.push(`<div class="secHead"><div class="secTitle">${t}</div></div>`);
      continue;
    }

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





type OutputAudienceView = "teacher" | "student" | "slides";

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

function buildSlideDeckViewHtml(rawText: string, opts?: { includeTopSignals?: boolean }) {
  const source = (rawText || "").replaceAll("\r\n", "\n");
  const lines = source.split("\n");
  const sectionRegex = /^\s*(\d+)\s*[\)\.]\s+(.+)$/;
  const sections: Array<{ title: string; bullets: string[] }> = [];

  let current: { title: string; bullets: string[] } | null = null;
  for (const rawLine of lines) {
    const t = rawLine.trim();
    if (!t) continue;

    const match = t.match(sectionRegex);
    if (match) {
      if (current) sections.push(current);
      current = { title: match[2].trim(), bullets: [] };
      continue;
    }

    if (!current) continue;
    const cleaned = t.replace(/^[-•]\s*/, "").trim();
    if (!cleaned) continue;
    if (current.bullets.length < 4) current.bullets.push(cleaned);
  }
  if (current) sections.push(current);

  const slideCards = (sections.length ? sections.slice(0, 9) : [{ title: "Lesson Snapshot", bullets: lines.filter((l) => l.trim()).slice(0, 4) }])
    .map((section, index) => {
      const icon = index === 0 ? "🎯" : index % 3 === 0 ? "🧠" : index % 3 === 1 ? "📘" : "✅";
      const bulletsHtml = (section.bullets.length ? section.bullets : ["Add teacher talking points.", "Add student task direction."])
        .map((bullet) => `<li style="margin:0 0 6px;">${escapeHtml(bullet)}</li>`)
        .join("");

      return `
        <article style="
          background:linear-gradient(145deg, rgba(29,39,64,.95), rgba(17,24,39,.96));
          border:1px solid rgba(88,184,255,.34);
          border-radius:14px;
          padding:14px;
          box-shadow:0 10px 22px rgba(2,8,20,.28);
          min-height:170px;
        ">
          <div style="display:flex; align-items:center; gap:8px; font-weight:900; font-size:14px; margin:0 0 8px;">
            <span>${icon}</span>
            <span>Slide ${index + 1}</span>
          </div>
          <div style="font-size:13px; font-weight:800; margin:0 0 8px; color:#f8fbff;">${escapeHtml(section.title)}</div>
          <ul style="margin:0; padding-left:18px; font-size:12px; line-height:1.45; color:rgba(236,244,255,.93);">
            ${bulletsHtml}
          </ul>
        </article>
      `;
    })
    .join("");

  const optionalTop = opts?.includeTopSignals
    ? `
      <div class="authBox" style="margin:0 0 10px;">
        <div class="sectionTitle" style="margin-top:0;">🎥 Presenter Slide View Active</div>
        <div class="miniHelp" style="margin:0;">Same lesson data, remixed into quick speaker cards for a slide-by-slide delivery flow.</div>
      </div>
    `
    : "";

  return `
    ${optionalTop}
    <div class="authBox" style="margin:0 0 10px;">
      <div class="sectionTitle" style="margin-top:0;">Slide Deck Preview</div>
      <div class="miniHelp" style="margin:0 0 10px;">Use these cards as your presenter flow: objective → modeling → practice → check for understanding.</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:10px;">
        ${slideCards}
      </div>
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

  // Remove section headings that look like legacy bridge maps + their immediate table/list blocks.
  // Keep numbered lesson headings intact (e.g., "2) 🗺️ Curriculum Bridge Map").
  const secHeads = Array.from(root.querySelectorAll(".secHead"));
  for (const head of secHeads) {
    const titleEl = head.querySelector(".secTitle");
    const rawTitle = (titleEl?.textContent || head.textContent || "").trim();
    const title = rawTitle.toLowerCase();
    const isNumberedSectionHeading = /^\d+\s*[\)\.]/.test(rawTitle);
    const looksLikeBridge =
      title.includes("curriculum bridge") ||
      title.includes("bridge map") ||
      title.includes("curriculum components") ||
      title.includes("curriculum map");

    if (!looksLikeBridge || isNumberedSectionHeading) continue;

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
    const rawTitle = (head.querySelector(".secTitle")?.textContent || head.textContent || "").trim();
    const title = rawTitle.toLowerCase();
    return (
      /^\s*2\s*[\)\.]/.test(rawTitle) ||
      /(^|\b)section\s*2(\b|:)/i.test(title) ||
      title.includes("section 2")
    );
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

  // Fallback: never prepend above section 0.
  const firstSection = root.querySelector(".secHead");
  if (firstSection) {
    firstSection.insertAdjacentElement("afterend", bridgeNode);
    return root.innerHTML;
  }

  // If no section structure exists, leave lesson untouched.
  return cleanHtml;
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
      : audienceView === "slides"
        ? buildSlideDeckViewHtml(lessonText, { includeTopSignals: true })
        : formatLessonToHtml(lessonText);

      const publisherSelected = Boolean((opts.publisher || "").trim());
      if (!publisherSelected) return baseHtml;
      
      const modeBadge = buildCurriculumModeBadgeHtml({
        publisherName: opts.publisher,
        standard: opts.standard,
        unit: opts.unit,
        lesson: opts.lesson,
      });
      
      if (audienceView === "student" || audienceView === "slides") {
        return `${modeBadge}${baseHtml}`;
      }
      
      const rewiredHtml = stripLegacyCurriculumBridgeHtml(baseHtml);
      const bridgeHtml = buildCurriculumBridgeHtml(opts);
      const withBridge = injectBridgeIntoSection2(rewiredHtml, bridgeHtml);

      // Keep only compact badge at top; bridge content is inserted into section 2.
      return `${modeBadge}${withBridge}`;
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

  const email = authEmail?.value?.trim();
  const pw = authPassword?.value?.trim();

  if (!email || !pw) {
    throw new Error("Enter email + password first, then retry.");
  }

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

let bootstrapAuthPromise: Promise<Session | null> | null = null;

async function syncSavedSessionToSupabase(): Promise<Session | null> {
  const saved = getSavedSession();
  if (!saved?.access_token || !saved?.refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: saved.access_token,
    refresh_token: saved.refresh_token,
  });

  if (error) {
    console.warn("Supabase setSession failed during bootstrap:", error.message);
    return null;
  }

  const session = data?.session;
  if (!session?.access_token) return null;

  const synced: Session = {
    access_token: session.access_token,
    refresh_token: session.refresh_token || saved.refresh_token,
    user: {
      id: session.user?.id || saved.user?.id,
      email: session.user?.email ?? saved.user?.email ?? null,
    },
  };
  setSavedSession(synced);
  return synced;
}

async function bootstrapAuth(): Promise<Session | null> {
  if (bootstrapAuthPromise) return bootstrapAuthPromise;

  bootstrapAuthPromise = (async () => {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.session.user?.id || "",
          email: data.session.user?.email ?? null,
        },
      };
    }

    const synced = await syncSavedSessionToSupabase();
    if (synced?.access_token) return synced;

    // If no session, wait for auth state change
    return new Promise<Session | null>((resolve, reject) => {
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.access_token) {
          listener.subscription.unsubscribe();
          const nextSession: Session = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            user: {
              id: session.user?.id || "",
              email: session.user?.email ?? null,
            },
          };
          setSavedSession(nextSession);
          resolve(nextSession);
        }
      });

      // Timeout after 3 seconds
      window.setTimeout(() => {
        listener.subscription.unsubscribe();
        reject(new Error("Auth not initialized"));
      }, 3000);
    });
  })().catch((err) => {
    bootstrapAuthPromise = null;
    throw err;
  });

  return bootstrapAuthPromise;
}

async function getAuthHeaders() {
  await bootstrapAuth();

  // force refresh
  await supabase.auth.getUser();

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Session error:", error.message);
    throw new Error("Auth session failed");
  }

  const token = data?.session?.access_token;
  if (!token) {
    throw new Error("User not authenticated");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  await bootstrapAuth();

  const doFetch = async () => {
    const authHeaders = await getAuthHeaders();
    const mergedHeaders: HeadersInit = {
      ...authHeaders,
      ...(options.headers || {}),
    };
    return fetch(url, {
      ...options,
      headers: mergedHeaders,
    });
  };

  try {
    let response = await doFetch();
    if (response.status === 401) {
      await supabase.auth.getUser();
      response = await doFetch();
    }
    return response;
  } catch (error) {
    console.error("Authenticated fetch failed:", error);
    throw error;
  }
}

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
    // ✅ IMPORTANT: STATUS must hit dynamic-api (NOT create-checkout-session)
    const res = await fetchWithAuth(SUPABASE_STATUS_FN_URL, {
      method: "POST",
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

  await ensureLoggedInForBilling(authEmail, authPassword);
  const res = await fetchWithAuth(SUPABASE_PORTAL_FN_URL, {
    method: "POST",
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
<<<<<<< codex/fix-multiple-issues-in-main.ts-3i9guy
function initGenerator() {
=======
if (isPresenterPage) {
  console.log("🎥 Presenter page detected — skipping generator init");
} else {
>>>>>>> main
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

  const maybeSubmitAuthOnEnter = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (logInBtn && (logInBtn.style.display || "inline-block") !== "none" && !logInBtn.disabled) {
      logInBtn.click();
      return;
    }
    if (signUpBtn && !signUpBtn.disabled) signUpBtn.click();
  };
  authEmail?.addEventListener("keydown", maybeSubmitAuthOnEnter);
  authPassword?.addEventListener("keydown", maybeSubmitAuthOnEnter);

  function setAuthBusy(
    busy: boolean,
    activeBtn?: HTMLButtonElement | null,
    busyLabel?: string,
  ) {
    setButtonBusy(activeBtn || null, busy, busyLabel);
    const peers = [signUpBtn, logInBtn, forgotPwBtn].filter(Boolean) as HTMLButtonElement[];
    for (const btn of peers) {
      if (!activeBtn || btn !== activeBtn) btn.disabled = busy;
    }
  }

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
  const state = getElOpt<HTMLSelectElement>("state");
  const publisher = getElOpt<HTMLSelectElement>("publisher");
  const publisherOtherWrap = getElOpt<HTMLElement>("publisherOtherWrap");
  const publisherOther = getElOpt<HTMLInputElement>("publisherOther");

  const grade = getElOpt<HTMLSelectElement>("grade");
  const subject = getElOpt<HTMLSelectElement>("subject");
  const standard = getElOpt<HTMLSelectElement>("standard");
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
  const unit = getElOpt<HTMLInputElement>("unit");
  const lesson = getElOpt<HTMLInputElement>("lesson");
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

  const testMode = getElOpt<HTMLInputElement>("testMode");

  const generateBtn = getElOpt<HTMLButtonElement>("generateBtn");
  const openLibraryBtn = getElOpt<HTMLButtonElement>("openLibraryBtn");
  const closeLibraryBtn = getElOpt<HTMLButtonElement>("closeLibraryBtn");

  // Output actions
  const outputView = getElOpt<HTMLElement>("outputView");
  const libraryView = getElOpt<HTMLElement>("libraryView");
  const librarySearch = getElOpt<HTMLInputElement>("librarySearch");
  const libraryList = getElOpt<HTMLElement>("libraryList");

  const favoriteBtn = getElOpt<HTMLButtonElement>("favoriteBtn");
  const copyBtn = getElOpt<HTMLButtonElement>("copyBtn");
  const copyDocsBtn = getElOpt<HTMLButtonElement>("copyDocsBtn");
  const printBtn = getElOpt<HTMLButtonElement>("printBtn");
  const downloadPdfBtn = getElOpt<HTMLButtonElement>("downloadPdfBtn");
  const exportPackBtn = getElOpt<HTMLButtonElement>("exportPackBtn");

  const output = getElOpt<HTMLElement>("output");

  // Feedback Garage (HTML has it — but backend endpoint/table might not yet exist, so it’s optional/safe)
  const submitFeedbackBtn = getElOpt<HTMLButtonElement>("submitFeedbackBtn");
  const feedbackCategory = getElOpt<HTMLSelectElement>("feedbackCategory");
  const feedbackText = getElOpt<HTMLTextAreaElement>("feedbackText");
  const feedbackStatus = getElOpt<HTMLElement>("feedbackStatus");

  let lastLessonPlainText = "";
  let lastLessonRawText = "";
  let lastLessonRenderMeta: {
    publisher: string;
    standard: string;
    unit: string;
    lesson: string;
  } | null = null;
  let activeStreamAbort: AbortController | null = null;
  let lastLessonId: string | null = null;
  let lastLessonFavorite = false;


  // -------------------------
  // UI helpers
  // -------------------------
  function setStatus(text: string) {
  if (!statusPill) return;
  statusPill.textContent = text;
}

  function animateOutputReveal(target: HTMLElement) {
    target.style.transition = "opacity .26s ease, transform .26s ease";
    target.style.opacity = "0";
    target.style.transform = "translateY(8px)";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target.style.opacity = "1";
        target.style.transform = "translateY(0)";
      });
    });
  }

  function setGenerationActionLock(locked: boolean) {
    const btns = [
      openLibraryBtn,
      copyBtn,
      copyDocsBtn,
      printBtn,
      downloadPdfBtn,
      exportPackBtn,
      favoriteBtn,
    ].filter(Boolean) as HTMLButtonElement[];
    for (const btn of btns) {
      const anyBtn = btn as any;
      if (locked) {
        anyBtn.__wasDisabledBeforeGenerate = btn.disabled;
        btn.disabled = true;
      } else {
        btn.disabled = Boolean(anyBtn.__wasDisabledBeforeGenerate);
      }
    }
  }

  const generationStages = [
    "Analyzing lesson inputs…",
    "Aligning standards and rigor…",
    "Building teacher plan…",
    "Finalizing lesson output…",
  ];

  function startGenerationStageTicker() {
    let idx = 0;
    setStatus(generationStages[idx]);
    const timer = window.setInterval(() => {
      idx = (idx + 1) % generationStages.length;
      setStatus(generationStages[idx]);
    }, 2400);
    return () => window.clearInterval(timer);
  }

  function activeMessageEl(): HTMLElement | null {
  const appIsVisible = appView ? appView.style.display !== "none" : false;

  if (appIsVisible && messageApp) return messageApp;
  if (message) return message;

  return null; // ✅ prevents crash
}

 function showMessage(html: string, ok = true) {
  const target = activeMessageEl();

  if (!target) return; // ✅ prevents crash

  target.innerHTML = `<div class="${ok ? "ok" : "error"}">${html}</div>`;
}

function logClientError(context: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error || "Unknown error");
  console.error(`❌ ${context}:`, error);
  showMessage(`${esc(context)}: ${esc(msg)}`, false);
}

function clearMessage() {
  if (message) message.innerHTML = "";
  if (messageApp) messageApp.innerHTML = "";
}

function buildFallbackSlides(lessonText: string) {
  return [
    {
      type: "headline",
      stageType: "objective_lock",
      heading: "Slides unavailable",
      subtext: "Using lesson fallback. Tap Retry to regenerate slides.",
      content: String(lessonText || "").slice(0, 500),
    },
  ];
}

window.addEventListener("error", (event) => {
  logClientError("Unexpected app error", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  logClientError("Unhandled async error", event.reason);
});

  function setMeta(text: string) {
  if (!metaLineEl) return;
  metaLineEl.textContent = text;
}

 function setView(isLoggedIn: boolean) {
  if (landingView) {
    setDisplay(landingView, isLoggedIn ? "none" : "block");
  }

  if (appView) {
    setDisplay(appView, isLoggedIn ? "block" : "none");
  }

  if (isLoggedIn) {
    document.body.classList.add("logged-in");
  } else {
    document.body.classList.remove("logged-in");
  }
}
 function refreshPublisherUI() {
  if (!publisherOtherWrap || !publisher) return;
  setDisplay(
    publisherOtherWrap,
    publisher.value === "Other" ? "block" : "none"
  );
}

function showLibrary(show: boolean) {
  setDisplay(outputView, show ? "none" : "block");
  setDisplay(libraryView, show ? "block" : "none");
  setDisplay(openLibraryBtn, show ? "none" : "inline-block");
  setDisplay(closeLibraryBtn, show ? "inline-block" : "none");
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

  // Landing subscribe button (only when logged OUT)
  setDisplay(billingBtnSubscribe, loggedIn ? "none" : "inline-block");

  // Hide legacy button
  setDisplay(billingBtn, "none");

  // Main app billing button
  setDisplay(billingBtnApp, loggedIn ? "inline-block" : "none");

 if (billingBtnApp) {
  billingBtnApp.textContent = isSubscribed()
    ? "Manage Subscription"
    : "Subscribe";
}

  // Always hide duplicate
  setDisplay(billingBtnApp2, "none");
}
 function refreshAuthUI() {
  const s = getSavedSession();
  const loggedIn = Boolean(s?.access_token);

  // ✅ SAFE
  if (authStatusPill) {
    authStatusPill.textContent = loggedIn
      ? `Logged in: ${s?.user?.email || s?.user?.id}`
      : "Not logged in";
  }

  // ✅ SAFE (already good)
  setDisplay(signUpBtn, loggedIn ? "none" : "inline-block");
  setDisplay(logInBtn, loggedIn ? "none" : "inline-block");
  setDisplay(forgotPwBtn, loggedIn ? "none" : "inline-block");
  setDisplay(logOutBtn, loggedIn ? "inline-block" : "none");

  // ✅ SAFE
  if (favoriteBtn) {
    favoriteBtn.disabled = !loggedIn || !lastLessonId;
  }

   setView(loggedIn); // ✅ THIS IS KEY
  // billing UI is async (status call)
  refreshBillingUI(false).catch(() => {});
   
}

  if (isGeneratorPage) {
    refreshPublisherUI();
    publisher?.addEventListener("change", refreshPublisherUI);
    audienceView?.addEventListener("change", () => {
      if (!output || !lastLessonRawText || !lastLessonRenderMeta) return;
      output.innerHTML = renderLessonWithCurriculumBridge(lastLessonRawText, {
        ...lastLessonRenderMeta,
        audienceView: (audienceView?.value as OutputAudienceView) || "teacher",
      });
      animateOutputReveal(output);
      lastLessonPlainText = htmlToPlainText(output.innerHTML);
      downloadPdfBtn.disabled = !lastLessonPlainText.trim();
      if (exportPackBtn) exportPackBtn.disabled = !lastLessonPlainText.trim();
    });
  }

  // ✅ Keep mode access correct if user changes mode
  mode?.addEventListener("change", () => enforceModeAccess());

  // -------------------------
  // ✅ BUTTON WIRING
  // -------------------------
  addOnce(signUpBtn, "signup", async () => {
    setAuthBusy(true, signUpBtn, "Creating Account…");
    try {
      clearMessage();
      const email = authEmail?.value?.trim();
      const pw = authPassword?.value?.trim();

      if (!email || !pw) return showMessage("Enter email + password.", false);
      if (!validateEmailLike(email)) return showMessage("Enter a valid school email address.", false);
      if (pw.length < 8) return showMessage("Password must be at least 8 characters.", false);

      await signUp(email, pw);
      showMessage("Account created ✅ Logged in.", true);
      await refreshBillingUI(true);
      enforceModeAccess();

      refreshAuthUI();
    } catch (e: any) {
      showMessage(`Sign up failed: ${esc(e?.message || e)}`, false);
    } finally {
      setAuthBusy(false, signUpBtn);
    }
  });

  addOnce(logInBtn, "login", async () => {
    setAuthBusy(true, logInBtn, "Logging In…");
    try {
      clearMessage();
      const email = authEmail?.value?.trim();
      const pw = authPassword?.value?.trim();
      if (!email || !pw) return showMessage("Enter email + password.", false);
      if (!validateEmailLike(email)) return showMessage("Enter a valid email address.", false);

      await logIn(email, pw);
      showMessage("Logged in ✅", true);
      await refreshBillingUI(true);
      enforceModeAccess();

      refreshAuthUI();
    } catch (e: any) {
      showMessage(`Login failed: ${esc(e?.message || e)}`, false);
    } finally {
      setAuthBusy(false, logInBtn);
    }
  });

  if (forgotPwBtn) {
    addOnce(forgotPwBtn, "forgot", async () => {
      setAuthBusy(true, forgotPwBtn, "Sending Reset…");
      try {
        clearMessage();
        const email = authEmail?.value?.trim();
        if (!email) return showMessage("Enter your email first.", false);
        if (!validateEmailLike(email)) return showMessage("Enter a valid email address first.", false);
        await supabaseAuthPOST("recover", { email });
        showMessage("Password reset email sent ✅ Check your inbox.", true);
      } catch (e: any) {
        showMessage(`Reset failed: ${esc(e?.message || e)}`, false);
      } finally {
        setAuthBusy(false, forgotPwBtn);
      }
    });
  }

  async function doLogout() {
  await logOut();
  showMessage("Logged out ✅", true);
  lastLessonId = null;
  lastLessonFavorite = false;
  lastLessonRawText = "";
  lastLessonRenderMeta = null;
  if (favoriteBtn) {
    favoriteBtn.textContent = "☆ Favorite";
    favoriteBtn.disabled = true;
  }

  setCachedSubStatus("unknown", "unknown");
  enforceModeAccess();
  refreshAuthUI();
    
  setView(false);
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

  if (
    isGeneratorPage &&
    state &&
    publisher &&
    publisherOtherWrap &&
    publisherOther &&
    grade &&
    subject &&
    standard &&
    unit &&
    lesson &&
    testMode &&
    generateBtn &&
    openLibraryBtn &&
    closeLibraryBtn &&
    outputView &&
    libraryView &&
    librarySearch &&
    libraryList &&
    favoriteBtn &&
    copyBtn &&
    downloadPdfBtn &&
    output
  ) {
  if (!String(output.innerHTML || "").trim() || output.textContent?.trim() === "(nothing yet)") {
    output.innerHTML = renderEmptyLessonStateHtml("idle");
  }

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
    setButtonBusy(openLibraryBtn, true, "Opening…");
    try {
      showLibrary(true);
      showMessage("Loading your saved lessons…", true);
      await loadLibrary();
    } catch (e: any) {
      showMessage(`Library: ${esc(e?.message || e)}`, false);
    } finally {
      setButtonBusy(openLibraryBtn, false);
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
        lastLessonRawText = data.lesson_text || "";
        lastLessonRenderMeta = {
          publisher: publisher.value === "Other"
            ? (publisherOther.value.trim() || "Other")
            : publisher.value,
          standard: data.standard_label || "",
          unit: data.curriculum_unit || "",
          lesson: data.curriculum_lesson || "",
        };
        animateOutputReveal(output);
        lastLessonPlainText = htmlToPlainText(output.innerHTML);
        downloadPdfBtn.disabled = !lastLessonPlainText.trim();
        if (exportPackBtn) exportPackBtn.disabled = !lastLessonPlainText.trim();

       const feedbackGarage = getElOpt<HTMLElement>("feedbackGarage");
       setDisplay(feedbackGarage, "block");

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
      setButtonBusy(downloadPdfBtn, true, "Building PDF…");
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
    } finally {
      setButtonBusy(downloadPdfBtn, false);
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
        setButtonBusy(exportPackBtn, true, "Exporting…");

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
        setButtonBusy(exportPackBtn, false);
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
    let requestTimedOut = false;
    const stopStageTicker = startGenerationStageTicker();

    clearMessage();
    const hadPriorLesson = Boolean((lastLessonPlainText || "").trim());
    if (hadPriorLesson) {
      output.style.transition = "opacity .2s ease, filter .2s ease";
      output.style.filter = "blur(1px)";
      output.style.opacity = "0.7";
    }
    lastLessonPlainText = "";
    downloadPdfBtn.disabled = true;
    if (exportPackBtn) exportPackBtn.disabled = true;

    // ✅ Hide Feedback Garage until we have a fresh lesson
   const garage = getElOpt<HTMLElement>("feedbackGarage");
setDisplay(garage, "none");

const fbStatus = getElOpt<HTMLElement>("feedbackStatus");
if (fbStatus) fbStatus.innerHTML = "";

    setButtonBusy(generateBtn, true, "Generating…");
    generateBtn.style.pointerEvents = "none";
    setGenerationActionLock(true);
    setStatus("Starting generation…");
    showMessage("Generation started. Preparing lesson workspace…", true);
    await sleep(380);

    output.innerHTML = renderEmptyLessonStateHtml("generating");
    output.style.filter = "none";
    output.style.opacity = "0.92";

    const timeoutId = setTimeout(() => {
      try {
        requestTimedOut = true;
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
        setStatus("Ready");
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
        max_tokens: 800,
        maxTokens: 800,
        responseDetail: "concise",

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
GENERATION SIZE GUARDRAILS:
- Keep the response concise and classroom-ready.
- Limit output to the most essential lesson components only.
- If slides/checkpoints are included, cap them at 5.
- Prioritize objective, model, guided practice, independent practice, and exit ticket.

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
      let slideDefs: any[] = [];

      if (wantsStream && contentType.includes("text/event-stream")) {
        let liveText = "";
        let lastChunk = "";
        let lastRendered = "";
        let finalLessonText = "";
        let finalLessonSections: StructuredLessonSections | undefined;
        let firstStreamChunkReceived = false;
        let connectingDotsTimer: number | null = null;
        const streamStartTimeoutId = window.setTimeout(() => {
          if (!firstStreamChunkReceived) {
            activeStreamAbort?.abort();
          }
        }, STREAM_TIMEOUT_MS);

        output.classList.add("typing");
        output.innerHTML = renderEmptyLessonStateHtml("generating");
        output.insertAdjacentHTML(
          "beforeend",
          `<div id="streamConnectMsg" class="miniHelp" style="margin-top:8px;">Connecting to live generation stream.</div>`,
        );
        const connectMsg = document.getElementById("streamConnectMsg");
        let dots = 1;
        connectingDotsTimer = window.setInterval(() => {
          if (!connectMsg) return;
          dots = (dots % 3) + 1;
          connectMsg.textContent = `Connecting to live generation stream${".".repeat(dots)}`;
        }, 420);
        setStatus("Connecting to generation stream…");

        try {
          await readSSEStream(
            res,
            {
              onStart: () => {
                firstStreamChunkReceived = true;
                if (connectingDotsTimer) window.clearInterval(connectingDotsTimer);
                setStatus("Stream connected. Building lesson…");
              },
              onDelta: (chunk) => {
                firstStreamChunkReceived = true;
                const merged = applyStreamChunk(liveText, chunk, lastChunk);
                liveText = merged.text;
                lastChunk = merged.lastChunk || lastChunk;
                finalLessonText = liveText;

                if (liveText !== lastRendered) {
                  lastRendered = liveText;
                  output.style.opacity = "1";
                  output.innerHTML = renderLessonWithCurriculumBridge(liveText, {
                    publisher: pub,
                    standard: standard.value.trim(),
                    unit: unit.value.trim(),
                    lesson: lesson.value.trim(),
                    audienceView: (audienceView?.value as OutputAudienceView) || "teacher",
                  });
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
        } finally {
          clearTimeout(streamStartTimeoutId);
          if (connectingDotsTimer) window.clearInterval(connectingDotsTimer);
        }

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
        animateOutputReveal(output);
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
     audienceView: (audienceView?.value as OutputAudienceView) || "teacher",
    });
      lastLessonRawText = lessonText;
      lastLessonRenderMeta = {
        publisher: pub,
        standard: getSelectedStandardDisplay(),
        unit: unit.value.trim() || "",
        lesson: lesson.value.trim() || "",
      };
      output.style.opacity = "1";
      animateOutputReveal(output);
      lastLessonPlainText = htmlToPlainText(output.innerHTML);
      downloadPdfBtn.disabled = !lastLessonPlainText.trim();
      if (exportPackBtn) exportPackBtn.disabled = !lastLessonPlainText.trim();

      // ✅ Show Feedback Garage after output renders
      setDisplay(garage, "block");

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
          slide_count: 0,
        });

        const fallbackRow = {
          ...row,
          structured_sections: undefined,
          slide_definitions: slideDefs,
          lesson_mode: undefined,
        };

        inserted = await postgrest("POST", "lessons", {
          body: fallbackRow,
          preferReturn: "representation",
        });
      }

      const saved = Array.isArray(inserted) ? inserted[0] : inserted;
      const savedLessonId = String(saved?.id || "").trim();
      if (!savedLessonId) {
        throw new Error("Lesson save succeeded but no lesson id was returned.");
      }

      const structuredLesson = buildStructuredLessonForSlides({
        lessonText,
        lessonSections,
        standardValue: standard.value.trim(),
        dokValue: String(canonical?.dok_target || ""),
      });
      console.log("🧱 structuredLesson for slides:", structuredLesson);
      console.log("🧾 slide pipeline lesson id:", savedLessonId);

      const slidesRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-slides`, {
        method: "POST",
        headers: buildFunctionAuthHeaders(session.access_token),
        body: JSON.stringify({ structuredLesson }),
      });
      if (!slidesRes.ok) {
        const rawSlidesErr = await slidesRes.text();
        throw new Error(`Slide generation failed (${slidesRes.status}): ${rawSlidesErr}`);
      }

      const slidesJson = await slidesRes.json();
      const generatedSlides = Array.isArray(slidesJson?.slide_definitions)
        ? slidesJson.slide_definitions
        : [];
      console.log("🎯 generated slide count:", generatedSlides.length);

      if (!generatedSlides.length) {
        throw new Error("Slide generation returned no slide_definitions. Presenter will not open.");
      }

      slideDefs = generatedSlides.map((s: any) => ({
        type: s?.type || "headline",
        stageType: s?.stageType || "objective_lock",
        heading: s?.heading || "",
        ...s,
      }));

      try {
        await saveSlideDefinitionsToLesson(savedLessonId, slideDefs);
        console.log("✅ Saved slide_definitions for lesson:", savedLessonId);
        console.log("🧾 slide save status: success");
      } catch (saveErr) {
        console.error("🧾 slide save status: failure", saveErr);
        throw saveErr;
      }

localStorage.setItem(
  "lr_current_lesson",
  JSON.stringify({
    lesson_text: lessonText || "",
    slide_definitions: slideDefs,
  })
);
      lastLessonId = savedLessonId || null;
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

await sleep(320);
showMessage(
  `Success ✅ Lesson ready, saved to Library, and ready to present.
   <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
     <button id="successPresentBtn" class="secondary" type="button">Open Presenter</button>
     <button id="successLibraryBtn" class="secondary" type="button">Open Library</button>
   </div>`,
  true,
);
const successPresentBtn = document.getElementById("successPresentBtn");
if (successPresentBtn) {
  successPresentBtn.addEventListener("click", () => {
    if (lastLessonId) (window as any).openPresentMode(lastLessonId);
  }, { once: true });
}
const successLibraryBtn = document.getElementById("successLibraryBtn");
if (successLibraryBtn) {
  successLibraryBtn.addEventListener("click", () => openLibraryBtn.click(), { once: true });
}
setStatus("Ready");
    } catch (err: any) {
      const aborted = err?.name === "AbortError";
      const msg =
        aborted && !requestTimedOut
          ? `Lesson stream did not start within ${Math.round(STREAM_TIMEOUT_MS / 1000)} seconds. Please retry.`
          : aborted
            ? `AI request timed out after ${Math.round(HARD_TIMEOUT_MS / 1000)} seconds. Try a smaller request or retry.`
            : String(err?.message || err);

      if (requestTimedOut) {
        console.error("OpenAI-backed lesson request timed out", {
          timeoutMs: HARD_TIMEOUT_MS,
          mode: mode.value,
          grade: grade.value,
          subject: subject.value,
          standard: standard.value,
        });
      }

      const userFacingMsg = requestTimedOut
        ? `Generation timed out after ${Math.round(HARD_TIMEOUT_MS / 1000)} seconds. Your inputs are still here — retry when ready.`
        : msg.includes("did not start within")
          ? "The stream took too long to start. Please retry — your settings are unchanged."
          : msg;

      showMessage(
        `${esc(userFacingMsg)}<div style="margin-top:8px;"><button id="retryGenerateBtn" class="secondary" type="button">Retry Generation</button></div>`,
        false,
      );
      const retryGenerateBtn = document.getElementById("retryGenerateBtn");
      if (retryGenerateBtn) {
        retryGenerateBtn.addEventListener("click", () => generateBtn.click(), { once: true });
      }
      output.classList.remove("typing");
      output.innerHTML = `
        <div class="authBox" style="margin:0;">
          <div class="sectionTitle" style="margin-top:0;">Generation needs attention</div>
          <div class="miniHelp" style="margin:0 0 8px;">${escapeHtml(userFacingMsg)}</div>
          <div style="margin:0 0 8px;"><button id="retryGenerateInlineBtn" class="secondary" type="button">Retry Generation</button></div>
          <pre style="white-space:pre-wrap;margin:0;max-height:180px;overflow:auto;">${escapeHtml(msg)}</pre>
        </div>
      `;
      const retryInlineBtn = document.getElementById("retryGenerateInlineBtn");
      if (retryInlineBtn) {
        retryInlineBtn.addEventListener("click", () => generateBtn.click(), { once: true });
      }
      setStatus("Error");
    } finally {
      stopStageTicker();
      clearTimeout(timeoutId);
      setButtonBusy(generateBtn, false);
      generateBtn.style.pointerEvents = "";
      setGenerationActionLock(false);
      if (statusPill && generationStages.includes(statusPill.textContent || "")) setStatus("Idle");
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


  }

  // ✅ Load subscription cache ASAP so UI doesn’t flash “unknown”
  loadCachedSubStatus(60_000);

  // Ensure Supabase auth is initialized as soon as the app boots.
  bootstrapAuth().catch(() => {
    setView(false);
    showMessage("Please log in to continue.", false);
  });

  // Initial UI state
  setStatus("Idle");
  setMeta("Ready when you are.");
  refreshAuthUI();
  enforceModeAccess();
} catch (err: any) {
  console.error("❌ main.ts crashed:", err);
  alert(String(err?.message || err));
}
}
<<<<<<< codex/fix-multiple-issues-in-main.ts-3i9guy

if (isPresenterPage) {
  console.log("🎥 Presenter page detected — skipping generator init");
} else if (isGeneratorPage) {
  console.log("🧠 Generator page detected — initializing...");
  initGenerator();
} else {
  console.log("⚠️ Unknown route — defaulting to generator");
  initGenerator();
}
=======
>>>>>>> main
