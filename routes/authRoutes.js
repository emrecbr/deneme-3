import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getMe,
  login,
  logout,
  register,
  requestPhoneOtp,
  verifyPhoneOtp,
  sendRegisterOtp,
  verifyRegisterOtp,
  sendLoginOtp,
  verifyLoginOtp,
  precheckAuth,
  oauthGoogle,
  oauthGoogleCallback,
  oauthApple,
  oauthAppleCallback
} from '../controllers/authController.js';
import { sendOtp, verifyOtp, completeEmailSignup } from '../controllers/otpController.js';
import {
  sendSmsOtpController,
  verifySmsOtpController,
  completeSmsSignupController
} from '../controllers/smsOtpController.js';
import {
  forgotPassword,
  verifyPasswordReset,
  resetPassword
} from '../controllers/passwordResetController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});
const precheckLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/register/otp/send', otpLimiter, sendRegisterOtp);
router.post('/register/otp/verify', otpLimiter, verifyRegisterOtp);
router.post('/login/otp/send', otpLimiter, sendLoginOtp);
router.post('/login/otp/verify', otpLimiter, verifyLoginOtp);
router.post('/phone/request-otp', requestPhoneOtp);
router.post('/phone/verify-otp', verifyPhoneOtp);
router.post('/otp/send', otpLimiter, sendOtp);
router.post('/otp/verify', otpLimiter, verifyOtp);
router.post('/precheck', precheckLimiter, precheckAuth);
router.post('/email/complete-signup', otpLimiter, completeEmailSignup);
router.post('/sms/send', otpLimiter, sendSmsOtpController);
router.post('/sms/verify', otpLimiter, verifySmsOtpController);
router.post('/sms/complete-signup', otpLimiter, completeSmsSignupController);
router.post('/password/forgot', otpLimiter, forgotPassword);
router.post('/password/verify', otpLimiter, verifyPasswordReset);
router.post('/password/reset', otpLimiter, resetPassword);
router.get('/google', oauthGoogle);
router.get('/google/callback', oauthGoogleCallback);
router.get('/apple', oauthApple);
router.get('/apple/callback', oauthAppleCallback);
router.get('/me', authMiddleware, getMe);

export default router;
