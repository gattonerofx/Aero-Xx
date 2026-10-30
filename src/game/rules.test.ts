import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BONUS_RESPAWN_SECONDS,
  DEFAULT_SETTINGS,
  POWERUP_META,
  SHIP_SPECS,
  calculateStandings,
  computeAiInput,
  computeWeatherState,
  createEnergyRings,
  createInitialRacers,
  createTrackPads,
  didCrossSplinePoint,
  estimateTrackCurvature,
  formatOrdinal,
  formatRaceTime,
  getAiDifficultyProfile,
  isWithinEnvironmentStructureZone,
  resolveRacerCollisions,
  resolveTrackBoundaryAndEnvironmentCollision,
  stepRacerPhysics,
  stepWeaponCombat,
} from './rules';

test('initial racers start with player in 4th position out of 6 and in the exact center of the track (lateralOffset = 0)', () => {
  const racers = createInitialRacers('valkyrie');
  assert.equal(racers.length, 6);
  const player = racers.find((r) => r.isPlayer)!;
  assert.equal(player.lateralOffset, 0, 'Player must start in the exact center of the track (lateralOffset = 0)');
  const standings = calculateStandings(racers);
  const playerRank = standings.findIndex((r) => r.isPlayer) + 1;
  assert.equal(playerRank, 4);
});

test('progressive acceleration from standstill builds speed gradually and boost accelerates even faster', () => {
  const [racerNormal] = createInitialRacers('valkyrie');
  const [racerBoost] = createInitialRacers('valkyrie');
  racerNormal.isPlayer = true;
  racerBoost.isPlayer = true;

  const initialEnergy = racerBoost.energy;

  // Step 1: 0.25s from standstill (0 KM/H) -> gradual launch acceleration, not an instant jump to max speed
  stepRacerPhysics(
    racerNormal,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: false,
    },
    0.25,
    9800,
    3,
    DEFAULT_SETTINGS,
    [],
    [],
    250
  );

  assert.ok(
    racerNormal.speedKmh > 35 && racerNormal.speedKmh < 120,
    `From standstill, 0.25s of throttle should accelerate progressively (got ${racerNormal.speedKmh})`
  );

  // Step with boost held for 0.5s
  stepRacerPhysics(
    racerBoost,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: true,
      useBonusPressed: false,
    },
    0.5,
    9800,
    3,
    DEFAULT_SETTINGS,
    [],
    [],
    500
  );

  assert.ok(
    racerBoost.speedKmh > racerNormal.speedKmh * 1.8,
    'Boost should accelerate progressively faster than normal throttle'
  );
  assert.ok(racerBoost.energy < initialEnergy, 'Energy should drain during manual boost');
  assert.equal(racerBoost.isBoosting, true);
});

test('activating hyper_turbine bonus grants progressive boost timer and clears heldBonus', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  player.heldBonus = 'hyper_turbine';
  player.speedKmh = 600;

  const res = stepRacerPhysics(
    player,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: true,
    },
    0.25,
    9800,
    3,
    DEFAULT_SETTINGS,
    [],
    [],
    1000
  );

  assert.equal(res.activatedBonus, 'hyper_turbine');
  assert.equal(player.heldBonus, 'none');
  assert.ok(player.speedKmh > 680, 'Hyper turbine should progressively surge speed');
  assert.ok(player.boostTimer >= 2.7);
});

test('fixed speed boost pads remain active for all racers while bonus/weapon squares disable for 10s when taken by an opponent', () => {
  assert.equal(BONUS_RESPAWN_SECONDS, 10.0, 'Bonus/weapon respawn time must be 10.0 seconds');

  const racers = createInitialRacers('spectre');
  const opponentAhead = racers[0];
  const player = racers.find((r) => r.isPlayer)!;

  const fixedBoostPad = {
    id: 10,
    t: 0.1,
    laneOffset: 0,
    type: 'boost' as const,
    powerUpType: 'boost' as const,
  };
  const bonusSquare = {
    id: 11,
    t: 0.1,
    laneOffset: 0,
    type: 'bonus' as const,
    powerUpType: 'nitro' as const,
  };
  const disabledPadIds = new Set<number>();

  // 1) Opponent in front passes over BOTH the fixed boost pad and the bonus square
  opponentAhead.t = 0.098;
  opponentAhead.totalProgress = 0.098;
  opponentAhead.lateralOffset = 0;
  opponentAhead.speedKmh = 700;

  const oppRes = stepRacerPhysics(
    opponentAhead,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: false,
    },
    0.25,
    9800,
    3,
    DEFAULT_SETTINGS,
    [fixedBoostPad, bonusSquare],
    [],
    1000,
    undefined,
    undefined,
    disabledPadIds
  );

  assert.equal(oppRes.hitBoostPad, true, 'Opponent should get speed boost from fixed boost pad');
  assert.equal(oppRes.collectedPowerUp, 'nitro', 'Opponent should collect the nitro bonus square');
  assert.equal(
    oppRes.collectedPadId,
    11,
    'Only the bonus square (id=11) should be marked collected for 10s respawn'
  );
  disabledPadIds.add(oppRes.collectedPadId!);

  //Even if someone added the fixed boost pad ID to disabledPadIds, fixed boost pads NEVER disable:
  disabledPadIds.add(fixedBoostPad.id);

  // 2) Player right behind opponent passes over the same spot before 10 seconds elapse
  player.t = 0.098;
  player.totalProgress = 0.098;
  player.lateralOffset = 0;
  player.speedKmh = 700;

  const playerRes = stepRacerPhysics(
    player,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: false,
    },
    0.25,
    9800,
    3,
    DEFAULT_SETTINGS,
    [fixedBoostPad, bonusSquare],
    [],
    1500,
    undefined,
    undefined,
    disabledPadIds
  );

  assert.equal(
    playerRes.hitBoostPad,
    true,
    'Fixed speed boost pad on track must STILL grant boost to player passing after opponent'
  );
  assert.equal(
    player.heldBonus,
    'none',
    'Bonus square taken by opponent in front must NOT be available until 10s respawn completes'
  );
});

