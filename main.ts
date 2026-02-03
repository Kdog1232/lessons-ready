// ✅ FILE: src/main.ts (COPY/PASTE THIS WHOLE FILE)
console.log("✅ src/main.ts loaded");

// -------------------------
// ✅ CONFIG
// -------------------------
const SUPABASE_FN_URL =
  "https://pinplfyymnpfctwcpzol.supabase.co/functions/v1/generate-lesson";

const SUPABASE_BILLING_FN_URL =
  "https://pinplfyymnpfctwcpzol.supabase.co/functions/v1/create-checkout-session";

const SUPABASE_URL = "https://pinplfyymnpfctwcpzol.supabase.co";

// ✅ Put your Supabase anon/public key here (recommended).
const SUPABASE_ANON_KEY = "sb_publishable_HsaM0F2t0OJNjHt48hdYgw_OzBD_ylJ";

// ✅ Longer timeout
const HARD_TIMEOUT_MS = 180000; // 3 minutes

// ✅ Stripe publishable key (SAFE in frontend)
const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51SuRvaQu6FSRjIW6zjcH0X7n0jmSi8fOB10P5Oe1c4ZYn5nV5dd7lMeGkQZ4u4mx7mfH5d01bAbqoP8nbs14TyqP00HzRaaPcz";

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

/**
 * ✅ Turn plain URLs into clickable links.
 * Safe because we run AFTER escaping.
 */
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
    .slice(0, 80);
}

function esc(s: any) {
  return escapeHtml(String(s ?? ""));
}

function getAnonKey(): string {
  return (SUPABASE_ANON_KEY || "").trim();
}

function getStripe() {
  const w = window as any;
  if (!w.Stripe) return null;
  return w.Stripe(STRIPE_PUBLISHABLE_KEY);
}

// -------------------------
// ✅ NEW: Presets + Exports helpers
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
  const i = presets.findIndex(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
  const next: Preset = { name, createdAt: Date.now(), data };
  if (i >= 0) presets[i] = next;
  else presets.unshift(next);
  savePresets(presets);
}

function deletePreset(name: string) {
  const presets = loadPresets().filter(
    (p) => p.name.toLowerCase() !== name.toLowerCase(),
  );
  savePresets(presets);
}

