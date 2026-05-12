import { useCallback, useEffect, useRef, useState } from 'react';
import useBottomSheetDrag from '../hooks/useBottomSheetDrag';
import { lockSheetSurface, unlockSheetSurface } from '../utils/sheetLock';

function ReusableBottomSheet({
  open,
  onClose,
  title,
  headerRight,
  children,
  initialSnap = 'mid',
  className = '',
  contentClassName = '',
  overlayClassName = '',
  enableBodyDrag = false
}) {
  const [mounted, setMounted] = useState(false);
  const [snap, setSnap] = useState(initialSnap);
  const [snapping, setSnapping] = useState(false);
  const translateRef = useRef(0);
  const snapPointsRef = useRef({ full: 0, half: 0, closed: 0 });
  const sheetRef = useRef(null);
  const previousFocusRef = useRef(null);
  const closeTimerRef = useRef(null);
  const snapTimerRef = useRef(null);
  const lockKeyRef = useRef(`rb-sheet-${Math.random().toString(36).slice(2)}`);

  const computeSnapPoints = useCallback(() => {
    const vh = window.innerHeight || 0;
    const sheetHeight = sheetRef.current?.getBoundingClientRect().height || Math.round(vh * 0.85);
    const halfVisible = Math.min(Math.max(vh * 0.7, 520), 720);
    const full = 16;
    const half = Math.max(sheetHeight - halfVisible, full);
    const closed = Math.max(sheetHeight - 96, half);
    snapPointsRef.current = { full, half, closed };
    return snapPointsRef.current;
  }, []);

  const applyTranslate = useCallback((value) => {
    translateRef.current = value;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translate3d(-50%, ${value}px, 0)`;
    }
  }, []);

  const snapTo = useCallback((nextSnap, { animate = true } = {}) => {
    const points = snapPointsRef.current;
    const target = points[nextSnap] ?? points.half;
    setSnap(nextSnap);
    setSnapping(Boolean(animate));
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
  }, [applyTranslate]);

  const { dragging, onSurfacePointerDown, resetDragState } = useBottomSheetDrag({
    sheetRef,
    getSnapPoints: computeSnapPoints,
    getCurrentTranslate: () => translateRef.current,
    onTranslate: applyTranslate,
    getSnapCandidates: (points) => [
      { key: 'full', value: points.full },
      { key: 'half', value: points.half },
      { key: 'closed', value: points.closed }
    ],
    onDragStart: () => {
      setSnapping(false);
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'none';
      }
    },
    onResolveSnap: ({ nearestKey }) => {
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      }
      if (nearestKey === 'closed') {
        snapTo('closed');
        onClose?.();
        return;
      }
      snapTo(nearestKey);
    }
  });

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
  }, [computeSnapPoints, mounted, open, snapTo]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (open) {
      previousFocusRef.current = document.activeElement;
      sheetRef.current?.focus();
      lockSheetSurface(lockKeyRef.current);
    }
    return () => {
      unlockSheetSurface(lockKeyRef.current);
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
  }, [computeSnapPoints, initialSnap, mounted, snapTo]);

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
  }, [computeSnapPoints, mounted, snap, snapTo]);

  useEffect(() => () => {
    if (snapTimerRef.current) {
      window.clearTimeout(snapTimerRef.current);
    }
    resetDragState();
  }, [resetDragState]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={`sheet-overlay premium-filter-sheet-overlay ${open ? 'sheet-overlay--open' : 'sheet-overlay--closing'} ${overlayClassName}`}
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
          className={`rb-sheet-handle-wrap ${dragging ? 'is-dragging' : ''}`}
          onPointerDown={onSurfacePointerDown}
          data-rb-drag-surface="handle"
          role="button"
          aria-label="Sheet sürükleme çentiği"
        >
          <div className="rb-sheet-handle" />
        </div>
        <div
          className={`rb-sheet-header ${className}`}
          data-rb-drag-surface="header"
          onPointerDown={onSurfacePointerDown}
        >
          <strong>{title}</strong>
          {headerRight}
        </div>
        <div
          className={`rb-sheet-body ${snap === 'collapsed' ? 'collapsed' : ''}`}
          data-rb-scroll-lock="true"
          {...(enableBodyDrag ? { 'data-rb-drag-surface': 'body', onPointerDown: onSurfacePointerDown } : {})}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default ReusableBottomSheet;
