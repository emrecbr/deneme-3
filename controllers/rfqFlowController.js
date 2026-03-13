import RfqFlowEvent from '../models/RfqFlowEvent.js';

export const logRfqFlowEvent = async (req, res, next) => {
  try {
    const { step, event, field, error, meta } = req.body || {};
    const stepNum = Number(step);
    if (!Number.isFinite(stepNum) || stepNum < 1) {
      return res.status(400).json({ success: false, message: 'Step gerekli.' });
    }
    if (!['step_view', 'step_complete', 'step_blocked'].includes(event)) {
      return res.status(400).json({ success: false, message: 'Event geçersiz.' });
    }
    const payload = {
      userId: req.user?.id || null,
      step: stepNum,
      event,
      field: field || undefined,
      error: error || undefined,
      meta: meta || undefined
    };
    const saved = await RfqFlowEvent.create(payload);
    return res.status(201).json({ success: true, data: saved });
  } catch (error) {
    return next(error);
  }
};