test('three AI difficulty levels (Novice, Professional, Apex) adjust AI speed, boost usage, and steering precision', () => {
  const noviceProfile = getAiDifficultyProfile('novice');
  const proProfile = getAiDifficultyProfile('professional');
  const apexProfile = getAiDifficultyProfile('apex');

  assert.ok(
    noviceProfile.speedFactor < proProfile.speedFactor &&
      proProfile.speedFactor < apexProfile.speedFactor,
    'AI speed factor must scale strictly: Novice < Professional < Apex'
  );
  assert.ok(
    noviceProfile.boostChance < proProfile.boostChance &&
      proProfile.boostChance < apexProfile.boostChance,
    'AI boost usage probability must scale strictly: Novice < Professional < Apex'
  );
  assert.ok(
    noviceProfile.steerDeadzone > proProfile.steerDeadzone &&
      proProfile.steerDeadzone > apexProfile.steerDeadzone,
    'AI steering deadzone must tighten (higher precision) from Novice -> Professional -> Apex'
  );

  // Simulate 3 seconds of straight-line acceleration for Novice, Professional, and Apex AI racers
  const [aiNovice] = createInitialRacers('valkyrie');
  const [aiPro] = createInitialRacers('valkyrie');
  const [aiApex] = createInitialRacers('valkyrie');

  const neutralAiInput = {
    throttle: true,
    brake: false,
    steerLeft: false,
    steerRight: false,
    airbrakeLeft: false,
    airbrakeRight: false,
    boostHeld: false,
    useBonusPressed: false,
  };

  for (let s = 0; s < 30; s++) {
    stepRacerPhysics(
      aiNovice,
      neutralAiInput,
      0.1,
      9800,
      3,
      { ...DEFAULT_SETTINGS, aiDifficulty: 'novice' },
      [],
      [],
      s * 100
    );
    stepRacerPhysics(
      aiPro,
      neutralAiInput,
      0.1,
      9800,
      3,
      { ...DEFAULT_SETTINGS, aiDifficulty: 'professional' },
      [],
      [],
      s * 100
    );
    stepRacerPhysics(
      aiApex,
      neutralAiInput,
      0.1,
      9800,
      3,
      { ...DEFAULT_SETTINGS, aiDifficulty: 'apex' },
      [],
      [],
      s * 100
    );
  }

  assert.ok(
    aiNovice.speedKmh < aiPro.speedKmh && aiPro.speedKmh < aiApex.speedKmh,
    `Expected AI speeds Novice (${aiNovice.speedKmh}) < Professional (${aiPro.speedKmh}) < Apex (${aiApex.speedKmh})`
  );

  // Verify precision of computeAiInput when offset by 0.45m from target lane
  const testAi = createInitialRacers('valkyrie')[0];
  testAi.t = 0.0;
  const pads = [{ id: 1, t: 0.02, laneOffset: 0, type: 'boost' as const, powerUpType: 'boost' as const }];
  testAi.lateralOffset = 0.48;
  const noviceDecision = computeAiInput(
    testAi,
    0,
    { ...DEFAULT_SETTINGS, aiDifficulty: 'novice' },
    pads,
    0
  );
  const apexDecision = computeAiInput(
    testAi,
    0,
    { ...DEFAULT_SETTINGS, aiDifficulty: 'apex' },
    pads,
    0
  );
  assert.equal(
    noviceDecision.steerLeft,
    false,
    'Novice AI has wider deadzone and should not micro-correct 0.48m offset'
  );
  assert.equal(
    apexDecision.steerLeft,
    true,
    'Apex AI has razor-sharp precision and actively corrects 0.48m offset toward boost pad'
  );
});

test('lap completion increments lap and finishes race after totalLaps', () => {
  const racers = createInitialRacers('titan');
  const player = racers.find((r) => r.isPlayer)!;
  player.t = 0.99;
  player.totalProgress = 2.99;
  player.lap = 3;
  player.speedKmh = SHIP_SPECS.titan.maxSpeedKmh;

  const res = stepRacerPhysics(
    player,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: false,
    },
    0.5,
    4200,
    3,
    DEFAULT_SETTINGS,
    [],
    [],
    95420
  );

  assert.equal(res.completedLap, true);
  assert.equal(res.raceFinished, true);
  assert.equal(player.finished, true);
  assert.equal(player.finishTimeMs, 95420);
});

test('formatRaceTime and formatOrdinal format HUD numbers accurately', () => {
  assert.equal(formatRaceTime(null), '--:--.--');
  assert.equal(formatRaceTime(0), '0:00.00');
  assert.equal(formatRaceTime(74320), '1:14.32');
  assert.deepEqual(formatOrdinal(1), { num: '1', suffix: 'ST' });
  assert.deepEqual(formatOrdinal(4), { num: '4', suffix: 'TH' });
  assert.equal(didCrossSplinePoint(0.98, 1.02, 0.01), true);
});

test('sustained throttle and boost never exceed aerodynamic speed ceiling', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  player.ringChain = 5;
  player.ringChainTimer = 10;

  for (let step = 0; step < 120; step++) {
    player.energy = 100;
    stepRacerPhysics(
      player,
      {
        throttle: true,
        brake: false,
        steerLeft: false,
        steerRight: false,
        airbrakeLeft: false,
        airbrakeRight: false,
        boostHeld: true,
        useBonusPressed: false,
      },
      0.1,
      4200,
      3,
      DEFAULT_SETTINGS,
      [],
      [],
      step * 100
    );
  }

  assert.ok(
    player.speedKmh <= 1180,
    `Speed should cap cleanly at aerodynamic ceiling (got ${player.speedKmh})`
  );
});

test('dynamic weather system computes rain in city and ash_storm in lava affecting grip and visibility', () => {
  const cityStorm = computeWeatherState('city', 'storm', 10);
  assert.equal(cityStorm.type, 'rain');
  assert.ok(cityStorm.intensity > 0.8);
  assert.ok(cityStorm.surfaceGrip < 0.7, 'Storm rain should reduce surface grip');
  assert.ok(cityStorm.visibilityFactor < 0.65, 'Storm rain should reduce visual clarity');

  const lavaStorm = computeWeatherState('lava', 'dynamic', 5);
  assert.equal(lavaStorm.type, 'ash_storm');
  assert.ok(lavaStorm.intensity > 0.2);
  assert.ok(lavaStorm.surfaceGrip < 1.0);

  const clearState = computeWeatherState('city', 'clear', 25);
  assert.equal(clearState.type, 'clear');
  assert.equal(clearState.surfaceGrip, 1.0);
  assert.equal(clearState.visibilityFactor, 1.0);
});

