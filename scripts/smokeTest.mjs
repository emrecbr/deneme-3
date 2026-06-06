const DEFAULT_TIMEOUT_MS = 15000;

const config = {
  adminBaseUrl: process.env.SMOKE_ADMIN_URL || 'https://admin.talepet.net.tr',
  appBaseUrl: process.env.SMOKE_APP_URL || 'https://app.talepet.net.tr',
  webBaseUrl: process.env.SMOKE_WEB_URL || 'https://talepet.net.tr',
  apiBaseUrl: process.env.SMOKE_API_URL || 'https://api.talepet.net.tr/api'
};

const results = [];

const withTimeout = async (promise, label) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${label} timed out`)), DEFAULT_TIMEOUT_MS);
  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const record = (name, ok, details = '') => {
  results.push({ name, ok, details });
  const prefix = ok ? 'PASS' : 'FAIL';
  console.log(`${prefix} ${name}${details ? ` - ${details}` : ''}`);
};

const fetchText = async (url) =>
  withTimeout(
    (signal) =>
      fetch(url, {
        redirect: 'follow',
        signal,
        headers: { 'User-Agent': 'talepet-smoke-test/1.0' }
      }),
    url
  ).then(async (response) => ({
    response,
    text: await response.text()
  }));

const fetchJson = async (url) =>
  withTimeout(
    (signal) =>
      fetch(url, {
        redirect: 'follow',
        signal,
        headers: { Accept: 'application/json', 'User-Agent': 'talepet-smoke-test/1.0' }
      }),
    url
  ).then(async (response) => {
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_error) {
      json = null;
    }
    return { response, json, text };
  });

const assetUrlFromHtml = (html, origin) => {
  const match = String(html || '').match(/src="\/(assets\/index-[^"]+\.js)"/);
  return match ? `${origin}/${match[1]}` : '';
};

const expectStatus = async (name, url, expected) => {
  try {
    const { response } = await fetchJson(url);
    const ok = Array.isArray(expected) ? expected.includes(response.status) : response.status === expected;
    record(name, ok, `status=${response.status}`);
  } catch (error) {
    record(name, false, error.message);
  }
};

const expectSpaRoute = async (name, url, requiredTokens = []) => {
  try {
    const { response, text } = await fetchText(url);
    const origin = new URL(url).origin;
    const assetUrl = assetUrlFromHtml(text, origin);
    if (response.status !== 200 || !assetUrl) {
      record(name, false, `status=${response.status}, asset=${assetUrl || 'missing'}`);
      return;
    }

    const { response: assetResponse, text: assetText } = await fetchText(assetUrl);
    const missingTokens = requiredTokens.filter((token) => !assetText.includes(token));
    record(
      name,
      assetResponse.status === 200 && missingTokens.length === 0,
      `asset=${assetUrl.split('/').pop()}, missing=${missingTokens.join(',') || 'none'}`
    );
  } catch (error) {
    record(name, false, error.message);
  }
};

const main = async () => {
  const cacheBust = `smoke=${Date.now()}`;

  await expectStatus('API health', `${config.apiBaseUrl}/health`, 200);
  await expectStatus('Public home content', `${config.apiBaseUrl}/content/home`, 200);
  await expectStatus('Public categories', `${config.apiBaseUrl}/categories`, 200);

  await expectStatus('Admin chats require auth', `${config.apiBaseUrl}/admin/chats`, [401, 403]);
  await expectStatus('Admin chat reports require auth', `${config.apiBaseUrl}/admin/chat-reports`, [401, 403]);
  await expectStatus('Admin chat restrictions require auth', `${config.apiBaseUrl}/admin/chat-restrictions`, [401, 403]);

  await expectSpaRoute(`${config.adminBaseUrl}/admin/chats`, `${config.adminBaseUrl}/admin/chats?${cacheBust}`, [
    'AdminChats',
    'chat-reports',
    'chat-restrictions'
  ]);
  await expectSpaRoute(`${config.adminBaseUrl}/admin/chat-reports`, `${config.adminBaseUrl}/admin/chat-reports?${cacheBust}`, [
    'AdminChatReports',
    'chat-reports'
  ]);
  await expectSpaRoute(
    `${config.adminBaseUrl}/admin/chat-restrictions`,
    `${config.adminBaseUrl}/admin/chat-restrictions?${cacheBust}`,
    ['AdminChatRestrictions', 'chat-restrictions']
  );
  await expectSpaRoute(`${config.appBaseUrl}/app`, `${config.appBaseUrl}/app?${cacheBust}`, ['RFQList']);
  await expectSpaRoute(`${config.webBaseUrl}/`, `${config.webBaseUrl}/?${cacheBust}`, ['LandingPage']);

  const failed = results.filter((item) => !item.ok);
  console.log(`\nSmoke summary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(`FAIL smoke runner - ${error.message}`);
  process.exitCode = 1;
});
