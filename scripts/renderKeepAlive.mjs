const targetUrl = process.env.RENDER_KEEPALIVE_URL || 'https://api.talepet.net.tr/api/health';

try {
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'talepet-render-keepalive/1.0'
    }
  });

  console.log(
    JSON.stringify({
      ok: response.ok,
      status: response.status,
      url: targetUrl,
      timestamp: new Date().toISOString()
    })
  );

  process.exit(response.ok ? 0 : 1);
} catch (error) {
  console.error(
    JSON.stringify({
      ok: false,
      status: 0,
      url: targetUrl,
      message: error?.message || String(error),
      timestamp: new Date().toISOString()
    })
  );
  process.exit(1);
}
