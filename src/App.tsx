/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AtmosphereMode,
  CameraMode,
  DebugMode,
  DebugTeleportRequest,
  GameSettings,
  GameState,
  HudTelemetry,
  RaceSummary,
  TrackId,
  VehicleUpgrades,
} from './game/types';
import { DEFAULT_SETTINGS, DEFAULT_UPGRADES, MUSIC_THEMES } from './game/rules';
import { audioEngine } from './game/audio';
import { RacingCanvas } from './components/RacingCanvas';
import { HudOverlay } from './components/HudOverlay';
import { TitleScreen } from './components/TitleScreen';
import {
  DebugModeOverlay,
  PauseModal,
  RaceOverModal,
  SecretDebugModal,
  SettingsModal,
} from './components/Modals';

const INITIAL_TELEMETRY: HudTelemetry = {
  speedKmh: 0,
  energy: 100,
  nitroReserve: 35,
  crystalPoints: 0,
  crystalUpgradeLevel: 0,
  creditsEarned: 0,
  totalCredits: 450,
  position: 4,
  totalRacers: 6,
  lap: 1,
  totalLaps: 3,
  currentLapTimeMs: 0,
  bestLapTimeMs: null,
  countdownValue: -1,
  countdownProgress: 0,
  introPhase: 'overview',
  statusBanner: 'STANDBY',
  weatherLabel: 'NEON RAIN SQUALL',
  weatherIntensity: 0.65,
  surfaceGripPct: 73,
  isBoosting: false,
  nitroActive: false,
  boostReady: true,
  heldBonus: 'nitro',
  heldWeapon: 'none',
  lastCollectedPowerUp: null,
  lastCollectedWeapon: null,
  lastCollectedTimer: 0,
  ringChain: 0,
  shieldActive: false,
  shieldRemainingSec: 0,
  laserActive: false,
  shockwaveActive: false,
  isDestroyed: false,
  targetLockedName: null,
  wrongWay: false,
  minimapPoints: [],
  racerDots: [],
};

