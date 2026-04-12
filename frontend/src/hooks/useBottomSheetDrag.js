import { useCallback, useEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD_PX = 12;
const HORIZONTAL_LOCK_RATIO = 1.15;
const VELOCITY_SNAP_THRESHOLD = 0.45;
const BLOCKED_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  'option',
  'button',
  'a[href]',
  '[role="button"]',
  '[role="link"]',
  '[contenteditable="true"]',
  '[data-rb-no-drag]',
  '[data-rb-horizontal-gesture]',
  '[data-rb-map-interactive]',
  '.leaflet-container',
  '.recommendation-track'
].join(',');

function isElement(node) {
  return Boolean(node && node.nodeType === Node.ELEMENT_NODE);
}

function isScrollableElement(element) {
  if (!isElement(element)) {
    return false;
  }
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const allowsScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
  return allowsScroll && element.scrollHeight - element.clientHeight > 4;
}

function findScrollableAncestor(startNode, boundaryNode) {
  let current = isElement(startNode) ? startNode : null;
  while (current && current !== boundaryNode) {
    if (current.hasAttribute('data-rb-scroll-lock') || isScrollableElement(current)) {
      return current;
    }
    current = current.parentElement;
  }

  if (boundaryNode && (boundaryNode.hasAttribute?.('data-rb-scroll-lock') || isScrollableElement(boundaryNode))) {
    return boundaryNode;
  }

  return null;
}

function hasBlockedTarget(target, sheetNode) {
  if (!isElement(target) || !sheetNode) {
    return false;
  }
  const blocked = target.closest(BLOCKED_TARGET_SELECTOR);
  return Boolean(blocked && sheetNode.contains(blocked));
}

