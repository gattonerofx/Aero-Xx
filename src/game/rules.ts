import {
  ActiveMine,
  ActiveMissile,
  ActiveWeaponId,
  AiDifficulty,
  BonusType,
  EnergyRing,
  GameSettings,
  MusicThemeId,
  PowerUpItemType,
  RacerState,
  SfxPresetId,
  ShipId,
  ShipSpec,
  TrackId,
  TrackPad,
  TrackSpec,
  VehicleUpgrades,
  WeaponType,
  WeatherMode,
  WeatherState,
} from './types';

export const BONUS_RESPAWN_SECONDS = 10.0;

export interface AiDifficultyProfile {
  id: 'novice' | 'professional' | 'apex';
  label: string;
  speedFactor: number;
  accelFactor: number;
  boostChance: number;
  steerDeadzone: number;
  airbrakeThreshold: number;
  lookAheadDist: number;
  weaponFireAggression: number;
  cornerBrakeThreshold: number;
}

export function getAiDifficultyProfile(difficulty: AiDifficulty): AiDifficultyProfile {
  if (difficulty === 'novice' || difficulty === 'rookie') {
    return {
      id: 'novice',
      label: 'NOVICE',
      speedFactor: 0.84,
      accelFactor: 0.85,
      boostChance: 0.14,
      steerDeadzone: 1.25,
      airbrakeThreshold: 5.2,
      lookAheadDist: 0.055,
      weaponFireAggression: 0.35,
      cornerBrakeThreshold: 0.82,
    };
  }
  if (difficulty === 'apex' || difficulty === 'phantom') {
    return {
      id: 'apex',
      label: 'APEX',
      speedFactor: 1.035,
      accelFactor: 1.04,
      boostChance: 0.78,
      steerDeadzone: 0.28,
      airbrakeThreshold: 2.35,
      lookAheadDist: 0.125,
      weaponFireAggression: 0.92,
      cornerBrakeThreshold: 0.44,
    };
  }
  return {
    id: 'professional',
    label: 'PROFESSIONAL',
    speedFactor: 0.94,
    accelFactor: 0.95,
    boostChance: 0.42,
    steerDeadzone: 0.62,
    airbrakeThreshold: 3.65,
    lookAheadDist: 0.085,
    weaponFireAggression: 0.68,
    cornerBrakeThreshold: 0.62,
  };
}

export const SHIP_SPECS: Record<ShipId, ShipSpec> = {
  valkyrie: {
    id: 'valkyrie',
    name: 'VALKYRIE AG-01',
    team: 'AERO DYNAMICS',
    tagline: 'Cyber-delta interceptor with glowing cyan hull circuitry and twin shock-diamond plasma turbines.',
    maxSpeedKmh: 785,
    acceleration: 265,
    handling: 1.08,
    boostPower: 195,
    energyCapacity: 100,
    primaryColor: 0x94a3b8,
    accentColor: 0x00f2fe,
    thrusterColor: 0x38bdf8,
  },
  spectre: {
    id: 'spectre',
    name: 'SPECTRE NX-7',
    team: 'PHANTOM WORKS',
    tagline: 'Forward-swept X-wing stealth razor with exposed violet reactor ribs and hyper-agile cornering.',
    maxSpeedKmh: 760,
    acceleration: 295,
    handling: 1.32,
    boostPower: 215,
    energyCapacity: 95,
    primaryColor: 0x111827,
    accentColor: 0xf43f5e,
    thrusterColor: 0xc084fc,
  },
  titan: {
    id: 'titan',
    name: 'TITAN V12-G',
    team: 'VULCAN HEAVY',
    tagline: 'Twin-prong catamaran heavy brawler with armored forward sponsons and extreme top-end velocity.',
    maxSpeedKmh: 830,
    acceleration: 235,
    handling: 0.9,
    boostPower: 185,
    energyCapacity: 125,
    primaryColor: 0x475569,
    accentColor: 0xf97316,
    thrusterColor: 0xfb923c,
  },
  seraph: {
    id: 'seraph',
    name: 'SERAPH VX-9',
    team: 'SOLARIS ORBITAL',
    tagline: 'Orbital halo-wing prototype featuring a closed-loop airfoil ring and harmonic emerald-aqua thrusters.',
    maxSpeedKmh: 800,
    acceleration: 280,
    handling: 1.18,
    boostPower: 205,
    energyCapacity: 105,
    primaryColor: 0xe2e8f0,
    accentColor: 0x10b981,
    thrusterColor: 0x2dd4bf,
  },
  nemesis: {
    id: 'nemesis',
    name: 'NEMESIS XR-0',
    team: 'KUROSAWA CYBER',
    tagline: 'Matte-obsidian quad-katana hyper-drifter with crimson tachyon conduits and explosive boost thrust.',
    maxSpeedKmh: 815,
    acceleration: 272,
    handling: 1.12,
    boostPower: 220,
    energyCapacity: 110,
    primaryColor: 0x090d16,
    accentColor: 0xff1e42,
    thrusterColor: 0xf43f5e,
  },
};

export function isCityTrack(trackId: TrackId): boolean {
  return trackId === 'city' || trackId === 'city_v1';
}

export function isLavaTrack(trackId: TrackId): boolean {
  return trackId === 'lava_v2' || trackId === 'lava';
}

export const TRACK_SPECS: Record<TrackId, TrackSpec> = {
  city: {
    id: 'city',
    name: 'NEO-METROPOLIS SECTOR 4',
    sector: 'ORBITAL DOME DISTRICT // MK-II EXTENDED',
    subtitle: 'Extended 4-sector neon figure-8 skyway with 30m skybridge overpass, Shibuya hairpins, cyber esses & megatower core tunnel.',
    lengthMeters: 9800,
    totalLaps: 3,
    previewNeon: '/assets/aistudio/01_wet_neon_track_92d2e945.png',
    previewDay: '/assets/aistudio/06_city_window_facade_c6d256d2.png',
    difficulty: 'INTERMEDIATE',
  },
  lava_v2: {
    id: 'lava_v2',
    name: 'OBSIDIAN RIFT MK-II',
    sector: 'TEXTURED BASALT SECTOR // MK-II EXTENDED',
    subtitle: 'Extended 4-sector volcanic figure-8 skyway with 30m magma viaduct overpass, volcano cavern tunnel, caldera hairpins & basalt esses.',
    lengthMeters: 9600,
    totalLaps: 3,
    previewNeon: '/assets/aistudio/03_glowing_lava_9aea767b.png',
    previewDay: '/assets/aistudio/02_obsidian_rock_74edfbd0.png',
    difficulty: 'MASTER',
  },
  city_v1: {
    id: 'city_v1',
    name: 'NEO-METROPOLIS V1 (LEGACY)',
    sector: 'ORBITAL DOME // ARCHIVE V1 EXTENDED',
    subtitle: 'Extended procedural skyway weaving through illuminated megastructures, skybridge overpass, and the Geodesic Core.',
    lengthMeters: 9800,
    totalLaps: 3,
    previewNeon: '/assets/aistudio/city_003_31c2a862.jpeg',
    previewDay: '/assets/aistudio/city_001_4a956870.jpeg',
    difficulty: 'INTERMEDIATE',
  },
  lava: {
    id: 'lava',
    name: 'CALDERA PRIME V1 (LEGACY)',
    sector: 'VOLCANIC RIFT // ARCHIVE V1 EXTENDED',
    subtitle: 'Extended parabolic skyway plunging into a volcano-base magma tunnel, pyroclastic crest, basalt esses, and magma viaduct overpass.',
    lengthMeters: 9600,
    totalLaps: 3,
    previewNeon: '/assets/aistudio/lava_009_d80c0915.jpeg',
    previewDay: '/assets/aistudio/lava_008_f0bfd369.jpeg',
    difficulty: 'EXPERT',
  },
};

export const MUSIC_THEMES: Array<{
  id: MusicThemeId;
  label: string;
  shortLabel: string;
  bpm: number;
  genre: string;
}> = [
  {
    id: 'pro_theme',
    label: 'Aero-X Pro Theme',
    shortLabel: 'Pro Theme',
    bpm: 174,
    genre: 'Main Official Studio Breakbeat & Synth Theme',
  },
  {
    id: 'cyber_techno',
    label: 'Cyber Techno',
    shortLabel: 'Techno',
    bpm: 136,
    genre: 'Driving 4x4 Acid & Hypnotic Stabs',
  },
  {
    id: 'synthwave_outrun',
    label: 'Neon Synthwave',
    shortLabel: 'Synthwave',
    bpm: 124,
    genre: 'Analog Outrun Arps & Lush Pads',
  },
  {
    id: 'hyper_trance',
    label: 'Hyper Trance',
    shortLabel: 'Trance',
    bpm: 140,
    genre: 'Euphoric High-Velocity Supersaws',
  },
  {
    id: 'dark_electro',
    label: 'Dark Electro',
    shortLabel: 'Electro',
    bpm: 130,
    genre: 'Industrial Cyberpunk Bass & Syncopation',
  },
  {
    id: 'liquid_dnb',
    label: 'Liquid Drum & Bass',
    shortLabel: 'Liquid DnB',
    bpm: 172,
    genre: 'High-Speed Breakbeat & Deep Sub-Glide',
  },
];

export const SFX_PRESETS: Array<{
  id: SfxPresetId;
  label: string;
  shortLabel: string;
  desc: string;
}> = [
  {
    id: 'quantum_clean',
    label: 'Quantum Clean',
    shortLabel: 'Quantum',
    desc: 'Silky mag-lev turbine & pentatonic chimes',
  },
  {
    id: 'plasma_overdrive',
    label: 'Plasma Overdrive',
    shortLabel: 'Overdrive',
    desc: 'Aggressive saw thruster & laser ring sweeps',
  },
  {
    id: 'arcade_synth',
    label: 'Arcade Pulse',
    shortLabel: 'Arcade',
    desc: 'Crisp retro-futuristic pulse arpeggios',
  },
  {
    id: 'titan_heavy',
    label: 'Titan Sub-Bass',
    shortLabel: 'Titan Bass',
    desc: 'Deep seismic sub-rumble & heavy brass',
  },
  {
    id: 'crystalline_harmonic',
    label: 'Crystalline FM',
    shortLabel: 'Crystal FM',
    desc: 'Glassy FM bell overtones & airy slipstream',
  },
];

export const DEFAULT_SETTINGS: GameSettings = {
  trackId: 'city',
  atmosphere: 'neon',
  weatherMode: 'dynamic',
  shipId: 'valkyrie',
  cameraMode: 'chase',
  fov: 72,
  steerSensitivity: 1.0,
  aiDifficulty: 'professional',
  musicVolume: 0.65,
  sfxVolume: 0.75,
  musicTheme: 'pro_theme',
  sfxPreset: 'quantum_clean',
  muted: false,
  showParticles: true,
  enableDynamicFov: true,
  enableGForceTilt: true,
  enableMotionLines: true,
  enableTrackSsao: true,
  enableBloom: true,
  enableHeatHaze: true,
  enableLavaDisplacement: true,
  enableVolumetricRays: true,
  enableRisingEmbers: true,
  enableTrackDebris: true,
  neonIntensity: 1.15,
  autoAccelerate: false,
};

export const TRACK_HALF_WIDTH = 13.5;

/**
 * Computes the current dynamic or locked weather state for a track.
 * Affects visual clarity (visibilityFactor / fog) and surface friction (surfaceGrip).
 */
