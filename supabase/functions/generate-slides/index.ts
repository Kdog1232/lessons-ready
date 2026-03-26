import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { lessonText } = await req.json();

    if (!lessonText) {
      return new Response(
        JSON.stringify({ error: "Missing lessonText" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const prompt = `
You are generating a HIGH-ENGAGEMENT, CLASSROOM-READY presenter slide deck.

========================================
LESSON INPUT
============

${lessonText}

========================================
INSTRUCTIONS
============

* Maintain TEKS alignment
* Use student-friendly language
* Include engaging but school-appropriate tone
* Keep responses concise and structured

========================================
RIGOR RULES
===========

* Questions must require thinking (not recall)
* Include evidence-based reasoning where appropriate
* Include plausible distractors (based on mistakes)

========================================
SLIDE STRUCTURE (STRICT)
========================

You MUST generate exactly these stages:

1. objective_lock
2. verb_definition
3. model_think_aloud
4. guided_dok_ladder
5. compare_defend
6. independent_transfer
7. exit_ticket

========================================
OUTPUT RULES (CRITICAL)
=======================

* Return ONLY valid JSON
* Do NOT include explanations
* Do NOT include markdown
* Do NOT include text outside JSON
* Do NOT include comments

JSON SCHEMA (STRICT)

{
  "slide_definitions": [
    {
      "stageType": "string",
      "heading": "string",

      "subtext": "string (optional)",
      "content": "string (optional)",
      "items": ["string"],

      "questions": [
        {
          "question": "string",
          "choices": ["string","string","string","string"],
          "correctIndex": 0
        }
      ],

      "prompt": "string (for writing/discussion slides)",
      "engagement": "string (optional)"
    }
  ]
}

========================================
REQUIRED RULES
==============

* guided_dok_ladder MUST include EXACTLY 3 questions
* Each question MUST have:

  * 4 answer choices
  * correctIndex between 0–3
* All stageTypes MUST be present exactly once
* Do NOT skip any stage

========================================
FAIL CONDITIONS (DO NOT DO)
===========================

* Missing fields
* Invalid JSON
* Extra text outside JSON
* Fewer or more than required slides

Return ONLY the JSON object.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: prompt,
        temperature: 0.6,
        max_output_tokens: 900,
      }),
    });

    const data = await response.json();

    let text =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text ||
      "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(text || "{}");
    } catch {
      parsed = {};
    }

    const slideDefinitions = Array.isArray(parsed?.slide_definitions)
      ? parsed.slide_definitions
      : [];

    const REQUIRED_STAGES = [
      "objective_lock",
      "verb_definition",
      "model_think_aloud",
      "guided_dok_ladder",
      "compare_defend",
      "independent_transfer",
      "exit_ticket",
    ];

    const byStage = new Map();
    for (const slide of slideDefinitions) {
      if (slide?.stageType) {
        byStage.set(slide.stageType, slide);
      }
    }

    const normalizedSlides = REQUIRED_STAGES.map((stage) =>
      byStage.get(stage) || {
        stageType: stage,
        heading: stage.replace(/_/g, " ").toUpperCase(),
        content: "Content unavailable",
      });

    if (!normalizedSlides.length) {
      normalizedSlides.push({
        stageType: "objective_lock",
        heading: "Objective",
        subtext: "Lesson objective unavailable",
      });
    }

    return new Response(
      JSON.stringify({ slide_definitions: normalizedSlides }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: corsHeaders },
    );
  }
});
