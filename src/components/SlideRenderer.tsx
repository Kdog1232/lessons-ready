import React, { useEffect, useMemo, useState } from "react";
import "./SlideRenderer.css";

type SlideQuestion = {
  id?: string;
  question: string;
  choices: string[];
  correctIndex: number;
  hint?: string;
  reinforce?: string;
};

type VocabWord = {
  term: string;
  definition: string;
};

type Slide = {
  stageType?: string;
  heading?: string;
  content?: { passage?: string } | string;
  passage?: string;
  subtext?: string;
  prompt?: string;
  questions?: SlideQuestion[];
  words?: VocabWord[];
  left?: string[];
  right?: string[];
  slideGroup?: string;
  teacherMoment?: string;
  teacherNotes?: string;
  sequenceIndex?: number;
  totalSlides?: number;
  phaseLabel?: string;
  momentumStep?: "think" | "apply" | "defend" | string;
};

export function getSlidePassage(slide: any): string {
  return String(
    slide?.content?.passage || slide?.content || slide?.passage || slide?.subtext || slide?.prompt || "",
  );
}

type SlideRendererProps = {
  slide?: Slide | null;
};

function stageLabel(stageType?: string): string {
  const type = String(stageType || "");
  if (type === "hook_wow") return "Wow Hook";
  if (type === "objective") return "Objective";
  if (type === "model") return "I Do";
  if (type === "mc_interactive") return "Guided Practice";
  if (type === "discussion") return "Discussion";
  if (type === "short_response") return "Quick Write";
  if (type === "matching") return "Matching";
  if (type === "vocab_cards") return "Vocabulary";
  if (type === "transition") return "Bridge";
  return type.toUpperCase() || "SLIDE";
}

function groupLabel(group?: string): string {
  const value = String(group || "");
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
}

