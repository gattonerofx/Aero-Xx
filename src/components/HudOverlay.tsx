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
  if (type === 'boost') {
    return (
      <div
        className={`relative rounded-lg overflow-hidden shrink-0 border flex items-center justify-center bg-slate-950 ${sizeClass}`}
        style={{
          borderColor: '#00e5ff',
          boxShadow: '0 0 14px rgba(0, 229, 255, 0.65), inset 0 0 8px rgba(0, 72, 255, 0.45)',
        }}
        title={meta.label}
      >
        <svg viewBox="0 0 64 64" className="w-4/5 h-4/5">
          {/* Top electric-blue closed-loop chevron */}
          <path
            d="M32 5 L55 21 L55 31 L32 15 L9 31 L9 21 Z"
            fill="#00d8ff"
            stroke="#0048ff"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M32 5 L55 21 L55 31 L32 15 L9 31 L9 21 Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          {/* Middle electric-blue closed-loop chevron */}
          <path
            d="M32 21 L55 37 L55 47 L32 31 L9 47 L9 37 Z"
            fill="#00bfff"
            stroke="#0048ff"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M32 21 L55 37 L55 47 L32 31 L9 47 L9 37 Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          {/* Bottom electric-blue closed-loop chevron */}
          <path
            d="M32 37 L55 53 L55 62 L32 46 L9 62 L9 53 Z"
            fill="#0095ff"
            stroke="#0048ff"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M32 37 L55 53 L55 62 L32 46 L9 62 L9 53 Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

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
  onTriggerThrottle?: (active: boolean) => void;
  onTriggerBrake?: (active: boolean) => void;
  onTriggerSteer?: (dir: number) => void;
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
  onTriggerThrottle,
  onTriggerBrake,
  onTriggerSteer,
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
  const bonusMeta = BONUS_META[telemetry.heldBonus];
  const hasBonus = telemetry.heldBonus !== 'none';
  const heldPowerUpType: PowerUpItemType | null =
    telemetry.heldBonus === 'hyper_turbine' || telemetry.heldBonus === 'boost'
      ? 'boost'
      : telemetry.heldBonus === 'plasma_shield' || telemetry.heldBonus === 'shield'
      ? 'shield'
      : telemetry.heldBonus === 'repair'
      ? 'repair'
      : telemetry.heldBonus === 'nitro'
      ? 'nitro'
      : telemetry.heldBonus === 'crystal'
      ? 'crystal'
      : telemetry.heldBonus === 'credit'
      ? 'credit'
      : null;
  const hasWeapon = telemetry.heldWeapon !== 'none';
  const weaponMeta =
    telemetry.heldWeapon !== 'none' ? WEAPON_META[telemetry.heldWeapon] : null;

  const cameraLabel =
    settings.cameraMode === 'perspective'
      ? 'Perspective'
      : settings.cameraMode === 'chase'
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
              ? 'STORM FRONT RECON // [SHIFT] TO SKIP'
              : 'SUPERCELL VORTEX LOCK // PREPARING COUNTDOWN'}
          </div>
        )}

        {/* VISUAL BOOST CHAIN COMBO MULTIPLIER CALLOUT (Displays when hitting consecutive boost pads) */}
        {(telemetry.boostComboCount ?? 0) > 0 && (
          <div
            data-testid="hud-boost-chain-banner"
            className="mt-1.5 flex flex-col items-center px-3 py-1 rounded-lg border border-cyan-400/65 backdrop-blur-[3px]"
            style={{
              background:
                'linear-gradient(135deg, rgba(0, 32, 84, 0.72) 0%, rgba(6, 12, 28, 0.62) 100%)',
              boxShadow:
                '0 0 18px rgba(0, 229, 255, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.28)',
            }}
          >
            <div className="flex items-center gap-2">
              {/* 3 Progressive Electric-Blue Chevrons that light up with the chain level */}
              <div className="flex items-center -space-x-1">
                {[1, 2, 3].map((idx) => {
                  const active = (telemetry.boostComboCount ?? 0) >= idx;
                  return (
                    <svg
                      key={idx}
                      viewBox="0 0 24 24"
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${
                        active ? 'scale-110' : 'opacity-35'
                      }`}
                    >
                      <path
                        d="M6 4 L16 12 L6 20 L10 20 L20 12 L10 4 Z"
                        fill={active ? '#00e5ff' : '#1e293b'}
                        stroke={active ? '#ffffff' : '#0048ff'}
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    </svg>
                  );
                })}
              </div>

              <span className="text-[10px] md:text-[11px] font-bold tracking-[0.18em] text-cyan-100 uppercase">
                BOOST CHAIN
              </span>

              <span
                data-testid="hud-boost-chain-multiplier"
                className="text-sm md:text-base font-black tabular-nums tracking-tight text-white px-1.5 py-0.2 rounded bg-cyan-500/30 border border-cyan-300/70"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  textShadow: '0 0 12px rgba(0, 229, 255, 0.95)',
                }}
              >
                x{telemetry.boostComboCount}
              </span>

              <span className="text-[9.5px] font-mono font-bold text-cyan-300 tabular-nums">
                +{235 + ((telemetry.boostComboCount ?? 1) - 1) * 45} KM/H
              </span>
            </div>

            {/* Combo Chain Decay Timer Bar (6.5s chain window) */}
            <div className="w-full h-1 mt-1 rounded-full bg-slate-900/80 overflow-hidden border border-cyan-400/30">
              <div
                className="h-full transition-all duration-75 rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, ((telemetry.boostComboTimer ?? 0) / 6.5) * 100))}%`,
                  background: 'linear-gradient(90deg, #0048ff 0%, #00e5ff 65%, #ffffff 100%)',
                  boxShadow: '0 0 8px rgba(0, 229, 255, 0.9)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* TOP BAR: Compact Left Race Telemetry & Retractable Right Controls */}
      <div className="flex items-start justify-between w-full">
        {/* COMPACT TOP-LEFT CLUSTER: Position, Lap Timer & Grip (Reduced size & higher transparency) */}
        <div
          className="flex flex-col gap-1 px-2 py-1.5 rounded-lg border border-cyan-400/20 w-[138px] md:w-[150px] backdrop-blur-[2px]"
          style={{
            background:
              'linear-gradient(135deg, rgba(6, 12, 26, 0.36) 0%, rgba(6, 12, 26, 0.20) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(0, 242, 254, 0.14), 0 4px 12px rgba(0, 0, 0, 0.28)',
          }}
        >
          {/* Row 1: Position + Lap side-by-side */}
          <div className="flex items-baseline justify-between leading-none">
            <div className="flex items-baseline gap-0.5">
              <div
                className="flex items-baseline gap-0.5 text-cyan-300"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  textShadow: '0 0 10px rgba(0, 242, 254, 0.6), 0 1px 3px rgba(0,0,0,0.85)',
                }}
              >
                <span className="text-lg md:text-xl font-black tabular-nums tracking-tight text-white">
                  {rankNum}
                </span>
                <span className="text-[9px] font-bold text-cyan-300">{rankSuffix}</span>
              </div>
              <span className="text-[7.5px] font-semibold tracking-wider text-cyan-100/70">
                /{telemetry.totalRacers}
              </span>
            </div>

            <div className="text-[8px] font-semibold tracking-[0.12em] text-slate-300">
              LAP{' '}
              <span
                className="text-[11px] font-bold text-white tabular-nums"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                {telemetry.lap}
              </span>
              <span className="text-slate-400">/{telemetry.totalLaps}</span>
            </div>
          </div>

          <div className="h-[1px] w-full bg-gradient-to-r from-cyan-400/25 via-pink-400/15 to-transparent" />

          {/* Row 2: Compact Lap Time & Best Lap */}
          <div className="flex items-baseline justify-between leading-none">
            <div
              className="text-xs md:text-sm font-bold text-white tabular-nums tracking-wider"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                textShadow: '0 0 8px rgba(56, 189, 248, 0.35)',
              }}
            >
              {formatRaceTime(telemetry.currentLapTimeMs)}
            </div>
            <div className="text-[7.5px] font-mono tracking-wider text-cyan-200/70 tabular-nums">
              BEST {formatRaceTime(telemetry.bestLapTimeMs)}
            </div>
          </div>

          {/* Row 3: Weather & Grip + Compact Ring Overcharge badge */}
          <div className="flex items-center justify-between gap-1 text-[7.5px] font-mono tracking-wider pt-0.5 border-t border-white/10">
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
                  ? 'border-amber-400/40 text-amber-300 bg-amber-950/35'
                  : 'border-cyan-400/30 text-cyan-200 bg-cyan-950/30'
              }`}
            >
              GRIP {telemetry.surfaceGripPct}%
            </span>
          </div>

          {/* Row 4: Gold Credits (Credit Bonus) & Crystal Bonus Score / Upgrade Lv */}
          <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-white/10 text-[7.5px] font-mono">
            <div
              data-testid="hud-credits-counter"
              className="flex items-center gap-1 px-1 py-0.5 rounded bg-amber-950/35 border border-amber-400/35 text-amber-300 font-bold"
              title="Credits earned from Gold Credit Bonus tokens"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              <span>CR {telemetry.totalCredits + telemetry.creditsEarned}</span>
            </div>
            <div
              data-testid="hud-crystal-counter"
              className="flex items-center gap-1 px-1 py-0.5 rounded bg-fuchsia-950/35 border border-fuchsia-400/35 text-fuchsia-200 font-bold"
              title="Crystal Bonus points & active vehicle upgrade level"
            >
              <span className="w-1.5 h-1.5 rotate-45 bg-fuchsia-400 inline-block" />
              <span>
                {telemetry.crystalPoints} PT
                {telemetry.crystalUpgradeLevel > 0 ? ` · LV${telemetry.crystalUpgradeLevel}` : ''}
              </span>
            </div>
          </div>

          {(telemetry.boostComboCount ?? 0) > 0 && (
            <div
              data-testid="hud-boost-chain-compact"
              className="flex items-center justify-between px-1.5 py-0.5 rounded border border-cyan-400/55 bg-blue-950/55 text-[7.5px] font-bold tracking-wider text-cyan-100"
              style={{ boxShadow: '0 0 10px rgba(0, 229, 255, 0.28)' }}
            >
              <span>BOOST CHAIN x{telemetry.boostComboCount}</span>
              <span className="text-cyan-300 tabular-nums">
                +{235 + ((telemetry.boostComboCount ?? 1) - 1) * 45} KM/H
              </span>
            </div>
          )}

          {telemetry.ringChain > 0 && (
            <div className="flex items-center justify-between px-1.5 py-0.5 rounded border border-cyan-400/40 bg-cyan-950/40 text-[7.5px] font-bold tracking-wider text-cyan-200">
              <span>OVERCHARGE x{telemetry.ringChain}</span>
              <span className="text-cyan-300">+{telemetry.ringChain * 28} KM/H</span>
            </div>
          )}

          {telemetry.shieldActive && (
            <div className="flex items-center justify-between px-1.5 py-0.5 rounded border border-indigo-400/45 bg-indigo-950/40 text-[7.5px] font-bold tracking-wider text-indigo-200">
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
                className="px-2 py-0.5 rounded border border-white/20 text-[8.5px] font-semibold tracking-wider text-slate-200 hover:text-white hover:border-cyan-400/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(8, 13, 26, 0.42)' }}
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
                className="px-2 py-0.5 rounded border border-white/20 text-[8.5px] font-semibold tracking-wider text-slate-200 hover:text-white hover:border-cyan-400/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(8, 13, 26, 0.42)' }}
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
                className="px-2 py-0.5 rounded border border-white/20 text-[8.5px] font-semibold text-slate-200 hover:text-white hover:border-cyan-400/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(8, 13, 26, 0.42)' }}
              >
                {settings.muted ? 'Muted' : 'Audio'}
              </button>
            </div>

            <div className="flex items-center gap-1">
              {/* Live In-Race Musical Theme Switcher */}
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  scheduleAutoHide();
                  onCycleMusicTheme();
                }}
                className="px-2 py-0.5 rounded border border-pink-400/30 text-[8.5px] font-medium tracking-wider text-pink-100 hover:text-white hover:border-pink-400/70 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(8, 13, 26, 0.38)' }}
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
                className="px-2 py-0.5 rounded border border-cyan-400/25 text-[8.5px] font-medium tracking-wider text-cyan-100 hover:text-white hover:border-cyan-400/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(8, 13, 26, 0.38)' }}
              >
                Cam: {cameraLabel}
              </button>
            </div>
          </div>

          {/* Persistent Camera View Badge + Top-Right Icon Button to Reveal / Retract the Controls Drawer */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-camera-cycle-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleCamera();
              }}
              title="Switch Player Camera View [C] (Perspective / Chase / Close / Cockpit)"
              className="h-6 px-2 rounded-md border border-cyan-400/30 text-[8.5px] font-bold tracking-wider text-cyan-200 hover:text-white hover:border-cyan-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'rgba(8, 13, 26, 0.38)' }}
            >
              VIEW: {cameraLabel.toUpperCase()} [C]
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                handleToggleControlsDrawer();
              }}
              aria-label="Toggle HUD Controls"
              title="Show / Hide Quick Controls & Autopilot Bar"
              className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                controlsOpen
                  ? 'border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,242,254,0.3)]'
                  : demoMode
                  ? 'border-amber-400/50 text-amber-300 hover:border-amber-300'
                  : 'border-white/20 text-slate-300 hover:text-white hover:border-cyan-400/50'
              }`}
              style={{ backgroundColor: 'rgba(8, 13, 26, 0.38)' }}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                {controlsOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M10 18h10" />
                )}
              </svg>
            </button>
          </div>
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

      {/* BOTTOM BAR: Full-Size Speedometer + Ultra-Compact Transparent Telemetry/Arsenal Cluster & Full-Size Circular Minimap */}
      <div className="flex items-end justify-between w-full gap-2.5 mt-auto">
        {/* BOTTOM-LEFT CLUSTER: Speedometer at full current size + significantly reduced & highly transparent Hull/Controls/Slots */}
        <div
          className="flex items-center gap-2.5 flex-wrap px-2.5 py-1.5 rounded-xl border border-cyan-400/20 backdrop-blur-[3px]"
          style={{
            background:
              'linear-gradient(135deg, rgba(6, 12, 26, 0.34) 0%, rgba(10, 16, 34, 0.22) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(0, 242, 254, 0.14), 0 6px 16px rgba(0, 0, 0, 0.30)',
          }}
        >
          {/* Compact Semi-Circular Arc Speedometer Gauge (KEPT AT EXACT CURRENT SIZE) */}
          <div className="relative w-32 h-18 flex flex-col items-center justify-end shrink-0">
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
                stroke="rgba(15, 23, 42, 0.55)"
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

          {/* Significantly Reduced Right Column: Compact Hull Energy + Miniaturized Controls & Slots */}
          <div className="flex flex-col justify-end gap-1">
            {/* Compact Segmented Hull Energy Bar & Key Hint */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col min-w-[96px]">
                <div className="flex items-baseline justify-between mb-0.5 gap-2">
                  <span
                    className={`text-[7px] font-bold tracking-[0.12em] ${
                      telemetry.energy <= 25 ? 'text-rose-400 animate-pulse' : 'text-cyan-100/85'
                    }`}
                  >
                    {telemetry.isDestroyed
                      ? 'HULL DESTROYED!'
                      : telemetry.energy <= 25
                      ? 'CRITICAL HULL!'
                      : 'HULL ENERGY'}
                  </span>
                  <span
                    data-testid="hud-energy-value"
                    className={`text-[9.5px] font-bold tabular-nums leading-none ${
                      telemetry.energy <= 25 ? 'text-rose-400' : 'text-white'
                    }`}
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    {telemetry.energy}%
                  </span>
                </div>

                {/* 12-segment neon hull/energy bar (reduced size) */}
                <div className="flex items-center gap-0.5">
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
                        className="h-1.5 w-1.5 rounded-[1px] transition-opacity duration-75"
                        style={{
                          backgroundColor: active ? barColor : 'rgba(30, 41, 59, 0.45)',
                          boxShadow: active ? `0 0 6px ${barColor}99` : 'none',
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <span
                className={`text-[6.5px] font-bold tracking-[0.08em] hidden sm:inline ${
                  telemetry.energy <= 25
                    ? 'text-rose-400 animate-pulse'
                    : 'text-cyan-200/75'
                }`}
              >
                {telemetry.isDestroyed
                  ? '0% ENERGY // EXPLODED'
                  : telemetry.energy <= 25
                  ? 'AVOID GUARDRAILS!'
                  : 'W/↑ THROTTLE · S/↓ BRAKE · A/D STEER'}
              </span>
            </div>

            {/* MINIATURIZED DRIVING CONTROLS & ORDNANCE SLOTS CLUSTER */}
            <div className="relative pointer-events-auto flex items-center gap-1 flex-wrap">
              {/* Compact Interactive WASD / Directional Movement Control Pad */}
              <div
                id="wasd-movement-controls"
                data-testid="wasd-movement-controls"
                className="movement-control-container flex items-center gap-0.5 px-1 py-0.5 rounded-lg border border-cyan-400/20"
                style={{ backgroundColor: 'rgba(6, 11, 24, 0.34)' }}
                title="WASD / Arrow Keys Movement Controls (W/Up: Throttle, S/Down: Brake, A/Left: Steer Left, D/Right: Steer Right)"
              >
                <button
                  id="move-left-btn"
                  type="button"
                  tabIndex={-1}
                  data-testid="move-left-btn"
                  aria-label="Move Left (A / ArrowLeft)"
                  onMouseDown={(e) => {
                    e.currentTarget.blur();
                    onTriggerSteer?.(-1);
                  }}
                  onMouseUp={() => onTriggerSteer?.(0)}
                  onMouseLeave={() => onTriggerSteer?.(0)}
                  onTouchStart={() => onTriggerSteer?.(-1)}
                  onTouchEnd={() => onTriggerSteer?.(0)}
                  className="w-5 h-6 rounded border border-cyan-400/25 bg-slate-900/40 hover:border-cyan-300 active:bg-cyan-500/30 text-[7px] font-mono font-bold text-cyan-200 flex flex-col items-center justify-center leading-none cursor-pointer"
                >
                  <span>A</span>
                  <span className="text-[5px] text-slate-400">L</span>
                </button>
                <div className="flex flex-col gap-0.5">
                  <button
                    id="move-up-btn"
                    type="button"
                    tabIndex={-1}
                    data-testid="move-up-btn"
                    aria-label="Move Up / Throttle (W / ArrowUp)"
                    onMouseDown={(e) => {
                      e.currentTarget.blur();
                      onTriggerThrottle?.(true);
                    }}
                    onMouseUp={() => onTriggerThrottle?.(false)}
                    onMouseLeave={() => onTriggerThrottle?.(false)}
                    onTouchStart={() => onTriggerThrottle?.(true)}
                    onTouchEnd={() => onTriggerThrottle?.(false)}
                    className="w-6 h-2.5 rounded-[3px] border border-cyan-400/25 bg-slate-900/40 hover:border-cyan-300 active:bg-cyan-500/30 text-[6px] font-mono font-bold text-cyan-200 flex items-center justify-center leading-none cursor-pointer"
                  >
                    W·UP
                  </button>
                  <button
                    id="move-down-btn"
                    type="button"
                    tabIndex={-1}
                    data-testid="move-down-btn"
                    aria-label="Move Down / Brake (S / ArrowDown)"
                    onMouseDown={(e) => {
                      e.currentTarget.blur();
                      onTriggerBrake?.(true);
                    }}
                    onMouseUp={() => onTriggerBrake?.(false)}
                    onMouseLeave={() => onTriggerBrake?.(false)}
                    onTouchStart={() => onTriggerBrake?.(true)}
                    onTouchEnd={() => onTriggerBrake?.(false)}
                    className="w-6 h-2.5 rounded-[3px] border border-cyan-400/25 bg-slate-900/40 hover:border-cyan-300 active:bg-cyan-500/30 text-[6px] font-mono font-bold text-slate-300 flex items-center justify-center leading-none cursor-pointer"
                  >
                    S·DN
                  </button>
                </div>
                <button
                  id="move-right-btn"
                  type="button"
                  tabIndex={-1}
                  data-testid="move-right-btn"
                  aria-label="Move Right (D / ArrowRight)"
                  onMouseDown={(e) => {
                    e.currentTarget.blur();
                    onTriggerSteer?.(1);
                  }}
                  onMouseUp={() => onTriggerSteer?.(0)}
                  onMouseLeave={() => onTriggerSteer?.(0)}
                  onTouchStart={() => onTriggerSteer?.(1)}
                  onTouchEnd={() => onTriggerSteer?.(0)}
                  className="w-5 h-6 rounded border border-cyan-400/25 bg-slate-900/40 hover:border-cyan-300 active:bg-cyan-500/30 text-[7px] font-mono font-bold text-cyan-200 flex flex-col items-center justify-center leading-none cursor-pointer"
                >
                  <span>D</span>
                  <span className="text-[5px] text-slate-400">R</span>
                </button>
              </div>

              {/* Compact Power-Up Box [SPACE] Slot */}
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-bonus-slot"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTriggerBonus();
                }}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg border transition-all cursor-pointer"
                style={{
                  background:
                    'linear-gradient(145deg, rgba(6, 11, 24, 0.36) 0%, rgba(10, 17, 36, 0.24) 100%)',
                  borderColor: hasBonus ? bonusMeta.color : 'rgba(56, 189, 248, 0.22)',
                  boxShadow: hasBonus
                    ? `0 4px 12px rgba(0, 0, 0, 0.35), 0 0 10px ${bonusMeta.color}33`
                    : 'none',
                }}
                title="Activate Held Power-Up [SPACE]"
              >
                {heldPowerUpType ? (
                  <PowerUpSpriteIcon type={heldPowerUpType} sizeClass="w-5 h-5" />
                ) : (
                  <div className="w-5 h-5 rounded border border-cyan-400/20 bg-slate-950/40 flex items-center justify-center text-[7px] font-mono font-bold text-slate-400">
                    SPC
                  </div>
                )}
                <div className="text-left leading-tight">
                  <div className="flex items-center gap-1">
                    <span className="text-[6.5px] font-bold tracking-[0.1em] text-slate-300 uppercase">
                      POWER-UP
                    </span>
                    <span className="px-0.5 rounded bg-white/10 text-[6px] font-mono font-bold text-cyan-200">
                      [SPACE]
                    </span>
                  </div>
                  <div
                    className="text-[7.5px] font-extrabold tracking-wider uppercase truncate max-w-[72px]"
                    style={{
                      color: hasBonus ? bonusMeta.color : '#94a3b8',
                      fontFamily: "'Orbitron', sans-serif",
                    }}
                  >
                    {hasBonus ? bonusMeta.label : 'EMPTY SLOT'}
                  </div>
                </div>
              </button>

              {/* Compact Army / Weapon Bay [Z] Slot */}
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-weapon-slot"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTriggerWeapon?.();
                }}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg border transition-all cursor-pointer"
                style={{
                  background:
                    'linear-gradient(145deg, rgba(6, 11, 24, 0.36) 0%, rgba(10, 17, 36, 0.24) 100%)',
                  borderColor: hasWeapon && weaponMeta ? weaponMeta.color : 'rgba(244, 63, 94, 0.22)',
                  boxShadow:
                    hasWeapon && weaponMeta
                      ? `0 4px 12px rgba(0, 0, 0, 0.35), 0 0 10px ${weaponMeta.color}33`
                      : 'none',
                }}
                title="Fire Held Weapon [Z]"
              >
                {hasWeapon && telemetry.heldWeapon !== 'none' ? (
                  <WeaponSvgIcon type={telemetry.heldWeapon} sizeClass="w-5 h-5" />
                ) : (
                  <div className="w-5 h-5 rounded border border-rose-400/20 bg-slate-950/40 flex items-center justify-center text-[7px] font-mono font-bold text-slate-400">
                    [Z]
                  </div>
                )}
                <div className="text-left leading-tight">
                  <div className="flex items-center gap-1">
                    <span className="text-[6.5px] font-bold tracking-[0.1em] text-slate-300 uppercase">
                      WEAPON BAY
                    </span>
                    <span className="px-0.5 rounded bg-rose-500/20 text-[6px] font-mono font-bold text-rose-200">
                      [Z] FIRE
                    </span>
                  </div>
                  <div
                    className="text-[7.5px] font-extrabold tracking-wider uppercase truncate max-w-[72px]"
                    style={{
                      color: hasWeapon && weaponMeta ? weaponMeta.color : '#94a3b8',
                      fontFamily: "'Orbitron', sans-serif",
                    }}
                  >
                    {hasWeapon && weaponMeta ? weaponMeta.shortLabel : 'NO ORDNANCE'}
                  </div>
                </div>
              </button>

              {/* Compact Arsenal / Power-Up Codex Button [I] */}
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-codex-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setCodexOpen((prev) => !prev);
                }}
                className="h-7 px-1.5 rounded-lg border border-cyan-400/25 hover:border-cyan-300 text-[7px] font-mono font-bold text-cyan-200 flex flex-col items-center justify-center leading-none cursor-pointer"
                style={{ backgroundColor: 'rgba(6, 11, 24, 0.36)' }}
                title="Inspect Power-Ups & Weapons Codex [I]"
              >
                <span>ARSENAL</span>
                <span className="text-[6px] text-cyan-400 mt-0.5">[I]</span>
              </button>
            </div>
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

        {/* COMPACT BOTTOM-RIGHT CLUSTER: Circular Track Spline Radar Minimap (KEPT AT EXACT CURRENT SIZE, HIGHER TRANSPARENCY) */}
        <div
          className="relative w-28 h-28 md:w-32 md:h-32 rounded-full border border-cyan-400/35 flex items-center justify-center shrink-0 backdrop-blur-[2px]"
          style={{
            backgroundColor: 'rgba(6, 11, 24, 0.34)',
            boxShadow:
              'inset 0 0 18px rgba(0, 242, 254, 0.16), 0 6px 16px rgba(0, 0, 0, 0.32)',
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
