import React, { useState } from 'react';
import {
  AtmosphereMode,
  GameSettings,
  PowerUpItemType,
  ShipId,
  TrackId,
  VehicleUpgrades,
} from '../game/types';
import {
  DEFAULT_UPGRADES,
  POWERUP_ITEMS_ORDER,
  POWERUP_META,
  SHIP_SPECS,
  TRACK_SPECS,
} from '../game/rules';
import { PowerUpSpriteIcon } from './HudOverlay';

interface TitleScreenProps {
  settings: GameSettings;
  upgrades?: VehicleUpgrades;
  totalCredits?: number;
  onPurchaseUpgrade?: (key: keyof VehicleUpgrades, cost: number) => void;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onStartRace: () => void;
  onStartDemo: () => void;
  onOpenSettings: () => void;
}

const UPGRADE_MODULES: Array<{
  key: keyof VehicleUpgrades;
  label: string;
  desc: string;
  cost: number;
  iconItem: PowerUpItemType;
}> = [
  {
    key: 'topSpeedLevel',
    label: 'Turbine Overclock',
    desc: '+45 KM/H Top Speed & Boost Ring Surge',
    cost: 150,
    iconItem: 'boost',
  },
  {
    key: 'nitroCapacityLevel',
    label: 'Nitro Fuel Tank',
    desc: '+15% Starting Nitro & Faster Burn Thrust',
    cost: 150,
    iconItem: 'nitro',
  },
  {
    key: 'handlingLevel',
    label: 'Crystal Gyro Fin',
    desc: '+8% Cornering Grip & Faster Upgrade Scaling',
    cost: 150,
    iconItem: 'crystal',
  },
  {
    key: 'shieldHullLevel',
    label: 'Hex Shield & Hull',
    desc: '+1.5s Hex Shield Duration & Reinforced Crate Repair',
    cost: 150,
    iconItem: 'shield',
  },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  settings,
  upgrades = DEFAULT_UPGRADES,
  totalCredits = 450,
  onPurchaseUpgrade,
  onUpdateSettings,
  onStartRace,
  onStartDemo,
  onOpenSettings,
}) => {
  const currentShip = SHIP_SPECS[settings.shipId];
  const [activePowerUpPreview, setActivePowerUpPreview] = useState<PowerUpItemType>('boost');
  const [upgradeBayOpen, setUpgradeBayOpen] = useState(false);

  const previewMeta = POWERUP_META[activePowerUpPreview];
  const effectiveMaxSpeed = currentShip.maxSpeedKmh + upgrades.topSpeedLevel * 45;
  const effectiveHandling = currentShip.handling + upgrades.handlingLevel * 0.06;

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-5 md:p-8 select-none overflow-y-auto"
      style={{
        background:
          'linear-gradient(90deg, rgba(4, 7, 16, 0.92) 0%, rgba(4, 7, 16, 0.72) 36%, rgba(4, 7, 16, 0.0) 68%)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Asymmetric Left-Third Panel (Leaves right 65% of 3D stage clear) */}
      <div
        className="w-full max-w-[475px] pointer-events-auto flex flex-col gap-4 my-auto p-4 md:p-5 rounded-2xl border border-cyan-400/25"
        style={{
          background:
            'linear-gradient(155deg, rgba(7, 12, 26, 0.92) 0%, rgba(9, 15, 32, 0.82) 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(0, 242, 254, 0.35), 0 20px 50px rgba(0, 0, 0, 0.75)',
        }}
      >
        {/* Custom Inline SVG Title Emblem Lockup + Credits Badge */}
        <div className="flex items-start justify-between gap-2">
          <svg
            viewBox="0 0 420 86"
            className="w-full max-w-[300px] h-auto overflow-visible"
            role="img"
            aria-label="AERO-X Anti-Gravity Racing"
          >
            <defs>
              <linearGradient id="aeroWingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00f2fe" />
                <stop offset="55%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>
              <linearGradient id="aeroTextGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#bae6fd" />
              </linearGradient>
            </defs>
            {/* Geometric Delta Wing Crest */}
            <path
              d="M 4 22 L 50 4 L 38 28 L 72 28 L 20 54 L 30 32 L 4 32 Z"
              fill="url(#aeroWingGrad)"
            />
            <path
              d="M 78 15 L 412 15"
              stroke="url(#aeroWingGrad)"
              strokeWidth="2"
            />
            <text
              x="78"
              y="54"
              fill="url(#aeroTextGrad)"
              fontFamily="'Orbitron', sans-serif"
              fontWeight="900"
              fontSize="44"
              letterSpacing="5.5"
            >
              AERO-X
            </text>
            <text
              x="80"
              y="76"
              fill="#38bdf8"
              fontFamily="'Chakra Petch', sans-serif"
              fontWeight="700"
              fontSize="12"
              letterSpacing="5.5"
            >
              ANTI-GRAVITY GRAND PRIX · 2198
            </text>
          </svg>

          {/* Gold Credit Bonus Balance & Upgrade Bay Button */}
          <button
            type="button"
            data-testid="title-open-upgrade-bay"
            onClick={() => setUpgradeBayOpen((prev) => !prev)}
            className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-amber-400/50 bg-amber-950/50 hover:bg-amber-900/70 transition-colors cursor-pointer"
            title="Spend Credit Bonus tokens to upgrade vehicle equipment"
          >
            <PowerUpSpriteIcon type="credit" sizeClass="w-7 h-7" />
            <div className="text-left leading-tight">
              <div
                className="text-xs font-black text-amber-300 tabular-nums"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                {totalCredits} CR
              </div>
              <div className="text-[9px] font-bold tracking-wider uppercase text-amber-200/90">
                {upgradeBayOpen ? 'Close Bay' : 'Upgrades'}
              </div>
            </div>
          </button>
        </div>

        {/* Track Selection Cards with Reference Previews */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-[0.18em] text-cyan-200 uppercase">
              01. Circuit Sector
            </span>
            <div className="flex items-center gap-1 p-0.5 rounded bg-slate-950/95 border border-cyan-400/25">
              {(['neon', 'daylight'] as AtmosphereMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onUpdateSettings({ atmosphere: mode })}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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

          <div className="grid grid-cols-2 gap-3">
            {(['city', 'lava_v2'] as TrackId[]).map((tId) => {
              const tSpec = TRACK_SPECS[tId];
              const isSelected = settings.trackId === tId;
              const imgSrc =
                settings.atmosphere === 'neon' ? tSpec.previewNeon : tSpec.previewDay;
              return (
                <button
                  key={tId}
                  type="button"
                  onClick={() => onUpdateSettings({ trackId: tId })}
                  className={`group relative rounded-lg overflow-hidden border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.35)]'
                      : 'border-white/15 opacity-75 hover:opacity-100 hover:border-white/35'
                  }`}
                  style={{ backgroundColor: 'rgba(10, 15, 28, 0.94)' }}
                >
                  <div className="relative h-14 w-full overflow-hidden bg-slate-900">
                    <img
                      src={imgSrc}
                      alt={tSpec.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(to top, rgba(10, 15, 28, 0.96) 0%, rgba(10, 15, 28, 0.18) 65%)',
                      }}
                    />
                  </div>
                  <div className="p-2">
                    <div
                      className="text-[11px] font-bold text-white truncate"
                      style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                    >
                      {tSpec.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <span>{(tSpec.lengthMeters / 1000).toFixed(1)} km</span>
                      <span aria-hidden="true">·</span>
                      <span>{tSpec.totalLaps}L</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-cyan-300">6 Power Boxes</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* AG-Craft Selector (5 Redesigned Models) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tracking-[0.18em] text-cyan-200 uppercase">
              02. Anti-Gravity Hull (5 Models)
            </span>
            <span className="text-cyan-300 font-mono text-[11px] tabular-nums">
              {effectiveMaxSpeed} KM/H · HND {effectiveHandling.toFixed(2)} · BOOST +{currentShip.boostPower}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {(['valkyrie', 'spectre', 'titan', 'seraph', 'nemesis'] as ShipId[]).map((sId) => {
              const spec = SHIP_SPECS[sId];
              const active = settings.shipId === sId;
              const hexAccent = `#${spec.accentColor.toString(16).padStart(6, '0')}`;
              return (
                <button
                  key={sId}
                  type="button"
                  onClick={() => onUpdateSettings({ shipId: sId })}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    active
                      ? 'border-cyan-400 bg-cyan-950/75 text-white shadow-[0_0_14px_rgba(0,242,254,0.28)]'
                      : 'border-white/15 bg-slate-900/85 text-slate-300 hover:border-white/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="text-[11px] font-bold truncate"
                      style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                    >
                      {spec.name.split(' ')[0]}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: hexAccent,
                        boxShadow: `0 0 6px ${hexAccent}`,
                      }}
                    />
                  </div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">
                    {spec.team.split(' ')[0]}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            <span className="font-bold text-cyan-300">{currentShip.name}:</span> {currentShip.tagline}
          </p>

          {/* AI Difficulty Level Selector (Novice · Professional · Apex) */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-bold tracking-[0.14em] text-cyan-200 uppercase">
              AI Difficulty
            </span>
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-950/95 border border-cyan-400/25">
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
                    data-testid={`title-ai-diff-${diff.id}`}
                    onClick={() => onUpdateSettings({ aiDifficulty: diff.id })}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(0,242,254,0.35)]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {diff.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 03. In-Game Power-Up & Bonus Box System (6 Items + Equipment Upgrades) */}
        <div
          data-testid="title-powerup-showcase"
          className="space-y-2 rounded-xl border border-cyan-400/25 bg-slate-950/85 p-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-[0.16em] text-cyan-200 uppercase">
              {upgradeBayOpen
                ? '03. Credit Equipment Upgrade Bay'
                : '03. Track Power-Up & Bonus Boxes (6 Items)'}
            </span>
            <button
              type="button"
              onClick={() => setUpgradeBayOpen((prev) => !prev)}
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-400/15 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/25 transition-colors cursor-pointer"
            >
              {upgradeBayOpen ? 'Show 6 Power-Ups' : 'Upgrade Equipment'}
            </button>
          </div>

          {upgradeBayOpen ? (
            <div className="grid grid-cols-2 gap-1.5">
              {UPGRADE_MODULES.map((mod) => {
                const level = upgrades[mod.key] ?? 0;
                const isMax = level >= 3;
                const canAfford = totalCredits >= mod.cost && !isMax;
                return (
                  <div
                    key={mod.key}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/95 border border-white/10"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PowerUpSpriteIcon type={mod.iconItem} sizeClass="w-7 h-7" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-white truncate">
                          {mod.label}{' '}
                          <span className="text-amber-300 font-mono">LV.{level}/3</span>
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">
                          {mod.desc}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onPurchaseUpgrade?.(mod.key, mod.cost)}
                      className={`shrink-0 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                        isMax
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 cursor-default'
                          : canAfford
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isMax ? 'MAX' : `${mod.cost} CR`}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-6 gap-1.5">
                {POWERUP_ITEMS_ORDER.map((itemKey) => {
                  const meta = POWERUP_META[itemKey];
                  const selected = activePowerUpPreview === itemKey;
                  return (
                    <button
                      key={itemKey}
                      type="button"
                      data-testid={`title-powerup-btn-${itemKey}`}
                      onClick={() => setActivePowerUpPreview(itemKey)}
                      className={`flex flex-col items-center p-1 rounded-lg border transition-all cursor-pointer ${
                        selected
                          ? 'bg-slate-900 border-cyan-400 shadow-[0_0_12px_rgba(0,242,254,0.3)]'
                          : 'bg-slate-900/60 border-white/10 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <PowerUpSpriteIcon type={itemKey} sizeClass="w-8 h-8" />
                      <span
                        className="text-[8px] font-bold tracking-wider uppercase truncate mt-1 w-full text-center"
                        style={{ color: selected ? meta.color : '#cbd5e1' }}
                      >
                        {meta.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-2 px-1 pt-0.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-black tracking-wider uppercase"
                      style={{
                        fontFamily: "'Orbitron', sans-serif",
                        color: previewMeta.color,
                      }}
                    >
                      {previewMeta.label}
                    </span>
                    <span
                      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 border"
                      style={{
                        color: previewMeta.color,
                        borderColor: `${previewMeta.color}55`,
                      }}
                    >
                      {previewMeta.effectBadge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-tight mt-0.5">
                    {previewMeta.description}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Primary Launch CTA + Demo Mode + Settings Button */}
        <div className="flex items-center gap-2.5 pt-0.5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartRace();
            }}
            className="flex-1 py-3 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs md:text-sm tracking-[0.16em] uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              boxShadow: '0 0 28px rgba(0, 242, 254, 0.55)',
            }}
          >
            Launch Race
          </button>

          <button
            type="button"
            data-demo="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartDemo();
            }}
            className="py-3 px-4 rounded-lg border border-amber-400/55 bg-amber-950/60 hover:bg-amber-900/75 hover:border-amber-300 text-amber-200 font-bold text-xs tracking-[0.15em] uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              boxShadow: '0 0 18px rgba(251, 191, 36, 0.22)',
            }}
          >
            Demo Mode
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSettings();
            }}
            className="py-3 px-4 rounded-lg border border-cyan-400/35 bg-slate-900/95 hover:border-cyan-400/75 text-white font-semibold text-xs tracking-[0.14em] uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Settings
          </button>
        </div>
      </div>

      {/* Bottom Safe-Margin Single Flat Control Hint Line */}
      <div className="text-xs text-slate-300 tracking-wide font-medium mt-2">
        WASD / Arrows Steer &amp; Thrust · Shift Turbine Boost · Space Engage Nitro / Power-Up Box · I Power-Up Codex · Q/E Drift · C Camera · P Pause
      </div>
    </div>
  );
};
