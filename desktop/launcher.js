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
