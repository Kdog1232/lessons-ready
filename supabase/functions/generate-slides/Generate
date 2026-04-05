import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
/* =========================================================
   Standard Semantic Resolver (Drift Prevention)
   ========================================================= */
type StandardIntent = {
  focus: string;
  requiredLanguage: string;
  prohibitedDrift?: string[];
};
const standardGuard = `
STANDARD ALIGNMENT RULE (MANDATORY)

The canonical TEKS metadata provided in INPUTS is authoritative.

You MUST align the lesson to:

• skillFocus
• cognitive verb
• strand
• focusType
• dokTarget

Do NOT reinterpret the TEKS independently.

The lesson MUST strictly match the cognitive verb and skillFocus provided.

Examples:
- If skillFocus is "theme", the lesson must teach theme.
- If skillFocus is "text_structure", the lesson must teach structure.
- If skillFocus is "vocabulary", the lesson must teach vocabulary.

Never substitute another skill.

The TEKS label is informational only.
Canonical metadata controls lesson design.
`;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Mode =
  | "lite"
  | "full"
  | "full_lesson"
  | "internalization"
  | "one_pager"
  | "sub_plan"
  | "pacing_plan";

type Genre =
  | "informational"
  | "fiction"
  | "nonfiction"
  | "poetry"
  | "drama"
  | "argumentative"
  | "scenario";

type OutputStyle =
  | "teacher_only"
  | "student_only"
  | "quick_plan"
  | "assessment_only";

type SupportsObj = {
  eb?: boolean | null;
  sped?: boolean | null;
  vocabulary?: boolean | null;
  cfus?: boolean | null;
  writingExtension?: boolean | null;
};

type PracticeObj = {
  enabled?: boolean;
  genre?: Genre | string;
  slangLevel?: "none" | "light" | "moderate" | string;
  topic?: string;
  allowTrendy?: "yes" | "no" | boolean | string;
};

type WorksheetLevel = "beginner" | "intermediate" | "advanced";
type EngagementTheme =
  | "gaming"
  | "creator"
  | "sports"
  | "school"
  | "funny"
  | "none";

type WorksheetPack = {
  enabled?: boolean;
  levels?: WorksheetLevel[];
  questionCount?: {
    beginner?: number;
    intermediate?: number;
    advanced?: number;
  };
  engagementTheme?: {
    enabled?: boolean;
    theme?: EngagementTheme | string;
  };
};

type PacingConfig = {
  enabled?: boolean;
  scope?: "whole_curriculum" | "unit" | "lesson" | string;
  timeframeWeeks?: number;
  pacingFormat?: "weekly" | "daily" | string;
  minutesPerDay?: number;
  daysPerWeek?: number;

  includeAssessments?: boolean;
  includeInterventionBlocks?: boolean;
  defaultCatchUpDaysPerMissingPrereq?: number;
  maxCatchUpDaysPerUnit?: number;

  lessonCycleSegments?: string[];
  segmentMinutes?: Record<string, number>;
};

type GenerateLessonRequest = {
  model?: string;
  mode?: Mode;
  outputStyle?: OutputStyle | string;

  // ✅ Optional curriculum identifiers (Level 2)
  campusId?: string;
  programName?: string;
  curriculumLessonCode?: string;

  publisher?: string;
  publisherOther?: string;
  state?: string;

  curriculumUnit?: string;
  curriculumLesson?: string;

  grade?: string | number;
  subject?: string;
  standard?: string;

  skillFocus?: string;
  supportingStandards?: string | string[];

  lessonCycleTemplate?: string;
  publisherComponents?: string | string[];
  lessonLength?: number | string;
  includeStaar?: string;

  districtLessonCycleName?: string;
  lessonLengthMinutes?: number;
  includeStaarStyleQuestions?: boolean;

  testMode?: boolean;
  stream?: boolean;

  supports?: SupportsObj;
  practice?: PracticeObj;

  subNotes?: string;
  worksheetPack?: WorksheetPack;
  pacing?: PacingConfig;

  unitMap?: string;

  options?: {
    ebSupport?: boolean;
    spedSupport?: boolean;
    vocabularyFocus?: boolean;
    writingExtension?: boolean;
    checksForUnderstanding?: boolean;
    subNotes?: string;
    worksheetPack?: WorksheetPack;
  };

  generatePracticePassageAndMCQs?: boolean;
  practiceGenre?: Genre;
  practiceTopic?: string;
  allowTrendyReferences?: boolean;
  slangLevel?: "none" | "light" | "moderate";

  performanceInsights?: {
    sourceName?: string;
    weakestSkillNotes?: string[];
    misconceptionTags?: string[];
    distractorPatterns?: string[];
  };

  teacherNotes?: string;
  textTitle?: string;
    // 🔒 Canonical metadata (internal only)
    _dokTarget?: "DOK1" | "DOK2" | "DOK3";
_questionMix?: {
  dok1: number;
  dok2: number;
  dok3: number;
};
  _strand?: string;
  _verb?: string;
  _focusType?: string;
  _requiresLineNumbers?: boolean;
  _writingRequired?: boolean;
};

/* =========================================================
   Constants: exact admin-safe notice/footer
   ========================================================= */
const ADMIN_SAFE_NOTICE_LINE =
  "✅ ORIGINAL instructional content generated for skill practice. Not affiliated with or endorsed by any publisher or game brand. No proprietary passages included.";

const ADMIN_SAFE_FOOTER_LINE =
  "✅ Content is original and safe for classroom use; educators should verify local standards alignment.";

/* =========================================================
   Helpers
   ========================================================= */
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function required(field: string, value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`Missing required field: ${field}`);
  }
}

function isPacingMode(req: GenerateLessonRequest) {
  const m = String(req.mode || "").trim().toLowerCase();
  return m === "pacing_plan" || m === "pacing";
}

function normalizePacing(req: GenerateLessonRequest) {
  const p = (req.pacing || {}) as any;

  const timeframeWeeks = Number.isFinite(Number(p.timeframeWeeks))
    ? Number(p.timeframeWeeks)
    : 6;

  const daysPerWeek = Number.isFinite(Number(p.daysPerWeek))
    ? Number(p.daysPerWeek)
    : 5;

  const minutesPerDay = Number.isFinite(Number(p.minutesPerDay))
    ? Number(p.minutesPerDay)
    : 45;

  const pacingFormat = (p.pacingFormat || "daily") as string;

  const unit = (req.curriculumUnit || "").trim();
  const lesson = (req.curriculumLesson || "").trim();

  const scope =
    (p.scope as any) ||
    (unit && !lesson ? "unit" : unit && lesson ? "lesson" : "whole_curriculum");

  const defaultSegments = [
    "Do Now / Lesson Opening",
    "Objective + Vocabulary + Frontload",
    "Model (I Do)",
    "Collaborative (We Do)",
    "Independent (You Do)",
    "Exit Ticket",
  ];

  const lessonCycleSegments = Array.isArray(p.lessonCycleSegments)
    ? (p.lessonCycleSegments as any[])
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .slice(0, 12)
    : defaultSegments;

  return {
    enabled: true,
    scope,
    timeframeWeeks,
    daysPerWeek,
    minutesPerDay,
    pacingFormat,
    includeAssessments:
      typeof p.includeAssessments === "boolean" ? p.includeAssessments : true,
    includeInterventionBlocks:
      typeof p.includeInterventionBlocks === "boolean"
        ? p.includeInterventionBlocks
        : true,
    defaultCatchUpDaysPerMissingPrereq: Number.isFinite(
      Number(p.defaultCatchUpDaysPerMissingPrereq),
    )
      ? Number(p.defaultCatchUpDaysPerMissingPrereq)
      : 2,
    maxCatchUpDaysPerUnit: Number.isFinite(Number(p.maxCatchUpDaysPerUnit))
      ? Number(p.maxCatchUpDaysPerUnit)
      : 5,
    lessonCycleSegments,
    segmentMinutes:
      typeof p.segmentMinutes === "object" && p.segmentMinutes
        ? p.segmentMinutes
        : null,
  } as PacingConfig;
}

function pacingOutputFormatBlock(playbookBlock: string, payload: any) {
  const skeleton = `
YOU ARE LESSONS-READY (PLANNING ENGINE MODE)

Your role is to generate a HIGH-QUALITY LESSON PLAN that is:

- TEKS-aligned
- Admin-ready
- Instructionally rigorous
- Teacher-support focused

You are NOT the presenter.
You do NOT deliver the lesson.
You do NOT generate slides.

The Presenter Mode will execute the lesson.

----------------------------------------

CRITICAL ROLE SEPARATION:

GENERATOR (YOU):
- Defines WHAT to teach
- Defines WHY it matters
- Defines rigor + alignment
- Defines misconceptions, supports, and strategy

PRESENTER (SEPARATE SYSTEM):
- Handles HOW the lesson is taught
- Handles pacing, slides, and engagement
- Handles questioning and delivery

DO NOT script full teaching moves like a slideshow.

----------------------------------------

PLAYBOOK (HIGHEST PRIORITY):

${playbookBlock}

You MUST follow playbook structure, tone, and expectations.

----------------------------------------

RIGOR REQUIREMENTS (MANDATORY):

Skill Focus: ${payload.skillFocus}
Cognitive Verb: ${payload._verb}
Target DOK: ${payload._dokTarget}

- All thinking must align to the cognitive verb
- All tasks must require reasoning or evidence (if DOK 2+)
- Avoid surface-level or recall-only instruction
- Writing must include claim + evidence + reasoning when appropriate

----------------------------------------

LESSON OUTPUT STRUCTURE (MANDATORY — DO NOT SKIP ANY SECTION)

YOU MUST OUTPUT ALL SECTIONS EXACTLY AS LISTED BELOW.

Do NOT rename sections.
Do NOT skip sections.
Do NOT combine sections.

----------------------------------------

0) 🛡️ Admin-Safe Notice

Provide a brief statement confirming:
- TEKS alignment
- Grade-level appropriateness
- Safe and appropriate instructional content

----------------------------------------

1) 🎯 Objective

- Clear TEKS-aligned objective
- Focused on the cognitive verb

----------------------------------------

2) ✅ Success Criteria

- 3 student-friendly "I can" statements
- Must align to objective and skill

----------------------------------------

3) 📚 Vocabulary

- 5–7 key academic terms
- Include terms necessary to access the lesson

----------------------------------------

4) 🧭 Scope Decision

- Clarify whether this is:
  - Lesson-level
  - Unit-level
  - Intervention focus

----------------------------------------

5) 🧱 Prerequisite Skills

- What students must already understand
- Identify likely gaps

----------------------------------------

6) 📊 Pacing Overview

- Approximate timing of lesson components
- Keep concise (not a full script)

----------------------------------------

7) 🧠 Teacher Notes (Instructional Intent)

- What matters most in this lesson
- What to emphasize conceptually
- Where students may struggle

----------------------------------------

7A) 🎯 Presenter Alignment (Instructional Flow Map)

This section connects planning to Presenter Mode.

Do NOT script the lesson.

Instead define:

- What the teacher will model (I Do focus)
- What students will practice (We Do focus)
- What students must produce independently (You Do outcome)
- What mastery looks like at the end

Presenter will handle delivery.

----------------------------------------

8) 📊 Differentiation / Tier 2 Planning

🗣️ Sentence Stems:
- Provide 4–6 stems aligned to the skill
- Must support evidence-based responses

🧑‍🏫 Teacher Moves:
- What teacher says
- What teacher looks for
- How to respond to incorrect thinking

🧩 Scaffolds:
- Step-by-step supports
- Prompts for struggling students

----------------------------------------

9) 🧠 Data-Informed Misconceptions

- Include 2–3 realistic student mistakes
- Include a clear teacher correction for each

----------------------------------------

10) 🚀 Advanced Push

- Include 1 extension task (DOK 3)
- Must require deeper thinking, not more work

----------------------------------------

11) 🛡️ Admin-Safe / Safety Statement

- 2–3 sentence professional statement
- Confirm:
  - TEKS alignment
  - Appropriate rigor
  - Safe instructional content

----------------------------------------

OUTPUT RULES:

- Do NOT use markdown headings (#, ##, etc.)
- Use clean formatting
- Make it readable and professional
- No unnecessary fluff
- No slide instructions

End with:
<<END LESSON>>
`;

  return `
OUTPUT FORMAT (MANDATORY FOR PACING PLAN):
- Use clean Markdown with blank lines between sections.
- Do NOT use any markdown headings (#, ##, ###, ####).
- Any “chart/table” MUST be a Markdown table (with | pipes).
- The pacing plan MUST be a scope & sequence that a teacher can follow DAY BY DAY.
- Every sequence row MUST include: duration, what to teach, standard focus, prerequisites, checks/exit, and catch-up plan.
- The plan MUST fit the teacher's lesson cycle segments.
- End output with:
<<END PACING PLAN>>

${skeleton}
`.trim();
}
function normalizeMode(req: GenerateLessonRequest): "lite" | "full" {
  const m = String(req.mode || "").trim().toLowerCase();
  if (m === "full") return "full";
  if (m === "lite") return "lite";
  if (m === "full_lesson") return "full";
  if (m === "internalization") return "full";
  if (m === "one_pager") return "lite";
  if (m === "sub_plan") return "lite";
  if (m === "pacing_plan") return "full";
  return "lite";
}

