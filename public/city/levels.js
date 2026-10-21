// Every district's six-level buildings, registered with the archetype builders (archetypes.js ARCH) by cityScene.js.
import { BOWERY_ARCH } from './bowery.js';
import { LONDON_ARCH } from './london.js';
import { PARIS_ARCH } from './paris.js';
import { TOKYO_ARCH } from './tokyo.js';
import { DOWNTOWN_ARCH } from './downtown.js';
import { HARBOUR_ARCH } from './harbour.js';
import { CANAL_ARCH } from './canal.js';
import { LUXE_ARCH } from './luxe.js';

export const LEVEL_ARCH = { ...BOWERY_ARCH, ...LONDON_ARCH, ...PARIS_ARCH, ...TOKYO_ARCH, ...DOWNTOWN_ARCH, ...HARBOUR_ARCH, ...CANAL_ARCH, ...LUXE_ARCH };