export function computeWeatherState(
  trackId: TrackId,
  weatherMode: WeatherMode,
  elapsedSec: number
): WeatherState {
  if (weatherMode === 'clear') {
    return {
      type: 'clear',
      intensity: 0,
      label: 'CLEAR SKIES',
      surfaceGrip: 1.0,
      visibilityFactor: 1.0,
    };
  }

  let intensity = 0.92;
  if (weatherMode === 'dynamic') {
    // Smoothly cycle between active squalls (0.45..0.95) and brief calmer windows (0.22..0.45)
    const wave1 = Math.sin(elapsedSec * 0.14 + 0.65);
    const wave2 = Math.cos(elapsedSec * 0.055);
    intensity = Math.max(0.22, Math.min(0.96, 0.62 + wave1 * 0.24 + wave2 * 0.12));
  }

  const surfaceGrip = Number((1.0 - intensity * 0.42).toFixed(3));
  const visibilityFactor = Number((1.0 - intensity * 0.48).toFixed(3));

  if (isCityTrack(trackId)) {
    const label =
      intensity >= 0.75
        ? 'CYBER MONSOON // WET'
        : intensity >= 0.42
        ? 'NEON RAIN SQUALL'
        : 'LIGHT MIST DRIZZLE';
    return {
      type: 'rain',
      intensity,
      label,
      surfaceGrip,
      visibilityFactor,
    };
  } else {
    const label =
      intensity >= 0.75
        ? 'VOLCANIC ASH STORM'
        : intensity >= 0.42
        ? 'PYROCLASTIC ASH DRIFT'
        : 'THERMAL CINDER HAZE';
    return {
      type: 'ash_storm',
      intensity,
      label,
      surfaceGrip,
      visibilityFactor,
    };
  }
}

export const POWERUP_REFERENCE_IMAGE = '/assets/aistudio/Duck-ai-image-2026-10-27-00-31_9087b996.jpeg';

export const POWERUP_ITEMS_ORDER: PowerUpItemType[] = [
  'boost',
  'nitro',
  'crystal',
  'shield',
  'repair',
  'credit',
];

export interface PowerUpMetaSpec {
  id: PowerUpItemType;
  label: string;
  shortLabel: string;
  description: string;
  effectBadge: string;
  color: string;
  accentHex: number;
  glowHex: number;
  spriteCol: 0 | 1 | 2;
  spriteRow: 0 | 1;
}

export const POWERUP_META: Record<PowerUpItemType, PowerUpMetaSpec> = {
  boost: {
    id: 'boost',
    label: 'BOOST',
    shortLabel: 'BOOST RING',
    description:
      'A circular cyan energy ring that grants a short burst of acceleration when collected. Its bright inner glow and segmented casing make it easy to spot on the track.',
    effectBadge: '+235 KM/H BURST',
    color: '#00f2fe',
    accentHex: 0x00f2fe,
    glowHex: 0x38bdf8,
    spriteCol: 0,
    spriteRow: 0,
  },
  nitro: {
    id: 'nitro',
    label: 'NITRO POWER-UP',
    shortLabel: 'NITRO FUEL',
    description:
      'A compact canister filled with glowing blue fuel. Collecting it adds nitro to the player’s reserve, which can be used for a longer speed boost.',
    effectBadge: '+45% NITRO RESERVE',
    color: '#00d2ff',
    accentHex: 0x00d2ff,
    glowHex: 0x3b82f6,
    spriteCol: 1,
    spriteRow: 0,
  },
  crystal: {
    id: 'crystal',
    label: 'CRYSTAL BONUS',
    shortLabel: 'CRYSTAL BONUS',
    description:
      'A sharp, faceted magenta crystal that floats above the track. Collect it for bonus points or a valuable upgrade.',
    effectBadge: '+500 PTS & UPGRADE',
    color: '#d946ef',
    accentHex: 0xd946ef,
    glowHex: 0xa855f7,
    spriteCol: 2,
    spriteRow: 0,
  },
  shield: {
    id: 'shield',
    label: 'SHIELD POWER-UP',
    shortLabel: 'HEX SHIELD',
    description:
      'A blue-violet orb protected by a glowing hexagonal energy grid. It activates a temporary shield that absorbs a collision or blocks damage.',
    effectBadge: 'HEX SHIELD 6.0S',
    color: '#6366f1',
    accentHex: 0x6366f1,
    glowHex: 0x3b82f6,
    spriteCol: 0,
    spriteRow: 1,
  },
  repair: {
    id: 'repair',
    label: 'REPAIR POWER-UP',
    shortLabel: 'HULL REPAIR',
    description:
      'A reinforced dark-metal crate with a cyan medical cross. It restores vehicle health or repairs damage sustained during the race.',
    effectBadge: 'REPAIR +40% HULL',
    color: '#22d3ee',
    accentHex: 0x22d3ee,
    glowHex: 0x06b6d4,
    spriteCol: 1,
    spriteRow: 1,
  },
  credit: {
    id: 'credit',
    label: 'CREDIT BONUS',
    shortLabel: 'GOLD CREDIT',
    description:
      'A gold-edged token with a raised central emblem. Collect it to earn credits for unlocking or upgrading vehicles and equipment.',
    effectBadge: '+150 GOLD CREDITS',
    color: '#fbbf24',
    accentHex: 0xfbbf24,
    glowHex: 0xf59e0b,
    spriteCol: 2,
    spriteRow: 1,
  },
};

export const BONUS_META: Record<
  BonusType,
  {
    label: string;
    description: string;
    color: string;
    effectBadge?: string;
    powerUpId?: PowerUpItemType;
  }
> = {
  none: {
    label: 'IN-GAME BOX READY',
    description: 'Collect on-track Power-Up Boxes or press [SPACE] with Nitro Reserve.',
    color: '#64748b',
    effectBadge: 'AWAITING PICKUP',
  },
  boost: {
    label: POWERUP_META.boost.label,
    description: POWERUP_META.boost.description,
    color: POWERUP_META.boost.color,
    effectBadge: POWERUP_META.boost.effectBadge,
    powerUpId: 'boost',
  },
  nitro: {
    label: POWERUP_META.nitro.label,
    description: POWERUP_META.nitro.description,
    color: POWERUP_META.nitro.color,
    effectBadge: POWERUP_META.nitro.effectBadge,
    powerUpId: 'nitro',
  },
  crystal: {
    label: POWERUP_META.crystal.label,
    description: POWERUP_META.crystal.description,
    color: POWERUP_META.crystal.color,
    effectBadge: POWERUP_META.crystal.effectBadge,
    powerUpId: 'crystal',
  },
  shield: {
    label: POWERUP_META.shield.label,
    description: POWERUP_META.shield.description,
    color: POWERUP_META.shield.color,
    effectBadge: POWERUP_META.shield.effectBadge,
    powerUpId: 'shield',
  },
  repair: {
    label: POWERUP_META.repair.label,
    description: POWERUP_META.repair.description,
    color: POWERUP_META.repair.color,
    effectBadge: POWERUP_META.repair.effectBadge,
    powerUpId: 'repair',
  },
  credit: {
    label: POWERUP_META.credit.label,
    description: POWERUP_META.credit.description,
    color: POWERUP_META.credit.color,
    effectBadge: POWERUP_META.credit.effectBadge,
    powerUpId: 'credit',
  },
  hyper_turbine: {
    label: 'HYPER TURBINE',
    description: 'Instant +480 KM/H velocity surge for 3.2s with zero energy drain.',
    color: '#00f2fe',
    effectBadge: '+480 KM/H SURGE',
    powerUpId: 'boost',
  },
  plasma_shield: {
    label: 'PLASMA AEGIS',
    description: 'Restores +45 Energy and projects an invulnerable barrier for 5.0s.',
    color: '#34d399',
    effectBadge: 'SHIELD +45% HULL',
    powerUpId: 'shield',
  },
  emp_blast: {
    label: 'EMP SHOCKWAVE',
    description: 'Disrupts nearby rival craft turbines, cutting their speed by 35%.',
    color: '#c084fc',
    effectBadge: 'RIVAL EMP -35%',
    powerUpId: 'crystal',
  },
  overdrive_core: {
    label: 'OVERDRIVE CORE',
    description: 'Maxes Ring Chain x5 and locks unlimited boost for 4.0s.',
    color: '#fb923c',
    effectBadge: 'OVERDRIVE 4.0S',
    powerUpId: 'nitro',
  },
};

export const WEAPON_ITEMS_ORDER: ActiveWeaponId[] = [
  'missile',
  'laser',
  'shockwave',
  'mines',
];

export interface WeaponMetaSpec {
  id: ActiveWeaponId;
  number: 1 | 2 | 3 | 4;
  label: string;
  shortLabel: string;
  description: string;
  effectBadge: string;
  color: string;
  accentHex: number;
  glowHex: number;
}

export const WEAPON_META: Record<ActiveWeaponId, WeaponMetaSpec> = {
  missile: {
    id: 'missile',
    number: 1,
    label: 'HOMING MISSILE',
    shortLabel: 'MISSILE',
    description:
      'Weapon 1: Launches a guided plasma missile that locks onto the opponent in front and tracks them until impact.',
    effectBadge: 'TARGET LOCK · -34% HULL',
    color: '#ef4444',
    accentHex: 0xef4444,
    glowHex: 0xf97316,
  },
  laser: {
    id: 'laser',
    number: 2,
    label: 'FORWARD LASER',
    shortLabel: 'LASER BEAM',
    description:
      'Weapon 2: High-intensity laser beam directed forward for a short time, searing and slowing opponents ahead.',
    effectBadge: '1.8S BEAM · -34%/S HULL',
    color: '#f43f5e',
    accentHex: 0xf43f5e,
    glowHex: 0x00f2fe,
  },
  shockwave: {
    id: 'shockwave',
    number: 3,
    label: 'SHOCKWAVE',
    shortLabel: 'SHOCKWAVE',
    description:
      'Weapon 3: Electromagnetic shockwave that radiates outward from the craft and hits everyone within a 38m radius.',
    effectBadge: '38M RADIUS · -32% HULL',
    color: '#a855f7',
    accentHex: 0xa855f7,
    glowHex: 0x38bdf8,
  },
  mines: {
    id: 'mines',
    number: 4,
    label: 'PROXIMITY MINES',
    shortLabel: 'REAR MINES',
    description:
      'Weapon 4: Releases armed magnetic proximity mines from the rear of the vehicle onto the track to hit pursuers.',
    effectBadge: 'REAR DROP · -35% HULL',
    color: '#f59e0b',
    accentHex: 0xf59e0b,
    glowHex: 0xef4444,
  },
};

export const DEFAULT_UPGRADES: VehicleUpgrades = {
  topSpeedLevel: 0,
  nitroCapacityLevel: 0,
  handlingLevel: 0,
  shieldHullLevel: 0,
};

/**
 * Generates well-spaced on-track Fixed Speed Boost pads and Respawning Bonus / Weapon squares
 * with lowered, balanced density for both City and Lava circuits:
 * - City ('city' | 'city_v1', 9,800m): 24 total pads (8 Fixed Speed Boost pads + 8 Power-Up Bonus squares + 8 Weapon squares)
 * - Lava ('lava_v2' | 'lava', 9,600m): 15 total pads (5 Fixed Speed Boost pads + 5 Power-Up Bonus squares + 5 Weapon squares)
 * Fixed Speed Boost pads (`type === 'boost'`) stay permanently active on the track surface for all racers.
 * Bonus & Weapon squares (`type !== 'boost'`) disappear when collected by any racer and respawn after 10.0 seconds.
 */