function normalizeOutputStyle(raw?: string): OutputStyle {
  const v = String(raw || "teacher_only").trim().toLowerCase();
  if (v === "teacher_only") return "teacher_only";
  if (v === "student_only") return "student_only";
  if (v === "quick_plan") return "quick_plan";
  if (v === "assessment_only") return "assessment_only";
  return "teacher_only";
}

function safeArrayAny(input?: string | string[], max = 20): string[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : String(input).split(/[\n,]/g);
  return arr
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function safeArray(arr?: string[], max = 12) {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max);
}

function buildPublisherLabel(req: GenerateLessonRequest) {
  const p = (req.publisher || "").trim();
  if (!p) return "Unspecified Publisher";
  if (p.toLowerCase() === "other") {
    const other = (req.publisherOther || "").trim();
    return other ? other : "Other Publisher (unspecified)";
  }
  return p;
}

function resolveModel(modelRaw?: string): string {
  const m = (modelRaw || "gpt-4o-mini").trim().toLowerCase();
  if (m === "fast") return "gpt-4o-mini";
  if (m === "best") return "gpt-5";
  if (m === "gpt5") return "gpt-5";
  if (m === "gpt-5") return "gpt-5";
  if (m === "gpt-4o-mini") return "gpt-4o-mini";
  if (m === "gpt-4o") return "gpt-4o";
  if (m === "gpt-4.1-mini") return "gpt-4.1-mini";
  if (m === "gpt-4.1") return "gpt-4.1";
  return modelRaw || "gpt-4o-mini";
}

function getOpenAIParams(
  mode: "lite" | "full",
  style: OutputStyle,
  heavy: boolean,
) {
  const baseTimeout = heavy ? 120000 : 135000;

  if (style === "assessment_only")
    return { max_output_tokens: heavy ? 2400 : 1400, timeoutMs: baseTimeout };
  if (style === "quick_plan")
    return { max_output_tokens: heavy ? 2800 : 1700, timeoutMs: baseTimeout };
  if (style === "teacher_only")
    return {
      max_output_tokens: heavy
        ? mode === "lite"
          ? 3200
          : 1800
        : mode === "lite"
          ? 2000
          : 2800,
      timeoutMs: baseTimeout,
    };
  if (style === "student_only")
    return {
      max_output_tokens: heavy
        ? mode === "lite"
          ? 3200
          : 1800
        : mode === "lite"
          ? 2100
          : 2900,
      timeoutMs: baseTimeout,
    };
  return {
    max_output_tokens: heavy
      ? mode === "lite"
        ? 3800
        : 1800
      : mode === "lite"
        ? 2500
        : 3600,
    timeoutMs: baseTimeout,
  };
}

function normalizeGenre(raw?: string): Genre {
  const g = (raw || "informational").toLowerCase().trim();
  if (g === "fiction") return "fiction";
  if (g === "nonfiction") return "nonfiction";
  if (g === "poem" || g === "poetry") return "poetry";
  if (g === "drama" || g === "play") return "drama";
  if (g === "argument" || g === "argumentative" || g === "persuasive")
    return "argumentative";
  if (g === "scenario" || g === "scenario-based") return "scenario";
  return "informational";
}

function toGradeNumber(grade: string | number | undefined) {
  const n = Number(grade);
  return Number.isFinite(n) ? n : 0;
}

function slangWhitelistForGrade(gradeNum: number) {
  const g3to5 = [
    "rizz",
    "sus",
    "clutch",
    "W",
    "L",
    "NPC",
    "AFK",
    "GG",
    "glitch",
    "speedrun",
    "no cap",
    "lowkey",
    "skibidi",
  ];
  const g6to8 = [
    ...g3to5,
    "bussin",
    "ratio",
    "bet",
    "fr",
    "imagine",
    "main character energy",
    "locked in",
    "spawn",
  ];
  const g9to12 = [...g6to8, "canon event", "delulu", "it's giving", "rent-free"];

  if (gradeNum <= 2) return [];
  if (gradeNum <= 5) return g3to5;
  if (gradeNum <= 8) return g6to8;
  return g9to12;
}

/* =========================================================
   ✅ Normalizers for SQL-loaded curriculum consistency
   ========================================================= */