export default function App() {
  const [settings, setSettings] = useState<GameSettings>(() => {
    const params = new URLSearchParams(window.location.search);
    const trackParam = params.get('track') as TrackId | null;
    const atmoParam = params.get('atmosphere') as AtmosphereMode | null;
    return {
      ...DEFAULT_SETTINGS,
      trackId:
        trackParam === 'lava' ||
        trackParam === 'lava_v2' ||
        trackParam === 'city' ||
        trackParam === 'city_v1'
          ? trackParam
          : DEFAULT_SETTINGS.trackId,
      atmosphere:
        atmoParam === 'daylight' || atmoParam === 'neon' ? atmoParam : DEFAULT_SETTINGS.atmosphere,
    };
  });

  const [totalCredits, setTotalCredits] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem('aero_x_credits');
      return saved !== null ? Math.max(0, Number(saved)) : 450;
    } catch {
      return 450;
    }
  });

  const [upgrades, setUpgrades] = useState<VehicleUpgrades>(() => {
    try {
      const saved = window.localStorage.getItem('aero_x_upgrades');
      if (saved) {
        return { ...DEFAULT_UPGRADES, ...JSON.parse(saved) };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_UPGRADES;
  });

  const [gameState, setGameState] = useState<GameState>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'playing' : 'title';
  });

  const [debugMode, setDebugMode] = useState<DebugMode>('off');
  const [debugMenuOpen, setDebugMenuOpen] = useState(false);
  const [cameraPaused, setCameraPaused] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [teleportRequest, setTeleportRequest] = useState<DebugTeleportRequest | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [raceNonce, setRaceNonce] = useState(0);
  const [telemetry, setTelemetry] = useState<HudTelemetry>(INITIAL_TELEMETRY);
  const [raceSummary, setRaceSummary] = useState<RaceSummary | null>(null);

  const actionTriggerRef = useRef({
    boostPulse: false,
    useBonus: false,
    useWeapon: false,
    steerDir: 0,
  });

  // Sync document.body.dataset attributes immediately
  useEffect(() => {
    document.body.dataset.state = gameState;
    document.body.dataset.debugMode = debugMode;
    document.body.dataset.debugMenuOpen = String(debugMenuOpen);
    document.body.dataset.cameraPaused = String(cameraPaused);
    document.body.dataset.demoMode = String(demoMode);
  }, [gameState, debugMode, debugMenuOpen, cameraPaused, demoMode]);

  // Sync audio engine volume/mute/theme/preset settings
  useEffect(() => {
    audioEngine.setSettings(
      settings.sfxVolume,
      settings.muted,
      settings.musicVolume,
      settings.musicTheme,
      settings.sfxPreset
    );
  }, [
    settings.sfxVolume,
    settings.muted,
    settings.musicVolume,
    settings.musicTheme,
    settings.sfxPreset,
  ]);

  const handleStartRace = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.dataset.state = 'playing';
    document.body.dataset.demoMode = 'false';
    setDemoMode(false);
    setRaceSummary(null);
    setSettingsOpen(false);
    setDebugMenuOpen(false);
    setCameraPaused(false);
    setRaceNonce((n) => n + 1);
    setGameState('playing');
  }, []);

  const handleStartDemo = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.dataset.state = 'playing';
    document.body.dataset.demoMode = 'true';
    setDemoMode(true);
    setRaceSummary(null);
    setSettingsOpen(false);
    setDebugMenuOpen(false);
    setCameraPaused(false);
    setRaceNonce((n) => n + 1);
    setGameState('playing');
  }, []);

  const handleTakeControl = useCallback(() => {
    document.body.dataset.demoMode = 'false';
    setDemoMode(false);
  }, []);

  const handleExitDemo = useCallback(() => {
    document.body.dataset.demoMode = 'false';
    setDemoMode(false);
    setSettingsOpen(false);
    setDebugMode('off');
    setCameraPaused(false);
    setGameState('title');
  }, []);

  // Bind Enter / Space on Title screen when modals are closed
  useEffect(() => {
    if (gameState !== 'title' || settingsOpen || debugMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        handleStartRace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, settingsOpen, debugMenuOpen, handleStartRace]);

  const handleUpdateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    if (document.body.dataset.state === 'title') {
      audioEngine.startMusic('ambient');
    }
  }, []);

  const handleResetDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const handleTogglePause = useCallback(() => {
    setDebugMenuOpen((wasDebugOpen) => {
      if (wasDebugOpen) {
        setGameState('playing');
        return false;
      }
      setGameState((prev) => {
        if (prev === 'playing') return 'paused';
        if (prev === 'paused') return 'playing';
        return prev;
      });
      return false;
    });
  }, []);

  // Triggered by pressing P: pauses/unpauses the simulation WITHOUT displaying the pause modal, allowing full camera & zoom control
  const handleToggleCameraPause = useCallback(() => {
    setDebugMenuOpen(false);
    setGameState((prev) => (prev === 'paused' || prev === 'title' ? 'playing' : prev));
    setCameraPaused((prev) => !prev);
  }, []);

  // Triggered by pressing K + E + S: opens the Secret Debug Menu and pauses the game
  const handleOpenDebugMenu = useCallback(() => {
    setSettingsOpen(false);
    setDebugMenuOpen(true);
    setGameState((prev) => (prev === 'playing' ? 'paused' : prev));
  }, []);

  const handleCloseDebugMenu = useCallback(() => {
    setDebugMenuOpen(false);
    setGameState((prev) => (prev === 'paused' ? 'playing' : prev));
  }, []);

  const handleSelectDebugMode = useCallback((mode: DebugMode) => {
    setDebugMode(mode);
    setDebugMenuOpen(false);
    setCameraPaused(false);
    setSettingsOpen(false);
    setGameState('playing');
  }, []);

  const handleTeleportSector = useCallback(
    (t: number, heightOffset?: number, distance?: number, yaw?: number, pitch?: number) => {
      setDebugMode('explore');
      setDebugMenuOpen(false);
      setSettingsOpen(false);
      setGameState('playing');
      setTeleportRequest((prev) => ({
        nonce: (prev?.nonce ?? 0) + 1,
        t,
        heightOffset,
        distance,
        yaw,
        pitch,
      }));
    },
    []
  );

  const handleToggleMute = useCallback(() => {
    setSettings((prev) => ({ ...prev, muted: !prev.muted }));
  }, []);

  const handleCycleCamera = useCallback(() => {
    setSettings((prev) => {
      const order: CameraMode[] = ['chase', 'close', 'cockpit'];
      const next = order[(order.indexOf(prev.cameraMode) + 1) % order.length];
      return { ...prev, cameraMode: next };
    });
  }, []);

  const handleCycleMusicTheme = useCallback(() => {
    setSettings((prev) => {
      const idx = MUSIC_THEMES.findIndex((m) => m.id === prev.musicTheme);
      const next = MUSIC_THEMES[(idx + 1) % MUSIC_THEMES.length].id;
      return { ...prev, musicTheme: next };
    });
  }, []);

  const handleEarnCredits = useCallback((amount: number) => {
    setTotalCredits((prev) => {
      const next = Math.max(0, prev + amount);
      try {
        window.localStorage.setItem('aero_x_credits', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const handlePurchaseUpgrade = useCallback(
    (key: keyof VehicleUpgrades, cost: number) => {
      setTotalCredits((prevCredits) => {
        if (prevCredits < cost) return prevCredits;
        const nextCredits = prevCredits - cost;
        try {
          window.localStorage.setItem('aero_x_credits', String(nextCredits));
        } catch {
          // ignore
        }
        setUpgrades((prevUpgrades) => {
          const currentLevel = prevUpgrades[key] ?? 0;
          if (currentLevel >= 3) return prevUpgrades;
          const nextUpgrades = { ...prevUpgrades, [key]: currentLevel + 1 };
          try {
            window.localStorage.setItem('aero_x_upgrades', JSON.stringify(nextUpgrades));
          } catch {
            // ignore
          }
          return nextUpgrades;
        });
        audioEngine.playBonusActivate();
        return nextCredits;
      });
    },
    []
  );

  const handleRaceFinish = useCallback((summary: RaceSummary) => {
    setRaceSummary(summary);
    document.body.dataset.state = 'gameover';
    setGameState('gameover');
  }, []);

  const handleTriggerBoost = useCallback((active: boolean) => {
    actionTriggerRef.current.boostPulse = active;
  }, []);

  const handleTriggerBonus = useCallback(() => {
    actionTriggerRef.current.useBonus = true;
  }, []);

  const handleTriggerWeapon = useCallback(() => {
    actionTriggerRef.current.useWeapon = true;
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#05070d] select-none">
      {/* Persistent 3D WebGL Anti-Gravity Track & Craft Viewport */}
      <RacingCanvas
        gameState={gameState}
        settings={settings}
        upgrades={upgrades}
        totalCredits={totalCredits}
        onEarnCredits={handleEarnCredits}
        demoMode={demoMode}
        debugMode={debugMode}
        debugMenuOpen={debugMenuOpen}
        cameraPaused={cameraPaused}
        teleportRequest={teleportRequest}
        raceNonce={raceNonce}
        onTelemetryUpdate={setTelemetry}
        onRaceFinish={handleRaceFinish}
        onTogglePause={handleTogglePause}
        onToggleCameraPause={handleToggleCameraPause}
        onOpenDebugMenu={handleOpenDebugMenu}
        onCycleCamera={handleCycleCamera}
        actionTriggerRef={actionTriggerRef}
      />

      {/* Title Screen Stage Overlay */}
      {gameState === 'title' && debugMode === 'off' && !debugMenuOpen && (
        <TitleScreen
          settings={settings}
          upgrades={upgrades}
          totalCredits={totalCredits}
          onPurchaseUpgrade={handlePurchaseUpgrade}
          onUpdateSettings={handleUpdateSettings}
          onStartRace={handleStartRace}
          onStartDemo={handleStartDemo}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* Active Playing / Paused HUD Overlay */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <HudOverlay
          telemetry={telemetry}
          settings={settings}
          demoMode={demoMode}
          onOpenSettings={() => setSettingsOpen(true)}
          onTogglePause={handleTogglePause}
          onToggleMute={handleToggleMute}
          onCycleCamera={handleCycleCamera}
          onCycleMusicTheme={handleCycleMusicTheme}
          onTriggerBoost={handleTriggerBoost}
          onTriggerBonus={handleTriggerBonus}
          onTriggerWeapon={handleTriggerWeapon}
          onTakeControl={handleTakeControl}
          onExitDemo={handleExitDemo}
        />
      )}

      {/* Compact Non-Blocking Camera & Debug Control Bar (Active in Debug Mode or Menu-less [P] Pause) */}
      {!debugMenuOpen && !settingsOpen && (
        <DebugModeOverlay
          debugMode={debugMode}
          cameraPaused={cameraPaused}
          trackId={settings.trackId}
          onOpenDebugMenu={handleOpenDebugMenu}
          onToggleCameraPause={handleToggleCameraPause}
          onSelectMode={handleSelectDebugMode}
          onTeleportSector={handleTeleportSector}
        />
      )}

      {/* Standard Pause Status Modal (Only shown when paused via ESC/HUD button, NOT when paused via P or in K+E+S menu) */}
      {gameState === 'paused' && !settingsOpen && !debugMenuOpen && !cameraPaused && (
        <PauseModal
          musicTheme={settings.musicTheme}
          onSelectMusicTheme={(theme) => handleUpdateSettings({ musicTheme: theme })}
          onResume={() => setGameState('playing')}
          onRestart={demoMode ? handleStartDemo : handleStartRace}
          onOpenSettings={() => setSettingsOpen(true)}
          onReturnTitle={() => {
            setDemoMode(false);
            setSettingsOpen(false);
            setDebugMode('off');
            setCameraPaused(false);
            setGameState('title');
          }}
        />
      )}

      {/* Secret Debug Menu Modal (Activated via K + E + S keys) */}
      <SecretDebugModal
        isOpen={debugMenuOpen}
        debugMode={debugMode}
        cameraPaused={cameraPaused}
        settings={settings}
        onSelectMode={handleSelectDebugMode}
        onTeleportSector={handleTeleportSector}
        onUpdateSettings={handleUpdateSettings}
        onToggleCameraPause={handleToggleCameraPause}
        onClose={handleCloseDebugMenu}
      />

      {/* Race Complete / Game Over Modal */}
      {gameState === 'gameover' && raceSummary && !settingsOpen && !debugMenuOpen && (
        <RaceOverModal
          summary={raceSummary}
          onRaceAgain={handleStartRace}
          onSwitchTrack={() => {
            const order: TrackId[] = ['city', 'lava_v2'];
            const currentIdx = order.indexOf(settings.trackId);
            const nextTrack = order[(currentIdx === -1 ? 0 : currentIdx + 1) % order.length];
            handleUpdateSettings({
              trackId: nextTrack,
            });
            handleStartRace();
          }}
          onReturnTitle={() => {
            setDemoMode(false);
            setDebugMode('off');
            setCameraPaused(false);
            setGameState('title');
          }}
        />
      )}

      {/* Comprehensive Settings Modal (Available from Title, HUD, or Pause) */}
      <SettingsModal
        isOpen={settingsOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onResetDefaults={handleResetDefaults}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
