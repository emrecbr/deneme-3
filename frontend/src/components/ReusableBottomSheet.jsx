import { useEffect, useRef, useState } from 'react';

function ReusableBottomSheet({
  open,
  onClose,
  title,
  headerRight,
  children,
  initialSnap = 'mid',
  className = '',
  contentClassName = '',
  overlayClassName = ''
}) {
  const [mounted, setMounted] = useState(false);
  const [snap, setSnap] = useState(initialSnap);
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const translateRef = useRef(0);
  const snapPointsRef = useRef({ full: 0, half: 0, closed: 0 });
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startTranslateRef = useRef(0);
  const sheetRef = useRef(null);
  const handleRef = useRef(null);
  const previousFocusRef = useRef(null);
  const closeTimerRef = useRef(null);
  const rafRef = useRef(null);
  const snapTimerRef = useRef(null);

  const computeSnapPoints = () => {
    const vh = window.innerHeight || 0;
    const sheetHeight = sheetRef.current?.getBoundingClientRect().height || Math.round(vh * 0.85);
    const halfVisible = Math.min(Math.max(vh * 0.7, 520), 720);
    const full = 16;
    const half = Math.max(sheetHeight - halfVisible, full);
    const closed = Math.max(sheetHeight - 96, half);
    snapPointsRef.current = { full, half, closed };
    return snapPointsRef.current;
  };

  const applyTranslate = (value) => {
    translateRef.current = value;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translate3d(-50%, ${value}px, 0)`;
    }
  };

  const scheduleTranslate = (value) => {
    translateRef.current = value;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translate3d(-50%, ${translateRef.current}px, 0)`;
      }
    });
  };

  const snapTo = (nextSnap, { animate = true } = {}) => {
    const points = snapPointsRef.current;
    const target = points[nextSnap] ?? points.half;
    setSnap(nextSnap);
    setSnapping(Boolean(animate));
    setDragging(false);
    applyTranslate(target);
    if (snapTimerRef.current) {
      window.clearTimeout(snapTimerRef.current);
    }
    if (animate) {
      snapTimerRef.current = window.setTimeout(() => {
        setSnapping(false);
      }, 240);
    } else {
      setSnapping(false);
    }
  };

  useEffect(() => {
    if (open) {
      setMounted(true);
    } else if (mounted) {
      computeSnapPoints();
      snapTo('closed');
      closeTimerRef.current = window.setTimeout(() => {
        setMounted(false);
      }, 360);
    }

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, [open, initialSnap, mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (open) {
      previousFocusRef.current = document.activeElement;
      sheetRef.current?.focus();
      document.body.classList.add('sheet-open');
    }
    return () => {
      document.body.classList.remove('sheet-open');
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    const points = computeSnapPoints();
    const nextSnap = points[initialSnap] != null ? initialSnap : 'half';
    snapTo(nextSnap, { animate: false });
  }, [mounted, initialSnap]);

  useEffect(() => {
    if (!mounted) {
      return undefined;
    }
    const onResize = () => {
      computeSnapPoints();
      snapTo(snap, { animate: false });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mounted, snap]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (snapTimerRef.current) {
        window.clearTimeout(snapTimerRef.current);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  const onPointerMove = (event) => {
    if (!draggingRef.current) {
      return;
    }
    if (import.meta.env?.DEV) {
      console.log('[sheet] move', { y: event.clientY });
    }
    const currentY = event.clientY;
    const deltaY = currentY - startYRef.current;
    const points = snapPointsRef.current;
    const minY = points.full;
    const maxY = points.closed;
    let next = startTranslateRef.current + deltaY;
    next = Math.min(maxY, Math.max(minY, next));
    scheduleTranslate(next);
  };

  const onPointerUp = (event) => {
    if (!draggingRef.current) {
      return;
    }
    if (import.meta.env?.DEV) {
      console.log('[sheet] up');
    }
    draggingRef.current = false;
    setDragging(false);
    document.body.classList.remove('rb-dragging');
    if (handleRef.current && event?.pointerId != null) {
      handleRef.current.releasePointerCapture?.(event.pointerId);
    }
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    }
    const points = snapPointsRef.current;
    const currentTranslate = translateRef.current;
    const candidates = [
      { key: 'full', value: points.full },
      { key: 'half', value: points.half },
      { key: 'closed', value: points.closed }
    ];
    let nearest = candidates[0];
    let minDistance = Math.abs(currentTranslate - candidates[0].value);
    candidates.forEach((candidate) => {
      const dist = Math.abs(currentTranslate - candidate.value);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = candidate;
      }
    });
    if (nearest.key === 'closed') {
      snapTo('closed');
      onClose?.();
      return;
    }
    snapTo(nearest.key);
  };

  const onHandlePointerDown = (event) => {
    if (!handleRef.current) {
      return;
    }
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (import.meta.env?.DEV) {
      console.log('[sheet] handle down', { y: event.clientY, pointerId: event.pointerId });
    }
    handleRef.current.setPointerCapture?.(event.pointerId);
    draggingRef.current = true;
    setDragging(true);
    setSnapping(false);
    document.body.classList.add('rb-dragging');
    startYRef.current = event.clientY;
    startTranslateRef.current = translateRef.current;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
  };

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={`sheet-overlay premium-filter-sheet-overlay ${overlayClassName}`}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className={`sheet-content premium-filter-sheet rb-sheet ${contentClassName} ${dragging ? 'rb-sheet--dragging' : ''} ${snapping ? 'rb-sheet--snapping' : ''}`}
        style={{ transform: `translate3d(-50%, ${translateRef.current}px, 0)` }}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          ref={handleRef}
          className={`rb-sheet-handle-wrap ${dragging ? 'is-dragging' : ''}`}
          onPointerDown={onHandlePointerDown}
          role="button"
          aria-label="Sheet sürükleme çentiği"
        >
          <div className="rb-sheet-handle" />
        </div>
        <div className={`rb-sheet-header ${className}`}>
          <strong>{title}</strong>
          {headerRight}
        </div>
        <div className={`rb-sheet-body ${snap === 'collapsed' ? 'collapsed' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default ReusableBottomSheet;
