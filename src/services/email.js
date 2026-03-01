import nodemailer from 'nodemailer';

const getEnv = (key, fallback = '') => (process.env[key] || fallback).trim();

export const makeMailer = () => {
  const host = getEnv('BREVO_SMTP_HOST', 'smtp-relay.brevo.com');
  const port = Number(getEnv('BREVO_SMTP_PORT', '587')) || 587;
  const user = getEnv('BREVO_SMTP_USER');
  const pass = getEnv('BREVO_SMTP_PASS');
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined
  });
};

export const sendOtpEmail = async ({ to, code }) => {
  const mailer = makeMailer();
  const from = getEnv('MAIL_FROM', 'Talepet <noreply@talepet.com.tr>');
  const text = `Doğrulama kodun: ${code}\nKod 5 dakika geçerlidir.`;

  await mailer.sendMail({
    from,
    to,
    subject: 'Doğrulama Kodun',
    text
  });
};

export const sendPasswordResetEmail = async ({ to, resetLink }) => {
  const mailer = makeMailer();
  const from = getEnv('MAIL_FROM', 'Talepet <noreply@talepet.com.tr>');
  const text = `Şifre sıfırlama bağlantın:\n${resetLink}\nBağlantı 15 dakika geçerlidir.`;

  await mailer.sendMail({
    from,
    to,
    subject: 'Şifre Sıfırlama',
    text
  });
};
