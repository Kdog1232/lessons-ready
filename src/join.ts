const SUPABASE_URL = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_ANON_KEY || "").trim();

const bannedTokens = ["poop", "skibidi", "toilet", "butt", "sus", "amongus", "69", "420"];

let currentQuestionId = "";
let isLocked = true;
let lastKnownLockState = true;
let selectedAnswerIndex: number | null = null;
let lastSubmittedQuestionId = "";
let sessionRealtimeSocket: WebSocket | null = null;
let sessionRealtimeHeartbeat: number | null = null;
let sessionRealtimeRef = 1;
let sessionPoll: number | null = null;
let joinedStudentsPoll: number | null = null;

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

function playTone(frequency: number, durationMs: number) {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const audio = new AudioCtx();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.03;
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  window.setTimeout(() => {
    oscillator.stop();
    audio.close().catch(() => {});
  }, durationMs);
}

function pulseStudentView(className: string) {
  const wrap = document.querySelector(".wrap");
  if (!wrap) return;
  wrap.classList.remove("game-pop", "game-reveal", "game-lock");
  wrap.classList.add(className);
  window.setTimeout(() => wrap.classList.remove(className), 450);
}

function colorForName(name: string): string {
  const palette = ["#38bdf8", "#a78bfa", "#34d399", "#f59e0b", "#fb7185", "#facc15"];
  const seed = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function renderJoinedStudents(names: string[]) {
  const host = document.getElementById("joined-students");
  if (!host) return;
  host.innerHTML = names.length
    ? names.map((name) => `<div class="joinedRow"><span class="avatarDot" style="background:${colorForName(name)}"></span>${name}</div>`).join("")
    : "<div class=\"status\">No students joined yet.</div>";
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

function realtimeWebsocketUrl() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return "";
  const wsBase = SUPABASE_URL.replace(/^http/i, "ws");
  return `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=1.0.0`;
}

function updateQuestionUi() {
  const display = document.getElementById("questionDisplay");
  const buttons = Array.from(document.querySelectorAll(".answerBtn")) as HTMLButtonElement[];
  const status = document.getElementById("submit-status");

  if (!display) return;

  buttons.forEach((btn) => {
    const index = Number(btn.dataset.index || "-1");
    btn.classList.toggle("is-selected", selectedAnswerIndex === index && lastSubmittedQuestionId === currentQuestionId);
  });

  if (!currentQuestionId) {
    display.textContent = "Waiting for teacher...";
    buttons.forEach((btn) => {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
    });
    if (status && !status.textContent) status.textContent = "Your teacher will push the next question automatically.";
    return;
  }

  if (isLocked) {
    display.textContent = `Answers locked for ${currentQuestionId}. Waiting for next question...`;
    buttons.forEach((btn) => {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
    });
    return;
  }

  display.textContent = `Question: ${currentQuestionId}`;
  buttons.forEach((btn) => {
    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
  });
}

type SessionStateRow = {
  id: string;
  join_code?: string;
  active_question_id?: string | null;
  is_locked?: boolean | null;
};

async function refreshJoinedStudents(sessionId: string) {
  const query = `select=student_name&session_id=eq.${encodeURIComponent(sessionId)}&order=student_name.asc`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/session_students?${query}`, { headers: headers() });
  if (!res.ok) return;
  const rows = await parseJsonResponse<Array<{ student_name?: string }>>(res, "Failed to load joined students");
  renderJoinedStudents((rows || []).map((row) => String(row.student_name || "").trim()).filter(Boolean));
}

async function loadSessionState(sessionId: string) {
  const query = `select=id,join_code,active_question_id,is_locked&id=eq.${encodeURIComponent(sessionId)}&limit=1`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?${query}`, { headers: headers() });
  const rows = await parseJsonResponse<SessionStateRow[]>(res, "Failed to load session state");
  const session = rows?.[0];
  const nextQuestionId = String(session?.active_question_id || "");
  if (nextQuestionId !== currentQuestionId) {
    selectedAnswerIndex = null;
    lastSubmittedQuestionId = "";
    setStatus("submit-status", "");
    if (nextQuestionId) {
      playTone(740, 120);
      pulseStudentView("game-reveal");
    }
  }
  currentQuestionId = nextQuestionId;
  isLocked = Boolean(session?.is_locked ?? true);
  if (isLocked && currentQuestionId && !lastKnownLockState) {
    playTone(260, 100);
    pulseStudentView("game-lock");
  }
  lastKnownLockState = isLocked;
  await refreshJoinedStudents(sessionId);
  updateQuestionUi();
}

function stopSessionPolling() {
  if (sessionPoll) {
    window.clearInterval(sessionPoll);
    sessionPoll = null;
  }
  if (joinedStudentsPoll) {
    window.clearInterval(joinedStudentsPoll);
    joinedStudentsPoll = null;
  }
}

function beginSessionPolling(sessionId: string) {
  stopSessionPolling();
  sessionPoll = window.setInterval(() => {
    loadSessionState(sessionId).catch(() => {});
  }, 3000);
  joinedStudentsPoll = window.setInterval(() => {
    refreshJoinedStudents(sessionId).catch(() => {});
  }, 3000);
}

function closeSessionRealtime() {
  if (sessionRealtimeHeartbeat) {
    window.clearInterval(sessionRealtimeHeartbeat);
    sessionRealtimeHeartbeat = null;
  }
  if (sessionRealtimeSocket) {
    sessionRealtimeSocket.close();
    sessionRealtimeSocket = null;
  }
}

