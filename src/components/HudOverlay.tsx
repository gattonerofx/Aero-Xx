import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActiveWeaponId, GameSettings, HudTelemetry, PowerUpItemType } from '../game/types';
import {
  BONUS_META,
  MUSIC_THEMES,
  POWERUP_ITEMS_ORDER,
  POWERUP_META,
  POWERUP_REFERENCE_IMAGE,
  WEAPON_ITEMS_ORDER,
  WEAPON_META,
  formatOrdinal,
  formatRaceTime,
} from '../game/rules';

export const PowerUpSpriteIcon: React.FC<{
  type: PowerUpItemType;
  sizeClass?: string;
}> = ({ type, sizeClass = 'w-10 h-10' }) => {
  const meta = POWERUP_META[type];
  const bgPosX = meta.spriteCol === 0 ? '5%' : meta.spriteCol === 1 ? '50%' : '95%';
  const bgPosY = meta.spriteRow === 0 ? '8%' : '88%';

  return (
    <div
      className={`relative rounded-lg overflow-hidden shrink-0 border bg-white ${sizeClass}`}
      style={{
        borderColor: meta.color,
        boxShadow: `0 0 12px ${meta.color}66, inset 0 0 6px ${meta.color}44`,
      }}
      title={meta.label}
    >
      <div
        className="w-full h-full"
        style={{
          backgroundImage: `url('${POWERUP_REFERENCE_IMAGE}')`,
          backgroundSize: '315% 235%',
          backgroundPosition: `${bgPosX} ${bgPosY}`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
};

export const WeaponSvgIcon: React.FC<{
  type: ActiveWeaponId;
  sizeClass?: string;
}> = ({ type, sizeClass = 'w-10 h-10' }) => {
  const meta = WEAPON_META[type];
  return (
    <div
      className={`relative rounded-lg overflow-hidden shrink-0 border flex items-center justify-center bg-slate-950 ${sizeClass}`}
      style={{
        borderColor: meta.color,
        boxShadow: `0 0 12px ${meta.color}66, inset 0 0 8px ${meta.color}33`,
      }}
      title={meta.label}
    >
      {type === 'missile' && (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={meta.color} strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H11.25m8.25 0v8.25" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 14l4 4M3 17l4 4" />
        </svg>
      )}
      {type === 'laser' && (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={meta.color} strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M7 6l5-4 5 4M5 12h14M8 17h8" />
        </svg>
      )}
      {type === 'shockwave' && (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={meta.color} strokeWidth="2">
          <circle cx="12" cy="12" r="3" fill={meta.color} />
          <circle cx="12" cy="12" r="6.5" strokeDasharray="3 2" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      )}
      {type === 'mines' && (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={meta.color} strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path strokeLinecap="round" d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8" />
        </svg>
      )}
    </div>
  );
};

interface HudOverlayProps {
  telemetry: HudTelemetry;
  settings: GameSettings;
  demoMode: boolean;
  onOpenSettings: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onCycleCamera: () => void;
  onCycleMusicTheme: () => void;
  onTriggerBoost: (active: boolean) => void;
  onTriggerBonus: () => void;
  onTriggerWeapon?: () => void;
  onTakeControl: () => void;
  onExitDemo: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  telemetry,
  settings,
  demoMode,
  onOpenSettings,
  onTogglePause,
  onToggleMute,
  onCycleCamera,
  onCycleMusicTheme,
  onTriggerBoost,
  onTriggerBonus,
  onTriggerWeapon,
  onTakeControl,
  onExitDemo,
}) => {
  const { num: rankNum, suffix: rankSuffix } = formatOrdinal(telemetry.position);

  // Retractable Top-Right Controls Drawer state (auto-fades to the right after 4.5s)
  const [controlsOpen, setControlsOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const autoHideTimerRef = useRef<number | null>(null);

  const scheduleAutoHide = useCallback(() => {
    if (autoHideTimerRef.current !== null) {
      window.clearTimeout(autoHideTimerRef.current);
    }
    autoHideTimerRef.current = window.setTimeout(() => {
      setControlsOpen(false);
    }, 4500);
  }, []);

  const handleToggleControlsDrawer = useCallback(() => {
    setControlsOpen((prev) => {
      const next = !prev;
      if (next) {
        scheduleAutoHide();
      } else if (autoHideTimerRef.current !== null) {
        window.clearTimeout(autoHideTimerRef.current);
      }
      return next;
    });
  }, [scheduleAutoHide]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyI' && !e.repeat) {
        setCodexOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (autoHideTimerRef.current !== null) {
        window.clearTimeout(autoHideTimerRef.current);
      }
    };
  }, []);

  // Compute SVG arc for speedometer (0 .. 1350 KM/H)
  const maxGaugeSpeed = 1350;
  const speedRatio = Math.min(1, Math.max(0, telemetry.speedKmh / maxGaugeSpeed));
  const arcRadius = 56;
  const arcCircumference = Math.PI * arcRadius; // Semicircle length
  const strokeDashoffset = arcCircumference * (1 - speedRatio);

  // Compute normalized minimap SVG path & racer dots
  const minimapData = useMemo(() => {
    const pts = telemetry.minimapPoints;
    if (!pts || pts.length === 0) {
      return { pathD: '', transformPt: (_x: number, _y: number) => ({ cx: 75, cy: 75 }) };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scale = 92 / Math.max(spanX, spanY);
    const cxOffset = 75 - ((minX + maxX) * 0.5) * scale;
    const cyOffset = 75 - ((minY + maxY) * 0.5) * scale;

    const transformPt = (x: number, y: number) => ({
      cx: x * scale + cxOffset,
      cy: y * scale + cyOffset,
    });

    const d =
      pts
        .map((p, idx) => {
          const { cx, cy } = transformPt(p.x, p.y);
          return `${idx === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
        })
        .join(' ') + ' Z';

    return { pathD: d, transformPt };
  }, [telemetry.minimapPoints]);

  const energySegments = 12;
  const filledSegments = Math.round((telemetry.energy / 100) * energySegments);
  const bonusInfo = BONUS_META[telemetry.heldBonus];

  const cameraLabel =
    settings.cameraMode === 'chase'
      ? 'Chase'
      : settings.cameraMode === 'close'
      ? 'Close'
      : 'Cockpit';

  const activeMusicSpec =
    MUSIC_THEMES.find((m) => m.id === settings.musicTheme) ?? MUSIC_THEMES[0];

  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none select-none flex flex-col justify-between p-3.5 md:p-5"
      style={{ fontFamily: "'Chakra Petch', 'Plus Jakarta Sans', sans-serif" }}
    >
      {/* TOP-CENTER STATUS CALLOUTS & MESSAGES (Anchored cleanly at the very top of the viewport, never blocking center track!) */}
      <div className="fixed top-3.5 md:top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none max-w-[60vw]">
        {telemetry.statusBanner && (
          <div
            className="px-3.5 py-1 rounded border border-cyan-400/45 text-[11px] md:text-xs font-bold tracking-[0.24em] text-cyan-100 uppercase whitespace-nowrap"
            style={{
              backgroundColor: 'rgba(6, 12, 26, 0.84)',
              boxShadow: '0 0 16px rgba(0, 242, 254, 0.22)',
              textShadow: '0 0 12px rgba(0, 242, 254, 0.8), 0 1px 4px rgba(0,0,0,0.95)',
            }}
          >
            {telemetry.statusBanner}
          </div>
        )}

        {(telemetry.introPhase === 'overview' || telemetry.introPhase === 'lock') && (
          <div className="mt-1 px-2.5 py-0.5 rounded bg-slate-950/70 text-[9px] md:text-[10px] font-mono tracking-[0.2em] text-cyan-200/85 uppercase whitespace-nowrap">
            {telemetry.introPhase === 'overview'
              ? 'PANORAMIC SECTOR RECON // [SHIFT] TO SKIP'
              : 'TURBINE LOCK SEQUENCE // PREPARING COUNTDOWN'}
          </div>
        )}
      </div>

      {/* TOP BAR: Compact Left Race Telemetry & Retractable Right Controls */}
      <div className="flex items-start justify-between w-full">
        {/* COMPACT TOP-LEFT CLUSTER: Position, Lap Timer & Grip */}
        <div
          className="flex flex-col gap-1.5 px-3 py-2 rounded-lg border border-cyan-400/25 w-[176px] md:w-[192px]"
          style={{
            background:
              'linear-gradient(135deg, rgba(6, 12, 26, 0.82) 0%, rgba(6, 12, 26, 0.44) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(0, 242, 254, 0.2), 0 6px 18px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Row 1: Position + Lap side-by-side */}
          <div className="flex items-baseline justify-between leading-none">
            <div className="flex items-baseline gap-1">
              <div
                className="flex items-baseline gap-0.5 text-cyan-300"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  textShadow: '0 0 14px rgba(0, 242, 254, 0.7), 0 1px 4px rgba(0,0,0,0.95)',
                }}
              >
                <span className="text-2xl md:text-3xl font-black tabular-nums tracking-tight text-white">
                  {rankNum}
                </span>
                <span className="text-xs font-bold text-cyan-300">{rankSuffix}</span>
              </div>
              <span className="text-[9px] font-semibold tracking-wider text-cyan-100/70">
                /{telemetry.totalRacers}
              </span>
            </div>

            <div className="text-[10px] font-semibold tracking-[0.14em] text-slate-300">
              LAP{' '}
              <span
                className="text-sm font-bold text-white tabular-nums"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                {telemetry.lap}
              </span>
              <span className="text-slate-400">/{telemetry.totalLaps}</span>
            </div>
          </div>

          <div className="h-[1px] w-full bg-gradient-to-r from-cyan-400/35 via-pink-400/25 to-transparent" />

          {/* Row 2: Compact Lap Time & Best Lap */}
          <div className="flex items-baseline justify-between leading-none">
            <div
              className="text-base md:text-lg font-bold text-white tabular-nums tracking-wider"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                textShadow: '0 0 10px rgba(56, 189, 248, 0.4)',
              }}
            >
              {formatRaceTime(telemetry.currentLapTimeMs)}
            </div>
            <div className="text-[9px] font-mono tracking-wider text-cyan-200/70 tabular-nums">
              BEST {formatRaceTime(telemetry.bestLapTimeMs)}
            </div>
          </div>

          {/* Row 3: Weather & Grip + Compact Ring Overcharge badge */}
          <div className="flex items-center justify-between gap-1.5 text-[9px] font-mono tracking-wider pt-0.5 border-t border-white/10">
            <span
              data-testid="hud-weather-label"
              className="font-bold text-cyan-200/90 uppercase truncate"
            >
              {telemetry.weatherLabel}
            </span>
            <span
              data-testid="hud-grip-value"
              className={`font-bold tabular-nums px-1 py-0.2 rounded border shrink-0 ${
                telemetry.surfaceGripPct < 75
                  ? 'border-amber-400/50 text-amber-300 bg-amber-950/60'
                  : 'border-cyan-400/40 text-cyan-200 bg-cyan-950/50'
              }`}
            >
              GRIP {telemetry.surfaceGripPct}%
            </span>
          </div>

          {/* Row 4: Gold Credits (Credit Bonus) & Crystal Bonus Score / Upgrade Lv */}
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-white/10 text-[9px] font-mono">
            <div
              data-testid="hud-credits-counter"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/65 border border-amber-400/45 text-amber-300 font-bold"
              title="Credits earned from Gold Credit Bonus tokens"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>CR {telemetry.totalCredits + telemetry.creditsEarned}</span>
            </div>
            <div
              data-testid="hud-crystal-counter"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-fuchsia-950/65 border border-fuchsia-400/45 text-fuchsia-200 font-bold"
              title="Crystal Bonus points & active vehicle upgrade level"
            >
              <span className="w-2 h-2 rotate-45 bg-fuchsia-400 inline-block" />
              <span>
                {telemetry.crystalPoints} PT
                {telemetry.crystalUpgradeLevel > 0 ? ` · LV${telemetry.crystalUpgradeLevel}` : ''}
              </span>
            </div>
          </div>

          {telemetry.ringChain > 0 && (
            <div className="flex items-center justify-between px-2 py-0.5 rounded border border-cyan-400/50 bg-cyan-950/75 text-[9px] font-bold tracking-wider text-cyan-200">
              <span>OVERCHARGE x{telemetry.ringChain}</span>
              <span className="text-cyan-300">+{telemetry.ringChain * 28} KM/H</span>
            </div>
          )}

          {telemetry.shieldActive && (
            <div className="flex items-center justify-between px-2 py-0.5 rounded border border-indigo-400/60 bg-indigo-950/80 text-[9px] font-bold tracking-wider text-indigo-200">
              <span>HEX SHIELD GRID</span>
              <span className="text-indigo-300 tabular-nums">{telemetry.shieldRemainingSec}s</span>
            </div>
          )}
        </div>

        {/* TOP-RIGHT CLUSTER: Retractable Controls Drawer + Persistent Trigger Icon */}
        <div
          className="flex items-start gap-2 pointer-events-auto"
          onMouseEnter={() => {
            if (controlsOpen) scheduleAutoHide();
          }}
          onMouseMove={() => {
            if (controlsOpen) scheduleAutoHide();
          }}
        >
          {/* Retractable Sliding Drawer that fades away to the right after a few seconds */}
          <div
            className={`flex flex-col items-end gap-1.5 transition-all duration-300 ease-out ${
              controlsOpen
                ? 'opacity-100 translate-x-0 pointer-events-auto'
                : 'opacity-0 translate-x-8 pointer-events-none'
            }`}
          >
            <div className="flex items-center flex-wrap justify-end gap-1.5">
              {demoMode && (
                <>
                  <span
                    data-testid="hud-demo-badge"
                    className="px-2.5 py-1 rounded border border-amber-400/70 bg-amber-950/85 text-amber-200 text-[10px] font-bold tracking-[0.14em] uppercase whitespace-nowrap shrink-0"
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      boxShadow: '0 0 12px rgba(251, 191, 36, 0.3)',
                    }}
                  >
                    DEMO // AUTOPILOT
                  </span>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      scheduleAutoHide();
                      onTakeControl();
                    }}
                    className="px-2.5 py-1 rounded border border-cyan-400/70 bg-cyan-950/85 hover:bg-cyan-900/90 text-cyan-200 hover:text-white text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Take Control
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      scheduleAutoHide();
                      onExitDemo();
                    }}
                    className="px-2.5 py-1 rounded border border-rose-400/60 bg-rose-950/80 hover:bg-rose-900/85 text-rose-200 hover:text-white text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Exit Demo
                  </button>
                </>
              )}

              <button
                type="button"
                tabIndex={-1}
                onMouseDown={() => {
                  scheduleAutoHide();
                  onTriggerBoost(true);
                }}
                onMouseUp={() => onTriggerBoost(false)}
                onMouseLeave={() => onTriggerBoost(false)}
                onTouchStart={() => {
                  scheduleAutoHide();
                  onTriggerBoost(true);
                }}
                onTouchEnd={() => onTriggerBoost(false)}
                onClick={(e) => {
                  e.currentTarget.blur();
                  scheduleAutoHide();
                  onTriggerBoost(true);
                  window.setTimeout(() => onTriggerBoost(false), 600);
                }}
                className="px-3 py-1 rounded border border-cyan-400/50 text-[10px] font-bold tracking-[0.15em] text-white hover:border-cyan-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: telemetry.isBoosting
                    ? 'rgba(6, 182, 212, 0.55)'
                    : 'rgba(8, 13, 26, 0.88)',
                }}
              >
                SHIFT - BOOST
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  scheduleAutoHide();
                  onOpenSettings();
                }}
                aria-label="Open Settings"
                className="px-2.5 py-1 rounded border border-white/25 text-[10px] font-semibold tracking-wider text-slate-200 hover:text-white hover:border-cyan-400/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(8, 13, 26, 0.88)' }}
              >
                Settings
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  scheduleAutoHide();
                  onTogglePause();
                }}
                aria-label="Pause Game"
                className="px-2.5 py-1 rounded border border-white/25 text-[10px] font-semibold tracking-wider text-slate-200 hover:text-white hover:border-cyan-400/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(8, 13, 26, 0.88)' }}
              >
                Pause [P]
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  scheduleAutoHide();
                  onToggleMute();
                }}
                aria-label={settings.muted ? 'Unmute Audio' : 'Mute Audio'}
                className="px-2.5 py-1 rounded border border-white/25 text-[10px] font-semibold text-slate-200 hover:text-white hover:border-cyan-400/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(8, 13, 26, 0.88)' }}
              >
                {settings.muted ? 'Muted' : 'Audio'}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Live In-Race Musical Theme Switcher */}
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  scheduleAutoHide();
                  onCycleMusicTheme();
                }}
                className="px-2.5 py-0.5 rounded border border-pink-400/35 text-[10px] font-medium tracking-wider text-pink-100 hover:text-white hover:border-pink-400/70 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(8, 13, 26, 0.86)' }}
              >
                Music: {activeMusicSpec.shortLabel}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  scheduleAutoHide();
                  onCycleCamera();
                }}
                className="px-2.5 py-0.5 rounded border border-cyan-400/25 text-[10px] font-medium tracking-wider text-cyan-100 hover:text-white hover:border-cyan-400/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(8, 13, 26, 0.86)' }}
              >
                Cam: {cameraLabel}
              </button>
            </div>
          </div>

          {/* Persistent Top-Right Icon Button to Reveal / Retract the Controls Drawer */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              handleToggleControlsDrawer();
            }}
            aria-label="Toggle HUD Controls"
            title="Show / Hide Quick Controls & Autopilot Bar"
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              controlsOpen
                ? 'border-cyan-400 text-cyan-300 shadow-[0_0_14px_rgba(0,242,254,0.35)]'
                : demoMode
                ? 'border-amber-400/60 text-amber-300 hover:border-amber-300'
                : 'border-white/25 text-slate-300 hover:text-white hover:border-cyan-400/60'
            }`}
            style={{ backgroundColor: 'rgba(8, 13, 26, 0.88)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              {controlsOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M10 18h10" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* DIEGETIC 3-2-1-GO COUNTDOWN RETICLE (Only shown during countdown) */}
      {telemetry.countdownValue >= 0 && (
        <div className="flex flex-col items-center justify-center my-auto pb-8 pointer-events-none">
          <div className="relative flex flex-col items-center justify-center">
            {/* 3-Stage Launch Gantry Lights */}
            <div
              className="flex items-center gap-2 mb-2.5 px-3.5 py-1 rounded-full border border-cyan-400/35"
              style={{ backgroundColor: 'rgba(6, 12, 26, 0.88)' }}
            >
              {[3, 2, 1].map((stageNum) => {
                const isLit = telemetry.countdownValue <= stageNum;
                const stageColor =
                  telemetry.countdownValue === 0
                    ? '#34d399'
                    : stageNum === 3
                    ? '#fb923c'
                    : stageNum === 2
                    ? '#facc15'
                    : '#00f2fe';
                return (
                  <div key={stageNum} className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-2 rounded-sm transition-all duration-75"
                      style={{
                        backgroundColor: isLit ? stageColor : 'rgba(30, 41, 59, 0.75)',
                        boxShadow: isLit ? `0 0 12px ${stageColor}` : 'none',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Orbital SVG Countdown Ring + High-Impact Numeral */}
            <div className="relative w-32 h-32 md:w-36 md:h-36 flex items-center justify-center">
              <svg viewBox="0 0 180 180" className="absolute inset-0 w-full h-full">
                <circle
                  cx="90"
                  cy="90"
                  r="76"
                  fill="rgba(6, 12, 26, 0.62)"
                  stroke="rgba(56, 189, 248, 0.25)"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                />
                <circle
                  cx="90"
                  cy="90"
                  r="66"
                  fill="none"
                  stroke={
                    telemetry.countdownValue === 0
                      ? '#34d399'
                      : telemetry.countdownValue === 3
                      ? '#fb923c'
                      : telemetry.countdownValue === 2
                      ? '#facc15'
                      : '#00f2fe'
                  }
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 66}
                  strokeDashoffset={
                    telemetry.countdownValue === 0
                      ? 0
                      : 2 * Math.PI * 66 * (1 - telemetry.countdownProgress)
                  }
                  transform="rotate(-90 90 90)"
                />
              </svg>

              <div
                data-testid="hud-countdown-numeral"
                className="font-black leading-none tabular-nums tracking-tight"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: telemetry.countdownValue === 0 ? '2.25rem' : '4.25rem',
                  color:
                    telemetry.countdownValue === 0
                      ? '#34d399'
                      : telemetry.countdownValue === 3
                      ? '#fed7aa'
                      : telemetry.countdownValue === 2
                      ? '#fef08a'
                      : '#e0f2fe',
                  transform: `scale(${
                    telemetry.countdownValue === 0
                      ? 1.08
                      : 1 + telemetry.countdownProgress * 0.2
                  })`,
                  textShadow:
                    telemetry.countdownValue === 0
                      ? '0 0 32px rgba(52, 211, 153, 0.95)'
                      : '0 0 32px rgba(0, 242, 254, 0.95)',
                }}
              >
                {telemetry.countdownValue === 0 ? 'GO!' : telemetry.countdownValue}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM BAR: Compact Speedometer + Energy + Bonus Module & Right Track Radar Minimap */}
      <div className="flex items-end justify-between w-full gap-3 mt-auto">
        {/* COMPACT BOTTOM-LEFT CLUSTER: Speedometer + Energy Bar + Bonus Module */}
        <div
          className="flex items-end gap-3.5 flex-wrap px-3 py-2 rounded-xl border border-cyan-400/25"
          style={{
            background:
              'linear-gradient(135deg, rgba(6, 12, 26, 0.86) 0%, rgba(10, 16, 34, 0.65) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(0, 242, 254, 0.22), 0 8px 22px rgba(0, 0, 0, 0.55)',
          }}
        >
          {/* Compact Semi-Circular Arc Speedometer Gauge */}
          <div className="relative w-32 h-18 flex flex-col items-center justify-end">
            <svg
              viewBox="0 0 140 82"
              className="w-full h-full overflow-visible"
              aria-label="Speedometer gauge"
            >
              <defs>
                <linearGradient id="speedArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00f2fe" />
                  <stop offset="60%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
              </defs>
              {/* Outer housing glow arc */}
              <path
                d="M 14 72 A 56 56 0 0 1 126 72"
                fill="none"
                stroke="rgba(15, 23, 42, 0.9)"
                strokeWidth="11"
                strokeLinecap="round"
              />
              {/* Background track arc */}
              <path
                d="M 14 72 A 56 56 0 0 1 126 72"
                fill="none"
                stroke="rgba(56, 189, 248, 0.22)"
                strokeWidth="5.5"
                strokeLinecap="round"
              />
              {/* Soft outer bloom arc */}
              <path
                d="M 14 72 A 56 56 0 0 1 126 72"
                fill="none"
                stroke={telemetry.isBoosting ? '#f472b6' : '#00f2fe'}
                strokeOpacity="0.35"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={arcCircumference}
                strokeDashoffset={strokeDashoffset}
              />
              {/* Active speed fill arc */}
              <path
                d="M 14 72 A 56 56 0 0 1 126 72"
                fill="none"
                stroke="url(#speedArcGrad)"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeDasharray={arcCircumference}
                strokeDashoffset={strokeDashoffset}
              />
              {/* Radial Tick Marks around inner rim */}
              {Array.from({ length: 9 }).map((_, idx) => {
                const angle = Math.PI + (idx / 8) * Math.PI;
                const x1 = 70 + Math.cos(angle) * 43;
                const y1 = 72 + Math.sin(angle) * 43;
                const x2 = 70 + Math.cos(angle) * 48;
                const y2 = 72 + Math.sin(angle) * 48;
                return (
                  <line
                    key={idx}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={idx >= 6 ? 'rgba(244, 114, 182, 0.85)' : 'rgba(226, 232, 240, 0.72)'}
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>

            <div className="absolute bottom-0 flex flex-col items-center leading-none">
              <span
                data-testid="hud-speed-value"
                className="text-2xl md:text-3xl font-black text-white tabular-nums tracking-tight"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  textShadow: '0 0 14px rgba(0, 242, 254, 0.75)',
                }}
              >
                {telemetry.speedKmh}
              </span>
              <span className="text-[9px] font-bold tracking-[0.22em] text-cyan-200 mt-0.5">
                KM/H
              </span>
            </div>
          </div>

          {/* Compact Segmented Hull Energy Bar & Nitro Fuel Reserve Readout */}
          <div className="flex flex-col pb-0.5 min-w-[162px]">
            <div className="flex items-baseline justify-between mb-1">
              <span
                className={`text-[9px] font-bold tracking-[0.16em] ${
                  telemetry.energy <= 25 ? 'text-rose-400 animate-pulse' : 'text-cyan-100/90'
                }`}
              >
                {telemetry.isDestroyed
                  ? 'HULL DESTROYED!'
                  : telemetry.energy <= 25
                  ? 'CRITICAL HULL ENERGY!'
                  : 'HULL ENERGY'}
              </span>
              <span
                data-testid="hud-energy-value"
                className={`text-xs font-bold tabular-nums ${
                  telemetry.energy <= 25 ? 'text-rose-400' : 'text-white'
                }`}
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                {telemetry.energy}%
              </span>
            </div>

            {/* 12-segment neon hull/energy bar */}
            <div className="flex items-center gap-1">
              {Array.from({ length: energySegments }).map((_, idx) => {
                const active = idx < filledSegments;
                const segColors = [
                  '#00f2fe',
                  '#00f2fe',
                  '#38bdf8',
                  '#38bdf8',
                  '#60a5fa',
                  '#818cf8',
                  '#a78bfa',
                  '#c084fc',
                  '#d946ef',
                  '#e879f9',
                  '#f472b6',
                  '#fb7185',
                ];
                const barColor = telemetry.energy <= 25 ? '#f43f5e' : segColors[idx];
                return (
                  <div
                    key={idx}
                    className="h-2.5 w-2.5 rounded-[1px] transition-opacity duration-75"
                    style={{
                      backgroundColor: active ? barColor : 'rgba(30, 41, 59, 0.75)',
                      boxShadow: active ? `0 0 8px ${barColor}aa` : 'none',
                    }}
                  />
                );
              })}
            </div>

            {/* NITRO POWER-UP Blue Fuel Reserve Bar */}
            <div className="mt-1.5 flex items-center justify-between text-[8px] font-mono tracking-wider">
              <span className="text-sky-300 font-bold">
                {telemetry.nitroActive ? 'NITRO OVERDRIVE ACTIVE!' : 'NITRO FUEL RESERVE'}
              </span>
              <span data-testid="hud-nitro-value" className="text-sky-200 font-bold tabular-nums">
                {telemetry.nitroReserve}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-900/90 border border-sky-400/30 overflow-hidden mt-0.5">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${Math.min(100, Math.max(0, telemetry.nitroReserve))}%`,
                  background: telemetry.nitroActive
                    ? 'linear-gradient(90deg, #38bdf8 0%, #e0f2fe 100%)'
                    : 'linear-gradient(90deg, #0284c7 0%, #00d2ff 100%)',
                  boxShadow: '0 0 10px rgba(0, 210, 255, 0.7)',
                }}
              />
            </div>

            <div className="mt-1 flex items-center justify-between">
              <span
                className={`text-[8.5px] font-bold tracking-[0.12em] ${
                  telemetry.energy <= 25
                    ? 'text-rose-400 animate-pulse'
                    : telemetry.isBoosting
                    ? 'text-pink-300'
                    : telemetry.boostReady
                    ? 'text-cyan-200'
                    : 'text-amber-400'
                }`}
              >
                {telemetry.isDestroyed
                  ? '0% ENERGY // VEHICLE EXPLODED'
                  : telemetry.energy <= 25
                  ? 'DANGER: 0% ENERGY = EXPLOSION!'
                  : telemetry.isBoosting
                  ? 'TURBINE BOOST ENGAGED'
                  : 'BOOST [SHIFT] · BOX [SPACE] · WEAPON [Z]'}
              </span>
            </div>
          </div>

          {/* IN-GAME POWER-UP / BONUS BOX + ARMY / WEAPON BAY WIDGETS */}
          <div className="relative pointer-events-auto pb-0.5 flex items-end gap-1.5 flex-wrap">
            {/* Live Floating In-Game Box Pickup Notification Toast when a power-up or weapon box is collected */}
            {telemetry.lastCollectedWeapon && telemetry.lastCollectedTimer > 0 ? (
              <div
                data-testid="hud-weapon-pickup-toast"
                className="absolute bottom-full left-0 mb-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-slate-950/95 whitespace-nowrap pointer-events-none z-30"
                style={{
                  borderColor: WEAPON_META[telemetry.lastCollectedWeapon].color,
                  boxShadow: `0 0 18px ${WEAPON_META[telemetry.lastCollectedWeapon].color}44`,
                }}
              >
                <WeaponSvgIcon type={telemetry.lastCollectedWeapon} sizeClass="w-8 h-8" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-black tracking-wider uppercase"
                      style={{ color: WEAPON_META[telemetry.lastCollectedWeapon].color }}
                    >
                      {WEAPON_META[telemetry.lastCollectedWeapon].label}
                    </span>
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-rose-500/25 text-rose-200">
                      ARMED [Z]
                    </span>
                  </div>
                  <div className="text-[9px] font-bold text-slate-200">
                    {WEAPON_META[telemetry.lastCollectedWeapon].effectBadge} · Press [Z] to fire
                  </div>
                </div>
              </div>
            ) : telemetry.lastCollectedPowerUp && telemetry.lastCollectedTimer > 0 ? (
              <div
                data-testid="hud-powerup-pickup-toast"
                className="absolute bottom-full left-0 mb-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-slate-950/95 whitespace-nowrap pointer-events-none z-30"
                style={{
                  borderColor: POWERUP_META[telemetry.lastCollectedPowerUp].color,
                  boxShadow: `0 0 18px ${POWERUP_META[telemetry.lastCollectedPowerUp].color}44`,
                }}
              >
                <PowerUpSpriteIcon
                  type={telemetry.lastCollectedPowerUp}
                  sizeClass="w-8 h-8"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-black tracking-wider uppercase"
                      style={{ color: POWERUP_META[telemetry.lastCollectedPowerUp].color }}
                    >
                      {POWERUP_META[telemetry.lastCollectedPowerUp].label}
                    </span>
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-white/10 text-white">
                      COLLECTED
                    </span>
                  </div>
                  <div className="text-[9px] font-bold text-slate-200">
                    {POWERUP_META[telemetry.lastCollectedPowerUp].effectBadge}
                  </div>
                </div>
              </div>
            ) : null}

            {/* POWER-UP BOX SLOT [SPACE] */}
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-powerup-box-button"
              disabled={telemetry.heldBonus === 'none' && telemetry.nitroReserve < 25}
              onClick={(e) => {
                e.currentTarget.blur();
                onTriggerBonus();
              }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-all ${
                telemetry.heldBonus !== 'none' || telemetry.nitroReserve >= 25
                  ? 'border-cyan-400/80 hover:border-cyan-300 cursor-pointer'
                  : 'border-white/15 opacity-80 cursor-default'
              }`}
              style={{
                backgroundColor: 'rgba(8, 13, 26, 0.94)',
                boxShadow:
                  telemetry.heldBonus !== 'none'
                    ? `0 0 16px ${bonusInfo.color}38, inset 0 0 10px ${bonusInfo.color}22`
                    : 'none',
              }}
            >
              {bonusInfo.powerUpId ? (
                <PowerUpSpriteIcon type={bonusInfo.powerUpId} sizeClass="w-10 h-10" />
              ) : telemetry.nitroReserve >= 25 ? (
                <PowerUpSpriteIcon type="nitro" sizeClass="w-10 h-10" />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 border border-dashed border-cyan-400/40 bg-slate-900/90"
                  title="In-Game Power-Up Box Empty"
                >
                  <span className="text-[8px] font-mono font-bold text-cyan-300/80">BOX</span>
                  <span className="text-[7px] font-mono text-slate-400">EMPTY</span>
                </div>
              )}

              <div className="min-w-[126px]">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[8px] font-mono font-bold tracking-[0.14em] text-cyan-300 uppercase">
                    {telemetry.heldBonus !== 'none' ? 'LOCKED UNTIL USED' : 'POWER-UP BOX'}
                  </span>
                  <span className="text-[8px] font-mono font-bold px-1 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-400/40">
                    [SPACE]
                  </span>
                </div>
                <div
                  data-testid="hud-powerup-box-label"
                  className="text-[10.5px] font-black tracking-wider uppercase truncate mt-0.5"
                  style={{
                    color:
                      telemetry.heldBonus !== 'none'
                        ? bonusInfo.color
                        : telemetry.nitroReserve >= 25
                        ? '#00d2ff'
                        : '#94a3b8',
                  }}
                >
                  {telemetry.heldBonus !== 'none'
                    ? bonusInfo.label
                    : telemetry.nitroReserve >= 25
                    ? 'NITRO RESERVE READY'
                    : bonusInfo.label}
                </div>
                <div className="text-[8.5px] text-slate-300 max-w-[140px] truncate">
                  {telemetry.heldBonus !== 'none'
                    ? bonusInfo.effectBadge ?? bonusInfo.description
                    : telemetry.nitroReserve >= 25
                    ? 'Press [SPACE] for blue-fuel boost'
                    : 'Hit track boxes to arm power-up'}
                </div>
              </div>
            </button>

            {/* ARMY / WEAPON BAY SLOT [Z] */}
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-weapon-box-button"
              disabled={telemetry.heldWeapon === 'none'}
              onClick={(e) => {
                e.currentTarget.blur();
                onTriggerWeapon?.();
              }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-all ${
                telemetry.heldWeapon !== 'none'
                  ? 'border-rose-400/85 hover:border-rose-300 cursor-pointer'
                  : 'border-white/15 opacity-80 cursor-default'
              }`}
              style={{
                backgroundColor: 'rgba(8, 13, 26, 0.94)',
                boxShadow:
                  telemetry.heldWeapon !== 'none'
                    ? `0 0 18px ${WEAPON_META[telemetry.heldWeapon].color}44, inset 0 0 10px ${WEAPON_META[telemetry.heldWeapon].color}22`
                    : 'none',
              }}
            >
              {telemetry.heldWeapon !== 'none' ? (
                <WeaponSvgIcon type={telemetry.heldWeapon} sizeClass="w-10 h-10" />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 border border-dashed border-rose-400/40 bg-slate-900/90"
                  title="Army / Weapon Bay Empty"
                >
                  <span className="text-[8px] font-mono font-bold text-rose-300/80">ARMY</span>
                  <span className="text-[7px] font-mono text-slate-400">EMPTY</span>
                </div>
              )}

              <div className="min-w-[132px]">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[8px] font-mono font-bold tracking-[0.14em] text-rose-300 uppercase">
                    {telemetry.heldWeapon !== 'none' ? 'LOCKED UNTIL USED' : 'ARMY WEAPON BAY'}
                  </span>
                  <span className="text-[8px] font-mono font-bold px-1 rounded bg-rose-500/25 text-rose-200 border border-rose-400/50">
                    [Z] FIRE
                  </span>
                </div>
                <div
                  data-testid="hud-weapon-box-label"
                  className="text-[10.5px] font-black tracking-wider uppercase truncate mt-0.5"
                  style={{
                    color:
                      telemetry.heldWeapon !== 'none'
                        ? WEAPON_META[telemetry.heldWeapon].color
                        : '#94a3b8',
                  }}
                >
                  {telemetry.heldWeapon !== 'none'
                    ? WEAPON_META[telemetry.heldWeapon].shortLabel
                    : 'WEAPON BAY EMPTY'}
                </div>
                <div className="text-[8.5px] text-slate-300 max-w-[146px] truncate">
                  {telemetry.heldWeapon !== 'none'
                    ? telemetry.targetLockedName &&
                      (telemetry.heldWeapon === 'missile' || telemetry.heldWeapon === 'laser')
                      ? `LOCK: ${telemetry.targetLockedName} · Press [Z]`
                      : `${WEAPON_META[telemetry.heldWeapon].effectBadge} · Press [Z]`
                    : 'Collect weapon crate to arm [Z]'}
                </div>
              </div>
            </button>

            {/* Quick Toggle Button to Inspect All 6 Power-Ups & 4 Army Weapons */}
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-powerup-codex-toggle"
              onClick={(e) => {
                e.currentTarget.blur();
                setCodexOpen((prev) => !prev);
              }}
              title="Inspect Power-Ups & Army Weapons [I]"
              className={`h-12 px-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 text-[8.5px] font-mono font-bold transition-all cursor-pointer shrink-0 ${
                codexOpen
                  ? 'border-cyan-300 bg-cyan-950/90 text-white shadow-[0_0_14px_rgba(0,242,254,0.4)]'
                  : 'border-cyan-400/35 bg-slate-950/90 text-cyan-200 hover:border-cyan-300 hover:text-white'
              }`}
            >
              <span>ARSENAL</span>
              <span className="text-[8px] text-cyan-400">[I]</span>
            </button>
          </div>
        </div>

        {/* INTERACTIVE IN-GAME POWER-UP & ARMY WEAPONS CODEX POPOVER */}
        {codexOpen && (
          <div
            data-testid="hud-powerup-codex-modal"
            className="fixed bottom-24 left-4 z-30 w-[94vw] max-w-[620px] max-h-[78vh] overflow-y-auto p-3.5 rounded-2xl border border-cyan-400/50 pointer-events-auto"
            style={{
              background:
                'linear-gradient(145deg, rgba(6, 11, 24, 0.96) 0%, rgba(10, 17, 36, 0.94) 100%)',
              boxShadow: '0 16px 42px rgba(0, 0, 0, 0.8), 0 0 24px rgba(0, 242, 254, 0.22)',
            }}
          >
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-cyan-400/25">
              <div>
                <div
                  className="text-xs font-black tracking-[0.18em] text-cyan-300 uppercase"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  ARMY WEAPONS [Z] &amp; POWER-UP BOXES [SPACE]
                </div>
                <div className="text-[10px] text-slate-300">
                  Held weapons &amp; power-ups lock their slot until used · Active Shield blocks all weapons &amp; wall damage
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCodexOpen(false)}
                className="px-2 py-0.5 rounded border border-white/20 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                CLOSE [I]
              </button>
            </div>

            <div className="text-[9.5px] font-mono font-bold tracking-[0.16em] text-rose-300 uppercase mb-1.5">
              ARMY / WEAPONS SYSTEM (PRESS [Z] TO FIRE — KEPT UNTIL USED)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              {WEAPON_ITEMS_ORDER.map((wType) => {
                const meta = WEAPON_META[wType];
                return (
                  <div
                    key={wType}
                    className="flex items-start gap-2.5 p-2 rounded-xl border border-rose-400/25 bg-slate-900/85"
                  >
                    <WeaponSvgIcon type={wType} sizeClass="w-10 h-10" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-[10px] font-black tracking-wider uppercase truncate"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[8px] font-mono font-bold px-1 py-0.2 rounded bg-rose-500/20 text-rose-200 shrink-0">
                          {meta.effectBadge}
                        </span>
                      </div>
                      <p className="text-[9.5px] text-slate-300 leading-snug mt-0.5">
                        {meta.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-[9.5px] font-mono font-bold tracking-[0.16em] text-cyan-300 uppercase mb-1.5">
              POWER-UP &amp; BONUS BOXES (PRESS [SPACE] TO ACTIVATE)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {POWERUP_ITEMS_ORDER.map((pType) => {
                const meta = POWERUP_META[pType];
                return (
                  <div
                    key={pType}
                    className="flex items-start gap-2.5 p-2 rounded-xl border border-white/10 bg-slate-900/80"
                  >
                    <PowerUpSpriteIcon type={pType} sizeClass="w-11 h-11" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-[10px] font-black tracking-wider uppercase truncate"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[8px] font-mono font-bold px-1 py-0.2 rounded bg-white/10 text-cyan-200 shrink-0">
                          {meta.effectBadge}
                        </span>
                      </div>
                      <p className="text-[9.5px] text-slate-300 leading-snug mt-0.5">
                        {meta.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* COMPACT BOTTOM-RIGHT CLUSTER: Circular Track Spline Radar Minimap */}
        <div
          className="relative w-28 h-28 md:w-32 md:h-32 rounded-full border border-cyan-400/45 flex items-center justify-center shrink-0"
          style={{
            backgroundColor: 'rgba(6, 11, 24, 0.86)',
            boxShadow:
              'inset 0 0 20px rgba(0, 242, 254, 0.2), 0 6px 18px rgba(0, 0, 0, 0.55)',
          }}
        >
          <svg viewBox="0 0 150 150" className="w-full h-full">
            <circle
              cx="75"
              cy="75"
              r="68"
              fill="none"
              stroke="rgba(56, 189, 248, 0.26)"
              strokeWidth="1.2"
              strokeDasharray="3 6"
            />
            <circle
              cx="75"
              cy="75"
              r="42"
              fill="none"
              stroke="rgba(56, 189, 248, 0.08)"
              strokeWidth="1"
            />
            <line
              x1="75"
              y1="10"
              x2="75"
              y2="140"
              stroke="rgba(56, 189, 248, 0.1)"
              strokeWidth="1"
            />
            <line
              x1="10"
              y1="75"
              x2="140"
              y2="75"
              stroke="rgba(56, 189, 248, 0.1)"
              strokeWidth="1"
            />

            {minimapData.pathD && (
              <>
                <path
                  d={minimapData.pathD}
                  fill="none"
                  stroke="rgba(0, 242, 254, 0.42)"
                  strokeWidth="6.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <path
                  d={minimapData.pathD}
                  fill="none"
                  stroke="#e0f2fe"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            )}

            {telemetry.racerDots.map((dot) => {
              const { cx, cy } = minimapData.transformPt(dot.x, dot.y);
              if (dot.isPlayer) {
                return (
                  <g key={dot.id} transform={`translate(${cx}, ${cy})`}>
                    <circle r="6" fill="rgba(0, 242, 254, 0.42)" />
                    <circle r="3.4" fill="#00f2fe" stroke="#ffffff" strokeWidth="1.3" />
                  </g>
                );
              }
              return (
                <circle
                  key={dot.id}
                  cx={cx}
                  cy={cy}
                  r="2.5"
                  fill="#fb7185"
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