function normLower(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function normalizeStateValue(raw: any): string {
  const s = normLower(raw);
  if (!s) return "";
  if (s === "tx" || s === "texas") return "Texas";
  if (s === "ca" || s === "california") return "California";
  return String(raw ?? "").trim();
}

function normalizePublisherValue(raw: any): string {
  const s = normLower(raw);
  if (!s) return "";
  if (s.includes("bluebonnet")) return "Bluebonnet Learning (TX OER)";
  return String(raw ?? "").trim();
}

/* =========================================================
   ✅ District Rigor detection + checks
   ========================================================= */
function looksLikeDistrictRigor(text: string) {
  const t = String(text || "").toUpperCase();
  return (
    t.includes("DISTRICT RIGOR") ||
    t.includes("NO DIRECT TRAIT LABELING") ||
    t.includes("STAAR SHORT CONSTRUCTED RESPONSE SCORING GUIDE") ||
    t.includes("PREDICTED INCORRECT RESPONSES") ||
    t.includes("IF/THEN RETEACH") ||
    t.includes("TEKS UNPACKING BOX")
  );
}

function containsDirectTraitLabeling(t: string) {
  const bad = [
    /\bwas known for (his|her|their)\b/i,
    /\bwas brave\b/i,
    /\bwas kind\b/i,
    /\bwas selfish\b/i,
    /\bwas generous\b/i,
    /\bwas determined\b/i,
    /\bwas courageous\b/i,
    /\brevealed (his|her|their) bravery\b/i,
    /\bshowed (his|her|their) kindness\b/i,
    /\bknown for (his|her|their) kindness\b/i,
    /\bhis journey.*revealed his bravery\b/i,
  ];
  return bad.some((r) => r.test(t));
}

/* =========================================================
   PAYWALL: subscriptions table
   ========================================================= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function parseJwtFromAuthHeader(req: Request) {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
}

function isoToMs(iso: string | null | undefined) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/* =========================================================
   ✅ Phase 1 → Phase 2: non-blocking logging to lesson_generations
   ========================================================= */
async function logLessonGenerationNonBlocking(args: {
  admin: any;
  userId: string;
  payload: any;
  debugReqId: string;
}) {
  try {
    const { admin, userId, payload, debugReqId } = args;

    const safePayload = payload ?? {};
    let request_json: any = safePayload;

    try {
      const text = JSON.stringify(safePayload);
      if (text.length > 900_000) {
        request_json = { ...safePayload, _truncated: true };
      }
    } catch {
      request_json = { _stringify_failed: true };
    }

    const { error } = await admin.from("lesson_generations").insert({
      user_id: userId,
      request_json,
    });

    if (error) {
      console.log(
        `[${debugReqId}] lesson_generations insert failed:`,
        error.message,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[${args.debugReqId}] lesson_generations logger crashed:`, msg);
  }
}

/* =========================================================
   ✅ Paywall now returns {blocked, userId}
   ========================================================= */
async function enforcePlanOrBlock(
  req: Request,
  debugReqId: string,
): Promise<{ blocked: Response | null; userId: string | null }> {
  const jwt = parseJwtFromAuthHeader(req);
  if (!jwt) {
    return {
      blocked: jsonResponse(
        {
          ok: false,
          code: "AUTH_REQUIRED",
          error: "Missing Authorization bearer token.",
          debugReqId,
        },
        401,
      ),
      userId: null,
    };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      blocked: jsonResponse(
        {
          ok: false,
          code: "SERVER_MISCONFIG",
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in secrets.",
          debugReqId,
        },
        500,
      ),
      userId: null,
    };
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: u, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !u?.user?.id) {
    return {
      blocked: jsonResponse(
        {
          ok: false,
          code: "INVALID_SESSION",
          error: "Invalid session. Please log in again.",
          debugReqId,
        },
        401,
      ),
      userId: null,
    };
  }

  const userId = u.user.id;

  const { data: sub, error: sErr } = await admin
    .from("subscriptions")
    .select("status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("is_comped")
    .eq("id", userId)
    .maybeSingle();

  if (pErr) {
    return {  
      blocked: jsonResponse(
        {
          ok: false,
          code: "PROFILE_LOOKUP_FAILED",
          error: pErr.message,
          debugReqId,
        },
        500,
      ),
      userId: null,
    };
  }

  const isComped = profile?.is_comped === true;
  if (isComped) {
    return { blocked: null, userId };
  }

  if (sErr) {
    return {
      blocked: jsonResponse(
        {
          ok: false,
          code: "SUBSCRIPTION_LOOKUP_FAILED",
          error: sErr.message,
          debugReqId,
        },
        500,
      ),
      userId: null,
    };
  }

  const status = String(sub?.status || "none").toLowerCase();

  const allowed = ["trialing", "active", "canceled", "cancelled"].includes(
    status,
  );

  if (!allowed) {
    return {
      blocked: jsonResponse(
        {
          ok: false,
          code: "PLAN_REQUIRED",
          error: "Subscription required. Start a free trial or activate a plan.",
          subscription_status: status,
          debugReqId,
        },
        402,
      ),
      userId: null,
    };
  }

  const periodEndMs = isoToMs(sub?.current_period_end as any);

  if (!periodEndMs) {
    if (status === "active" || status === "trialing") {
      return { blocked: null, userId };
    }

    return {
      blocked: jsonResponse(
        {
          ok: false,
          code: "SUBSCRIPTION_NOT_READY",
          error:
            "Subscription status not fully synced yet. Please refresh in 30 seconds or contact support.",
          subscription_status: status,
          current_period_end: sub?.current_period_end ?? null,
          debugReqId,
        },
        402,
      ),
      userId: null,
    };
  }

  if (periodEndMs >= Date.now()) {
    return { blocked: null, userId };
  }

  return {
    blocked: jsonResponse(
      {
        ok: false,
        code: "SUBSCRIPTION_EXPIRED",
        error:
          "Your subscription period ended. Please renew or update billing.",
        subscription_status: status,
        current_period_end: sub?.current_period_end ?? null,
        debugReqId,
      },
      402,
    ),
    userId: null,
  };
}

/* =========================================================
   Normalize payload from main.ts + HTML
   ========================================================= */
function normalizePayload(p: GenerateLessonRequest): GenerateLessonRequest {
  const out: GenerateLessonRequest = { ...p };

  out.outputStyle = normalizeOutputStyle(p.outputStyle as any);

  const m = String(p.mode || "").trim().toLowerCase();

  if (m === "pacing_plan" || m === "pacing") {
    if (!p.outputStyle) out.outputStyle = "teacher_only";
  } else {
    if (m === "internalization") out.outputStyle = "teacher_only";
    if (m === "one_pager") out.outputStyle = "quick_plan";
    if (m === "sub_plan") out.outputStyle = "teacher_only";
    if (m === "full_lesson") out.outputStyle = "teacher_only";
  }

  const optAny = (p as any).options as any;
  if (!out.subNotes && typeof optAny?.subNotes === "string")
    out.subNotes = optAny.subNotes;
  if (!out.worksheetPack && optAny?.worksheetPack)
    out.worksheetPack = optAny.worksheetPack as WorksheetPack;
  if (!out.unitMap && typeof (p as any).unitMap === "string")
    out.unitMap = (p as any).unitMap;

  const s = p.supports || {};
  out.options = out.options || {};
  if (typeof s.eb === "boolean") out.options.ebSupport = s.eb;
  if (typeof s.sped === "boolean") out.options.spedSupport = s.sped;
  if (typeof s.vocabulary === "boolean")
    out.options.vocabularyFocus = s.vocabulary;
  if (typeof s.writingExtension === "boolean")
    out.options.writingExtension = s.writingExtension;
  if (typeof s.cfus === "boolean")
    out.options.checksForUnderstanding = s.cfus;

  const pr = p.practice || {};
  if (typeof pr.enabled === "boolean")
    out.generatePracticePassageAndMCQs = pr.enabled;
  if (typeof pr.genre === "string") out.practiceGenre = normalizeGenre(pr.genre);
  if (typeof pr.topic === "string") out.practiceTopic = pr.topic;
  if (typeof pr.slangLevel === "string") out.slangLevel = pr.slangLevel as any;

  if (typeof pr.allowTrendy === "string")
    out.allowTrendyReferences = pr.allowTrendy.toLowerCase() === "yes";
  else if (typeof pr.allowTrendy === "boolean")
    out.allowTrendyReferences = pr.allowTrendy;

  if (out.lessonLengthMinutes == null) {
    const n = Number((p.lessonLength as any) ?? NaN);
    if (Number.isFinite(n) && n > 0) out.lessonLengthMinutes = n;
  }

  if (
    out.includeStaarStyleQuestions == null &&
    typeof p.includeStaar === "string"
  ) {
    out.includeStaarStyleQuestions = p.includeStaar.toLowerCase() === "yes";
  }

  if (!out.districtLessonCycleName && typeof p.lessonCycleTemplate === "string") {
    out.districtLessonCycleName = p.lessonCycleTemplate.trim();
  }

  out.options = out.options || {};
  if (typeof out.options.ebSupport !== "boolean") out.options.ebSupport = true;
  if (typeof out.options.spedSupport !== "boolean") out.options.spedSupport = true;
  if (typeof out.options.vocabularyFocus !== "boolean")
    out.options.vocabularyFocus = true;
  if (typeof out.options.checksForUnderstanding !== "boolean")
    out.options.checksForUnderstanding = true;
  if (typeof out.options.writingExtension !== "boolean")
    out.options.writingExtension = false;

  if (typeof out.allowTrendyReferences !== "boolean") out.allowTrendyReferences = true;
  if (!out.practiceGenre) out.practiceGenre = "informational";

  if (out.worksheetPack?.enabled) {
    const lvls = Array.isArray(out.worksheetPack.levels)
      ? out.worksheetPack.levels
      : ["beginner", "intermediate", "advanced"];
    out.worksheetPack.levels = lvls.filter(Boolean) as WorksheetLevel[];

    out.worksheetPack.questionCount = out.worksheetPack.questionCount || {};
    if (typeof out.worksheetPack.questionCount.beginner !== "number")
      out.worksheetPack.questionCount.beginner = 10;
    if (typeof out.worksheetPack.questionCount.intermediate !== "number")
      out.worksheetPack.questionCount.intermediate = 10;
    if (typeof out.worksheetPack.questionCount.advanced !== "number")
      out.worksheetPack.questionCount.advanced = 10;

    out.worksheetPack.engagementTheme = out.worksheetPack.engagementTheme || {};
    if (typeof out.worksheetPack.engagementTheme.enabled !== "boolean")
      out.worksheetPack.engagementTheme.enabled = false;
    if (!out.worksheetPack.engagementTheme.theme)
      out.worksheetPack.engagementTheme.theme = "none";
  }

  if (isPacingMode(out)) {
    out.pacing = normalizePacing(out);
    out.generatePracticePassageAndMCQs = false;
    out.worksheetPack = out.worksheetPack?.enabled
      ? { ...out.worksheetPack, enabled: false }
      : out.worksheetPack;
    out.includeStaarStyleQuestions = false;
  }

  out.state = normalizeStateValue(out.state);
  out.publisher = normalizePublisherValue(out.publisher);

  return out;
}

/*+=========================================================
   YouTube + Images link helpers
   ========================================================= */
function ytSearchLink(query: string) {
  const q = encodeURIComponent(query.trim());
  return `https://www.youtube.com/results?search_query=${q}`;
}

function imageSearchLink(query: string) {
  const q = encodeURIComponent(query.trim());
  return `https://www.google.com/search?tbm=isch&q=${q}`;
}

function cleanTopic(s: string) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/[(){}\[\]]/g, "")
    .trim()
    .slice(0, 120);
}

function compressCore(raw: string) {
  const s = String(raw || "").toLowerCase();

  const cleaned = s
    .replace(/students will/gi, "")
    .replace(/i can/gi, "")
    .replace(/be able to/gi, "")
    .replace(/and interpret/gi, "")
    .replace(/within real-world situations?/gi, "real world")
    .replace(/real-world/gi, "real world")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.includes("slope") && cleaned.includes("intercept"))
    return "slope intercept form";
  if (cleaned.includes("linear equation")) return "linear equations";
  if (cleaned.includes("proportional")) return "proportional relationships";

  return cleaned.split(" ").slice(0, 5).join(" ").trim() || "lesson topic";
}

function buildAttentionGetterLinks(
  gradeNum: number,
  subject: string,
  standardLabel: string,
  unit: string,
  title: string,
  skillFocus: string,
) {
  const subj = cleanTopic(subject || "Class");
  const tek = cleanTopic(standardLabel || "");
  const t = cleanTopic(title || "");
  const focus = cleanTopic(skillFocus || "");
  const u = cleanTopic(unit || "");

  const subjLower = subj.toLowerCase();

  const isReading =
    subjLower.includes("elar") ||
    subjLower.includes("ela") ||
    subjLower.includes("reading") ||
    subjLower.includes("rla") ||
    subjLower.includes("language arts") ||
    subjLower.includes("english");

  const coreRaw = focus || t || u || "";
  const core = compressCore(coreRaw);

  if (isReading) {
    const qA = `Grade ${gradeNum} ${subj} ${tek} ${core} mini lesson explicit instruction`.trim();
    const qB = `Grade ${gradeNum} ${subj} ${core} engaging hook discussion protocol turn and talk`.trim();

    return [
      `- [Video 1 (Mini-Lesson): ${qA}](${ytSearchLink(qA)})`,
      `- [Video 2 (Hook): ${qB}](${ytSearchLink(qB)})`,
    ].join("\n");
  }

  const miniLessonIntent =
    subjLower.includes("math")
      ? "worked example solve step by step guided practice"
      : subjLower.includes("science")
        ? "explain concept demo walkthrough"
        : subjLower.includes("social")
          ? "direct instruction mini lecture notes"
          : "mini lesson direct instruction";

  const hookIntent =
    subjLower.includes("math")
      ? "bell ringer warm up number talk desmos 3 act"
      : subjLower.includes("science")
        ? "phenomenon hook quick demo discrepant event"
        : subjLower.includes("social")
          ? "hook primary source image analysis short clip"
          : "engaging hook quick activity";

  const qA = `Grade ${gradeNum} ${subj} ${tek} ${core} ${miniLessonIntent}`.trim();
  const qB = `Grade ${gradeNum} ${subj} ${core} ${hookIntent}`.trim();

  return [
    `- [Video 1 (Mini-Lesson): ${qA}](${ytSearchLink(qA)})`,
    `- [Video 2 (Hook/Activity): ${qB}](${ytSearchLink(qB)})`,
  ].join("\n");
}

function teacherHeaderTitle(productMode: string) {
  const m = (productMode || "").toLowerCase().trim();
  if (m === "internalization")
    return "🧑‍🏫 TEACHER INTERNALIZATION (FOR THE TEACHER)";
  if (m === "one_pager") return "🧑‍🏫 ONE-PAGER PLAN (FOR THE TEACHER)";
  if (m === "sub_plan") return "🧑‍🏫 SUB PLAN (FOR THE TEACHER)";
  return "🧑‍🏫 FULL LESSON PLAN (FOR THE TEACHER)";
}
function lessonSkeletonByStrand(
  strandNumber: string,
  isBluebonnet: boolean,
  style: OutputStyle,
  assessmentsGateLabel: string,
  districtRigorOn: boolean
) {
  if (!isBluebonnet) {
    return lessonSkeleton(style, assessmentsGateLabel, districtRigorOn);
  }

  // 4.2 = Word Study
  if (strandNumber === "2") {
    return `
0) 🛡️ Admin-Safe Notice

1) 📘 Lesson Header

2) 🎯 Objective (Word Study Focus)

3) 🔤 Explicit Phonics / Morphology Instruction (I Do)

4) 🧩 Guided Word Work (We Do)

5) ✍️ Encoding + Application (You Do)

6) 🎟️ Exit Ticket (Spelling / Decoding Check)

19) 🛡️ Admin-Safe Footer

<<END LESSON>>
`.trim();
  }

  // 4.3 = Vocabulary
  if (strandNumber === "3") {
    return `
0) 🛡️ Admin-Safe Notice

1) 📘 Lesson Header

2) 🎯 Objective (Vocabulary Focus)

3) 📖 Context Clue Modeling (I Do)

4) 🧠 Word Analysis Practice (We Do)

5) 🗣️ Academic Discussion Using New Words

6) ✍️ Written Application Using Target Vocabulary

7) 🎟️ Exit Ticket (Context Clue Question)

19) 🛡️ Admin-Safe Footer

<<END LESSON>>
`.trim();
  }

  // Everything else (comprehension / literary)
  return lessonSkeleton(style, assessmentsGateLabel, districtRigorOn);
}
/* =========================================================
   ✅ Strict skeleton: plain numbered section lines ONLY (NO markdown headings)
   ========================================================= */
function lessonSkeleton(
  style: OutputStyle,
  assessmentsGateLabel: string,
  districtRigorOn: boolean,
) {
  const base = `
YOU MUST OUTPUT THE SKELETON BELOW EXACTLY (copy/paste), then fill content under each heading.
- Do NOT rename headings.
- Do NOT change numbering/emojis.
- Do NOT use ANY markdown headings (#, ##, ###, ####).
- Do NOT use horizontal rules (---).

0) 🛡️ Admin-Safe Notice

1) 📘 Lesson Header
Materials + Copies (Teacher + Sub)
- Print:
- Project:
- Handouts:
- Materials:

2) 🗺️ Curriculum Bridge Map
| Curriculum Components | Purpose |
|---|---|
| | |

3) ⏱️ Rehearsal Run-Through (60 seconds)

4) 🎯 Objective (I Can)

5) ✅ Success Criteria

6) 🧠 Objective, Misconceptions, & Assessment Connection
🧩 CFU Ladder (Tier 1/2/3)

7) 🗣️ Academic Vocabulary | Internalization

8) 🧱 Frontloading | Build Background Knowledge
🧾 Anchor Chart (Teacher-Ready)
| Concept | Description |
|---|---|
| | |
🧾 Anchor Chart Image Link (Search)

9) 🪜 Supporting Standards Scaffold Path
`.trim();

  const districtAddAfter9 = districtRigorOn
    ? `

9A) 🧾 TEKS Unpacking Box
- Standard label:
- Student-friendly “I can”:
- STAAR-style verbs (analyze, infer, support, explain):
- What mastery looks like (2 bullets):
- Common confusion (2 bullets):
- Evidence expectation (quote/paraphrase requirement):
`.trim()
    : "";

  const post11Base = `
10) 📊 Differentiation / Tier 2 Planning
🗣️ EB Sentence Stem Pack (Teacher-Ready)
- Provide 4–6 sentence stems aligned to the skillFocus
- Stems must support academic responses using evidence

🧑‍🏫 Teacher Moves
- Include:
  - what teacher says
  - what teacher looks for
  - how to respond if students are wrong

🧩 Scaffolds
- Break thinking into steps
- Provide guided prompts for struggling students

11) 🧠 Data-Informed Misconceptions
- Include 2–3 realistic student errors
- Include a quick teacher correction for each misconception

12) 🚀 Advanced Push
- Include 1 extension task requiring deeper thinking (DOK 3)
`.trim();
  const districtAddAfter17 = districtRigorOn
    ? `

17A) 🧪 STAAR Short Constructed Response Scoring Guide
- 0–2 or 0–3 point rubric (criteria + descriptors)
- What earns full credit (2 bullets)
- What drops points (2 bullets)

17B) 🧠 Predicted Incorrect Responses + Teacher Moves
- Wrong answer #1 → why students choose it → teacher move
- Wrong answer #2 → why students choose it → teacher move
- Wrong answer #3 → why students choose it → teacher move

17C) 🧩 If/Then Reteach Plan (Exit Ticket)
- If <50% correct → reteach move + 5-min task
- If 50–79% correct → targeted small group + 5-min task
- If 80%+ correct → extension + 5-min task
`.trim()
    : "";

  if (style === "teacher_only") {
    return `
${base}
${districtAddAfter9}

${post11Base}

11A) 🧑‍🏫 Sub Plan Notes & Procedures (ONLY if Mode is sub_plan)

${assessmentsGateLabel ? `${assessmentsGateLabel}` : ""}

19) 🛡️ Admin-Safe Footer

<<END LESSON>>
`.trim();
  }

 if (style === "student_only") {
    return `
${base}
${districtAddAfter9}

${post11Base}

12) 🚪 Lesson Opening (Minute X–Y)
🎬 Attention Getter Videos (Choose 1)

13) 🧠 Mini-Lesson (I Do) (Minute X–Y)

14) 🤝 Guided Practice (We Do) (Minute X–Y)

15) 🧩 Collaborative Practice (Minute X–Y)

16) ✍️ Independent Practice (Minute X–Y)

17) 🎟️ Exit Ticket (Minute X–Y)
${districtAddAfter17}

${assessmentsGateLabel ? `${assessmentsGateLabel}` : ""}

18) 🛡️ Admin-Safe Footer

<<END LESSON>>
`.trim();
  }

  if (style === "quick_plan") {
    return `
YOU MUST OUTPUT THE SKELETON BELOW EXACTLY (copy/paste), then fill content under each heading.
- Do NOT rename headings.
- Do NOT change numbering/emojis.
- Do NOT use ANY markdown headings (#, ##, ###, ####).
- Do NOT use horizontal rules (---).

0) 🛡️ Admin-Safe Notice

1) 📘 Lesson Header
Materials + Copies (Teacher + Sub)
- Print:
- Project:
- Handouts:
- Materials:

2) 🎯 Objective (I Can) + Success Criteria

3) 🧠 Top 3 Misconceptions + Fix

4) 🗣️ Key Vocabulary (5–8 words)

5) 🪜 Lesson Flow (Do Now → I Do → We Do → You Do → Exit)

6) 🧩 CFU Ladder (Tier 1/2/3)

7) 🎟️ Exit Ticket (3 items + answers)

${
  districtRigorOn
    ? `
7A) 🧾 TEKS Unpacking Box
7B) 🧪 STAAR Short Constructed Response Scoring Guide
7C) 🧠 Predicted Incorrect Responses + Teacher Moves
7D) 🧩 If/Then Reteach Plan (Exit Ticket)
`.trim()
    : ""
}

${assessmentsGateLabel ? `${assessmentsGateLabel}` : ""}

19) 🛡️ Admin-Safe Footer

<<END LESSON>>
`.trim();
  }

  if (style === "assessment_only") {
    return `
YOU MUST OUTPUT THE SKELETON BELOW EXACTLY (copy/paste), then fill content under each heading.
- Do NOT rename headings.
- Do NOT change numbering/emojis.
- Do NOT use ANY markdown headings (#, ##, ###, ####).
- Do NOT use horizontal rules (---).

0) 🛡️ Admin-Safe Notice

1) 🎟️ Exit Ticket (6 items)
- Must include Bloom/DOK label for each item
- Must include answer key + 1-sentence rationale each

${
  districtRigorOn
    ? `
1A) 🧪 STAAR Short Constructed Response Scoring Guide
1B) 🧠 Predicted Incorrect Responses + Teacher Moves
1C) 🧩 If/Then Reteach Plan (Exit Ticket)
`.trim()
    : ""
}

${assessmentsGateLabel ? `${assessmentsGateLabel}` : ""}

19) 🛡️ Admin-Safe Footer

<<END LESSON>>
`.trim();
  }

  return `
${base}
${districtAddAfter9}

${post11Base}

12) 🚪 Lesson Opening (Minute X–Y)
🎬 Attention Getter Videos (Choose 1)

13) 🧠 Mini-Lesson (I Do) (Minute X–Y)

14) 🤝 Guided Practice (We Do) (Minute X–Y)

15) 🧩 Collaborative Practice (Minute X–Y)

16) ✍️ Independent Practice (Minute X–Y)

17) 🎟️ Exit Ticket (Minute X–Y)
${districtAddAfter17}

${assessmentsGateLabel ? `${assessmentsGateLabel}` : ""}

19) 🛡️ Admin-Safe Footer

<<END LESSON>>
`.trim();
}

