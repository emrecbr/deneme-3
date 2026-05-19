import { Router } from 'express';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';

const router = Router();
const MAX_EVENTS_PER_BATCH = 50;
const MAX_PAYLOAD_CHARS = 6000;
const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_.:-]{1,80}$/i;

const safeString = (value, max = 160) => String(value || '').trim().slice(0, max);

const sanitizePayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  try {
    const json = JSON.stringify(payload);
    if (json.length > MAX_PAYLOAD_CHARS) {
      return { truncated: true };
    }
    return JSON.parse(json);
  } catch (_error) {
    return {};
  }
};

router.post('/events', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const rawEvents = Array.isArray(req.body?.events)
      ? req.body.events
      : req.body?.name
        ? [req.body]
        : [];

    const events = rawEvents
      .slice(0, MAX_EVENTS_PER_BATCH)
      .map((event) => {
        const name = safeString(event?.name || event?.eventName, 96);
        if (!EVENT_NAME_PATTERN.test(name)) {
          return null;
        }

        const occurredAt = event?.timestamp || event?.occurredAt;
        const parsedOccurredAt = occurredAt ? new Date(occurredAt) : new Date();

        return {
          name,
          user: req.user?.id || undefined,
          anonymousId: safeString(event?.anonymousId, 128) || undefined,
          source: safeString(event?.source, 64) || undefined,
          deviceType: safeString(event?.deviceType, 40) || undefined,
          payload: sanitizePayload(event?.payload || {}),
          occurredAt: Number.isFinite(parsedOccurredAt.getTime()) ? parsedOccurredAt : new Date()
        };
      })
      .filter(Boolean);

    if (events.length) {
      await AnalyticsEvent.insertMany(events, { ordered: false });
    }

    return res.status(202).json({
      success: true,
      accepted: events.length
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