export function createTrackPads(trackId: TrackId): TrackPad[] {
  const pads: TrackPad[] = [];
  const count = isCityTrack(trackId) ? 24 : 15;
  const bonusBoxCycle: PowerUpItemType[] = [
    'nitro',
    'crystal',
    'shield',
    'repair',
    'credit',
  ];
  const weaponCycle: ActiveWeaponId[] = [
    'missile',
    'laser',
    'shockwave',
    'mines',
  ];
  const lanePattern = [0.0, -0.46, 0.46, 0.0, 0.36, -0.36, 0.0, -0.28, 0.28];

  let bonusIdx = 0;
  let weaponIdx = 0;

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const laneOffset = lanePattern[i % lanePattern.length];

    // Pattern of 3:
    // - i % 3 === 0: Fixed Speed Boost Pad on the track surface (`type: 'boost', powerUpType: 'boost'`)
    // - i % 3 === 1: Respawning Power-Up / Bonus Square (`nitro`, `crystal`, `shield`, `repair`, `credit`)
    // - i % 3 === 2: Respawning Army / Weapon Square (`missile`, `laser`, `shockwave`, `mines`)
    if (i % 3 === 0) {
      pads.push({
        id: i,
        t,
        laneOffset: i % 6 === 0 ? 0.0 : laneOffset * 0.65,
        type: 'boost',
        powerUpType: 'boost',
      });
    } else if (i % 3 === 1) {
      const powerUpType = bonusBoxCycle[bonusIdx % bonusBoxCycle.length];
      bonusIdx++;
      const type: TrackPad['type'] = powerUpType === 'repair' ? 'recharge' : 'bonus';
      pads.push({
        id: i,
        t,
        laneOffset,
        type,
        powerUpType,
      });
    } else {
      const weaponType = weaponCycle[weaponIdx % weaponCycle.length];
      weaponIdx++;
      pads.push({
        id: i,
        t,
        laneOffset,
        type: 'weapon',
        weaponType,
      });
    }
  }
  return pads;
}

export function createEnergyRings(trackId: TrackId): EnergyRing[] {
  const rings: EnergyRing[] = [];
  const count = isCityTrack(trackId) ? 14 : 14;
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.42) / count) % 1;
    const colorType = i % 3 === 1 ? 'orange' : 'cyan';
    rings.push({ id: i, t, colorType });
  }
  return rings;
}

const CITY_CURVATURE_ANCHORS: Array<[number, number]> = [
  [0, 0],
  [-4, -140],
  [24, -290],
  [95, -420],
  [220, -490],
  [345, -390],
  [450, -260],
  [555, -145],
  [680, -25],
  [820, 95],
  [955, 190],
  [1085, 210],
  [1215, 225],
  [1315, 180],
  [1380, 90],
  [1420, -65],
  [1330, -195],
  [1170, -245],
  [1040, -165],
  [910, -240],
  [850, -395],
  [935, -545],
  [1095, -595],
  [1245, -520],
  [1310, -395],
  [1195, -295],
  [1015, -385],
  [835, -455],
  [675, -420],
  [555, -345],
  [450, -260],
  [355, -180],
  [280, -60],
  [285, 75],
  [335, 225],
  [240, 360],
  [90, 310],
  [18, 160],
];

const LAVA_CURVATURE_ANCHORS: Array<[number, number]> = [
  [0, 0],
  [-6, -155],
  [16, -310],
  [64, -455],
  [148, -555],
  [242, -575],
  [295, -495],
  [312, -395],
  [330, -295],
  [365, -215],
  [420, -140],
  [530, -30],
  [665, 85],
  [815, 195],
  [975, 275],
  [1135, 305],
  [1285, 275],
  [1405, 185],
  [1455, 55],
  [1395, -75],
  [1265, -125],
  [1125, -145],
  [1055, -265],
  [1165, -385],
  [1295, -485],
  [1355, -615],
  [1245, -725],
  [1095, -695],
  [945, -595],
  [805, -485],
  [665, -365],
  [535, -245],
  [420, -140],
  [315, -35],
  [310, 115],
  [245, 255],
  [115, 285],
  [22, 155],
];

/**
 * Estimates signed horizontal track curvature (-1.0 .. +1.0) at normalized spline position `t`.
 * Positive values indicate a right-hand bend; negative values indicate a left-hand bend.
 * Used so high-speed cornering exerts physical centrifugal pull requiring real steering and braking.
 */
export function estimateTrackCurvature(trackId: TrackId, t: number): number {
  const pts = isCityTrack(trackId) ? CITY_CURVATURE_ANCHORS : LAVA_CURVATURE_ANCHORS;
  const n = pts.length;
  const normT = ((t % 1) + 1) % 1;
  const exactIdx = normT * n;
  const i0 = Math.floor(exactIdx) % n;
  const iPrev = (i0 - 1 + n) % n;
  const iNext = (i0 + 1) % n;
  const iNext2 = (i0 + 2) % n;
  const frac = exactIdx - Math.floor(exactIdx);

  const sampleHeadingChange = (idxA: number, idxB: number, idxC: number): number => {
    const v1x = pts[idxB][0] - pts[idxA][0];
    const v1z = pts[idxB][1] - pts[idxA][1];
    const v2x = pts[idxC][0] - pts[idxB][0];
    const v2z = pts[idxC][1] - pts[idxB][1];
    const len1 = Math.hypot(v1x, v1z) || 1;
    const len2 = Math.hypot(v2x, v2z) || 1;
    // 2D cross product in XZ plane (forward is (vx, vz), right is (-vz, vx))
    const cross = (v1x * v2z - v1z * v2x) / (len1 * len2);
    return Math.max(-1, Math.min(1, cross * 1.65));
  };

  const c0 = sampleHeadingChange(iPrev, i0, iNext);
  const c1 = sampleHeadingChange(i0, iNext, iNext2);
  return c0 + (c1 - c0) * frac;
}

export function createInitialRacers(playerShipId: ShipId): RacerState[] {
  const aiNames = [
    { name: 'K. VANCE // NX-07', shipId: 'spectre' as ShipId },
    { name: 'S. TAKAHASHI // XR-0', shipId: 'nemesis' as ShipId },
    { name: 'M. VOLKOV // VX-09', shipId: 'seraph' as ShipId },
    { name: 'E. NOVA // AG-01', shipId: 'valkyrie' as ShipId },
    { name: 'R. DRAKE // V12-G', shipId: 'titan' as ShipId },
  ];

  const racers: RacerState[] = [];

  // Racers 1..3 ahead on grid (visible ahead on the sweeping curve!)
  for (let i = 0; i < 3; i++) {
    const startT = 0.018 - i * 0.0045;
    const lane = i === 0 ? -4.2 : i === 1 ? 5.6 : -6.4;
    racers.push({
      id: `ai-${i}`,
      name: aiNames[i].name,
      isPlayer: false,
      shipId: aiNames[i].shipId,
      t: (startT + 1) % 1,
      lap: 1,
      totalProgress: startT,
      lateralOffset: lane,
      lateralVelocity: 0,
      speedKmh: 0,
      energy: 100,
      nitroReserve: 30,
      crystalPoints: 0,
      crystalUpgradeLevel: 0,
      creditsEarned: 0,
      isBoosting: false,
      boostTimer: 0,
      nitroTimer: 0,
      shieldTimer: 0,
      empSlowTimer: 0,
      collisionCooldown: 0,
      wallHitCooldown: 0,
      rollAngle: 0,
      pitchAngle: 0,
      yawOffset: 0,
      ringChain: 0,
      ringChainTimer: 0,
      heldBonus: 'none',
      heldWeapon: 'none',
      laserActiveTimer: 0,
      shockwaveActiveTimer: 0,
      isDestroyed: false,
      destroyedTimer: 0,
      hitFlashTimer: 0,
      lastCollectedPowerUp: null,
      lastCollectedWeapon: null,
      lastCollectedTimer: 0,
      finished: false,
      finishTimeMs: 0,
      lapTimesMs: [],
      currentLapStartMs: 0,
      bestLapMs: null,
    });
  }

  // Player in 4th position on the starting grid (empty item slots ready to collect on track)
  racers.push({
    id: 'player',
    name: SHIP_SPECS[playerShipId].name,
    isPlayer: true,
    shipId: playerShipId,
    t: 0.002,
    lap: 1,
    totalProgress: 0.002,
    lateralOffset: 2.2,
    lateralVelocity: 0,
    speedKmh: 0,
    energy: 100,
    nitroReserve: 35,
    crystalPoints: 0,
    crystalUpgradeLevel: 0,
    creditsEarned: 0,
    isBoosting: false,
    boostTimer: 0,
    nitroTimer: 0,
    shieldTimer: 0,
    empSlowTimer: 0,
    collisionCooldown: 0,
    wallHitCooldown: 0,
    rollAngle: 0,
    pitchAngle: 0,
    yawOffset: 0,
    ringChain: 0,
    ringChainTimer: 0,
    heldBonus: 'none',
    heldWeapon: 'none',
    laserActiveTimer: 0,
    shockwaveActiveTimer: 0,
    isDestroyed: false,
    destroyedTimer: 0,
    hitFlashTimer: 0,
    lastCollectedPowerUp: null,
    lastCollectedWeapon: null,
    lastCollectedTimer: 0,
    finished: false,
    finishTimeMs: 0,
    lapTimesMs: [],
    currentLapStartMs: 0,
    bestLapMs: null,
  });

  // Racers 5..6 behind on the grid in wide outer lanes (-8.8m and +8.8m) so they have a clear launch corridor and never rear-end a stationary player
  const rearLanes = [-8.8, 8.8];
  for (let i = 3; i < 5; i++) {
    const startT = 0.978 - (i - 3) * 0.012;
    const lane = rearLanes[i - 3];
    racers.push({
      id: `ai-${i}`,
      name: aiNames[i].name,
      isPlayer: false,
      shipId: aiNames[i].shipId,
      t: startT,
      lap: 1,
      totalProgress: startT - 1, // behind start line
      lateralOffset: lane,
      lateralVelocity: 0,
      speedKmh: 0,
      energy: 100,
      nitroReserve: 30,
      crystalPoints: 0,
      crystalUpgradeLevel: 0,
      creditsEarned: 0,
      isBoosting: false,
      boostTimer: 0,
      nitroTimer: 0,
      shieldTimer: 0,
      empSlowTimer: 0,
      collisionCooldown: 0,
      wallHitCooldown: 0,
      rollAngle: 0,
      pitchAngle: 0,
      yawOffset: 0,
      ringChain: 0,
      ringChainTimer: 0,
      heldBonus: 'none',
      heldWeapon: 'none',
      laserActiveTimer: 0,
      shockwaveActiveTimer: 0,
      isDestroyed: false,
      destroyedTimer: 0,
      hitFlashTimer: 0,
      lastCollectedPowerUp: null,
      lastCollectedWeapon: null,
      lastCollectedTimer: 0,
      finished: false,
      finishTimeMs: 0,
      lapTimesMs: [],
      currentLapStartMs: 0,
      bestLapMs: null,
    });
  }

  return racers;
}

export interface PlayerInputState {
  throttle: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  airbrakeLeft: boolean;
  airbrakeRight: boolean;
  boostHeld: boolean;
  useBonusPressed: boolean;
  useWeaponPressed?: boolean;
}

export interface StepRacerResult {
  hitBoostPad: boolean;
  hitRechargePad: boolean;
  collectedBonus: BonusType | null;
  collectedPowerUp: PowerUpItemType | null;
  collectedWeapon: ActiveWeaponId | null;
  collectedPadId: number | null;
  passedRing: 'cyan' | 'orange' | null;
  activatedBonus: BonusType | null;
  firedWeapon: ActiveWeaponId | null;
  wallCollision: boolean;
  exploded: boolean;
  completedLap: boolean;
  raceFinished: boolean;
}

/**
 * Advances a racer's physics, vehicle hull energy, boost, power-up & weapon boxes,
 * weather friction, and spline position by dt seconds.
 */
