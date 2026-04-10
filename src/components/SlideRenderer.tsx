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
  sequenceIndex?: number;
  totalSlides?: number;
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
  const heading = String(slide.heading || "").trim();
  const stageType = String(slide.stageType || "generic");
  const isInteractive = ["mc_interactive", "discussion", "short_response", "matching", "vocab_cards"].includes(stageType);
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

  const transitionText = slide.prompt || passage || heading;
  let stageBody: React.ReactNode = null;

  switch (stageType) {
    case "mc_interactive":
      if (!Array.isArray(slide.questions) || !slide.questions.length) {
        stageBody = null;
        break;
      }
      {
        const q = slide.questions[0];
        const id = q.id || "q_0";
        const selected = selectedAnswers[id];
        const isCorrect = selected === q.correctIndex;
        const showFeedback = Number.isInteger(selected);
        stageBody = (
          <div className="question-block">
            <div className="question-card reveal-pop">
              <h1 className="question-text">{q.question}</h1>
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
                      onClick={() => selectChoice(q, 0, j)}
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
          </div>
        );
      }
      break;
    case "matching":
      stageBody = Array.isArray(slide.left) && Array.isArray(slide.right) ? (
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
      ) : null;
      break;
    case "vocab_cards":
      stageBody = Array.isArray(slide.words) && slide.words.length > 0 ? (
        <div className="vocab-grid">
          {slide.words.map((word, i) => (
            <article key={`${word.term}-${i}`} className="vocab-tile reveal-pop" style={{ animationDelay: `${i * 80}ms` }}>
              <h3>{word.term}</h3>
              <p>{word.definition}</p>
            </article>
          ))}
        </div>
      ) : null;
      break;
    case "discussion":
      stageBody = slide.prompt ? <div className="action-callout">Partner A shares first. Partner B cites evidence.</div> : null;
      break;
    case "short_response":
      stageBody = <div className="action-callout">Write 2-3 sentences. Include one direct piece of evidence.</div>;
      break;
    case "transition":
      stageBody = null;
      break;
    default:
      stageBody = passage ? <p className="slide-text">{passage}</p> : null;
      break;
  }

  return (
    <div className={`slide-card stage-${stageType} ${stageType === "transition" ? "slide-card--transition" : ""}`}>
      <div className="slide-meta-row">
        {progressText && <div className="progress-chip">{progressText}</div>}
      </div>

      {(stageType === "discussion" || stageType === "short_response") && <h2 className="slide-heading">{slide.prompt || heading}</h2>}
      {stageType === "transition" && <h2 className="slide-heading transition-heading">{transitionText || "Next"}</h2>}
      {stageType !== "mc_interactive" && stageType !== "discussion" && stageType !== "short_response" && stageType !== "transition" && heading && (
        <h2 className="slide-heading">{heading}</h2>
      )}
      {stageType !== "mc_interactive" && stageType !== "discussion" && stageType !== "short_response" && stageType !== "transition" && stageBody}
      {stageType === "mc_interactive" && stageBody}
      {stageType === "discussion" && stageBody}
      {stageType === "short_response" && stageBody}

      {isInteractive && (
        <div className="control-row">
          <button type="button" onClick={() => setRevealed((v) => !v)}>{revealed ? "Hide Answer" : "Reveal Answer"}</button>
          <button type="button" onClick={() => setLocked((v) => !v)}>{locked ? "Unlock Responses" : "Lock Responses"}</button>
          <button type="button" onClick={() => setTimerSeconds((s) => s + 60)}>+1:00 Timer</button>
          <button type="button">Next Slide →</button>
          <span className="timer-badge">Timer: {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, "0")}</span>
        </div>
      )}
    </div>
  );
}