function outputFormatBlock(
  style: OutputStyle,
  productMode: string,
  assessmentsGateLabel: string,
  districtRigorOn: boolean,
  strandNumber: string,
  isBluebonnet: boolean,
){
  const baseHeader = `
OUTPUT FORMAT (MANDATORY):
- Output MUST be clean Markdown (presentable) BUT WITH NO MARKDOWN HEADINGS.
- Do NOT use any heading syntax: #, ##, ###, ####.
- Section titles must be plain numbered lines exactly like: "1) 📘 Lesson Header"
- Do NOT nest sections.
- Do NOT use horizontal rules (---).
- Any “chart/table” MUST be a Markdown table using | pipes.
- Leave exactly one blank line between numbered sections.
- End output with:
<<END LESSON>>
`.trim();

  const teacherTitle = teacherHeaderTitle(productMode);
  const skeleton = lessonSkeletonByStrand(
  strandNumber,
  isBluebonnet,
  style,
  assessmentsGateLabel,
  districtRigorOn
);
  if (style === "teacher_only") {
    return `
${baseHeader}

${teacherTitle}

SKELETON (COPY/PASTE REQUIRED):
${skeleton}
`.trim();
  }

  if (style === "student_only") {
    return `
${baseHeader}

🎒 STUDENT-FACING LESSON (WHAT YOU TEACH TO STUDENTS)
(Include timestamps + Teacher Says / Students Do / CFU / If Wrong → Reteach)

LESSON STRUCTURE (MANDATORY — ALL SECTIONS MUST BE PRESENT):
${skeleton}

CRITICAL REQUIREMENTS:

- You MUST include ALL sections from the structure
- Sections 10–12 are REQUIRED and may NOT be skipped:
  • Differentiation (must include sentence stems, teacher moves, scaffolds)
  • Misconceptions (must include errors + teacher corrections)
  • Advanced Push (must include deeper thinking task)

- You may adapt wording, but NOT remove sections
- You may expand sections for clarity and quality
- If any section is missing, the lesson is INVALID
${skeleton}
`.trim();
  }

  if (style === "quick_plan") {
    return `
${baseHeader}

🧑‍🏫 QUICK PLAN (FAST)

LESSON STRUCTURE (MUST INCLUDE ALL SECTIONS, BUT MAY ADAPT WORDING):
${skeleton}
`.trim();
  }

  if (style === "assessment_only") {
    return `
${baseHeader}

🧪 ASSESSMENT PACK

LESSON STRUCTURE (MUST INCLUDE ALL SECTIONS, BUT MAY ADAPT WORDING):
${skeleton}
`.trim();
  }

 return `
${baseHeader}

${teacherTitle}

LESSON STRUCTURE (MUST INCLUDE ALL SECTIONS, BUT MAY ADAPT WORDING):
${skeleton}
`.trim();
}

/* =========================================================
   ✅ Curriculum Brain (Level 1/2)
   ========================================================= */
