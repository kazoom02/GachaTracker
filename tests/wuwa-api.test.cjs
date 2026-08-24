const assert = require('node:assert/strict');
const handler = require('../api/wuwa.js');

function responseHarness() {
  const result = { headers: {} };
  return {
    result,
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.status = code; return this; },
    send(body) { result.body = body; return this; },
    json(body) { result.body = body; return this; },
    end() { return this; },
  };
}

(async () => {
  const originalFetch = global.fetch;
  try {
    {
      const res = responseHarness();
      await handler({ method: 'POST', query: {}, body: {} }, res);
      assert.equal(res.result.status, 400);
      assert.match(res.result.body.error, /Missing required/);
    }

    {
      const calls = [];
      global.fetch = async (url) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ code: 0, message: 'success', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };
      const res = responseHarness();
      await handler({
        method: 'POST',
        query: { server: 'cn' },
        body: { playerId: '1', cardPoolType: 1, serverId: '2', recordId: '3' },
      }, res);
      assert.equal(res.result.status, 200);
      assert.match(calls[0], /aki-game2\.com/);
      assert.equal(JSON.parse(res.result.body).code, 0);
    }
  } finally {
    global.fetch = originalFetch;
  }

  console.log('WuWa API tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
