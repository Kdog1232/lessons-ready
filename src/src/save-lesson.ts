type LessonPayload = {
  lessonText: string;
  lessonMode: "bluebonnet" | "amplify" | "generic";
  slideDefinitions: unknown[];
  skillFocus?: string;
  _verb?: string;
  _dokTarget?: string;
};

function buildLessonInsert(payload: LessonPayload) {
  return {
    lesson_text: payload.lessonText,
    lesson_mode: payload.lessonMode,
    slide_definitions: payload.slideDefinitions,
    canonical_skill: payload.skillFocus || null,
    cognitive_verb: payload._verb || null,
    dok_target: payload._dokTarget || null,
  };
}

export { buildLessonInsert };
