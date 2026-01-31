// ✅ FILE: src/main.ts (COPY/PASTE THIS WHOLE FILE)
console.log("✅ src/main.ts loaded");

const SUPABASE_FN_URL =
  "https://pinplfyymnpfctwcpzol.supabase.co/functions/v1/generate-lesson";

// ✅ Billing checkout edge function (you will create this edge function)
const SUPABASE_BILLING_FN_URL =
  "https://pinplfyymnpfctwcpzol.supabase.co/functions/v1/create-checkout-session";

// Use your project URL for Supabase Auth + REST
const SUPABASE_URL = "https://pinplfyymnpfctwcpzol.supabase.co";

// Hard timeout so users never wait forever
const HARD_TIMEOUT_MS = 30000;

// ✅ Stripe publishable key (SAFE in frontend)
const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51SuRvaQu6FSRjIW6zjcH0X7n0jmSi8fOB10P5Oe1c4ZYn5nV5dd7lMeGkQZ4u4mx7mfH5d01bAbqoP8nbs14TyqP00HzRaaPcz";

// Stripe.js must be loaded in index.html:
// <script src="https://js.stripe.com/v3/"></script>
const stripe = (window as any).Stripe
  ? (window as any).Stripe(STRIPE_PUBLISHABLE_KEY)
  : null;