function subscribeToSessionUpdates(sessionId: string) {
  closeSessionRealtime();
  stopSessionPolling();
  joinedStudentsPoll = window.setInterval(() => {
    refreshJoinedStudents(sessionId).catch(() => {});
  }, 3000);

  const wsUrl = realtimeWebsocketUrl();
  if (!wsUrl) {
    beginSessionPolling(sessionId);
    return;
  }

  const socket = new WebSocket(wsUrl);
  sessionRealtimeSocket = socket;

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({
      topic: "realtime:public:sessions",
      event: "phx_join",
      payload: {
        config: {
          broadcast: { self: false },
          presence: { key: "" },
          postgres_changes: [
            {
              event: "UPDATE",
              schema: "public",
              table: "sessions",
              filter: `id=eq.${sessionId}`,
            },
          ],
        },
      },
      ref: String(sessionRealtimeRef++),
    }));

    sessionRealtimeHeartbeat = window.setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({
        topic: "phoenix",
        event: "heartbeat",
        payload: {},
        ref: String(sessionRealtimeRef++),
      }));
    }, 25000);
  });

  socket.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data) as {
        event?: string;
        payload?: {
          eventType?: string;
          new?: SessionStateRow;
          data?: { eventType?: string; new?: SessionStateRow };
        };
      };

      if (msg.event !== "postgres_changes") return;
      const payload = msg.payload || {};
      const row = payload.new || payload.data?.new;
      const eventType = payload.eventType || payload.data?.eventType;
      if (eventType !== "UPDATE" || !row || row.id !== sessionId) return;

      const nextQuestionId = String(row.active_question_id || "");
      if (nextQuestionId !== currentQuestionId) {
        selectedAnswerIndex = null;
        lastSubmittedQuestionId = "";
        setStatus("submit-status", "");
        if (nextQuestionId) {
          playTone(740, 120);
          pulseStudentView("game-reveal");
        }
      }
      currentQuestionId = nextQuestionId;
      isLocked = Boolean(row.is_locked ?? true);
      if (isLocked && currentQuestionId && !lastKnownLockState) {
        playTone(260, 100);
        pulseStudentView("game-lock");
      }
      lastKnownLockState = isLocked;
      if (isLocked && lastSubmittedQuestionId === currentQuestionId) {
        setStatus("submit-status", "⏳ Answers locked. Waiting for reveal...");
      }
      updateQuestionUi();
    } catch {
      // ignore malformed realtime payloads
    }
  });

  socket.addEventListener("close", () => {
    closeSessionRealtime();
    beginSessionPolling(sessionId);
  });

  socket.addEventListener("error", () => {
    closeSessionRealtime();
    beginSessionPolling(sessionId);
  });
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

  const query = `select=id,join_code,active_question_id,is_locked&join_code=eq.${encodeURIComponent(code)}&limit=1`;
  const sessionRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?${query}`, { headers: headers() });
  const sessions = await parseJsonResponse<SessionStateRow[]>(sessionRes, "Failed to look up session");
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
  localStorage.setItem("joinCode", session.join_code || code);
  localStorage.setItem("studentName", uniqueStudentName);

  currentQuestionId = String(session.active_question_id || "");
  isLocked = Boolean(session.is_locked ?? true);
  loadStudentView();
  await refreshJoinedStudents(session.id);
  subscribeToSessionUpdates(session.id);
  updateQuestionUi();
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

async function submitAnswer(answerIndex: number) {
  const studentId = localStorage.getItem("studentId");
  const sessionId = localStorage.getItem("sessionId");

  if (!studentId || !sessionId) {
    setStatus("submit-status", "You are not connected to a session.");
    return;
  }

  if (!currentQuestionId) {
    setStatus("submit-status", "Waiting for your teacher to launch a question.");
    return;
  }

  if (isLocked) {
    setStatus("submit-status", "Answers are locked. Wait for the next question.");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/responses?on_conflict=session_id,question_id,student_id`, {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      session_id: sessionId,
      question_id: currentQuestionId,
      student_id: studentId,
      answer_index: answerIndex,
    }),
  });

  if (!res.ok) {
    setStatus("submit-status", "Submission failed. Try again.");
    return;
  }

  selectedAnswerIndex = answerIndex;
  lastSubmittedQuestionId = currentQuestionId;
  updateQuestionUi();
  playTone(520, 90);
  pulseStudentView("game-pop");
  setStatus("submit-status", "✅ Locked in!");
}

function bind() {
  document.getElementById("joinBtn")?.addEventListener("click", () => {
    joinSession().catch((e: any) => setStatus("join-status", e?.message || "Unable to join."));
  });

  document.querySelectorAll(".answerBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const answerIndex = Number((btn as HTMLElement).dataset.index || "0");
      submitAnswer(answerIndex).catch(() => setStatus("submit-status", "Submission failed."));
    });
  });

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code) {
    const codeInput = document.getElementById("codeInput") as HTMLInputElement | null;
    if (codeInput) codeInput.value = code;
  }

  const savedSessionId = localStorage.getItem("sessionId");
  if (localStorage.getItem("studentId") && savedSessionId) {
    loadStudentView();
    loadSessionState(savedSessionId).catch(() => {});
    subscribeToSessionUpdates(savedSessionId);
  }

  updateQuestionUi();
}

bind();
