export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type TrackId = 'city' | 'lava_v2' | 'city_v1' | 'lava';

export type AtmosphereMode = 'neon' | 'daylight';

export type WeatherMode = 'dynamic' | 'clear' | 'storm';

export type WeatherType = 'clear' | 'rain' | 'ash_storm';

export interface WeatherState {
  type: WeatherType;
  intensity: number; // 0..1
  label: string;
  surfaceGrip: number; // 1.0 (dry/clear) down to 0.58 (heavy storm)
  visibilityFactor: number; // 1.0 (clear) down to 0.52 (heavy fog/precipitation)
  cloudDensity?: number; // 0..1 storm cloud canopy & vortex density
  stormPhase?:
    | 'clear'
    | 'gathering_clouds'
    | 'distant_lightning'
    | 'monsoon_squall'
    | 'supercell_vortex';
}

export type CameraMode = 'perspective' | 'chase' | 'close' | 'cockpit';

export type DebugMode = 'off' | 'explore' | 'vehicle_orbit';

export interface DebugTeleportRequest {
  nonce: number;
  t: number;
  heightOffset?: number;
  distance?: number;
  yaw?: number;
  pitch?: number;
}

export type ShipId = 'valkyrie' | 'spectre' | 'titan' | 'seraph' | 'nemesis';

export type PowerUpItemType = 'boost' | 'nitro' | 'crystal' | 'shield' | 'repair' | 'credit';

export type ActiveWeaponId = 'missile' | 'laser' | 'shockwave' | 'mines';

export type WeaponType = 'none' | ActiveWeaponId;

export type BonusType =
  | 'none'
  | PowerUpItemType
  | 'hyper_turbine'
  | 'plasma_shield'
  | 'emp_blast'
  | 'overdrive_core';

export interface VehicleUpgrades {
  topSpeedLevel: number; // 0..5
  nitroCapacityLevel: number; // 0..5
  handlingLevel: number; // 0..5
  shieldHullLevel: number; // 0..5
}

export interface ShipSpec {
  id: ShipId;
  name: string;
  team: string;
  tagline: string;
  maxSpeedKmh: number;
  acceleration: number;
  handling: number;
  boostPower: number;
  energyCapacity: number;
  primaryColor: number;
  accentColor: number;
  thrusterColor: number;
}

export interface TrackSpec {
  id: TrackId;
  name: string;
  sector: string;
  subtitle: string;
  lengthMeters: number;
  totalLaps: number;
  previewNeon: string;
  previewDay: string;
  difficulty: string;
}

export type MusicThemeId =
  | 'pro_theme'
  | 'cyber_techno'
  | 'synthwave_outrun'
  | 'hyper_trance'
  | 'dark_electro'
  | 'liquid_dnb';

export type SfxPresetId =
  | 'quantum_clean'
  | 'plasma_overdrive'
  | 'arcade_synth'
  | 'titan_heavy'
  | 'crystalline_harmonic';

export type AiDifficulty =
  | 'novice'
  | 'professional'
  | 'apex'
  | 'rookie'
  | 'pro'
  | 'phantom';

export interface GameSettings {
  trackId: TrackId;
  atmosphere: AtmosphereMode;
  weatherMode: WeatherMode;
  shipId: ShipId;
  cameraMode: CameraMode;
  fov: number;
  steerSensitivity: number;
  aiDifficulty: AiDifficulty;
  musicVolume: number;
  sfxVolume: number;
  musicTheme: MusicThemeId;
  sfxPreset: SfxPresetId;
  muted: boolean;
  showParticles: boolean;
  enableDynamicFov: boolean;
  enableGForceTilt: boolean;
  enableMotionLines: boolean;
  enableTrackSsao: boolean;
  enableBloom: boolean;
  enableHeatHaze: boolean;
  enableLavaDisplacement: boolean;
  enableVolumetricRays: boolean;
  enableRisingEmbers: boolean;
  enableTrackDebris: boolean;
  neonIntensity: number;
  autoAccelerate: boolean;
  gameSpeed: number;
}

export interface TrackPad {
  id: number;
  t: number; // 0..1 spline parameter
  laneOffset: number; // -1..1 normalized across track width
  type: 'boost' | 'bonus' | 'recharge' | 'weapon';
  powerUpType?: PowerUpItemType;
  weaponType?: ActiveWeaponId;
}

