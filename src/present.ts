const SUPABASE_URL = "https://pinplfyymnpfctwcpzol.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_HsaM0F2t0OJNjHt48hdYgw_OzBD_ylJ";
const LS_SESSION_KEY = "lr_supabase_session_v1";
const LS_PRESENT_NOTES_KEY = "lr_present_notes_open_v1";

type SlideDefinition = {
  type?: "headline" | "split" | "question" | "writing" | "energy" | "discussion";
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
};

type SkillType =
  | "context_clues"
  | "theme"
  | "inference"
  | "character"
  | "text_structure"
  | "vocabulary"
  | "central_idea"
  | "generic";

type LessonRow = {
  slide_definitions?: SlideDefinition[];
  lesson_text?: string;
  lesson_mode?: "bluebonnet" | "amplify" | "generic";
  canonical_skill?: string;
  cognitive_verb?: string;
  dok_target?: string;
};

let baseSlides: SlideDefinition[] = [];
let slides: SlideDefinition[] = [];
let currentIndex = 0;
let lessonIdGlobal = "";
let lessonMode: "bluebonnet" | "amplify" | "generic" = "generic";
let notesOpen = localStorage.getItem(LS_PRESENT_NOTES_KEY) === "1";
let revealStep = 0;
let timerInterval: number | null = null;
let turnTalkInterval: number | null = null;
let slideEndsAt = 0;

const settings: PresentSettings = {
  moreDiscussion: false,
  moreWriting: false,
  short30: false,
  interventionPace: false,
  coachingMode: false,
};

function escHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getSavedToken(): string {
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { access_token?: string };
    return String(parsed?.access_token || "");
  } catch {
    return "";
  }
}

function themeForMode(mode: string) {
  const m = String(mode || "generic").toLowerCase();
  if (m === "bluebonnet") return { accent: "#2563eb", border: "#1d4ed8", bg: "#0f172a" };
  if (m === "amplify") return { accent: "#7c3aed", border: "#6d28d9", bg: "#1e1b4b" };
  return { accent: "#10b981", border: "#059669", bg: "#0f172a" };
}

function applyTheme() {
  const t = themeForMode(lessonMode);
  const root = document.documentElement;
  root.style.setProperty("--present-accent", t.accent);
  root.style.setProperty("--present-border", t.border);
  root.style.setProperty("--present-bg", t.bg);
}

function resumeKey(lessonId: string) {
  return `lr_present_resume_${lessonId}`;
}

