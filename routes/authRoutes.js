import { Router } from 'express';
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
  oauthAppleTokenLogin,
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
import { apiRateLimit, otpSendRateLimit } from '../middleware/apiRateLimit.js';

const router = Router();

router.post('/register', apiRateLimit('register'), register);
router.post('/login', apiRateLimit('login'), login);
router.post('/logout', logout);
router.post('/register/otp/send', ...otpSendRateLimit, sendRegisterOtp);
router.post('/register/otp/verify', apiRateLimit('login'), verifyRegisterOtp);
router.post('/login/otp/send', ...otpSendRateLimit, sendLoginOtp);
router.post('/login/otp/verify', apiRateLimit('login'), verifyLoginOtp);
router.post('/phone/request-otp', ...otpSendRateLimit, requestPhoneOtp);
router.post('/phone/verify-otp', verifyPhoneOtp);
router.post('/otp/send', ...otpSendRateLimit, sendOtp);
router.post('/otp/verify', apiRateLimit('login'), verifyOtp);
router.post('/precheck', apiRateLimit('login'), precheckAuth);
router.post('/email/complete-signup', apiRateLimit('register'), completeEmailSignup);
router.post('/sms/send', ...otpSendRateLimit, sendSmsOtpController);
router.post('/sms/verify', apiRateLimit('login'), verifySmsOtpController);
router.post('/sms/complete-signup', apiRateLimit('register'), completeSmsSignupController);
router.post('/password/forgot', apiRateLimit('passwordReset'), forgotPassword);
router.post('/password/verify', apiRateLimit('passwordReset'), verifyPasswordReset);
router.post('/password/reset', apiRateLimit('passwordReset'), resetPassword);
router.get('/google', oauthGoogle);
router.get('/google/callback', oauthGoogleCallback);
router.get('/apple', oauthApple);
router.post('/apple', apiRateLimit('login'), oauthAppleTokenLogin);
router.get('/apple/callback', oauthAppleCallback);
router.post('/apple/callback', oauthAppleCallback);
router.get('/me', authMiddleware, getMe);

export default router;