export default function SlideRenderer({ slide }: SlideRendererProps) {
  const [revealed, setRevealed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    setLoading(true);
    setSelectedAnswers({});
    const timer = setTimeout(() => setLoading(false), 220);
    return () => clearTimeout(timer);
  }, [slide?.sequenceIndex, slide?.heading]);

  if (!slide) {
    return (
      <div className="slide-card">
        <h2 className="slide-heading">No slide available</h2>
      </div>
    );
  }

  const passage = getSlidePassage(slide);
  const heading = String(slide.heading || slide.stageType || "Lesson Slide");
  const stageType = String(slide.stageType || "generic");
  const isInteractive = ["mc_interactive", "discussion", "short_response", "matching"].includes(stageType);
  const progressText = useMemo(() => {
    if (!slide.totalSlides || !slide.sequenceIndex) return "";
    return `Slide ${slide.sequenceIndex} of ${slide.totalSlides}`;
  }, [slide.sequenceIndex, slide.totalSlides]);

  const selectChoice = (q: SlideQuestion, questionIndex: number, choiceIndex: number) => {
    if (locked) return;
    const id = q.id || `q_${questionIndex}`;
    setSelectedAnswers((prev) => ({ ...prev, [id]: choiceIndex }));
  };

  if (loading) {
    return (
      <div className={`slide-card stage-${stageType} slide-loading`}>
        <div className="skeleton skeleton-chip" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
      </div>
    );
  }

  return (
    <div className={`slide-card stage-${stageType}`}>
      <div className="slide-meta-row">
        {slide.stageType && <div className="stage-chip">{stageLabel(slide.stageType)}</div>}
        {slide.phaseLabel && <div className="phase-chip">{slide.phaseLabel}</div>}
        {slide.slideGroup && <div className="group-chip">{groupLabel(slide.slideGroup)}</div>}
        {slide.momentumStep && <div className="phase-chip">{slide.momentumStep.toUpperCase()}</div>}
        {progressText && <div className="progress-chip">{progressText}</div>}
      </div>

      <h2 className="slide-heading">{heading}</h2>

      {passage && <p className="slide-text">{passage}</p>}

      {stageType === "transition" && <div className="narrative-bridge">Now, act on the previous idea before moving on.</div>}

      {stageType === "vocab_cards" && Array.isArray(slide.words) && slide.words.length > 0 && (
        <div className="vocab-grid">
          {slide.words.map((word, i) => (
            <article key={`${word.term}-${i}`} className="vocab-tile reveal-pop" style={{ animationDelay: `${i * 80}ms` }}>
              <h3>{word.term}</h3>
              <p>{word.definition}</p>
            </article>
          ))}
        </div>
      )}

      {stageType === "matching" && Array.isArray(slide.left) && Array.isArray(slide.right) && (
        <div className="matching-grid">
          <div>
            <h3 className="section-title">Terms</h3>
            {slide.left.map((item, i) => (
              <button key={`${item}-${i}`} className="matching-card reveal-pop" style={{ animationDelay: `${i * 70}ms` }} type="button" disabled={locked}>
                {item}
              </button>
            ))}
          </div>
          <div>
            <h3 className="section-title">Meanings</h3>
            {slide.right.map((item, i) => (
              <button key={`${item}-${i}`} className="matching-card matching-card--answer reveal-pop" style={{ animationDelay: `${i * 70}ms` }} type="button" disabled={locked}>
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(slide.questions) && slide.questions.length > 0 && (
        <div className="question-block">
          {slide.questions.map((q, i) => {
            const id = q.id || `q_${i}`;
            const selected = selectedAnswers[id];
            const isCorrect = selected === q.correctIndex;
            const showFeedback = Number.isInteger(selected);
            return (
              <div key={`${q.question}-${i}`} className="question-card reveal-pop" style={{ animationDelay: `${i * 100}ms` }}>
                <p className="question-text">{q.question}</p>
                {Array.isArray(q.choices) &&
                  q.choices.map((choice, j) => {
                    const correct = revealed && q.correctIndex === j;
                    const chosen = selected === j;
                    return (
                      <button
                        key={`${choice}-${j}`}
                        className={`choice-card ${correct ? "choice-card--correct" : ""} ${chosen ? "choice-card--selected" : ""}`}
                        style={{ animationDelay: `${j * 80}ms` }}
                        type="button"
                        disabled={locked}
                        onClick={() => selectChoice(q, i, j)}
                      >
                        <span className="choice-letter">{String.fromCharCode(65 + j)}</span>
                        <span>{choice}</span>
                      </button>
                    );
                  })}

                {showFeedback && (
                  <div className={`feedback-box ${isCorrect ? "feedback-box--good" : "feedback-box--hint"}`}>
                    {isCorrect ? q.reinforce || "Correct—defend your evidence." : q.hint || "Try again. Re-read the strongest clue."}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {stageType === "discussion" && slide.prompt && <div className="action-callout">Partner A shares first. Partner B must cite evidence.</div>}
      {stageType === "short_response" && (
        <div className="action-callout">Write 2-3 sentences. Include one direct piece of evidence.</div>
      )}

      {isInteractive && (
        <div className="control-row">
          <button type="button" onClick={() => setRevealed((v) => !v)}>{revealed ? "Hide Answer" : "Reveal Answer"}</button>
          <button type="button" onClick={() => setLocked((v) => !v)}>{locked ? "Unlock Responses" : "Lock Responses"}</button>
          <button type="button" onClick={() => setTimerSeconds((s) => s + 60)}>+1:00 Timer</button>
          <button type="button">Next Slide →</button>
          <span className="timer-badge">Timer: {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, "0")}</span>
        </div>
      )}

      {slide.teacherMoment && (
        <div className="teacher-moment">
          <strong>Teacher Moment:</strong> {slide.teacherMoment}
        </div>
      )}

      {!isInteractive && slide.teacherNotes && (
        <div className="teacher-notes">
          <strong>Teacher Notes:</strong>
          <p>{slide.teacherNotes}</p>
        </div>
      )}
    </div>
  );
}