export function stepRacerPhysics(
  racer: RacerState,
  input: PlayerInputState,
  dt: number,
  trackLengthMeters: number,
  totalLaps: number,
  settings: GameSettings,
  pads: TrackPad[],
  rings: EnergyRing[],
  elapsedRaceMs: number,
  weather?: WeatherState,
  upgrades?: VehicleUpgrades,
  disabledPadIds?: Set<number>
): StepRacerResult {
  const result: StepRacerResult = {
    hitBoostPad: false,
    hitRechargePad: false,
    collectedBonus: null,
    collectedPowerUp: null,
    collectedWeapon: null,
    collectedPadId: null,
    passedRing: null,
    activatedBonus: null,
    firedWeapon: null,
    wallCollision: false,
    exploded: false,
    completedLap: false,
    raceFinished: false,
  };

  if (racer.isDestroyed) {
    racer.speedKmh = 0;
    racer.isBoosting = false;
    if (!racer.isPlayer && racer.destroyedTimer > 0) {
      racer.destroyedTimer = Math.max(0, racer.destroyedTimer - dt);
      if (racer.destroyedTimer === 0) {
        // Respawn AI racer with restored hull after explosion sequence
        racer.isDestroyed = false;
        racer.energy = 100;
        racer.shieldTimer = 2.5;
        racer.speedKmh = 360;
      }
    }
    return result;
  }

  if (racer.finished) {
    // Cruise smoothly after finishing
    racer.speedKmh = Math.max(320, racer.speedKmh * (1 - 1.2 * dt));
    const metersPerSec = (racer.speedKmh / 3.6) * 0.42;
    const deltaT = (metersPerSec * dt) / trackLengthMeters;
    racer.t = (racer.t + deltaT) % 1;
    racer.totalProgress += deltaT;
    return result;
  }

  const spec = SHIP_SPECS[racer.shipId];
  const surfaceGrip = weather ? weather.surfaceGrip : 1.0;
  const weatherIntensity = weather ? weather.intensity : 0.0;
  const upg = upgrades ?? DEFAULT_UPGRADES;

  // Timers decay
  if (racer.boostTimer > 0) {
    racer.boostTimer = Math.max(0, racer.boostTimer - dt);
  }
  if (racer.nitroTimer > 0) {
    racer.nitroTimer = Math.max(0, racer.nitroTimer - dt);
  }
  if (racer.shieldTimer > 0) {
    racer.shieldTimer = Math.max(0, racer.shieldTimer - dt);
  }
  if (racer.empSlowTimer > 0) {
    racer.empSlowTimer = Math.max(0, racer.empSlowTimer - dt);
  }
  if (racer.collisionCooldown > 0) {
    racer.collisionCooldown = Math.max(0, racer.collisionCooldown - dt);
  }
  if (racer.wallHitCooldown > 0) {
    racer.wallHitCooldown = Math.max(0, racer.wallHitCooldown - dt);
  }
  if (racer.laserActiveTimer > 0) {
    racer.laserActiveTimer = Math.max(0, racer.laserActiveTimer - dt);
  }
  if (racer.shockwaveActiveTimer > 0) {
    racer.shockwaveActiveTimer = Math.max(0, racer.shockwaveActiveTimer - dt);
  }
  if (racer.hitFlashTimer > 0) {
    racer.hitFlashTimer = Math.max(0, racer.hitFlashTimer - dt);
  }
  if (racer.lastCollectedTimer > 0) {
    racer.lastCollectedTimer = Math.max(0, racer.lastCollectedTimer - dt);
    if (racer.lastCollectedTimer === 0) {
      racer.lastCollectedPowerUp = null;
      racer.lastCollectedWeapon = null;
    }
  }
  if (racer.ringChainTimer > 0) {
    racer.ringChainTimer = Math.max(0, racer.ringChainTimer - dt);
    if (racer.ringChainTimer === 0) {
      racer.ringChain = 0;
    }
  }

  // Fire Held Weapon when pressing [Z] (useWeaponPressed)
  if (input.useWeaponPressed && racer.heldWeapon !== 'none') {
    const weapon = racer.heldWeapon;
    racer.heldWeapon = 'none';
    result.firedWeapon = weapon;

    if (weapon === 'laser') {
      racer.laserActiveTimer = 1.8;
    } else if (weapon === 'shockwave') {
      racer.shockwaveActiveTimer = 0.95;
    }
  }

  // Activate In-Game Power-Up Box module with [SPACE] (or Nitro Reserve if box is empty)
  if (input.useBonusPressed) {
    if (racer.heldBonus !== 'none') {
      const bonus = racer.heldBonus;
      racer.heldBonus = 'none';
      result.activatedBonus = bonus;

      const shieldBonusDur = upg.shieldHullLevel * 0.5;
      const nitroBonusDur = upg.nitroCapacityLevel * 0.35;

      if (bonus === 'hyper_turbine' || bonus === 'boost') {
        racer.boostTimer = Math.max(racer.boostTimer, 3.0);
        racer.speedKmh = Math.min(spec.maxSpeedKmh + spec.boostPower + 120, racer.speedKmh + 55);
      } else if (bonus === 'nitro') {
        racer.nitroTimer = Math.max(racer.nitroTimer, 4.0 + nitroBonusDur);
        racer.boostTimer = Math.max(racer.boostTimer, 4.0 + nitroBonusDur);
        racer.nitroReserve = Math.max(0, racer.nitroReserve - 25);
        racer.speedKmh = Math.min(spec.maxSpeedKmh + spec.boostPower + 140, racer.speedKmh + 65);
      } else if (bonus === 'plasma_shield' || bonus === 'shield') {
        racer.energy = Math.min(100, racer.energy + 35);
        racer.shieldTimer = Math.max(racer.shieldTimer, 6.0 + shieldBonusDur);
      } else if (bonus === 'repair') {
        racer.energy = Math.min(100, racer.energy + 50);
        racer.empSlowTimer = 0;
        racer.boostTimer = Math.max(racer.boostTimer, 1.5);
      } else if (bonus === 'crystal' || bonus === 'overdrive_core') {
        racer.ringChain = 5;
        racer.ringChainTimer = 7.0;
        racer.boostTimer = Math.max(racer.boostTimer, 3.8);
        racer.energy = Math.min(100, racer.energy + 25);
        racer.crystalPoints += 500;
        racer.crystalUpgradeLevel = Math.min(5, racer.crystalUpgradeLevel + 1);
      } else if (bonus === 'credit') {
        racer.creditsEarned += 200;
        racer.boostTimer = Math.max(racer.boostTimer, 2.0);
        racer.speedKmh = Math.min(spec.maxSpeedKmh + spec.boostPower + 90, racer.speedKmh + 45);
      } else if (bonus === 'emp_blast') {
        racer.boostTimer = Math.max(racer.boostTimer, 1.2);
      }
    } else if (racer.nitroReserve >= 25) {
      // Allow spending collected Nitro Reserve directly when the In-Game Box slot is empty
      racer.nitroReserve = Math.max(0, racer.nitroReserve - 35);
      const nitroBonusDur = upg.nitroCapacityLevel * 0.35;
      racer.nitroTimer = Math.max(racer.nitroTimer, 3.2 + nitroBonusDur);
      racer.boostTimer = Math.max(racer.boostTimer, 3.2 + nitroBonusDur);
      racer.speedKmh = Math.min(spec.maxSpeedKmh + spec.boostPower + 120, racer.speedKmh + 52);
      result.activatedBonus = 'nitro';
    }
  }

  // Manual boost consumption (draws down to 20% safety reserve so only edge/guardrail impacts or weapon hits can destroy hull)
  const canManualBoost = racer.energy > 20;
  const manualBoosting = input.boostHeld && canManualBoost;

  if (manualBoosting) {
    const drainRate = racer.shieldTimer > 0 || racer.nitroTimer > 0 ? 4 : 13;
    racer.energy = Math.max(20, racer.energy - drainRate * dt);
  }

  const isAccelerating =
    input.throttle || input.boostHeld || (racer.isPlayer && settings.autoAccelerate);

  // If the player is NOT pressing throttle or boost (and did not just activate a bonus),
  // rapidly bleed off any residual pad boostTimer so the vehicle never drives itself when idle!
  if (racer.isPlayer && !isAccelerating && !manualBoosting && !input.useBonusPressed) {
    racer.boostTimer = Math.max(0, racer.boostTimer - dt * 2.8);
    racer.nitroTimer = Math.max(0, racer.nitroTimer - dt * 2.2);
  }

  const wantsDrivePower = racer.isPlayer
    ? isAccelerating || manualBoosting || input.useBonusPressed
    : isAccelerating || manualBoosting || racer.boostTimer > 0 || racer.nitroTimer > 0;

  racer.isBoosting =
    manualBoosting ||
    (wantsDrivePower && (racer.boostTimer > 0 || racer.nitroTimer > 0));

  // AI Difficulty Profile scaling for computer-controlled racers (Novice, Professional, Apex)
  const aiProfile = !racer.isPlayer ? getAiDifficultyProfile(settings.aiDifficulty) : null;
  const aiSpeedMult = aiProfile ? aiProfile.speedFactor : 1.0;
  const aiAccelMult = aiProfile ? aiProfile.accelFactor : 1.0;

  // Calculate effective max speed (with Ring Chain bonus, Crystal Upgrade bonus, Equipment Upgrade bonus, and boost)
  const chainSpeedBonus = racer.ringChain * 22; // Up to +110 KM/H at x5 chain
  const crystalSpeedBonus = racer.crystalUpgradeLevel * 12; // Up to +60 KM/H at Lv.5
  const equipSpeedBonus = racer.isPlayer ? upg.topSpeedLevel * 14 : 0;
  const equipBoostBonus = racer.isPlayer ? upg.nitroCapacityLevel * 14 : 0;
  const nitroActiveBonus = racer.nitroTimer > 0 ? 60 : 0;
  const boostSpeedBonus = racer.isBoosting
    ? spec.boostPower + equipBoostBonus + nitroActiveBonus
    : 0;
  const empPenalty = racer.empSlowTimer > 0 && racer.shieldTimer <= 0 ? 0.65 : 1.0;
  const stormDragFactor = 1.0 - weatherIntensity * 0.035;

  const baseCruiseSpeed =
    (spec.maxSpeedKmh + chainSpeedBonus + crystalSpeedBonus + equipSpeedBonus) *
    aiSpeedMult *
    empPenalty *
    stormDragFactor;
  const effectiveMaxSpeed =
    (spec.maxSpeedKmh + chainSpeedBonus + crystalSpeedBonus + equipSpeedBonus + boostSpeedBonus) *
    aiSpeedMult *
    empPenalty *
    stormDragFactor;

  // Progressive Multi-Stage Acceleration & Granular Speed Calibration:
  // From a standstill (0 KM/H), the vehicle spools up smoothly through launch, mid-range, and top-end bands.
  // When the player does nothing (neither throttle nor boost is held), the vehicle decelerates to a complete stop (0 KM/H).
  if (input.brake && !manualBoosting) {
    // Active braking for corner entry (braking distance lengthens slightly on wet/ash-slicked surfaces)
    const brakeEfficiency = 0.78 + 0.22 * surfaceGrip;
    racer.speedKmh = Math.max(
      0,
      racer.speedKmh - spec.acceleration * 2.25 * brakeEfficiency * dt
    );
  } else if (wantsDrivePower) {
    const speedRatio = Math.max(0, Math.min(1.25, racer.speedKmh / Math.max(1, baseCruiseSpeed)));
    // Progressive torque envelope:
    // - 0.00..0.22 (0..~175 KM/H): Responsive, progressive launch traction from a standstill (0.72 -> 0.96)
    // - 0.22..0.65 (~175..~510 KM/H): Strong mid-range turbine pull (0.96 -> 1.04)
    // - 0.65..1.00 (~510..maxSpeed): Gradual aerodynamic taper (1.04 -> 0.36) so top speed is earned progressively
    let progressiveBandMult = 1.0;
    if (speedRatio < 0.22) {
      progressiveBandMult = 0.72 + (speedRatio / 0.22) * 0.24;
    } else if (speedRatio < 0.65) {
      progressiveBandMult = 0.96 + ((speedRatio - 0.22) / 0.43) * 0.08;
    } else {
      const highFrac = Math.min(1.0, (speedRatio - 0.65) / 0.35);
      progressiveBandMult = 1.04 - highFrac * 0.68;
    }

    const baseAccelRate =
      spec.acceleration *
      progressiveBandMult *
      aiAccelMult *
      (0.88 + 0.12 * surfaceGrip);

    // Progressive Boost / Nitro thrust surge on top of standard turbine acceleration
    const boostThrustBonus = racer.isBoosting
      ? (spec.boostPower * 1.15 + (racer.nitroTimer > 0 ? 75 : 0)) * aiAccelMult
      : 0;

    const totalAccelRate = baseAccelRate + boostThrustBonus;

    if (racer.speedKmh < effectiveMaxSpeed) {
      racer.speedKmh = Math.min(effectiveMaxSpeed, racer.speedKmh + totalAccelRate * dt);
    } else {
      // Smooth aerodynamic decay when boost expires above normal cruise speed
      racer.speedKmh = Math.max(effectiveMaxSpeed, racer.speedKmh - 195 * dt);
    }
  } else {
    // Natural aerodynamic coasting drag when off throttle — brings the vehicle to a complete 0 KM/H stop when idle
    const coastDrag = 215 + (racer.speedKmh / 750) * 105 + weatherIntensity * 30;
    racer.speedKmh = Math.max(0, racer.speedKmh - coastDrag * dt);
  }

  // Airbrake cornering drag: applying Q or E scrubs a controlled amount of speed to tuck the nose into tight hairpins
  if ((input.airbrakeLeft || input.airbrakeRight) && racer.speedKmh > 260) {
    const dualAirbrake = input.airbrakeLeft && input.airbrakeRight;
    const airbrakeDrag = dualAirbrake ? 190 : 58;
    racer.speedKmh = Math.max(240, racer.speedKmh - airbrakeDrag * dt);
  }

  // Absolute aerodynamic ceiling so stacked pads/modules stay controllable
  racer.speedKmh = Math.min(1180, racer.speedKmh);

  // Full-Roadway Direct Velocity-Targeted Steering & Cornering Physics:
  // Players steer across the entire 27m roadway width (-11.85m to +11.85m across all 4 lanes)
  // with immediate turn-in response and crisp lane-lock when releasing the steering key (no slippery wall pinballing).
  let steerDir = 0;
  if (input.steerLeft) steerDir -= 1;
  if (input.steerRight) steerDir += 1;

  let airbrakeDir = 0;
  if (input.airbrakeLeft) airbrakeDir -= 0.45;
  if (input.airbrakeRight) airbrakeDir += 0.45;

  const combinedSteer = steerDir + airbrakeDir;
  const sensitivity = racer.isPlayer ? settings.steerSensitivity : 1.0;
  const handlingUpgradeMult =
    1.0 +
    racer.crystalUpgradeLevel * 0.025 +
    (racer.isPlayer ? upg.handlingLevel * 0.035 : 0);
  const gripSteerFactor = 0.85 + 0.15 * surfaceGrip;
  // Trail-braking or feathering throttle increases front-end turn-in bite
  const trailBrakeTurnInBonus = input.brake ? 1.16 : !isAccelerating ? 1.06 : 1.0;

  // Forward speed scaling so steering works smoothly at low speed and reaches full authority at racing speed
  const speedSteerScale =
    racer.speedKmh > 2 ? Math.min(1.05, 0.42 + (racer.speedKmh / 420) * 0.63) : 0;
  const maxLateralSpeed =
    21.8 *
    (0.72 + 0.28 * spec.handling) *
    handlingUpgradeMult *
    sensitivity *
    gripSteerFactor *
    trailBrakeTurnInBonus *
    speedSteerScale;

  // Bounded curvature-induced centrifugal drift on corners:
  // Gently drifts an unsteered vehicle outward on curves so it never feels locked to a center rail,
  // while remaining bounded (~1.5..3.8 m/s) so it never yanks the player uncontrollably into guardrails.
  const signedCurvature = estimateTrackCurvature(settings.trackId, racer.t);
  const cornerSpeedNorm = Math.min(1.25, racer.speedKmh / 620);
  const centrifugalDriftVel =
    (-signedCurvature *
      cornerSpeedNorm *
      (0.38 + 0.62 * cornerSpeedNorm) *
      (racer.isPlayer ? 4.2 : 3.2)) /
    Math.max(0.85, spec.handling * 0.92);

  if (combinedSteer !== 0) {
    // Active steering command: smoothly & rapidly converge lateralVelocity to the commanded lane-change speed
    const targetLateralVel = combinedSteer * maxLateralSpeed + centrifugalDriftVel * 0.25;
    const isCounterSteering =
      racer.lateralVelocity !== 0 &&
      Math.sign(combinedSteer) !== Math.sign(racer.lateralVelocity);
    const steerResponseRate = (isCounterSteering ? 22.0 : 16.5) + 4.5 * surfaceGrip;
    racer.lateralVelocity +=
      (targetLateralVel - racer.lateralVelocity) * (1 - Math.exp(-steerResponseRate * dt));
  } else {
    // Steering released: decay existing lateral slide rapidly (surfaceGrip-dependent) toward natural corner drift
    const releaseDecayRate = 6.2 + 5.8 * surfaceGrip;
    const decayFactor = Math.exp(-releaseDecayRate * dt);
    racer.lateralVelocity =
      racer.lateralVelocity * decayFactor + centrifugalDriftVel * (1 - decayFactor);
  }
  racer.lateralOffset += racer.lateralVelocity * dt;

  // Track Edge & Guardrail Collision / Scraping Detection:
  // Full playable roadway spans from -11.85m to +11.85m (23.7m of free lateral travel across the 27m road deck).
  // Touching the outer guardrails smoothly slides along the barrier and decreases vehicle energy (unless Shield is active).
  const maxOffset = TRACK_HALF_WIDTH - 1.65; // 11.85m on 13.5m half-width road

  const driftSlipFactor = 1.0 + (1.0 - surfaceGrip) * 0.35;
  let targetRoll = Math.max(
    -0.52,
    Math.min(0.52, -combinedSteer * 0.38 - signedCurvature * cornerSpeedNorm * 0.1)
  );
  let targetYaw = Math.max(
    -0.44,
    Math.min(
      0.44,
      (-combinedSteer * 0.22 - airbrakeDir * 0.14 - racer.lateralVelocity * 0.0035) * driftSlipFactor
    )
  );

  if (Math.abs(racer.lateralOffset) > maxOffset) {
    const wallSide = Math.sign(racer.lateralOffset) || 1;
    const impactSpeedRatio = Math.max(0.35, Math.min(1.4, racer.speedKmh / 760));
    const latImpactVel = Math.abs(racer.lateralVelocity);
    // Keep vehicle cleanly at the outer lane edge without bouncing/pinballing back across the track
    racer.lateralOffset = wallSide * (maxOffset - 0.02);
    const steeringIntoWall = Math.sign(combinedSteer) === wallSide;
    racer.lateralVelocity = steeringIntoWall ? 0 : -wallSide * Math.min(1.4, latImpactVel * 0.15);

    // Time-scaled wall friction (instead of harsh per-frame multiplier) so scraping a barrier stays playable
    const wallDragDecel = racer.shieldTimer > 0 ? 14 : 72;
    racer.speedKmh = Math.max(0, racer.speedKmh - wallDragDecel * dt);
    racer.yawOffset *= 0.5;
    racer.rollAngle = -wallSide * 0.18;
    targetRoll = -wallSide * 0.18;
    targetYaw = -wallSide * 0.04;

    if (racer.shieldTimer <= 0 && racer.speedKmh > 40) {
      const hullProtection = racer.isPlayer ? 1.0 - upg.shieldHullLevel * 0.08 : 1.0;
      if (racer.wallHitCooldown <= 0) {
        const impactDmg =
          (6.5 + impactSpeedRatio * 4.2 + Math.min(3.0, latImpactVel * 0.12)) * hullProtection;
        racer.energy = Math.max(0, racer.energy - impactDmg);
        racer.wallHitCooldown = 0.65;
        racer.hitFlashTimer = 0.3;
      }
      // Sustained guardrail scraping drain
      racer.energy = Math.max(0, racer.energy - 8.5 * hullProtection * dt);
    }
    result.wallCollision = true;
  }

  // Check if energy reached zero from guardrail / edge damage -> Vehicle Explodes!
  if (racer.energy <= 0) {
    racer.energy = 0;
    racer.isDestroyed = true;
    racer.destroyedTimer = 3.5;
    racer.speedKmh = 0;
    racer.isBoosting = false;
    result.exploded = true;
    return result;
  }

  racer.rollAngle += (targetRoll - racer.rollAngle) * (1 - Math.exp(-10 * dt));
  racer.yawOffset += (targetYaw - racer.yawOffset) * (1 - Math.exp(-10 * dt));
  const targetPitch = racer.isBoosting ? 0.045 : input.brake ? -0.035 : isAccelerating ? 0.015 : -0.015;
  racer.pitchAngle += (targetPitch - racer.pitchAngle) * (1 - Math.exp(-8 * dt));

  // Advance along spline
  const prevT = racer.t;
  const worldMetersPerSec = (racer.speedKmh / 3.6) * 0.48;
  const deltaT = (worldMetersPerSec * dt) / trackLengthMeters;
  const nextTUnwrapped = prevT + deltaT;
  if (deltaT > 0) {
    racer.t = ((nextTUnwrapped % 1) + 1) % 1;
    racer.totalProgress += deltaT;
  }

  // Check Fixed On-Track Speed Boost Pads & 10-Second Respawning Bonus/Weapon Squares
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    const isFixedBoostPad = pad.type === 'boost' || pad.powerUpType === 'boost';

    // Fixed Speed Boost pads NEVER disable — every racer passing over them gets the boost!
    // Respawning Bonus & Weapon squares (`!isFixedBoostPad`) respect `disabledPadIds` (10s respawn timer).
    if (!isFixedBoostPad && disabledPadIds && disabledPadIds.has(pad.id)) {
      continue;
    }

    if (didCrossSplinePoint(prevT, nextTUnwrapped, pad.t)) {
      const padWorldX = pad.laneOffset * (TRACK_HALF_WIDTH - 2.2);
      if (Math.abs(racer.lateralOffset - padWorldX) < 3.85) {
        if (isFixedBoostPad) {
          // Only trigger boost pad surge if the racer is actively driving or coasting above 25 KM/H
          if (racer.isPlayer && !wantsDrivePower && racer.speedKmh < 25) {
            continue;
          }
          // FIXED SPEED BOOST PAD ON TRACK:
          // Always active for every racer who drives over it, triggers progressive boost acceleration,
          // and never despawns (`collectedPadId` remains null).
          racer.boostTimer = Math.max(racer.boostTimer, 1.65);
          if (!racer.isPlayer || wantsDrivePower) {
            racer.speedKmh = Math.min(
              spec.maxSpeedKmh + spec.boostPower + 90,
              racer.speedKmh + 52
            );
          }
          racer.energy = Math.min(100, racer.energy + 6);
          result.hitBoostPad = true;
          result.collectedPowerUp = 'boost';
          racer.lastCollectedPowerUp = 'boost';
          racer.lastCollectedWeapon = null;
          racer.lastCollectedTimer = 2.0;
          continue;
        }

        if (pad.type === 'weapon') {
          // RESPAWNING ARMY / WEAPON SQUARE (10s respawn when taken by any racer):
          // You keep the weapon recovered until you use it with [Z], and until it is used, you cannot take another!
          if (racer.heldWeapon !== 'none') {
            continue;
          }
          const wType: ActiveWeaponId =
            pad.weaponType ?? WEAPON_ITEMS_ORDER[pad.id % WEAPON_ITEMS_ORDER.length];
          racer.heldWeapon = wType;
          racer.lastCollectedWeapon = wType;
          racer.lastCollectedPowerUp = null;
          racer.lastCollectedTimer = 2.6;
          result.collectedWeapon = wType;
          result.collectedPadId = pad.id;
          continue;
        }

        const pType: PowerUpItemType =
          pad.powerUpType ??
          (pad.type === 'recharge'
            ? 'repair'
            : POWERUP_ITEMS_ORDER[(pad.id + racer.lap) % POWERUP_ITEMS_ORDER.length]);

        // Single-slot lock: if already holding an unconsumed power-up in heldBonus, cannot take another holdable box until used!
        if (racer.heldBonus !== 'none' && pType !== 'repair' && pType !== 'credit') {
          continue;
        }

        result.collectedPowerUp = pType;
        result.collectedPadId = pad.id;
        racer.lastCollectedPowerUp = pType;
        racer.lastCollectedWeapon = null;
        racer.lastCollectedTimer = 2.6;

        if (pType === 'nitro') {
          // NITRO POWER-UP — Compact canister filled with glowing blue fuel adding to Nitro reserve
          racer.nitroReserve = Math.min(100, racer.nitroReserve + 45);
          racer.energy = Math.min(100, racer.energy + 8);
          racer.heldBonus = 'nitro';
          result.collectedBonus = 'nitro';
        } else if (pType === 'crystal') {
          // CRYSTAL BONUS — Sharp faceted magenta crystal granting bonus points & upgrade level
          racer.crystalPoints += 500;
          racer.crystalUpgradeLevel = Math.min(5, racer.crystalUpgradeLevel + 1);
          racer.energy = Math.min(100, racer.energy + 10);
          racer.boostTimer = Math.max(racer.boostTimer, 0.9);
          if (racer.heldBonus === 'none') {
            racer.heldBonus = 'crystal';
            result.collectedBonus = 'crystal';
          }
        } else if (pType === 'shield') {
          // SHIELD POWER-UP — Blue-violet orb with hexagonal energy grid activating temporary shield
          const shieldBonusDur = racer.isPlayer ? upg.shieldHullLevel * 0.5 : 0;
          racer.shieldTimer = Math.max(racer.shieldTimer, 5.5 + shieldBonusDur);
          racer.energy = Math.min(100, racer.energy + 14);
          if (racer.heldBonus === 'none') {
            racer.heldBonus = 'shield';
            result.collectedBonus = 'shield';
          }
        } else if (pType === 'repair') {
          // REPAIR POWER-UP — Dark-metal crate with cyan medical cross restoring vehicle health
          racer.energy = Math.min(100, racer.energy + 65);
          racer.empSlowTimer = 0;
          result.hitRechargePad = true;
          if (racer.heldBonus === 'none') {
            racer.heldBonus = 'repair';
            result.collectedBonus = 'repair';
          }
        } else if (pType === 'credit') {
          // CREDIT BONUS — Gold-edged token with raised central emblem earning credits for upgrades
          racer.creditsEarned += 150;
          racer.energy = Math.min(100, racer.energy + 8);
          racer.speedKmh = Math.min(
            spec.maxSpeedKmh + spec.boostPower + 80,
            racer.speedKmh + 40
          );
          if (racer.heldBonus === 'none') {
            racer.heldBonus = 'credit';
            result.collectedBonus = 'credit';
          }
        }
      }
    }
  }

  // Check overhead Energy Ring gates
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (didCrossSplinePoint(prevT, nextTUnwrapped, ring.t)) {
      racer.ringChain = Math.min(5, racer.ringChain + 1);
      racer.ringChainTimer = 6.5;
      racer.energy = Math.min(100, racer.energy + (ring.colorType === 'orange' ? 10 : 6));
      racer.nitroReserve = Math.min(100, racer.nitroReserve + (ring.colorType === 'orange' ? 12 : 6));
      if (ring.colorType === 'orange') {
        racer.boostTimer = Math.max(racer.boostTimer, 0.8);
      }
      result.passedRing = ring.colorType;
    }
  }

  // Check lap completion (crossing t = 0 when totalProgress >= lap)
  const expectedLap = Math.floor(racer.totalProgress) + 1;
  if (expectedLap > racer.lap && racer.totalProgress >= 0.95) {
    const lapDuration = Math.max(1000, elapsedRaceMs - racer.currentLapStartMs);
    racer.lapTimesMs.push(lapDuration);
    racer.currentLapStartMs = elapsedRaceMs;
    if (racer.bestLapMs === null || lapDuration < racer.bestLapMs) {
      racer.bestLapMs = lapDuration;
    }
    result.completedLap = true;

    if (expectedLap > totalLaps) {
      racer.lap = totalLaps;
      racer.finished = true;
      racer.finishTimeMs = elapsedRaceMs;
      result.raceFinished = true;
    } else {
      racer.lap = expectedLap;
    }
  }

  return result;
}