test('low surfaceGrip in storm weather causes wider lateral drift than dry conditions', () => {
  const [dryRacer] = createInitialRacers('valkyrie');
  const [wetRacer] = createInitialRacers('valkyrie');
  dryRacer.lateralVelocity = 18;
  wetRacer.lateralVelocity = 18;
  dryRacer.speedKmh = 750;
  wetRacer.speedKmh = 750;

  const clearWeather = computeWeatherState('city', 'clear', 0);
  const stormWeather = computeWeatherState('city', 'storm', 0);

  const neutralInput = {
    throttle: true,
    brake: false,
    steerLeft: false,
    steerRight: false,
    airbrakeLeft: false,
    airbrakeRight: false,
    boostHeld: false,
    useBonusPressed: false,
  };

  stepRacerPhysics(dryRacer, neutralInput, 0.25, 4200, 3, DEFAULT_SETTINGS, [], [], 1000, clearWeather);
  stepRacerPhysics(wetRacer, neutralInput, 0.25, 4200, 3, DEFAULT_SETTINGS, [], [], 1000, stormWeather);

  assert.ok(
    wetRacer.lateralVelocity > dryRacer.lateralVelocity,
    'Wet/ash-slicked surface should retain more lateral slide velocity than dry road'
  );
});

test('resolveRacerCollisions detects vehicle-to-vehicle contact and separates hulls', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  const rival = racers[0];

  player.t = 0.25;
  rival.t = 0.2504;
  player.lateralOffset = 1.0;
  rival.lateralOffset = 2.1;
  player.speedKmh = 820;
  rival.speedKmh = 680;

  const events = resolveRacerCollisions(racers, 4200);
  assert.ok(events.length >= 1, 'Should detect collision between overlapping player and rival');
  const ev = events.find((e) => e.involvesPlayer)!;
  assert.ok(ev, 'Collision event should mark involvesPlayer = true');
  assert.ok(
    Math.abs(rival.lateralOffset - player.lateralOffset) > 2.5,
    'Overlapping hulls should be pushed apart laterally'
  );
  assert.ok(
    rival.speedKmh > 680 && player.speedKmh < 820,
    'Rear-end contact should transfer longitudinal momentum from trailing craft to leading craft'
  );
});

test('createTrackPads generates chained velocity-boost series and floating 3D weapon/power-up boxes along the racing line', () => {
  const cityPads = createTrackPads('city');
  const lavaPads = createTrackPads('lava_v2');
  assert.equal(cityPads.length, 36, 'City track should have 36 total pads/boxes (18 chained boost pads + 9 bonus + 9 weapon)');
  assert.equal(lavaPads.length, 25, 'Lava track should have 25 total pads/boxes (15 chained boost pads + 5 bonus + 5 weapon)');
  assert.equal(createTrackPads('city', false).length, 0, 'Passing enableLegacyPads=false disables pads');

  const cityBoostPads = cityPads.filter((p) => p.type === 'boost');
  const lavaBoostPads = lavaPads.filter((p) => p.type === 'boost');
  assert.equal(cityBoostPads.length, 18, 'City track should have 6 chains of 3 velocity-boost pads (18 total)');
  assert.equal(lavaBoostPads.length, 15, 'Lava track should have 5 chains of 3 velocity-boost pads (15 total)');

  // Ensure no pad is placed on top of the starting grid (t < 0.05) and each 3-pad chain is spaced for consecutive chaining
  assert.ok(cityPads.every((p) => p.t >= 0.055), 'No pad should sit directly in front of the starting grid');
  for (let s = 0; s < 6; s++) {
    const c0 = cityBoostPads[s * 3];
    const c1 = cityBoostPads[s * 3 + 1];
    const c2 = cityBoostPads[s * 3 + 2];
    assert.ok(
      Math.abs(c1.t - c0.t - 0.02) < 0.002 && Math.abs(c2.t - c1.t - 0.02) < 0.002,
      'Each velocity-boost chain should place 3 consecutive pads ~0.020 spline units apart'
    );
  }
});

test('collecting each of the power-up boxes applies its specific race effect', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;

  const neutralInput = {
    throttle: true,
    brake: false,
    steerLeft: false,
    steerRight: false,
    airbrakeLeft: false,
    airbrakeRight: false,
    boostHeld: false,
    useBonusPressed: false,
  };

  // Test CREDIT BONUS pickup
  player.t = 0.195;
  player.totalProgress = 0.195;
  player.lateralOffset = 0;
  player.speedKmh = 750;
  const creditPad = [{ id: 100, t: 0.2, laneOffset: 0, type: 'bonus' as const, powerUpType: 'credit' as const }];
  const resCredit = stepRacerPhysics(player, neutralInput, 0.25, 4200, 3, DEFAULT_SETTINGS, creditPad, [], 1000);
  assert.equal(resCredit.collectedPowerUp, 'credit');
  assert.ok(player.creditsEarned >= 150, 'Credit Bonus should award +150 CR');

  // Test REPAIR POWER-UP pickup
  player.t = 0.295;
  player.totalProgress = 0.295;
  player.energy = 35;
  const repairPad = [{ id: 101, t: 0.3, laneOffset: 0, type: 'recharge' as const, powerUpType: 'repair' as const }];
  const resRepair = stepRacerPhysics(player, neutralInput, 0.25, 4200, 3, DEFAULT_SETTINGS, repairPad, [], 1100);
  assert.equal(resRepair.collectedPowerUp, 'repair');
  assert.equal(player.energy, 100, 'Repair Power-Up should restore full vehicle hull & energy');
});

test('single-slot weapon lock keeps weapon until used with Z and prevents collecting another weapon', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  player.t = 0.005;
  player.totalProgress = 0.005;
  player.lateralOffset = 0;
  player.speedKmh = 760;

  const weaponPads = [
    { id: 201, t: 0.01, laneOffset: 0, type: 'weapon' as const, weaponType: 'missile' as const },
    { id: 202, t: 0.015, laneOffset: 0, type: 'weapon' as const, weaponType: 'laser' as const },
  ];

  const res1 = stepRacerPhysics(
    player,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: false,
      useWeaponPressed: false,
    },
    0.35,
    4200,
    3,
    DEFAULT_SETTINGS,
    weaponPads,
    [],
    1000
  );

  assert.equal(res1.collectedWeapon, 'missile');
  assert.equal(player.heldWeapon, 'missile', 'Player must keep first weapon and ignore second weapon box while holding one');

  const resFire = stepRacerPhysics(
    player,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: false,
      useWeaponPressed: true,
    },
    0.05,
    4200,
    3,
    DEFAULT_SETTINGS,
    [],
    [],
    1350
  );

  assert.equal(resFire.firedWeapon, 'missile');
  assert.equal(player.heldWeapon, 'none', 'Held weapon slot should clear only after pressing Z');
});