// -------------------------
// Helpers
// -------------------------
function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element with id="${id}" in index.html`);
  return el as T;
}

function getElOpt<T extends HTMLElement>(id: string): T | null {
  const el = document.getElementById(id);
  return (el as T) || null;
}

function showFatal(err: any) {
  console.error(err);
  const m =
    document.getElementById("message") || document.getElementById("message_app");
  if (m) {
    m.innerHTML = `<div class="error"><b>UI Error:</b> ${String(
      err?.message || err,
    )}</div>`;
  } else {
    alert(`UI Error: ${String(err?.message || err)}`);
  }
}

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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
    .slice(0, 80);
}

function esc(s: any) {
  return escapeHtml(String(s ?? ""));
}

// ✅ IMPORTANT: anon key getter must be TOP-LEVEL (used by auth + postgrest)
function getAnonKey(): string {
  const a = document.getElementById("anonKey") as HTMLInputElement | null;
  if (a?.value?.trim()) return a.value.trim();
  const b = document.getElementById("anonKey_app") as HTMLInputElement | null;
  if (b?.value?.trim()) return b.value.trim();
  return "";
}

// -------------------------
// Minimal Supabase Auth (NO supabase-js import)
// Uses Supabase Auth REST + PostgREST with JWT
// -------------------------
type Session = {
  access_token: string;
  refresh_token: string;
  user: { id: string; email?: string | null };
};

const LS_SESSION_KEY = "lr_supabase_session_v1";

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
  if (!anon) throw new Error("Paste your Supabase anon/public key first.");
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
  return session;
}

async function logOut() {
  setSavedSession(null);
}

function clearSessionAndThrow(msg = "Invalid session. Please log in again.") {
  setSavedSession(null);
  throw new Error(msg);
}

function requireSession(): Session {
  const s = getSavedSession();
  if (!s?.access_token) throw new Error("Please log in to use this feature.");
  return s;
}

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
  if (!anon) throw new Error("Paste your Supabase anon/public key first.");
  const session = requireSession();

  const url = `${SUPABASE_URL}/rest/v1/${table}${
    opts.query ? `?${opts.query}` : ""
  }`;

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
      clearSessionAndThrow("Session expired. Log in again.");
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
// Streaming (SSE) Reader
// -------------------------
type StreamHooks = {
  onMeta?: (meta: any) => void;
  onDelta?: (text: string) => void;
  onErrorEvent?: (err: any) => void;
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
    const dataLines = lines
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim());

    if (!dataLines.length) return;

    for (const d of dataLines) {
      if (!d) continue;
      if (d === "[DONE]") return;

      let obj: any = null;
      try {
        obj = JSON.parse(d);
      } catch {
        obj = { type: "text", text: d };
      }

      if (obj?.type === "meta") hooks.onMeta?.(obj);

      if (typeof obj?.type === "string" && obj.type.includes("delta")) {
        if (typeof obj?.delta === "string") hooks.onDelta?.(obj.delta);
        continue;
      }

      const delta =
        obj?.delta ??
        obj?.text ??
        obj?.output_text ??
        obj?.data?.delta ??
        obj?.data?.text ??
        obj?.content?.delta;

      if (typeof delta === "string" && delta) hooks.onDelta?.(delta);

      if (obj?.type === "error") hooks.onErrorEvent?.(obj);
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
const emojiHeadRegex =
  /^([\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}])\s*(.*)$/u;

function isEmojiOnlyLine(t: string) {
  const m = t.match(emojiHeadRegex);
  return Boolean(m && (m[2] ?? "").trim() === "");
}

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
        `<tr>${row
          .map((c) => `<td>${escapeHtml(c)}</td>`)
          .join("")}</tr>`,
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
    r.split("|").slice(1, -1).map((c) => c.trim()),
  );
  const header = cells[0];
  const body = cells.slice(1);

  const th = header.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const trs = body
    .map(
      (row) =>
        `<tr>${row
          .map((c) => `<td>${escapeHtml(c)}</td>`)
          .join("")}</tr>`,
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

  const lines = bolded.split("\n");
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

    if (t && isEmojiOnlyLine(t)) {
      const icon = t.match(emojiHeadRegex)![1];
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

// -------------------------
// PDF Generation (pdf-lib)
// -------------------------
async function downloadTextAsPdf(opts: {
  title: string;
  metaLine: string;
  body: string;
  filename: string;
}) {
  // @ts-ignore
  const PDFLib = (window as any).PDFLib;
  if (!PDFLib)
    throw new Error(
      "PDF library not found. Make sure pdf-lib script is included.",
    );

  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  function toWinAnsiSafeText(input: string) {
    return (input || "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[—–]/g, "-")
      .replaceAll("✅", "[OK]")
      .replaceAll("⭐", "*")
      .replaceAll("★", "*")
      .replaceAll("☆", "*")
      .replaceAll("📘", "")
      .replaceAll("🎯", "")
      .replaceAll("🧠", "")
      .replaceAll("🗣️", "")
      .replaceAll("🧱", "")
      .replaceAll("🪜", "")
      .replaceAll("🤝", "")
      .replaceAll("🚪", "")
      .replaceAll("🗺️", "")
      .replaceAll("⏱️", "")
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

    const looksLikeHeader =
      /^[📘🎯✅🧠🗣️🧱🪜🤝🚪🗺️⏱️]/.test(line.trim()) ||
      (line.length < 60 && !line.includes(":") && /^[A-Za-z]/.test(line));

    if (looksLikeHeader) {
      ensureSpace(24);
      page.drawText(toWinAnsiSafeText(line.replace(/\*\*/g, "")), {
        x: margin,
        y,
        size: 12,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      y -= 18;
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
// App
// -------------------------
try {
  // Optional Landing/App wrappers
  const landingView = getElOpt<HTMLElement>("landingView");
  const appView = getElOpt<HTMLElement>("appView");
  const anonKeyApp = getElOpt<HTMLInputElement>("anonKey_app");
  const logOutBtnApp = getElOpt<HTMLButtonElement>("logOutBtn_app");
  const messageApp = getElOpt<HTMLElement>("message_app");

  // Existing controls
  const btn = getEl<HTMLButtonElement>("generateBtn");
  const copyBtn = getEl<HTMLButtonElement>("copyBtn");
  const downloadPdfBtn = getEl<HTMLButtonElement>("downloadPdfBtn");

  // ✅ Billing button (add <button id="billingBtn">Start free trial</button> anywhere you want)
  const billingBtn = getElOpt<HTMLButtonElement>("billingBtn");

  const output = getEl<HTMLElement>("output");
  const message = getEl<HTMLElement>("message"); // landing message
  const metaLineEl = getEl<HTMLElement>("metaLine");
  const statusPill = getEl<HTMLElement>("statusPill");

  const anonKey = getEl<HTMLInputElement>("anonKey");
  const mode = getEl<HTMLSelectElement>("mode");
  const state = getEl<HTMLSelectElement>("state");
  const publisher = getEl<HTMLSelectElement>("publisher");
  const publisherOtherWrap = getEl<HTMLElement>("publisherOtherWrap");
  const publisherOther = getEl<HTMLInputElement>("publisherOther");

  // ✅ FIX: these are <select> in your HTML
  const grade = getEl<HTMLSelectElement>("grade");
  const subject = getEl<HTMLSelectElement>("subject");

  const standard = getEl<HTMLInputElement>("standard");
  const unit = getEl<HTMLInputElement>("unit");
  const lesson = getEl<HTMLInputElement>("lesson");
  const testMode = getEl<HTMLInputElement>("testMode");

  // Auth UI
  const authEmail = getEl<HTMLInputElement>("authEmail");
  const authPassword = getEl<HTMLInputElement>("authPassword");
  const signUpBtn = getEl<HTMLButtonElement>("signUpBtn");
  const logInBtn = getEl<HTMLButtonElement>("logInBtn");
  const logOutBtn = getEl<HTMLButtonElement>("logOutBtn");
  const authStatusPill = getEl<HTMLElement>("authStatusPill");

  // Favorite + library UI
  const favoriteBtn = getEl<HTMLButtonElement>("favoriteBtn");
  const openLibraryBtn = getEl<HTMLButtonElement>("openLibraryBtn");
  const closeLibraryBtn = getEl<HTMLButtonElement>("closeLibraryBtn");
  const outputView = getEl<HTMLElement>("outputView");
  const libraryView = getEl<HTMLElement>("libraryView");
  const librarySearch = getEl<HTMLInputElement>("librarySearch");
  const libraryList = getEl<HTMLElement>("libraryList");

  let lastLessonPlainText = "";
  let activeStreamAbort: AbortController | null = null;

  let lastLessonId: string | null = null;
  let lastLessonFavorite = false;

  // Sync anon key into app view display field
  function syncAnonKeyToApp() {
    if (anonKeyApp) anonKeyApp.value = anonKey.value.trim();
  }
  anonKey.addEventListener("input", syncAnonKeyToApp);
  syncAnonKeyToApp();

  function setStatus(text: string) {
    statusPill.textContent = text;
  }

  function activeMessageEl(): HTMLElement {
    const appIsVisible = appView ? appView.style.display !== "none" : true;
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

  function getPublisher(): { publisher: string; publisherOther?: string } {
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

  function showLibrary(show: boolean) {
    outputView.style.display = show ? "none" : "block";
    libraryView.style.display = show ? "block" : "none";
    openLibraryBtn.style.display = show ? "none" : "inline-block";
    closeLibraryBtn.style.display = show ? "inline-block" : "none";
  }

  function setView(isLoggedIn: boolean) {
    if (!landingView || !appView) return;
    landingView.style.display = isLoggedIn ? "none" : "block";
    appView.style.display = isLoggedIn ? "block" : "none";
    syncAnonKeyToApp();
  }

  function refreshAuthUI() {
    const s = getSavedSession();
    const loggedIn = Boolean(s?.access_token);

    authStatusPill.textContent = loggedIn
      ? `Logged in: ${s?.user?.email || s?.user?.id}`
      : "Not logged in";

    signUpBtn.style.display = loggedIn ? "none" : "inline-block";
    logInBtn.style.display = loggedIn ? "none" : "inline-block";
    logOutBtn.style.display = loggedIn ? "inline-block" : "none";

    setView(loggedIn);

    favoriteBtn.disabled = !loggedIn || !lastLessonId;

    if (billingBtn) billingBtn.disabled = !loggedIn;
  }

  const refreshPublisherUI = () => {
    publisherOtherWrap.style.display =
      publisher.value === "Other" ? "block" : "none";
  };
  publisher.addEventListener("change", refreshPublisherUI);
  refreshPublisherUI();

  // -------------------------
  // ✅ CHECKOUT LOGIC
  // - Calls your Supabase Edge Function to create a Stripe Checkout Session
  // - Redirects to the returned Stripe-hosted URL
  // -------------------------
  async function beginCheckout() {
    clearMessage();

    const anon = getAnonKey();
    if (!anon) throw new Error("Paste your Supabase anon/public key first.");
    const session = requireSession();

    if (!stripe) {
      // Not required for redirecting to a URL, but helps you detect Stripe.js missing
      console.warn("⚠️ Stripe not initialized. (Check you loaded v3 script tag.)");
    }

    showMessage("💳 Opening secure checkout…", true);

    const res = await fetch(SUPABASE_BILLING_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        // your edge function can use these (optional)
        success_url: window.location.origin + window.location.pathname + "?paid=1",
        cancel_url: window.location.href,
      }),
    });

    const raw = await res.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(raw || "Checkout error.");
    }

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || `Checkout failed (${res.status})`);
    }

    const url = data?.url;
    if (!url) throw new Error("Checkout URL missing from server response.");

    // ✅ Redirect to Stripe-hosted Checkout page
    window.location.href = url;
  }

  if (billingBtn) {
    billingBtn.addEventListener("click", async () => {
      try {
        billingBtn.disabled = true;
        await beginCheckout();
      } catch (e: any) {
        showMessage(`Billing: ${esc(e?.message || e)}`, false);
        billingBtn.disabled = false;
      } finally {
        refreshAuthUI();
      }
    });
  }

  // Auth actions
  signUpBtn.addEventListener("click", async () => {
    try {
      clearMessage();
      const email = authEmail.value.trim();
      const pw = authPassword.value.trim();
      if (!email || !pw) return showMessage("Enter email + password.", false);
      await signUp(email, pw);
      showMessage("Signed up + logged in ✅", true);
      refreshAuthUI();
    } catch (e: any) {
      showMessage(`Sign up failed: ${esc(e?.message || e)}`, false);
    }
  });

  logInBtn.addEventListener("click", async () => {
    try {
      clearMessage();
      const email = authEmail.value.trim();
      const pw = authPassword.value.trim();
      if (!email || !pw) return showMessage("Enter email + password.", false);
      await logIn(email, pw);
      showMessage("Logged in ✅", true);
      refreshAuthUI();
    } catch (e: any) {
      showMessage(`Login failed: ${esc(e?.message || e)}`, false);
    }
  });

  async function doLogout() {
    await logOut();
    showMessage("Logged out ✅", true);
    lastLessonId = null;
    lastLessonFavorite = false;
    favoriteBtn.textContent = "☆ Favorite";
    favoriteBtn.disabled = true;
    refreshAuthUI();
  }

  logOutBtn.addEventListener("click", doLogout);
  if (logOutBtnApp) logOutBtnApp.addEventListener("click", doLogout);

  // Copy output
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

  // Download PDF (current output)
  downloadPdfBtn.addEventListener("click", async () => {
    const text = (lastLessonPlainText || "").trim();
    if (!text)
      return showMessage(
        "Generate a lesson first, then download the PDF.",
        false,
      );

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

  // Favorite toggle
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

  // Library
  async function loadLibrary() {
    clearMessage();
    requireSession();

    const q = librarySearch.value.trim().toLowerCase();

    const rows = await postgrest("GET", "lessons", {
      query:
        "select=id,created_at,grade,subject,standard,curriculum_unit,curriculum_lesson,publisher,state,is_favorite,lesson_text,lesson_html" +
        "&order=created_at.desc" +
        "&limit=50",
    });

    let data = Array.isArray(rows) ? rows : [];

    if (q) {
      data = data.filter((r: any) => {
        const blob = [
          r.standard,
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
        const title = `Grade ${r.grade ?? "?"} • ${r.subject ?? ""} • ${
          r.standard ?? ""
        }`.trim();

        const metaTxt = `${r.publisher ?? ""}${
          r.state ? ` • ${r.state}` : ""
        } • ${r.curriculum_unit ?? ""} ${r.curriculum_lesson ?? ""}`.trim();

        const star = r.is_favorite ? "★" : "☆";

        return `
          <div class="libraryCard" data-id="${esc(r.id)}">
            <div class="libraryTop">
              <div>
                <div class="libraryTitle">${esc(title)}</div>
                <div class="libraryMeta">${esc(metaTxt)}</div>
              </div>
              <div class="libraryBtns">
                <button class="smallBtn star" data-action="star">${star} Favorite</button>
                <button class="smallBtn" data-action="open">Open</button>
                <button class="smallBtn" data-action="pdf">PDF</button>
                <button class="smallBtn danger" data-action="delete">Delete</button>
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
            "select=id,is_favorite,lesson_text,lesson_html,grade,subject,standard,curriculum_unit,curriculum_lesson" +
            `&id=eq.${encodeURIComponent(lessonId)}` +
            "&limit=1",
        });

        const data = Array.isArray(rows) ? rows[0] : null;
        if (!data) return showMessage("Lesson not found.", false);

        showLibrary(false);

        lastLessonId = data.id;
        lastLessonFavorite = Boolean(data.is_favorite);
        favoriteBtn.disabled = false;
        favoriteBtn.textContent = lastLessonFavorite
          ? "★ Favorited"
          : "☆ Favorite";

        output.innerHTML =
          data.lesson_html || formatLessonToHtml(data.lesson_text || "");
        lastLessonPlainText = htmlToPlainText(output.innerHTML);
        downloadPdfBtn.disabled = !lastLessonPlainText.trim();

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

      if (action === "star") {
        const rows = await postgrest("GET", "lessons", {
          query: `select=is_favorite&id=eq.${encodeURIComponent(
            lessonId,
          )}&limit=1`,
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

  // ✅ Generate: uses USER token + stream-first + fallback + timeout
  btn.addEventListener("click", async () => {
    if (activeStreamAbort) activeStreamAbort.abort();
    activeStreamAbort = new AbortController();

    clearMessage();
    output.innerHTML = "";
    lastLessonPlainText = "";
    downloadPdfBtn.disabled = true;

    btn.disabled = true;
    setStatus("Working…");

    const timeoutId = setTimeout(() => {
      try {
        activeStreamAbort?.abort();
      } catch {}
    }, HARD_TIMEOUT_MS);

    try {
      const anon = getAnonKey();
      if (!anon) throw new Error("Paste your Supabase anon/public key first.");

      const session = requireSession();

      const { publisher: pub, publisherOther: pubOther } = getPublisher();
      const st = state.value;

      const wantsStream = !testMode.checked;

      const payload: any = {
        model: "gpt-4o-mini",
        mode: mode.value,
        testMode: testMode.checked,
        stream: wantsStream,

        publisher: pub,
        publisherOther: pubOther,
        state: st,

        grade: Number(grade.value),
        subject: subject.value.trim(),
        standard: standard.value.trim(),
        curriculumUnit: unit.value.trim(),
        curriculumLesson: lesson.value.trim(),
      };

      setMeta(
        `${pub}${pub === "Other" ? ` (${pubOther || ""})` : ""} • ${
          st || "State: n/a"
        } • Mode: ${mode.value}${testMode.checked ? " • Test Mode" : " • Live"}`,
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

      if (wantsStream && contentType.includes("text/event-stream")) {
        let liveText = "";
        output.classList.add("typing");
        output.textContent = " ";

        await readSSEStream(
          res,
          {
            onDelta: (chunk) => {
              liveText += chunk;
              output.innerHTML = formatLessonToHtml(liveText);
            },
          },
          activeStreamAbort.signal,
        );

        output.classList.remove("typing");
        lessonText = liveText;
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
      }

      output.innerHTML = formatLessonToHtml(lessonText);
      lastLessonPlainText = htmlToPlainText(output.innerHTML);
      downloadPdfBtn.disabled = !lastLessonPlainText.trim();

      const row = {
        user_id: session.user.id,
        publisher: pub,
        publisher_other: pub === "Other" ? pubOther || null : null,
        state: st || null,
        grade: Number(grade.value) || null,
        subject: subject.value.trim() || null,
        standard: standard.value.trim() || null,
        curriculum_unit: unit.value.trim() || null,
        curriculum_lesson: lesson.value.trim() || null,
        lesson_text: lessonText || "(empty)",
        lesson_html: output.innerHTML || null,
        is_favorite: false,
      };

      const inserted = await postgrest("POST", "lessons", {
        body: row,
        preferReturn: "representation",
      });

      const saved = Array.isArray(inserted) ? inserted[0] : inserted;
      lastLessonId = saved?.id || null;
      lastLessonFavorite = Boolean(saved?.is_favorite);

      favoriteBtn.disabled = !lastLessonId;
      favoriteBtn.textContent = "☆ Favorite";

      showMessage("Success ✅ Saved to Library", true);
      setStatus("Done");
    } catch (err: any) {
      const msg =
        err?.name === "AbortError"
          ? "Timed out. Try again (first request can be slower)."
          : String(err?.message || err);

      showMessage(esc(msg), false);
      output.classList.remove("typing");
      output.innerHTML = `<pre style="white-space:pre-wrap;margin:0;">${escapeHtml(
        msg,
      )}</pre>`;
      setStatus("Error");
    } finally {
      clearTimeout(timeoutId);
      btn.disabled = false;
      if (statusPill.textContent === "Working…") setStatus("Idle");
      refreshAuthUI();
    }
  });

  // Initial UI state
  setStatus("Idle");
  setMeta("Ready when you are.");
  refreshAuthUI();
} catch (err) {
  showFatal(err);
}