/**
 * Finds the best opponent ahead of `shooter` for Homing Missile lock-on.
 */
export function findOpponentInFront(
  shooter: RacerState,
  racers: RacerState[]
): RacerState | null {
  let bestTarget: RacerState | null = null;
  let bestForwardDelta = Infinity;

  for (let i = 0; i < racers.length; i++) {
    const other = racers[i];
    if (other.id === shooter.id || other.finished || other.isDestroyed) continue;
    const dT = ((other.t - shooter.t) % 1 + 1) % 1;
    // Prefer opponents ahead along the track spline within 0.001..0.55
    if (dT > 0.0005 && dT < 0.55 && dT < bestForwardDelta) {
      bestForwardDelta = dT;
      bestTarget = other;
    }
  }

  if (!bestTarget) {
    // Fallback to any active opponent ahead in race standings or closest along spline
    for (let i = 0; i < racers.length; i++) {
      const other = racers[i];
      if (other.id === shooter.id || other.finished || other.isDestroyed) continue;
      const dT = ((other.t - shooter.t) % 1 + 1) % 1;
      if (dT < bestForwardDelta) {
        bestForwardDelta = dT;
        bestTarget = other;
      }
    }
  }

  return bestTarget;
}

export interface WeaponCombatEvent {
  type:
    | 'missile_launched'
    | 'missile_hit'
    | 'missile_shielded'
    | 'laser_hit'
    | 'laser_shielded'
    | 'shockwave_fired'
    | 'shockwave_hit'
    | 'shockwave_shielded'
    | 'mine_dropped'
    | 'mine_hit'
    | 'mine_shielded'
    | 'vehicle_exploded';
  weapon: ActiveWeaponId;
  attackerId: string;
  attackerName: string;
  targetId?: string;
  targetName?: string;
  t: number;
  lateralOffset: number;
  damage: number;
}

