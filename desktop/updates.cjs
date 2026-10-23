const fs = require('node:fs');
const path = require('node:path');
const { app, net, shell } = require('electron');
const API = 'https://api.github.com/repos/silentrosehill/under-the-table/releases/latest';
const RELEASE_PREFIX = 'https://github.com/silentrosehill/under-the-table/';
const DAY = 24 * 60 * 60 * 1000;
const cacheFile = () => path.join(app.getPath('userData'), 'update-check.json');
let releaseUrl = null;
function parse(v) { const m = String(v).trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/); return m ? { n: [+m[1], +m[2], +m[3]], pre: m[4] || '' } : null; }
function compare(a, b) {
  const x = parse(a), y = parse(b); if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
  if (x.pre === y.pre) return 0;
  return !x.pre ? 1 : !y.pre ? -1 : (x.pre < y.pre ? -1 : 1);
}
function summary(body) {
  const text = String(body || '').replace(/\r/g, '').split('\n').map(l => l.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s+/, '- ').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim()).filter(Boolean).join('\n');
  return text.length > 420 ? text.slice(0, 420).replace(/\s+\S*$/, '') + '…' : text;
}
async function fetchLatest() {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await net.fetch(API, { headers: { 'User-Agent': `UnderTheTable/${app.getVersion()}`, Accept: 'application/vnd.github+json' }, signal: controller.signal, credentials: 'omit' });
    if (res.status === 404) return { state: 'none', current: app.getVersion() };
    if (res.status === 403 || res.status === 429) return { state: 'error', error: 'GitHub is limiting requests right now. Try again in a little while.' };
    if (!res.ok) return { state: 'error', error: `GitHub answered with an error (${res.status}). Try again later.` };
    const data = await res.json();
    const latest = String(data.tag_name || '').replace(/^v/i, '');
    if (!parse(latest)) return { state: 'error', error: 'The latest release has an unreadable version.' };
    const url = typeof data.html_url === 'string' && data.html_url.startsWith(RELEASE_PREFIX) ? data.html_url : `${RELEASE_PREFIX}releases/latest`;
    const current = app.getVersion();
    return { state: compare(current, latest) < 0 ? 'available' : 'current', current, latest, url, notes: summary(data.body), name: String(data.name || '') };
  } catch (error) {
    return { state: 'error', error: error.name === 'AbortError' ? 'The update check timed out.' : 'Could not reach GitHub. Check your internet connection.' };
  } finally { clearTimeout(timer); }
}
function readCache() { try { const c = JSON.parse(fs.readFileSync(cacheFile(), 'utf8')); return c && typeof c.checkedAt === 'number' && c.result && c.result.current === app.getVersion() ? c : null; } catch { return null; } }
function writeCache(result) { try { fs.writeFileSync(cacheFile(), JSON.stringify({ checkedAt: Date.now(), result })); } catch {} }
// force: user pressed the button. Otherwise reuse a result younger than a day; failures are not cached.
async function check(force) {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.checkedAt < DAY) { if (cached.result.url) releaseUrl = cached.result.url; return cached.result; }
  const result = await fetchLatest();
  if (result.state !== 'error') writeCache(result);
  if (result.url) releaseUrl = result.url;
  return result;
}
function openRelease() { const url = releaseUrl || `${RELEASE_PREFIX}releases/latest`; if (!url.startsWith(RELEASE_PREFIX)) return false; shell.openExternal(url); return true; }
module.exports = { check, openRelease, compare };