function openPrintWindow(title: string, meta: string, bodyHtml: string) {
  const w = window.open("", "_blank");
  if (!w) throw new Error("Popup blocked. Allow popups to print.");

  w.document.open();
  w.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 28px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    .meta { color: #444; font-size: 12px; margin-bottom: 14px; }
    .rule { border-top: 1px solid #ddd; margin: 14px 0; }
    .noemoji { filter: grayscale(100%); }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; font-size: 12px; }
    th { background: #f5f5f5; text-align: left; }
    ul, ol { margin-top: 6px; }
    .secHead { margin-top: 16px; }
    .secTitle { font-weight: 700; }
    .secIcon { display: none; }
    a { color: #0b57d0; }
    @media print {
      a { color: #000; text-decoration: none; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(meta)}</div>
  <div class="rule"></div>
  <div class="noemoji">${bodyHtml}</div>
</body>
</html>
  `.trim());
  w.document.close();
  w.focus();
  w.print();
}

// -------------------------
// Minimal Supabase Auth (NO supabase-js import)
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
  if (!anon)
    throw new Error(
      "Missing Supabase anon key. Paste it into SUPABASE_ANON_KEY in main.ts.",
    );

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
  if (!anon)
    throw new Error(
      "Missing Supabase anon key. Paste it into SUPABASE_ANON_KEY in main.ts.",
    );

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
    r.split("|").slice(1, -1).map((c) => c.trim()),
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
// ✅ Whole-lesson de-dupe (handles accidental repeated output)
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

// -------------------------
// ✅ Mode normalization (keeps backward compat if old values appear)
// -------------------------
function normalizeMode(v: string) {
  const x = (v || "").trim();
  if (x === "lite") return "one_pager"; // legacy -> one-pager
  if (x === "full") return "full_lesson"; // legacy -> full lesson
  return x || "full_lesson";
}

// -------------------------
// App
// -------------------------
try {
  const landingView = getElOpt<HTMLElement>("landingView");
  const appView = getElOpt<HTMLElement>("appView");
  const logOutBtnApp = getElOpt<HTMLButtonElement>("logOutBtn_app");
  const messageApp = getElOpt<HTMLElement>("message_app");

  const btn = getEl<HTMLButtonElement>("generateBtn");
  const copyBtn = getEl<HTMLButtonElement>("copyBtn");
  const downloadPdfBtn = getEl<HTMLButtonElement>("downloadPdfBtn");

  // ✅ Optional export + preset controls (won't crash if missing)
  const printBtn = getElOpt<HTMLButtonElement>("printBtn");
  const copyDocsBtn = getElOpt<HTMLButtonElement>("copyDocsBtn");
  const outputStyle = getElOpt<HTMLSelectElement>("outputStyle");

  const presetName = getElOpt<HTMLInputElement>("presetName");
  const savePresetBtn = getElOpt<HTMLButtonElement>("savePresetBtn");
  const presetSelect = getElOpt<HTMLSelectElement>("presetSelect");
  const loadPresetBtn = getElOpt<HTMLButtonElement>("loadPresetBtn");
  const deletePresetBtn = getElOpt<HTMLButtonElement>("deletePresetBtn");

  // Billing buttons (optional)
  const billingBtn = getElOpt<HTMLButtonElement>("billingBtn"); // landing
  const billingBtnApp = getElOpt<HTMLButtonElement>("billingBtn_app"); // app

  const output = getEl<HTMLElement>("output");
  const message = getEl<HTMLElement>("message");
  const metaLineEl = getEl<HTMLElement>("metaLine");
  const statusPill = getEl<HTMLElement>("statusPill");

  const mode = getEl<HTMLSelectElement>("mode");
  const state = getEl<HTMLSelectElement>("state");
  const publisher = getEl<HTMLSelectElement>("publisher");
  const publisherOtherWrap = getEl<HTMLElement>("publisherOtherWrap");
  const publisherOther = getEl<HTMLInputElement>("publisherOther");

  const grade = getEl<HTMLSelectElement>("grade");
  const subject = getEl<HTMLSelectElement>("subject");

  const standard = getEl<HTMLInputElement>("standard");
  const unit = getEl<HTMLInputElement>("unit");
  const lesson = getEl<HTMLInputElement>("lesson");
  const testMode = getEl<HTMLInputElement>("testMode");

  // ✅ curriculum-agnostic inputs
  const skillFocus = getElOpt<HTMLTextAreaElement>("skillFocus");
  const subNotes = getElOpt<HTMLTextAreaElement>("subNotes"); // ✅ NEW
  const lessonCycleTemplate = getElOpt<HTMLSelectElement>("lessonCycleTemplate");
  const publisherComponents = getElOpt<HTMLTextAreaElement>("publisherComponents");
  const supportingStandards = getElOpt<HTMLInputElement>("supportingStandards");
  const lessonLength = getElOpt<HTMLInputElement>("lessonLength");
  const includeStaar = getElOpt<HTMLSelectElement>("includeStaar");

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

  // ✅ NEW (optional): Worksheet Pack UI controls (won't crash if missing)
  // Add these IDs to index.html when you're ready:
  // - worksheetToggle (checkbox)
  // - worksheetBeginnerCount, worksheetIntermediateCount, worksheetAdvancedCount (number inputs)
  const worksheetToggle = getElOpt<HTMLInputElement>("worksheetToggle");
  const worksheetBeginnerCount = getElOpt<HTMLInputElement>("worksheetBeginnerCount");
  const worksheetIntermediateCount = getElOpt<HTMLInputElement>("worksheetIntermediateCount");
  const worksheetAdvancedCount = getElOpt<HTMLInputElement>("worksheetAdvancedCount");

  // ✅ NEW: Worksheet Pack UI expand/collapse (no crashes if elements not present)
  // This hides the count inputs unless worksheetToggle is checked.
  function setupWorksheetPackUI() {
    if (!worksheetToggle) return;

    // Find the nearest sensible container to hide/show for each input:
    const blocks: HTMLElement[] = [];

    const addBlock = (el: HTMLElement | null) => {
      if (!el) return;
      // Prefer hiding the closest <label> (your UI uses labels as wrappers)
      const wrap =
        (el.closest("label") as HTMLElement | null) ||
        (el.parentElement as HTMLElement | null);
      if (wrap && !blocks.includes(wrap)) blocks.push(wrap);
    };

    addBlock(worksheetBeginnerCount);
    addBlock(worksheetIntermediateCount);
    addBlock(worksheetAdvancedCount);

    // If none exist yet, nothing to toggle.
    if (!blocks.length) return;

    const apply = () => {
      const show = !!worksheetToggle.checked;
      blocks.forEach((b) => {
        b.style.display = show ? "" : "none";
      });
    };

    worksheetToggle.addEventListener("change", apply);
    apply(); // run once at load
  }

  // Auth UI
  const authEmail = getEl<HTMLInputElement>("authEmail");
  const authPassword = getEl<HTMLInputElement>("authPassword");
  const signUpBtn = getEl<HTMLButtonElement>("signUpBtn");
  const logInBtn = getEl<HTMLButtonElement>("logInBtn");
  const logOutBtn = getEl<HTMLButtonElement>("logOutBtn");
  const authStatusPill = getEl<HTMLElement>("authStatusPill");
  const forgotPwBtn = getElOpt<HTMLButtonElement>("forgotPwBtn");

  // Library UI
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

    if (billingBtn) billingBtn.disabled = false;
    if (billingBtnApp) billingBtnApp.disabled = !loggedIn;
  }

  // Publisher "Other" UI
  const refreshPublisherUI = () => {
    publisherOtherWrap.style.display =
      publisher.value === "Other" ? "block" : "none";
  };
  publisher.addEventListener("change", refreshPublisherUI);
  refreshPublisherUI();

  // ✅ IMPORTANT: initialize the worksheet UI toggle once
  setupWorksheetPackUI();

  // ✅ Preset UI wiring (won't crash if not present)
  function collectFormState(): Record<string, any> {
    return {
      mode: mode.value,
      state: state.value,
      publisher: publisher.value,
      publisherOther: publisherOther.value,
      grade: grade.value,
      subject: subject.value,
      standard: standard.value,
      unit: unit.value,
      lesson: lesson.value,
      skillFocus: skillFocus?.value ?? "",
      subNotes: subNotes?.value ?? "",
      lessonCycleTemplate: lessonCycleTemplate?.value ?? "",
      publisherComponents: publisherComponents?.value ?? "",
      supportingStandards: supportingStandards?.value ?? "",
      lessonLength: lessonLength?.value ?? "",
      includeStaar: includeStaar?.value ?? "no",
      outputStyle: outputStyle?.value ?? "default",
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

      // ✅ NEW: worksheets
      worksheetToggle: worksheetToggle?.checked ?? false,
      worksheetBeginnerCount: worksheetBeginnerCount?.value ?? "",
      worksheetIntermediateCount: worksheetIntermediateCount?.value ?? "",
      worksheetAdvancedCount: worksheetAdvancedCount?.value ?? "",
    };
  }

  function applyFormState(data: Record<string, any>) {
    if (data.mode) mode.value = data.mode;
    if (data.state !== undefined) state.value = data.state;
    if (data.publisher) publisher.value = data.publisher;
    if (data.publisherOther !== undefined)
      publisherOther.value = data.publisherOther;
    if (data.grade) grade.value = data.grade;
    if (data.subject) subject.value = data.subject;
    if (data.standard !== undefined) standard.value = data.standard;
    if (data.unit !== undefined) unit.value = data.unit;
    if (data.lesson !== undefined) lesson.value = data.lesson;

    if (skillFocus && data.skillFocus !== undefined)
      skillFocus.value = data.skillFocus;
    if (subNotes && data.subNotes !== undefined) subNotes.value = data.subNotes;
    if (lessonCycleTemplate && data.lessonCycleTemplate !== undefined)
      lessonCycleTemplate.value = data.lessonCycleTemplate;
    if (publisherComponents && data.publisherComponents !== undefined)
      publisherComponents.value = data.publisherComponents;
    if (supportingStandards && data.supportingStandards !== undefined)
      supportingStandards.value = data.supportingStandards;
    if (lessonLength && data.lessonLength !== undefined)
      lessonLength.value = data.lessonLength;
    if (includeStaar && data.includeStaar !== undefined)
      includeStaar.value = data.includeStaar;

    if (outputStyle && data.outputStyle !== undefined)
      outputStyle.value = data.outputStyle;

    if (ebSupport && data.ebSupport !== undefined)
      ebSupport.checked = !!data.ebSupport;
    if (spedSupport && data.spedSupport !== undefined)
      spedSupport.checked = !!data.spedSupport;
    if (vocabularyFocus && data.vocabularyFocus !== undefined)
      vocabularyFocus.checked = !!data.vocabularyFocus;
    if (checksForUnderstanding && data.checksForUnderstanding !== undefined)
      checksForUnderstanding.checked = !!data.checksForUnderstanding;
    if (writingExtension && data.writingExtension !== undefined)
      writingExtension.checked = !!data.writingExtension;

    if (practiceToggle && data.practiceToggle !== undefined)
      practiceToggle.checked = !!data.practiceToggle;
    if (practiceGenre && data.practiceGenre !== undefined)
      practiceGenre.value = data.practiceGenre;
    if (slangLevel && data.slangLevel !== undefined)
      slangLevel.value = data.slangLevel;
    if (practiceTopic && data.practiceTopic !== undefined)
      practiceTopic.value = data.practiceTopic;
    if (allowTrendy && data.allowTrendy !== undefined)
      allowTrendy.value = data.allowTrendy;

    // ✅ NEW: worksheets
    if (worksheetToggle && data.worksheetToggle !== undefined)
      worksheetToggle.checked = !!data.worksheetToggle;
    if (worksheetBeginnerCount && data.worksheetBeginnerCount !== undefined)
      worksheetBeginnerCount.value = String(data.worksheetBeginnerCount || "");
    if (worksheetIntermediateCount && data.worksheetIntermediateCount !== undefined)
      worksheetIntermediateCount.value = String(
        data.worksheetIntermediateCount || "",
      );
    if (worksheetAdvancedCount && data.worksheetAdvancedCount !== undefined)
      worksheetAdvancedCount.value = String(data.worksheetAdvancedCount || "");

    refreshPublisherUI();

    // ✅ re-apply worksheet UI visibility after preset load
    setupWorksheetPackUI();
  }

  function refreshPresetDropdown() {
    if (!presetSelect) return;
    const presets = loadPresets();
    presetSelect.innerHTML =
      `<option value="" selected>Select preset…</option>` +
      presets
        .map(
          (p) =>
            `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`,
        )
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

  // Show checkout success banner (optional)
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("paid") === "1") {
      showMessage("Payment successful ✅ Your subscription is active.", true);
      url.searchParams.delete("paid");
      window.history.replaceState({}, "", url.toString());
    }
  } catch {}

  // -------------------------
  // ✅ CHECKOUT LOGIC
  // -------------------------
  async function ensureLoggedInForBilling() {
    const s = getSavedSession();
    if (s?.access_token) return s;

    const email = authEmail.value.trim();
    const pw = authPassword.value.trim();

    if (!email || !pw) {
      throw new Error("Enter email + password first, then click Start Free Trial.");
    }

    try {
      return await logIn(email, pw);
    } catch {
      return await signUp(email, pw);
    }
  }

  async function beginCheckout() {
    clearMessage();

    const anon = getAnonKey();
    if (!anon)
      throw new Error(
        "Missing Supabase anon key. Paste it into SUPABASE_ANON_KEY in main.ts.",
      );

    const session = await ensureLoggedInForBilling();

    const stripe = getStripe();
    if (!stripe) {
      console.warn(
        "⚠️ Stripe.js not found. Ensure <script src='https://js.stripe.com/v3/'></script> is in index.html",
      );
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
        success_url:
          window.location.origin + window.location.pathname + "?paid=1",
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

    window.location.href = url;
  }

  signUpBtn.addEventListener("click", async () => {
    try {
      signUpBtn.disabled = true;
      await beginCheckout();
    } catch (e: any) {
      showMessage(`Trial: ${esc(e?.message || e)}`, false);
      signUpBtn.disabled = false;
    } finally {
      refreshAuthUI();
    }
  });

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

  if (billingBtnApp) {
    billingBtnApp.addEventListener("click", async () => {
      try {
        billingBtnApp.disabled = true;
        await beginCheckout();
      } catch (e: any) {
        showMessage(`Billing: ${esc(e?.message || e)}`, false);
        billingBtnApp.disabled = false;
      } finally {
        refreshAuthUI();
      }
    });
  }

  // -------------------------
  // Auth actions
  // -------------------------
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

  if (forgotPwBtn) {
    forgotPwBtn.addEventListener("click", async () => {
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

  if (printBtn) {
    printBtn.addEventListener("click", () => {
      const html = (output.innerHTML || "").trim();
      if (!html || html === "(nothing yet)") {
        showMessage("Generate a lesson first, then print.", false);
        return;
      }
      try {
        openPrintWindow(
          "Lessons-Ready Lesson Plan",
          metaLineEl.textContent || "",
          html,
        );
        showMessage("Print window opened ✅", true);
      } catch (e: any) {
        showMessage(`Print error: ${esc(e?.message || e)}`, false);
      }
    });
  }

  // Download PDF
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

  // -------------------------
  // ✅ Streaming merge helper (fixes duplication)
  // -------------------------
  function applyStreamChunk(
    current: string,
    chunk: string,
    lastChunk?: string,
  ): { text: string; lastChunk?: string } {
    const c = (chunk || "").toString();
    if (!c) return { text: current, lastChunk };

    if (lastChunk && c === lastChunk) return { text: current, lastChunk };

    if (c.includes(current) && c.length >= current.length) {
      return { text: c, lastChunk: c };
    }

    if (current.includes(c) && c.length > 20) {
      return { text: current, lastChunk: c };
    }

    const maxOverlap = Math.min(1200, current.length, c.length);
    for (let k = maxOverlap; k >= 10; k--) {
      if (current.endsWith(c.slice(0, k))) {
        return { text: current + c.slice(k), lastChunk: c };
      }
    }

    return { text: current + c, lastChunk: c };
  }

  // -------------------------
  // ✅ Guardrails for Skill Focus
  // -------------------------
  function validateSkillFocus(): { ok: boolean; message?: string } {
    if (!skillFocus) return { ok: true };
    const sf = skillFocus.value.trim();
    if (!sf)
      return {
        ok: false,
        message:
          "Skill Focus is required. Add 1–2 sentences in plain English.",
      };
    if (sf.length > 420) {
      return {
        ok: false,
        message:
          "Skill Focus is too long. Keep it to 1–2 sentences (roughly < 420 characters).",
      };
    }
    return { ok: true };
  }

  // -------------------------
  // ✅ Worksheet Pack helper (optional UI)
  // -------------------------
  function getWorksheetPackFromUI() {
    // If you don't have the UI elements yet, this safely returns null.
    const enabled = worksheetToggle ? !!worksheetToggle.checked : false;
    if (!enabled) return null;

    const b = worksheetBeginnerCount ? Number(worksheetBeginnerCount.value) : NaN;
    const i = worksheetIntermediateCount
      ? Number(worksheetIntermediateCount.value)
      : NaN;
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

  // -------------------------
  // Generate (stream-first + fallback + timeout)
  // -------------------------
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
      if (!anon)
        throw new Error(
          "Missing Supabase anon key. Paste it into SUPABASE_ANON_KEY in main.ts.",
        );

      const session = requireSession();

      const { publisher: pub, publisherOther: pubOther } = getPublisher();
      const st = state.value;

      const wantsStream = !testMode.checked;

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

      const payload: any = {
        model: "gpt-4o-mini",
        mode: chosenMode,
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

        outputStyle: style,

        lessonLengthMinutes: Number.isFinite(lessonLengthNum) ? lessonLengthNum : 45,
        includeStaarStyleQuestions: includeStaarBool,
      };

      // Back-compat fields (safe)
      if (lessonLength)
        payload.lessonLength = Number.isFinite(lessonLengthNum) ? lessonLengthNum : null;
      if (includeStaar) payload.includeStaar = includeStaar.value || "no";

      if (skillFocus) payload.skillFocus = skillFocus.value.trim();
      if (subNotes) payload.subNotes = subNotes.value.trim(); // ✅ NEW
      if (lessonCycleTemplate)
        payload.districtLessonCycleName = lessonCycleTemplate.value || "";
      if (publisherComponents)
        payload.publisherComponents = publisherComponents.value.trim();
      if (supportingStandards)
        payload.supportingStandards = supportingStandards.value.trim();

      const supportsObj = {
        eb: ebSupport ? !!ebSupport.checked : null,
        sped: spedSupport ? !!spedSupport.checked : null,
        vocabulary: vocabularyFocus ? !!vocabularyFocus.checked : null,
        cfus: checksForUnderstanding ? !!checksForUnderstanding.checked : null,
        writingExtension: writingExtension ? !!writingExtension.checked : null,
      };
      payload.supports = supportsObj;

      payload.options = {
        ebSupport: ebSupport ? !!ebSupport.checked : true,
        spedSupport: spedSupport ? !!spedSupport.checked : true,
        vocabularyFocus: vocabularyFocus ? !!vocabularyFocus.checked : true,
        checksForUnderstanding: checksForUnderstanding
          ? !!checksForUnderstanding.checked
          : true,
        writingExtension: writingExtension ? !!writingExtension.checked : false,
        subNotes: subNotes ? subNotes.value.trim() : "", // ✅ NEW (duplicate place = easy server access)
      };

      const wantsPractice = practiceToggle ? !!practiceToggle.checked : false;
      payload.practice = {
        enabled: wantsPractice,
        genre: practiceGenre ? practiceGenre.value : "informational",
        slangLevel: slangLevel ? slangLevel.value : "none",
        topic: practiceTopic ? practiceTopic.value.trim() : "",
        allowTrendy: allowTrendy ? allowTrendy.value : "yes",
      };

      payload.generatePracticePassageAndMCQs = wantsPractice;
      payload.practiceGenre = practiceGenre ? practiceGenre.value : "informational";
      payload.practiceTopic = practiceTopic ? practiceTopic.value.trim() : "";
      payload.allowTrendyReferences = allowTrendy ? allowTrendy.value === "yes" : true;
      payload.slangLevel = slangLevel ? (slangLevel.value as any) : "light";

      // ✅ NEW: Worksheets -> backend worksheetPack
      const worksheetPack = getWorksheetPackFromUI();
      if (worksheetPack) {
        payload.worksheetPack = worksheetPack;
        payload.options.worksheetPack = worksheetPack;
      }

      setMeta(
        `${pub}${pub === "Other" ? ` (${pubOther || ""})` : ""} • ${
          st || "State/Framework: n/a"
        } • Output: ${style} • Mode: ${chosenMode}${
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

      if (wantsStream && contentType.includes("text/event-stream")) {
        let liveText = "";
        let lastChunk = "";
        let lastRendered = "";

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
                output.innerHTML = formatLessonToHtml(liveText);
              }
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

      lessonText = dedupeWholeTextIfRepeated(lessonText);

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