/**
 * Advances all 4 Weapons (Homing Missile, Forward Laser, Radial Shockwave, Rear Proximity Mines),
 * enforces Shield protection (`shieldTimer > 0`), applies hull energy damage, and triggers
 * vehicle explosions when `energy` reaches 0.
 */
export function stepWeaponCombat(
  racers: RacerState[],
  missiles: ActiveMissile[],
  mines: ActiveMine[],
  newlyFired: Array<{ attackerId: string; weapon: ActiveWeaponId }>,
  dt: number,
  trackLengthMeters: number
): WeaponCombatEvent[] {
  const events: WeaponCombatEvent[] = [];
  const worldSplineLengthM = trackLengthMeters * 0.46;
  const SHOCKWAVE_RADIUS_M = 38.0;
  const LASER_RANGE_M = 95.0;
  const LASER_CORRIDOR_WIDTH_M = 3.2;

  const applyHullDamage = (
    victim: RacerState,
    attacker: RacerState | undefined,
    weapon: ActiveWeaponId,
    damage: number
  ) => {
    const prevDestroyed = victim.isDestroyed;
    victim.energy = Math.max(0, victim.energy - damage);
    victim.hitFlashTimer = Math.max(victim.hitFlashTimer, 0.55);
    if (victim.energy <= 0 && !prevDestroyed) {
      victim.energy = 0;
      victim.isDestroyed = true;
      victim.destroyedTimer = 3.5;
      victim.speedKmh = 0;
      victim.isBoosting = false;
      events.push({
        type: 'vehicle_exploded',
        weapon,
        attackerId: attacker ? attacker.id : 'hazard',
        attackerName: attacker ? attacker.name.split(' //')[0] : 'TRACK HAZARD',
        targetId: victim.id,
        targetName: victim.name.split(' //')[0],
        t: victim.t,
        lateralOffset: victim.lateralOffset,
        damage,
      });
    }
  };

  // 1. Process newly fired weapons this step
  for (let f = 0; f < newlyFired.length; f++) {
    const { attackerId, weapon } = newlyFired[f];
    const attacker = racers.find((r) => r.id === attackerId);
    if (!attacker || attacker.isDestroyed) continue;
    const shortAttacker = attacker.name.split(' //')[0];

    if (weapon === 'missile') {
      // Weapon 1: Homing Missile — locks onto opponent in front and launches
      const target = findOpponentInFront(attacker, racers);
      missiles.push({
        id: Math.floor(Math.random() * 1e9),
        ownerId: attacker.id,
        targetId: target ? target.id : null,
        t: ((attacker.t + 0.0022) % 1 + 1) % 1,
        lateralOffset: attacker.lateralOffset,
        speedKmh: Math.max(1680, attacker.speedKmh + 580),
        life: 0,
        maxLife: 6.5,
        active: true,
      });
      events.push({
        type: 'missile_launched',
        weapon: 'missile',
        attackerId: attacker.id,
        attackerName: shortAttacker,
        targetId: target?.id,
        targetName: target ? target.name.split(' //')[0] : undefined,
        t: attacker.t,
        lateralOffset: attacker.lateralOffset,
        damage: 0,
      });
    } else if (weapon === 'laser') {
      // Weapon 2: Laser — forward beam active for 1.8s
      attacker.laserActiveTimer = Math.max(attacker.laserActiveTimer, 1.8);
    } else if (weapon === 'shockwave') {
      // Weapon 3: Shockwave — radiates outward from car and hits everyone within 38m radius
      attacker.shockwaveActiveTimer = Math.max(attacker.shockwaveActiveTimer, 0.95);
      events.push({
        type: 'shockwave_fired',
        weapon: 'shockwave',
        attackerId: attacker.id,
        attackerName: shortAttacker,
        t: attacker.t,
        lateralOffset: attacker.lateralOffset,
        damage: 0,
      });

      for (let i = 0; i < racers.length; i++) {
        const other = racers[i];
        if (other.id === attacker.id || other.finished || other.isDestroyed) continue;

        let dT = other.t - attacker.t;
        if (dT > 0.5) dT -= 1.0;
        if (dT < -0.5) dT += 1.0;
        const longDistM = dT * worldSplineLengthM;
        const latDistM = other.lateralOffset - attacker.lateralOffset;
        const distM = Math.hypot(longDistM, latDistM);

        if (distM <= SHOCKWAVE_RADIUS_M) {
          if (other.shieldTimer > 0) {
            events.push({
              type: 'shockwave_shielded',
              weapon: 'shockwave',
              attackerId: attacker.id,
              attackerName: shortAttacker,
              targetId: other.id,
              targetName: other.name.split(' //')[0],
              t: other.t,
              lateralOffset: other.lateralOffset,
              damage: 0,
            });
          } else {
            const pushSign = Math.sign(latDistM) || (i % 2 === 0 ? 1 : -1);
            other.lateralVelocity += pushSign * 22;
            other.speedKmh *= 0.65;
            other.empSlowTimer = Math.max(other.empSlowTimer, 2.2);
            other.rollAngle += pushSign * 0.35;
            events.push({
              type: 'shockwave_hit',
              weapon: 'shockwave',
              attackerId: attacker.id,
              attackerName: shortAttacker,
              targetId: other.id,
              targetName: other.name.split(' //')[0],
              t: other.t,
              lateralOffset: other.lateralOffset,
              damage: 32,
            });
            applyHullDamage(other, attacker, 'shockwave', 32);
          }
        }
      }
    } else if (weapon === 'mines') {
      // Weapon 4: Mines — releases armed proximity mines from the rear to hit pursuers
      const dropT = ((attacker.t - 0.0028) % 1 + 1) % 1;
      mines.push({
        id: Math.floor(Math.random() * 1e9),
        ownerId: attacker.id,
        t: dropT,
        lateralOffset: attacker.lateralOffset,
        armTimer: 0.3,
        life: 0,
        maxLife: 25.0,
        active: true,
      });
      events.push({
        type: 'mine_dropped',
        weapon: 'mines',
        attackerId: attacker.id,
        attackerName: shortAttacker,
        t: dropT,
        lateralOffset: attacker.lateralOffset,
        damage: 0,
      });
    }
  }

  // 2. Step Active Homing Missiles
  for (let mIdx = 0; mIdx < missiles.length; mIdx++) {
    const m = missiles[mIdx];
    if (!m.active) continue;
    m.life += dt;
    if (m.life >= m.maxLife) {
      m.active = false;
      continue;
    }

    const attacker = racers.find((r) => r.id === m.ownerId);
    let target = m.targetId ? racers.find((r) => r.id === m.targetId) : undefined;
    if (!target || target.finished || target.isDestroyed) {
      if (attacker) {
        target = findOpponentInFront(attacker, racers) ?? undefined;
        m.targetId = target ? target.id : null;
      }
    }

    const prevMissileT = m.t;
    const worldMetersPerSec = (m.speedKmh / 3.6) * 0.46;
    const deltaT = (worldMetersPerSec * dt) / trackLengthMeters;
    const nextMissileTUnwrapped = prevMissileT + deltaT;
    m.t = ((nextMissileTUnwrapped % 1) + 1) % 1;

    // Homing lateral tracking toward target
    if (target) {
      const latDiff = target.lateralOffset - m.lateralOffset;
      const maxLatStep = 34.0 * dt;
      m.lateralOffset += Math.max(-maxLatStep, Math.min(maxLatStep, latDiff * 12.0 * dt));
    }

    // Check impact with any opponent (or the locked target)
    for (let rIdx = 0; rIdx < racers.length; rIdx++) {
      const r = racers[rIdx];
      if (r.id === m.ownerId || r.finished || r.isDestroyed) continue;

      let dT = r.t - m.t;
      if (dT > 0.5) dT -= 1.0;
      if (dT < -0.5) dT += 1.0;
      const longDistM = Math.abs(dT * worldSplineLengthM);
      const crossedTarget = didCrossSplinePoint(prevMissileT, nextMissileTUnwrapped, r.t);
      const latDistM = Math.abs(r.lateralOffset - m.lateralOffset);

      if ((longDistM < 6.5 || crossedTarget) && latDistM < 4.5) {
        m.active = false;
        const shortAttacker = attacker ? attacker.name.split(' //')[0] : 'RIVAL';
        const shortTarget = r.name.split(' //')[0];

        if (r.shieldTimer > 0) {
          events.push({
            type: 'missile_shielded',
            weapon: 'missile',
            attackerId: m.ownerId,
            attackerName: shortAttacker,
            targetId: r.id,
            targetName: shortTarget,
            t: r.t,
            lateralOffset: r.lateralOffset,
            damage: 0,
          });
        } else {
          r.speedKmh *= 0.62;
          r.empSlowTimer = Math.max(r.empSlowTimer, 1.8);
          r.rollAngle += (rIdx % 2 === 0 ? 1 : -1) * 0.38;
          events.push({
            type: 'missile_hit',
            weapon: 'missile',
            attackerId: m.ownerId,
            attackerName: shortAttacker,
            targetId: r.id,
            targetName: shortTarget,
            t: r.t,
            lateralOffset: r.lateralOffset,
            damage: 34,
          });
          applyHullDamage(r, attacker, 'missile', 34);
        }
        break;
      }
    }
  }

  // 3. Step Active Forward Laser Beams
  for (let i = 0; i < racers.length; i++) {
    const shooter = racers[i];
    if (shooter.laserActiveTimer <= 0 || shooter.finished || shooter.isDestroyed) continue;
    const shortAttacker = shooter.name.split(' //')[0];

    for (let j = 0; j < racers.length; j++) {
      const other = racers[j];
      if (other.id === shooter.id || other.finished || other.isDestroyed) continue;

      const dT = ((other.t - shooter.t) % 1 + 1) % 1;
      const forwardMeters = dT * worldSplineLengthM;
      const latDist = Math.abs(other.lateralOffset - shooter.lateralOffset);

      if (forwardMeters > 0 && forwardMeters <= LASER_RANGE_M && latDist <= LASER_CORRIDOR_WIDTH_M) {
        if (other.shieldTimer > 0) {
          if (other.hitFlashTimer <= 0) {
            other.hitFlashTimer = 0.25;
            events.push({
              type: 'laser_shielded',
              weapon: 'laser',
              attackerId: shooter.id,
              attackerName: shortAttacker,
              targetId: other.id,
              targetName: other.name.split(' //')[0],
              t: other.t,
              lateralOffset: other.lateralOffset,
              damage: 0,
            });
          }
        } else {
          const stepDmg = 34.0 * dt;
          other.speedKmh *= Math.max(0.55, 1 - 0.65 * dt);
          other.empSlowTimer = Math.max(other.empSlowTimer, 0.6);
          const justFiredLaser = newlyFired.some(
            (f) => f.attackerId === shooter.id && f.weapon === 'laser'
          );
          if (other.hitFlashTimer <= 0.1 || justFiredLaser) {
            events.push({
              type: 'laser_hit',
              weapon: 'laser',
              attackerId: shooter.id,
              attackerName: shortAttacker,
              targetId: other.id,
              targetName: other.name.split(' //')[0],
              t: other.t,
              lateralOffset: other.lateralOffset,
              damage: Math.round(stepDmg),
            });
          }
          applyHullDamage(other, shooter, 'laser', stepDmg);
        }
      }
    }
  }

  // 4. Step Active Rear Proximity Mines
  for (let mIdx = 0; mIdx < mines.length; mIdx++) {
    const mine = mines[mIdx];
    if (!mine.active) continue;
    mine.life += dt;
    if (mine.life >= mine.maxLife) {
      mine.active = false;
      continue;
    }
    if (mine.armTimer > 0) {
      mine.armTimer = Math.max(0, mine.armTimer - dt);
      continue;
    }

    const owner = racers.find((r) => r.id === mine.ownerId);

    for (let rIdx = 0; rIdx < racers.length; rIdx++) {
      const r = racers[rIdx];
      if (r.finished || r.isDestroyed) continue;
      // Avoid immediate self-hit right after dropping unless a full lap has elapsed
      if (r.id === mine.ownerId && mine.life < 3.0) continue;

      let dT = r.t - mine.t;
      if (dT > 0.5) dT -= 1.0;
      if (dT < -0.5) dT += 1.0;
      const longDistM = Math.abs(dT * worldSplineLengthM);
      const latDistM = Math.abs(r.lateralOffset - mine.lateralOffset);

      if (longDistM < 5.2 && latDistM < 3.6) {
        mine.active = false;
        const shortAttacker = owner ? owner.name.split(' //')[0] : 'TRACK MINE';
        const shortTarget = r.name.split(' //')[0];

        if (r.shieldTimer > 0) {
          events.push({
            type: 'mine_shielded',
            weapon: 'mines',
            attackerId: mine.ownerId,
            attackerName: shortAttacker,
            targetId: r.id,
            targetName: shortTarget,
            t: r.t,
            lateralOffset: r.lateralOffset,
            damage: 0,
          });
        } else {
          r.speedKmh *= 0.56;
          r.empSlowTimer = Math.max(r.empSlowTimer, 2.2);
          r.rollAngle += 0.42;
          events.push({
            type: 'mine_hit',
            weapon: 'mines',
            attackerId: mine.ownerId,
            attackerName: shortAttacker,
            targetId: r.id,
            targetName: shortTarget,
            t: r.t,
            lateralOffset: r.lateralOffset,
            damage: 35,
          });
          applyHullDamage(r, owner, 'mines', 35);
        }
        break;
      }
    }
  }

  return events;
}

