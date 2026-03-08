import nodemailer from 'nodemailer';

const getEnv = (key, fallback = '') => (process.env[key] || fallback).trim();

let verifiedOnce = false;

const logEmailFail = (error) => {
  const payload = {
    code: error?.code,
    responseCode: error?.responseCode,
    command: error?.command,
    message: error?.message,
    name: error?.name,
    hostname: error?.hostname,
    syscall: error?.syscall,
    errno: error?.errno
  };
  console.error('EMAIL_SEND_FAIL', payload);
};

const resolveSmtpConfig = () => {
  const sendgridKey = getEnv('SENDGRID_API_KEY');
  if (sendgridKey) {
    return {
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: { user: 'apikey', pass: sendgridKey }
    };
  }

  const host = getEnv('BREVO_SMTP_HOST', 'smtp-relay.brevo.com');
  const port = Number(getEnv('BREVO_SMTP_PORT', '587')) || 587;
  const user = getEnv('BREVO_SMTP_USER');
  const pass = getEnv('BREVO_SMTP_PASS');
  return {
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : null
  };
};

export const makeMailer = () => {
  const config = resolveSmtpConfig();
  if (!config.auth) {
    const error = new Error('Brevo SMTP credentials eksik.');
    error.code = 'CONFIG_MISSING_BREVO';
    error.statusCode = 501;
    throw error;
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth || undefined,
    connectionTimeout: Number(getEnv('SMTP_CONNECTION_TIMEOUT_MS', '8000')),
    greetingTimeout: Number(getEnv('SMTP_GREETING_TIMEOUT_MS', '8000')),
    socketTimeout: Number(getEnv('SMTP_SOCKET_TIMEOUT_MS', '8000')),
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    tls: {
      rejectUnauthorized: getEnv('SMTP_TLS_REJECT_UNAUTHORIZED', 'true') !== 'false'
    }
  });

  if (process.env.NODE_ENV === 'production' && !verifiedOnce) {
    verifiedOnce = true;
    transport.verify()
      .then(() => {
        console.log('EMAIL_SMTP_OK');
      })
      .catch((error) => {
        console.error('EMAIL_SMTP_VERIFY_FAIL', {
          code: error?.code,
          responseCode: error?.responseCode,
          command: error?.command,
          message: error?.message,
          name: error?.name,
          hostname: error?.hostname,
          syscall: error?.syscall,
          errno: error?.errno
        });
      });
  }

  return transport;
};

export const sendOtpEmail = async ({ to, code }) => {
  try {
    const provider = getEnv('EMAIL_PROVIDER');
    if (provider === 'mock' || getEnv('DRY_RUN') === 'true') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('EMAIL_OTP_MOCK', to, code);
      }
      return { id: 'mock', status: 'mocked' };
    }
    const mailer = makeMailer();
    const from = getEnv('MAIL_FROM', getEnv('EMAIL_FROM', 'Talepet <noreply@talepet.net.tr>'));
    const text = `Doğrulama kodun: ${code}\nKod 5 dakika geçerlidir.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Talepet Doğrulama Kodu</h2>
        <p>Doğrulama kodun:</p>
        <div style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${code}</div>
        <p>Bu kod 5 dakika geçerlidir.</p>
      </div>
    `;

    await mailer.sendMail({
      from,
      to,
      subject: 'Talepet doğrulama kodun',
      text,
      html
    });
  } catch (error) {
    logEmailFail(error);
    const err = new Error('Email gönderilemedi.');
    err.code = error?.code || 'EMAIL_SEND_FAIL';
    err.statusCode = error?.statusCode || 502;
    err.detail = error?.message;
    throw err;
  }
};

export const sendPasswordResetEmail = async ({ to, resetLink }) => {
  try {
    const provider = getEnv('EMAIL_PROVIDER');
    if (provider === 'mock' || getEnv('DRY_RUN') === 'true') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('EMAIL_RESET_MOCK', to, resetLink);
      }
      return { id: 'mock', status: 'mocked' };
    }
    const mailer = makeMailer();
    const from = getEnv('MAIL_FROM', getEnv('EMAIL_FROM', 'Talepet <noreply@talepet.net.tr>'));
    const text = `Şifre sıfırlama bağlantın:\n${resetLink}\nBağlantı 15 dakika geçerlidir.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Şifre Sıfırlama</h2>
        <p>Şifre sıfırlama bağlantın:</p>
        <a href="${resetLink}" target="_blank" rel="noreferrer">Şifremi sıfırla</a>
        <p>Bağlantı 15 dakika geçerlidir.</p>
      </div>
    `;

    await mailer.sendMail({
      from,
      to,
      subject: 'Şifre Sıfırlama',
      text,
      html
    });
  } catch (error) {
    logEmailFail(error);
    const err = new Error('Email gönderilemedi.');
    err.code = error?.code || 'EMAIL_SEND_FAIL';
    err.statusCode = error?.statusCode || 502;
    err.detail = error?.message;
    throw err;
  }
};
