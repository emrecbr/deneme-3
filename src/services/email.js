import nodemailer from 'nodemailer';

const getEnv = (key, fallback = '') => (process.env[key] || fallback).trim();

const maskSensitive = (text, values) => {
  if (!text) return text;
  let masked = String(text);
  values.forEach((val) => {
    if (!val) return;
    const safe = String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    masked = masked.replace(new RegExp(safe, 'g'), '***');
  });
  return masked;
};

const parseFrom = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/"$/g, '').replace(/^"/g, ''), email: match[2].trim() };
  }
  return { name: 'Talepet', email: raw };
};

let verifiedOnce = false;

const logEmailFail = (error, meta = {}) => {
  const payload = {
    code: error?.code,
    responseCode: error?.responseCode,
    command: error?.command,
    message: error?.message,
    name: error?.name,
    hostname: error?.hostname,
    syscall: error?.syscall,
    errno: error?.errno,
    provider: meta.provider,
    host: meta.host,
    port: meta.port
  };
  console.error('EMAIL_SEND_FAIL', payload);
};

const resolveSmtpConfig = () => {
  const sendgridKey = getEnv('SENDGRID_API_KEY');
  if (sendgridKey) {
    return {
      provider: 'sendgrid',
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
    provider: 'brevo',
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : null
  };
};

const resolveApiProvider = () => {
  const provider = getEnv('EMAIL_PROVIDER');
  if (provider === 'sendgrid_api') {
    return { provider, apiKey: getEnv('SENDGRID_API_KEY') };
  }
  if (provider === 'brevo_api') {
    return { provider, apiKey: getEnv('BREVO_API_KEY') };
  }
  return { provider: '' };
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

const sendEmailWithProvider = async ({ to, subject, text, html }) => {
  try {
    const provider = getEnv('EMAIL_PROVIDER');
    if (provider === 'mock' || getEnv('DRY_RUN') === 'true') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('EMAIL_MOCK', to);
      }
      return { id: 'mock', status: 'mocked' };
    }

    const fromRaw = getEnv('MAIL_FROM', getEnv('EMAIL_FROM', 'Talepet <noreply@talepet.net.tr>'));
    const from = parseFrom(fromRaw);
    const safeSubject = subject || 'Talepet bildirimi';
    const textContent = text || '';
    const htmlContent = html || '';

    const apiConfig = resolveApiProvider();
    if (apiConfig.provider === 'brevo_api') {
      if (!apiConfig.apiKey) {
        const error = new Error('Brevo API key eksik.');
        error.code = 'CONFIG_MISSING_BREVO_API';
        error.statusCode = 501;
        throw error;
      }
      const url = 'https://api.brevo.com/v3/smtp/email';
      const controller = new AbortController();
      const timeoutMs = Number(getEnv('EMAIL_SEND_TIMEOUT_MS', '15000')) || 15000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiConfig.apiKey
          },
          body: JSON.stringify({
            sender: { name: from.name || 'Talepet', email: from.email },
            to: [{ email: to }],
            subject: safeSubject,
            textContent,
            htmlContent
          }),
          signal: controller.signal
        });
        const rawText = await response.text();
        let parsed = null;
        try {
          parsed = JSON.parse(rawText);
        } catch (_err) {
          parsed = null;
        }
        if (!response.ok) {
          console.error('EMAIL_SEND_FAIL', {
            provider: 'brevo_api',
            httpStatus: response.status,
            errorCode: parsed?.code || parsed?.error?.code,
            errorMessage: parsed?.message || parsed?.error?.message || parsed?.error?.reason,
            sender: from.email,
            bodyPreview: maskSensitive(rawText, [apiConfig.apiKey, to, from.email]).slice(0, 1200)
          });
          const error = new Error('Email gönderilemedi.');
          error.code = 'EMAIL_SEND_FAIL';
          error.statusCode = 502;
          error.detail = parsed?.message || parsed?.error?.message || rawText?.slice?.(0, 200);
          throw error;
        }
      } finally {
        clearTimeout(timeoutId);
      }
      return { provider: 'brevo_api', status: 'sent' };
    }

    if (apiConfig.provider === 'sendgrid_api') {
      if (!apiConfig.apiKey) {
        const error = new Error('SendGrid API key eksik.');
        error.code = 'CONFIG_MISSING_SENDGRID_API';
        error.statusCode = 501;
        throw error;
      }
      const url = 'https://api.sendgrid.com/v3/mail/send';
      const controller = new AbortController();
      const timeoutMs = Number(getEnv('EMAIL_SEND_TIMEOUT_MS', '15000')) || 15000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: from.email, name: from.name || 'Talepet' },
            subject: safeSubject,
            content: [
              { type: 'text/plain', value: textContent },
              { type: 'text/html', value: htmlContent }
            ]
          }),
          signal: controller.signal
        });
        const rawText = await response.text();
        if (!response.ok) {
          console.error('EMAIL_SEND_FAIL', {
            provider: 'sendgrid_api',
            httpStatus: response.status,
            bodyPreview: maskSensitive(rawText, [apiConfig.apiKey]).slice(0, 1200)
          });
          const error = new Error('Email gönderilemedi.');
          error.code = 'EMAIL_SEND_FAIL';
          error.statusCode = 502;
          throw error;
        }
      } finally {
        clearTimeout(timeoutId);
      }
      return { provider: 'sendgrid_api', status: 'sent' };
    }

    const mailerConfig = resolveSmtpConfig();
    const mailer = makeMailer();
    await mailer.sendMail({
      from: `${from.name || 'Talepet'} <${from.email}>`,
      to,
      subject: safeSubject,
      text: textContent,
      html: htmlContent
    });
    return { provider: mailerConfig.provider, status: 'sent' };
  } catch (error) {
    const apiConfig = resolveApiProvider();
    if (apiConfig.provider) {
      logEmailFail(error, { provider: apiConfig.provider, host: 'api', port: 'https' });
    } else {
      const mailerConfig = resolveSmtpConfig();
      logEmailFail(error, { provider: mailerConfig.provider, host: mailerConfig.host, port: mailerConfig.port });
    }
    const err = new Error('Email gönderilemedi.');
    err.code = error?.code || 'EMAIL_SEND_FAIL';
    err.statusCode = error?.statusCode || 502;
    err.detail = error?.message;
    throw err;
  }
};

export const sendOtpEmail = async ({ to, code }) => {
  const text = `Doğrulama kodun: ${code}\nKod 5 dakika geçerlidir.`;
  const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Talepet Doğrulama Kodu</h2>
        <p>Doğrulama kodun:</p>
        <div style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${code}</div>
        <p>Bu kod 5 dakika geçerlidir.</p>
      </div>
    `;
  return sendEmailWithProvider({
    to,
    subject: 'Talepet doğrulama kodun',
    text,
    html
  });
};

export const sendPasswordResetOtpEmail = async ({ to, code }) => {
  const text = `Şifre sıfırlama kodun: ${code}\nKod 10 dakika geçerlidir.`;
  const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Talepet Şifre Sıfırlama</h2>
        <p>Şifre sıfırlama kodun:</p>
        <div style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${code}</div>
        <p>Bu kod 10 dakika geçerlidir.</p>
      </div>
    `;
  return sendEmailWithProvider({
    to,
    subject: 'Talepet şifre sıfırlama kodun',
    text,
    html
  });
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
