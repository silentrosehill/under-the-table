const $ = id => document.getElementById(id);
let busy = false;
function disable(on) { busy = on; for (const b of document.querySelectorAll('button:not(#copy)')) b.disabled = on; }
async function run(action) { if (busy) return; disable(true); try { await action(); } catch (error) { $('message').textContent = error.message.replace(/^Error invoking remote method '[^']+': Error: /, ''); disable(false); } }
$('local').onclick = () => run(() => window.party.host(false));
$('online').onclick = () => run(() => window.party.host(true));
$('join').onsubmit = e => { e.preventDefault(); run(() => window.party.join($('address').value)); };
$('copy').onclick = async () => { if (await window.party.copyInvite()) { $('copy').textContent = 'Copied!'; setTimeout(() => $('copy').textContent = 'Copy invite link', 1800); } };
window.party.onStatus(async state => {
  $('message').textContent = state.message;
  $('invite').hidden = !state.inviteUrl;
  $('link').value = state.inviteUrl || '';
  $('lan').textContent = state.hostUrl ? 'On this Wi-Fi: ' + (await window.party.addresses()).join(' · ') : '';
  if (state.message === 'Ready to play.') disable(false);
});
let version = '';
function showUpdate(r) {
  const notes = $('update-notes'), get = $('get');
  notes.hidden = get.hidden = true;
  if (r.state === 'available') { $('update-msg').textContent = `Version v${r.latest} is available (you have v${r.current}).`; if (r.notes) { notes.textContent = r.notes; notes.hidden = false; } get.hidden = false; }
  else if (r.state === 'current') $('update-msg').textContent = `You're up to date (v${r.current}).`;
  else if (r.state === 'none') $('update-msg').textContent = `No published releases yet (you have v${version}).`;
  else $('update-msg').textContent = r.error || 'Could not check for updates.';
}
window.party.version().then(v => { version = v; $('version').textContent = 'v' + v; });
window.party.onUpdate(showUpdate);
$('check').onclick = async () => { $('check').disabled = true; $('update-msg').textContent = 'Checking…'; try { showUpdate(await window.party.checkUpdate()); } catch { $('update-msg').textContent = 'Could not check for updates.'; } $('check').disabled = false; };
$('get').onclick = () => window.party.openRelease();
