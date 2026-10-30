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
  weatherMode: 'storm',
  shipId: 'valkyrie',
  cameraMode: 'perspective',
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
  enableGForceTilt: false,
  enableMotionLines: false,
  enableTrackSsao: true,
  enableBloom: true,
  enableHeatHaze: true,
  enableLavaDisplacement: true,
  enableVolumetricRays: true,
  enableRisingEmbers: true,
  enableTrackDebris: true,
  neonIntensity: 1.15,
  autoAccelerate: false,
  gameSpeed: 1.25,
};

export const TRACK_HALF_WIDTH = 13.5;

/**
 * Computes the current dynamic or storm weather state for a track.
 * Evolves through storm cloud buildup, distant lightning, monsoon squalls, and supercell vortex phases.
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
      cloudDensity: 0.0,
      stormPhase: 'clear',
    };
  }

  const wave1 = Math.sin(elapsedSec * 0.14 + 0.65);
  const wave2 = Math.cos(elapsedSec * 0.055);
  const stormCycle = (elapsedSec % 48) / 48; // 48s evolving storm front cycle

  let intensity = 0.92;
  let cloudDensity = 0.94;
  let stormPhase: NonNullable<WeatherState['stormPhase']> = 'supercell_vortex';

  if (weatherMode === 'storm') {
    // Active storm mode (default on City circuit): dynamic squall surges (0.85..0.98) with evolving lightning/vortex phases
    intensity = Number(
      Math.max(0.85, Math.min(0.98, 0.91 + wave1 * 0.045 + wave2 * 0.025)).toFixed(3)
    );
    cloudDensity = Number(
      Math.max(0.88, Math.min(1.0, 0.93 + Math.sin(elapsedSec * 0.09) * 0.06)).toFixed(3)
    );
    stormPhase =
      stormCycle < 0.2
        ? 'distant_lightning'
        : stormCycle < 0.55
        ? 'monsoon_squall'
        : 'supercell_vortex';
  } else if (weatherMode === 'dynamic') {
    // Dynamic weather progression: gathering storm clouds -> distant lightning -> heavy monsoon squall -> supercell vortex
    intensity = Number(
      Math.max(0.26, Math.min(0.96, 0.64 + wave1 * 0.24 + wave2 * 0.12)).toFixed(3)
    );
    cloudDensity = Number(Math.max(0.42, Math.min(1.0, intensity * 1.08)).toFixed(3));
    stormPhase =
      intensity >= 0.82
        ? 'supercell_vortex'
        : intensity >= 0.65
        ? 'monsoon_squall'
        : intensity >= 0.44
        ? 'distant_lightning'
        : 'gathering_clouds';
  }

  const surfaceGrip = Number((1.0 - intensity * 0.42).toFixed(3));
  const visibilityFactor = Number((1.0 - intensity * 0.48).toFixed(3));

  if (isCityTrack(trackId)) {
    const label =
      stormPhase === 'supercell_vortex'
        ? 'STORM SUPERCELL // VORTEX'
        : stormPhase === 'monsoon_squall' || intensity >= 0.75
        ? 'CYBER MONSOON // WET'
        : stormPhase === 'distant_lightning' || intensity >= 0.42
        ? 'NEON RAIN SQUALL'
        : 'STORM CLOUDS GATHERING';
    return {
      type: 'rain',
      intensity,
      label,
      surfaceGrip,
      visibilityFactor,
      cloudDensity,
      stormPhase,
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
      cloudDensity,
      stormPhase,
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
    label: 'VELOCITY BOOST PAD',
    shortLabel: 'VELOCITY BOOST',
    description:
      'A lane-wide electric-blue triple-arrow velocity pad embedded in the roadway that lights up in series and triggers a progressive combo velocity surge when chained.',
    effectBadge: '+380 KM/H HYPER-BURST',
    color: '#00e5ff',
    accentHex: 0x00e5ff,
    glowHex: 0x7dd3fc,
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
 * Generates chained series of on-track Fixed Velocity-Boost pads and Respawning 3D Bonus / Weapon boxes:
 * - City ('city' | 'city_v1', 9,800m): 36 total pads (6 chained series × 3 consecutive Velocity-Boost pads = 18 Boost pads + 9 Power-Up Bonus boxes + 9 Weapon boxes)
 * - Lava ('lava_v2' | 'lava', 9,600m): 25 total pads (5 chained series × 3 consecutive Velocity-Boost pads = 15 Boost pads + 5 Power-Up Bonus boxes + 5 Weapon boxes)
 * Within each velocity-boost chain, 3 boost pads are placed along a smooth racing line (Δt = 0.020 apart)
 * so a skilled driver can hit them one after another in series to stack velocity and proceed very quickly!
 * Fixed Speed Boost pads (`type === 'boost'`) stay permanently active on the track surface for all racers.
 * Bonus & Weapon 3D boxes (`type !== 'boost'`) disappear when collected by any racer and respawn after 10.0 seconds.
 */