test('all 4 weapons (missile, laser, shockwave, mines) hit opponents unless target has Shield active', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  const rivalFront = racers[0];
  const rivalBehind = racers[5];

  player.t = 0.30;
  player.totalProgress = 0.30;
  player.lateralOffset = 0;
  player.speedKmh = 760;

  rivalFront.t = 0.304;
  rivalFront.totalProgress = 0.304;
  rivalFront.lateralOffset = 0;
  rivalFront.energy = 100;
  rivalFront.shieldTimer = 0;

  rivalBehind.t = 0.296;
  rivalBehind.totalProgress = 0.296;
  rivalBehind.lateralOffset = 0;
  rivalBehind.energy = 100;
  rivalBehind.shieldTimer = 0;

  const activeMissiles: import('./types').ActiveMissile[] = [];
  const activeMines: import('./types').ActiveMine[] = [];

  const swEvents = stepWeaponCombat(
    racers,
    activeMissiles,
    activeMines,
    [{ attackerId: player.id, weapon: 'shockwave' }],
    0.1,
    4200
  );
  assert.ok(
    swEvents.some((e) => e.type === 'shockwave_hit'),
    'Shockwave should hit opponents within radius'
  );
  assert.ok(rivalFront.energy < 100, 'Shockwave should reduce unshielded opponent energy');

  const energyBeforeShieldTest = rivalFront.energy;
  rivalFront.shieldTimer = 5.0;
  const launchEvs = stepWeaponCombat(
    racers,
    activeMissiles,
    activeMines,
    [{ attackerId: player.id, weapon: 'missile' }],
    0.05,
    4200
  );
  assert.equal(activeMissiles.length, 1, 'Homing missile should be spawned');

  let shieldDeflected = launchEvs.some((e) => e.type === 'missile_shielded');
  for (let step = 0; step < 20 && !shieldDeflected; step++) {
    const evs = stepWeaponCombat(racers, activeMissiles, activeMines, [], 0.05, 4200);
    if (evs.some((e) => e.type === 'missile_shielded')) {
      shieldDeflected = true;
      break;
    }
  }
  assert.equal(shieldDeflected, true, 'Active shield must deflect homing missile');
  assert.equal(rivalFront.energy, energyBeforeShieldTest, 'Shielded vehicle must not lose energy when hit');

  rivalFront.shieldTimer = 0;
  const laserEvs = stepWeaponCombat(
    racers,
    activeMissiles,
    activeMines,
    [{ attackerId: player.id, weapon: 'laser' }, { attackerId: player.id, weapon: 'mines' }],
    0.2,
    4200
  );
  assert.ok(laserEvs.some((e) => e.type === 'laser_hit'), 'Forward laser beam should hit opponent in front');
  assert.equal(activeMines.length, 1, 'Rear proximity mine should be deployed onto track');
});

test('touching track edges/guardrails or weapon hits decreases vehicle energy and explodes vehicle at 0', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  player.energy = 11;
  player.lateralOffset = 11.2;
  player.speedKmh = 780;
  player.shieldTimer = 0;

  const res = stepRacerPhysics(
    player,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: true,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: false,
      useWeaponPressed: false,
    },
    0.25,
    4200,
    3,
    DEFAULT_SETTINGS,
    [],
    [],
    3000
  );

  assert.equal(res.wallCollision, true);
  assert.equal(player.energy, 0, 'Guardrail impact with low energy should deplete energy to 0');
  assert.equal(player.isDestroyed, true, 'Reaching 0 energy must mark vehicle as destroyed');
  assert.equal(res.exploded, true, 'Reaching 0 energy must trigger vehicle explosion');
});

test('corner curvature exerts centrifugal lateral pull requiring active steering and braking', () => {
  // Find a curved section on the City spline
  const curveVal = estimateTrackCurvature('city', 0.12);
  assert.ok(Math.abs(curveVal) > 0.05, 'Track curvature should be non-zero in curved sectors');

  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  player.t = 0.12;
  player.speedKmh = 760;
  player.lateralOffset = 0;
  player.lateralVelocity = 0;

  stepRacerPhysics(
    player,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: false,
    },
    0.2,
    9800,
    3,
    DEFAULT_SETTINGS,
    [],
    [],
    1000
  );

  assert.ok(
    Math.abs(player.lateralOffset) > 0.1,
    'High-speed cornering without steering input should experience centrifugal lateral pull'
  );
});

test('player can steer freely across the entire roadway width (-11.8m to +11.8m) on both City and Lava circuits', () => {
  for (const trackId of ['city', 'lava_v2'] as const) {
    const racers = createInitialRacers('valkyrie');
    const player = racers.find((r) => r.isPlayer)!;
    player.t = 0.002;
    player.lateralOffset = 0;
    player.speedKmh = 520;
    const settings = { ...DEFAULT_SETTINGS, trackId };

    // Steer left for 1.0s — must reach the far-left lane near -11.8m
    for (let i = 0; i < 20; i++) {
      stepRacerPhysics(
        player,
        {
          throttle: true,
          brake: false,
          steerLeft: true,
          steerRight: false,
          airbrakeLeft: false,
          airbrakeRight: false,
          boostHeld: false,
          useBonusPressed: false,
        },
        0.05,
        9600,
        3,
        settings,
        [],
        [],
        i * 50
      );
    }
    assert.ok(
      player.lateralOffset <= -10.5,
      `Expected player on ${trackId} to reach far-left lane (<= -10.5m), got ${player.lateralOffset.toFixed(2)}m`
    );

    // Release steering on straight section — vehicle must hold its left lane and NOT snap back to center
    player.t = 0.002;
    for (let i = 0; i < 10; i++) {
      stepRacerPhysics(
        player,
        {
          throttle: true,
          brake: false,
          steerLeft: false,
          steerRight: false,
          airbrakeLeft: false,
          airbrakeRight: false,
          boostHeld: false,
          useBonusPressed: false,
        },
        0.05,
        9600,
        3,
        settings,
        [],
        [],
        1000 + i * 50
      );
    }
    assert.ok(
      player.lateralOffset <= -9.5,
      `Expected player on ${trackId} to remain in the left lane after releasing steer, got ${player.lateralOffset.toFixed(2)}m`
    );

    // Steer right for 1.2s — must cross the entire roadway to the far-right lane near +11.8m
    for (let i = 0; i < 24; i++) {
      stepRacerPhysics(
        player,
        {
          throttle: true,
          brake: false,
          steerLeft: false,
          steerRight: true,
          airbrakeLeft: false,
          airbrakeRight: false,
          boostHeld: false,
          useBonusPressed: false,
        },
        0.05,
        9600,
        3,
        settings,
        [],
        [],
        2000 + i * 50
      );
    }
    assert.ok(
      player.lateralOffset >= 10.5,
      `Expected player on ${trackId} to reach far-right lane (>= +10.5m), got ${player.lateralOffset.toFixed(2)}m`
    );
  }
});