type CurriculumContext = {
  foundLesson: boolean;
  lessonRow?: any;
  components?: Record<string, any>;
  playbook?: any;
  debug: {
    attempted: boolean;
    campusId?: string | null;
    programName?: string | null;
    lessonCode?: string | null;
    lessonId?: string | null;
    componentTypes?: string[];
    foundPlaybook: boolean;
    playbookSubjectSearched?: string | null;
  };
};

function normalizeSubjectForPlaybook(subjectRaw: any): string {
  const s = String(subjectRaw ?? "").trim();
  const lower = s.toLowerCase();
  if (
    lower === "reading" ||
    lower === "ela" ||
    lower === "rla" ||
    lower.includes("language arts") ||
    lower.includes("english")
  ) {
    return "ELAR";
  }
  if (lower === "social studies" || lower === "social-studies")
    return "Social Studies";
  if (lower === "science") return "Science";
  if (lower === "math" || lower === "mathematics") return "Math";
  if (lower === "elar") return "ELAR";
  return s;
}
async function fetchEnginePlaybooks(admin:any, subject:string, grade:any) {

  const subjectSafe = String(subject || "").replace("'", "");

  const gradeNum = Number(grade);

  const gradeBand =
    gradeNum <= 2 ? "K-2" :
    gradeNum <= 5 ? "3-5" :
    gradeNum <= 8 ? "6-8" : "9-12";

  const { data } = await admin
    .from("ai_playbooks")
    .select("*")
    .or(`layer.eq.subject_engine,layer.eq.staar_engine,layer.eq.ttess_engine,layer.eq.publisher_alignment`)
    .or(`subject.eq.${subjectSafe},subject.is.null`)
    .or(`grade_band.eq.${gradeBand},grade_band.is.null`);

  return data || [];
}

async function fetchLessonRow(
  admin: any,
  payload: GenerateLessonRequest,
): Promise<any | null> {
  const campusId = (payload.campusId || "").trim();
  const programName = (payload.programName || "").trim();
  const lessonCode = (payload.curriculumLessonCode || "").trim();

  const unit = (payload.curriculumUnit || "").trim();
  const lessonTitle = (payload.curriculumLesson || "").trim();

  let q = admin
    .from("curriculum_lessons")
    .select(
      "id,campus_id,program_name,state,publisher,grade,subject,unit_name,lesson_title,lesson_code,standard_label,skill_focus",
    );

  if (campusId) q = q.eq("campus_id", campusId);
  if (programName) q = q.ilike("program_name", programName);

  if (lessonCode) {
    const { data, error } = await q
      .ilike("lesson_code", lessonCode)
      .order("id", { ascending: false })
      .limit(1);

    if (!error && Array.isArray(data) && data.length) return data[0];
  }

  if (unit && lessonTitle) {
    const { data, error } = await q
      .ilike("unit_name", unit)
      .ilike("lesson_title", lessonTitle)
      .order("id", { ascending: false })
      .limit(1);

    if (!error && Array.isArray(data) && data.length) return data[0];
  }

  return null;
}

async function fetchLessonComponents(
  admin: any,
  lessonId: string,
): Promise<Record<string, any>> {
  const { data, error } = await admin
    .from("lesson_components")
    .select("component_type,component_json")
    .eq("lesson_id", lessonId);

  if (error || !Array.isArray(data)) return {};
  const out: Record<string, any> = {};
  for (const row of data) {
    const k = String(row?.component_type || "").trim();
    if (!k) continue;
    out[k] = row?.component_json ?? null;
  }
  return out;
}

function stringifyJsonSafe(x: any, maxChars = 6000) {
  try {
    const s = JSON.stringify(x, null, 2);
    if (s.length <= maxChars) return s;
    return s.slice(0, maxChars) + "\n...<TRUNCATED>...";
  } catch {
    return String(x ?? "");
  }
}

function buildCurriculumContextBlock(ctx: CurriculumContext) {
  const has = Boolean(ctx.foundLesson);
  if (!has) {
    return `
CURRICULUM CONTEXT (LEVEL 1/2):
- No structured curriculum lesson context found in database for this request.
- You must proceed using ONLY the user inputs.
- Do NOT invent missing publisher specifics. Use generic language where needed.
`.trim();
  }

  const lessonMeta = ctx.lessonRow
    ? `
LESSON META (from DB):
${stringifyJsonSafe(
  {
    lesson_code: ctx.lessonRow.lesson_code,
    unit_name: ctx.lessonRow.unit_name,
    lesson_title: ctx.lessonRow.lesson_title,
    grade: ctx.lessonRow.grade,
    subject: ctx.lessonRow.subject,
    standard_label: ctx.lessonRow.standard_label,
    skill_focus: ctx.lessonRow.skill_focus,
    program_name: ctx.lessonRow.program_name,
    state: ctx.lessonRow.state,
    publisher: ctx.lessonRow.publisher,
  },
  3500,
)}
`.trim()
    : "";

  const componentsKeys = ctx.components ? Object.keys(ctx.components) : [];
  const comps =
    componentsKeys.length > 0
      ? `
LESSON COMPONENTS (from DB lesson_components):
- Available component_types: ${componentsKeys.join(", ")}

COMPONENT PAYLOADS:
${stringifyJsonSafe(ctx.components, 8000)}
`.trim()
      : `
LESSON COMPONENTS (from DB lesson_components):
- None found for this lesson_id.
`.trim();

  return `
CURRICULUM CONTEXT (LEVEL 1/2) — USE AS GROUND TRUTH:
- If DB provides lesson meta/components, you MUST align output to it.
- If DB does NOT provide a detail, do NOT invent it; use generic language.

${lessonMeta}

${comps}
`.trim();
}

function buildPlaybookInstructionsBlock(playbooks: any[]) {

  if (!playbooks || !playbooks.length) return "";

  return playbooks.map(pb => `
ENGINE: ${pb.name}

${pb.instructions || ""}

${pb.playbook_json ? stringifyJsonSafe(pb.playbook_json,8000) : ""}
`).join("\n\n");

}

async function getCurriculumContext(
  admin: any,
  payload: GenerateLessonRequest,
): Promise<CurriculumContext> {
  const campusId = (payload.campusId || "").trim() || null;
  const programName = (payload.programName || "").trim() || null;
  const lessonCode = (payload.curriculumLessonCode || "").trim() || null;

  const playbookSubject =
    normalizeSubjectForPlaybook(payload.subject || "") || null;

  const ctx: CurriculumContext = {
    foundLesson: false,
    components: {},
    playbook: null,
    debug: {
      attempted: true,
      campusId,
      programName,
      lessonCode,
      lessonId: null,
      componentTypes: [],
      foundPlaybook: false,
      playbookSubjectSearched: playbookSubject,
    },
  };

  const engines = await fetchEnginePlaybooks(
  admin,
  payload.subject,
  payload.grade
);

ctx.playbook = engines;
ctx.debug.foundPlaybook = engines.length > 0;

  let lessonRow: any | null = null;
  try {
    lessonRow = await fetchLessonRow(admin, payload);
  } catch {
    lessonRow = null;
  }

  if (!lessonRow?.id) return ctx;

  ctx.foundLesson = true;
  ctx.lessonRow = lessonRow;
  ctx.debug.lessonId = String(lessonRow.id);

  try {
    const comps = await fetchLessonComponents(admin, String(lessonRow.id));
    ctx.components = comps;
    ctx.debug.componentTypes = Object.keys(comps);
  } catch {
    ctx.components = {};
    ctx.debug.componentTypes = [];
  }

  return ctx;
}

/* =========================================================
   ✅ ELITE SECTION 16 + SECTION 18 PROMPT BLOCKS
   ========================================================= */
function section16AcademicParagraphFrameBlock(args: {
  subject: string;
  skillFocus: string;
  standard: string;
  curriculumUnit?: string;
  curriculumLesson?: string;
}) {
  const subject = String(args.subject || "Class").trim();
  const skillFocus = String(args.skillFocus || "target skill").trim();
  const standard = String(args.standard || "standard").trim();
  const unit = String(args.curriculumUnit || "").trim();
  const lesson = String(args.curriculumLesson || "").trim();

  return `
SECTION 16 WRITING REQUIREMENT (MANDATORY):
- In section "16) ✍️ Independent Practice (Minute X–Y)", you MUST include a teacher-ready writing task using CER.
- The writing task MUST be aligned to:
  • Subject: ${subject}
  • Skill Focus: ${skillFocus}
  • Standard Label: ${standard}
  • Unit/Lesson: ${unit} / ${lesson}
- Provide:
  1) A 1-sentence prompt students respond to
  2) A CER paragraph frame (Claim/Evidence/Reasoning) with sentence stems
  3) A short exemplar (5–7 sentences) that stays GENERAL if content specifics are missing
- REQUIRED VOCAB USAGE:
  Students MUST use at least TWO academic vocabulary words from Section 7 in their response.
  Include a line in section 16 that says: "Must use at least TWO academic vocabulary words: ____ , ____"
- If Social Studies or Science, require at least 2 pieces of evidence (from notes/doc).
`.trim();
}

function getStrandAnchor(state: string, subject: string, standard: string): string {
  if (!state || !subject || !standard) return "";

  const s = state.toLowerCase();
  const subj = subject.toLowerCase();
  const std = standard.trim();

  // TEXAS (TEKS)
  if (s === "texas" && std.toLowerCase().includes("teks")) {
    const match = std.match(/\d+\.(\d+)/);
    if (!match) return "";
    const strand = match[1];

   const texasStrands: any = {
  elar: {
    "1": "Foundational literacy skills (phonics, decoding, fluency).",
    "2": "Word study and phonological awareness.",
    "3": "Vocabulary development and context clues.",
    "4": "Response skills (text-based responses).",
    "6": "Literary elements (character, plot, theme).",
    "7": "Informational text elements and author's purpose."
  },
  math: {
    "2": "Number and operations.",
    "3": "Algebraic reasoning.",
    "4": "Geometry and measurement.",
    "5": "Data analysis."
  },
  science: {
    "1": "Scientific investigation practices.",
    "2": "Matter and energy.",
    "3": "Force and motion.",
    "4": "Earth and space systems.",
    "5": "Organisms and environments."
  },
  "social studies": {
    "1": "History and historical thinking.",
    "2": "Geography.",
    "3": "Economics.",
    "4": "Government and citizenship."
  }
};

    return texasStrands[subj]?.[strand] || "";
  }

  // CCSS (Reading + Math)
  if (std.toUpperCase().includes("CCSS")) {
    if (subj === "elar") {
      if (std.includes(".RL.")) return "Reading Literature standards.";
      if (std.includes(".RI.")) return "Reading Informational Text standards.";
      if (std.includes(".RF.")) return "Foundational reading skills.";
      if (std.includes(".L.")) return "Language and vocabulary.";
    }
    if (subj === "math") {
      if (std.includes(".OA.")) return "Operations and Algebraic Thinking.";
      if (std.includes(".NBT.")) return "Number and Base Ten.";
      if (std.includes(".NF.")) return "Fractions.";
      if (std.includes(".MD.")) return "Measurement and Data.";
      if (std.includes(".G.")) return "Geometry.";
    }
  }

  // NGSS
  if (std.includes("-PS")) return "Physical Science.";
  if (std.includes("-LS")) return "Life Science.";
  if (std.includes("-ESS")) return "Earth and Space Science.";

  // C3
  if (std.startsWith("D1")) return "Developing questions and planning inquiries.";
  if (std.startsWith("D2")) return "Applying disciplinary concepts.";
  if (std.startsWith("D3")) return "Evaluating sources and evidence.";
  if (std.startsWith("D4")) return "Communicating conclusions.";

  return "";

}
/* =========================================================
   🧠 Instructional Backbone (Universal Enforcement Layer)
   ========================================================= */