export function createTrackPads(trackId: TrackId, enableLegacyPads = true): TrackPad[] {
  if (!enableLegacyPads) {
    return [];
  }
  const pads: TrackPad[] = [];
  const isCity = isCityTrack(trackId);
  const sectorCount = isCity ? 6 : 5;
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
  // Smooth racing-line lane progressions for each 3-pad velocity-boost chain so skilled players can chain all 3 in series
  const boostChainLines: ReadonlyArray< readonly [number, number, number] > = [
    [0.0, 0.0, 0.0],
    [-0.30, -0.15, 0.0],
    [0.30, 0.15, 0.0],
    [0.0, -0.18, -0.32],
    [0.0, 0.18, 0.32],
    [-0.24, 0.0, 0.24],
  ];
  const itemLanePattern = [-0.46, 0.46, 0.38, -0.38, -0.32, 0.32];

  let padId = 0;
  let bonusIdx = 0;
  let weaponIdx = 0;

  for (let s = 0; s < sectorCount; s++) {
    // Sector base t starts at 0.058 so no pad sits on the starting grid (t = 0.002..0.035)
    const sectorSpan = 0.895 / sectorCount;
    const baseT = 0.058 + s * sectorSpan;
    const chainLanes = boostChainLines[s % boostChainLines.length];

    // 1) Chained Series of 3 Consecutive Velocity-Boost Pads along the racing line (~195m apart)
    for (let c = 0; c < 3; c++) {
      const boostT = Number((baseT + c * 0.020).toFixed(4));
      pads.push({
        id: padId++,
        t: boostT,
        laneOffset: chainLanes[c],
        type: 'boost',
        powerUpType: 'boost',
      });
    }

    // 2) Respawning 3D Floating Bonus & Weapon Boxes in the second half of the sector
    const itemSlots = isCity ? 3 : 2;
    for (let k = 0; k < itemSlots; k++) {
      const itemT = Number((baseT + 0.068 + k * (isCity ? 0.024 : 0.034)).toFixed(4));
      const laneOffset = itemLanePattern[(s * itemSlots + k) % itemLanePattern.length];
      const isBonusSlot = (s + k) % 2 === 0;

      if (isBonusSlot) {
        const powerUpType = bonusBoxCycle[bonusIdx % bonusBoxCycle.length];
        bonusIdx++;
        const type: TrackPad['type'] = powerUpType === 'repair' ? 'recharge' : 'bonus';
        pads.push({
          id: padId++,
          t: itemT,
          laneOffset,
          type,
          powerUpType,
        });
      } else {
        const weaponType = weaponCycle[weaponIdx % weaponCycle.length];
        weaponIdx++;
        pads.push({
          id: padId++,
          t: itemT,
          laneOffset,
          type: 'weapon',
          weaponType,
        });
      }
    }
  }
  return pads;
}

