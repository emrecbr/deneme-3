import { useEffect, useRef, useState } from 'react';

const SNAP_POSITIONS = {
  full: 0,
  mid: 45,
  collapsed: 88
};

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
  const [translate, setTranslate] = useState(SNAP_POSITIONS.collapsed);
  const translateRef = useRef(SNAP_POSITIONS.collapsed);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startTranslateRef = useRef(SNAP_POSITIONS.mid);
  const sheetRef = useRef(null);
  const previousFocusRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setSnap(initialSnap);
      const next = SNAP_POSITIONS[initialSnap] ?? SNAP_POSITIONS.mid;
      translateRef.current = next;
      setTranslate(next);
    } else if (mounted) {
      setSnap('collapsed');
      translateRef.current = SNAP_POSITIONS.collapsed;
      setTranslate(SNAP_POSITIONS.collapsed);
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

  const beginDrag = (event) => {
    const point = 'touches' in event ? event.touches[0] : event;
    startYRef.current = point.clientY;
    startTranslateRef.current = translate;
    draggingRef.current = true;
    setDragging(true);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
  };

  const onDragMove = (event) => {
    if (!draggingRef.current) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    const point = 'touches' in event ? event.touches[0] : event;
    const deltaY = point.clientY - startYRef.current;
    const next = Math.min(100, Math.max(0, startTranslateRef.current + (deltaY / window.innerHeight) * 100));
    translateRef.current = next;
    setTranslate(next);
  };

  const onDragEnd = () => {
    if (!draggingRef.current) {
      return;
    }
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', onDragEnd);
    draggingRef.current = false;
    setDragging(false);
    const candidates = [SNAP_POSITIONS.full, SNAP_POSITIONS.mid, SNAP_POSITIONS.collapsed];
    let nearest = candidates[0];
    const currentTranslate = translateRef.current;
    let minDistance = Math.abs(currentTranslate - candidates[0]);
    candidates.forEach((value) => {
      const dist = Math.abs(currentTranslate - value);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = value;
      }
    });
    if (currentTranslate > 95) {
      onClose?.();
      return;
    }
    const nextSnap =
      nearest === SNAP_POSITIONS.full ? 'full' : nearest === SNAP_POSITIONS.mid ? 'mid' : 'collapsed';
    setSnap(nextSnap);
    translateRef.current = nearest;
    setTranslate(nearest);
  };

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={`sheet-overlay premium-filter-sheet-overlay ${overlayClassName}`}
      onClick={onClose}
      onMouseMove={onDragMove}
      onMouseUp={onDragEnd}
      onMouseLeave={onDragEnd}
    >
      <div
        ref={sheetRef}
        className={`sheet-content premium-filter-sheet rb-sheet ${contentClassName} ${dragging ? 'dragging' : ''}`}
        style={{ transform: `translateX(-50%) translateY(${translate}%)` }}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="rb-sheet-handle"
          onMouseDown={beginDrag}
          onTouchStart={beginDrag}
        />
        <div
          className={`rb-sheet-header ${className}`}
          onMouseDown={beginDrag}
          onTouchStart={beginDrag}
        >
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
