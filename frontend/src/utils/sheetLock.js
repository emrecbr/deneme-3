const SHEET_LOCK_COUNT_KEY = 'sheetLockCount';
const SHEET_LOCK_KEYS_KEY = 'sheetLockKeys';
const SHEET_PREV_OVERFLOW_KEY = 'sheetPrevOverflow';
const SHEET_PREV_OVERSCROLL_KEY = 'sheetPrevOverscrollBehavior';

function readLockKeys(body) {
  const raw = body.dataset[SHEET_LOCK_KEYS_KEY];
  if (!raw) {
    return [];
  }
  return raw.split(',').filter(Boolean);
}

function writeLockKeys(body, keys) {
  if (keys.length) {
    body.dataset[SHEET_LOCK_KEYS_KEY] = keys.join(',');
  } else {
    delete body.dataset[SHEET_LOCK_KEYS_KEY];
  }
}

export function lockSheetSurface(lockKey) {
  if (typeof document === 'undefined' || !lockKey) {
    return;
  }

  const body = document.body;
  const keys = readLockKeys(body);
  if (keys.includes(lockKey)) {
    return;
  }

  if (!keys.length) {
    body.dataset[SHEET_PREV_OVERFLOW_KEY] = body.style.overflow || '';
    body.dataset[SHEET_PREV_OVERSCROLL_KEY] = body.style.overscrollBehavior || '';
  }

  const nextKeys = [...keys, lockKey];
  writeLockKeys(body, nextKeys);
  body.dataset[SHEET_LOCK_COUNT_KEY] = String(nextKeys.length);
  body.classList.add('sheet-open');
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';
}

export function unlockSheetSurface(lockKey) {
  if (typeof document === 'undefined' || !lockKey) {
    return;
  }

  const body = document.body;
  const nextKeys = readLockKeys(body).filter((key) => key !== lockKey);
  writeLockKeys(body, nextKeys);

  if (nextKeys.length) {
    body.dataset[SHEET_LOCK_COUNT_KEY] = String(nextKeys.length);
    return;
  }

  delete body.dataset[SHEET_LOCK_COUNT_KEY];
  body.classList.remove('sheet-open');
  body.style.overflow = body.dataset[SHEET_PREV_OVERFLOW_KEY] || '';
  body.style.overscrollBehavior = body.dataset[SHEET_PREV_OVERSCROLL_KEY] || '';
  delete body.dataset[SHEET_PREV_OVERFLOW_KEY];
  delete body.dataset[SHEET_PREV_OVERSCROLL_KEY];
}