test('player vehicle never advances on its own when doing nothing, even when AI racers launch from behind', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  const startT = player.t;
  const pads = createTrackPads('city');
  const rings = createEnergyRings('city');

  const idleInput = {
    throttle: false,
    brake: false,
    steerLeft: false,
    steerRight: false,
    airbrakeLeft: false,
    airbrakeRight: false,
    boostHeld: false,
    useBonusPressed: false,
  };

  // Simulate 10 full seconds of race after countdown while player does nothing
  for (let step = 0; step < 200; step++) {
    const dt = 0.05;
    const elapsedMs = step * 50;
    stepRacerPhysics(player, idleInput, dt, 9800, 3, DEFAULT_SETTINGS, pads, rings, elapsedMs);
    for (let i = 0; i < racers.length; i++) {
      const r = racers[i];
      if (!r.isPlayer) {
        const aiIn = computeAiInput(r, i, DEFAULT_SETTINGS, pads, player.totalProgress, racers);
        stepRacerPhysics(r, aiIn, dt, 9800, 3, DEFAULT_SETTINGS, pads, rings, elapsedMs);
      }
    }
    resolveRacerCollisions(racers, 9800);
  }

  assert.equal(player.speedKmh, 0, 'Player speed must remain 0 KM/H when player does nothing');
  assert.equal(player.t, startT, 'Player spline position t must not advance when player does nothing');

  // Also verify that if a moving player with active boostTimer releases all inputs, they decelerate to 0 KM/H
  player.speedKmh = 350;
  player.boostTimer = 1.65;
  for (let step = 0; step < 60; step++) {
    stepRacerPhysics(player, idleInput, 0.05, 9800, 3, DEFAULT_SETTINGS, pads, rings, 10000 + step * 50);
  }
  assert.equal(
    player.speedKmh,
    0,
    `Expected moving player who releases throttle to coast to a stop (0 KM/H), got ${player.speedKmh}`
  );
});

test('precision lane changes stop cleanly on key release without overshoot, and guardrail contact uses smooth time-scaled friction', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  player.t = 0.002;
  player.lateralOffset = 0;
  player.speedKmh = 600;

  const dt = 1 / 60;
  // 1. Tap steerLeft for 0.25s (15 frames at 60 FPS) to shift roughly one lane left
  for (let f = 0; f < 15; f++) {
    player.t = 0.002;
    stepRacerPhysics(
      player,
      {
        throttle: true,
        brake: false,
        steerLeft: true,
        steerRight: false,
        airbrakeLeft: false,
        airbrakeRight: false,
        boostHeld: false,
        useBonusPressed: false,
      },
      dt,
      9800,
      3,
      DEFAULT_SETTINGS,
      [],
      [],
      f * 16.6
    );
  }
  const offsetAtRelease = player.lateralOffset;
  assert.ok(
    offsetAtRelease < -3.5 && offsetAtRelease > -8.2,
    `0.25s steer tap should move cleanly by ~1 lane (-3.5m..-8.2m), got ${offsetAtRelease.toFixed(2)}m`
  );

  // 2. Release steering for 0.5s (30 frames at 60 FPS): must settle rapidly without sliding into the wall
  for (let f = 0; f < 30; f++) {
    player.t = 0.002;
    stepRacerPhysics(
      player,
      {
        throttle: true,
        brake: false,
        steerLeft: false,
        steerRight: false,
        airbrakeLeft: false,
        airbrakeRight: false,
        boostHeld: false,
        useBonusPressed: false,
      },
      dt,
      9800,
      3,
      DEFAULT_SETTINGS,
      [],
      [],
      300 + f * 16.6
    );
  }
  const overshootDist = Math.abs(player.lateralOffset - offsetAtRelease);
  assert.ok(
    overshootDist < 2.2 && player.lateralOffset > -9.0,
    `Releasing steer key must lock into lane without wall overshoot (overshoot=${overshootDist.toFixed(2)}m, offset=${player.lateralOffset.toFixed(2)}m)`
  );

  // 3. Scrape along the outer guardrail for 0.5s (30 frames at 60 FPS):
  // verify speed remains high (> 550 KM/H instead of collapsing to 100 KM/H) and energy remains > 80%
  player.lateralOffset = 11.84;
  player.speedKmh = 700;
  player.energy = 100;
  for (let f = 0; f < 30; f++) {
    stepRacerPhysics(
      player,
      {
        throttle: true,
        brake: false,
        steerLeft: false,
        steerRight: true,
        airbrakeLeft: false,
        airbrakeRight: false,
        boostHeld: false,
        useBonusPressed: false,
      },
      dt,
      9800,
      3,
      DEFAULT_SETTINGS,
      [],
      [],
      1000 + f * 16.6
    );
  }
  assert.ok(
    player.speedKmh > 600,
    `0.5s guardrail rub at 60 FPS must not cripple speed (expected > 600 KM/H, got ${player.speedKmh.toFixed(1)} KM/H)`
  );
  assert.ok(
    player.energy > 80,
    `0.5s guardrail rub at 60 FPS must not drain excessive hull energy (expected > 80%, got ${player.energy.toFixed(1)}%)`
  );
});