export interface EnergyRing {
  id: number;
  t: number; // 0..1 spline parameter
  colorType: 'cyan' | 'orange';
}

export interface ActiveMissile {
  id: number;
  ownerId: string;
  targetId: string | null;
  t: number;
  lateralOffset: number;
  speedKmh: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface ActiveMine {
  id: number;
  ownerId: string;
  t: number;
  lateralOffset: number;
  armTimer: number; // short delay before armed
  life: number;
  maxLife: number;
  active: boolean;
}

export interface RacerState {
  id: string;
  name: string;
  isPlayer: boolean;
  shipId: ShipId;
  t: number; // 0..1 position along spline
  lap: number; // 1..totalLaps
  totalProgress: number; // (lap - 1) + t
  lateralOffset: number; // -trackHalfWidth .. +trackHalfWidth
  lateralVelocity: number;
  speedKmh: number;
  energy: number; // 0..100 (Vehicle Hull Energy: decreases on edge/guardrail contact & hits; 0 = explodes & game over)
  nitroReserve: number; // 0..100 (Glowing blue nitro fuel reserve)
  crystalPoints: number; // Bonus score from Crystal Bonus pickups
  crystalUpgradeLevel: number; // 0..5 in-race crystal upgrade level
  creditsEarned: number; // Credits collected from Credit Bonus tokens
  isBoosting: boolean;
  boostTimer: number;
  nitroTimer: number;
  shieldTimer: number;
  empSlowTimer: number;
  collisionCooldown: number;
  wallHitCooldown: number;
  rollAngle: number;
  pitchAngle: number;
  yawOffset: number;
  ringChain: number;
  ringChainTimer: number;
  boostComboCount?: number;
  boostComboTimer?: number;
  lastBoostPadId?: number | null;
  heldBonus: BonusType;
  heldWeapon: WeaponType;
  laserActiveTimer: number;
  shockwaveActiveTimer: number;
  isDestroyed: boolean;
  destroyedTimer: number;
  hitFlashTimer: number;
  lastCollectedPowerUp: PowerUpItemType | null;
  lastCollectedWeapon: ActiveWeaponId | null;
  lastCollectedTimer: number;
  finished: boolean;
  finishTimeMs: number;
  lapTimesMs: number[];
  currentLapStartMs: number;
  bestLapMs: number | null;
}

export interface HudTelemetry {
  speedKmh: number;
  energy: number;
  nitroReserve: number;
  crystalPoints: number;
  crystalUpgradeLevel: number;
  creditsEarned: number;
  totalCredits: number;
  position: number;
  totalRacers: number;
  lap: number;
  totalLaps: number;
  currentLapTimeMs: number;
  bestLapTimeMs: number | null;
  countdownValue: number; // 3, 2, 1, 0 (GO), -1 (hidden)
  countdownProgress: number; // 0..1 fractional progress within current countdown beat
  introPhase: 'overview' | 'lock' | 'countdown' | 'racing';
  statusBanner: string; // e.g., "STANDBY", "BOOST ACTIVE", "RING CHAIN x3", "HOMING MISSILE LOCKED"
  weatherLabel: string;
  weatherIntensity: number; // 0..1
  surfaceGripPct: number; // e.g. 100% down to 58%
  isBoosting: boolean;
  nitroActive: boolean;
  boostReady: boolean;
  heldBonus: BonusType;
  heldWeapon: WeaponType;
  lastCollectedPowerUp: PowerUpItemType | null;
  lastCollectedWeapon: ActiveWeaponId | null;
  lastCollectedTimer: number;
  laserActive: boolean;
  shockwaveActive: boolean;
  isDestroyed: boolean;
  targetLockedName: string | null;
  ringChain: number;
  boostComboCount?: number;
  boostComboTimer?: number;
  shieldActive: boolean;
  shieldRemainingSec: number;
  wrongWay: boolean;
  minimapPoints: Array<{ x: number; y: number }>;
  racerDots: Array<{ id: string; x: number; y: number; isPlayer: boolean; angle: number }>;
}

export interface RaceSummary {
  victory: boolean;
  reason: 'finished' | 'energy_depleted';
  finalPosition: number;
  totalRacers: number;
  totalTimeMs: number;
  bestLapMs: number | null;
  topSpeedKmh: number;
  ringsPassed: number;
  boostPadsHit: number;
  powerUpsCollected: number;
  creditsEarned: number;
  crystalPoints: number;
  trackName: string;
  shipName: string;
}