export function createEnergyRings(trackId: TrackId, enableLegacyRings = false): EnergyRing[] {
  if (!enableLegacyRings) {
    return [];
  }
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

  // Start/finish straightaway envelope (t near 0.0 / 1.0 is the straight starting grid)
  if (normT < 0.025 || normT > 0.975) {
    return 0;
  }

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
  const raw = c0 + (c1 - c0) * frac;
  // Smooth deadzone for tiny spline anchor kinks (< 0.06) so straightaways track true with zero step-jump
  const absRaw = Math.abs(raw);
  if (absRaw < 0.06) return 0;
  return Math.sign(raw) * ((absRaw - 0.06) / 0.94);
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

  // Racers 1..3 ahead on grid in outer lanes so the center lane (0.0m) is completely clear for the player
  for (let i = 0; i < 3; i++) {
    const startT = 0.018 - i * 0.0045;
    const lane = i === 0 ? -6.2 : i === 1 ? 6.2 : -8.4;
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
      nitroReserve: 0,
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
      boostComboCount: 0,
      boostComboTimer: 0,
      lastBoostPadId: null,
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

  // Player in 4th position on the starting grid, positioned in the EXACT CENTER of the track (lateralOffset: 0)
  racers.push({
    id: 'player',
    name: SHIP_SPECS[playerShipId].name,
    isPlayer: true,
    shipId: playerShipId,
    t: 0.002,
    lap: 1,
    totalProgress: 0.002,
    lateralOffset: 0,
    lateralVelocity: 0,
    speedKmh: 0,
    energy: 100,
    nitroReserve: 0,
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
    boostComboCount: 0,
    boostComboTimer: 0,
    lastBoostPadId: null,
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
      nitroReserve: 0,
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
      boostComboCount: 0,
      boostComboTimer: 0,
      lastBoostPadId: null,
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
  boostComboCount?: number;
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

export interface BoundaryCollisionResult {
  wallCollision: boolean;
  envStructureHit: boolean;
  clampedOffset: number;
}

/**
 * Evaluates whether a track coordinate `t` lies inside a trackside 3D environment structure
 * (timing gantry pillars, advertising gantry arches, skyscraper core tunnel, volcano tunnel, or refinery portal).
 */
export function isWithinEnvironmentStructureZone(trackId: TrackId, tNorm: number): boolean {
  const t = ((tNorm % 1) + 1) % 1;
  // Timing & sector gantries present on all tracks
  const sectorTs = [0.0, 0.25, 0.5, 0.75];
  for (const st of sectorTs) {
    const distT = Math.min(Math.abs(t - st), 1 - Math.abs(t - st));
    if (distT <= 0.0045) return true;
  }
  if (trackId === 'city') {
    // Advertising gantry arches & Skyscraper Core / Neon Overpass tunnel zones
    const cityGantryTs = [0.042, 0.145, 0.275, 0.395, 0.51, 0.635, 0.855, 0.945];
    for (const gt of cityGantryTs) {
      if (Math.abs(t - gt) <= 0.0045) return true;
    }
    if (t >= 0.705 && t <= 0.805) return true;
  } else if (trackId === 'lava') {
    // Volcano Tunnel & Magma Refinery Portal zones
    if ((t >= 0.136 && t <= 0.182) || (t >= 0.745 && t <= 0.798)) return true;
  }
  return false;
}

/**
 * Enforces physical track boundary and 3D environment mesh collision physics so vehicles
 * never clip through guardrails, tunnel walls, gantry pillars, or trackside structures.
 */
export function resolveTrackBoundaryAndEnvironmentCollision(
  racer: RacerState,
  trackId: TrackId,
  combinedSteer: number,
  hullProtection = 1.0,
  dt = 1 / 60,
  customClearanceHalfWidth?: number
): BoundaryCollisionResult {
  // Full 27m roadway clearance (-12.15m to +12.15m center offset; ship outer wingtips reach ±14.67m inside ±14.75m walls)
  const maxOffset =
    customClearanceHalfWidth !== undefined ? customClearanceHalfWidth : TRACK_HALF_WIDTH - 1.35;
  const inEnvZone = isWithinEnvironmentStructureZone(trackId, racer.t);

  if (Math.abs(racer.lateralOffset) > maxOffset) {
    const wallSide = Math.sign(racer.lateralOffset) || 1;
    const impactSpeedRatio = Math.max(0.35, Math.min(1.4, racer.speedKmh / 760));
    const latImpactVel = Math.abs(racer.lateralVelocity);

    // Keep vehicle cleanly inside the guardrail/environment boundary without pinballing back to center
    racer.lateralOffset = wallSide * (maxOffset - 0.02);
    const steeringIntoWall = Math.sign(combinedSteer) === wallSide;
    const reboundFactor = inEnvZone ? 0.24 : 0.15;
    racer.lateralVelocity = steeringIntoWall
      ? 0
      : -wallSide * Math.min(2.2, Math.max(0.35, latImpactVel * reboundFactor));

    // Time-scaled wall/structure friction and deflection
    const wallDragDecel = racer.shieldTimer > 0 ? 14 : inEnvZone ? 92 : 78;
    racer.speedKmh = Math.max(0, racer.speedKmh - wallDragDecel * dt);
    racer.yawOffset *= 0.45;
    racer.rollAngle = -wallSide * 0.18;

    if (racer.shieldTimer <= 0 && racer.speedKmh > 40) {
      if (racer.wallHitCooldown <= 0) {
        const structMult = inEnvZone ? 1.15 : 1.0;
        const impactDmg =
          (6.5 + impactSpeedRatio * 4.2 + Math.min(3.0, latImpactVel * 0.12)) *
          hullProtection *
          structMult;
        racer.energy = Math.max(0, racer.energy - impactDmg);
        racer.wallHitCooldown = 0.65;
        racer.hitFlashTimer = 0.3;
      }
      racer.energy = Math.max(0, racer.energy - 8.5 * hullProtection * dt);
    }

    return {
      wallCollision: true,
      envStructureHit: inEnvZone,
      clampedOffset: racer.lateralOffset,
    };
  }

  return {
    wallCollision: false,
    envStructureHit: false,
    clampedOffset: racer.lateralOffset,
  };
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
  if ((racer.boostComboTimer ?? 0) > 0) {
    racer.boostComboTimer = Math.max(0, (racer.boostComboTimer ?? 0) - dt);
    if (racer.boostComboTimer === 0) {
      racer.boostComboCount = 0;
      racer.lastBoostPadId = null;
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
  const gameSpeedMult = Math.max(0.5, Math.min(2.5, settings.gameSpeed ?? 1.0));

  // Calculate effective max speed (with Ring Chain bonus, Crystal Upgrade bonus, Equipment Upgrade bonus, and boost)
  const chainSpeedBonus = racer.ringChain * 22; // Up to +110 KM/H at x5 chain
  const crystalSpeedBonus = racer.crystalUpgradeLevel * 12; // Up to +60 KM/H at Lv.5
  const equipSpeedBonus = racer.isPlayer ? upg.topSpeedLevel * 14 : 0;
  const equipBoostBonus = racer.isPlayer ? upg.nitroCapacityLevel * 14 : 0;
  const nitroActiveBonus = racer.nitroTimer > 0 ? 75 : 0;
  // Chained Hyper-Boost Pads (boostTimer > 1.2s) grant a progressive series combo top-end overcharge
  const activeCombo = Math.max(0, racer.boostComboCount ?? 0);
  const hyperPadBonus =
    racer.boostTimer > 1.2 ? 235 + Math.max(0, activeCombo - 1) * 45 : 0;
  const boostSpeedBonus = racer.isBoosting
    ? spec.boostPower + equipBoostBonus + nitroActiveBonus + hyperPadBonus
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
    // - 0.00..0.22 (0..~175 KM/H): Responsive, progressive launch traction from a standstill (0.76 -> 1.02)
    // - 0.22..0.65 (~175..~510 KM/H): Strong mid-range turbine pull (1.02 -> 1.12)
    // - 0.65..1.00 (~510..maxSpeed): Gradual aerodynamic taper (1.12 -> 0.42) so top speed is earned progressively
    let progressiveBandMult = 1.0;
    if (speedRatio < 0.22) {
      progressiveBandMult = 0.76 + (speedRatio / 0.22) * 0.26;
    } else if (speedRatio < 0.65) {
      progressiveBandMult = 1.02 + ((speedRatio - 0.22) / 0.43) * 0.10;
    } else {
      const highFrac = Math.min(1.0, (speedRatio - 0.65) / 0.35);
      progressiveBandMult = 1.12 - highFrac * 0.70;
    }

    const baseAccelRate =
      spec.acceleration *
      progressiveBandMult *
      aiAccelMult *
      (0.88 + 0.12 * surfaceGrip);

    // Progressive Boost / Nitro / Hyper-Pad thrust surge on top of standard turbine acceleration
    const boostThrustBonus = racer.isBoosting
      ? (spec.boostPower * 1.25 + (racer.nitroTimer > 0 ? 85 : 0) + (racer.boostTimer > 1.2 ? 220 : 0)) *
        aiAccelMult
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

  // Aerodynamic ceiling: 1180 KM/H under normal/manual boost; up to 1420..1520 KM/H when chaining strategic boost pads in series
  const comboCeilingBonus = Math.max(0, (racer.boostComboCount ?? 1) - 1) * 35;
  const aeroCeiling =
    racer.boostTimer > 1.2 || racer.nitroTimer > 0
      ? Math.min(1520, 1420 + comboCeilingBonus)
      : 1180;
  racer.speedKmh = Math.min(aeroCeiling, racer.speedKmh);

  // Classic Car Driving & Smooth Full-Roadway Lateral Drifting Physics:
  // Zero spline-rail constraints: the vehicle starts in the center of the track (0.0m)
  // and can smoothly steer and drift across the entire 27m roadway (-12.13m to +12.13m, guardrail to guardrail).
  let steerDir = 0;
  if (input.steerLeft) steerDir -= 1;
  if (input.steerRight) steerDir += 1;

  let airbrakeDir = 0;
  if (input.airbrakeLeft) airbrakeDir -= 0.52;
  if (input.airbrakeRight) airbrakeDir += 0.52;

  const combinedSteer = steerDir + airbrakeDir;
  const sensitivity = racer.isPlayer ? settings.steerSensitivity : 1.0;
  const handlingUpgradeMult =
    1.0 +
    racer.crystalUpgradeLevel * 0.025 +
    (racer.isPlayer ? upg.handlingLevel * 0.035 : 0);
  const gripSteerFactor = 0.86 + 0.14 * surfaceGrip;
  // Trail-braking or feathering throttle or holding airbrakes increases front-end turn-in bite and drift angle
  const isDrifting =
    Math.abs(airbrakeDir) > 0 ||
    (Math.abs(steerDir) > 0 && (input.brake || Math.abs(racer.lateralVelocity) > 10.5));
  const trailBrakeTurnInBonus = input.brake
    ? 1.24
    : Math.abs(airbrakeDir) > 0
    ? 1.16
    : !isAccelerating
    ? 1.08
    : 1.0;

  // Responsive steering authority across all speed bands so the ship can smoothly carve and drift across the entire roadway
  const speedSteerScale = racer.isPlayer
    ? 1.0
    : racer.speedKmh > 2
    ? Math.min(1.08, 0.62 + (racer.speedKmh / 380) * 0.46)
    : 0.62;
  const maxLateralSpeed =
    (racer.isPlayer ? 30.0 : 28.0) *
    (0.75 + 0.25 * spec.handling) *
    handlingUpgradeMult *
    sensitivity *
    gripSteerFactor *
    trailBrakeTurnInBonus *
    speedSteerScale;

  // Classic Car Cornering Inertia (Centrifugal Outward Drift on High-Speed Curves):
  // Only active when moving at speed (> 120 KM/H) on curved sections.
  const signedCurvature = estimateTrackCurvature(settings.trackId, racer.t);
  const cornerSpeedNorm =
    racer.speedKmh > 120 ? Math.min(1.35, (racer.speedKmh - 120) / 500) : 0;
  const curvePullStrength = racer.isPlayer ? 6.2 : 3.8;
  const centrifugalDriftVel =
    (-signedCurvature *
      cornerSpeedNorm *
      (0.42 + 0.58 * cornerSpeedNorm) *
      curvePullStrength) /
    Math.max(0.85, spec.handling * 0.92);

  if (combinedSteer !== 0) {
    // Active steering command: smooth, high-authority lateral drift velocity across the entire track width
    const targetLateralVel =
      combinedSteer * maxLateralSpeed + (racer.isPlayer ? 0 : centrifugalDriftVel * 0.25);
    const isCounterSteering =
      racer.lateralVelocity !== 0 &&
      Math.sign(combinedSteer) !== Math.sign(racer.lateralVelocity);
    const steerResponseRate = (isCounterSteering ? 27.0 : 20.5) + 4.5 * surfaceGrip;
    racer.lateralVelocity +=
      (targetLateralVel - racer.lateralVelocity) * (1 - Math.exp(-steerResponseRate * dt));
  } else {
    // Steering released: preserve a controlled ~1.7m lateral drift glide before settling in the chosen lane
    // (never snapping back to center); on high-speed curves, experience natural outward cornering drift.
    const releaseDecayRate = 11.0 + 6.5 * surfaceGrip;
    const decayFactor = Math.exp(-releaseDecayRate * dt);
    racer.lateralVelocity =
      racer.lateralVelocity * decayFactor + centrifugalDriftVel * (1 - decayFactor);
    if (Math.abs(racer.lateralVelocity) < 0.04 && Math.abs(centrifugalDriftVel) < 0.04) {
      racer.lateralVelocity = 0;
    }
  }
  racer.lateralOffset += racer.lateralVelocity * dt;

  const driftSlipFactor = (1.0 + (1.0 - surfaceGrip) * 0.35) * (isDrifting ? 1.12 : 1.0);
  let targetRoll = Math.max(
    -0.56,
    Math.min(
      0.56,
      -combinedSteer * 0.39 -
        racer.lateralVelocity * 0.0035 -
        signedCurvature * cornerSpeedNorm * 0.12
    )
  );
  let targetYaw = Math.max(
    -0.56,
    Math.min(
      0.56,
      (-combinedSteer * 0.34 - airbrakeDir * 0.18 - racer.lateralVelocity * 0.0062) * driftSlipFactor
    )
  );

  const hullProtection = racer.isPlayer ? 1.0 - upg.shieldHullLevel * 0.08 : 1.0;
  const boundaryHit = resolveTrackBoundaryAndEnvironmentCollision(
    racer,
    settings.trackId,
    combinedSteer,
    hullProtection,
    dt
  );
  if (boundaryHit.wallCollision) {
    const wallSide = Math.sign(racer.lateralOffset) || 1;
    targetRoll = -wallSide * 0.18;
    targetYaw = -wallSide * 0.04;
    result.wallCollision = true;
  }

  // Check if energy reached zero from guardrail / environment collision damage -> Vehicle Explodes!
  if (racer.energy <= 0) {
    racer.energy = 0;
    racer.isDestroyed = true;
    racer.destroyedTimer = 3.5;
    racer.speedKmh = 0;
    racer.isBoosting = false;
    result.exploded = true;
    return result;
  }

  racer.rollAngle += (targetRoll - racer.rollAngle) * (1 - Math.exp(-11.5 * dt));
  racer.yawOffset += (targetYaw - racer.yawOffset) * (1 - Math.exp(-11.5 * dt));
  if (combinedSteer === 0 && Math.abs(targetRoll) < 0.002 && Math.abs(racer.rollAngle) < 0.002) {
    racer.rollAngle = 0;
  }
  if (combinedSteer === 0 && Math.abs(targetYaw) < 0.002 && Math.abs(racer.yawOffset) < 0.002) {
    racer.yawOffset = 0;
  }
  const targetPitch = racer.isBoosting ? 0.045 : input.brake ? -0.035 : isAccelerating ? 0.015 : -0.015;
  racer.pitchAngle += (targetPitch - racer.pitchAngle) * (1 - Math.exp(-8 * dt));

  // Advance along spline with significantly higher real physical ground velocity (scaled by settings.gameSpeed)
  const prevT = racer.t;
  const headingForwardCos = Math.max(0.45, Math.cos(racer.yawOffset * 0.85));
  const worldMetersPerSec = (racer.speedKmh / 3.6) * 0.76 * gameSpeedMult * headingForwardCos;
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

    const crossedCenter = didCrossSplinePoint(prevT, nextTUnwrapped, pad.t);
    // Larger lane-wide electric-blue velocity-boost pads (9.2m wide x 18.4m long) trigger across their full span
    const padHalfLenT = isFixedBoostPad ? 9.2 / Math.max(1000, trackLengthMeters) : 0;
    const rawDeltaT = Math.abs(((racer.t - pad.t + 0.5) % 1 + 1) % 1 - 0.5);
    const insideLongitudinalPad = isFixedBoostPad && rawDeltaT <= padHalfLenT;

    // Clear lastBoostPadId once the racer has moved well past that pad so it can be triggered on the next lap
    if (isFixedBoostPad && racer.lastBoostPadId === pad.id && rawDeltaT > padHalfLenT * 2.5 && !crossedCenter) {
      racer.lastBoostPadId = null;
    }

    if (crossedCenter || insideLongitudinalPad) {
      const padWorldX = pad.laneOffset * (TRACK_HALF_WIDTH - 2.2);
      // Generous full-lane lateral capture radius for the larger electric-blue velocity-boost pads (6.45m) and 4.45m for 3D weapon/bonus boxes
      const hitRadius = isFixedBoostPad ? 6.45 : 4.45;
      if (Math.abs(racer.lateralOffset - padWorldX) < hitRadius) {
        if (isFixedBoostPad) {
          // Only trigger boost pad surge if the racer is actively driving or coasting above 25 KM/H
          if (racer.isPlayer && !wantsDrivePower && racer.speedKmh < 25) {
            continue;
          }
          // If already on this exact pad from the previous frame, maintain boostTimer without double-counting the combo
          if (racer.lastBoostPadId === pad.id) {
            racer.boostTimer = Math.max(racer.boostTimer, 2.85);
            continue;
          }

          // PROGRESSIVE SERIES COMBO BOOST PAD SYSTEM:
          // Hitting boost pads one after another in series (Pad 1 -> Pad 2 -> Pad 3 -> ...) within the 6.5s combo window
          // increments boostComboCount and rewards the player with progressively greater velocity surges and faster pad pulsation!
          const prevCombo = (racer.boostComboTimer ?? 0) > 0 ? (racer.boostComboCount ?? 0) : 0;
          const nextCombo = Math.min(6, prevCombo + 1);
          racer.boostComboCount = nextCombo;
          racer.boostComboTimer = 6.5;
          racer.lastBoostPadId = pad.id;

          racer.boostTimer = Math.min(
            4.5,
            Math.max(racer.boostTimer + 0.85, 2.75 + (nextCombo - 1) * 0.45)
          );
          if (!racer.isPlayer || wantsDrivePower) {
            const comboSurge = 235 + (nextCombo - 1) * 45;
            const comboCapBonus = 280 + (nextCombo - 1) * 55;
            const comboAeroMax = Math.min(1520, 1420 + (nextCombo - 1) * 35);
            racer.speedKmh = Math.min(
              comboAeroMax,
              Math.min(
                spec.maxSpeedKmh + spec.boostPower + comboCapBonus,
                racer.speedKmh + comboSurge
              )
            );
          }
          racer.energy = Math.min(100, racer.energy + 8 + Math.min(6, (nextCombo - 1) * 2));
          result.hitBoostPad = true;
          result.boostComboCount = nextCombo;
          result.collectedPowerUp = 'boost';
          racer.lastCollectedPowerUp = 'boost';
          racer.lastCollectedWeapon = null;
          racer.lastCollectedTimer = 2.2;
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
          racer.heldBonus = 'crystal';
          result.collectedBonus = 'crystal';
        } else if (pType === 'shield') {
          // SHIELD POWER-UP — Blue-violet orb with hexagonal energy grid activating temporary shield
          const shieldBonusDur = racer.isPlayer ? upg.shieldHullLevel * 0.5 : 0;
          racer.shieldTimer = Math.max(racer.shieldTimer, 5.5 + shieldBonusDur);
          racer.energy = Math.min(100, racer.energy + 14);
          racer.heldBonus = 'shield';
          result.collectedBonus = 'shield';
        } else if (pType === 'repair') {
          // REPAIR POWER-UP — Dark-metal crate with cyan medical cross restoring vehicle health
          racer.energy = Math.min(100, racer.energy + 65);
          racer.empSlowTimer = 0;
          result.hitRechargePad = true;
          racer.heldBonus = 'repair';
          result.collectedBonus = 'repair';
        } else if (pType === 'credit') {
          // CREDIT BONUS — Gold-edged token with raised central emblem earning credits for upgrades
          racer.creditsEarned += 150;
          racer.energy = Math.min(100, racer.energy + 8);
          racer.speedKmh = Math.min(
            spec.maxSpeedKmh + spec.boostPower + 80,
            racer.speedKmh + 40
          );
          racer.heldBonus = 'credit';
          result.collectedBonus = 'credit';
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
        // If one racer is a nearly stationary player or launching on the starting straight, do not let AI cars shove or flicker the player!
        const rAStationaryPlayer =
          rA.isPlayer && (rA.speedKmh < 65 || (rA.lap === 1 && rA.t < 0.045));
        const rBStationaryPlayer =
          rB.isPlayer && (rB.speedKmh < 65 || (rB.lap === 1 && rB.t < 0.045));
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
          const sepA = weightA > 0 ? overlapLat * weightA + 0.14 : 0;
          const sepB = weightB > 0 ? overlapLat * weightB + 0.14 : 0;
          let nextLatA = rA.lateralOffset - pushDir * sepA;
          let nextLatB = rB.lateralOffset + pushDir * sepB;

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
        rA.lateralVelocity = -pushDir * bounceSpeed * weightA * (rA.isPlayer ? 0.18 : 1.15);
        rB.lateralVelocity = pushDir * bounceSpeed * weightB * (rB.isPlayer ? 0.18 : 1.15);

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

  // Derivative-damped lane tracking so AI / Demo autopilot settles smoothly into targetLane without oscillating left/right
  const predictedLat = ai.lateralOffset + ai.lateralVelocity * 0.15;
  const diffOffset = targetLane - predictedLat;
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