function cloneSlide(slide: SlideDefinition): SlideDefinition {
  return { ...slide, items: Array.isArray(slide.items) ? [...slide.items] : undefined };
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

function detectSkill(skill: string): SkillType {
  const s = skill.toLowerCase();

  if (s.includes("context")) return "context_clues";
  if (s.includes("theme")) return "theme";
  if (s.includes("infer")) return "inference";
  if (s.includes("character")) return "character";
  if (s.includes("structure")) return "text_structure";
  if (s.includes("vocab")) return "vocabulary";
  if (s.includes("central idea")) return "central_idea";

  return "generic";
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
      distractorRationale: [
        "Too absolute.",
        "Correct — message about perseverance.",
        "Unsupported.",
        "Emotional reaction, not theme.",
      ],
    };
  }

  if (skillType === "central_idea") {
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

function buildSlidesFromLessonText(text: string): SlideDefinition[] {
  const cleaned = String(text || "").replaceAll("\r\n", "\n");
  const sectionRegex = /\n(?=\d+\)\s)/g;
  const blocks = cleaned.split(sectionRegex).map((s) => s.trim()).filter(Boolean);
  const generatedSlides: SlideDefinition[] = [];

  const fullTextLower = cleaned.toLowerCase();
  const genre =
    /\b(add|subtract|multiply|divide|equation|fraction)\b/i.test(fullTextLower)
      ? "math"
      : /\b(article|informational|nonfiction|central idea|paragraph)\b/i.test(fullTextLower)
      ? "informational"
      : "generic";

  const objectiveBlock = blocks.find((b) => b.startsWith("4)"));
  if (objectiveBlock) {
    generatedSlides.push({
      type: "headline",
      heading: "Objective",
      subtext: objectiveBlock.slice(0, 400),
      section: "Frontload",
      durationSeconds: 90,
      teacherCue: "Students restate objective in their own words.",
    });
  }

  const vocabBlock = blocks.find((b) => b.toLowerCase().includes("vocab"));
  if (vocabBlock) {
    const vocabLines = vocabBlock.split("\n").slice(1, 5);
    generatedSlides.push({
      type: "split",
      heading: "Vocabulary (Frayer Focus)",
      subtext: "Define • Example • Non-Example • Why It Matters",
      items: vocabLines,
      section: "Frontload",
      durationSeconds: 120,
      teacherCue: "Students create one original sentence using term.",
    });
  }

  generatedSlides.push({
    type: "energy",
    heading: "Attention Getter",
    subtext:
      genre === "math"
        ? "When would division NOT be the correct operation?"
        : genre === "informational"
        ? "Why do authors structure information carefully?"
        : "What key clue in text helps you choose the best answer?",
    section: "Frontload",
    durationSeconds: 60,
    teacherCue: "Quick pair share.",
  });

  const exitBlock = blocks.find((b) => b.startsWith("17)"));
  if (exitBlock) {
    generatedSlides.push({
      type: "writing",
      heading: "Exit Ticket",
      subtext: exitBlock.slice(0, 400),
      section: "Exit",
      durationSeconds: 120,
      teacherCue: "Collect and sort for reteach.",
    });
  }

  return generatedSlides;
}

function normalizeSlidesForSettings() {
  let next = baseSlides.map(cloneSlide);

  if (settings.moreDiscussion) {
    const withDiscussion: SlideDefinition[] = [];
    for (const slide of next) {
      withDiscussion.push(slide);
      if (slide.type === "question") {
        withDiscussion.push({
          type: "discussion",
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

  slides = next;
  if (currentIndex >= slides.length) currentIndex = Math.max(0, slides.length - 1);
}

async function logPresentationEvent(slideIndex: number) {
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
      }),
    });
  } catch {
    // intentionally silent
  }
}

