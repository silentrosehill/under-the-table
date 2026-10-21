// Compact money, shared by the HUD, the boards and City Mode (the server has the same rules in fmtMoney):
// $950 · $60K · $12.5K · $1.2M · $1.25M · -$50K
export function fmtMoney(n, cur = '$') {
  const a = Math.abs(n), sign = n < 0 ? '-' : '';
  const trim = (x, d) => String(Number(x.toFixed(d)));
  let body;
  if (a < 1000) body = String(Math.round(a));
  else if (Math.round(a / 100) / 10 < 1000) body = trim(a / 1000, 1) + 'K';
  else body = trim(a / 1e6, 2) + 'M';
  return `${sign}${cur}${body}`;
}