test('Extended Lava Circuit curvature anchors and 3-lap simulation run cleanly across all 4 sectors', () => {
  // Verify distinct corner curvature in Caldera Parabolica (t~0.08), Hairpin 1 (t~0.45), and Hairpin 2 (t~0.64)
  const parabolicaCurve = estimateTrackCurvature('lava_v2', 0.08);
  const hairpin1Curve = estimateTrackCurvature('lava_v2', 0.45);
  const hairpin2Curve = estimateTrackCurvature('lava_v2', 0.64);
  assert.ok(Math.abs(parabolicaCurve) > 0.1, 'Caldera Parabolica should register significant curvature');
  assert.ok(Math.abs(hairpin1Curve) > 0.25, 'Southern Caldera Hairpin 1 should register tight corner curvature');
  assert.ok(Math.abs(hairpin2Curve) > 0.25, 'Northern Obsidian Rim Hairpin 2 should register tight corner curvature');

  // Simulate a full 3-lap race on Extended Lava Circuit (9,600m) for AI and steered player
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  const pads = createTrackPads('lava_v2');
  const rings = createEnergyRings('lava_v2');
  const lavaSettings = { ...DEFAULT_SETTINGS, trackId: 'lava_v2' as const };

  let elapsedMs = 0;
  const dt = 0.05;
  for (let step = 0; step < 6500 && !player.finished; step++) {
    elapsedMs += dt * 1000;
    const curve = estimateTrackCurvature('lava_v2', player.t);
    const steerLeft = curve > 0.08 || player.lateralOffset > 2.5;
    const steerRight = curve < -0.08 || player.lateralOffset < -2.5;
    stepRacerPhysics(
      player,
      {
        throttle: true,
        brake: Math.abs(curve) > 0.78 && player.speedKmh > 620,
        steerLeft,
        steerRight,
        airbrakeLeft: curve > 0.58,
        airbrakeRight: curve < -0.58,
        boostHeld: Math.abs(curve) < 0.25 && player.energy > 45,
        useBonusPressed: player.heldBonus !== 'none',
      },
      dt,
      9600,
      3,
      lavaSettings,
      pads,
      rings,
      elapsedMs
    );
    // Keep hull topped up to verify full 3-lap geometry/progress traversal
    if (player.energy < 35) player.energy = 85;
  }

  assert.equal(player.finished, true, 'Player should complete all 3 laps on the Extended Lava Circuit');
  assert.equal(player.lap, 3, 'Completed lap counter should be 3');
  assert.ok(
    elapsedMs > 75000 && elapsedMs < 320000,
    `Expected 3-lap Extended Lava Circuit duration between 75s and 320s, got ${(elapsedMs / 1000).toFixed(1)}s`
  );
});

test('Strategic boost pads accelerate vehicle to high velocity and gameSpeed setting scales physical travel speed', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  player.t = 0.055;
  player.totalProgress = 0.055;
  player.lateralOffset = 0;
  player.speedKmh = 820;

  const boostPad = [
    { id: 1, t: 0.058, laneOffset: 0.0, type: 'boost' as const, powerUpType: 'boost' as const },
  ];

  const res = stepRacerPhysics(
    player,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: false,
    },
    0.2,
    9800,
    3,
    DEFAULT_SETTINGS,
    boostPad,
    [],
    1000
  );

  assert.equal(res.hitBoostPad, true, 'Crossing strategic boost pad should trigger hitBoostPad');
  assert.ok(
    player.speedKmh >= 1000,
    `Strategic boost pad should surge vehicle speed above 1000 KM/H (got ${player.speedKmh.toFixed(1)} KM/H)`
  );

  // Verify settings.gameSpeed scales actual physical progress along the spline
  const rNormal = createInitialRacers('valkyrie').find((r) => r.isPlayer)!;
  const rTurbo = createInitialRacers('valkyrie').find((r) => r.isPlayer)!;
  rNormal.speedKmh = 750;
  rTurbo.speedKmh = 750;

  stepRacerPhysics(
    rNormal,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: false,
    },
    0.1,
    9800,
    3,
    { ...DEFAULT_SETTINGS, gameSpeed: 1.0 },
    [],
    [],
    1000
  );
  stepRacerPhysics(
    rTurbo,
    {
      throttle: true,
      brake: false,
      steerLeft: false,
      steerRight: false,
      airbrakeLeft: false,
      airbrakeRight: false,
      boostHeld: false,
      useBonusPressed: false,
    },
    0.1,
    9800,
    3,
    { ...DEFAULT_SETTINGS, gameSpeed: 1.5 },
    [],
    [],
    1000
  );

  const normalDelta = rNormal.totalProgress - 0.002;
  const turboDelta = rTurbo.totalProgress - 0.002;
  assert.ok(
    turboDelta > normalDelta * 1.45,
    `gameSpeed=1.5 should increase physical spline progress by ~1.5x (normalDelta=${normalDelta.toFixed(5)}, turboDelta=${turboDelta.toFixed(5)})`
  );
});

test('DEFAULT_SETTINGS sets perspective view as default and disables Motion Lines and Camera G-Force by default', () => {
  assert.equal(DEFAULT_SETTINGS.cameraMode, 'perspective', 'Default camera mode must be perspective');
  assert.equal(DEFAULT_SETTINGS.enableMotionLines, false, 'High Speed Motion Lines must be OFF by default');
  assert.equal(DEFAULT_SETTINGS.enableGForceTilt, false, 'Camera G-Force Tilt must be OFF by default');

  // Verify vehicle drift angle (yawOffset) builds smoothly during high-speed cornering maneuvers in open roadway
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  player.lateralOffset = 4.0;
  player.speedKmh = 680;
  for (let i = 0; i < 5; i++) {
    stepRacerPhysics(
      player,
      {
        throttle: true,
        brake: false,
        steerLeft: true,
        steerRight: false,
        airbrakeLeft: true,
        airbrakeRight: false,
        boostHeld: false,
        useBonusPressed: false,
      },
      0.05,
      9800,
      3,
      DEFAULT_SETTINGS,
      [],
      [],
      i * 50
    );
  }
  assert.ok(
    Math.abs(player.yawOffset) > 0.12,
    `Expected significant vehicle drift angle (yawOffset) during high-speed cornering maneuver, got ${player.yawOffset.toFixed(3)}`
  );
});