type InstructionalBackbone = {
  enforceCfuLadder: boolean;
  enforceAssessmentMirroring: boolean;
  enforceEvidenceLanguage: boolean;
  enforceTekUnpacking: boolean;
  enforceRigorFromVerb: boolean;
  enforceDistrictOverrides: boolean;
  enforceStrandAlignment: boolean;
  enforceOriginalText: boolean;
  enforceLineNumbers: boolean;
  enforceWritingBlock: boolean;
};

function buildInstructionalBackbone(args: {
  payload: GenerateLessonRequest;
  districtRigorOn: boolean;
  strandAnchor: string;
  assessmentsOn: boolean;
  isELAR: boolean;
  pacingMode: boolean;
}) : InstructionalBackbone {

  const { payload, districtRigorOn, strandAnchor, assessmentsOn, isELAR, pacingMode } = args;

  return {
    enforceCfuLadder: true,
    enforceAssessmentMirroring: assessmentsOn,
    enforceEvidenceLanguage: true,
    enforceTekUnpacking: true,
    enforceRigorFromVerb: Boolean(payload._dokTarget),
    enforceDistrictOverrides: districtRigorOn,
    enforceStrandAlignment: Boolean(strandAnchor),
    enforceOriginalText: assessmentsOn && !pacingMode,
    enforceLineNumbers: Boolean(payload._requiresLineNumbers) || (isELAR && assessmentsOn),
    enforceWritingBlock: Boolean(payload._writingRequired)
  };
}
/* =========================================================
   Prompt builder
   ========================================================= */
