// "Toybox Town" style guide, as code. Every color in the 3D scene comes from here.
// Look: a premium toy board game come to life — chunky rounded shapes, warm saturated
// colors, soft light. Nothing photoreal, nothing neon.

export const P = {
  // board & paper
  cream: '#FFF4DE', creamShade: '#F2DFC0', ink: '#3A2A26', inkSoft: '#8C6A58',
  // painted wood (board tray, signs, posts)
  wood: '#E7B47A', woodDark: '#B8804F', woodDeep: '#7E5232',
  // nature
  grass: '#7FCB5C', grassLight: '#A6DE79', grassDark: '#4F9A45', leaf: '#5DB85A', leafDark: '#3E8F4B',
  soil: '#C98A5A', soilDark: '#9B6544', rock: '#8E7466', rockDark: '#6B564C', stone: '#E8DCC8', stoneDark: '#CBB89C',
  // accents
  coral: '#FF6B57', sunflower: '#FFC83D', teal: '#2EC4B6', berry: '#E2457A', plum: '#7A5CFA', sky: '#5EB8FF',
  felt: '#2FA37C', lampGlow: '#FFD58A', metal: '#55606E',
  // the 8 property districts: toy-bright takes on the classic groups
  groups: {
    brown: '#B06E45', lightblue: '#6CCBF5', pink: '#F06BB2', orange: '#FF9A3C',
    red: '#F2484B', yellow: '#FFD23F', green: '#3DBE6A', darkblue: '#3E6FE0',
  },
};

export const FONTS = { display: 'Fredoka, Nunito, system-ui, sans-serif', body: 'Nunito, system-ui, sans-serif' };

// Lighting moods. The game drifts through them as rounds pass (or a player can pin one).
// sunDir points from the board toward the light.
export const MOODS = {
  day: {
    skyTop: '#4FA8F5', skyHorizon: '#CDEBFF', skyBottom: '#EEF7FF',
    sunColor: '#FFE1B5', sunIntensity: 3.0, sunDir: [0.5, 0.95, 0.42],
    fill: '#CFE6FF', fillGround: '#C99A6B', fillIntensity: 0.85,
    rimColor: '#BFE3FF', rimIntensity: 0.7, env: 0.55,
    fogNear: 55, fogFar: 160, exposure: 1.0,
    bloom: 0.22, bloomThreshold: 0.92, tint: [1.03, 1.0, 0.95], saturation: 1.12, contrast: 1.06, vignette: 0.26,
    lamps: 0, stars: 0, cloud: '#FFFFFF',
  },
  sunset: {
    skyTop: '#4A62B0', skyHorizon: '#FFBE8C', skyBottom: '#FFE0C4',
    sunColor: '#FFB680', sunIntensity: 2.5, sunDir: [0.85, 0.4, -0.2],
    fill: '#FFDCC8', fillGround: '#6E4A44', fillIntensity: 0.8,
    rimColor: '#FFA3C2', rimIntensity: 0.85, env: 0.45,
    fogNear: 50, fogFar: 140, exposure: 1.0,
    bloom: 0.45, bloomThreshold: 0.85, tint: [1.04, 0.99, 0.95], saturation: 1.08, contrast: 1.05, vignette: 0.32,
    lamps: 1.4, stars: 0.15, cloud: '#FFF0E6',
  },
  night: {
    skyTop: '#0A1030', skyHorizon: '#2A3A70', skyBottom: '#34467E',
    sunColor: '#B8C8FF', sunIntensity: 1.5, sunDir: [-0.45, 0.9, -0.5],
    fill: '#7A8FD6', fillGround: '#3A2E3A', fillIntensity: 0.7,
    rimColor: '#8FB4FF', rimIntensity: 0.8, env: 0.3,
    fogNear: 45, fogFar: 130, exposure: 1.05,
    bloom: 0.9, bloomThreshold: 0.7, tint: [0.97, 0.98, 1.06], saturation: 1.05, contrast: 1.06, vignette: 0.42,
    lamps: 4.0, stars: 1, cloud: '#6E7FB8',
  },
};
MOODS.dawn = { ...MOODS.sunset, skyTop: '#6C7FD1', skyHorizon: '#FFC9A3', sunDir: [-0.8, 0.38, 0.3], rimColor: '#FFB6D0', lamps: 0.6 };

// Auto mode: a 12-round day cycle — day, sunset, night, dawn.
export function moodForRound(round) {
  const p = (Math.max(1, round || 1) - 1) % 12;
  return p < 6 ? 'day' : p < 8 ? 'sunset' : p < 11 ? 'night' : 'dawn';
}

export const groupColor = sp => (sp.group && P.groups[sp.group]) || sp.color || P.inkSoft;
