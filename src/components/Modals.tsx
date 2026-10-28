import React from 'react';
import {
  AtmosphereMode,
  CameraMode,
  DebugMode,
  GameSettings,
  MusicThemeId,
  RaceSummary,
  ShipId,
  TrackId,
  WeatherMode,
} from '../game/types';
import {
  MUSIC_THEMES,
  SFX_PRESETS,
  SHIP_SPECS,
  formatOrdinal,
  formatRaceTime,
} from '../game/rules';
import { audioEngine } from '../game/audio';

interface SettingsModalProps {
  isOpen: boolean;
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResetDefaults: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onResetDefaults,
  onClose,
}) => {
  const [livePreviewDock, setLivePreviewDock] = React.useState(false);

  if (!isOpen) return null;

  const currentMusicMeta =
    MUSIC_THEMES.find((m) => m.id === settings.musicTheme) ?? MUSIC_THEMES[0];
  const currentSfxMeta =
    SFX_PRESETS.find((s) => s.id === settings.sfxPreset) ?? SFX_PRESETS[0];

  const shaderToggles: Array<{
    key:
      | 'enableDynamicFov'
      | 'enableGForceTilt'
      | 'enableMotionLines'
      | 'enableBloom'
      | 'enableHeatHaze'
      | 'enableLavaDisplacement'
      | 'enableVolumetricRays'
      | 'enableRisingEmbers'
      | 'enableTrackDebris'
      | 'enableTrackSsao'
      | 'showParticles';
    label: string;
    tag: string;
    desc: string;
  }> = [
    {
      key: 'enableTrackSsao',
      label: 'Track Geometry SSAO (Crevice & Depth AO)',
      tag: 'POST-FX',
      desc: 'Screen-space ambient occlusion on track crevices, barriers & background boundary',
    },
    {
      key: 'enableDynamicFov',
      label: 'Dynamic Velocity FOV Scaling',
      tag: 'CAMERA',
      desc: 'Widens camera Field of View smoothly as craft velocity & boost increase',
    },
    {
      key: 'enableGForceTilt',
      label: 'G-Force Cornering Camera Tilt',
      tag: 'CAMERA',
      desc: 'Leans camera into high-speed turns synchronized with craft roll & lateral inertia',
    },
    {
      key: 'enableMotionLines',
      label: 'High-Speed Motion Lines (>80% Speed)',
      tag: 'POST-FX',
      desc: 'Peripheral screen-edge velocity streaks above 80% max speed',
    },
    {
      key: 'enableBloom',
      label: 'HDR Neon & Magma Bloom',
      tag: 'POST-FX',
      desc: 'UnrealBloom glow on superheated lava cores & plasma thrusters',
    },
    {
      key: 'enableHeatHaze',
      label: 'Screen-Space Thermal Heat Haze',
      tag: 'POST-FX',
      desc: 'Convective UV refraction shimmer & nozzle heat distortion',
    },
    {
      key: 'enableLavaDisplacement',
      label: '3D Liquid Lava Vertex Displacement',
      tag: 'SHADER',
      desc: 'Undulating magma swells, wave normals & surface heat shimmer',
    },
    {
      key: 'enableVolumetricRays',
      label: 'Volumetric Volcano Rays & Plumes',
      tag: 'SHADER',
      desc: 'Crepuscular caldera god-rays, eruption fire columns & sky beams',
    },
    {
      key: 'enableRisingEmbers',
      label: 'Rising Lava Embers & Weather FX',
      tag: 'VFX',
      desc: 'Buoyant thermal ember plumes & metropolitan neon rain streaks',
    },
    {
      key: 'enableTrackDebris',
      label: 'Proximity-Reactive Track Debris',
      tag: 'VFX',
      desc: 'Aerodynamic volcanic ash clouds & rain splashes kicked up by craft',
    },
    {
      key: 'showParticles',
      label: 'Thruster & Collision Sparks',
      tag: 'VFX',
      desc: 'Twin turbine plasma exhaust sparks & barrier impact showers',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
      className={`fixed inset-0 z-40 flex p-3 md:p-4 select-none overflow-y-auto transition-all ${
        livePreviewDock ? 'items-center justify-end' : 'items-center justify-center'
      }`}
      style={{
        backgroundColor: livePreviewDock
          ? 'rgba(3, 6, 14, 0.08)'
          : 'rgba(3, 6, 14, 0.42)',
      }}
    >
      <div
        className={`w-full ${
          livePreviewDock ? 'max-w-md' : 'max-w-2xl'
        } rounded-xl border border-cyan-400/35 p-4 md:p-5 text-white shadow-2xl space-y-3.5 my-auto max-h-[92vh] overflow-y-auto transition-all`}
        style={{
          backgroundColor: livePreviewDock
            ? 'rgba(8, 13, 24, 0.78)'
            : 'rgba(10, 15, 28, 0.90)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 gap-2">
          <div>
            <h2
              className="text-base md:text-lg font-bold tracking-wider uppercase text-white"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              System, Shaders &amp; Race Settings
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Toggle shaders, post-processing passes &amp; VFX live on screen.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setLivePreviewDock((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
                livePreviewDock
                  ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200'
                  : 'border-white/20 text-slate-300 hover:text-white hover:border-cyan-400'
              }`}
              title="Dock panel to the side to inspect live 3D shader changes unobstructed"
            >
              {livePreviewDock ? 'Center Panel' : 'Dock for Live View'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Settings"
              className="px-3 py-1.5 rounded border border-white/20 text-xs font-semibold text-slate-300 hover:text-white hover:border-cyan-400 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          {/* Track Selector */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">
              Active Circuit
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-900 border border-white/10">
              {(['city', 'lava_v2'] as TrackId[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onUpdateSettings({ trackId: t })}
                  className={`py-1.5 px-2 rounded font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    settings.trackId === t
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t === 'city' ? 'Cyber City' : 'Obsidian Rift'}
                </button>
              ))}
            </div>
          </div>

          {/* Lighting Atmosphere */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">
              Environment Atmosphere
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-900 border border-white/10">
              {(['neon', 'daylight'] as AtmosphereMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onUpdateSettings({ atmosphere: mode })}
                  className={`py-1.5 px-3 rounded font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    settings.atmosphere === mode
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {mode === 'neon' ? 'Neon Night' : 'Overcast Day'}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Weather Conditions */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">
              Weather System (Rain / Ash)
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-900 border border-white/10">
              {(['dynamic', 'storm', 'clear'] as WeatherMode[]).map((wMode) => (
                <button
                  key={wMode}
                  type="button"
                  onClick={() => onUpdateSettings({ weatherMode: wMode })}
                  className={`py-1.5 px-2 rounded font-semibold uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    settings.weatherMode === wMode
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {wMode}
                </button>
              ))}
            </div>
          </div>

          {/* Anti-Gravity Vehicle Hull (5 Models) */}
          <div className="space-y-1 sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="block font-semibold text-slate-300">
                Anti-Gravity Craft Model (5 Redesigned Hulls)
              </label>
              <span className="text-[10px] font-mono text-cyan-300">
                {SHIP_SPECS[settings.shipId].name} · {SHIP_SPECS[settings.shipId].maxSpeedKmh} KM/H
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-slate-900 border border-white/10">
              {(['valkyrie', 'spectre', 'titan', 'seraph', 'nemesis'] as ShipId[]).map((sId) => {
                const sSpec = SHIP_SPECS[sId];
                const isSelected = settings.shipId === sId;
                return (
                  <button
                    key={sId}
                    type="button"
                    onClick={() => onUpdateSettings({ shipId: sId })}
                    className={`py-1.5 px-2 rounded font-semibold transition-colors cursor-pointer truncate ${
                      isSelected
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {sSpec.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Camera Perspective */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">
              Camera Rig Mode
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-900 border border-white/10">
              {(['chase', 'close', 'cockpit'] as CameraMode[]).map((cam) => (
                <button
                  key={cam}
                  type="button"
                  onClick={() => onUpdateSettings({ cameraMode: cam })}
                  className={`py-1.5 px-2 rounded font-semibold capitalize transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    settings.cameraMode === cam
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {cam}
                </button>
              ))}
            </div>
          </div>

          {/* AI League Difficulty */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">
              AI League Difficulty (Speed · Boost · Precision)
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-900 border border-white/10">
              {(
                [
                  { id: 'novice', label: 'Novice' },
                  { id: 'professional', label: 'Professional' },
                  { id: 'apex', label: 'Apex' },
                ] as const
              ).map((diff) => {
                const isSelected =
                  settings.aiDifficulty === diff.id ||
                  (diff.id === 'novice' && settings.aiDifficulty === 'rookie') ||
                  (diff.id === 'professional' && settings.aiDifficulty === 'pro') ||
                  (diff.id === 'apex' && settings.aiDifficulty === 'phantom');
                return (
                  <button
                    key={diff.id}
                    type="button"
                    data-testid={`settings-ai-diff-${diff.id}`}
                    onClick={() => onUpdateSettings({ aiDifficulty: diff.id })}
                    className={`py-1.5 px-2 rounded font-semibold uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {diff.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Neon Emissive Intensity */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label htmlFor="neon-slider" className="font-semibold text-slate-300">
                Neon Luminescence
              </label>
              <span className="font-mono text-cyan-300 tabular-nums">
                {Math.round(settings.neonIntensity * 100)}%
              </span>
            </div>
            <input
              id="neon-slider"
              type="range"
              min={0.2}
              max={1.8}
              step={0.05}
              value={settings.neonIntensity}
              onChange={(e) =>
                onUpdateSettings({ neonIntensity: Number(e.target.value) })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Field of View Slider */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label htmlFor="fov-slider" className="font-semibold text-slate-300">
                Base Field of View (FOV)
              </label>
              <span className="font-mono text-cyan-300 tabular-nums">{settings.fov}°</span>
            </div>
            <input
              id="fov-slider"
              type="range"
              min={60}
              max={95}
              step={1}
              value={settings.fov}
              onChange={(e) => onUpdateSettings({ fov: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Steering Sensitivity */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label htmlFor="steer-slider" className="font-semibold text-slate-300">
                Steering Responsiveness
              </label>
              <span className="font-mono text-cyan-300 tabular-nums">
                {Math.round(settings.steerSensitivity * 100)}%
              </span>
            </div>
            <input
              id="steer-slider"
              type="range"
              min={0.6}
              max={1.6}
              step={0.05}
              value={settings.steerSensitivity}
              onChange={(e) =>
                onUpdateSettings({ steerSensitivity: Number(e.target.value) })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Separate Background Music Volume Slider */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label htmlFor="music-volume-slider" className="font-semibold text-slate-300">
                Music Volume
              </label>
              <span className="font-mono text-pink-300 tabular-nums">
                {settings.muted ? 'MUTED' : `${Math.round(settings.musicVolume * 100)}%`}
              </span>
            </div>
            <input
              id="music-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(e) => {
                const nextMusicVol = Number(e.target.value);
                onUpdateSettings({
                  musicVolume: nextMusicVol,
                  muted: nextMusicVol === 0 && settings.sfxVolume === 0,
                });
              }}
              className="w-full accent-pink-400 cursor-pointer"
            />
          </div>

          {/* Separate Sound FX & Turbine Volume Slider */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label htmlFor="audio-slider" className="font-semibold text-slate-300">
                Sound FX &amp; Turbine Volume
              </label>
              <span className="font-mono text-cyan-300 tabular-nums">
                {settings.muted ? 'MUTED' : `${Math.round(settings.sfxVolume * 100)}%`}
              </span>
            </div>
            <input
              id="audio-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) => {
                const nextSfxVol = Number(e.target.value);
                onUpdateSettings({
                  sfxVolume: nextSfxVol,
                  muted: nextSfxVol === 0 && settings.musicVolume === 0,
                });
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        {/* 6 Selectable Background Music Themes (Pro Theme default + 5 Synth Tracks) */}
        <div className="space-y-1.5 pt-1 border-t border-white/10 text-xs">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-300">
              Background Music Theme (6 Tracks)
            </label>
            <span className="text-[11px] font-mono text-pink-300">
              {currentMusicMeta.label} · {currentMusicMeta.bpm} BPM ({currentMusicMeta.genre})
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 p-1 rounded-lg bg-slate-900 border border-white/10">
            {MUSIC_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => onUpdateSettings({ musicTheme: theme.id })}
                className={`py-1.5 px-2 rounded font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                  settings.musicTheme === theme.id
                    ? 'bg-pink-500 text-white shadow-[0_0_12px_rgba(236,72,153,0.45)]'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {theme.shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* 5 Selectable Sound FX Variants / Sets */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-300">
              Sound FX Synthesis Set (5 Variants)
            </label>
            <span className="text-[11px] font-mono text-cyan-300">
              {currentSfxMeta.label} — {currentSfxMeta.desc}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 rounded-lg bg-slate-900 border border-white/10">
            {SFX_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onUpdateSettings({ sfxPreset: preset.id });
                  audioEngine.playSfxPreview(preset.id);
                }}
                className={`py-1.5 px-2 rounded font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                  settings.sfxPreset === preset.id
                    ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(0,242,254,0.4)]'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {preset.shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Shaders, Post-Processing & Visual Effects (Live In-Game On/Off) */}
        <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span
                className="font-bold tracking-wider uppercase text-cyan-300"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Shaders, Post-Processing &amp; VFX (Live On/Off)
              </span>
              <p className="text-[11px] text-slate-400">
                Toggle individual GPU shaders and post-processing passes to compare live on screen.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    enableTrackSsao: true,
                    enableDynamicFov: true,
                    enableGForceTilt: true,
                    enableMotionLines: true,
                    enableBloom: true,
                    enableHeatHaze: true,
                    enableLavaDisplacement: true,
                    enableVolumetricRays: true,
                    enableRisingEmbers: true,
                    enableTrackDebris: true,
                    showParticles: true,
                  })
                }
                className="px-2 py-1 rounded bg-cyan-500/20 border border-cyan-400/40 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/30 transition-colors cursor-pointer"
              >
                All FX ON
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    enableTrackSsao: false,
                    enableDynamicFov: false,
                    enableGForceTilt: false,
                    enableMotionLines: false,
                    enableBloom: false,
                    enableHeatHaze: false,
                    enableLavaDisplacement: false,
                    enableVolumetricRays: false,
                    enableRisingEmbers: false,
                    enableTrackDebris: false,
                    showParticles: false,
                  })
                }
                className="px-2 py-1 rounded bg-slate-800 border border-white/15 text-[10px] font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                All FX OFF
              </button>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${
              livePreviewDock ? 'sm:grid-cols-1' : 'sm:grid-cols-2'
            } gap-2`}
          >
            {shaderToggles.map((item) => {
              const isEnabled = Boolean(settings[item.key]);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onUpdateSettings({ [item.key]: !isEnabled })}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                    isEnabled
                      ? 'bg-slate-900/95 border-cyan-400/45 shadow-[0_0_10px_rgba(0,242,254,0.12)]'
                      : 'bg-slate-950/70 border-white/10 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider ${
                          item.tag === 'POST-FX'
                            ? 'bg-pink-500/20 text-pink-300 border border-pink-400/30'
                            : item.tag === 'SHADER'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                        }`}
                      >
                        {item.tag}
                      </span>
                      <span className="font-semibold text-slate-100 truncate">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isEnabled
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Driving Assist Toggle */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ autoAccelerate: !settings.autoAccelerate })
            }
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg bg-slate-900 border border-white/10 text-xs font-medium hover:border-cyan-400/40 transition-colors cursor-pointer"
          >
            <span className="text-slate-200">Auto-Throttle Assist (Cruise Turbine Drive)</span>
            <span
              className={`font-bold ${
                settings.autoAccelerate ? 'text-cyan-300' : 'text-slate-500'
              }`}
            >
              {settings.autoAccelerate ? 'ENABLED' : 'MANUAL'}
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
          <button
            type="button"
            onClick={onResetDefaults}
            className="px-4 py-2 rounded-lg border border-white/15 text-xs font-semibold text-slate-300 hover:text-white hover:border-white/35 transition-colors cursor-pointer"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer"
          >
            Save &amp; Return
          </button>
        </div>
      </div>
    </div>
  );
};

interface PauseModalProps {
  musicTheme?: MusicThemeId;
  onSelectMusicTheme?: (theme: MusicThemeId) => void;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  musicTheme = 'pro_theme',
  onSelectMusicTheme,
  onResume,
  onRestart,
  onOpenSettings,
  onReturnTitle,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Race Paused"
      className="fixed inset-0 z-30 flex items-center justify-center p-4 select-none"
      style={{ backgroundColor: 'rgba(3, 6, 14, 0.8)' }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-cyan-400/35 p-6 text-white space-y-5"
        style={{
          backgroundColor: 'rgba(10, 15, 28, 0.96)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div>
          <h2
            className="text-2xl font-black tracking-wider uppercase text-white"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            Telemetry Paused
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Anti-gravity turbines holding in standby lock.
          </p>
        </div>

        {/* Quick In-Race Musical Theme Selector */}
        {onSelectMusicTheme && (
          <div className="space-y-1.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              Active Race Soundtrack
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-slate-900 border border-white/10 text-[11px]">
              {MUSIC_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onSelectMusicTheme(theme.id)}
                  className={`py-1.5 px-1.5 rounded font-semibold transition-colors cursor-pointer truncate ${
                    musicTheme === theme.id
                      ? 'bg-pink-500 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {theme.shortLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs tracking-[0.18em] uppercase transition-colors cursor-pointer"
          >
            Resume Race
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full py-3 px-4 rounded-lg border border-white/20 bg-slate-900 hover:border-cyan-400/50 text-white font-semibold text-xs tracking-[0.15em] uppercase transition-colors cursor-pointer"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-3 px-4 rounded-lg border border-white/20 bg-slate-900 hover:border-cyan-400/50 text-white font-semibold text-xs tracking-[0.15em] uppercase transition-colors cursor-pointer"
          >
            Restart Circuit
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-3 px-4 rounded-lg border border-white/10 text-slate-400 hover:text-white text-xs font-semibold tracking-[0.15em] uppercase transition-colors cursor-pointer"
          >
            Return to Title Screen
          </button>
        </div>
      </div>
    </div>
  );
};

interface RaceOverModalProps {
  summary: RaceSummary;
  onRaceAgain: () => void;
  onSwitchTrack: () => void;
  onReturnTitle: () => void;
}

export const RaceOverModal: React.FC<RaceOverModalProps> = ({
  summary,
  onRaceAgain,
  onSwitchTrack,
  onReturnTitle,
}) => {
  const { num, suffix } = formatOrdinal(summary.finalPosition);
  const isExploded = summary.reason === 'energy_depleted';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Race Results"
      className="fixed inset-0 z-30 flex items-center justify-center p-4 select-none"
      style={{ backgroundColor: 'rgba(3, 6, 14, 0.85)' }}
    >
      <div
        className={`w-full max-w-lg rounded-xl border p-7 text-white space-y-6 ${
          isExploded ? 'border-rose-500/70' : 'border-cyan-400/40'
        }`}
        style={{
          backgroundColor: 'rgba(10, 15, 28, 0.96)',
          boxShadow: isExploded ? '0 0 42px rgba(244, 63, 94, 0.35)' : undefined,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <div
              data-testid="race-over-status-badge"
              className={`text-xs font-bold tracking-[0.2em] uppercase ${
                isExploded ? 'text-rose-400' : 'text-cyan-300'
              }`}
            >
              {isExploded
                ? 'HULL ENERGY DEPLETED // VEHICLE EXPLODED'
                : summary.victory
                ? 'Podium Finish Qualified'
                : 'Circuit Complete'}
            </div>
            <h2
              className="text-2xl md:text-3xl font-black tracking-wide uppercase mt-1"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              {isExploded ? 'GAME OVER' : summary.trackName}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isExploded
                ? `${summary.shipName} destroyed on ${summary.trackName} (0% Hull Energy)`
                : summary.shipName}
            </p>
          </div>
          <div
            className="text-right leading-none"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            <span
              className={`text-4xl font-black tabular-nums ${
                isExploded ? 'text-rose-400' : 'text-cyan-300'
              }`}
            >
              {isExploded ? 'DNF' : num}
            </span>
            {!isExploded && <span className="text-lg font-bold text-white">{suffix}</span>}
            <div className="text-[10px] text-slate-400 tracking-widest mt-1">
              {isExploded ? 'DESTROYED' : `OF ${summary.totalRacers}`}
            </div>
          </div>
        </div>

        {/* 3 Tabular Stat Tiles */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-lg bg-slate-900/90 border border-white/10">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">
              Total Time
            </div>
            <div className="text-lg font-bold font-mono text-white tabular-nums mt-1">
              {formatRaceTime(summary.totalTimeMs)}
            </div>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-900/90 border border-white/10">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">
              Best Lap
            </div>
            <div className="text-lg font-bold font-mono text-cyan-300 tabular-nums mt-1">
              {formatRaceTime(summary.bestLapMs)}
            </div>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-900/90 border border-white/10">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">
              Peak Velocity
            </div>
            <div className="text-lg font-bold font-mono text-pink-300 tabular-nums mt-1">
              {summary.topSpeedKmh} <span className="text-xs">KM/H</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-cyan-400/25">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Power-Ups Boxed
            </div>
            <div className="text-sm font-bold font-mono text-cyan-300 tabular-nums mt-0.5">
              {summary.powerUpsCollected}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-amber-400/25">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Credits Earned
            </div>
            <div className="text-sm font-bold font-mono text-amber-300 tabular-nums mt-0.5">
              +{summary.creditsEarned} CR
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-fuchsia-400/25">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Crystal Bonus
            </div>
            <div className="text-sm font-bold font-mono text-fuchsia-300 tabular-nums mt-0.5">
              {summary.crystalPoints} PT
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-300 px-1">
          <span>Energy Gates Chained: {summary.ringsPassed}</span>
          <span>·</span>
          <span>Boost Chevrons Hit: {summary.boostPadsHit}</span>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            data-start="true"
            onClick={onRaceAgain}
            className="flex-1 py-3 px-5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs tracking-[0.18em] uppercase transition-colors cursor-pointer"
          >
            Race Again
          </button>
          <button
            type="button"
            onClick={onSwitchTrack}
            className="py-3 px-4 rounded-lg border border-white/20 bg-slate-900 hover:border-cyan-400/50 text-white font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer"
          >
            Next Sector
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="py-3 px-4 rounded-lg border border-white/15 text-slate-300 hover:text-white text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer"
          >
            Title
          </button>
        </div>
      </div>
    </div>
  );
};

interface SecretDebugModalProps {
  isOpen: boolean;
  debugMode: DebugMode;
  cameraPaused: boolean;
  settings: GameSettings;
  onSelectMode: (mode: DebugMode) => void;
  onTeleportSector: (t: number, heightOffset?: number, distance?: number, yaw?: number, pitch?: number) => void;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onToggleCameraPause: () => void;
  onClose: () => void;
}

export const SecretDebugModal: React.FC<SecretDebugModalProps> = ({
  isOpen,
  debugMode,
  cameraPaused,
  settings,
  onSelectMode,
  onTeleportSector,
  onUpdateSettings,
  onToggleCameraPause,
  onClose,
}) => {
  if (!isOpen) return null;

  const isLava = settings.trackId === 'lava' || settings.trackId === 'lava_v2';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Secret Debug Menu"
      data-testid="secret-debug-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none"
      style={{ backgroundColor: 'rgba(2, 5, 12, 0.86)' }}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-amber-400/50 p-6 md:p-7 text-white shadow-2xl space-y-5"
        style={{
          backgroundColor: 'rgba(9, 13, 24, 0.97)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          boxShadow: '0 0 50px rgba(245, 158, 11, 0.16)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-[10px] font-mono font-bold tracking-[0.2em] text-amber-300 uppercase">
                DEV OVERRIDE // K+E+S
              </span>
              <span className="text-[11px] font-mono text-cyan-300 uppercase tracking-wider">
                SIMULATION PAUSED
              </span>
            </div>
            <h2
              className="text-xl md:text-2xl font-black tracking-wider uppercase text-white mt-1.5"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              Secret Engineering &amp; Camera Matrix
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select an inspection rig below. Press <span className="text-amber-300 font-mono font-bold">P</span> anytime during inspection to freeze/unfreeze the world without opening a menu while keeping full camera &amp; zoom control.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-debug-modal"
            className="px-3.5 py-1.5 rounded border border-white/20 text-xs font-semibold text-slate-300 hover:text-white hover:border-amber-400 transition-colors cursor-pointer"
          >
            Resume [ESC]
          </button>
        </div>

        {/* 2 Primary Debug Inspection Modes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode 1: Free Environment Exploration */}
          <div
            className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
              debugMode === 'explore'
                ? 'border-amber-400 bg-amber-500/10'
                : 'border-white/15 bg-slate-900/80 hover:border-amber-400/50'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-amber-300">
                  MODE 01 // FREE CAM
                </span>
                {debugMode === 'explore' && (
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                    ACTIVE
                  </span>
                )}
              </div>
              <h3
                className="text-base font-bold uppercase tracking-wide text-white"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Environment Exploration
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Detach camera from craft with full 3D orbit, pan, and zoom to inspect mountains, volcano magma tunnels, parabolic banking, and skyline architecture.
              </p>
              <div className="pt-1 text-[11px] font-mono text-slate-400 space-y-0.5">
                <div>• <span className="text-white">Orbit 360°:</span> Left-Drag or Arrow Keys</div>
                <div>• <span className="text-white">Pan World:</span> Right-Drag / Shift+Drag / WASD / QE</div>
                <div>• <span className="text-white">Zoom:</span> Mouse Scroll Wheel or + / - Keys</div>
              </div>
            </div>

            <button
              type="button"
              data-testid="activate-explore-mode"
              onClick={() => onSelectMode('explore')}
              className={`mt-4 w-full py-2.5 px-4 rounded-lg font-bold text-xs tracking-[0.16em] uppercase transition-colors cursor-pointer ${
                debugMode === 'explore'
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
              }`}
            >
              {debugMode === 'explore' ? 'Continue Exploration' : 'Activate Exploration Mode'}
            </button>
          </div>

          {/* Mode 2: Vehicle-Anchored 360° Track Cruise */}
          <div
            className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
              debugMode === 'vehicle_orbit'
                ? 'border-amber-400 bg-amber-500/10'
                : 'border-white/15 bg-slate-900/80 hover:border-amber-400/50'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-cyan-300">
                  MODE 02 // 360° TRACK RIG
                </span>
                {debugMode === 'vehicle_orbit' && (
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                    ACTIVE
                  </span>
                )}
              </div>
              <h3
                className="text-base font-bold uppercase tracking-wide text-white"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Vehicle 360° Orbit Cruise
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Vehicle automatically travels the circuit while the camera stays anchored to the hull. Rotate 360° around the moving craft and zoom in/out freely.
              </p>
              <div className="pt-1 text-[11px] font-mono text-slate-400 space-y-0.5">
                <div>• <span className="text-white">360° Hull Orbit:</span> Left-Drag or Arrow Keys</div>
                <div>• <span className="text-white">Zoom Distance:</span> Scroll Wheel or + / - Keys</div>
                <div>• <span className="text-amber-300">Press [P]:</span> Pause without menu + full camera/zoom</div>
              </div>
            </div>

            <button
              type="button"
              data-testid="activate-vehicle-orbit-mode"
              onClick={() => onSelectMode('vehicle_orbit')}
              className={`mt-4 w-full py-2.5 px-4 rounded-lg font-bold text-xs tracking-[0.16em] uppercase transition-colors cursor-pointer ${
                debugMode === 'vehicle_orbit'
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
              }`}
            >
              {debugMode === 'vehicle_orbit' ? 'Continue 360° Cruise' : 'Activate Vehicle 360° Mode'}
            </button>
          </div>
        </div>

        {/* Quick Landmark Teleport Bar (Instantly jumps Exploration Camera to scenic sectors) */}
        <div className="rounded-lg bg-slate-900/90 border border-white/10 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Scenic Sector Quick-Inspect (Exploration Mode Bookmarks)
            </span>
            <span className="text-[10px] font-mono text-amber-300">
              {settings.trackId === 'lava_v2'
                ? 'OBSIDIAN RIFT MK-II'
                : settings.trackId === 'lava'
                ? 'CALDERA PRIME V1 (ARCHIVE)'
                : settings.trackId === 'city_v1'
                ? 'NEO-METROPOLIS V1 (ARCHIVE)'
                : 'NEO-METROPOLIS MK-II'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {isLava ? (
              <>
                <button
                  type="button"
                  onClick={() => onTeleportSector(0.082, 6, 42, -0.6, 0.32)}
                  className="py-2 px-2.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  01. Parabolica
                </button>
                <button
                  type="button"
                  onClick={() => onTeleportSector(0.159, 2.5, 22, 0.15, 0.14)}
                  className="py-2 px-2.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  02. Volcano Tunnel
                </button>
                <button
                  type="button"
                  onClick={() => onTeleportSector(0.455, 8, 46, -0.45, 0.28)}
                  className="py-2 px-2.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  03. Caldera Hairpins
                </button>
                <button
                  type="button"
                  onClick={() => onTeleportSector(0.838, 12, 52, 0.65, 0.28)}
                  className="py-2 px-2.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  04. Magma Viaduct
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onTeleportSector(0.01, 4, 28, 0.35, 0.25)}
                  className="py-2 px-2.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  01. Start Grid
                </button>
                <button
                  type="button"
                  onClick={() => onTeleportSector(0.24, 10, 48, -0.5, 0.28)}
                  className="py-2 px-2.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  02. High Spire Bend
                </button>
                <button
                  type="button"
                  onClick={() => onTeleportSector(0.52, 8, 44, 0.4, 0.24)}
                  className="py-2 px-2.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  03. Neon Overpass
                </button>
                <button
                  type="button"
                  onClick={() => onTeleportSector(0.75, 55, 140, 0.9, 0.34)}
                  className="py-2 px-2.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  04. Skyline Panorama
                </button>
              </>
            )}
          </div>
        </div>

        {/* Environment & Circuit Quick-Switchers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-between">
            <span className="text-slate-400 font-semibold">Circuit:</span>
            <div className="flex flex-wrap gap-1">
              {(['city', 'lava_v2', 'city_v1', 'lava'] as TrackId[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onUpdateSettings({ trackId: t })}
                  className={`px-1.5 py-1 rounded text-[10px] font-bold uppercase cursor-pointer ${
                    settings.trackId === t
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t === 'city'
                    ? 'CITY MK-II'
                    : t === 'lava_v2'
                    ? 'LAVA MK-II'
                    : t === 'city_v1'
                    ? 'CITY V1'
                    : 'LAVA V1'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-between">
            <span className="text-slate-400 font-semibold">Lighting:</span>
            <div className="flex gap-1">
              {(['neon', 'daylight'] as AtmosphereMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onUpdateSettings({ atmosphere: m })}
                  className={`px-2.5 py-1 rounded font-bold uppercase cursor-pointer ${
                    settings.atmosphere === m
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-between">
            <span className="text-slate-400 font-semibold">Menu-less [P]:</span>
            <button
              type="button"
              onClick={() => {
                onToggleCameraPause();
                onClose();
              }}
              className={`px-2.5 py-1 rounded font-bold uppercase cursor-pointer ${
                cameraPaused
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-800 text-slate-200 hover:text-white'
              }`}
            >
              {cameraPaused ? 'Frozen (Unpause)' : 'Freeze World'}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            type="button"
            data-testid="disable-debug-mode"
            onClick={() => onSelectMode('off')}
            className="px-4 py-2 rounded-lg border border-white/15 text-xs font-semibold text-slate-300 hover:text-white hover:border-white/35 transition-colors cursor-pointer"
          >
            Standard Race Mode (Off)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black tracking-[0.16em] uppercase transition-colors cursor-pointer"
          >
            Return to Viewport
          </button>
        </div>
      </div>
    </div>
  );
};

interface DebugModeOverlayProps {
  debugMode: DebugMode;
  cameraPaused: boolean;
  trackId: TrackId;
  onOpenDebugMenu: () => void;
  onToggleCameraPause: () => void;
  onSelectMode: (mode: DebugMode) => void;
  onTeleportSector: (t: number, heightOffset?: number, distance?: number, yaw?: number, pitch?: number) => void;
}

export const DebugModeOverlay: React.FC<DebugModeOverlayProps> = ({
  debugMode,
  cameraPaused,
  trackId,
  onOpenDebugMenu,
  onToggleCameraPause,
  onSelectMode,
  onTeleportSector,
}) => {
  if (debugMode === 'off' && !cameraPaused) return null;

  const isLava = trackId === 'lava' || trackId === 'lava_v2';

  return (
    <div
      data-testid="debug-hud-bar"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-xl border border-amber-400/45 text-xs text-white shadow-xl pointer-events-auto"
      style={{
        backgroundColor: 'rgba(8, 12, 22, 0.88)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono font-black text-[10px] uppercase tracking-wider">
        {debugMode === 'explore'
          ? 'EXPLORATION FREE-CAM'
          : debugMode === 'vehicle_orbit'
          ? '360° VEHICLE ORBIT'
          : 'CAMERA PAUSE [P]'}
      </span>

      {cameraPaused && (
        <span
          data-testid="camera-pause-badge"
          className="px-2 py-0.5 rounded bg-rose-500/25 border border-rose-400/50 text-rose-200 font-mono font-bold text-[10px] uppercase tracking-wider"
        >
          PAUSED [P] // CAMERA &amp; ZOOM ACTIVE
        </span>
      )}

      <span className="text-[11px] font-mono text-slate-300 hidden sm:inline">
        {debugMode === 'explore'
          ? 'Left-Drag/Arrows: Rotate · Right-Drag/WASD/QE: Pan · Scroll/+/-: Zoom'
          : 'Left-Drag/Arrows: 360° Rotate · Scroll/+/-: Zoom · [P]: Freeze'}
      </span>

      {debugMode === 'explore' && (
        <div className="flex items-center gap-1 border-l border-white/15 pl-2">
          <button
            type="button"
            onClick={() => onTeleportSector(0.01, 4, 28, 0.35, 0.25)}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-[10px] font-semibold cursor-pointer"
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() =>
              isLava
                ? onTeleportSector(0.22, 6, 42, -0.6, 0.32)
                : onTeleportSector(0.24, 10, 48, -0.5, 0.28)
            }
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-[10px] font-semibold cursor-pointer"
          >
            {isLava ? 'Parabolica' : 'Spire Bend'}
          </button>
          <button
            type="button"
            onClick={() =>
              isLava
                ? onTeleportSector(0.415, 2.5, 22, 0.15, 0.14)
                : onTeleportSector(0.52, 8, 44, 0.4, 0.24)
            }
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-[10px] font-semibold cursor-pointer"
          >
            {isLava ? 'Volcano Tunnel' : 'Overpass'}
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 border-l border-white/15 pl-2">
        <button
          type="button"
          onClick={onToggleCameraPause}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono font-bold text-[10px] uppercase cursor-pointer"
        >
          {cameraPaused ? 'Resume [P]' : 'Freeze [P]'}
        </button>
        <button
          type="button"
          onClick={onOpenDebugMenu}
          className="px-2.5 py-1 rounded bg-amber-400/20 border border-amber-400/50 hover:bg-amber-400 hover:text-slate-950 text-amber-200 font-mono font-bold text-[10px] uppercase cursor-pointer"
        >
          Menu [K+E+S]
        </button>
        {debugMode !== 'off' && (
          <button
            type="button"
            onClick={() => onSelectMode('off')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-500/80 text-slate-300 hover:text-white font-mono font-bold text-[10px] uppercase cursor-pointer"
          >
            Exit
          </button>
        )}
      </div>
    </div>
  );
};

