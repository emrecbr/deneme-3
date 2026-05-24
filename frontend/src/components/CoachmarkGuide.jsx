import { useEffect, useLayoutEffect, useState } from 'react';

function CoachmarkGuide({ open, steps, activeIndex, onSkip }) {
  const [position, setPosition] = useState(null);
  const step = steps?.[activeIndex] || null;

  useLayoutEffect(() => {
    if (!open || !step?.target) {
      setPosition(null);
      return undefined;
    }

    let frame = 0;
    const updatePosition = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const target = document.querySelector(step.target);
        if (!target) {
          setPosition(null);
          return;
        }

        const rect = target.getBoundingClientRect();
        const cardWidth = Math.min(320, window.innerWidth - 32);
        const centerX = rect.left + rect.width / 2;
        const left = Math.min(Math.max(16, centerX - cardWidth / 2), window.innerWidth - cardWidth - 16);
        const belowTop = rect.bottom + 14;
        const aboveTop = rect.top - 178;
        const top = belowTop + 170 < window.innerHeight ? belowTop : Math.max(16, aboveTop);

        setPosition({
          left,
          top,
          width: cardWidth
        });
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('focusin', updatePosition);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('focusin', updatePosition);
    };
  }, [open, step?.target]);

  useEffect(() => {
    if (!open || !step?.target) {
      return undefined;
    }

    const target = document.querySelector(step.target);
    if (!target) {
      return undefined;
    }

    target.classList.add('coachmark-active-target');
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    return () => {
      target.classList.remove('coachmark-active-target');
    };
  }, [open, step?.target]);

  if (!open || !step || !position) {
    return null;
  }

  return (
    <div className="coachmark-layer" aria-live="polite">
      <div className="coachmark-scrim" />
      <section
        className="coachmark-card"
        style={{ left: position.left, top: position.top, width: position.width }}
        aria-label={step.title}
      >
        <div className="coachmark-progress">
          <span>
            {activeIndex + 1}/{steps.length}
          </span>
        </div>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        <div className="coachmark-actions">
          <button type="button" className="coachmark-skip" onClick={onSkip}>
            Geç
          </button>
        </div>
      </section>
    </div>
  );
}

export default CoachmarkGuide;
