const SUPABASE_URL = "https://pinplfyymnpfctwcpzol.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_HsaM0F2t0OJNjHt48hdYgw_OzBD_ylJ";
const LS_SESSION_KEY = "lr_supabase_session_v1";
const LS_PRESENT_NOTES_KEY = "lr_present_notes_open_v1";

type SlideDefinition = {
  type?: "headline" | "split" | "question" | "writing" | "energy";
  heading?: string;
  subtext?: string;
  items?: string[];
  question?: string;
  prompt?: string;
  section?: string;
  notes?: string;
};

let slides: SlideDefinition[] = [];
let currentIndex = 0;
let lessonIdGlobal = "";
let lessonMode: "bluebonnet" | "amplify" | "generic" = "generic";
let notesOpen = localStorage.getItem(LS_PRESENT_NOTES_KEY) === "1";

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
    // intentionally silent (non-blocking analytics)
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

  const query = `select=slide_definitions,lesson_mode&id=eq.${encodeURIComponent(lessonId)}&limit=1`;
  const url = `${SUPABASE_URL}/rest/v1/lessons?${query}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load slides (${res.status}): ${text.slice(0, 120)}`);
  }

  const rows = (await res.json()) as Array<{ slide_definitions?: SlideDefinition[]; lesson_mode?: string }>;
  const row = Array.isArray(rows) ? rows[0] : null;
  const defs = row?.slide_definitions;
  slides = Array.isArray(defs) ? defs : [];
  if (!slides.length) throw new Error("No slide_definitions found for this lesson.");

  lessonMode = row?.lesson_mode === "bluebonnet" || row?.lesson_mode === "amplify" ? row.lesson_mode : "generic";
  applyTheme();

  const savedRaw = localStorage.getItem(resumeKey(lessonId));
  const saved = Number(savedRaw || "0");
  if (Number.isFinite(saved) && saved > 0 && saved < slides.length) {
    const shouldResume = window.confirm(`Resume from slide ${saved + 1}?`);
    if (shouldResume) currentIndex = saved;
  }
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

  if (slide.type === "headline") {
    container.innerHTML = `<div class="slide"><h1>${escHtml(slide.heading)}</h1><p>${escHtml(slide.subtext)}</p></div>`;
  } else if (slide.type === "split") {
    container.innerHTML = `
      <div class="slide">
        <h2>${escHtml(slide.heading)}</h2>
        <p style="margin:0 0 18px; color:#cbd5e1;">${escHtml(slide.subtext)}</p>
        <ul>${(slide.items || []).map((item) => `<li>${escHtml(item)}</li>`).join("")}</ul>
      </div>
    `;
  } else if (slide.type === "question") {
    container.innerHTML = `
      <div class="slide">
        <h2>${escHtml(slide.heading)}</h2>
        <p style="font-size:30px; font-weight:700; margin-bottom:16px;">${escHtml(slide.question)}</p>
        <p>${escHtml(slide.prompt)}</p>
      </div>
    `;
  } else if (slide.type === "writing") {
    container.innerHTML = `
      <div class="slide">
        <h2>${escHtml(slide.heading)}</h2>
        <p>${escHtml(slide.subtext)}</p>
      </div>
    `;
  } else if (slide.type === "energy") {
    container.innerHTML = `<div class="slide"><h1 style="text-align:center;">${escHtml(slide.heading)}</h1></div>`;
  } else {
    container.innerHTML = `<div class="slide"><h2>${escHtml(slide.heading || "Slide")}</h2></div>`;
  }

  const section = slide.section ? ` • ${slide.section}` : "";
  counter.textContent = `Slide ${currentIndex + 1} of ${slides.length}${section}`;

  const noteText = slide.notes ? escHtml(slide.notes) : "No teacher notes for this slide.";
  notesPanel.innerHTML = `<div class="notesInner"><div class="notesTitle">Teacher Notes</div><div class="notesText">${noteText}</div></div>`;
  notesPanel.style.display = notesOpen ? "block" : "none";

  if (lessonIdGlobal) {
    localStorage.setItem(resumeKey(lessonIdGlobal), String(currentIndex));
  }
  logPresentationEvent(currentIndex).catch(() => {});
}

function bindKeys() {
  document.addEventListener("keydown", (e) => {
    if ((e.key === "ArrowRight" || e.key === " ") && currentIndex < slides.length - 1) {
      currentIndex += 1;
      renderSlide();
    }
    if (e.key === "ArrowLeft" && currentIndex > 0) {
      currentIndex -= 1;
      renderSlide();
    }
    if (e.key.toLowerCase() === "f") {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    if (e.key.toLowerCase() === "n") {
      notesOpen = !notesOpen;
      localStorage.setItem(LS_PRESENT_NOTES_KEY, notesOpen ? "1" : "0");
      renderSlide();
    }
  });
}

async function boot() {
  try {
    await loadSlides();
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
