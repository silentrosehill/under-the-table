// Game speed: the host picks Relaxed / Normal / Fast in the lobby; the server sends the factor (settings.speedMult: 1.6 / 1 / 0.65).
// Every animation duration and hold goes through ms(): longer for Relaxed, shorter for Fast. Normal (1) is the original pace.
let mult = 1;
export const speed = () => mult;
export const setSpeed = m => { mult = Number.isFinite(Number(m)) && Number(m) > 0 ? Number(m) : 1; };
export const ms = n => n * mult;
