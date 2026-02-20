// src/utils/skillFocus.ts

type SkillFocusInputs = {
  standard?: string; // e.g. "TEKS 4.8B" or "4.8B"
  grade?: string | number; // e.g. 4
  subject?: string; // e.g. "ELAR", "Math"
  publisher?: string; // e.g. "Bluebonnet Learning (TX OER)"
  unit?: string;
  lesson?: string;
};

function cleanStandard(raw?: string) {
  if (!raw) return "";
  // Normalize "TEKS 4.8B" -> "4.8B"
  return raw
    .trim()
    .replace(/^TEKS\s*/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function detectSubject(raw?: string) {
  const s = (raw || "").toLowerCase();
  if (s.includes("elar") || s.includes("ela") || s.includes("reading") || s.includes("rla")) return "ELAR";
  if (s.includes("math")) return "Math";
  if (s.includes("science")) return "Science";
  if (s.includes("social")) return "Social Studies";
  return (raw || "").trim() || "General";
}

/**
 * A small “high-impact” dictionary. Add to this over time based on real usage.
 * Key format: "<grade>.<strand><letter>" or "<grade>.<number><letter>"
 * Example: "4.8B"
 */
const TEKS_SKILL_MAP: Record<string, string> = {
  // ELAR examples (add your highest-traffic ones first)
  "4.8B": "Students will determine the theme of a text and support their thinking with evidence.",
  "5.7C": "Students will analyze how an author develops characters and support ideas with text evidence.",

  // Math example (placeholder — replace with real wording you prefer)
  "2.9": "Students will solve problems using place value and explain their thinking with models or equations.",
};

/**
 * Rule-based fallback templates by subject.
 * Keeps it 1–2 sentences, plain-English, and usable even without a perfect mapping.
 */
function subjectTemplate(subject: string, grade?: string | number, std?: string) {
  const g = grade ? `Grade ${grade}` : "Students";
  const code = std ? ` (${std})` : "";

  switch (subject) {
    case "ELAR":
      return `${g} will practice the targeted reading/writing skill${code} and support answers using evidence from the text.`;
    case "Math":
      return `${g} will apply the targeted math skill${code} to solve problems and explain their reasoning using models, words, or equations.`;
    case "Science":
      return `${g} will learn and apply the targeted science concept${code} by using observations, vocabulary, and simple explanations supported by evidence.`;
    case "Social Studies":
      return `${g} will practice the targeted social studies skill${code} by using key vocabulary and supporting ideas with details from sources.`;
    default:
      return `Students will practice the targeted standard${code} and demonstrate understanding through a brief check for understanding.`;
  }
}

/**
 * Main generator:
 * 1) Try exact map match
 * 2) Try match without trailing letters (e.g., "2.9A" -> "2.9")
 * 3) Otherwise use subject template
 */
export function generateDefaultSkillFocus(inputs: SkillFocusInputs) {
  const standardClean = cleanStandard(inputs.standard); // "4.8B"
  const subject = detectSubject(inputs.subject);

  // 1) Exact mapping
  if (standardClean && TEKS_SKILL_MAP[standardClean]) {
    return TEKS_SKILL_MAP[standardClean];
  }

  // 2) Try stripping trailing letter(s): "4.8B" -> "4.8"
  // Handles cases where you mapped the base but user selected a sub-letter.
  const base = standardClean.replace(/[A-Z]+$/g, "");
  if (base && TEKS_SKILL_MAP[base]) {
    return TEKS_SKILL_MAP[base];
  }

  // 3) Subject template fallback
  return subjectTemplate(subject, inputs.grade, standardClean || inputs.standard);
}
