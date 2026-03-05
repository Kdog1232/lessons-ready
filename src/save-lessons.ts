type LessonPayload = {
  lessonText: string;
  lessonMode: "bluebonnet" | "amplify" | "generic";
  slideDefinitions: unknown[];
  standardLabel?: string;
};

type CanonicalStandardRow = {
  canonical_skill: string;
  cognitive_verb: string | null;
  dok_target: string | null;
  grade: number | string | null;
  staar_priority?: string | null;
  skill_display_name?: string | null;
};

type SupabaseSingleResult<T> = Promise<{ data: T | null; error?: { message?: string } | null }>;

type SupabaseQueryBuilder<T> = {
  eq: (column: string, value: string) => {
    single: () => SupabaseSingleResult<T>;
  };
};

type SupabaseFromBuilder<T> = {
  select: (columns: string) => SupabaseQueryBuilder<T>;
};

type SupabaseClientLike = {
  from: (table: string) => SupabaseFromBuilder<CanonicalStandardRow>;
};

function normalizeStandardLabel(standard: string): string {
  return String(standard || "").trim().toUpperCase();
}

async function resolveCanonicalStandard(
  supabase: SupabaseClientLike,
  standard: string,
): Promise<CanonicalStandardRow> {
  const normalizedStandard = normalizeStandardLabel(standard);
  if (!normalizedStandard) {
    throw new Error("Canonical mapping not found for (missing standard).");
  }

  const { data: standardMeta, error } = await supabase
    .from("standards_canonical")
    .select("canonical_skill, cognitive_verb, dok_target, staar_priority, skill_display_name")
    .eq("standard_label", normalizedStandard)
    .single();

  if (error || !standardMeta?.canonical_skill) {
    throw new Error(`Canonical mapping not found for ${normalizedStandard}`);
  }

  return standardMeta;
}

function assertCanonicalMapping(
  payload: LessonPayload,
  canonical: CanonicalStandardRow | null | undefined,
): asserts canonical is CanonicalStandardRow {
  if (!canonical?.canonical_skill) {
    const standard = payload.standardLabel || "(missing standard label)";
    throw new Error(`Canonical mapping not found for ${standard}. Refusing to save lesson without canonical metadata.`);
  }
}

function buildLessonInsert(payload: LessonPayload, canonical: CanonicalStandardRow | null | undefined) {
  assertCanonicalMapping(payload, canonical);

  return {
    standard_label: payload.standardLabel || null,
    lesson_text: payload.lessonText,
    lesson_mode: payload.lessonMode,
    slide_definitions: payload.slideDefinitions,
    canonical_skill: canonical.canonical_skill,
    cognitive_verb: canonical.cognitive_verb || null,
    dok_target: canonical.dok_target || null,
    grade: canonical.grade ?? null,
  };
}

export { buildLessonInsert, normalizeStandardLabel, resolveCanonicalStandard };
