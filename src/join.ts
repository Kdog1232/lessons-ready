const SUPABASE_URL = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_ANON_KEY || "").trim();

const bannedTokens = ["poop", "skibidi", "toilet", "butt", "sus", "amongus", "69", "420"];

function headers() {
  return {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Join page configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
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

function setStatus(id: string, message: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
}

function buildValidatedStudentName(first: string, lastInitial: string): string {
  const normalizedFirst = first.trim();
  const normalizedLast = lastInitial.trim();

  if (!normalizedFirst || !normalizedLast) {
    throw new Error("Enter first name and last initial.");
  }

  if (!/^[a-zA-Z]+$/.test(normalizedFirst)) {
    throw new Error("Use letters only for first name.");
  }

  if (!/^[a-zA-Z]$/.test(normalizedLast)) {
    throw new Error("Last initial must be one letter.");
  }

  const lower = normalizedFirst.toLowerCase();
  if (bannedTokens.some((token) => lower.includes(token))) {
    throw new Error("Please enter your real name.");
  }

  const firstName = normalizedFirst.charAt(0).toUpperCase() + normalizedFirst.slice(1).toLowerCase();
  return `${firstName} ${normalizedLast.toUpperCase()}`;
}

async function ensureUniqueDisplayName(sessionId: string, baseName: string): Promise<string> {
  const query = `select=id,student_name&session_id=eq.${encodeURIComponent(sessionId)}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/session_students?${query}`, { headers: headers() });
  if (!res.ok) return baseName;

  const rows = await parseJsonResponse<Array<{ id: string; student_name?: string }>>(res, "Failed to load session students");
  const existing = new Set((rows || []).map((r) => String(r.student_name || "").toLowerCase()));
  if (!existing.has(baseName.toLowerCase())) return baseName;

  let suffix = 2;
  while (existing.has(`${baseName} ${suffix}`.toLowerCase())) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

async function joinSession() {
  assertSupabaseConfigured();

  const code = (document.getElementById("codeInput") as HTMLInputElement | null)?.value.trim() || "";
  const first = (document.getElementById("firstName") as HTMLInputElement | null)?.value.trim() || "";
  const last = (document.getElementById("lastInitial") as HTMLInputElement | null)?.value.trim() || "";

  if (!code) {
    setStatus("join-status", "Enter a join code.");
    return;
  }

  const studentName = buildValidatedStudentName(first, last);

  const query = `select=id,join_code&join_code=eq.${encodeURIComponent(code)}&limit=1`;
  const sessionRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?${query}`, { headers: headers() });
  const sessions = await parseJsonResponse<Array<{ id: string; join_code: string }>>(sessionRes, "Failed to look up session");
  const session = sessions?.[0];
  if (!session?.id) {
    setStatus("join-status", "Session not found.");
    return;
  }

  const uniqueStudentName = await ensureUniqueDisplayName(session.id, studentName);

  const studentRes = await fetch(`${SUPABASE_URL}/rest/v1/session_students`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      session_id: session.id,
      student_name: uniqueStudentName,
    }),
  });

  const students = await parseJsonResponse<Array<{ id: string }>>(studentRes, "Failed to join session");
  const student = students?.[0];
  if (!student?.id) {
    throw new Error("Joined session but no student id was returned.");
  }

  localStorage.setItem("studentId", student.id);
  localStorage.setItem("sessionId", session.id);
  localStorage.setItem("joinCode", session.join_code);
  localStorage.setItem("studentName", uniqueStudentName);

  loadStudentView();
}

function loadStudentView() {
  const join = document.getElementById("join-view");
  const student = document.getElementById("student-view");
  const label = document.getElementById("session-label");

  if (join) join.style.display = "none";
  if (student) student.style.display = "block";
  if (label) {
    const name = localStorage.getItem("studentName") || "";
    label.textContent = `Joined as ${name} • code ${localStorage.getItem("joinCode") || ""}`;
  }
}

type QuestionPayload = {
  id: string;
  correctIndex?: number;
  standard?: string;
  dok?: number;
};

function getCurrentQuestionPayload(): QuestionPayload | null {
  const raw = (document.getElementById("questionInput") as HTMLInputElement | null)?.value.trim() || "";
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<QuestionPayload>;
    if (parsed && typeof parsed === "object" && parsed.id) {
      return {
        id: String(parsed.id),
        correctIndex: Number.isInteger(parsed.correctIndex) ? Number(parsed.correctIndex) : 0,
        standard: String(parsed.standard || ""),
        dok: Number.isInteger(parsed.dok) ? Number(parsed.dok) : 1,
      };
    }
  } catch {
    // Treat as plain question id when not JSON.
  }

  return {
    id: raw,
    correctIndex: 0,
    standard: "",
    dok: 1,
  };
}

async function submitAnswer(
  questionId: string,
  answerIndex: number,
  correctIndex: number,
  standard: string,
  dok: number,
) {
  const studentId = localStorage.getItem("studentId");
  const sessionId = localStorage.getItem("sessionId");

  if (!studentId || !sessionId) {
    setStatus("submit-status", "You are not connected to a session.");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/responses?on_conflict=session_id,question_id,student_id`, {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      session_id: sessionId,
      question_id: questionId,
      student_id: studentId,
      answer_index: answerIndex,
      correct: answerIndex === correctIndex,
      standard,
      dok,
    }),
  });

  if (!res.ok) {
    setStatus("submit-status", "Submission failed. Try again.");
    return;
  }

  setStatus("submit-status", `Submitted ${String.fromCharCode(65 + answerIndex)} for ${questionId}.`);
}

function bind() {
  document.getElementById("joinBtn")?.addEventListener("click", () => {
    joinSession().catch((e: any) => setStatus("join-status", e?.message || "Unable to join."));
  });

  document.querySelectorAll(".answerBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const answerIndex = Number((btn as HTMLElement).dataset.index || "0");
      const question = getCurrentQuestionPayload();
      if (!question) return;
      submitAnswer(
        question.id,
        answerIndex,
        question.correctIndex ?? 0,
        question.standard || "",
        question.dok || 1,
      ).catch(() => setStatus("submit-status", "Submission failed."));
    });
  });

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code) {
    const codeInput = document.getElementById("codeInput") as HTMLInputElement | null;
    if (codeInput) codeInput.value = code;
  }

  if (localStorage.getItem("studentId") && localStorage.getItem("sessionId")) {
    loadStudentView();
  }
}

bind();
