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
You are generating a HIGH-ENGAGEMENT, HIGH-RIGOR presenter slide deck.

The goal:
- Maintain TEKS alignment
- Ensure STAAR-level rigor
- Use modern, student-friendly engagement (challenge/game style)
- Stay ORIGINAL (no real brands or copyrighted references)

========================================
LESSON INPUT
========================================
${lessonText}

========================================
ENGAGEMENT STYLE (MANDATORY)
========================================

Make the lesson feel like:
- a challenge
- a mission
- a level or scenario
- a creator-style explanation

Use:
- exciting hooks
- student-friendly tone
- modern language (school appropriate)

DO NOT:
- reference real brands (Fortnite, MrBeast, etc.)
- copy real content

========================================
CONTEXT / SCENARIO (MANDATORY)
========================================

Create a short scenario (100–200 words max):
- engaging and modern
- works across subjects
- includes a problem or challenge

========================================
RIGOR RULES
========================================

- Questions must require thinking
- Include evidence or reasoning
- Use STAAR-style structure
- Include strong distractors (based on mistakes)

========================================
SLIDE STRUCTURE (STRICT)
========================================

Use these stageTypes:

- objective_lock  
- verb_definition  
- model_think_aloud  
- guided_dok_ladder  
- compare_defend (preferred)  
- independent_transfer  
- exit_ticket  

========================================
ENGAGEMENT INSERTS (MANDATORY)
========================================

Include:
- 🗣 Turn & Talk
- ✍️ Quick Write
- 🤝 Partner Discussion

========================================
OUTPUT (JSON ONLY)
========================================

{
  "slide_definitions": [
    {
      "stageType": "objective_lock",
      "heading": "Objective",
      "subtext": "I can..."
    },
    {
      "stageType": "verb_definition",
      "heading": "Key Skill",
      "content": "Clear academic explanation"
    },
    {
      "stageType": "model_think_aloud",
      "heading": "Model",
      "content": "Teacher models thinking step-by-step"
    },
    {
      "stageType": "guided_dok_ladder",
      "heading": "Guided Practice",
      "questions": [
        {
          "question": "Tier 1",
          "choices": ["A", "B", "C", "D"],
          "correctIndex": 0
        },
        {
          "question": "Tier 2",
          "choices": ["A", "B", "C", "D"],
          "correctIndex": 1
        },
        {
          "question": "Tier 3",
          "choices": ["A", "B", "C", "D"],
          "correctIndex": 2
        }
      ],
      "engagement": "🗣 Turn & Talk"
    },
    {
      "stageType": "compare_defend",
      "heading": "Compare & Defend",
      "prompt": "Which answer is stronger and why?",
      "engagement": "🤝 Partner Discussion"
    },
    {
      "stageType": "independent_transfer",
      "heading": "Independent Practice",
      "prompt": "Apply the skill independently",
      "engagement": "✍️ Quick Write"
    },
    {
      "stageType": "exit_ticket",
      "heading": "Exit Ticket",
      "question": "Rigorous final question",
      "choices": ["A", "B", "C", "D"],
      "correctIndex": 0
    }
  ]
}
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

    return new Response(
      JSON.stringify({ slide_definitions: slideDefinitions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: corsHeaders },
    );
  }
});