export default function useBottomSheetDrag({
  sheetRef,
  getSnapPoints,
  getCurrentTranslate,
  onTranslate,
  getSnapCandidates,
  onDragStart,
  onResolveSnap,
  draggingBodyClass = 'rb-dragging'
}) {
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef({
    pointerId: null,
    captureTarget: null,
    startX: 0,
    startY: 0,
    startTranslate: 0,
    active: false,
    scrollableAncestor: null,
    lastY: 0,
    lastTime: 0,
    velocityY: 0
  });
  const rafRef = useRef(null);
  const latestRef = useRef({
    getSnapPoints,
    getCurrentTranslate,
    onTranslate,
    getSnapCandidates,
    onDragStart,
    onResolveSnap,
    draggingBodyClass
  });

  latestRef.current = {
    getSnapPoints,
    getCurrentTranslate,
    onTranslate,
    getSnapCandidates,
    onDragStart,
    onResolveSnap,
    draggingBodyClass
  };

  const cleanupPointerListeners = useCallback(() => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
  }, []);

  const resetDragState = useCallback(() => {
    const { captureTarget, pointerId, active } = dragStateRef.current;
    cleanupPointerListeners();
    if (captureTarget && pointerId != null) {
      captureTarget.releasePointerCapture?.(pointerId);
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (active) {
      document.body.classList.remove(latestRef.current.draggingBodyClass);
    }
    dragStateRef.current = {
      pointerId: null,
      captureTarget: null,
      startX: 0,
      startY: 0,
      startTranslate: 0,
      active: false,
      scrollableAncestor: null,
      lastY: 0,
      lastTime: 0,
      velocityY: 0
    };
    setDragging(false);
  }, [cleanupPointerListeners]);

  const handlePointerMove = useCallback((event) => {
    const dragState = dragStateRef.current;
    if (dragState.pointerId == null || (event.pointerId != null && event.pointerId !== dragState.pointerId)) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const now = typeof event.timeStamp === 'number' ? event.timeStamp : Date.now();

    if (!dragState.active) {
      if (absX < DRAG_THRESHOLD_PX && absY < DRAG_THRESHOLD_PX) {
        return;
      }
      if (absX > absY * HORIZONTAL_LOCK_RATIO) {
        resetDragState();
        return;
      }
      if (dragState.scrollableAncestor && deltaY < 0) {
        resetDragState();
        return;
      }
      if (absY < DRAG_THRESHOLD_PX) {
        return;
      }
      dragStateRef.current.active = true;
      dragStateRef.current.lastY = event.clientY;
      dragStateRef.current.lastTime = now;
      dragStateRef.current.velocityY = 0;
      setDragging(true);
      document.body.classList.add(latestRef.current.draggingBodyClass);
      latestRef.current.onDragStart?.(event);
    } else {
      const deltaTime = Math.max(now - dragState.lastTime, 1);
      dragStateRef.current.velocityY = (event.clientY - dragState.lastY) / deltaTime;
      dragStateRef.current.lastY = event.clientY;
      dragStateRef.current.lastTime = now;
    }

    event.preventDefault();
    const points = latestRef.current.getSnapPoints();
    const candidates = latestRef.current.getSnapCandidates(points);
    const values = candidates.map((candidate) => candidate.value);
    const minY = Math.min(...values);
    const maxY = Math.max(...values);
    const next = Math.min(maxY, Math.max(minY, dragState.startTranslate + deltaY));

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      latestRef.current.onTranslate(next);
    });
  }, [resetDragState]);

  const handlePointerUp = useCallback((event) => {
    const dragState = dragStateRef.current;
    if (dragState.pointerId == null || (event.pointerId != null && event.pointerId !== dragState.pointerId)) {
      return;
    }

    const wasActive = dragState.active;
    const velocityY = dragState.velocityY;
    resetDragState();

    if (!wasActive) {
      return;
    }

    const points = latestRef.current.getSnapPoints();
    const currentTranslate = latestRef.current.getCurrentTranslate();
    const candidates = latestRef.current.getSnapCandidates(points);

    let nearest = candidates[0];
    let minDistance = Math.abs(currentTranslate - candidates[0].value);

    candidates.forEach((candidate) => {
      const distance = Math.abs(currentTranslate - candidate.value);
      if (distance < minDistance) {
        nearest = candidate;
        minDistance = distance;
      }
    });

    if (Math.abs(velocityY) >= VELOCITY_SNAP_THRESHOLD) {
      const ordered = [...candidates].sort((a, b) => a.value - b.value);
      const currentIndex = ordered.findIndex((candidate) => candidate.key === nearest.key);
      if (velocityY > 0) {
        nearest = ordered[Math.min(currentIndex + 1, ordered.length - 1)] || nearest;
      } else if (velocityY < 0) {
        nearest = ordered[Math.max(currentIndex - 1, 0)] || nearest;
      }
    }

    latestRef.current.onResolveSnap({
      event,
      nearestKey: nearest.key,
      nearestValue: nearest.value,
      currentTranslate,
      points
    });
  }, [resetDragState]);

  const shouldStartDrag = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) {
      return false;
    }

    const sheetNode = sheetRef.current;
    const target = event.target;
    const surface = event.currentTarget;

    if (!sheetNode || !isElement(target) || !isElement(surface) || !sheetNode.contains(target)) {
      return false;
    }

    const closestSurface = target.closest('[data-rb-drag-surface]');
    if (closestSurface && closestSurface !== surface) {
      return false;
    }

    if (hasBlockedTarget(target, sheetNode)) {
      return false;
    }

    const scrollableAncestor = findScrollableAncestor(target, surface);
    if (scrollableAncestor && scrollableAncestor.scrollTop > 0) {
      return false;
    }

    return true;
  }, [sheetRef]);

  const onSurfacePointerDown = useCallback((event) => {
    if (!shouldStartDrag(event)) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId ?? null,
      captureTarget: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      startTranslate: latestRef.current.getCurrentTranslate(),
      active: false,
      scrollableAncestor: findScrollableAncestor(event.target, event.currentTarget),
      lastY: event.clientY,
      lastTime: typeof event.timeStamp === 'number' ? event.timeStamp : Date.now(),
      velocityY: 0
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });
  }, [handlePointerMove, handlePointerUp, shouldStartDrag]);

  useEffect(() => () => {
    resetDragState();
  }, [resetDragState]);

  return {
    dragging,
    onSurfacePointerDown,
    resetDragState
  };
}