async function loadSlides() {
  const params = new URLSearchParams(window.location.search);
  const lessonId = params.get("id");
  if (!lessonId) throw new Error("Missing lesson id");
  lessonIdGlobal = lessonId;

  const token = getSavedToken();
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const query = `select=slide_definitions,lesson_text,lesson_mode,canonical_skill,cognitive_verb,dok_target&id=eq.${encodeURIComponent(lessonId)}&limit=1`;
  const url = `${SUPABASE_URL}/rest/v1/lessons?${query}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load slides (${res.status}): ${text.slice(0, 120)}`);
  }

  const rows = (await res.json()) as LessonRow[];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error("Lesson not found.");

  const storedSlides: SlideDefinition[] = Array.isArray(row.slide_definitions) ? row.slide_definitions : [];

  const lessonText = String(row.lesson_text || "").trim();
  if (!storedSlides.length && !lessonText) {
    throw new Error("No slide_definitions or lesson_text found.");
  }

  const skill = String(row.canonical_skill || "").toLowerCase();
  const verb = String(row.cognitive_verb || "");
  const dok = String(row.dok_target || "");
  const skillType = detectSkill(skill);

  baseSlides = storedSlides.length ? storedSlides.map(cloneSlide) : buildSlidesFromLessonText(lessonText);

  const guidedIndex = baseSlides.findIndex((s) => (s.heading || "").toLowerCase().includes("guided"));

  if (guidedIndex !== -1) {
    const mc = generateSkillAlignedMCQ(skillType);

    const assessmentSlide: SlideDefinition = {
      type: "question",
      heading: "Assessment Simulation",
      question: mc.question,
      prompt: mc.excerpt,
      answerChoices: mc.answerChoices,
      correctIndex: mc.correctIndex,
      distractorRationale: mc.distractorRationale,
      section: "Assessment",
      durationSeconds: 180,
      teacherCue: "Students eliminate two distractors before choosing.",
    };

    baseSlides.splice(guidedIndex + 1, 0, assessmentSlide);

    if (settings.coachingMode) {
      baseSlides.splice(guidedIndex + 2, 0, {
        type: "headline",
        heading: "Why Students Miss This",
        subtext: `Common misconception for ${skillType.replaceAll("_", " ")}: students over-rely on first-glance clues.`,
        section: "Coaching",
        durationSeconds: 90,
        teacherCue:
          dok === "DOK3"
            ? "Push for justification and multiple pieces of evidence."
            : `Prompt with the cognitive verb: ${verb || "explain"}.`,
      });
    }
  }

  lessonMode =
    row.lesson_mode === "bluebonnet" || row.lesson_mode === "amplify" ? row.lesson_mode : "generic";

  applyTheme();
  normalizeSlidesForSettings();
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
  const tick = () => {
    const remaining = Math.round((slideEndsAt - Date.now()) / 1000);
    timerEl.textContent = `Slide timer ${formatSeconds(remaining)}`;
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

function alignmentChip(slide: SlideDefinition) {
  const section = String(slide.section || "").toLowerCase();
  if (section.includes("discussion")) return "Admin Look-For Covered: Student discourse";
  if (section.includes("objective")) return "Walkthrough alignment: TEKS objective visible";
  if (section.includes("writing") || section.includes("exit")) return "Admin Look-For Covered: Written evidence";
  return "Walkthrough alignment: Active monitoring + checks for understanding";
}

function renderSlide() {
  const slide = slides[currentIndex];
  const container = document.getElementById("slide-container")!;
  const counter = document.getElementById("slide-counter")!;
  const notesPanel = document.getElementById("notes-panel")!;

  if (!slide) {
    container.innerHTML = `<div class="slide"><h2>No slide found</h2></div>`;
    counter.textContent = "";
    notesPanel.innerHTML = "";
    return;
  }

  const coachLine = slide.teacherCue ? `<div class="coachLine">Coach: ${escHtml(slide.teacherCue)}</div>` : "";
  const alignment = `<div class="alignmentChip">${escHtml(alignmentChip(slide))}</div>`;

  if (slide.type === "headline") {
    container.innerHTML = `<div class="slide slide--headline"><h1>${escHtml(slide.heading)}</h1><p>${escHtml(slide.subtext)}</p>${coachLine}${alignment}</div>`;
  } else if (slide.type === "split") {
    const items = slide.items || [];
    const visibleCount = revealStep > 0 ? Math.min(revealStep, items.length) : Math.min(1, items.length);
    container.innerHTML = `
      <div class="slide slide--split">
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
            .map((c, i) => `<li>${String.fromCharCode(65 + i)}. ${escHtml(c)}</li>`)
            .join("")}</ul>`
        : "";

    const rationale =
      revealStep > 0 && slide.distractorRationale
        ? `<div class="revealBlock">${slide.distractorRationale
            .map((r, i) => `${String.fromCharCode(65 + i)}: ${escHtml(r)}`)
            .join("<br>")}</div>`
        : "";

    container.innerHTML = `
      <div class="slide slide--question">
        <h2>${escHtml(slide.heading)}</h2>
        <p class="promptPrimary">${escHtml(slide.question)}</p>
        <p>${escHtml(slide.prompt)}</p>
        ${choices}
        ${rationale}
        ${coachLine}${alignment}
      </div>
    `;
  } else if (slide.type === "writing") {
    const cerFrame = revealStep > 0 ? `<p class="cerFrame">CER: Claim → Evidence → Reasoning</p>` : "";
    const model =
      revealStep > 1
        ? `<p class="revealBlock">Model paragraph reveal: The theme is perseverance because the character keeps trying despite setbacks.</p>`
        : "";
    container.innerHTML = `
      <div class="slide slide--writing">
        <h2>${escHtml(slide.heading)}</h2>
        <p class="promptPrimary">${escHtml(slide.subtext)}</p>
        ${cerFrame}
        ${model}
        ${coachLine}${alignment}
      </div>
    `;
  } else if (slide.type === "energy") {
    const contrastClass = currentIndex % 4 === 0 ? " slide--contrast" : "";
    container.innerHTML = `<div class="slide slide--energy${contrastClass}"><h1>${escHtml(slide.heading)}</h1><p>${escHtml(slide.subtext || "")}</p>${coachLine}${alignment}</div>`;
  } else if (slide.type === "discussion") {
    const stem = revealStep > 0 ? `<p class="revealBlock">Sentence stem reveal: "I agree because the text says..."</p>` : "";
    container.innerHTML = `
      <div class="slide slide--discussion">
        <h2>${escHtml(slide.heading || "Discuss")}</h2>
        <p class="promptPrimary">${escHtml(slide.prompt || "Discuss with your partner.")}</p>
        ${stem}
        ${coachLine}${alignment}
      </div>
    `;
  } else {
    container.innerHTML = `<div class="slide"><h2>${escHtml(slide.heading || "Slide")}</h2>${coachLine}${alignment}</div>`;
  }

  const section = slide.section ? ` • ${slide.section}` : "";
  const timeCue = slide.durationSeconds ? ` • Suggested time: ${Math.max(1, Math.round(slide.durationSeconds / 60))} min` : "";
  counter.textContent = `Slide ${currentIndex + 1} of ${slides.length}${section}${timeCue}`;

  const noteText = slide.notes ? escHtml(slide.notes) : "No teacher notes for this slide.";
  const cueText = slide.teacherCue
    ? `<div class="notesTitle" style="margin-top:10px;">Teacher Cue</div><div class="notesText">${escHtml(slide.teacherCue)}</div>`
    : "";
  notesPanel.innerHTML = `<div class="notesInner"><div class="notesTitle">Teacher Notes</div><div class="notesText">${noteText}</div>${cueText}</div>`;
  notesPanel.style.display = notesOpen ? "block" : "none";

  if (lessonIdGlobal) localStorage.setItem(resumeKey(lessonIdGlobal), String(currentIndex));
  startSlideTimer(slide.durationSeconds || 90);
  logPresentationEvent(currentIndex).catch(() => {});
}

function bindControlsDrag() {
  const panel = document.getElementById("controls") as HTMLElement | null;
  const handle = document.getElementById("controlsHeader") as HTMLElement | null;
  if (!panel || !handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener("pointerdown", (e) => {
    dragging = true;
    panel.setPointerCapture?.(e.pointerId);
    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });

  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
    const nextLeft = Math.min(maxX, Math.max(0, e.clientX - offsetX));
    const nextTop = Math.min(maxY, Math.max(0, e.clientY - offsetY));
    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
  });

  const stop = () => {
    dragging = false;
  };
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
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
      const cue = slide.teacherCue ? `<div class="cue">Teacher Cue: ${escHtml(slide.teacherCue)}</div>` : "";
      return `<section class="page"><h1>${heading}</h1><p>${primary}</p>${items}${cue}</section>`;
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

  document.getElementById("btn-reveal")?.addEventListener("click", () => {
    revealStep += 1;
    renderSlide();
  });

  document.getElementById("btn-turntalk")?.addEventListener("click", () => startTurnTalkCountdown(30));
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

  bindControlsDrag();
}

function bindKeys() {
  document.addEventListener("keydown", (e) => {
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
  try {
    await loadSlides();
    bindControls();
    bindKeys();
    renderSlide();
  } catch (e: any) {
    const container = document.getElementById("slide-container");
    if (container) {
      container.innerHTML = `<div class="slide"><h2>Present mode unavailable</h2><p>${escHtml(e?.message || e)}</p></div>`;
    }
  }
}

boot();

export { detectSkill, generateSkillAlignedMCQ, loadSlides, buildSlidesFromLessonText };
