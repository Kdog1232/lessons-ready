import React from "react";
import "./SlideRenderer.css";

type SlideQuestion = {
  question: string;
  choices: string[];
  correctIndex: number;
};

type Slide = {
  stageType?: string;
  heading?: string;
  content?: { passage?: string } | string;
  passage?: string;
  subtext?: string;
  prompt?: string;
  items?: string[];
  questions?: SlideQuestion[];
  teacherNotes?: string;
};

export function getSlidePassage(slide: any): string {
  return String(
    slide?.content?.passage || slide?.content || slide?.passage || slide?.subtext || slide?.prompt || "",
  );
}

type SlideRendererProps = {
  slide?: Slide | null;
};

export default function SlideRenderer({ slide }: SlideRendererProps) {
  if (!slide) {
    return (
      <div className="slide-card">
        <h2 className="slide-heading">No slide available</h2>
      </div>
    );
  }

  const passage = getSlidePassage(slide);
  const heading = String(slide.heading || slide.stageType || "Lesson Slide");

  console.log("RENDER SLIDE:", slide);
  console.log("PASSAGE:", passage);

  return (
    <div className="slide-card">
      {slide.stageType && <div className="stage-chip">{slide.stageType.toUpperCase()}</div>}

      <h2 className="slide-heading">{heading}</h2>

      {passage && <p className="slide-text">{passage}</p>}

      {Array.isArray(slide.items) && slide.items.length > 0 && (
        <ul className="slide-list">
          {slide.items.map((item, i) => (
            <li key={`${item}-${i}`}>{item}</li>
          ))}
        </ul>
      )}

      {Array.isArray(slide.questions) && slide.questions.length > 0 && (
        <div className="question-block">
          {slide.questions.map((q, i) => (
            <div key={`${q.question}-${i}`} className="question-card">
              <p className="question-text">{q.question}</p>
              {Array.isArray(q.choices) &&
                q.choices.map((choice, j) => (
                  <div key={`${choice}-${j}`} className="choice">
                    {choice}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {slide.teacherNotes && (
        <div className="teacher-notes">
          <strong>Teacher Notes:</strong>
          <p>{slide.teacherNotes}</p>
        </div>
      )}
    </div>
  );
}
