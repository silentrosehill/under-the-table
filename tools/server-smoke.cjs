const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, MONOPOLY_DESKTOP: '1', SIM: '' }, stdio: ['ignore', 'pipe', 'inherit'] });
const timer = setTimeout(() => { child.kill(); console.error('Server smoke test timed out'); process.exitCode = 1; }, 15000);
let output = '', ran = false;
child.stdout.on('data', async chunk => {
  output += chunk;
  const match = output.match(/http:\/\/localhost:(\d+)/);
  if (!match || ran) return;
  ran = true;
  try {
    const base = `http://127.0.0.1:${match[1]}`;
    async function post(route, body) { const r = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); assert.equal(r.status, 200); return r.json(); }
    for (const asset of ['/', '/vendor/three/build/three.module.js', '/vendor/cannon-es.js']) assert.equal((await fetch(base + asset)).status, 200);
    const { secret } = await post('/api/join', { name: 'Smoke host' });
    await post('/api/action', { secret, type: 'addBot' });
    await post('/api/action', { secret, type: 'start' });
    const response = await fetch(base + '/poll?v=-1', { headers: { Authorization: `Bearer ${secret}` } });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    const { state } = await response.json();
    assert.ok(state.you);
    assert.ok(!JSON.stringify(state).includes(secret));
    const guest = await (await fetch(base + '/poll?v=-1')).json();
    assert.equal(guest.state.mine, null);
    assert.equal(guest.state.you, null);
    const legacy = await (await fetch(base + '/poll?v=-1&s=' + secret)).json();
    assert.equal(legacy.state.you, state.you);
    assert.equal((await fetch(base + '/%2e%2e%2fserver.js')).status, 403);
    assert.equal((await fetch(base + '/.env')).status, 403);
    const page = await (await fetch(base)).text();
    assert.ok(!page.includes('fonts.googleapis.com'));
    const css = await (await fetch(base + '/assets/fonts/fonts.css')).text();
    assert.ok(!css.includes('https://'));
    for (const [, font] of css.matchAll(/url\(([^)]+)\)/g)) assert.equal((await fetch(base + '/assets/fonts/' + font)).status, 200);
    assert.equal(state.phase, 'playing'); assert.equal(state.players.length, 2); assert.equal(state.board.length, 40);
    console.log('PASS: gameplay, local fonts, header authentication, legacy compatibility, private state isolation, no-cache/referrer headers, traversal/dotfile blocking.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { clearTimeout(timer); child.kill(); }
});
child.on('error', error => { clearTimeout(timer); console.error(error); process.exitCode = 1; });