function buildInstructions(
  reqRaw: GenerateLessonRequest,
  curriculumContextBlock: string,
  playbookBlock: string,
  backbone: InstructionalBackbone
){
  const req = normalizePayload(reqRaw);
  const districtRigorOn = backbone.enforceDistrictOverrides;
  const pacingMode = isPacingMode(req);
  const pacing = pacingMode ? (normalizePacing(req) as any) : null;

  const mode = normalizeMode(req);
  const style = normalizeOutputStyle(req.outputStyle as any);
  const publisher = buildPublisherLabel(req);
const state = (req.state || "").trim();

const isBluebonnet =
  publisher.toLowerCase().includes("bluebonnet") &&
  state.toLowerCase() === "texas";

  const productMode = String(req.mode || "").trim().toLowerCase();

  const grade = req.grade ?? "";
  const gradeNum = toGradeNumber(req.grade);
  const subject = (req.subject ?? "").trim();
  const subjectLower = subject.toLowerCase();
  const isELAR =
    subjectLower === "elar" ||
    subjectLower === "ela" ||
    subjectLower.includes("english") ||
    subjectLower.includes("language arts") ||
    subjectLower.includes("reading") ||
    subjectLower.includes("rla");

  const standard = (req.standard ?? "").trim();
  const strandMatch = standard.match(/\d+\.(\d+)/);
  const strandNumber = strandMatch ? strandMatch[1] : "";
  const skillFocus = (req.skillFocus ?? "").trim() || standard;
  const verb = req._verb ?? "";
  const dok = req._dokTarget ?? "";
  // ===============================
// 🎯 Rigor Injection (DOK Engine)
// ===============================
const rigorBlock = req._dokTarget
  ? `
RIGOR REQUIREMENTS (MANDATORY):
- Cognitive Verb: ${req._verb || "N/A"}
- Target DOK Level: ${req._dokTarget}

QUESTION DISTRIBUTION (STRICT):
- DOK 1: ${req._questionMix?.dok1 ?? 1}
- DOK 2: ${req._questionMix?.dok2 ?? 2}
- DOK 3: ${req._questionMix?.dok3 ?? 1}

You MUST strictly follow this distribution when generating:
- Exit Tickets
- Section 18 questions
- MCQs
- STAAR-style questions

Label each question with its DOK level.
`
  : "";
  const supportingStandards = safeArrayAny(req.supportingStandards, 10);
  const strandAnchor = req._strand || "";
const strandInjection = backbone.enforceStrandAlignment
  ? `
STRAND ALIGNMENT CONTEXT:
The provided standard belongs to a strand focused on:
"${strandAnchor}"

CRITICAL ALIGNMENT RULE:
The lesson MUST ONLY target this strand.
If the strand is vocabulary, the lesson must focus on word meaning, morphology, or context clues.
If the strand is phonics/word study, the lesson must focus on decoding, encoding, spelling, or morphology.
If the strand is comprehension, focus on inference, key ideas, synthesis.
If the strand is literary elements, focus on plot, character, theme, or setting.

DO NOT generate comprehension or character analysis if the standard belongs to vocabulary or word study.
`
  : "";

  const unit = (req.curriculumUnit ?? "").trim();
  const lesson = (req.curriculumLesson ?? "").trim();
  const title = (req.textTitle ?? "").trim();
  const minutes = req.lessonLengthMinutes ?? 45;

 

  const publisherComponents = safeArrayAny(req.publisherComponents, 12);
  const districtCycle = (req.districtLessonCycleName || "").trim();

  const weakestSkillNotes = safeArray(req.performanceInsights?.weakestSkillNotes);
  const misconTags = safeArray(req.performanceInsights?.misconceptionTags);
  const distractorPatterns = safeArray(req.performanceInsights?.distractorPatterns);
  const perfSource = (req.performanceInsights?.sourceName || "").trim();

  const practiceOn = pacingMode ? false : Boolean(req.generatePracticePassageAndMCQs);
  const worksheetOn = pacingMode ? false : Boolean(req.worksheetPack?.enabled);
  const assessmentsOn = pacingMode ? false : practiceOn || worksheetOn;

  const staarOn = pacingMode
    ? false
    : Boolean(req.includeStaarStyleQuestions) || assessmentsOn;

  const slangLevel = (req.slangLevel ?? "light") as "none" | "light" | "moderate";
  const slangAllowed = slangLevel === "none" ? [] : slangWhitelistForGrade(gradeNum);

  const publisherComponentsBlock = publisherComponents.length
    ? publisherComponents.map((s) => `- ${s}`).join("\n")
    : "- None provided (AI should still create a generic bridge map)";

  const includeStaar = req.includeStaarStyleQuestions ? "Yes" : "No";
  const subNotes = (req.subNotes || (req.options as any)?.subNotes || "").trim();
  const unitMap = (req.unitMap || "").trim();

  const modeRules =
    mode === "lite"
      ? `
MODE: LITE (FAST)
- Be concise.
- Misconceptions: EXACTLY 3 with quick fix.
- Keep CFU Ladder short.
`
      : `
MODE: FULL (DETAILED)
- Add more teacher script lines and details.
- Misconceptions: 4–6 with quick fix.
- CFU Ladder must include Tier 1/2/3 and include a teacher script line + exemplar each.
`;

  const curriculumGuard = `
CURRICULUM ACCURACY RULE (LEVEL 1/2/3):
- If CURRICULUM CONTEXT provides facts (vocab, events, EQs, steps, timelines), treat those as GROUND TRUTH.
- Only infer (Level 3) when a needed detail is NOT provided by the context or user inputs.
- Never claim "Savvas says..." unless that exact wording exists in context; instead say "According to the provided curriculum components..."
`;

  const adminSafeDisclaimer = `
ADMIN-SAFE DISCLAIMERS (MANDATORY):
- In "0) 🛡️ Admin-Safe Notice" include EXACTLY this line:
  ${ADMIN_SAFE_NOTICE_LINE}
- In "19) 🛡️ Admin-Safe Footer" include EXACTLY this line:
  ${ADMIN_SAFE_FOOTER_LINE}
`;

  const presentationPolishRule = `
FORMATTING RULE (MANDATORY):
- All charts must be Markdown tables using | pipes.
- Do NOT use ASCII boxes.
- Do NOT use tab spacing.
- Do NOT use any markdown heading syntax: #, ##, ###, ####.
- Use ONLY plain numbered section title lines like "1) ...".
- Leave exactly one blank line between numbered sections.
- Do not output raw "\\n" sequences. Output real newlines.
- Do NOT use horizontal rules (---).
- Output must look "publish-ready" in Markdown.
`;

  const completionPriority = pacingMode
    ? `
COMPLETION PRIORITY (MANDATORY):
- Prioritize COMPLETING the day-by-day pacing table (Section 4).
- Do not stop mid-table.
`
    : `
COMPLETION PRIORITY (MANDATORY):
- If STAAR/Practice/Worksheet is ON, you MUST finish Section 18 fully (including Teacher Key).
- If running long, shorten earlier sections but FINISH section 18.
`;

  const styleRule = pacingMode
    ? `
OUTPUT STYLE (MANDATORY):
- This is a PACING PLAN request.
- Generate ONLY the sections in the pacing output format below.
- Do NOT generate lesson sections 12–17 or Section 18 item sets.
`
    : `
OUTPUT STYLE (MANDATORY):
- OutputStyle = ${style}
- ONLY generate the sections listed in OUTPUT FORMAT below.
- Do NOT include extra sections.
`;

  const pacingRules = pacingMode
    ? `
PACING CALENDAR ENGINE (MANDATORY):
- Use unitMap (if provided) as the day-by-day source of truth.
- Every day MUST fit the teacher lesson cycle segments, and the calendar MUST be a Markdown table.

LESSON CYCLE SEGMENTS (in order):
${(pacing?.lessonCycleSegments || []).map((s: string) => `- ${s}`).join("\n")}
`
    : "";

  const crossCurriculumRule = pacingMode
    ? `
CROSS-CURRICULUM CONNECTION (MANDATORY IN PACING):
- Include at least 2 cross-curricular integration points across the unit.
`
    : `
CROSS-CURRICULUM CONNECTION (MANDATORY):
- Include 2 cross-curriculum connections aligned to the same Skill Focus:
  1) One connection to Science OR Social Studies.
  2) One connection to Writing/Speaking.
- Put these inside section "8) 🧱 Frontloading | Build Background Knowledge".
`;

  const cfuLadderRule = `
CFU LADDER RULE (MANDATORY):
- In section 6, include: "🧩 CFU Ladder (Tier 1/2/3)"
- Tier 1 = Identify/Recall (DOK 1) with expected answer
- Tier 2 = Evidence/Reason (DOK 2) with exemplar
- Tier 3 = Create/Transfer (DOK 3) where students create an example of their own and peers respond
`;

 const ebStemsRule = `
EB SENTENCE STEM RULE (MANDATORY):

- In section 10, include:
  "🗣️ Sentence Stems (Student Support)"

- Provide 4–6 stems aligned to the skillFocus

Examples:
- "The relationship between ___ and ___ is..."
- "This shows that..."
- "The conflict occurs because..."
- "Evidence from the text suggests..."

- Stems must support academic language and reasoning
- REQUIRED: Must appear in final output (Section 10)
`;


 const teacherSupportLayer = `
 TEACHER SUPPORT IS REQUIRED IN EVERY LESSON.
DO NOT SKIP THESE COMPONENTS.
TEACHER SUPPORT (MANDATORY)

MISCONCEPTIONS:
- Include 2–3 realistic student mistakes
- Include quick teacher correction

SENTENCE STEMS:
- Provide 4–6 stems tied to the skill
- Must support academic responses

TEACHER MOVES:
- Include:
  - what teacher says
  - what teacher looks for
  - how to respond to errors

SCAFFOLDS:
- Break thinking into steps
- Provide guided prompts

ADVANCED PUSH:
- Include 1 deeper thinking extension

Keep concise and classroom-ready.
`;
  const anchorChartRule = `
ANCHOR CHART RULE (MANDATORY):
- In section 8, include a sub-block labeled:
  "🧾 Anchor Chart (Teacher-Ready)"
  - MUST be a Markdown table using | pipes (NO ASCII boxes)
- Also include:
  "🧾 Anchor Chart Image Link (Search)"
  - Provide ONE safe image search link
`;

  const attentionGetterRule = `
SECTION 12 VIDEO LINKS (MANDATORY when lesson sections 12–17 are present):
- In section 12) Lesson Opening, include:
  "🎬 Attention Getter Videos (Choose 1)"
  (exactly 2 links)
- Use YouTube search links (not specific channels).
`;

  const tierRules = `
QUESTION DIFFICULTY TIERS (MANDATORY when generating MCQs):
- Group under: Approaches, Meets, Masters.
- Each MCQ: tier, DOK, correct answer, 1-sentence rationale, misconception tag.
`;

  const needsPassage = pacingMode ? false : isELAR ? staarOn : assessmentsOn;
  const originalPassageRule = backbone.enforceOriginalText
    ? `
ORIGINAL STUDENT TEXT/PASSAGE (MANDATORY because assessments require it):
- Original text (no copying).
- ELAR: include line numbers in each text/document (see Section 18 rules).
`
    : "";

  const assessmentsGateLabel = isELAR
    ? `18) ✅ Original Practice Passage + Assessments (ONLY IF STAAR = ON OR Practice toggle ON OR Worksheet Pack enabled)`
    : `18) ✅ Original Practice Passage + Assessments (ONLY IF Practice toggle ON OR Worksheet Pack enabled)`;

  const outputFormatAssessmentsLabel = "";

  const videoLinksBlock = buildAttentionGetterLinks(
    gradeNum,
    subject,
    standard,
    unit,
    title || `${unit} ${lesson}`.trim(),
    skillFocus,
  );

  const anchorChartSearch = imageSearchLink(
    `Grade ${gradeNum} ${subject} anchor chart ${skillFocus || "target skill"} printable`,
  );

  const section16WritingRule = section16AcademicParagraphFrameBlock({
    subject,
    skillFocus,
    standard,
    curriculumUnit: unit,
    curriculumLesson: lesson,
  });
 const section18PriorityBlock = "";
  const section18DbqRule = "";

  const supportingStandardsBlock = supportingStandards.length
    ? supportingStandards.map((s) => `- ${s}`).join("\n")
    : "- None provided";

  const sr = (reqRaw as any)?._ctxStructureRules ?? null;

  const strictHeaderRule = `
CRITICAL FORMATTING RULES (NON-NEGOTIABLE):
- Do NOT use ANY markdown heading syntax: #, ##, ###, ####.
- Section titles must be plain numbered lines: "0) ...", "1) ...", etc.
- Do NOT nest sections.
- Do NOT use horizontal rules (---).
- All content must appear under its numbered section title line.

If any line begins with "#", the response is invalid.
`;
 const districtRigorHardStop = backbone.enforceDistrictOverrides
    ? `
DISTRICT RIGOR HARD CONSTRAINTS (MANDATORY — OVERRIDES EVERYTHING):
- NO DIRECT TRAIT LABELING in student-facing texts/titles.
  ❌ "He was brave." ❌ "known for her kindness" ❌ "revealed his bravery"
  ✅ Show traits ONLY through actions, dialogue, decisions, consequences.
- Titles in Section 18 MUST NOT contain trait-label words (Brave/Kind/Courageous/Selfish/Generous/Determined/etc.).
- REQUIRED sections are in the skeleton — do not omit them.
- If any constraint is violated, REVISE BEFORE FINALIZING OUTPUT.
`.trim()
    : "";
const stageSystemBlock = `
INSTRUCTIONAL DELIVERY MODEL (MANDATORY):

The lesson MUST be written so it can be converted into the following stages:

1) HOOK (Engagement)
- 1–2 lines MAX
- High interest (scenario, question, or image idea)
- Minimal text

2) VOCABULARY
- 5–8 key terms
- EACH must include:
  • word
  • student-friendly definition
  • optional example

3) STEPS / STRATEGY
- Provide a numbered process:
  Step 1, Step 2, Step 3
- Each step must be actionable and short
- Must align to the skillFocus

4) MODEL (I DO)
- Include teacher thinking using:
  "I notice..."
  "This shows..."
  "So I can conclude..."

5) GUIDED (WE DO)
- MUST include scaffold:
  "I chose __ because __."
- Include partner discussion cue
- Require use of text evidence

6) INDEPENDENT (YOU DO)
- Students apply skill independently
- No scaffold

7) EXIT TICKET
- Must check mastery of skillFocus
- Should reflect cognitive rigor (DOK alignment)

PACING + DELIVERY REQUIREMENTS:
- Each stage should clearly imply:
  • teacherAction (what teacher does/says)
  • studentAction (what students do)
- Cognitive load must progress:
  LOW → MEDIUM → HIGH across the lesson

DO NOT skip Hook, Vocabulary, or Steps.
`;
  return `
You are Lessons-Ready, an instructional internalization engine.
Create ORIGINAL classroom-ready content. Never copy or mirror proprietary curriculum.

CRITICAL:

PLAYBOOK INSTRUCTIONS OVERRIDE ALL OTHER RULES.

You MUST follow playbook structure, tone, and expectations.

----------------------------------------

${playbookBlock ? playbookBlock + "\n\n" : ""}

${districtRigorHardStop}
${rigorBlock}

${standardGuard}
${curriculumGuard}
${strandInjection}
${stageSystemBlock}

${curriculumContextBlock}
${
  sr
    ? `
BLUEBONNET STRUCTURE RULES (MANDATORY — FOLLOW EXACTLY):
${stringifyJsonSafe(sr, 9000)}
`.trim()
    : ""
}

${adminSafeDisclaimer}
${presentationPolishRule}
${strictHeaderRule}
${pacingRules}
${completionPriority}
${modeRules}
${styleRule}
${crossCurriculumRule}
${cfuLadderRule}
${ebStemsRule}
${anchorChartRule}
${attentionGetterRule}
${tierRules}
${originalPassageRule}
${section16WritingRule}
${section18PriorityBlock}
${section18DbqRule}

${teacherSupportLayer}   // ✅ ONLY HERE (FINAL ENFORCEMENT)
LOCKED VALUES (use these EXACT blocks when needed):

Attention Getter Videos (Choose 1):
${videoLinksBlock}

Anchor Chart Image Link (Search):
${anchorChartSearch}

INPUTS:
- Campus ID: ${(req.campusId || "").trim() || "N/A"}
- Program Name: ${(req.programName || "").trim() || "N/A"}
- Curriculum Lesson Code: ${(req.curriculumLessonCode || "").trim() || "N/A"}

- State: ${state || "N/A"}
- Publisher: ${publisher}
- Unit: ${unit || "N/A"}
- Lesson: ${lesson || "N/A"}
- Publisher Components:
${publisherComponentsBlock}
- District Lesson Cycle Name: ${districtCycle || "N/A"}

- Grade: ${grade}
- Subject: ${subject}

- Primary Standard (label): ${standard}

CANONICAL STANDARD DATA (LOCKED — DO NOT OVERRIDE):
- Skill Focus: ${req.skillFocus || "N/A"}
- Cognitive Verb: ${req._verb || "N/A"}
- Strand: ${req._strand || "N/A"}
- Focus Type: ${req._focusType || "N/A"}
- Target DOK: ${req._dokTarget || "N/A"}
- Supporting Standards:

${supportingStandardsBlock}
- Anchor Text Title (title only): ${title || "N/A"}
- Lesson Length: ${minutes} minutes
- Include STAAR-style Questions: ${includeStaar}
- Sub Notes (optional): ${subNotes || "None"}

- Curriculum Unit Map (paste from curriculum pacing guide; may include TEKS/ELPS by day):
${unitMap ? unitMap : "None provided"}

PERFORMANCE INSIGHTS (optional):
Source: ${perfSource || "None"}
Weakest skill notes:
${weakestSkillNotes.length ? weakestSkillNotes.map((s) => `- ${s}`).join("\n") : "- None"}
Misconception tags:
${misconTags.length ? misconTags.map((s) => `- ${s}`).join("\n") : "- None"}
Distractor patterns:
${distractorPatterns.length ? distractorPatterns.map((s) => `- ${s}`).join("\n") : "- None"}
${pacingMode
  ? pacingOutputFormatBlock(playbookBlock, req)
  : outputFormatBlock(
      style,
      productMode,
      outputFormatAssessmentsLabel,
      districtRigorOn,
      strandNumber,
      isBluebonnet
    )}
`;
}

/* =========================================================
   OpenAI response parsing + streaming proxy
   ========================================================= */
function extractAnyText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim())
    return data.output_text.trim();
  const pieces: string[] = [];
  const out = data?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (typeof part?.text === "string" && part.text.trim())
            pieces.push(part.text);
          if (typeof part?.text?.value === "string" && part.text.value.trim())
            pieces.push(part.text.value);
          if (typeof part?.content === "string" && part.content.trim())
            pieces.push(part.content);
        }
      }
      if (typeof item?.text === "string" && item.text.trim()) pieces.push(item.text);
      if (typeof item?.message?.content === "string" && item.message.content.trim())
        pieces.push(item.message.content);
    }
  }
  return pieces.join("\n").trim();
}

function coerceRealNewlines(s: string) {
  const hasReal = s.includes("\n");
  const hasEscaped = s.includes("\\n");
  if (!hasReal && hasEscaped) return s.replaceAll("\\n", "\n");
  return s;
}

async function callOpenAINonStream(
  instructions: string,
  debugReqId: string,
  mode: "lite" | "full",
  model: string,
  style: OutputStyle,
  heavy: boolean,
) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set in Supabase secrets.");

  const { max_output_tokens, timeoutMs } = getOpenAIParams(mode, style, heavy);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: "Generate the output now." }],
          },
        ],
        max_output_tokens,
        store: false,
      }),
    });

    const raw = await resp.text();
    if (!resp.ok)
      throw new Error(`OpenAI API error (${resp.status}): ${raw.slice(0, 900)}`);

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("OpenAI returned non-JSON response body.");
    }

    const text = extractAnyText(data);
    if (!text) throw new Error("OpenAI returned no text output.");
    return coerceRealNewlines(text);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      throw new Error(`OpenAI request timed out after ${timeoutMs}ms.`);
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   ✅ Quality Floor (validate + repair once)
   ========================================================= */
