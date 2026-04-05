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
    const jsonResponse = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const { lessonText } = await req.json();

    if (!lessonText) {
      return jsonResponse({ error: "Missing lessonText" }, 400);
    }

    const prompt = `
LESSON INPUT

${lessonText}

INSTRUCTIONS

* Maintain TEKS alignment
* Use student-friendly language
* Include engaging but school-appropriate tone
* Keep responses concise and structured

RIGOR RULES

* Questions must require thinking (not recall)
* Include evidence-based reasoning where appropriate
* Include plausible distractors (based on mistakes)

SLIDE STRUCTURE (STRICT)

You MUST generate exactly these stages:

1. objective_lock
2. verb_definition
3. model_think_aloud
4. guided_dok_ladder
5. compare_defend
6. independent_transfer
7. exit_ticket

OUTPUT RULES (CRITICAL)

* Return ONLY valid JSON
* Do NOT include explanations
* Do NOT include markdown
* Do NOT include text outside JSON
* Do NOT include comments

JSON SCHEMA (STRICT)
You are generating a HIGH-ENGAGEMENT, HIGH-RIGOR presenter slide deck.

The goal:
- Maintain TEKS alignment
- Ensure STAAR-level rigor
- Use modern, student-friendly engagement (challenge/game style)
- Stay ORIGINAL (no real brands or copyrighted references)

LESSON INPUT
${lessonText}

ENGAGEMENT STYLE (MANDATORY)

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

CONTEXT / SCENARIO (MANDATORY)

Create a short scenario (100–200 words max):
- engaging and modern
- works across subjects
- includes a problem or challenge

RIGOR RULES

- Questions must require thinking
- Include evidence or reasoning
- Use STAAR-style structure
- Include strong distractors (based on mistakes)

SLIDE STRUCTURE (STRICT)

Use these stageTypes:

- objective_lock  
- verb_definition  
- model_think_aloud  
- guided_dok_ladder  
- compare_defend (preferred)  
- independent_transfer  
- exit_ticket  

ENGAGEMENT INSERTS (MANDATORY)

Include:
- 🗣 Turn & Talk
- ✍️ Quick Write
- 🤝 Partner Discussion

OUTPUT (JSON ONLY)

{
  "slide_definitions": [
    {
REQUIRED RULES

* guided_dok_ladder MUST include EXACTLY 3 questions
* Each question MUST have:

  * 4 answer choices
  * correctIndex between 0–3
* All stageTypes MUST be present exactly once
* Do NOT skip any stage

FAIL CONDITIONS (DO NOT DO)

* Missing fields
* Invalid JSON
* Extra text outside JSON
* Fewer or more than required slides

Return ONLY the JSON object.
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

    return jsonResponse({ slide_definitions: slideDefinitions });
  } catch (error) {
    console.error("UNHANDLED ERROR:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