test('Player starting at race center (index 3 in racers array) never flickers when idle and freely steers from -12.13m to +12.13m', () => {
  const racers = createInitialRacers('valkyrie');
  const playerIdx = racers.findIndex((r) => r.isPlayer);
  assert.equal(playerIdx, 3, 'Player starts at index 3 (4th grid slot) in racers array');
  const player = racers[playerIdx];
  assert.equal(player.lateralOffset, 0, 'Player starts centered on the track');

  // 1. Simulate 60 frames of race loop where player is idle and AI loop skips r.isPlayer:
  // verify zero lateral/roll/yaw flickering and zero unwanted forward movement
  const dt = 1 / 60;
  for (let frame = 0; frame < 60; frame++) {
    stepRacerPhysics(
      player,
      {
        throttle: false,
        brake: false,
        steerLeft: false,
        steerRight: false,
        airbrakeLeft: false,
        airbrakeRight: false,
        boostHeld: false,
        useBonusPressed: false,
      },
      dt,
      9800,
      3,
      DEFAULT_SETTINGS,
      [],
      [],
      frame * 16.6
    );
    for (let i = 0; i < racers.length; i++) {
      const r = racers[i];
      if (r.isPlayer) continue;
      const aiInput = computeAiInput(r, i, DEFAULT_SETTINGS, [], player.totalProgress, racers);
      stepRacerPhysics(r, aiInput, dt, 9800, 3, DEFAULT_SETTINGS, [], [], frame * 16.6);
    }
    assert.equal(player.lateralOffset, 0, 'Idle player lateralOffset must stay at 0 without flickering');
    assert.equal(player.rollAngle, 0, 'Idle player rollAngle must stay at 0 without flickering');
    assert.equal(player.yawOffset, 0, 'Idle player yawOffset must stay at 0 without flickering');
    assert.equal(player.speedKmh, 0, 'Idle player speedKmh must stay at 0 when throttle is not pressed');
  }

  // 2. Steer left from standstill/low speed all the way to the left guardrail (-12.13m)
  for (let frame = 0; frame < 90; frame++) {
    stepRacerPhysics(
      player,
      {
        throttle: true,
        brake: false,
        steerLeft: true,
        steerRight: false,
        airbrakeLeft: false,
        airbrakeRight: false,
        boostHeld: false,
        useBonusPressed: false,
      },
      dt,
      9800,
      3,
      DEFAULT_SETTINGS,
      [],
      [],
      1000 + frame * 16.6
    );
  }
  assert.ok(
    player.lateralOffset <= -12.1,
    `Player must be able to roam all the way to the left guardrail (<= -12.1m), got ${player.lateralOffset.toFixed(2)}m`
  );

  // 3. Steer right across the entire track width all the way to the right guardrail (+12.13m)
  for (let frame = 0; frame < 120; frame++) {
    stepRacerPhysics(
      player,
      {
        throttle: true,
        brake: false,
        steerLeft: false,
        steerRight: true,
        airbrakeLeft: false,
        airbrakeRight: false,
        boostHeld: false,
        useBonusPressed: false,
      },
      dt,
      9800,
      3,
      DEFAULT_SETTINGS,
      [],
      [],
      3000 + frame * 16.6
    );
  }
  assert.ok(
    player.lateralOffset >= 12.1,
    `Player must be able to roam all the way across the track to the right guardrail (>= +12.1m), got ${player.lateralOffset.toFixed(2)}m`
  );
});

// 21. Default Game Speed 125% & Unified Electric-Blue Triple-Arrow Boost Pad Metadata
test('DEFAULT_SETTINGS.gameSpeed is 1.25 (125%) and POWERUP_META.boost uses electric-blue triple-arrow styling', () => {
  assert.strictEqual(DEFAULT_SETTINGS.gameSpeed, 1.25, 'Default gameSpeed must be 1.25 (125%)');
  assert.strictEqual(POWERUP_META.boost.color, '#00e5ff', 'Boost pad primary color must be electric blue (#00e5ff)');
  assert.strictEqual(POWERUP_META.boost.accentHex, 0x00e5ff, 'Boost pad accentHex must be 0x00e5ff');
});

// 22. Progressive Boost Pad Series Combo (1 -> 2 -> 3) Rewards Higher Velocity & Combo Count
test('Hitting boost pads in series increments boostComboCount (1 -> 2 -> 3) and awards progressively higher speed', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  player.speedKmh = 300;
  player.lateralOffset = 0;

  const seriesPads = [
    { id: 101, t: 0.1, laneOffset: 0, type: 'boost' as const, powerUpType: 'boost' as const },
    { id: 102, t: 0.2, laneOffset: 0, type: 'boost' as const, powerUpType: 'boost' as const },
    { id: 103, t: 0.3, laneOffset: 0, type: 'boost' as const, powerUpType: 'boost' as const },
  ];

  // Hit Pad 1
  player.t = 0.1;
  const res1 = stepRacerPhysics(
    player,
    { throttle: true, brake: false, steerLeft: false, steerRight: false, airbrakeLeft: false, airbrakeRight: false, boostHeld: false, useBonusPressed: false },
    0.016,
    9800,
    3,
    DEFAULT_SETTINGS,
    seriesPads,
    [],
    1000
  );
  assert.strictEqual(res1.hitBoostPad, true, 'First pad must trigger hitBoostPad');
  assert.strictEqual(res1.boostComboCount, 1, 'First pad in series sets boostComboCount to 1');
  const speedAfterPad1 = player.speedKmh;

  // Hit Pad 2 within combo window
  player.t = 0.2;
  const res2 = stepRacerPhysics(
    player,
    { throttle: true, brake: false, steerLeft: false, steerRight: false, airbrakeLeft: false, airbrakeRight: false, boostHeld: false, useBonusPressed: false },
    0.016,
    9800,
    3,
    DEFAULT_SETTINGS,
    seriesPads,
    [],
    2000
  );
  assert.strictEqual(res2.hitBoostPad, true, 'Second pad must trigger hitBoostPad');
  assert.strictEqual(res2.boostComboCount, 2, 'Second pad in series increments boostComboCount to 2');
  const speedAfterPad2 = player.speedKmh;
  assert.ok(speedAfterPad2 > speedAfterPad1, `Combo x2 speed (${speedAfterPad2}) must exceed Combo x1 speed (${speedAfterPad1})`);

  // Hit Pad 3 within combo window
  player.t = 0.3;
  const res3 = stepRacerPhysics(
    player,
    { throttle: true, brake: false, steerLeft: false, steerRight: false, airbrakeLeft: false, airbrakeRight: false, boostHeld: false, useBonusPressed: false },
    0.016,
    9800,
    3,
    DEFAULT_SETTINGS,
    seriesPads,
    [],
    3000
  );
  assert.strictEqual(res3.hitBoostPad, true, 'Third pad must trigger hitBoostPad');
  assert.strictEqual(res3.boostComboCount, 3, 'Third pad in series increments boostComboCount to 3');
  assert.ok(player.speedKmh > speedAfterPad2, `Combo x3 speed (${player.speedKmh}) must exceed Combo x2 speed (${speedAfterPad2})`);
});