type ValidationArgs = {
  text: string;
  isPacing: boolean;
  assessmentsOn: boolean;
  isELAR: boolean;
  districtRigorOn: boolean;
};

function hasMarkdownTableHeader(t: string, headerNeedle: string) {
  if (!t.includes(headerNeedle)) return false;
  const idx = t.indexOf(headerNeedle);
  const near = t.slice(idx, idx + 250);
  return near.includes("|---") || near.includes("| ---");
}

function validateLessonOutputLite(args: ValidationArgs): string[] {
  const t = String(args.text || "");
  const issues: string[] = [];

  if (!t.trim()) issues.push("Output is empty.");

  if (t.includes("\n---\n") || t.includes("\n---\r\n") || t.trim() === "---") {
    issues.push('Horizontal rules ("---") are not allowed.');
  }

  // 🚫 Ban ALL markdown headings
  if (/^\s*#+\s/m.test(t)) {
    issues.push(
      'Illegal markdown headings detected (# / ## / ### / ####). Use plain numbered lines like "1) ...".',
    );
  }

  if (args.isPacing) {
    if (!t.includes("<<END PACING PLAN>>"))
      issues.push("Missing end marker: <<END PACING PLAN>>");
  } else {
    if (!t.includes("<<END LESSON>>"))
      issues.push("Missing end marker: <<END LESSON>>");
  }

  if (!t.includes(ADMIN_SAFE_NOTICE_LINE))
    issues.push("Missing exact admin-safe notice line.");
  if (!t.includes(ADMIN_SAFE_FOOTER_LINE))
    issues.push("Missing exact admin-safe footer line.");

  if (args.isPacing) {
    const mustHave = [
      "0) 🛡️ Admin-Safe Notice",
      "1) 📌 Pacing Plan Snapshot",
      "2) 🧭 Scope Decision (Whole Curriculum vs Unit vs Lesson)",
      "3) 🧱 Prerequisite Standards Map (What students must know first)",
      "4) 🧩 Day-by-Day Pacing Calendar (Table)",
      "5) 🧪 Mastery Checks + Reteach Triggers",
      "6) 🧰 Catch-Up / Intervention Blocks",
      "7) 🧠 Teacher Notes: Lesson Cycle Fit",
      "8) 🛡️ Admin-Safe Footer",
    ];
    for (const s of mustHave) {
      if (!t.includes(s)) issues.push(`Missing required pacing header: ${s}`);
    }
    if (!t.includes("| Day # | Duration (min) |"))
      issues.push("Missing pacing day-by-day Markdown table header row.");
    return issues;
  }

  const mustHave = [
    "0) 🛡️ Admin-Safe Notice",
    "1) 📘 Lesson Header",
    "2) 🗺️ Curriculum Bridge Map",
    "6) 🧠 Objective, Misconceptions, & Assessment Connection",
    "8) 🧱 Frontloading | Build Background Knowledge",
    "10) 📊 Differentiation / Tier 2 Planning",
    "19) 🛡️ Admin-Safe Footer",
  ];
  for (const s of mustHave) {
    if (!t.includes(s)) issues.push(`Missing required section header: ${s}`);
  }

  const has12 = t.includes("12) 🚪 Lesson Opening");
  const has17 = t.includes("17) 🎟️ Exit Ticket");
  if (has12 && !has17) issues.push("Section 12 exists but Section 17 is missing.");
  if (has17 && !has12) issues.push("Section 17 exists but Section 12 is missing.");

  if (!hasMarkdownTableHeader(t, "| Curriculum Components | Purpose |")) {
    issues.push("Curriculum Bridge Map must be a Markdown table with | pipes.");
  }

  if (!hasMarkdownTableHeader(t, "| Concept | Description |")) {
    issues.push("Anchor Chart must be a Markdown table with | pipes.");
  }

  if (args.assessmentsOn) {
    if (!t.includes("18) ✅ ")) {
      issues.push("Assessments are ON but Section 18 header is missing.");
    }
    if (args.isELAR) {
      const hasLineNums =
        t.includes("(1)") ||
        t.includes("(2)") ||
        /\n\s*\(\d+\)\s+/.test(t) ||
        /\n\s*\d+\.\s+/.test(t);
      if (!hasLineNums) {
        issues.push(
          "ELAR assessments require line numbers in Section 18 texts (e.g., (1) ...).",
        );
      }
    }
  }

  if (args.districtRigorOn) {
    const mustDistrict = [
      "9A) 🧾 TEKS Unpacking Box",
      "17A) 🧪 STAAR Short Constructed Response Scoring Guide",
      "17B) 🧠 Predicted Incorrect Responses + Teacher Moves",
      "17C) 🧩 If/Then Reteach Plan (Exit Ticket)",
    ];
    for (const h of mustDistrict) {
      if (!t.includes(h)) issues.push(`District Rigor: Missing required header: ${h}`);
    }

    if (containsDirectTraitLabeling(t)) {
      issues.push(
        "District Rigor: Direct trait labeling detected (e.g., 'was brave/known for kindness/revealed bravery'). Traits must be inferred via actions/dialogue.",
      );
    }

    if (!/Must use at least TWO academic vocabulary words:/i.test(t)) {
      issues.push(
        "District Rigor: Writing task must require use of at least TWO academic vocabulary words (exact line missing).",
      );
    }
  }

  return issues;
}

function buildRepairInstructions(draft: string, issues: string[]) {
  return `
You are a meticulous instructional editor.
Your job: FIX the draft to satisfy all rules WITHOUT changing the overall intent.

REPAIR GOALS:
- Resolve ALL issues listed below.
- Keep the same lesson topic/inputs.
- Preserve clean Markdown formatting (tables ok).
- Do NOT use any markdown headings (#, ##, ###, ####).
- Convert headings to plain numbered lines like "1) ...".
- Do NOT use horizontal rules (---).
- Ensure end marker is present.
- Ensure the EXACT admin-safe notice line and footer line are present.
- Ensure Bridge Map and Anchor Chart are Markdown tables using | pipes.
- If assessments are ON and Section 18 is required, you MUST fully include it.
- If ELAR and assessments are ON, add line numbers to each text in Section 18 (e.g., (1) ...).
- If District Rigor issues are listed, enforce them (required sections, no direct trait labeling, vocab requirement line).

ISSUES TO FIX:
${issues.map((x) => `- ${x}`).join("\n")}

DRAFT TO REPAIR:
${draft}
`.trim();
}

async function repairLessonOnce(args: {
  draft: string;
  issues: string[];
  debugReqId: string;
  mode: "lite" | "full";
  model: string;
  style: OutputStyle;
  heavy: boolean;
}) {
  const instructions = buildRepairInstructions(args.draft, args.issues);

  const repaired = await callOpenAINonStream(
    instructions,
    args.debugReqId,
    args.mode,
    args.model,
    args.style,
    args.heavy,
  );

  return repaired;
}

/* =========================================================
   ✅ Streaming proxy (streams draft, then emits "final")
   ========================================================= */
async function callOpenAIStreamProxyWithQualityFloor(args: {
  instructions: string;
  debugReqId: string;
  mode: "lite" | "full";
  model: string;
  style: OutputStyle;
  heavy: boolean;
  isPacing: boolean;
  assessmentsOn: boolean;
  isELAR: boolean;
  districtRigorOn: boolean;
}) {
  const {
    instructions,
    debugReqId,
    mode,
    model,
    style,
    heavy,
    isPacing,
    assessmentsOn,
    isELAR,
    districtRigorOn,
  } = args;
  
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set in Supabase secrets.");

  const { max_output_tokens, timeoutMs } = getOpenAIParams(mode, style, heavy);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model,
      instructions,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: "Generate the output now." }],
        },
      ],
      stream: true,
      max_output_tokens,
      store: false,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const raw = await upstream.text().catch(() => "");
    clearTimeout(timeout);
    throw new Error(`OpenAI API error (${upstream.status}): ${raw.slice(0, 900)}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let fullDraft = "";
  let flushed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controllerOut) {
      controllerOut.enqueue(
        encoder.encode(
          `event: meta\ndata: ${JSON.stringify({ ok: true, debugReqId })}\n\n`,
        ),
      );

      const flushFinal = async () => {
        if (flushed) return;
        flushed = true;

        try {
          const draft = fullDraft || "";
          const finalText = draft;
          const repaired = false;
          const issues: string[] = [];
          const issuesAfter: string[] = [];

          controllerOut.enqueue(
            encoder.encode(
              `event: final\ndata: ${JSON.stringify({
                ok: true,
                repaired,
                repair_issues_initial: issues,
                repair_issues_after: issuesAfter,
                lesson_plan: finalText,
                sections:(finalText),
              })}\n\n`,
            ),
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          controllerOut.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                ok: false,
                error: `Finalization failed: ${msg}`,
              })}\n\n`,
            ),
          );
        }
      };

      (async () => {
        let buffer = "";
        const reader = upstream.body!.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let idx: number;
            while ((idx = buffer.indexOf("\n\n")) !== -1) {
              const frame = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 2);

              const lines = frame.split("\n");
              for (const line of lines) {
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;

                let evt: any;
                try {
                  evt = JSON.parse(payload);
                } catch {
                  continue;
                }

                if (
                  evt?.type === "response.output_text.delta" &&
                  typeof evt?.delta === "string"
                ) {
                  const delta = coerceRealNewlines(evt.delta);
                  fullDraft += delta;

                  controllerOut.enqueue(
                    encoder.encode(
                      `event: chunk\ndata: ${JSON.stringify({ delta })}\n\n`,
                    ),
                  );
                }

                if (
                  evt?.type === "response.refusal.delta" &&
                  typeof evt?.delta === "string"
                ) {
                  const delta = coerceRealNewlines(evt.delta);
                  fullDraft += delta;

                  controllerOut.enqueue(
                    encoder.encode(
                      `event: chunk\ndata: ${JSON.stringify({ delta })}\n\n`,
                    ),
                  );
                }

                if (evt?.type === "response.completed") {
                  controllerOut.enqueue(
                    encoder.encode(
                      `event: done\ndata: ${JSON.stringify({ ok: true })}\n\n`,
                    ),
                  );
                  await flushFinal();
                }
              }
            }
          }

          if (!flushed) {
            controllerOut.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({ ok: true })}\n\n`,
              ),
            );
            await flushFinal();
          }

          controllerOut.close();
        } catch (e) {
          const msg =
            e instanceof DOMException && e.name === "AbortError"
              ? `OpenAI request timed out after ${timeoutMs}ms.`
              : e instanceof Error
                ? e.message
                : String(e);

          controllerOut.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ ok: false, error: msg })}\n\n`,
            ),
          );
          controllerOut.close();
        } finally {
          clearTimeout(timeout);
        }
      })();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Debug-ReqId": debugReqId,
    }
  });
  }