export interface VehicleCollisionEvent {
  racerAId: string;
  racerBId: string;
  involvesPlayer: boolean;
  rivalName: string;
  contactT: number;
  contactLateral: number;
  impactIntensity: number; // 0.2 .. 1.0
  playerShielded: boolean;
  racerADestroyed?: boolean;
  racerBDestroyed?: boolean;
}

/**
 * Detects and resolves 3D bounding-hull collisions between all active anti-gravity craft.
 * Uses true 3D world-space dimensions (5.8m hull length, 5.05m delta wingspan) and
 * exchanges lateral and longitudinal momentum weighted by hull mass (Titan > Valkyrie > Spectre).
 */
export function resolveRacerCollisions(
  racers: RacerState[],
  trackLengthMeters: number
): VehicleCollisionEvent[] {
  const events: VehicleCollisionEvent[] = [];
  const HULL_LENGTH_WORLD_M = 5.75;
  const HULL_WIDTH_WORLD_M = 5.05;
  const worldSplineLengthM = trackLengthMeters * 0.46;
  const maxOffset = TRACK_HALF_WIDTH - 1.65;

  for (let i = 0; i < racers.length; i++) {
    const rA = racers[i];
    if (rA.finished || rA.isDestroyed) continue;

    for (let j = i + 1; j < racers.length; j++) {
      const rB = racers[j];
      if (rB.finished || rB.isDestroyed) continue;

      // Wrapped spline longitudinal distance (-0.5 .. +0.5)
      let dT = rB.t - rA.t;
      if (dT > 0.5) dT -= 1.0;
      if (dT < -0.5) dT += 1.0;

      const longDistM = dT * worldSplineLengthM;
      const latDistM = rB.lateralOffset - rA.lateralOffset;

      if (Math.abs(longDistM) < HULL_LENGTH_WORLD_M && Math.abs(latDistM) < HULL_WIDTH_WORLD_M) {
        const massA = SHIP_SPECS[rA.shipId].energyCapacity / 100;
        const massB = SHIP_SPECS[rB.shipId].energyCapacity / 100;
        const totalMass = massA + massB;
        // If one racer is a nearly stationary player (< 25 KM/H), do not push the stationary player forward along the track!
        const rAStationaryPlayer = rA.isPlayer && rA.speedKmh < 25;
        const rBStationaryPlayer = rB.isPlayer && rB.speedKmh < 25;
        const weightA = rAStationaryPlayer ? 0 : rBStationaryPlayer ? 1 : massB / totalMass;
        const weightB = rBStationaryPlayer ? 0 : rAStationaryPlayer ? 1 : massA / totalMass;

        const overlapLong = HULL_LENGTH_WORLD_M - Math.abs(longDistM);
        const overlapLat = HULL_WIDTH_WORLD_M - Math.abs(latDistM);
        const pushDir =
          Math.abs(latDistM) > 0.05 ? Math.sign(latDistM) : i % 2 === 0 ? 1 : -1;

        if (
          overlapLong < overlapLat * 0.85 &&
          Math.abs(latDistM) < 3.6 &&
          !rAStationaryPlayer &&
          !rBStationaryPlayer
        ) {
          const longPushSign = dT >= 0 ? 1 : -1;
          const dTSep = ((overlapLong + 0.25) / worldSplineLengthM) * longPushSign;
          rA.t = ((rA.t - dTSep * weightA) % 1 + 1) % 1;
          rA.totalProgress -= dTSep * weightA;
          rB.t = ((rB.t + dTSep * weightB) % 1 + 1) % 1;
          rB.totalProgress += dTSep * weightB;

          rA.lateralOffset = Math.max(
            -maxOffset,
            Math.min(maxOffset, rA.lateralOffset - pushDir * 0.45 * weightA)
          );
          rB.lateralOffset = Math.max(
            -maxOffset,
            Math.min(maxOffset, rB.lateralOffset + pushDir * 0.45 * weightB)
          );
        } else {
          let nextLatA = rA.lateralOffset - pushDir * (overlapLat * weightA + 0.14);
          let nextLatB = rB.lateralOffset + pushDir * (overlapLat * weightB + 0.14);

          if (nextLatA < -maxOffset) {
            const deficit = -maxOffset - nextLatA;
            nextLatA = -maxOffset;
            nextLatB = Math.min(maxOffset, nextLatB + deficit);
          } else if (nextLatA > maxOffset) {
            const deficit = nextLatA - maxOffset;
            nextLatA = maxOffset;
            nextLatB = Math.max(-maxOffset, nextLatB - deficit);
          }

          if (nextLatB < -maxOffset) {
            const deficit = -maxOffset - nextLatB;
            nextLatB = -maxOffset;
            nextLatA = Math.min(maxOffset, nextLatA + deficit);
          } else if (nextLatB > maxOffset) {
            const deficit = nextLatB - maxOffset;
            nextLatB = maxOffset;
            nextLatA = Math.max(-maxOffset, nextLatA - deficit);
          }

          rA.lateralOffset = nextLatA;
          rB.lateralOffset = nextLatB;
        }

        const relLatVel = Math.abs(rA.lateralVelocity - rB.lateralVelocity);
        const bounceSpeed = Math.max(7, Math.min(15, 7 + relLatVel * 0.35));
        rA.lateralVelocity = -pushDir * bounceSpeed * weightA * (rA.isPlayer ? 0.35 : 1.15);
        rB.lateralVelocity = pushDir * bounceSpeed * weightB * (rB.isPlayer ? 0.35 : 1.15);

        rA.rollAngle = Math.max(-0.52, Math.min(0.52, rA.rollAngle + pushDir * 0.22 * weightA));
        rB.rollAngle = Math.max(-0.52, Math.min(0.52, rB.rollAngle - pushDir * 0.22 * weightB));

        if (Math.abs(longDistM) > 0.35 && Math.abs(latDistM) < 3.6) {
          const trailing = dT > 0 ? rA : rB;
          const leading = dT > 0 ? rB : rA;
          if (trailing.speedKmh > leading.speedKmh) {
            const speedDiff = trailing.speedKmh - leading.speedKmh;
            const transfer = Math.min(110, Math.max(28, speedDiff * 0.42));
            // Never launch a stationary/unthrottled player forward from an AI bump!
            if (!(leading.isPlayer && leading.speedKmh < 25)) {
              leading.speedKmh = Math.min(1450, leading.speedKmh + transfer * 0.78);
            }
            trailing.speedKmh = Math.max(180, trailing.speedKmh - transfer * 0.88);
          }
        } else {
          rA.speedKmh *= 0.975;
          rB.speedKmh *= 0.975;
        }

        // Hull energy damage on vehicle-to-vehicle hit (protected if shieldTimer > 0)
        if (rA.collisionCooldown <= 0 || rB.collisionCooldown <= 0) {
          const avgSpeed = (rA.speedKmh + rB.speedKmh) * 0.5;
          const impactIntensity = Math.min(
            1.0,
            Math.max(0.3, avgSpeed / 1000 + relLatVel / 30)
          );

          let racerADestroyed = false;
          let racerBDestroyed = false;

          if (rA.collisionCooldown <= 0) {
            rA.collisionCooldown = 0.42;
            if (rA.shieldTimer <= 0) {
              rA.energy = Math.max(0, rA.energy - 10.5 * weightA * impactIntensity);
              rA.hitFlashTimer = 0.35;
              if (rA.energy <= 0) {
                rA.energy = 0;
                rA.isDestroyed = true;
                rA.destroyedTimer = 3.5;
                rA.speedKmh = 0;
                racerADestroyed = true;
              }
            }
          }
          if (rB.collisionCooldown <= 0) {
            rB.collisionCooldown = 0.42;
            if (rB.shieldTimer <= 0) {
              rB.energy = Math.max(0, rB.energy - 10.5 * weightB * impactIntensity);
              rB.hitFlashTimer = 0.35;
              if (rB.energy <= 0) {
                rB.energy = 0;
                rB.isDestroyed = true;
                rB.destroyedTimer = 3.5;
                rB.speedKmh = 0;
                racerBDestroyed = true;
              }
            }
          }

          const involvesPlayer = rA.isPlayer || rB.isPlayer;
          const rival = rA.isPlayer ? rB : rA;
          const playerCraft = rA.isPlayer ? rA : rB;

          events.push({
            racerAId: rA.id,
            racerBId: rB.id,
            involvesPlayer,
            rivalName: rival.name.split(' //')[0],
            contactT: ((rA.t + dT * 0.5) + 1) % 1,
            contactLateral: (rA.lateralOffset + rB.lateralOffset) * 0.5,
            impactIntensity,
            playerShielded: involvesPlayer ? playerCraft.shieldTimer > 0 : false,
            racerADestroyed,
            racerBDestroyed,
          });
        }
      }
    }
  }

  return events;
}