// 23. Boundary Detection, Environment Mesh Structure Collision & Smooth Lateral Drifting
test('resolveTrackBoundaryAndEnvironmentCollision prevents wall/environment clipping and supports smooth lateral drifting across track width', () => {
  const racers = createInitialRacers('valkyrie');
  const player = racers.find((r) => r.isPlayer)!;
  player.speedKmh = 480;

  // Verify environment structure zone detection at City skyscraper tunnel & Lava volcano tunnel
  assert.strictEqual(isWithinEnvironmentStructureZone('city', 0.72), true, 'City skyscraper tunnel t=0.72 is an environment structure zone');
  assert.strictEqual(isWithinEnvironmentStructureZone('lava', 0.16), true, 'Lava volcano tunnel t=0.16 is an environment structure zone');
  assert.strictEqual(isWithinEnvironmentStructureZone('city', 0.1), false, 'Open roadway t=0.10 is not an environment structure zone');

  // Test environment structure boundary collision deflection at t = 0.72 (City Skyscraper Core Tunnel)
  player.t = 0.72;
  player.lateralOffset = 14.2; // attempting to clip past the right tunnel wall
  player.lateralVelocity = 18.0;
  const envHit = resolveTrackBoundaryAndEnvironmentCollision(player, 'city', 0, 1.0, 1 / 60);
  assert.strictEqual(envHit.wallCollision, true, 'Exceeding boundary inside tunnel triggers wallCollision');
  assert.strictEqual(envHit.envStructureHit, true, 'Collision at t=0.72 flags envStructureHit');
  assert.ok(player.lateralOffset <= 12.13, `Player offset clamped inside roadway (<= 12.13m), got ${player.lateralOffset}`);
  assert.ok(player.lateralVelocity < 0, 'Unsteered wall impact rebounds lateralVelocity inward away from wall');

  // Test smooth lateral drift glide when steering across the roadway and releasing steering at speed
  player.t = 0.1;
  player.lateralOffset = 0;
  player.lateralVelocity = 0;
  player.speedKmh = 420;
  for (let i = 0; i < 12; i++) {
    stepRacerPhysics(
      player,
      {
        throttle: true,
        brake: false,
        steerLeft: false,
        steerRight: true,
        airbrakeLeft: false,
        airbrakeRight: true,
        boostHeld: false,
        useBonusPressed: false,
      },
      1 / 60,
      9800,
      3,
      DEFAULT_SETTINGS,
      [],
      [],
      4000 + i * 16.6
    );
  }
  const offsetAfterSteer = player.lateralOffset;
  assert.ok(offsetAfterSteer > 4.5 && offsetAfterSteer < 10.5, `Active steer + airbrake smoothly drifts ship across roadway (4.5m..10.5m), got ${offsetAfterSteer.toFixed(2)}m`);

  // Release steer for 10 frames at high speed: ship continues a smooth lateral drift glide in the chosen direction without snapping back to 0
  for (let i = 0; i < 10; i++) {
    stepRacerPhysics(
      player,
      {
        throttle: true,
        brake: false,
        steerLeft: false,
        steerRight: false,
        airbrakeLeft: false,
        airbrakeRight: false,
        boostHeld: false,
        useBonusPressed: false,
      },
      1 / 60,
      9800,
      3,
      DEFAULT_SETTINGS,
      [],
      [],
      4500 + i * 16.6
    );
  }
  assert.ok(
    player.lateralOffset > offsetAfterSteer,
    `High-speed drift glide continues smoothly outward (${player.lateralOffset.toFixed(2)}m > ${offsetAfterSteer.toFixed(2)}m) without snapping back to center`
  );
});

// 24. City Default Storm Mode, Evolving Storm Phases & Boost Chain Combo Multiplier
test('DEFAULT_SETTINGS uses storm weather by default on City circuit and evolves storm cloud density and phases', () => {
  assert.strictEqual(DEFAULT_SETTINGS.trackId, 'city', 'Default circuit is city');
  assert.strictEqual(DEFAULT_SETTINGS.weatherMode, 'storm', 'Default weatherMode is storm for the City circuit');

  const stormAtStart = computeWeatherState('city', 'storm', 0);
  assert.ok(stormAtStart.intensity > 0.8, 'Storm mode intensity is > 0.8');
  assert.ok((stormAtStart.cloudDensity ?? 0) >= 0.85, 'Storm mode cloudDensity is high (>= 0.85)');

  // Verify storm mode evolves through distant_lightning, monsoon_squall, and supercell_vortex during the race
  const stormPhases = new Set<string>();
  for (let t = 0; t <= 45; t += 1) {
    const w = computeWeatherState('city', 'storm', t);
    if (w.stormPhase) stormPhases.add(w.stormPhase);
  }
  assert.ok(stormPhases.has('distant_lightning'), 'Storm mode starts with distant_lightning phase');
  assert.ok(stormPhases.has('monsoon_squall'), 'Storm mode progresses into monsoon_squall phase');
  assert.ok(stormPhases.has('supercell_vortex'), 'Storm mode reaches supercell_vortex phase');

  // Verify dynamic weather mode also cycles through gathering clouds, distant lightning, monsoon squall, and supercell vortex
  const dynamicPhases = new Set<string>();
  for (let t = 0; t <= 120; t += 2) {
    const w = computeWeatherState('city', 'dynamic', t);
    if (w.stormPhase) dynamicPhases.add(w.stormPhase);
  }
  assert.ok(dynamicPhases.has('distant_lightning') && dynamicPhases.has('monsoon_squall'), 'Dynamic City weather progresses through lightning and squall phases');
});