export function didCrossSplinePoint(prevT: number, nextTUnwrapped: number, targetT: number): boolean {
  if (nextTUnwrapped <= prevT) return false;
  if (prevT <= targetT && nextTUnwrapped >= targetT) return true;
  if (nextTUnwrapped >= 1.0 && prevT <= targetT + 1.0 && nextTUnwrapped >= targetT + 1.0) {
    return true;
  }
  return false;
}

/**
 * Computes AI input decisions based on the 3 AI difficulty levels (Novice, Professional, Apex),
 * adjusting speed pacing, boost usage, corner apex precision, and pad/rival targeting.
 */
export function computeAiInput(
  ai: RacerState,
  index: number,
  settings: GameSettings,
  pads: TrackPad[],
  playerProgress: number,
  allRacers?: RacerState[],
  disabledPadIds?: Set<number>
): PlayerInputState {
  const profile = getAiDifficultyProfile(settings.aiDifficulty);
  const safeAiLaneMax = TRACK_HALF_WIDTH - 2.4;

  // Compute upcoming corner curvature so AI leans into apexes (or wanders slightly on Novice)
  const aheadCurvature = estimateTrackCurvature(settings.trackId, (ai.t + 0.012) % 1);
  const apexBias =
    profile.id === 'apex'
      ? aheadCurvature * (safeAiLaneMax * 0.72)
      : profile.id === 'professional'
      ? aheadCurvature * (safeAiLaneMax * 0.48)
      : aheadCurvature * (safeAiLaneMax * 0.18);

  const wanderAmp =
    profile.id === 'novice'
      ? safeAiLaneMax * 0.68
      : profile.id === 'professional'
      ? safeAiLaneMax * 0.42
      : safeAiLaneMax * 0.22;

  let targetLane = Math.max(
    -safeAiLaneMax,
    Math.min(
      safeAiLaneMax,
      apexBias + Math.sin(ai.t * Math.PI * 4 + index * 1.7) * wanderAmp
    )
  );
  let minAheadDist = profile.lookAheadDist;

  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    const isFixedBoost = pad.type === 'boost' || pad.powerUpType === 'boost';
    if (!isFixedBoost && disabledPadIds && disabledPadIds.has(pad.id)) continue;
    if (pad.type === 'weapon' && ai.heldWeapon !== 'none') continue;
    if (!isFixedBoost && pad.type !== 'weapon' && ai.heldBonus !== 'none' && pad.powerUpType !== 'repair') {
      continue;
    }
    // Novice AI occasionally overlooks off-line pads; Apex AI hunts every boost and bonus pad with high precision
    if (profile.id === 'novice' && !isFixedBoost && (pad.id + index) % 2 === 1) {
      continue;
    }

    const d = (pad.t - ai.t + 1) % 1;
    if (d > 0 && d < minAheadDist) {
      minAheadDist = d;
      targetLane = Math.max(
        -safeAiLaneMax,
        Math.min(safeAiLaneMax, pad.laneOffset * (TRACK_HALF_WIDTH - 2.6))
      );
    }
  }

  let shouldFireWeapon = false;

  if (allRacers) {
    for (let i = 0; i < allRacers.length; i++) {
      const other = allRacers[i];
      if (other.id === ai.id || other.finished || other.isDestroyed) continue;
      const dT = (other.t - ai.t + 1) % 1;
      if (dT > 0 && dT < 0.045 && Math.abs(other.lateralOffset - ai.lateralOffset) < 6.4) {
        const evadeDir =
          Math.abs(other.lateralOffset) > safeAiLaneMax - 3.2
            ? -Math.sign(other.lateralOffset)
            : ai.lateralOffset >= other.lateralOffset
            ? 1
            : -1;
        targetLane = Math.max(
          -safeAiLaneMax,
          Math.min(safeAiLaneMax, other.lateralOffset + evadeDir * 6.8)
        );
        break;
      }
    }

    if (ai.heldWeapon !== 'none' && ai.speedKmh > 340) {
      const fireThreshold = 1.0 - profile.weaponFireAggression;
      if (ai.heldWeapon === 'missile') {
        const tgt = findOpponentInFront(ai, allRacers);
        shouldFireWeapon = Boolean(tgt && Math.sin(ai.t * 53 + index) > fireThreshold);
      } else if (ai.heldWeapon === 'laser') {
        shouldFireWeapon = allRacers.some((o) => {
          if (o.id === ai.id || o.finished || o.isDestroyed) return false;
          const dT = (o.t - ai.t + 1) % 1;
          return dT > 0 && dT < 0.035 && Math.abs(o.lateralOffset - ai.lateralOffset) < 3.0;
        });
      } else if (ai.heldWeapon === 'shockwave') {
        shouldFireWeapon = allRacers.some((o) => {
          if (o.id === ai.id || o.finished || o.isDestroyed) return false;
          let dT = o.t - ai.t;
          if (dT > 0.5) dT -= 1;
          if (dT < -0.5) dT += 1;
          return Math.abs(dT) < 0.012 && Math.abs(o.lateralOffset - ai.lateralOffset) < 9.0;
        });
      } else if (ai.heldWeapon === 'mines') {
        shouldFireWeapon = Math.sin(ai.t * 41 + index * 2.1) > fireThreshold;
      }
    }
  }

  const diffOffset = targetLane - ai.lateralOffset;
  const steerLeft = diffOffset < -profile.steerDeadzone;
  const steerRight = diffOffset > profile.steerDeadzone;

  const absCurve = Math.abs(aheadCurvature);
  const isSharpCorner = absCurve > profile.cornerBrakeThreshold && ai.speedKmh > 640;

  const progressGap = playerProgress - ai.totalProgress;
  const energyReserveThreshold =
    profile.id === 'apex' ? 38 : profile.id === 'professional' ? 52 : 68;

  const shouldBoost =
    !isSharpCorner &&
    ai.energy > energyReserveThreshold &&
    (progressGap > (profile.id === 'apex' ? 0.012 : 0.028) ||
      Math.sin(ai.t * 37 + index) > 1 - profile.boostChance);

  const shouldUseBonus =
    ai.heldBonus !== 'none' &&
    (profile.id === 'apex'
      ? ai.energy > 24
      : profile.id === 'professional'
      ? ai.energy > 32 && Math.sin(ai.t * 29 + index) > -0.2
      : ai.energy > 45 && Math.sin(ai.t * 29 + index) > 0.35);

  return {
    throttle: !isSharpCorner,
    brake: isSharpCorner && profile.id !== 'novice',
    steerLeft,
    steerRight,
    airbrakeLeft: diffOffset < -profile.airbrakeThreshold,
    airbrakeRight: diffOffset > profile.airbrakeThreshold,
    boostHeld: shouldBoost,
    useBonusPressed: shouldUseBonus,
    useWeaponPressed: shouldFireWeapon,
  };
}

/**
 * Sorts racers by race standing (finished racers by finishTimeMs, active racers by totalProgress).
 */
export function calculateStandings(racers: RacerState[]): RacerState[] {
  return [...racers].sort((a, b) => {
    if (a.finished && b.finished) {
      return a.finishTimeMs - b.finishTimeMs;
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.totalProgress - a.totalProgress;
  });
}

export function formatRaceTime(ms: number | null): string {
  if (ms === null || ms < 0 || !Number.isFinite(ms)) return '--:--.--';
  const totalCentiseconds = Math.floor(ms / 10);
  const cs = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const sec = totalSeconds % 60;
  const min = Math.floor(totalSeconds / 60);
  return `${min}:${sec.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

export function formatOrdinal(rank: number): { num: string; suffix: string } {
  const s = ['TH', 'ST', 'ND', 'RD'];
  const v = rank % 100;
  const suffix = s[(v - 20) % 10] || s[v] || s[0];
  return { num: String(rank), suffix };
}
