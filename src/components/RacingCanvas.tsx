import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  ActiveMine,
  ActiveMissile,
  ActiveWeaponId,
  DebugMode,
  DebugTeleportRequest,
  EnergyRing,
  GameSettings,
  GameState,
  HudTelemetry,
  RaceSummary,
  RacerState,
  TrackPad,
  VehicleUpgrades,
} from '../game/types';
import {
  BONUS_META,
  BONUS_RESPAWN_SECONDS,
  POWERUP_META,
  SHIP_SPECS,
  StepRacerResult,
  TRACK_SPECS,
  WEAPON_META,
  calculateStandings,
  computeAiInput,
  computeWeatherState,
  createEnergyRings,
  createInitialRacers,
  createTrackPads,
  findOpponentInFront,
  isCityTrack,
  resolveRacerCollisions,
  stepRacerPhysics,
  stepWeaponCombat,
} from '../game/rules';
import { createProceduralTextures, TrackTextureSet } from '../game/textures';
import {
  BuiltTrackWorld,
  ShipMeshRig,
  TRACK_SSAO_LAYER,
  buildTrackAndWorld,
  createShipMesh,
  createTrackSpline,
  sampleTrackFrame,
} from '../game/meshes';
import { audioEngine } from '../game/audio';

interface RacingCanvasProps {
  gameState: GameState;
  settings: GameSettings;
  upgrades: VehicleUpgrades;
  totalCredits: number;
  demoMode: boolean;
  debugMode: DebugMode;
  debugMenuOpen: boolean;
  cameraPaused: boolean;
  teleportRequest: DebugTeleportRequest | null;
  raceNonce: number;
  onTelemetryUpdate: (telemetry: HudTelemetry) => void;
  onEarnCredits: (amount: number) => void;
  onRaceFinish: (summary: RaceSummary) => void;
  onTogglePause: () => void;
  onToggleCameraPause: () => void;
  onOpenDebugMenu: () => void;
  onCycleCamera: () => void;
  onTakeControl?: () => void;
  actionTriggerRef: React.MutableRefObject<{
    boostPulse: boolean;
    useBonus: boolean;
    useWeapon: boolean;
    steerDir: number;
    throttleHeld?: boolean;
    brakeHeld?: boolean;
  }>;
}

// Pre-allocated module-level math objects (Zero GC in loop)
const _pos = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _shipPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredCamLook = new THREE.Vector3();
const _rotMatrix = new THREE.Matrix4();
const _shipQuat = new THREE.Quaternion();
const _sparkDummy = new THREE.Object3D();
const _thrusterDummy = new THREE.Object3D();
const _hazeDummy = new THREE.Object3D();
const _weatherDummy = new THREE.Object3D();
const _debrisDummy = new THREE.Object3D();
const _weatherColor = new THREE.Color();
const _thrusterColor = new THREE.Color();
const _debrisColor = new THREE.Color();
const _collisionOrigin = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _camFwdXZ = new THREE.Vector3();

const SPARK_POOL_SIZE = 110;
const THRUSTER_SPARK_POOL_SIZE = 200;
const HEAT_HAZE_POOL_SIZE = 100;
const WEATHER_POOL_SIZE = 760;
const DEBRIS_POOL_SIZE = 320;

interface SparkParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
}

interface ThrusterSparkParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  life: number;
  maxLife: number;
  scale: number;
  streakFactor: number;
}

interface HeatHazeParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  roll: number;
  rollSpeed: number;
}

interface WeatherDrop {
  rx: number; // relative offset around camera frustum center
  ry: number;
  rz: number;
  speedY: number;
  driftPhase: number;
  scale: number;
  isEmber: boolean;
  layer: 0 | 1 | 2;
}

interface TrackDebrisParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  roll: number;
  rollSpeed: number;
  turbulenceBoost: number;
}

export const RacingCanvas: React.FC<RacingCanvasProps> = ({
  gameState,
  settings,
  upgrades,
  totalCredits,
  demoMode,
  debugMode,
  debugMenuOpen,
  cameraPaused,
  teleportRequest,
  raceNonce,
  onTelemetryUpdate,
  onEarnCredits,
  onRaceFinish,
  onTogglePause,
  onToggleCameraPause,
  onOpenDebugMenu,
  onCycleCamera,
  onTakeControl,
  actionTriggerRef,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props in refs so WebGL lifecycle never tears down on UI updates
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  const settingsRef = useRef<GameSettings>(settings);
  settingsRef.current = settings;

  const upgradesRef = useRef<VehicleUpgrades>(upgrades);
  upgradesRef.current = upgrades;

  const totalCreditsRef = useRef<number>(totalCredits);
  totalCreditsRef.current = totalCredits;

  const demoModeRef = useRef<boolean>(demoMode);
  demoModeRef.current = demoMode;

  const debugModeRef = useRef<DebugMode>(debugMode);
  debugModeRef.current = debugMode;

  const debugMenuOpenRef = useRef<boolean>(debugMenuOpen);
  debugMenuOpenRef.current = debugMenuOpen;

  const cameraPausedRef = useRef<boolean>(cameraPaused);
  cameraPausedRef.current = cameraPaused;

  const callbacksRef = useRef({
    onTelemetryUpdate,
    onEarnCredits,
    onRaceFinish,
    onTogglePause,
    onToggleCameraPause,
    onOpenDebugMenu,
    onCycleCamera,
    onTakeControl,
  });
  callbacksRef.current = {
    onTelemetryUpdate,
    onEarnCredits,
    onRaceFinish,
    onTogglePause,
    onToggleCameraPause,
    onOpenDebugMenu,
    onCycleCamera,
    onTakeControl,
  };

  const rebuildSceneRef = useRef<(() => void) | null>(null);
  const swapPlayerShipRef = useRef<(() => void) | null>(null);
  const resetRaceStateRef = useRef<(() => void) | null>(null);
  const applyTeleportRef = useRef<((req: DebugTeleportRequest) => void) | null>(null);
  const syncDebugModeInitRef = useRef<((mode: DebugMode) => void) | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect Software WebGL from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.84;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    renderer.setSize(initW, initH);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Studio Environment Reflection (RoomEnvironment + PMREMGenerator, restrained intensity to prevent washout)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
    scene.environmentIntensity = 0.24;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      settingsRef.current.fov,
      initW / initH,
      1.0,
      3200
    );

    // Post-Processing Bloom Pipeline (EffectComposer + RenderPass + UnrealBloomPass + OutputPass)
    // High threshold (1.08) + tight radius (0.28) ensures ONLY true HDR lava/thruster cores bloom without washing out road or ship
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // Track-Specific Screen-Space Ambient Occlusion (SSAO) Pass:
    // Renders view-space normals + depth exclusively for TRACK_SSAO_LAYER geometry (road deck, curbs,
    // viaduct aprons, box-girder fascia, armored guardrails, coping caps, stanchions, pylons & portal collars)
    // to deepen shadows in crevices and gaps and sharpen the 3D separation between track and background!
    const ssaoScale = isSoftwareGl ? 0.5 : 0.75;
    const trackNormalDepthTarget = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(initW * ssaoScale)),
      Math.max(1, Math.floor(initH * ssaoScale)),
      {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        type: THREE.HalfFloatType,
      }
    );
    trackNormalDepthTarget.depthTexture = new THREE.DepthTexture(
      Math.max(1, Math.floor(initW * ssaoScale)),
      Math.max(1, Math.floor(initH * ssaoScale))
    );
    trackNormalDepthTarget.depthTexture.format = THREE.DepthFormat;
    trackNormalDepthTarget.depthTexture.type = THREE.UnsignedIntType;

    const trackNormalDepthMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vViewNormal;
        void main() {
          vec4 localPos = vec4(position, 1.0);
          vec3 objNormal = normal;
          #ifdef USE_INSTANCING
            localPos = instanceMatrix * localPos;
            objNormal = mat3(instanceMatrix) * objNormal;
          #endif
          vViewNormal = normalize(normalMatrix * objNormal);
          gl_Position = projectionMatrix * modelViewMatrix * localPos;
        }
      `,
      fragmentShader: `
        varying vec3 vViewNormal;
        void main() {
          vec3 n = normalize(vViewNormal);
          if (!gl_FrontFacing) n = -n;
          gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });

    const trackSsaoPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        tNormalMask: { value: trackNormalDepthTarget.texture },
        tTrackDepth: { value: trackNormalDepthTarget.depthTexture },
        uResolution: { value: new THREE.Vector2(initW, initH) },
        uCameraNear: { value: camera.near },
        uCameraFar: { value: camera.far },
        uIntensity: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        #include <packing>
        uniform sampler2D tDiffuse;
        uniform sampler2D tNormalMask;
        uniform sampler2D tTrackDepth;
        uniform vec2 uResolution;
        uniform float uCameraNear;
        uniform float uCameraFar;
        uniform float uIntensity;
        varying vec2 vUv;

        float getLinearDepth(vec2 coord) {
          float fragCoordZ = texture2D(tTrackDepth, coord).x;
          float viewZ = perspectiveDepthToViewZ(fragCoordZ, uCameraNear, uCameraFar);
          return viewZToOrthographicDepth(viewZ, uCameraNear, uCameraFar);
        }

        float interleavedGradientNoise(vec2 pixel) {
          return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
        }

        void main() {
          vec4 baseCol = texture2D(tDiffuse, vUv);
          vec4 normMask = texture2D(tNormalMask, vUv);

          // Apply SSAO strictly to track geometry pixels (and immediate outer silhouette gap)
          if (normMask.a < 0.1) {
            gl_FragColor = baseCol;
            return;
          }

          float centerDepth = getLinearDepth(vUv);
          float viewDist = centerDepth * (uCameraFar - uCameraNear) + uCameraNear;
          if (viewDist > 520.0) {
            gl_FragColor = baseCol;
            return;
          }

          vec3 centerNormal = normalize(normMask.xyz * 2.0 - 1.0);
          vec2 texel = 1.0 / max(uResolution, vec2(1.0));

          // Perspective-scaled sampling radius so crevice shadows stay crisp near and mid-range
          float radiusPx = clamp(24.0 / (1.0 + viewDist * 0.035), 2.5, 18.0);
          float rotAngle = interleavedGradientNoise(vUv * uResolution) * 6.2831853;

          float creviceOcc = 0.0;
          float silhouetteGap = 0.0;

          for (int i = 0; i < 16; i++) {
            float fi = float(i);
            float r = sqrt((fi + 0.5) / 16.0);
            float theta = fi * 2.3999632 + rotAngle;
            vec2 offsetUv = vUv + vec2(cos(theta), sin(theta)) * (r * radiusPx) * texel;

            vec4 sampleNM = texture2D(tNormalMask, offsetUv);
            if (sampleNM.a < 0.5) {
              // Neighbor pixel stepped off the track geometry into the background void:
              // deepens the outer viaduct/barrier silhouette gap separating track from background!
              silhouetteGap += (1.0 - r * 0.45);
              continue;
            }

            float sampleDepth = getLinearDepth(offsetUv);
            float sampleDist = sampleDepth * (uCameraFar - uCameraNear) + uCameraNear;
            float depthDelta = viewDist - sampleDist; // positive when sample is closer to camera

            vec3 sampleNormal = normalize(sampleNM.xyz * 2.0 - 1.0);
            float normalCrevice = clamp(1.0 - dot(centerNormal, sampleNormal), 0.0, 1.0);

            // Range check prevents distant overlapping bridge decks from casting false halos
            float rangeWeight = smoothstep(4.2, 0.45, abs(depthDelta));
            float depthOcc = smoothstep(0.02, 0.42, depthDelta) * rangeWeight;

            creviceOcc += (depthOcc * 0.85 + normalCrevice * rangeWeight * 0.78);
          }

          float occNorm = clamp(creviceOcc / 16.0, 0.0, 1.0);
          float gapNorm = clamp(silhouetteGap / 16.0, 0.0, 1.0);

          // Combine internal crevice occlusion (curbs, barrier corners, stanchion pockets, coping overhang)
          // with outer track-to-background boundary gap definition
          float totalOcc = clamp(occNorm * 1.45 + gapNorm * 0.58, 0.0, 0.72) * uIntensity;
          float distFade = 1.0 - smoothstep(280.0, 520.0, viewDist);
          float aoFactor = 1.0 - totalOcc * distFade;

          // Deepen shadows in track crevices with a subtle cool abyssal tint in occluded pockets
          vec3 occludedCol = baseCol.rgb * aoFactor;
          gl_FragColor = vec4(occludedCol, baseCol.a);
        }
      `,
    });
    trackSsaoPass.enabled = settingsRef.current.enableTrackSsao;
    composer.addPass(trackSsaoPass);

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(initW, initH),
      0.22, // strength (dynamically scaled by neonIntensity in buildSceneContent)
      0.28, // radius
      1.08  // threshold > 1.0 so standard lit surfaces never bloom
    );
    composer.addPass(bloom);

    // Subtle Screen-Space Convective Heat Haze Pass for lava_v2 (pure UV refraction, zero brightness flicker)
    const heatHazeScreenPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uStrength: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uStrength;
        varying vec2 vUv;

        void main() {
          // Weight thermal shimmer toward the lower horizon & periphery while keeping the central HUD reticle crisp
          float distFromCenter = length(vUv - vec2(0.5, 0.52));
          float verticalWeight = smoothstep(0.92, 0.08, vUv.y);
          float edgeMask = smoothstep(0.12, 0.58, distFromCenter) * 0.65 + verticalWeight * 0.55;

          // Smooth multi-frequency rising convective thermal waves
          float waveX =
            sin(vUv.y * 28.0 - uTime * 3.2 + cos(vUv.x * 14.0 + uTime * 1.8) * 1.4) * 0.6 +
            sin(vUv.y * 52.0 - uTime * 5.4 + vUv.x * 22.0) * 0.4;
          float waveY =
            cos(vUv.x * 24.0 + uTime * 2.6 + sin(vUv.y * 18.0 - uTime * 2.9) * 1.2) * 0.6 +
            cos(vUv.x * 46.0 - uTime * 4.8 - vUv.y * 19.0) * 0.4;

          vec2 offset = vec2(waveX, waveY) * 0.00115 * edgeMask * uStrength;
          vec2 sampleUv = clamp(vUv + offset, vec2(0.001), vec2(0.999));
          gl_FragColor = texture2D(tDiffuse, sampleUv);
        }
      `,
    });
    heatHazeScreenPass.enabled =
      settingsRef.current.enableHeatHaze && !isCityTrack(settingsRef.current.trackId);
    composer.addPass(heatHazeScreenPass);

    // High-Speed Edge "Motion Lines" Post-Processing Pass (activates above 80% max speed threshold)
    const motionLinesPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uBoost: { value: 0 },
        uAspect: { value: initW / initH },
        uColorA: { value: new THREE.Color(0x00f2fe) },
        uColorB: { value: new THREE.Color(0xff7a18) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uBoost;
        uniform float uAspect;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec2 vUv;

        float hash11(float p) {
          p = fract(p * 0.1031);
          p *= p + 33.33;
          p *= p + p;
          return fract(p);
        }

        void main() {
          vec4 baseTex = texture2D(tDiffuse, vUv);
          if (uIntensity <= 0.002) {
            gl_FragColor = baseTex;
            return;
          }

          // Radial vector from perspective vanishing point (kept clear in the central viewport)
          vec2 center = vec2(0.5, 0.51);
          vec2 rel = vUv - center;
          vec2 aspectRel = vec2(rel.x * uAspect, rel.y);
          float r = length(aspectRel);
          float angle = atan(aspectRel.y, aspectRel.x);

          // Strict peripheral screen-edge envelope: 0 in center, ramping smoothly toward screen borders
          float edgeMask = smoothstep(0.36, 0.78, r);
          float outerCornerBoost = smoothstep(0.54, 0.90, r);

          // Subtle directional radial micro-blur at extreme periphery to heighten velocity perception
          vec2 radialOffset = rel * (0.0085 * edgeMask * uIntensity);
          vec3 blurredEdge = (
            baseTex.rgb * 0.5 +
            texture2D(tDiffuse, clamp(vUv - radialOffset * 0.65, vec2(0.001), vec2(0.999))).rgb * 0.3 +
            texture2D(tDiffuse, clamp(vUv - radialOffset * 1.30, vec2(0.001), vec2(0.999))).rgb * 0.2
          );
          vec3 col = mix(baseTex.rgb, blurredEdge, clamp(edgeMask * uIntensity * 0.65, 0.0, 0.75));

          // Layer 1: Razor-sharp high-frequency radial speed needles shooting outward along screen edges
          float numSlices1 = 160.0;
          float sector1 = (angle + 3.14159265) / 6.2831853 * numSlices1;
          float id1 = floor(sector1);
          float cellUv1 = abs(fract(sector1) - 0.5) * 2.0;
          float h1 = hash11(id1 * 17.3 + 5.7);
          float speed1 = 13.0 + h1 * 15.0;
          float travel1 = fract(r * (2.1 + h1 * 1.6) - uTime * speed1 * 0.22 + h1 * 11.0);
          float needleProfile1 = smoothstep(0.56, 0.91, travel1) * (1.0 - smoothstep(0.91, 0.99, travel1));
          float width1 = smoothstep(0.74, 0.0, cellUv1);
          float streak1 = needleProfile1 * width1 * step(0.30, h1);

          // Layer 2: Bold energetic overdrive motion streaks near outer corners
          float numSlices2 = 84.0;
          float sector2 = (angle + 3.14159265) / 6.2831853 * numSlices2;
          float id2 = floor(sector2);
          float cellUv2 = abs(fract(sector2) - 0.5) * 2.0;
          float h2 = hash11(id2 * 31.9 + 19.1);
          float speed2 = 18.0 + h2 * 16.0;
          float travel2 = fract(r * (1.45 + h2 * 1.1) - uTime * speed2 * 0.25 + h2 * 7.3);
          float needleProfile2 = smoothstep(0.62, 0.94, travel2) * (1.0 - smoothstep(0.94, 1.0, travel2));
          float width2 = smoothstep(0.62, 0.0, cellUv2);
          float streak2 = needleProfile2 * width2 * step(0.42, h2);

          float combinedStreaks = (streak1 * 0.78 + streak2 * (0.95 + uBoost * 0.40)) * edgeMask * (0.75 + 0.55 * outerCornerBoost);
          vec3 lineTint = mix(uColorA, uColorB, clamp(h2 * 0.45 + uBoost * 0.45, 0.0, 1.0));
          vec3 hotNeedleColor = mix(lineTint, vec3(0.94, 0.98, 1.0), 0.52);

          col += hotNeedleColor * combinedStreaks * clamp(uIntensity, 0.0, 1.35) * 0.72;
          gl_FragColor = vec4(col, baseTex.a);
        }
      `,
    });
    motionLinesPass.enabled = settingsRef.current.enableMotionLines;
    composer.addPass(motionLinesPass);

    // Screen-Space Cyber Monsoon Rain & Purple Storm Lightning Atmosphere Pass (City Circuit)
    const stormRainPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uRainIntensity: { value: 0 },
        uLightningFlash: { value: 0 },
        uDistantFlash: { value: 0 },
        uAspect: { value: initW / initH },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uRainIntensity;
        uniform float uLightningFlash;
        uniform float uDistantFlash;
        uniform float uAspect;
        varying vec2 vUv;

        float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        float rainStreakLayer(vec2 uv, float scaleX, float scaleY, float speed, float slant, float seed) {
          vec2 p = vec2(uv.x * uAspect + uv.y * slant, uv.y);
          vec2 grid = p * vec2(scaleX, scaleY);
          float colId = floor(grid.x);
          float h = hash12(vec2(colId, seed));
          float dropSpeed = speed * (0.78 + h * 0.45);
          float yScroll = grid.y + uTime * dropSpeed + h * 19.7;
          float rowId = floor(yScroll);
          float cellH = hash12(vec2(colId * 13.1 + seed, rowId * 7.3));
          float xFract = abs(fract(grid.x) - 0.5) * 2.0;
          float yFract = fract(yScroll);
          float needle = smoothstep(0.15, 0.88, yFract) * (1.0 - smoothstep(0.88, 0.99, yFract));
          float width = smoothstep(0.62, 0.0, xFract);
          return needle * width * step(0.54, cellH);
        }

        void main() {
          vec4 baseTex = texture2D(tDiffuse, vUv);
          if (uRainIntensity <= 0.01 && uLightningFlash <= 0.005 && uDistantFlash <= 0.005) {
            gl_FragColor = baseTex;
            return;
          }

          // Subtle peripheral wet-lens micro-refraction from slanted storm rain
          float centerDist = length((vUv - vec2(0.5, 0.48)) * vec2(uAspect * 0.7, 1.0));
          float periphMask = smoothstep(0.18, 0.85, centerDist);

          float slant = 0.17 + sin(uTime * 0.65) * 0.04;
          float layerFar = rainStreakLayer(vUv, 96.0, 4.2, 7.8, slant, 1.7);
          float layerMid = rainStreakLayer(vUv, 58.0, 2.8, 10.5, slant * 1.12, 5.3) * (0.45 + 0.55 * periphMask);
          float layerNear = rainStreakLayer(vUv, 32.0, 1.7, 14.2, slant * 1.25, 11.9) * periphMask;

          float combinedRain = (layerFar * 0.36 + layerMid * 0.55 + layerNear * 0.75) * uRainIntensity;

          // Subtle wet-lens UV shimmer along rain streaks
          vec2 refractUv = clamp(vUv + vec2(slant, -1.0) * combinedRain * 0.0018, vec2(0.001), vec2(0.999));
          vec3 col = mix(baseTex.rgb, texture2D(tDiffuse, refractUv).rgb, 0.55);

          // Rain streak color: cool ice-cyan mixed with electric purple-violet storm reflections
          vec3 rainTint = mix(
            vec3(0.58, 0.88, 1.0),
            vec3(0.90, 0.55, 1.0),
            clamp(vUv.y * 0.65 + uLightningFlash * 0.65 + uDistantFlash * 0.35, 0.0, 1.0)
          );
          col += rainTint * combinedRain * (0.20 + uLightningFlash * 0.25);

          // Upper sky & wet roadway purple-violet atmospheric flash during thunder/lightning
          float skyWeight = smoothstep(0.28, 0.96, vUv.y);
          float roadReflectWeight = smoothstep(0.45, 0.02, vUv.y) * 0.42;
          vec3 purpleStormGlow = vec3(0.76, 0.26, 0.98);
          vec3 whiteVioletCore = vec3(0.95, 0.82, 1.0);

          col += purpleStormGlow * uDistantFlash * (skyWeight * 0.22 + roadReflectWeight * 0.12);
          col += mix(purpleStormGlow, whiteVioletCore, 0.45) * uLightningFlash * (skyWeight * 0.42 + roadReflectWeight * 0.28);

          gl_FragColor = vec4(col, baseTex.a);
        }
      `,
    });
    stormRainPass.enabled = isCityTrack(settingsRef.current.trackId);
    composer.addPass(stormRainPass);

    composer.addPass(new OutputPass());

    // 3-Point Studio & Atmospheric Lighting Rig + Dynamic Purple Lightning PointLight
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e1b4b, 0.68);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 0.96);
    keyLight.position.set(120, 180, -80);
    keyLight.castShadow = false;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00f2fe, 0.48);
    rimLight.position.set(-100, 60, 140);
    scene.add(rimLight);

    const stormLightningLight = new THREE.PointLight(0xd946ef, 0.0, 950, 1.15);
    stormLightningLight.position.set(0, 140, -220);
    scene.add(stormLightningLight);

    // 3D City Storm Sky Vortex, Volumetric Storm Cloud Canopy & Jagged Purple Lightning Bolt Rig
    const stormSkyGroup = new THREE.Group();
    scene.add(stormSkyGroup);

    // 1. Overhead Churning Storm Cloud Canopy Dome (1600m x 1600m above the city skyline)
    const stormCanopyGeo = new THREE.PlaneGeometry(1650, 1650, 1, 1);
    stormCanopyGeo.rotateX(Math.PI / 2);
    const stormCanopyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCloudDensity: { value: 0.94 },
        uSheetFlash: { value: 0.0 },
        uBoltFlash: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uCloudDensity;
        uniform float uSheetFlash;
        uniform float uBoltFlash;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p = rot * p * 2.04 + vec2(uTime * 0.04, -uTime * 0.03);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;

          float radialFade = 1.0 - smoothstep(0.45, 0.98, r);
          float angle = atan(p.y, p.x);
          vec2 swirlUv = p * 3.8 + vec2(cos(angle + uTime * 0.12), sin(angle + uTime * 0.12)) * 0.45;
          float n1 = fbm(swirlUv);
          float n2 = fbm(swirlUv * 2.1 - vec2(uTime * 0.11, uTime * 0.08));
          float cloud = smoothstep(0.22, 0.85, n1 * 0.65 + n2 * 0.35);

          vec3 darkCloud = vec3(0.04, 0.015, 0.09);
          vec3 bruiseViolet = vec3(0.24, 0.06, 0.44);
          vec3 neonPurple = vec3(0.68, 0.18, 0.95);
          vec3 hotCore = vec3(0.96, 0.82, 1.0);

          float sheetPocket = smoothstep(0.58, 0.88, n2) * (uSheetFlash * 0.85 + uBoltFlash * 1.15);
          vec3 col = mix(darkCloud, bruiseViolet, cloud);
          col = mix(col, neonPurple, clamp(cloud * 0.48 + sheetPocket * 0.65, 0.0, 1.0));
          col += hotCore * sheetPocket * 0.55;

          float alpha = radialFade * (0.45 + 0.48 * cloud) * uCloudDensity;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const stormCanopyMesh = new THREE.Mesh(stormCanopyGeo, stormCanopyMat);
    stormSkyGroup.add(stormCanopyMesh);

    // 2. Swirling Purple Storm Vortex & Tearing Vertical Purple Lightning Bolt Sky Backdrop
    // Matches the dramatic swirling purple sky vortex + central jagged lightning bolt in the reference image
    const stormVortexGeo = new THREE.PlaneGeometry(520, 340, 1, 1);
    const stormVortexMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uStormIntensity: { value: 0.92 },
        uSheetFlash: { value: 0.0 },
        uBoltFlash: { value: 0.0 },
        uBoltSeed: { value: 1.37 },
        uBoltXOffset: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uStormIntensity;
        uniform float uSheetFlash;
        uniform float uBoltFlash;
        uniform float uBoltSeed;
        uniform float uBoltXOffset;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p = rot * p * 2.05;
            a *= 0.5;
          }
          return v;
        }

        float boltNoise(float y, float seed) {
          float i = floor(y);
          float f = fract(y);
          float a = fract(sin(i * 127.1 + seed * 311.7) * 43758.5453) * 2.0 - 1.0;
          float b = fract(sin((i + 1.0) * 127.1 + seed * 311.7) * 43758.5453) * 2.0 - 1.0;
          return mix(a, b, f * f * (3.0 - 2.0 * f));
        }

        float jaggedDisplacement(float y, float seed) {
          return boltNoise(y * 7.0, seed) * 0.042 +
                 boltNoise(y * 19.0, seed + 4.1) * 0.019 +
                 boltNoise(y * 43.0, seed + 9.7) * 0.008;
        }

        void main() {
          // Soft oval vignette so the sky vortex blends seamlessly into the night sky and city horizon
          vec2 eyeCenter = vec2(0.5 + uBoltXOffset * 0.35, 0.74);
          vec2 rel = (vUv - eyeCenter) * vec2(1.35, 1.0);
          float distFromEye = length(rel);
          float edgeMask = (1.0 - smoothstep(0.32, 0.72, length((vUv - vec2(0.5, 0.55)) * vec2(1.05, 1.15)))) *
                           smoothstep(0.01, 0.16, vUv.y);
          if (edgeMask <= 0.002) discard;

          // Swirling concentric supercell vortex clouds around eyeCenter
          float angle = atan(rel.y, rel.x);
          float swirlAngle = angle + 2.8 / (distFromEye + 0.16) - uTime * 0.55;
          vec2 vortexUv = vec2(cos(swirlAngle), sin(swirlAngle)) * (distFromEye * 3.6) + distFromEye * 4.5;
          float cloudFbm = fbm(vortexUv + vec2(uTime * 0.12, -uTime * 0.09));
          float spiralRing = 0.5 + 0.5 * sin(distFromEye * 22.0 - angle * 2.0 - uTime * 1.8 + cloudFbm * 3.5);
          float vortexStructure = smoothstep(0.18, 0.88, cloudFbm * 0.68 + spiralRing * 0.32);

          // Vortex Eye glow at the top-center of the storm
          float eyeCore = exp(-distFromEye * 9.5) * (0.65 + 0.35 * sin(uTime * 3.2) + uSheetFlash * 0.9 + uBoltFlash * 1.8);
          float innerWallGlow = exp(-abs(distFromEye - 0.11) * 14.0) * vortexStructure * (0.6 + uSheetFlash * 0.8 + uBoltFlash * 1.2);

          vec3 deepAbyssPurple = vec3(0.08, 0.02, 0.16);
          vec3 stormViolet = vec3(0.36, 0.08, 0.62);
          vec3 electricMagenta = vec3(0.78, 0.22, 0.98);
          vec3 blindingWhiteViolet = vec3(0.98, 0.90, 1.0);

          vec3 skyCol = mix(deepAbyssPurple, stormViolet, vortexStructure);
          skyCol = mix(skyCol, electricMagenta, clamp(innerWallGlow * 0.85 + vortexStructure * 0.32 * (0.5 + uSheetFlash), 0.0, 1.0));
          skyCol += blindingWhiteViolet * eyeCore * 0.95;

          // Distant cloud-to-cloud sheet lightning pockets
          float distantPocket = smoothstep(0.62, 0.89, cloudFbm) * exp(-distFromEye * 2.4) * uSheetFlash;
          skyCol += mix(electricMagenta, blindingWhiteViolet, 0.5) * distantPocket * 1.15;

          float boltAlpha = 0.0;
          if (uBoltFlash > 0.01 && vUv.y <= eyeCenter.y + 0.04) {
            // Main Vertical Jagged Purple Lightning Trunk tearing down from the Vortex Eye
            float normY = clamp((eyeCenter.y - vUv.y) / eyeCenter.y, 0.0, 1.0);
            float trunkX = eyeCenter.x + jaggedDisplacement(vUv.y, uBoltSeed) * smoothstep(0.0, 0.12, normY);
            float dxTrunk = abs(vUv.x - trunkX);
            float vertMask = smoothstep(0.01, 0.08, vUv.y) * smoothstep(eyeCenter.y + 0.03, eyeCenter.y - 0.02, vUv.y);

            float trunkCore = smoothstep(0.0075, 0.0012, dxTrunk) * vertMask;
            float trunkInnerGlow = exp(-dxTrunk * 52.0) * vertMask;
            float trunkOuterCorona = exp(-dxTrunk * 14.0) * vertMask;

            // Forked Secondary Lightning Branches
            float branchesCore = 0.0;
            float branchesGlow = 0.0;
            for (int b = 0; b < 5; b++) {
              float fb = float(b);
              float branchStartNorm = 0.16 + fb * 0.15;
              float branchYStart = eyeCenter.y * (1.0 - branchStartNorm);
              if (vUv.y < branchYStart) {
                float bProg = (branchYStart - vUv.y) / max(0.08, branchYStart);
                float side = mod(fb, 2.0) < 0.5 ? -1.0 : 1.0;
                float bOriginX = eyeCenter.x + jaggedDisplacement(branchYStart, uBoltSeed);
                float bTargetX = bOriginX + side * bProg * (0.11 + 0.03 * fb) + jaggedDisplacement(vUv.y * 1.4, uBoltSeed + fb * 7.3) * 0.75;
                float dxB = abs(vUv.x - bTargetX);
                float bFade = (1.0 - smoothstep(0.35, 0.92, bProg)) * vertMask;
                branchesCore += smoothstep(0.0045, 0.0008, dxB) * bFade;
                branchesGlow += exp(-dxB * 68.0) * bFade * 0.85;
              }
            }

            vec3 boltCol =
              electricMagenta * (trunkOuterCorona * 1.25 + branchesGlow * 0.95) +
              vec3(0.92, 0.55, 1.0) * (trunkInnerGlow * 1.45 + branchesGlow * 0.8) +
              blindingWhiteViolet * clamp(trunkCore * 2.1 + branchesCore * 1.5, 0.0, 2.2);

            skyCol += boltCol * uBoltFlash;
            boltAlpha = clamp((trunkOuterCorona * 0.85 + trunkInnerGlow + branchesGlow) * uBoltFlash, 0.0, 1.0);
          }

          float totalAlpha = clamp(edgeMask * (0.48 + vortexStructure * 0.38 + eyeCore * 0.45) * uStormIntensity + boltAlpha * edgeMask, 0.0, 0.96);
          gl_FragColor = vec4(skyCol, totalAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const stormVortexMesh = new THREE.Mesh(stormVortexGeo, stormVortexMat);
    stormSkyGroup.add(stormVortexMesh);

    // Pooled Collision Spark Particle InstancedMesh (Orange-Gold Wall/Craft Impact Sparks)
    const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.38);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const sparkInstanced = new THREE.InstancedMesh(sparkGeo, sparkMat, SPARK_POOL_SIZE);
    sparkInstanced.frustumCulled = false;
    scene.add(sparkInstanced);

    const sparks: SparkParticle[] = Array.from({ length: SPARK_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: -999,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0.3,
      scale: 1,
    }));
    let sparkCursor = 0;

    // Dedicated Boost Thruster Neon-Cyan Spark Emitter Pool (Speed & Boost Reactive)
    const thrusterSparkGeo = new THREE.BoxGeometry(0.026, 0.026, 0.16);
    const thrusterSparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const thrusterSparkInstanced = new THREE.InstancedMesh(
      thrusterSparkGeo,
      thrusterSparkMat,
      THRUSTER_SPARK_POOL_SIZE
    );
    thrusterSparkInstanced.frustumCulled = false;
    const cyanPalette = [0x00d8ff, 0x06b6d4, 0x38bdf8, 0x0ea5e9];
    for (let i = 0; i < THRUSTER_SPARK_POOL_SIZE; i++) {
      _thrusterColor.setHex(cyanPalette[i % cyanPalette.length]);
      thrusterSparkInstanced.setColorAt(i, _thrusterColor);
    }
    if (thrusterSparkInstanced.instanceColor) {
      thrusterSparkInstanced.instanceColor.needsUpdate = true;
    }
    scene.add(thrusterSparkInstanced);

    const thrusterSparks: ThrusterSparkParticle[] = Array.from(
      { length: THRUSTER_SPARK_POOL_SIZE },
      () => ({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        dirX: 0,
        dirY: 0,
        dirZ: -1,
        life: 0,
        maxLife: 0.14,
        scale: 1,
        streakFactor: 1,
      })
    );
    let thrusterSparkCursor = 0;

    // Dedicated Boost Thruster Thermal Heat-Haze Shimmer Particle Emitter (Custom GLSL Distortion & Convection Rings)
    const heatHazeGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const heatHazeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeedIntensity: { value: 0.25 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 localP = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            localP = instanceMatrix * localP;
          #endif
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * localP;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uSpeedIntensity;
        varying vec2 vUv;

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;

          float angle = atan(p.y, p.x);
          // Swirling convective thermal distortion rings
          float wave1 = sin(r * 14.0 - uTime * 16.0 + sin(angle * 4.0 + uTime * 6.0) * 1.1);
          float wave2 = cos(r * 9.0 - uTime * 12.0 - angle * 3.0);
          float ripple = smoothstep(0.20, 0.90, wave1 * 0.55 + wave2 * 0.45);

          // Soft annular shimmer profile around the exhaust jet without white washout
          float ringMask = smoothstep(0.18, 0.48, r) * (1.0 - smoothstep(0.60, 1.0, r));
          vec3 cyanHaze = vec3(0.0, 0.68, 0.88);
          vec3 deepBlueHaze = vec3(0.08, 0.32, 0.68);
          vec3 col = mix(deepBlueHaze, cyanHaze, ripple * 0.65 + 0.25);

          float alpha = ringMask * (0.22 + 0.55 * ripple) * (0.04 + 0.08 * uSpeedIntensity);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const heatHazeInstanced = new THREE.InstancedMesh(
      heatHazeGeo,
      heatHazeMat,
      HEAT_HAZE_POOL_SIZE
    );
    heatHazeInstanced.frustumCulled = false;
    heatHazeInstanced.visible = false;
    scene.add(heatHazeInstanced);

    const heatHazeParticles: HeatHazeParticle[] = Array.from(
      { length: HEAT_HAZE_POOL_SIZE },
      () => ({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.14,
        startScale: 0.22,
        endScale: 0.52,
        roll: 0,
        rollSpeed: 0,
      })
    );
    let heatHazeCursor = 0;

    // Pooled 3D Dynamic Weather InstancedMesh (City Neon Rain Streaks / Volcanic Ash & Ember Storm)
    const weatherGeo = new THREE.BoxGeometry(1, 1, 1);
    const weatherMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const weatherInstanced = new THREE.InstancedMesh(weatherGeo, weatherMat, WEATHER_POOL_SIZE);
    weatherInstanced.frustumCulled = false;
    scene.add(weatherInstanced);

    const weatherDrops: WeatherDrop[] = Array.from({ length: WEATHER_POOL_SIZE }, (_, idx) => ({
      rx: ((idx * 29.3) % 96) - 48,
      ry: ((idx * 17.1) % 40) - 20,
      rz: ((idx * 41.7) % 96) - 48,
      speedY: 0.88 + (idx % 9) * 0.15,
      driftPhase: idx * 0.43,
      scale: 0.78 + (idx % 6) * 0.16,
      isEmber: idx % 2 === 0,
      layer: (idx % 3) as 0 | 1 | 2,
    }));

    const syncWeatherPalette = () => {
      const isCity = isCityTrack(settingsRef.current.trackId);
      const cityStormPalette = [0xa5f3fc, 0x38bdf8, 0xe0f2fe, 0xc084fc, 0xe879f9];
      const lavaPalette = [0xfef08a, 0xff9500, 0xff5500, 0xf97316];
      for (let i = 0; i < WEATHER_POOL_SIZE; i++) {
        if (isCity) {
          // Storm-lit Neon Rain Streaks (ice-cyan, sky-blue & electric purple-violet storm highlights)
          _weatherColor.setHex(cityStormPalette[i % cityStormPalette.length]);
        } else {
          // Fine Glowing Magma Embers & Volcanic Sparks
          _weatherColor.setHex(lavaPalette[i % lavaPalette.length]);
        }
        weatherInstanced.setColorAt(i, _weatherColor);
      }
      if (weatherInstanced.instanceColor) {
        weatherInstanced.instanceColor.needsUpdate = true;
      }
    };

    // Proximity-Reactive Track Debris Particle System:
    // - Volcanic Tracks (lava / lava_v2): Billowing volcanic dust/ash clouds & incandescent magma cinders
    // - Metropolitan Tracks (city / city_v1): Atomized neon rain splash crowns & hydroplane spray mist
    const debrisGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const debrisMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIsCity: { value: isCityTrack(settingsRef.current.trackId) ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vInstanceColor;
        void main() {
          vUv = uv;
          #ifdef USE_INSTANCING_COLOR
            vInstanceColor = instanceColor;
          #else
            vInstanceColor = vec3(1.0);
          #endif
          vec4 localP = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            localP = instanceMatrix * localP;
          #endif
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * localP;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIsCity;
        varying vec2 vUv;
        varying vec3 vInstanceColor;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;

          float angle = atan(p.y, p.x);

          if (uIsCity > 0.5) {
            // Metropolitan Track: Atomized Rain Splash Crown & Hydroplane Mist Spray
            float droplets = noise(p * 6.5 + vec2(uTime * 3.2, -uTime * 4.5));
            float splashCrown = smoothstep(0.18, 0.62, r) * (1.0 - smoothstep(0.62, 1.0, r));
            float radialSpokes = 0.55 + 0.45 * sin(angle * 10.0 + droplets * 4.2);
            float mistCore = (1.0 - smoothstep(0.0, 0.88, r)) * droplets;
            float alpha = (splashCrown * radialSpokes * 0.72 + mistCore * 0.48) * (1.0 - r * r);
            vec3 col = vInstanceColor * (0.85 + 0.40 * droplets);
            gl_FragColor = vec4(col, alpha * 0.54);
          } else {
            // Volcanic Track: Billowing Ash/Dust Cloud Laced with Glowing Magma Cinders
            float n1 = noise(p * 2.8 + vec2(uTime * 0.9, -uTime * 0.7));
            float n2 = noise(p * 5.6 - vec2(uTime * 1.4, uTime * 1.1));
            float cloudLobe = n1 * 0.65 + n2 * 0.35;
            float softEdge = smoothstep(1.0, 0.22, r + (cloudLobe - 0.5) * 0.34);

            // Incandescent micro-cinders suspended inside the turbulent volcanic dust puff
            float cinderSpark = smoothstep(0.76, 0.92, n2) * (1.0 - smoothstep(0.0, 0.72, r));
            vec3 ashCol = vInstanceColor * (0.62 + 0.52 * cloudLobe);
            vec3 emberGlow = vec3(1.18, 0.46, 0.08) * cinderSpark * 1.35;

            float alpha = softEdge * (0.34 + 0.32 * cloudLobe);
            gl_FragColor = vec4(ashCol + emberGlow, alpha * 0.62);
          }
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const debrisInstanced = new THREE.InstancedMesh(debrisGeo, debrisMat, DEBRIS_POOL_SIZE);
    debrisInstanced.frustumCulled = false;
    scene.add(debrisInstanced);

    const debrisParticles: TrackDebrisParticle[] = Array.from(
      { length: DEBRIS_POOL_SIZE },
      () => ({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.75,
        startScale: 0.65,
        endScale: 2.35,
        roll: 0,
        rollSpeed: 0,
        turbulenceBoost: 0,
      })
    );
    let debrisCursor = 0;

    const syncDebrisPalette = () => {
      const isCity = isCityTrack(settingsRef.current.trackId);
      debrisMat.uniforms.uIsCity.value = isCity ? 1.0 : 0.0;
      const cityPalette = [0x7dd3fc, 0x38bdf8, 0xa5f3fc, 0xc084fc];
      const lavaPalette = [0x78716c, 0x9a3412, 0x57534e, 0xd97706, 0x44403c, 0xea580c];
      for (let i = 0; i < DEBRIS_POOL_SIZE; i++) {
        const hex = isCity
          ? cityPalette[i % cityPalette.length]
          : lavaPalette[i % lavaPalette.length];
        _debrisColor.setHex(hex);
        debrisInstanced.setColorAt(i, _debrisColor);
      }
      if (debrisInstanced.instanceColor) {
        debrisInstanced.instanceColor.needsUpdate = true;
      }
    };
    syncDebrisPalette();

    // Mutable Simulation State
    let currentTextures: TrackTextureSet | null = null;
    let currentWorld: BuiltTrackWorld | null = null;
    let spline = createTrackSpline(settingsRef.current.trackId);
    let pads: TrackPad[] = [];
    let rings: EnergyRing[] = [];
    let racers: RacerState[] = [];
    let shipRigs: ShipMeshRig[] = [];

    // Pre-race Choreographed Storm Cutscene Timeline Constants:
    // On the City circuit:
    //   8.4s -> 4.8s: Lengthened Panoramic Storm Sweep with distant cloud lightning & thunder
    //   4.8s -> 4.05s: Smooth swoop into stabilized player game view
    //   4.05s -> 3.0s: Camera stabilized in game view -> Thunder rumbles -> Purple lightning bolt tears through the sky!
    //   3.0s -> 0.0s: 3 - 2 - 1 - GO! Countdown
    // (Pressing Shift/Space or holding any steering/throttle key for > 0.2s skips immediately to racing!)
    const CITY_INTRO_TOTAL_SEC = 8.4;
    const CITY_LOCK_START_SEC = 4.8;
    const CITY_STABILIZED_SEC = 4.05;
    const CITY_COUNTDOWN_START_SEC = 3.0;

    let INTRO_TOTAL_SEC = isCityTrack(settingsRef.current.trackId) ? CITY_INTRO_TOTAL_SEC : 0.0;
    let LOCK_START_SEC = isCityTrack(settingsRef.current.trackId) ? CITY_LOCK_START_SEC : 0.0;
    let STABILIZED_VIEW_SEC = isCityTrack(settingsRef.current.trackId) ? CITY_STABILIZED_SEC : 0.0;
    let COUNTDOWN_START_SEC = isCityTrack(settingsRef.current.trackId) ? CITY_COUNTDOWN_START_SEC : 0.0;

    let raceElapsedMs = 0;
    let countdownTimer = INTRO_TOTAL_SEC;
    let introAnnounced = false;
    let preCountdownLockPlayed = false;
    let introDistantThunderPlayed = false;
    let preCountdownThunderPlayed = false;
    let preCountdownLightningPlayed = false;
    let manualDriveSkipTimer = 0;
    let lastCountdownInt = 4;
    let countdownFovKick = 0;
    let statusBanner = 'CIRCUIT OVERVIEW';
    let statusBannerTimer = 0;
    let cameraShakeTrauma = 0;
    let boostShakeIntensity = 0;
    let wasPlayerBoosting = false;
    let wallScrapeSparkCooldown = 0;
    let hitstopTimer = 0;
    let topSpeedRecorded = 0;
    let ringsPassedCount = 0;
    let boostPadsHitCount = 0;
    let powerUpsCollectedCount = 0;
    let baseFogDensity = 0.00115;
    const disabledPadIds = new Set<number>();

    // Dynamic Storm Clouds, Distant Sheet Lightning & Visible Purple Lightning Bolt State
    let distantSheetFlash = 0;
    let lightningBoltFlash = 0;
    let lightningBoltSeed = 1.37;
    let lightningBoltXOffset = 0.0;
    let nextStormEventTimer = 4.5;
    let pendingThunderDelay = -1;
    let nextStormIsFullBolt = false;

    const triggerPurpleLightningBolt = (intensity = 1.15, xOffset = 0.0) => {
      lightningBoltFlash = intensity;
      distantSheetFlash = Math.max(distantSheetFlash, intensity * 0.85);
      lightningBoltSeed = 1.1 + Math.random() * 19.7;
      lightningBoltXOffset = xOffset;
      audioEngine.playLightningStrike(intensity);
    };

    // Active Ordnance & Vehicle Destruction State
    let activeMissiles: ActiveMissile[] = [];
    let activeMines: ActiveMine[] = [];
    let playerExplosionTimer = 0;
    let playerExplosionHandled = false;
    const explodedRacerIds = new Set<string>();

    // 3D Pool for Homing Missiles in flight
    const MISSILE_POOL_SIZE = 10;
    const missileMeshes: THREE.Group[] = [];
    {
      const bodyGeo = new THREE.CylinderGeometry(0.18, 0.24, 1.85, 12);
      bodyGeo.rotateX(Math.PI / 2);
      const noseGeo = new THREE.ConeGeometry(0.18, 0.65, 12);
      noseGeo.rotateX(Math.PI / 2);
      noseGeo.translate(0, 0, 1.25);
      const finGeo = new THREE.BoxGeometry(0.95, 0.06, 0.45);
      finGeo.translate(0, 0, -0.65);
      const plumeGeo = new THREE.ConeGeometry(0.28, 1.4, 10);
      plumeGeo.rotateX(-Math.PI / 2);
      plumeGeo.translate(0, 0, -1.55);

      const casingMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.85,
        roughness: 0.25,
      });
      const warheadMat = new THREE.MeshBasicMaterial({ color: 0xff3b5c });
      const plumeMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      for (let i = 0; i < MISSILE_POOL_SIZE; i++) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(bodyGeo, casingMat));
        g.add(new THREE.Mesh(noseGeo, warheadMat));
        const fin1 = new THREE.Mesh(finGeo, warheadMat);
        const fin2 = new THREE.Mesh(finGeo, warheadMat);
        fin2.rotation.z = Math.PI / 2;
        g.add(fin1, fin2);
        g.add(new THREE.Mesh(plumeGeo, plumeMat));
        g.visible = false;
        scene.add(g);
        missileMeshes.push(g);
      }
    }

    // 3D Pool for Track-Deployed Proximity Mines
    const MINE_POOL_SIZE = 18;
    const mineMeshes: THREE.Group[] = [];
    {
      const hullGeo = new THREE.CylinderGeometry(0.75, 0.92, 0.42, 16);
      const ringGeo = new THREE.TorusGeometry(0.84, 0.07, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const beaconGeo = new THREE.SphereGeometry(0.26, 12, 10);
      beaconGeo.translate(0, 0.28, 0);

      const hullMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        metalness: 0.82,
        roughness: 0.3,
      });
      const hazardMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xfb7185 });

      for (let i = 0; i < MINE_POOL_SIZE; i++) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(hullGeo, hullMat));
        const ring = new THREE.Mesh(ringGeo, hazardMat);
        ring.position.y = 0.14;
        g.add(ring);
        g.add(new THREE.Mesh(beaconGeo, beaconMat));
        g.visible = false;
        scene.add(g);
        mineMeshes.push(g);
      }
    }

    // 3D Vehicle Explosion Fireball & Flying Debris Pool
    interface ExplosionInstance {
      active: boolean;
      timer: number;
      maxTimer: number;
      origin: THREE.Vector3;
      group: THREE.Group;
      fireball: THREE.Mesh;
      shockRing: THREE.Mesh;
      debrisChunks: Array<{
        mesh: THREE.Mesh;
        vx: number;
        vy: number;
        vz: number;
        rx: number;
        ry: number;
      }>;
    }
    const explosionPool: ExplosionInstance[] = [];
    {
      const fireballGeo = new THREE.SphereGeometry(1.0, 24, 18);
      const shockRingGeo = new THREE.TorusGeometry(1.0, 0.12, 12, 36);
      shockRingGeo.rotateX(Math.PI / 2);
      const chunkGeo = new THREE.DodecahedronGeometry(0.32, 0);

      for (let i = 0; i < 4; i++) {
        const group = new THREE.Group();
        group.visible = false;

        const fireballMat = new THREE.MeshBasicMaterial({
          color: 0xff5500,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const fireball = new THREE.Mesh(fireballGeo, fireballMat);
        group.add(fireball);

        const shockRingMat = new THREE.MeshBasicMaterial({
          color: 0xffaa00,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const shockRing = new THREE.Mesh(shockRingGeo, shockRingMat);
        group.add(shockRing);

        const debrisChunks: ExplosionInstance['debrisChunks'] = [];
        for (let c = 0; c < 18; c++) {
          const chunkMat = new THREE.MeshBasicMaterial({
            color: c % 2 === 0 ? 0xff3b5c : 0xffaa00,
          });
          const mesh = new THREE.Mesh(chunkGeo, chunkMat);
          group.add(mesh);
          debrisChunks.push({
            mesh,
            vx: 0,
            vy: 0,
            vz: 0,
            rx: 0,
            ry: 0,
          });
        }

        scene.add(group);
        explosionPool.push({
          active: false,
          timer: 0,
          maxTimer: 1.55,
          origin: new THREE.Vector3(),
          group,
          fireball,
          shockRing,
          debrisChunks,
        });
      }
    }

    const triggerVehicleExplosion3D = (racer: RacerState) => {
      if (explodedRacerIds.has(racer.id)) return;
      explodedRacerIds.add(racer.id);

      sampleTrackFrame(spline, racer.t, _pos, _fwd, _right, _up);
      const blastOrigin = new THREE.Vector3()
        .copy(_pos)
        .addScaledVector(_right, racer.lateralOffset)
        .addScaledVector(_up, 0.95);

      spawnCollisionSparks(blastOrigin, 38);
      audioEngine.playVehicleExplosion();

      const exp = explosionPool.find((e) => !e.active) ?? explosionPool[0];
      exp.active = true;
      exp.timer = 0;
      exp.maxTimer = 1.55;
      exp.origin.copy(blastOrigin);
      exp.group.position.copy(blastOrigin);
      exp.group.visible = true;
      exp.fireball.scale.setScalar(0.5);
      exp.shockRing.scale.setScalar(0.5);

      for (let c = 0; c < exp.debrisChunks.length; c++) {
        const ch = exp.debrisChunks[c];
        ch.mesh.position.set(0, 0, 0);
        const angle = (c / exp.debrisChunks.length) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 10 + Math.random() * 22;
        ch.vx = Math.cos(angle) * speed;
        ch.vy = 6 + Math.random() * 16;
        ch.vz = Math.sin(angle) * speed;
        ch.rx = (Math.random() - 0.5) * 12;
        ch.ry = (Math.random() - 0.5) * 12;
      }
    };

    const currentCamPos = new THREE.Vector3(0, 35, 18);
    const currentCamLook = new THREE.Vector3(0, 30, -80);
    const smoothedCamFwd = new THREE.Vector3(0, 0, -1);
    const smoothedCamRight = new THREE.Vector3(1, 0, 0);
    const smoothedCamUp = new THREE.Vector3(0, 1, 0);
    let smoothedCamLateral = 0;
    const _overviewPos = new THREE.Vector3();
    const _overviewLook = new THREE.Vector3();
    const _chasePos = new THREE.Vector3();
    const _chaseLook = new THREE.Vector3();

    // Interactive Debug & Inspection Camera State
    const exploreTarget = new THREE.Vector3(0, 32, -20);
    let exploreYaw = 0.35;
    let explorePitch = 0.32;
    let exploreDistance = 36;

    let orbitYaw = 0; // 0 = behind vehicle looking forward; full 360° unbounded rotation
    let orbitPitch = 0.26;
    let orbitDistance = 14.2;
    const vehiclePanOffset = new THREE.Vector3(0, 0, 0);

    // Input Tracking
    const keysPressed = new Set<string>();
    const debugKeyTimes: Record<string, number> = {
      KeyK: 0,
      KeyE: 0,
      KeyS: 0,
    };
    let justPressedBonus = false;
    let justPressedWeapon = false;
    let justPressedShift = false;

    // Mouse Drag / Pan / Wheel Zoom Tracking for Debug & Camera-Pause Inspection + Live Pointer Steer
    let isDragging = false;
    let dragButton = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let pointerSteerDir = 0;

    const onPointerDown = (e: MouseEvent) => {
      window.focus();
      isDragging = true;
      dragButton = e.button;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    };

    const onPointerMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;

      const mode = debugModeRef.current;
      const isCamPaused = cameraPausedRef.current;

      if (mode === 'explore') {
        if (dragButton === 2 || dragButton === 1 || e.shiftKey) {
          // Right-click, Middle-click, or Shift+Drag: Pan 3D exploration target
          _camRight.set(Math.cos(exploreYaw), 0, -Math.sin(exploreYaw));
          _camUp.set(
            -Math.sin(exploreYaw) * Math.sin(explorePitch),
            Math.cos(explorePitch),
            -Math.cos(exploreYaw) * Math.sin(explorePitch)
          );
          const panScale = Math.max(0.03, exploreDistance * 0.0024);
          exploreTarget.addScaledVector(_camRight, -dx * panScale);
          exploreTarget.addScaledVector(_camUp, dy * panScale);
        } else {
          // Left-click drag: 360° camera rotation
          exploreYaw -= dx * 0.0068;
          explorePitch = THREE.MathUtils.clamp(explorePitch + dy * 0.0055, -1.42, 1.45);
        }
      } else if (mode === 'vehicle_orbit' || isCamPaused) {
        if (dragButton === 2 || dragButton === 1 || e.shiftKey) {
          // Pan offset around anchored vehicle
          const panScale = Math.max(0.015, orbitDistance * 0.002);
          vehiclePanOffset.addScaledVector(_right, -dx * panScale);
          vehiclePanOffset.addScaledVector(_up, dy * panScale);
        } else {
          // 360° rotation around anchored vehicle
          orbitYaw -= dx * 0.0075;
          orbitPitch = THREE.MathUtils.clamp(orbitPitch + dy * 0.006, -0.25, 1.42);
        }
      } else if (gameStateRef.current === 'playing' && dragButton === 0) {
        // Live racing horizontal pointer-drag steering across the track width
        if (Math.abs(dx) > 1.2) {
          pointerSteerDir = dx < 0 ? -1 : 1;
        }
      }
    };

    const onPointerUp = () => {
      isDragging = false;
      pointerSteerDir = 0;
    };

    const onWheel = (e: WheelEvent) => {
      const mode = debugModeRef.current;
      const isCamPaused = cameraPausedRef.current;
      if (mode === 'explore') {
        e.preventDefault();
        exploreDistance = THREE.MathUtils.clamp(
          exploreDistance * Math.exp(e.deltaY * 0.0012),
          2.5,
          520
        );
      } else if (mode === 'vehicle_orbit' || isCamPaused) {
        e.preventDefault();
        orbitDistance = THREE.MathUtils.clamp(
          orbitDistance * Math.exp(e.deltaY * 0.0012),
          2.5,
          95
        );
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (debugModeRef.current !== 'off' || cameraPausedRef.current) {
        e.preventDefault();
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });
    domElem.addEventListener('contextmenu', onContextMenu);

    const handledKeyDownEvents = new WeakSet<KeyboardEvent>();
    const handledKeyUpEvents = new WeakSet<KeyboardEvent>();

    const extractCanonicalCodes = (e: KeyboardEvent): string[] => {
      const codes: string[] = [];
      if (e.code) {
        codes.push(e.code);
      }
      const rawKey = e.key;
      if (rawKey) {
        const lower = rawKey.toLowerCase();
        switch (lower) {
          case 'arrowup':
          case 'up':
            codes.push('ArrowUp');
            break;
          case 'arrowdown':
          case 'down':
            codes.push('ArrowDown');
            break;
          case 'arrowleft':
          case 'left':
            codes.push('ArrowLeft');
            break;
          case 'arrowright':
          case 'right':
            codes.push('ArrowRight');
            break;
          case 'w':
            codes.push('KeyW');
            break;
          case 'a':
            codes.push('KeyA');
            break;
          case 's':
            codes.push('KeyS');
            break;
          case 'd':
            codes.push('KeyD');
            break;
          case 'q':
            codes.push('KeyQ');
            break;
          case 'e':
            codes.push('KeyE');
            break;
          case 'z':
            codes.push('KeyZ');
            break;
          case 'f':
            codes.push('KeyF');
            break;
          case 'c':
            codes.push('KeyC');
            break;
          case 'p':
            codes.push('KeyP');
            break;
          case 'k':
            codes.push('KeyK');
            break;
          case 'r':
            codes.push('KeyR');
            break;
          case 'x':
            codes.push('KeyX');
            break;
          case ' ':
          case 'spacebar':
            codes.push('Space');
            break;
          case 'shift':
            codes.push('ShiftLeft');
            break;
          case 'enter':
            codes.push('Enter');
            break;
          case 'escape':
          case 'esc':
            codes.push('Escape');
            break;
          default:
            break;
        }
      }
      return Array.from(new Set(codes));
    };

    const MOVEMENT_KEYS = new Set([
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'w',
      'a',
      's',
      'd',
      'W',
      'A',
      'S',
      'D',
      ' ',
    ]);

    const MOVEMENT_CODES = new Set([
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'Space',
    ]);

    const onKeyDown = (e: KeyboardEvent) => {
      if (handledKeyDownEvents.has(e)) return;
      handledKeyDownEvents.add(e);

      const codes = extractCanonicalCodes(e);
      const primaryCode = codes[0] ?? '';
      const nowMs = performance.now();

      for (let i = 0; i < codes.length; i++) {
        const c = codes[i];
        if (c === 'KeyK' || c === 'KeyE' || c === 'KeyS') {
          debugKeyTimes[c] = nowMs;
        }
        keysPressed.add(c);
      }

      // Check Secret Debug Menu activation chord: K + E + S pressed together
      const kActive = keysPressed.has('KeyK') || nowMs - debugKeyTimes.KeyK < 700;
      const eActive = keysPressed.has('KeyE') || nowMs - debugKeyTimes.KeyE < 700;
      const sActive = keysPressed.has('KeyS') || nowMs - debugKeyTimes.KeyS < 700;
      if (
        (codes.includes('KeyK') || codes.includes('KeyE') || codes.includes('KeyS')) &&
        kActive &&
        eActive &&
        sActive
      ) {
        e.preventDefault();
        debugKeyTimes.KeyK = 0;
        debugKeyTimes.KeyE = 0;
        debugKeyTimes.KeyS = 0;
        keysPressed.delete('KeyK');
        keysPressed.delete('KeyE');
        keysPressed.delete('KeyS');
        callbacksRef.current.onOpenDebugMenu();
        return;
      }

      // Prevent browser page scroll during movement interaction
      if (
        MOVEMENT_KEYS.has(e.key) ||
        codes.some((c) => MOVEMENT_CODES.has(c))
      ) {
        if (gameStateRef.current === 'playing' || debugModeRef.current !== 'off') {
          e.preventDefault();
        }
      }

      if (!e.repeat) {
        if (codes.includes('Space') || codes.includes('KeyF')) {
          justPressedBonus = true;
        }
        if (codes.includes('KeyZ')) {
          justPressedWeapon = true;
        }
        if (codes.includes('ShiftLeft') || codes.includes('ShiftRight')) {
          justPressedShift = true;
        }
        // Pressing P pauses/unpauses WITHOUT displaying the pause menu, preserving full camera & zoom control
        if (codes.includes('KeyP') && !debugMenuOpenRef.current) {
          e.preventDefault();
          callbacksRef.current.onToggleCameraPause();
          return;
        }
        if (primaryCode === 'Escape' || codes.includes('Escape')) {
          callbacksRef.current.onTogglePause();
          return;
        }
        if (codes.includes('KeyC') && gameStateRef.current === 'playing') {
          callbacksRef.current.onCycleCamera();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (handledKeyUpEvents.has(e)) return;
      handledKeyUpEvents.add(e);
      const codes = extractCanonicalCodes(e);
      for (let i = 0; i < codes.length; i++) {
        keysPressed.delete(codes[i]);
      }
    };

    const clearInputs = () => {
      keysPressed.clear();
      justPressedBonus = false;
      justPressedWeapon = false;
      justPressedShift = false;
      isDragging = false;
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    container.addEventListener('keydown', onKeyDown);
    container.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);

    // Build / Rebuild Track & Racers
    const buildSceneContent = () => {
      const cfg = settingsRef.current;
      const isNeon = cfg.atmosphere === 'neon';

      // Configure Sky, Fog & Balanced Studio Lighting (dark brooding charcoal-volcanic night for Lava tracks)
      const isCity = isCityTrack(cfg.trackId);
      if (isNeon) {
        const bgColor = isCity ? 0x09061a : 0x050204;
        baseFogDensity = isCity ? 0.00115 : 0.00105;
        scene.background = new THREE.Color(bgColor);
        scene.fog = new THREE.FogExp2(bgColor, baseFogDensity);
        hemiLight.color.setHex(isCity ? 0x38bdf8 : 0x64748b);
        hemiLight.groundColor.setHex(isCity ? 0x1e1b4b : 0x160504);
        hemiLight.intensity = isCity ? 0.66 : 0.44;
        keyLight.color.setHex(isCity ? 0xc084fc : 0xe2e8f0);
        keyLight.intensity = isCity ? 0.92 : 0.62;
        rimLight.color.setHex(0x00f2fe);
        rimLight.intensity = isCity ? 0.45 : 0.38;
      } else {
        const bgColor = isCity ? 0xcbd5e1 : 0xb8b5b0;
        baseFogDensity = 0.0011;
        scene.background = new THREE.Color(bgColor);
        scene.fog = new THREE.FogExp2(bgColor, baseFogDensity);
        hemiLight.color.setHex(0xf8fafc);
        hemiLight.groundColor.setHex(0x475569);
        hemiLight.intensity = 0.95;
        keyLight.color.setHex(0xffffff);
        keyLight.intensity = 1.25;
        rimLight.color.setHex(0x94a3b8);
        rimLight.intensity = 0.45;
      }

      // Sync UnrealBloomPass intensity so minimal neonIntensity (0.5) has minimal glow (0.04) and never washes out
      const normalizedNeon = Math.max(0, cfg.neonIntensity - 0.42);
      bloom.enabled = cfg.enableBloom;
      bloom.strength = isNeon
        ? THREE.MathUtils.clamp(normalizedNeon * 0.24, 0.03, 0.32)
        : 0.06;
      bloom.radius = 0.28;
      bloom.threshold = 1.08;

      // Enable subtle screen-space thermal heat haze on Lava circuits (strongest on lava_v2)
      heatHazeScreenPass.enabled = cfg.enableHeatHaze && !isCity;
      heatHazeScreenPass.uniforms.uStrength.value =
        cfg.trackId === 'lava_v2' ? (isNeon ? 1.0 : 0.65) : 0.55;

      // Configure Track-Specific SSAO Pass per circuit
      trackSsaoPass.enabled = cfg.enableTrackSsao;
      trackSsaoPass.uniforms.uIntensity.value = isNeon ? 1.05 : 0.88;

      // Configure High-Speed Motion Lines palette per track
      motionLinesPass.enabled = cfg.enableMotionLines;
      motionLinesPass.uniforms.uColorA.value.setHex(isCity ? 0x00f2fe : 0x38bdf8);
      motionLinesPass.uniforms.uColorB.value.setHex(isCity ? 0xd946ef : 0xff7a18);

      syncWeatherPalette();
      syncDebrisPalette();

      if (currentWorld) {
        scene.remove(currentWorld.worldGroup);
      }
      if (currentTextures) {
        currentTextures.roadMap.dispose();
        currentTextures.roadEmissiveMap.dispose();
        currentTextures.roadRoughnessMap.dispose();
        currentTextures.roadBumpMap.dispose();
        currentTextures.buildingMap.dispose();
        currentTextures.buildingEmissiveMap.dispose();
        currentTextures.holoBillboardMap.dispose();
        currentTextures.contactShadowMap.dispose();
        currentTextures.chevronSignMap.dispose();
        currentTextures.thrusterFlareMap.dispose();
        currentTextures.roadwayPanelsMap.dispose();
        currentTextures.obsidianRockMap.dispose();
        currentTextures.glowingLavaMap.dispose();
        currentTextures.brushedGraphiteMap.dispose();
        currentTextures.cyanNeonSurfaceMap.dispose();
        currentTextures.amberLaneMarkingsMap.dispose();
        currentTextures.volcanicGravelMap.dispose();
        currentTextures.cyanGuardrailMap.dispose();
        currentTextures.lavaCloudMap.dispose();
        currentTextures.cityWetTrackMap.dispose();
        currentTextures.cityArmourPanelsMap.dispose();
        currentTextures.cityCyanBarrierMap.dispose();
        currentTextures.cityLaneAsphaltMap.dispose();
        currentTextures.cityMagentaRailMap.dispose();
        currentTextures.cityWindowFacadeMap.dispose();
        currentTextures.cityRainbowPavementMap.dispose();
        currentTextures.cityCorridorFloorMap.dispose();
        currentTextures.cityDecorativeAtlasMap.dispose();
        currentTextures.lavaDecorativeAtlas1Map.dispose();
        currentTextures.lavaDecorativeAtlas2Map.dispose();
        currentTextures.checkpointSignMap.dispose();
        currentTextures.cyberSphereSignMap.dispose();
        currentTextures.volcanicBasaltAlbedoMap.dispose();
        currentTextures.volcanicBasaltNormalMap.dispose();
        currentTextures.volcanicBasaltRoughnessMap.dispose();
        currentTextures.volcanicBasaltHeightMap.dispose();
        currentTextures.volcanicBasaltAoMap.dispose();
        currentTextures.volcanicBasaltMetallicMap.dispose();
        currentTextures.volcanicBasaltEmissiveMap.dispose();
        currentTextures.volcanicBasaltLavaMaskMap.dispose();
      }

      spline = createTrackSpline(cfg.trackId);
      pads = createTrackPads(cfg.trackId);
      rings = [];
      currentTextures = createProceduralTextures(renderer, cfg.trackId, cfg.atmosphere);
      currentWorld = buildTrackAndWorld(
        spline,
        cfg.trackId,
        cfg.atmosphere,
        pads,
        rings,
        currentTextures,
        cfg.neonIntensity,
        isSoftwareGl
      );
      scene.add(currentWorld.worldGroup);

      resetRacersAndGrid();

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }
    };

    const resetRacersAndGrid = () => {
      for (const rig of shipRigs) {
        scene.remove(rig.root);
      }
      shipRigs = [];

      racers = createInitialRacers(settingsRef.current.shipId);
      for (let i = 0; i < racers.length; i++) {
        const r = racers[i];
        const rig = createShipMesh(
          r.shipId,
          currentTextures!,
          isSoftwareGl
        );
        scene.add(rig.root);
        shipRigs.push(rig);
      }

      raceElapsedMs = 0;
      const isDemo = demoModeRef.current;
      const isCity = isCityTrack(settingsRef.current.trackId);
      INTRO_TOTAL_SEC = isCity ? CITY_INTRO_TOTAL_SEC : 0.0;
      LOCK_START_SEC = isCity ? CITY_LOCK_START_SEC : 0.0;
      STABILIZED_VIEW_SEC = isCity ? CITY_STABILIZED_SEC : 0.0;
      COUNTDOWN_START_SEC = isCity ? CITY_COUNTDOWN_START_SEC : 0.0;

      countdownTimer = isDemo ? 0 : INTRO_TOTAL_SEC;
      introAnnounced = isDemo;
      preCountdownLockPlayed = isDemo;
      introDistantThunderPlayed = isDemo;
      preCountdownThunderPlayed = isDemo;
      preCountdownLightningPlayed = isDemo;
      manualDriveSkipTimer = 0;
      distantSheetFlash = 0;
      lightningBoltFlash = 0;
      nextStormEventTimer = 4.2;
      pendingThunderDelay = -1;
      lastCountdownInt = isDemo ? 0 : 4;
      countdownFovKick = isDemo ? 6.0 : 0;
      justPressedBonus = false;
      justPressedWeapon = false;
      justPressedShift = false;
      keysPressed.delete('Space');
      keysPressed.delete('Enter');
      const spec = TRACK_SPECS[settingsRef.current.trackId];
      statusBanner = isDemo
        ? 'DEMO MODE // AI AUTOPILOT ENGAGED'
        : `${spec.name} // ${spec.sector}`;
      statusBannerTimer = isDemo ? 2.4 : 0;
      cameraShakeTrauma = 0;
      boostShakeIntensity = 0;
      wasPlayerBoosting = false;
      wallScrapeSparkCooldown = 0;
      hitstopTimer = 0;
      topSpeedRecorded = 0;
      ringsPassedCount = 0;
      boostPadsHitCount = 0;
      powerUpsCollectedCount = 0;
      disabledPadIds.clear();
      activeMissiles = [];
      activeMines = [];
      playerExplosionTimer = 0;
      playerExplosionHandled = false;
      explodedRacerIds.clear();
      for (const m of missileMeshes) m.visible = false;
      for (const m of mineMeshes) m.visible = false;
      for (const ex of explosionPool) {
        ex.active = false;
        ex.group.visible = false;
      }
      if (currentWorld && currentWorld.powerUpBoxes) {
        for (let b = 0; b < currentWorld.powerUpBoxes.length; b++) {
          const box = currentWorld.powerUpBoxes[b];
          box.respawnTimer = 0;
          box.collectAnimProgress = 0;
          box.itemGroup.visible = true;
          box.holoBoxGroup.visible = true;
          box.itemGroup.scale.setScalar(box.weaponType ? 1.32 : 1.22);
          box.holoBoxGroup.scale.setScalar(1);
        }
      }

      if (isDemo) {
        for (let i = 0; i < racers.length; i++) {
          racers[i].speedKmh = racers[i].isPlayer ? 540 : 510;
        }
      }

      updateAllShipTransforms(0.016, false);

      const playerIdx = racers.findIndex((r) => r.isPlayer);
      if (playerIdx >= 0) {
        const player = racers[playerIdx];
        const camMode = settingsRef.current.cameraMode;
        const initCamDist =
          camMode === 'cockpit'
            ? 0.6
            : camMode === 'close'
            ? -8.5
            : camMode === 'chase'
            ? -13.5
            : -19.5;
        const initCamHeight =
          camMode === 'cockpit'
            ? 1.15
            : camMode === 'close'
            ? 3.05
            : camMode === 'chase'
            ? 4.55
            : 6.8;
        const initLookDist =
          camMode === 'cockpit'
            ? 48.0
            : camMode === 'close'
            ? 14.0
            : camMode === 'chase'
            ? 4.0
            : 6.5;
        const initLookHeight =
          camMode === 'cockpit'
            ? 1.85
            : camMode === 'close'
            ? 1.45
            : camMode === 'chase'
            ? 0.95
            : 0.65;
        sampleTrackFrame(spline, player.t, _pos, _fwd, _right, _up);
        smoothedCamFwd.copy(_fwd);
        smoothedCamRight.copy(_right);
        smoothedCamUp.copy(_up);
        smoothedCamLateral = player.lateralOffset;
        _shipPos
          .copy(_pos)
          .addScaledVector(_right, player.lateralOffset)
          .addScaledVector(_up, 0.72);
        currentCamPos
          .copy(_shipPos)
          .addScaledVector(_fwd, initCamDist)
          .addScaledVector(_up, initCamHeight);
        currentCamLook
          .copy(_shipPos)
          .addScaledVector(_fwd, initLookDist)
          .addScaledVector(_up, initLookHeight);
        camera.position.copy(currentCamPos);
        camera.lookAt(currentCamLook);
      }
      window.focus();
      container.focus({ preventScroll: true });
    };

    // Emit Glowing Neon-Cyan Thruster Sparks & Thermal Heat Haze from Twin Rear Nozzles (Speed & Boost Reactive)
    const emitBoostThrusterParticles = (
      shipOrigin: THREE.Vector3,
      forward: THREE.Vector3,
      rightVec: THREE.Vector3,
      upVec: THREE.Vector3,
      speedKmh: number,
      maxSpeed: number,
      isBoosting: boolean,
      isPlayer: boolean
    ) => {
      if (!settingsRef.current.showParticles) return;
      const speedNorm = THREE.MathUtils.clamp(speedKmh / Math.max(1, maxSpeed), 0, 1.35);
      const boostBonus = isBoosting ? 0.55 : 0.0;
      const intensity = THREE.MathUtils.clamp(speedNorm * 0.78 + boostBonus, 0, 1.45);
      if (intensity < 0.05) return;

      // Ship forward speed in m/s so emitted particles stay anchored to the moving nozzle frame
      // and stream 0.2m..1.8m behind the twin thrusters instead of flying into the chase camera lens
      const shipSpeedMs = speedKmh / 3.6;

      // 1. Emit Glowing Neon-Cyan Thruster Sparks from Left (-0.64) and Right (+0.64) Nozzles
      const rawSparkCount = isPlayer
        ? intensity * (isBoosting ? 3.6 : 1.8)
        : intensity * (isBoosting ? 1.4 : 0.5);
      const sparkCount = Math.floor(rawSparkCount) + (Math.random() < (rawSparkCount % 1) ? 1 : 0);

      for (let i = 0; i < sparkCount; i++) {
        const sp = thrusterSparks[thrusterSparkCursor];
        thrusterSparkCursor = (thrusterSparkCursor + 1) % THRUSTER_SPARK_POOL_SIZE;
        sp.active = true;

        const nozzleSide = i % 2 === 0 ? -0.64 : 0.64;
        const radialJitterX = (Math.random() - 0.5) * 0.14;
        const radialJitterY = (Math.random() - 0.5) * 0.12;
        const nozzleBack = -2.52 - Math.random() * 0.18;

        sp.x =
          shipOrigin.x +
          rightVec.x * (nozzleSide + radialJitterX) +
          upVec.x * (0.38 + radialJitterY) +
          forward.x * nozzleBack;
        sp.y =
          shipOrigin.y +
          rightVec.y * (nozzleSide + radialJitterX) +
          upVec.y * (0.38 + radialJitterY) +
          forward.y * nozzleBack;
        sp.z =
          shipOrigin.z +
          rightVec.z * (nozzleSide + radialJitterX) +
          upVec.z * (0.38 + radialJitterY) +
          forward.z * nozzleBack;

        const relExhaustSpeed = (7.5 + Math.random() * 5.0) * (0.65 + 0.45 * intensity);
        const spreadLat = (Math.random() - 0.5) * (1.2 + 1.1 * intensity);
        const spreadUp = (Math.random() - 0.35) * (0.9 + 0.8 * intensity);

        // World velocity = ship forward velocity minus relative exhaust jet speed
        sp.vx = forward.x * (shipSpeedMs - relExhaustSpeed) + rightVec.x * spreadLat + upVec.x * spreadUp;
        sp.vy = forward.y * (shipSpeedMs - relExhaustSpeed) + rightVec.y * spreadLat + upVec.y * spreadUp;
        sp.vz = forward.z * (shipSpeedMs - relExhaustSpeed) + rightVec.z * spreadLat + upVec.z * spreadUp;

        // Exhaust orientation vector in the nozzle frame so spark streaks always align with the jet
        sp.dirX = -forward.x * relExhaustSpeed + rightVec.x * spreadLat * 0.5 + upVec.x * spreadUp * 0.5;
        sp.dirY = -forward.y * relExhaustSpeed + rightVec.y * spreadLat * 0.5 + upVec.y * spreadUp * 0.5;
        sp.dirZ = -forward.z * relExhaustSpeed + rightVec.z * spreadLat * 0.5 + upVec.z * spreadUp * 0.5;

        sp.life = 0;
        sp.maxLife = 0.09 + Math.random() * 0.07;
        sp.scale = (0.38 + Math.random() * 0.32) * (0.72 + 0.38 * intensity);
        sp.streakFactor = 0.65 + 0.65 * intensity;
      }

      // 2. Emit Thermal Heat-Haze Shimmer Rings from Twin Rear Nozzles (Player Craft & Boosting AI)
      if (isPlayer || isBoosting) {
        const hazeProb = isPlayer ? THREE.MathUtils.clamp(0.18 + intensity * 0.55, 0.15, 0.75) : 0.25;
        const hazeCount = Math.random() < hazeProb ? 1 : 0;

        for (let h = 0; h < hazeCount; h++) {
          const hz = heatHazeParticles[heatHazeCursor];
          heatHazeCursor = (heatHazeCursor + 1) % HEAT_HAZE_POOL_SIZE;
          hz.active = true;

          const nozzleSide = (heatHazeCursor % 2 === 0 ? -1 : 1) * 0.64;
          const nozzleBack = -2.58 - Math.random() * 0.22;

          hz.x =
            shipOrigin.x +
            rightVec.x * (nozzleSide + (Math.random() - 0.5) * 0.10) +
            upVec.x * (0.38 + (Math.random() - 0.5) * 0.08) +
            forward.x * nozzleBack;
          hz.y =
            shipOrigin.y +
            rightVec.y * (nozzleSide + (Math.random() - 0.5) * 0.10) +
            upVec.y * (0.38 + (Math.random() - 0.5) * 0.08) +
            forward.y * nozzleBack;
          hz.z =
            shipOrigin.z +
            rightVec.z * (nozzleSide + (Math.random() - 0.5) * 0.10) +
            upVec.z * (0.38 + (Math.random() - 0.5) * 0.08) +
            forward.z * nozzleBack;

          const relDriftSpeed = (5.0 + Math.random() * 3.5) * (0.65 + 0.35 * intensity);
          hz.vx = forward.x * (shipSpeedMs - relDriftSpeed) + rightVec.x * ((Math.random() - 0.5) * 0.6);
          hz.vy = forward.y * (shipSpeedMs - relDriftSpeed) + upVec.y * (0.15 + Math.random() * 0.25);
          hz.vz = forward.z * (shipSpeedMs - relDriftSpeed) + rightVec.z * ((Math.random() - 0.5) * 0.6);
          hz.life = 0;
          hz.maxLife = 0.11 + Math.random() * 0.07;
          hz.startScale = (0.20 + Math.random() * 0.08) * (0.75 + 0.30 * intensity);
          hz.endScale = (0.46 + Math.random() * 0.16) * (0.75 + 0.35 * intensity);
          hz.roll = Math.random() * Math.PI * 2;
          hz.rollSpeed = (Math.random() - 0.5) * 4.5;
        }
      }
    };

    const spawnCollisionSparks = (origin: THREE.Vector3, count: number) => {
      if (!settingsRef.current.showParticles) return;
      for (let i = 0; i < count; i++) {
        const sp = sparks[sparkCursor];
        sparkCursor = (sparkCursor + 1) % SPARK_POOL_SIZE;
        sp.active = true;
        sp.x = origin.x + (Math.random() - 0.5) * 1.0;
        sp.y = origin.y + 0.35 + (Math.random() - 0.5) * 0.5;
        sp.z = origin.z + (Math.random() - 0.5) * 1.0;
        sp.vx = (Math.random() - 0.5) * 22;
        sp.vy = 3 + Math.random() * 10;
        sp.vz = (Math.random() - 0.5) * 22;
        sp.life = 0;
        sp.maxLife = 0.18 + Math.random() * 0.14;
        sp.scale = 0.55 + Math.random() * 0.45;
      }
    };

    // Emit Proximity-Reactive Track Debris (Volcanic Dust/Ash Clouds & Cinders OR City Rain Splashes)
    // kicked up by the craft's anti-gravity ground effect and aerodynamic bow-wave
    const emitProximityTrackDebris = (
      shipOrigin: THREE.Vector3,
      forward: THREE.Vector3,
      rightVec: THREE.Vector3,
      upVec: THREE.Vector3,
      speedKmh: number,
      maxSpeed: number,
      isBoosting: boolean,
      isPlayer: boolean
    ) => {
      if (!settingsRef.current.enableTrackDebris) return;
      const speedNorm = THREE.MathUtils.clamp(speedKmh / Math.max(1, maxSpeed), 0, 1.35);
      if (speedNorm < 0.08) return;

      const isCity = isCityTrack(settingsRef.current.trackId);
      const emitChance = isPlayer
        ? THREE.MathUtils.clamp(0.48 + speedNorm * 0.52 + (isBoosting ? 0.35 : 0), 0.35, 1.35)
        : THREE.MathUtils.clamp(0.22 + speedNorm * 0.32, 0.15, 0.65);
      const count = Math.floor(emitChance) + (Math.random() < (emitChance % 1) ? 1 : 0);

      for (let i = 0; i < count; i++) {
        const db = debrisParticles[debrisCursor];
        debrisCursor = (debrisCursor + 1) % DEBRIS_POOL_SIZE;
        db.active = true;

        // Spawn along the road surface right beneath and slightly outboard of the craft's hover skids
        // or slightly ahead in the road corridor so the passing craft's bow-wave blasts through it
        const isAheadPocket = Math.random() < 0.28;
        const sideSign = Math.random() < 0.5 ? -1 : 1;
        const lateralSpread = isAheadPocket
          ? (Math.random() - 0.5) * 7.5
          : sideSign * (0.95 + Math.random() * 1.45);
        const longitudinalOffset = isAheadPocket
          ? 8.0 + Math.random() * 14.0
          : -1.4 - Math.random() * 2.2;
        const verticalGroundOffset = -0.48 + Math.random() * 0.18;

        db.x =
          shipOrigin.x +
          rightVec.x * lateralSpread +
          forward.x * longitudinalOffset +
          upVec.x * verticalGroundOffset;
        db.y =
          shipOrigin.y +
          rightVec.y * lateralSpread +
          forward.y * longitudinalOffset +
          upVec.y * verticalGroundOffset;
        db.z =
          shipOrigin.z +
          rightVec.z * lateralSpread +
          forward.z * longitudinalOffset +
          upVec.z * verticalGroundOffset;

        if (isAheadPocket) {
          // Ambient road-surface dust pocket / rain puddle ripple waiting to be blasted by racer proximity
          db.vx = (Math.random() - 0.5) * 1.2;
          db.vy = 0.25 + Math.random() * 0.45;
          db.vz = (Math.random() - 0.5) * 1.2;
          db.life = 0;
          db.maxLife = 0.85 + Math.random() * 0.45;
          db.startScale = isCity ? 0.45 : 0.75;
          db.endScale = isCity ? 1.65 : 2.45;
        } else {
          // Immediate ground-effect downwash kick-up from the passing racer
          const outSpeed = (3.8 + Math.random() * 4.8) * (0.7 + 0.55 * speedNorm);
          const upLift = (isCity ? 3.2 : 2.4) * (0.65 + 0.65 * speedNorm) + Math.random() * 1.8;
          const wakeDrag = (speedKmh / 3.6) * (isCity ? 0.18 : 0.24);

          db.vx =
            rightVec.x * sideSign * outSpeed +
            upVec.x * upLift +
            forward.x * wakeDrag +
            (Math.random() - 0.5) * 2.0;
          db.vy =
            rightVec.y * sideSign * outSpeed +
            upVec.y * upLift +
            forward.y * wakeDrag;
          db.vz =
            rightVec.z * sideSign * outSpeed +
            upVec.z * upLift +
            forward.z * wakeDrag +
            (Math.random() - 0.5) * 2.0;

          db.life = 0;
          db.maxLife = (isCity ? 0.42 : 0.68) + Math.random() * 0.28;
          db.startScale = (isCity ? 0.48 : 0.72) * (0.8 + 0.35 * speedNorm);
          db.endScale = (isCity ? 1.85 : 2.85) * (0.85 + 0.45 * speedNorm + (isBoosting ? 0.25 : 0));
        }

        db.roll = Math.random() * Math.PI * 2;
        db.rollSpeed = (Math.random() - 0.5) * (isCity ? 5.5 : 3.6);
        db.turbulenceBoost = isBoosting ? 0.35 : 0;
      }
    };

    const updateAllShipTransforms = (dt: number, animatePlumes: boolean) => {
      const timeSec = performance.now() * 0.001;
      for (let i = 0; i < racers.length; i++) {
        const r = racers[i];
        const rig = shipRigs[i];
        if (!rig) continue;

        sampleTrackFrame(spline, r.t, _pos, _fwd, _right, _up);
        const hoverBob = Math.sin(timeSec * 5.2 + i * 1.3) * 0.035;

        _shipPos
          .copy(_pos)
          .addScaledVector(_right, r.lateralOffset)
          .addScaledVector(_up, 0.72 + hoverBob);

        rig.root.position.copy(_shipPos);

        _lookTarget.copy(_shipPos).add(_fwd);
        _rotMatrix.lookAt(_shipPos, _lookTarget, _up);
        _shipQuat.setFromRotationMatrix(_rotMatrix);
        rig.root.quaternion.copy(_shipQuat);

        rig.hullGroup.rotation.set(r.pitchAngle, r.yawOffset, r.rollAngle);

        const shipSpec = SHIP_SPECS[r.shipId];
        const speedRatio = THREE.MathUtils.clamp(r.speedKmh / Math.max(1, shipSpec.maxSpeedKmh), 0, 1.35);
        const speedNorm = Math.min(1.20, Math.max(0.28, r.speedKmh / 900));
        const boostMult = r.isBoosting ? 1.32 : 1.0;
        const plumeLen = speedNorm * boostMult;

        rig.leftFlame.scale.set(1, 1, plumeLen);
        rig.rightFlame.scale.set(1, 1, plumeLen);
        rig.leftOuterGlow.scale.set(
          r.isBoosting ? 1.08 : 0.88,
          r.isBoosting ? 1.08 : 0.88,
          plumeLen * 1.02
        );
        rig.rightOuterGlow.scale.set(
          r.isBoosting ? 1.08 : 0.88,
          r.isBoosting ? 1.08 : 0.88,
          plumeLen * 1.02
        );
        rig.leftContrail.visible = false;
        rig.rightContrail.visible = false;
        rig.plumeGroundGlow.visible = false;

        const flareScaleFactor = 0.45 + 0.35 * speedRatio + (r.isBoosting ? 0.22 : 0);
        const flareW = 0.72 * flareScaleFactor;
        const flareH = 0.38 * flareScaleFactor;
        rig.leftFlare.scale.set(flareW, flareH, 1);
        rig.rightFlare.scale.set(flareW, flareH, 1);

        for (let m = 0; m < rig.plumeMaterials.length; m++) {
          const mat = rig.plumeMaterials[m];
          if (mat.uniforms.uTime !== undefined) {
            mat.uniforms.uTime.value = timeSec + i * 0.7;
          }
          if (mat.uniforms.uBoost !== undefined) {
            mat.uniforms.uBoost.value = r.isBoosting ? 1.0 : 0.0;
          }
          if (mat.uniforms.uSpeed !== undefined) {
            mat.uniforms.uSpeed.value = speedRatio;
          }
        }

        rig.shieldMesh.visible = !r.isDestroyed && r.shieldTimer > 0;
        rig.hullGroup.visible = !r.isDestroyed;
        rig.leftFlame.visible = !r.isDestroyed;
        rig.rightFlame.visible = !r.isDestroyed;
        rig.leftOuterGlow.visible = !r.isDestroyed;
        rig.rightOuterGlow.visible = !r.isDestroyed;
        rig.leftFlare.visible = !r.isDestroyed;
        rig.rightFlare.visible = !r.isDestroyed;

        // Weapon 2: Forward-Directed Coherent Laser Beam visual
        if (!r.isDestroyed && r.laserActiveTimer > 0) {
          rig.laserBeamGroup.visible = true;
          const beamPulse = 0.85 + Math.sin(timeSec * 42) * 0.22;
          rig.laserBeamGroup.scale.set(beamPulse, beamPulse, 1);
        } else {
          rig.laserBeamGroup.visible = false;
        }

        // Weapon 3: Radial Shockwave EMP Ring visual
        if (!r.isDestroyed && r.shockwaveActiveTimer > 0) {
          rig.shockwaveMesh.visible = true;
          const progress = 1.0 - Math.min(1, r.shockwaveActiveTimer / 0.85);
          const radiusScale = 1.5 + progress * 36.5;
          rig.shockwaveMesh.scale.set(radiusScale, radiusScale, 1 + progress * 2.5);
          const swMat = rig.shockwaveMesh.material as THREE.MeshBasicMaterial;
          swMat.opacity = Math.max(0.05, (1.0 - progress) * 0.88);
        } else {
          rig.shockwaveMesh.visible = false;
        }

        if (animatePlumes && !r.isDestroyed) {
          if (r.isPlayer) {
            heatHazeMat.uniforms.uTime.value = timeSec;
            heatHazeMat.uniforms.uSpeedIntensity.value = THREE.MathUtils.clamp(
              speedRatio * 0.75 + (r.isBoosting ? 0.4 : 0.0),
              0.10,
              1.15
            );
          }
          emitBoostThrusterParticles(
            _shipPos,
            _fwd,
            _right,
            _up,
            r.speedKmh,
            shipSpec.maxSpeedKmh,
            r.isBoosting,
            r.isPlayer
          );
          emitProximityTrackDebris(
            _shipPos,
            _fwd,
            _right,
            _up,
            r.speedKmh,
            shipSpec.maxSpeedKmh,
            r.isBoosting,
            r.isPlayer
          );
        }
      }
    };

    const swapPlayerShip = () => {
      if (!currentTextures || racers.length === 0 || shipRigs.length === 0) return;
      const newShipId = settingsRef.current.shipId;
      const playerIdx = racers.findIndex((r) => r.isPlayer);
      if (playerIdx < 0) return;
      if (racers[playerIdx].shipId === newShipId) return;

      racers[playerIdx].shipId = newShipId;
      scene.remove(shipRigs[playerIdx].root);
      const newRig = createShipMesh(newShipId, currentTextures, isSoftwareGl);
      scene.add(newRig.root);
      shipRigs[playerIdx] = newRig;
      updateAllShipTransforms(0.016, false);
    };

    rebuildSceneRef.current = buildSceneContent;
    swapPlayerShipRef.current = swapPlayerShip;
    resetRaceStateRef.current = resetRacersAndGrid;

    applyTeleportRef.current = (req: DebugTeleportRequest) => {
      sampleTrackFrame(spline, req.t, _pos, _fwd, _right, _up);
      exploreTarget.copy(_pos).addScaledVector(_up, req.heightOffset ?? 4.0);
      if (req.distance !== undefined) exploreDistance = req.distance;
      if (req.yaw !== undefined) {
        exploreYaw = req.yaw;
      } else {
        exploreYaw = Math.atan2(-_fwd.x, -_fwd.z) + 0.25;
      }
      if (req.pitch !== undefined) explorePitch = req.pitch;
      const cosP = Math.cos(explorePitch);
      const sinP = Math.sin(explorePitch);
      currentCamPos.set(
        exploreTarget.x + Math.sin(exploreYaw) * cosP * exploreDistance,
        exploreTarget.y + sinP * exploreDistance,
        exploreTarget.z + Math.cos(exploreYaw) * cosP * exploreDistance
      );
      currentCamLook.copy(exploreTarget);
    };

    syncDebugModeInitRef.current = (mode: DebugMode) => {
      const player = racers.find((r) => r.isPlayer);
      if (!player) return;
      sampleTrackFrame(spline, player.t, _pos, _fwd, _right, _up);
      _shipPos
        .copy(_pos)
        .addScaledVector(_right, player.lateralOffset)
        .addScaledVector(_up, 0.72);

      if (mode === 'explore') {
        countdownTimer = 0;
        exploreTarget.copy(_shipPos).addScaledVector(_up, 3.0);
        exploreYaw = Math.atan2(-_fwd.x, -_fwd.z) + 0.35;
        explorePitch = 0.32;
        exploreDistance = 32;
      } else if (mode === 'vehicle_orbit') {
        countdownTimer = 0;
        vehiclePanOffset.set(0, 0, 0);
        orbitDistance = 9.5;
        orbitPitch = 0.26;
      } else {
        vehiclePanOffset.set(0, 0, 0);
      }
    };

    buildSceneContent();

    let frameId = 0;
    let isDisposed = false;
    let lastFrameTime = performance.now();
    let lastHudEmitTime = 0;
    let smoothedMotionLinesIntensity = 0;
    let motionLinesPreviewTimer = 0;
    let boostComboPhase = 0;
    let prevEnableMotionLines = settingsRef.current.enableMotionLines;
    let smoothedGForceTilt = 0;
    let smoothedDriftSwayLat = 0;
    let smoothedDriftLookYaw = 0;
    let smoothedDriftRoll = 0;
    const _aheadTangent = new THREE.Vector3();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const now = performance.now();
      const rawDt = (now - lastFrameTime) * 0.001;
      lastFrameTime = now;
      const dt = Math.min(rawDt, 0.12);
      const timeSec = now * 0.001;

      const state = gameStateRef.current;
      const cfg = settingsRef.current;
      const mode = debugModeRef.current;
      const isMenuPaused = state === 'paused' || debugMenuOpenRef.current;
      const isCamPaused = cameraPausedRef.current;
      const trackSpec = TRACK_SPECS[cfg.trackId];

      // Compute current Dynamic Weather State (affects visual clarity & surface friction)
      const currentWeather = computeWeatherState(
        cfg.trackId,
        cfg.weatherMode,
        raceElapsedMs * 0.001 + timeSec * 0.35
      );

      // Dynamically modulate scene fog density to affect visual clarity in storms
      if (scene.fog instanceof THREE.FogExp2) {
        const targetFog = baseFogDensity * (1 + currentWeather.intensity * 1.45);
        scene.fog.density += (targetFog - scene.fog.density) * (1 - Math.exp(-4 * dt));
      }

      // Live-sync post-processing & particle visibility flags so toggling in Settings updates the screen immediately
      const isCity = isCityTrack(cfg.trackId);
      const isStormActive = isCity && cfg.weatherMode !== 'clear';
      bloom.enabled = cfg.enableBloom;
      heatHazeScreenPass.enabled = cfg.enableHeatHaze && !isCity;
      heatHazeInstanced.visible = cfg.enableHeatHaze;
      motionLinesPass.enabled = cfg.enableMotionLines;
      stormRainPass.enabled = isStormActive && cfg.enableRisingEmbers;
      stormSkyGroup.visible = isStormActive;
      weatherInstanced.visible = cfg.enableRisingEmbers;
      debrisInstanced.visible = cfg.enableTrackDebris;
      thrusterSparkInstanced.visible = cfg.showParticles;
      sparkInstanced.visible = cfg.showParticles;

      // Decay & flicker lightning/sheet flashes + update storm sky & lighting uniforms
      if (!isCamPaused) {
        if (distantSheetFlash > 0) {
          distantSheetFlash = Math.max(0, distantSheetFlash - dt * 2.2);
        }
        if (lightningBoltFlash > 0) {
          lightningBoltFlash = Math.max(0, lightningBoltFlash - dt * 2.55);
        }
      }
      const multiFlicker =
        lightningBoltFlash > 0.05
          ? lightningBoltFlash * (0.76 + 0.24 * Math.sin(timeSec * 62.0))
          : 0.0;
      const cloudDensityVal = currentWeather.cloudDensity ?? (isStormActive ? 0.88 : 0.0);

      stormCanopyMat.uniforms.uTime.value = timeSec;
      stormCanopyMat.uniforms.uCloudDensity.value = cloudDensityVal;
      stormCanopyMat.uniforms.uSheetFlash.value = distantSheetFlash;
      stormCanopyMat.uniforms.uBoltFlash.value = multiFlicker;

      stormVortexMat.uniforms.uTime.value = timeSec;
      stormVortexMat.uniforms.uStormIntensity.value = currentWeather.intensity;
      stormVortexMat.uniforms.uSheetFlash.value = distantSheetFlash;
      stormVortexMat.uniforms.uBoltFlash.value = multiFlicker;
      stormVortexMat.uniforms.uBoltSeed.value = lightningBoltSeed;
      stormVortexMat.uniforms.uBoltXOffset.value = lightningBoltXOffset;

      stormRainPass.uniforms.uTime.value = timeSec;
      stormRainPass.uniforms.uRainIntensity.value = isStormActive
        ? currentWeather.intensity
        : 0.0;
      stormRainPass.uniforms.uLightningFlash.value = multiFlicker;
      stormRainPass.uniforms.uDistantFlash.value = distantSheetFlash;

      if (isStormActive) {
        const isNeon = cfg.atmosphere === 'neon';
        const baseHemi = isNeon ? 0.66 : 0.95;
        const baseKey = isNeon ? 0.92 : 1.25;
        const flashSurge = multiFlicker * 1.65 + distantSheetFlash * 0.55;
        hemiLight.intensity = baseHemi + flashSurge * 0.65;
        keyLight.intensity = baseKey + flashSurge * 0.95;
        stormLightningLight.intensity = multiFlicker * 18.0 + distantSheetFlash * 4.2;
      } else {
        stormLightningLight.intensity = 0;
      }

      if (!prevEnableMotionLines && cfg.enableMotionLines) {
        motionLinesPreviewTimer = 2.8;
      }
      prevEnableMotionLines = cfg.enableMotionLines;
      if (motionLinesPreviewTimer > 0) {
        motionLinesPreviewTimer = Math.max(0, motionLinesPreviewTimer - dt);
      }

      // Always keep shader uniforms (lava displacement, volumetric rays, rising embers, uTime) live
      // even when the Settings Modal is open during pause so the user sees immediate on-screen changes
      if (currentWorld) {
        if (currentWorld.lavaFallsMesh) {
          currentWorld.lavaFallsMesh.visible = cfg.enableVolumetricRays;
          const scalePulse = 1 + Math.sin(now * 0.005) * 0.035;
          currentWorld.lavaFallsMesh.scale.x = scalePulse;
        }
        for (let i = 0; i < currentWorld.animatedSearchlights.length; i++) {
          const sl = currentWorld.animatedSearchlights[i];
          sl.visible = cfg.enableVolumetricRays;
          if (!isCamPaused) {
            sl.rotation.y = Math.sin(timeSec * 0.55 + i * 1.1) * 0.65;
            sl.rotation.x = Math.cos(timeSec * 0.42 + i * 0.8) * 0.18;
          }
        }
        if (!isCamPaused && currentTextures) {
          currentTextures.updateAnimatedTextures(timeSec);
        }
        const activePlayer = racers.find((r) => r.isPlayer);
        const comboLevel = activePlayer?.boostComboCount ?? 0;
        if (!isCamPaused) {
          boostComboPhase += dt * (2.6 + comboLevel * 1.65);
        }
        for (let i = 0; i < currentWorld.animatedShaders.length; i++) {
          const sh = currentWorld.animatedShaders[i];
          if (!isCamPaused) {
            sh.uniforms.uTime.value = timeSec;
          }
          if (sh.uniforms.uComboPhase !== undefined) {
            sh.uniforms.uComboPhase.value = boostComboPhase;
          }
          if (sh.uniforms.uComboLevel !== undefined) {
            sh.uniforms.uComboLevel.value = comboLevel;
          }
          if (sh.uniforms.uEnableDisplacement !== undefined) {
            sh.uniforms.uEnableDisplacement.value = cfg.enableLavaDisplacement ? 1.0 : 0.0;
          }
          if (sh.uniforms.uEnableVolumetric !== undefined) {
            sh.uniforms.uEnableVolumetric.value = cfg.enableVolumetricRays ? 1.0 : 0.0;
          }
          if (sh.uniforms.uEnableRisingEmbers !== undefined) {
            sh.uniforms.uEnableRisingEmbers.value = cfg.enableRisingEmbers ? 1.0 : 0.0;
          }
        }
      }

      // Animate world power-up boxes, crystals, rings & aerial traffic unless frozen by P camera-pause or menu
      const worldAnimDt = isCamPaused || isMenuPaused ? 0 : dt;
      if (currentWorld && worldAnimDt > 0) {
        disabledPadIds.clear();
        for (let i = 0; i < currentWorld.powerUpBoxes.length; i++) {
          const box = currentWorld.powerUpBoxes[i];
          const baseItemScale = box.weaponType ? 1.55 : 1.45;
          const bobOffset = Math.sin(timeSec * 3.2 + i * 0.85) * 0.22;
          box.itemGroup.position.y = 2.15 + bobOffset;
          box.holoBoxGroup.position.y = 2.15 + bobOffset;
          box.itemGroup.rotation.y += worldAnimDt * 2.65;
          box.itemGroup.rotation.x = Math.sin(timeSec * 1.8 + i * 0.7) * 0.22;
          box.holoBoxGroup.rotation.y -= worldAnimDt * 1.85;
          box.holoBoxGroup.rotation.x += worldAnimDt * 0.65;
          box.holoBoxGroup.rotation.z = Math.cos(timeSec * 1.65 + i) * 0.28;

          if (box.respawnTimer > 0) {
            box.respawnTimer = Math.max(0, box.respawnTimer - worldAnimDt);
            if (box.respawnTimer > 0) {
              disabledPadIds.add(box.padId);
              // Smoothly scale back in during the final 0.6s of respawn
              const appearFrac =
                box.respawnTimer < 0.6 ? 1.0 - box.respawnTimer / 0.6 : 0.0;
              if (appearFrac <= 0.02) {
                box.itemGroup.visible = false;
                box.holoBoxGroup.visible = false;
              } else {
                box.itemGroup.visible = true;
                box.holoBoxGroup.visible = true;
                box.itemGroup.scale.setScalar(appearFrac * baseItemScale);
                box.holoBoxGroup.scale.setScalar(appearFrac);
              }
            } else {
              box.itemGroup.visible = true;
              box.holoBoxGroup.visible = true;
              box.itemGroup.scale.setScalar(baseItemScale);
              box.holoBoxGroup.scale.setScalar(1);
            }
          }
        }
        for (let i = 0; i < currentWorld.animatedRings.length; i++) {
          currentWorld.animatedRings[i].rotation.z += worldAnimDt * (i % 2 === 0 ? 0.85 : -0.85);
        }
        if (currentWorld.aerialTraffic) {
          const { mesh, items } = currentWorld.aerialTraffic;
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const angle = it.phase + timeSec * it.speed * it.dir;
            const tx = it.cx + Math.cos(angle) * it.radiusX;
            const tz = it.cz + Math.sin(angle) * it.radiusZ;
            const dx = -Math.sin(angle) * it.radiusX * it.dir;
            const dz = Math.cos(angle) * it.radiusZ * it.dir;
            _sparkDummy.position.set(tx, it.y, tz);
            _sparkDummy.rotation.set(0, Math.atan2(dx, dz), 0);
            _sparkDummy.scale.set(1, 1, it.length);
            _sparkDummy.updateMatrix();
            mesh.setMatrixAt(i, _sparkDummy.matrix);
          }
          mesh.instanceMatrix.needsUpdate = true;
        }
      }

      const player = racers.find((r) => r.isPlayer)!;
      let currentIntroPhase: HudTelemetry['introPhase'] = 'racing';
      let currentCountdownVal = -1;
      let currentCountdownProg = 0;

      // Process Keyboard Camera Controls for Exploration Mode, 360° Vehicle Orbit Mode, or Menu-less [P] Pause
      if (!debugMenuOpenRef.current) {
        if (mode === 'explore') {
          const yawInput =
            (keysPressed.has('ArrowLeft') ? 1 : 0) - (keysPressed.has('ArrowRight') ? 1 : 0);
          const pitchInput =
            (keysPressed.has('ArrowUp') ? 1 : 0) - (keysPressed.has('ArrowDown') ? 1 : 0);
          exploreYaw += yawInput * 1.75 * dt;
          explorePitch = THREE.MathUtils.clamp(
            explorePitch + pitchInput * 1.2 * dt,
            -1.42,
            1.45
          );

          const panSpeed = Math.max(28, exploreDistance * 1.3) * dt;
          _camFwdXZ.set(-Math.sin(exploreYaw), 0, -Math.cos(exploreYaw)).normalize();
          _camRight.set(Math.cos(exploreYaw), 0, -Math.sin(exploreYaw)).normalize();

          if (keysPressed.has('KeyW')) exploreTarget.addScaledVector(_camFwdXZ, panSpeed);
          if (keysPressed.has('KeyS')) exploreTarget.addScaledVector(_camFwdXZ, -panSpeed);
          if (keysPressed.has('KeyD')) exploreTarget.addScaledVector(_camRight, panSpeed);
          if (keysPressed.has('KeyA')) exploreTarget.addScaledVector(_camRight, -panSpeed);
          if (keysPressed.has('KeyE')) exploreTarget.y += panSpeed * 0.75;
          if (keysPressed.has('KeyQ')) exploreTarget.y -= panSpeed * 0.75;

          if (keysPressed.has('Equal') || keysPressed.has('NumpadAdd')) {
            exploreDistance = Math.max(2.5, exploreDistance * Math.exp(-1.7 * dt));
          }
          if (
            keysPressed.has('Minus') ||
            keysPressed.has('NumpadSubtract') ||
            keysPressed.has('KeyX')
          ) {
            exploreDistance = Math.min(1850, exploreDistance * Math.exp(1.7 * dt));
          }
        } else if (mode === 'vehicle_orbit' || isCamPaused) {
          if (isCamPaused) {
            const yawInput =
              (keysPressed.has('ArrowLeft') ? 1 : 0) - (keysPressed.has('ArrowRight') ? 1 : 0);
            const pitchInput =
              (keysPressed.has('ArrowUp') ? 1 : 0) - (keysPressed.has('ArrowDown') ? 1 : 0);
            orbitYaw += yawInput * 1.9 * dt;
            orbitPitch = THREE.MathUtils.clamp(
              orbitPitch + pitchInput * 1.2 * dt,
              -0.25,
              1.42
            );
          }

          if (keysPressed.has('Equal') || keysPressed.has('NumpadAdd')) {
            orbitDistance = Math.max(2.5, orbitDistance * Math.exp(-1.7 * dt));
          }
          if (
            keysPressed.has('Minus') ||
            keysPressed.has('NumpadSubtract') ||
            keysPressed.has('KeyX')
          ) {
            orbitDistance = Math.min(95, orbitDistance * Math.exp(1.7 * dt));
          }

          if (isCamPaused) {
            const panSpeed = Math.max(8, orbitDistance * 0.9) * dt;
            if (keysPressed.has('KeyW')) vehiclePanOffset.addScaledVector(_fwd, panSpeed);
            if (keysPressed.has('KeyS')) vehiclePanOffset.addScaledVector(_fwd, -panSpeed);
            if (keysPressed.has('KeyD')) vehiclePanOffset.addScaledVector(_right, panSpeed);
            if (keysPressed.has('KeyA')) vehiclePanOffset.addScaledVector(_right, -panSpeed);
            if (keysPressed.has('KeyE')) vehiclePanOffset.y += panSpeed;
            if (keysPressed.has('KeyQ')) vehiclePanOffset.y -= panSpeed;
            if (keysPressed.has('KeyR')) vehiclePanOffset.set(0, 0, 0);
          }
        }
      }

      if (state === 'title' && mode === 'off') {
        for (let i = 0; i < racers.length; i++) {
          const r = racers[i];
          if (!r.isPlayer) {
            r.speedKmh = 460;
            const dT = ((r.speedKmh / 3.6) * 0.3 * dt) / trackSpec.lengthMeters;
            r.t = 0.012 + (((r.t - 0.012 + dT) % 0.28) + 0.28) % 0.28;
          } else {
            r.t = 0.002;
            r.lateralOffset = 0;
            r.speedKmh = 0;
            r.isBoosting = false;
          }
        }
        updateAllShipTransforms(dt, true);

        sampleTrackFrame(spline, player.t, _pos, _fwd, _right, _up);
        _shipPos
          .copy(_pos)
          .addScaledVector(_right, player.lateralOffset)
          .addScaledVector(_up, 0.72);

        const swayX = Math.sin(now * 0.0007) * 1.1;
        const swayY = Math.cos(now * 0.0009) * 0.35;
        _desiredCamPos
          .copy(_shipPos)
          .addScaledVector(_fwd, -9.2)
          .addScaledVector(_right, swayX)
          .addScaledVector(_up, 3.35 + swayY);
        _desiredCamLook
          .copy(_shipPos)
          .addScaledVector(_fwd, 36)
          .addScaledVector(_up, 2.6);

        const dampFactor = 1 - Math.exp(-5 * dt);
        currentCamPos.lerp(_desiredCamPos, dampFactor);
        currentCamLook.lerp(_desiredCamLook, dampFactor);
        camera.position.copy(currentCamPos);
        camera.lookAt(currentCamLook);
      } else {
        // Active Gameplay or Debug Inspection Modes ('explore' | 'vehicle_orbit' | 'off')
        if (mode !== 'off' && countdownTimer > 0) {
          countdownTimer = 0;
        }

        if (!isMenuPaused && !isCamPaused && state === 'playing') {
          const externalTrigger = actionTriggerRef.current;
          const shiftTappedNow = justPressedShift;
          justPressedShift = false;
          const boostOrSkipInput =
            shiftTappedNow ||
            keysPressed.has('ShiftLeft') ||
            keysPressed.has('ShiftRight') ||
            externalTrigger.boostPulse ||
            justPressedBonus ||
            externalTrigger.useBonus;
          const throttleInput =
            keysPressed.has('ArrowUp') ||
            keysPressed.has('KeyW') ||
            Boolean(externalTrigger.throttleHeld);
          const manualSteerOrDriveInput =
            throttleInput ||
            keysPressed.has('ArrowDown') ||
            keysPressed.has('KeyS') ||
            keysPressed.has('ArrowLeft') ||
            keysPressed.has('KeyA') ||
            keysPressed.has('ArrowRight') ||
            keysPressed.has('KeyD') ||
            externalTrigger.steerDir !== 0 ||
            pointerSteerDir !== 0;

          if (countdownTimer > 0 && manualSteerOrDriveInput) {
            manualDriveSkipTimer += dt;
          } else {
            manualDriveSkipTimer = 0;
          }

          // Trigger Electronic Voice Circuit Introduction at the start of the extended panoramic overview
          if (!introAnnounced && countdownTimer > COUNTDOWN_START_SEC) {
            introAnnounced = true;
            audioEngine.announceCircuitIntro(cfg.trackId);
          }

          // Allow skipping countdown with Shift/Space, or when holding manual steering/throttle input (>0.20s)
          if (
            countdownTimer > 0 &&
            (boostOrSkipInput ||
              manualDriveSkipTimer > 0.20 ||
              (throttleInput && countdownTimer <= 1.2))
          ) {
            const timedThrottleLaunch = throttleInput && countdownTimer <= 1.2;
            countdownTimer = 0;
            manualDriveSkipTimer = 0;
            justPressedBonus = false;
            justPressedShift = false;
            externalTrigger.boostPulse = false;
            externalTrigger.useBonus = false;
            statusBanner = 'ENGAGE // MAXIMUM THRUST!';
            statusBannerTimer = 1.65;
            if (timedThrottleLaunch) {
              player.speedKmh = Math.max(player.speedKmh, 95);
              player.boostTimer = Math.max(player.boostTimer, 0.75);
            } else {
              player.speedKmh = 0;
              player.boostTimer = 0;
              player.isBoosting = false;
            }
            countdownFovKick = 6.0;
            cameraShakeTrauma = 0.25;
            audioEngine.playCountdown(0);
          }

          if (countdownTimer > 0) {
            countdownTimer = Math.max(0, countdownTimer - dt);

            if (countdownTimer > LOCK_START_SEC) {
              currentIntroPhase = 'overview';
              statusBanner = `${trackSpec.name} // ${currentWeather.label}`;
              // During lengthened City panoramic sweep, trigger distant cloud sheet lightning + rolling thunder
              if (isStormActive && !introDistantThunderPlayed && countdownTimer <= 6.8) {
                introDistantThunderPlayed = true;
                distantSheetFlash = 0.88;
                audioEngine.playDistantThunder(0.82);
              }
            } else if (countdownTimer > COUNTDOWN_START_SEC) {
              currentIntroPhase = 'lock';
              if (!preCountdownLockPlayed) {
                preCountdownLockPlayed = true;
                audioEngine.playPreCountdownLock();
              }
              if (isStormActive) {
                // Once camera stabilizes in game view (countdownTimer <= STABILIZED_VIEW_SEC = 4.05s):
                // 1) Deep thunder rumble first (~4.02s)
                if (!preCountdownThunderPlayed && countdownTimer <= STABILIZED_VIEW_SEC) {
                  preCountdownThunderPlayed = true;
                  distantSheetFlash = 1.0;
                  audioEngine.playDistantThunder(1.0);
                }
                // 2) Immediately after (~3.55s), purple lightning bolt tears through the sky before 3-2-1-GO!
                if (!preCountdownLightningPlayed && countdownTimer <= 3.55) {
                  preCountdownLightningPlayed = true;
                  triggerPurpleLightningBolt(1.32, 0.0);
                  countdownFovKick = 5.0;
                }
                statusBanner = preCountdownLightningPlayed
                  ? 'PURPLE LIGHTNING STRIKE // IGNITION ARMED!'
                  : preCountdownThunderPlayed
                  ? 'SUPERCELL OVERHEAD // THUNDER RUMBLE'
                  : 'GRID LOCK // STABILIZING IN STORM VORTEX';
              } else {
                statusBanner = 'GRID LOCK // AWAITING LAUNCH SIGNAL';
              }
            } else {
              currentIntroPhase = 'countdown';
              const scaledCount = (countdownTimer / COUNTDOWN_START_SEC) * 3.0;
              const ceilVal = Math.min(3, Math.max(1, Math.ceil(scaledCount)));
              currentCountdownVal = countdownTimer > 0 ? ceilVal : 0;
              currentCountdownProg = scaledCount - Math.floor(scaledCount);

              if (ceilVal !== lastCountdownInt && ceilVal >= 1 && ceilVal <= 3) {
                lastCountdownInt = ceilVal;
                audioEngine.playCountdown(ceilVal);
                cameraShakeTrauma = Math.max(cameraShakeTrauma, 0.22);
                countdownFovKick = 5.5;
              }
              statusBanner =
                ceilVal === 3
                  ? 'STAGE 03 // TURBINES SPOOLED'
                  : ceilVal === 2
                  ? 'STAGE 02 // PLASMA INJECTION'
                  : ceilVal === 1
                  ? 'STAGE 01 // IGNITION ARMED'
                  : 'ENGAGE // MAXIMUM THRUST!';

              if (countdownTimer === 0) {
                currentIntroPhase = 'racing';
                currentCountdownVal = 0;
                statusBanner = 'ENGAGE // MAXIMUM THRUST!';
                statusBannerTimer = 1.65;
                cameraShakeTrauma = 0.45;
                countdownFovKick = 8.5;
                audioEngine.playCountdown(0);
              }
            }
            // Gentle idle turbine hum during intro & countdown
            audioEngine.updateEngine(
              throttleInput ? 240 : currentIntroPhase === 'countdown' ? 140 : 65,
              false,
              currentWeather.intensity
            );
            updateAllShipTransforms(dt, true);
          } else {
            // Active Race Simulation
            currentIntroPhase = 'racing';
            raceElapsedMs += dt * 1000;

            // Dynamic Evolving Storm Choreography during active racing on the City circuit:
            // First distant cloud lightning -> delayed rolling thunder FX -> then visible purple lightning bolt + thunderclap
            if (isStormActive) {
              if (pendingThunderDelay > 0) {
                pendingThunderDelay -= dt;
                if (pendingThunderDelay <= 0) {
                  pendingThunderDelay = -1;
                  audioEngine.playDistantThunder(0.75 + currentWeather.intensity * 0.35);
                }
              }
              nextStormEventTimer -= dt;
              if (nextStormEventTimer <= 0) {
                const phase = currentWeather.stormPhase ?? 'monsoon_squall';
                if (
                  phase === 'distant_lightning' ||
                  (phase === 'gathering_clouds' && Math.random() < 0.7)
                ) {
                  // Distant sheet lightning in the storm clouds first, followed by delayed thunder
                  distantSheetFlash = Math.max(distantSheetFlash, 0.85);
                  pendingThunderDelay = 0.65 + Math.random() * 0.55;
                  nextStormEventTimer = 4.2 + Math.random() * 3.0;
                } else {
                  // Distant warning flash first or direct forked purple lightning strike tearing through the sky
                  const panX = (Math.random() - 0.5) * 0.28;
                  triggerPurpleLightningBolt(
                    0.95 + currentWeather.intensity * 0.32,
                    panX
                  );
                  nextStormEventTimer = 5.6 + Math.random() * 4.2;
                }
              }
            }

            if (statusBannerTimer > 0) {
              statusBannerTimer = Math.max(0, statusBannerTimer - dt);
              if (statusBannerTimer === 0) {
                statusBanner = '';
              }
            }

            if (hitstopTimer > 0) {
              hitstopTimer = Math.max(0, hitstopTimer - dt);
            }

            const simDt = hitstopTimer > 0 ? dt * 0.15 : dt;

            // Gather Player Input (only use AI Auto-Pilot when in Demo Mode or 'explore' free-cam mode)
            const externalTrigger = actionTriggerRef.current;
            const useBonusNow = justPressedBonus || externalTrigger.useBonus;
            justPressedBonus = false;
            externalTrigger.useBonus = false;
            const useWeaponNow = justPressedWeapon || externalTrigger.useWeapon;
            justPressedWeapon = false;
            externalTrigger.useWeapon = false;
            const hasManualDriveInput =
              keysPressed.has('ArrowUp') ||
              keysPressed.has('ArrowDown') ||
              keysPressed.has('ArrowLeft') ||
              keysPressed.has('ArrowRight') ||
              keysPressed.has('KeyW') ||
              keysPressed.has('KeyA') ||
              keysPressed.has('KeyS') ||
              keysPressed.has('KeyD') ||
              externalTrigger.steerDir !== 0 ||
              Boolean(externalTrigger.throttleHeld) ||
              Boolean(externalTrigger.brakeHeld);

            if (demoModeRef.current && hasManualDriveInput) {
              demoModeRef.current = false;
              callbacksRef.current.onTakeControl?.();
            }
            const isDemo = demoModeRef.current;

            const playerInput =
              isDemo || mode === 'explore'
                ? (() => {
                    const auto = computeAiInput(
                      player,
                      0,
                      isDemo ? { ...cfg, aiDifficulty: 'apex' } : cfg,
                      pads,
                      player.totalProgress,
                      racers,
                      disabledPadIds
                    );
                    return auto;
                  })()
                : (() => {
                    const isBraking =
                      keysPressed.has('ArrowDown') ||
                      keysPressed.has('KeyS') ||
                      Boolean(externalTrigger.brakeHeld);
                    const isSteerLeft =
                      keysPressed.has('ArrowLeft') ||
                      keysPressed.has('KeyA') ||
                      externalTrigger.steerDir < 0 ||
                      pointerSteerDir < 0;
                    const isSteerRight =
                      keysPressed.has('ArrowRight') ||
                      keysPressed.has('KeyD') ||
                      externalTrigger.steerDir > 0 ||
                      pointerSteerDir > 0;
                    const isAirbrakeLeft = keysPressed.has('KeyQ');
                    const isAirbrakeRight = keysPressed.has('KeyE');
                    const hasActiveSteerInput =
                      isSteerLeft || isSteerRight || isAirbrakeLeft || isAirbrakeRight;
                    return {
                      throttle:
                        keysPressed.has('ArrowUp') ||
                        keysPressed.has('KeyW') ||
                        Boolean(externalTrigger.throttleHeld) ||
                        externalTrigger.boostPulse ||
                        (!isBraking && hasActiveSteerInput),
                      brake: isBraking,
                      steerLeft: isSteerLeft,
                      steerRight: isSteerRight,
                      airbrakeLeft: isAirbrakeLeft,
                      airbrakeRight: isAirbrakeRight,
                      boostHeld:
                        shiftTappedNow ||
                        keysPressed.has('ShiftLeft') ||
                        keysPressed.has('ShiftRight') ||
                        externalTrigger.boostPulse,
                      useBonusPressed: useBonusNow,
                      useWeaponPressed: useWeaponNow,
                    };
                  })();

            const prevPlayerT = player.t;
            const prevBoosting = wasPlayerBoosting;
            if (wallScrapeSparkCooldown > 0) {
              wallScrapeSparkCooldown = Math.max(0, wallScrapeSparkCooldown - simDt);
            }

            // Step Player with Dynamic Weather Friction, Upgrades & On-Track Power-Up / Weapon Boxes
            const pRes = stepRacerPhysics(
              player,
              playerInput,
              simDt,
              trackSpec.lengthMeters,
              trackSpec.totalLaps,
              cfg,
              pads,
              rings,
              raceElapsedMs,
              currentWeather,
              upgradesRef.current,
              disabledPadIds
            );

            // Trigger turbine ignition screen-shake punch when engaging manual/pad boost
            if (!prevBoosting && player.isBoosting) {
              const boostSpeedFactor = THREE.MathUtils.clamp(player.speedKmh / 900, 0.5, 1.35);
              cameraShakeTrauma = Math.min(1, cameraShakeTrauma + 0.34 * boostSpeedFactor);
            }
            wasPlayerBoosting = player.isBoosting;

            // In Demo Mode or debug inspection modes, prevent player destruction & loop laps
            if (isDemo || mode !== 'off') {
              if (player.isDestroyed || player.energy <= 15) {
                player.isDestroyed = false;
                player.energy = 100;
                pRes.exploded = false;
              }
              if (pRes.raceFinished) {
                player.finished = false;
                player.lap = 1;
                player.totalProgress = player.t;
                pRes.raceFinished = false;
                statusBanner = 'DEMO MODE // CONTINUOUS AUTOPILOT CIRCUIT';
                statusBannerTimer = 2.0;
              }
            }

            if (cfg.trackId === 'lava' || cfg.trackId === 'lava_v2') {
              if (prevPlayerT < 0.15 && player.t >= 0.15) {
                statusBanner = 'CALDERA PARABOLICA // HIGH-G BANK';
                statusBannerTimer = 1.6;
              } else if (prevPlayerT < 0.348 && player.t >= 0.348) {
                statusBanner = 'VOLCANO CORE TUNNEL // MAGMA CHAMBER';
                statusBannerTimer = 1.8;
              }
            }

            if (player.speedKmh > topSpeedRecorded) {
              topSpeedRecorded = player.speedKmh;
            }

            // Handle 3D Army / Weapon Box Collection by Player (10-second respawn)
            if (pRes.collectedWeapon && pRes.collectedPadId !== null) {
              powerUpsCollectedCount++;
              disabledPadIds.add(pRes.collectedPadId);
              if (currentWorld) {
                const box = currentWorld.powerUpBoxes.find((b) => b.padId === pRes.collectedPadId);
                if (box) {
                  box.respawnTimer = BONUS_RESPAWN_SECONDS;
                  box.itemGroup.visible = false;
                  box.holoBoxGroup.visible = false;
                  spawnCollisionSparks(box.holderGroup.position, 14);
                }
              }
              const wMeta = WEAPON_META[pRes.collectedWeapon];
              statusBanner = `ARMED: ${wMeta.label} // PRESS [Z] TO FIRE`;
              statusBannerTimer = 1.8;
              audioEngine.playBonusPickup('weapon');
            }

            // Handle Player Firing Held Weapon [Z]
            if (pRes.firedWeapon) {
              const wMeta = WEAPON_META[pRes.firedWeapon];
              statusBanner = `${wMeta.shortLabel} DEPLOYED!`;
              statusBannerTimer = 1.6;
              cameraShakeTrauma = Math.min(1, cameraShakeTrauma + 0.45);
              audioEngine.playWeaponFire(pRes.firedWeapon);
            }

            // Handle 3D In-Game Power-Up Box Collection by Player (10-second respawn; Fixed Speed Boosts never despawn)
            if (pRes.collectedPowerUp && pRes.collectedPadId !== null) {
              powerUpsCollectedCount++;
              disabledPadIds.add(pRes.collectedPadId);
              if (currentWorld) {
                const box = currentWorld.powerUpBoxes.find((b) => b.padId === pRes.collectedPadId);
                if (box) {
                  box.respawnTimer = BONUS_RESPAWN_SECONDS;
                  box.itemGroup.visible = false;
                  box.holoBoxGroup.visible = false;
                  spawnCollisionSparks(box.holderGroup.position, 14);
                }
              }

              const pMeta = POWERUP_META[pRes.collectedPowerUp];
              statusBanner = `${pMeta.label} // ${pMeta.effectBadge}`;
              statusBannerTimer = 1.5;

              if (pRes.collectedPowerUp === 'credit') {
                callbacksRef.current.onEarnCredits(150);
              }
              audioEngine.playBonusPickup(pRes.collectedPowerUp);
            }

            if (pRes.hitBoostPad) {
              boostPadsHitCount++;
              const combo = pRes.boostComboCount ?? player.boostComboCount ?? 1;
              const comboVelocityBonus = 235 + (combo - 1) * 45;
              statusBanner =
                combo > 1
                  ? `BOOST CHAIN x${combo} // +${comboVelocityBonus} KM/H COMBO SURGE!`
                  : `BOOST CHAIN x1 // +${comboVelocityBonus} KM/H VELOCITY SURGE`;
              statusBannerTimer = 1.65;
              cameraShakeTrauma = Math.min(1, cameraShakeTrauma + 0.38 + Math.min(0.3, combo * 0.06));
              audioEngine.playBoostPad(combo);
            } else if (!pRes.collectedWeapon && !pRes.collectedPowerUp && pRes.hitRechargePad) {
              statusBanner = 'REPAIR POWER-UP // HULL +40%';
              statusBannerTimer = 1.1;
              audioEngine.playBonusPickup('repair');
            }

            if (pRes.passedRing) {
              ringsPassedCount++;
              statusBanner = `RING CHAIN x${player.ringChain} // +${player.ringChain * 28} KM/H`;
              statusBannerTimer = 1.3;
              if (pRes.passedRing === 'orange') {
                cameraShakeTrauma = Math.min(1, cameraShakeTrauma + 0.28);
              }
              audioEngine.playRingPass(player.ringChain, pRes.passedRing === 'orange');
            }
            if (pRes.collectedBonus && !pRes.collectedPowerUp) {
              statusBanner = `ARMED: ${BONUS_META[pRes.collectedBonus].label}`;
              statusBannerTimer = 1.5;
            }
            if (pRes.activatedBonus) {
              statusBanner = `${BONUS_META[pRes.activatedBonus].label} ENGAGED!`;
              statusBannerTimer = 1.8;
              cameraShakeTrauma = Math.min(1, cameraShakeTrauma + 0.65);
              hitstopTimer = 0.04;
              audioEngine.playBonusActivate();

              if (pRes.activatedBonus === 'credit') {
                callbacksRef.current.onEarnCredits(200);
              } else if (pRes.activatedBonus === 'emp_blast') {
                for (const r of racers) {
                  if (!r.isPlayer && r.shieldTimer <= 0) {
                    r.empSlowTimer = 4.2;
                    r.speedKmh *= 0.65;
                  }
                }
              }
            }
            if (pRes.wallCollision) {
              const wallImpactFactor = THREE.MathUtils.clamp(player.speedKmh / 850, 0.45, 1.45);
              cameraShakeTrauma = Math.min(1, cameraShakeTrauma + 0.42 * wallImpactFactor);
              if (wallScrapeSparkCooldown <= 0) {
                wallScrapeSparkCooldown = 0.09;
                sampleTrackFrame(spline, player.t, _pos, _fwd, _right, _up);
                _collisionOrigin
                  .copy(_pos)
                  .addScaledVector(_right, player.lateralOffset + Math.sign(player.lateralOffset) * 1.25)
                  .addScaledVector(_up, 0.65);
                spawnCollisionSparks(_collisionOrigin, 8);
              }
              if (player.shieldTimer <= 0 && !player.isDestroyed) {
                statusBanner =
                  player.energy <= 25
                    ? `CRITICAL HULL ENERGY (${Math.round(player.energy)}%) // GUARDRAIL IMPACT!`
                    : `GUARDRAIL IMPACT // HULL ENERGY ${Math.round(player.energy)}%`;
                statusBannerTimer = 1.1;
              }
              audioEngine.playWallHit();
            }
            if (pRes.completedLap) {
              audioEngine.playLapComplete(pRes.raceFinished);
              if (!pRes.raceFinished) {
                statusBanner = `LAP ${player.lap} / ${trackSpec.totalLaps}`;
                statusBannerTimer = 1.8;
              }
            }

            // Step AI Racers with Dynamic Weather & Rival Awareness
            // CRITICAL: Skip `r.isPlayer` (`racers[3]`) so the player is NEVER stepped a second time by AI!
            const stepResults: StepRacerResult[] = new Array(racers.length);
            for (let i = 0; i < racers.length; i++) {
              const r = racers[i];
              if (r.isPlayer) {
                stepResults[i] = pRes;
                continue;
              }
              // Respawn destroyed AI craft after 3.2s so the circuit stays lively
              if (r.isDestroyed && r.destroyedTimer >= 3.2) {
                r.isDestroyed = false;
                r.destroyedTimer = 0;
                r.energy = 100;
                r.shieldTimer = 2.5;
                r.speedKmh = 360;
                explodedRacerIds.delete(r.id);
              }
              const aiInput = computeAiInput(
                r,
                i,
                cfg,
                pads,
                player.totalProgress,
                racers,
                disabledPadIds
              );
              const aiRes = stepRacerPhysics(
                r,
                aiInput,
                simDt,
                trackSpec.lengthMeters,
                trackSpec.totalLaps,
                cfg,
                pads,
                rings,
                raceElapsedMs,
                currentWeather,
                undefined,
                disabledPadIds
              );
              stepResults[i] = aiRes;

              // When an opponent in front of us takes a bonus/weapon square, it disappears and respawns after 10.0 seconds!
              if (aiRes.collectedPadId !== null && currentWorld) {
                disabledPadIds.add(aiRes.collectedPadId);
                const box = currentWorld.powerUpBoxes.find((b) => b.padId === aiRes.collectedPadId);
                if (box) {
                  box.respawnTimer = BONUS_RESPAWN_SECONDS;
                  box.itemGroup.visible = false;
                  box.holoBoxGroup.visible = false;
                }
              }
              if (aiRes.exploded) {
                triggerVehicleExplosion3D(r);
              }
              if ((isDemo || mode !== 'off') && r.finished) {
                r.finished = false;
                r.lap = 1;
                r.totalProgress = r.t;
              }
            }

            // Step Army / Weapon Combat System (Missiles, Laser, Shockwave, Mines)
            const newlyFired: Array<{ attackerId: string; weapon: ActiveWeaponId }> = [];
            for (let i = 0; i < racers.length; i++) {
              const fw = stepResults[i]?.firedWeapon;
              if (fw) {
                newlyFired.push({ attackerId: racers[i].id, weapon: fw });
              }
            }

            const combatEvents = stepWeaponCombat(
              racers,
              activeMissiles,
              activeMines,
              newlyFired,
              simDt,
              trackSpec.lengthMeters
            );
            // Prune inactive missiles and mines so 3D mesh pools only render active ordnance
            activeMissiles = activeMissiles.filter((m) => m.active);
            activeMines = activeMines.filter((m) => m.active);

            for (let eIdx = 0; eIdx < combatEvents.length; eIdx++) {
              const cev = combatEvents[eIdx];
              sampleTrackFrame(spline, cev.t, _pos, _fwd, _right, _up);
              _collisionOrigin
                .copy(_pos)
                .addScaledVector(_right, cev.lateralOffset)
                .addScaledVector(_up, 0.85);
              spawnCollisionSparks(_collisionOrigin, 18);

              const isShieldedEvent =
                cev.type === 'missile_shielded' ||
                cev.type === 'laser_shielded' ||
                cev.type === 'shockwave_shielded' ||
                cev.type === 'mine_shielded';
              const isHitEvent =
                cev.type === 'missile_hit' ||
                cev.type === 'laser_hit' ||
                cev.type === 'shockwave_hit' ||
                cev.type === 'mine_hit';

              if (cev.type === 'vehicle_exploded') {
                const targetRacer = racers.find((r) => r.id === cev.targetId);
                if (targetRacer) {
                  triggerVehicleExplosion3D(targetRacer);
                  if (!targetRacer.isPlayer) {
                    statusBanner = `TARGET DESTROYED // ${targetRacer.name} EXPLODED!`;
                    statusBannerTimer = 2.0;
                  }
                }
              } else if (isShieldedEvent) {
                if (cev.targetId === 'player' || cev.attackerId === 'player') {
                  audioEngine.playShieldDeflect();
                  statusBanner =
                    cev.targetId === 'player'
                      ? `SHIELD BLOCKED ${WEAPON_META[cev.weapon].shortLabel}!`
                      : `${cev.targetName} SHIELD BLOCKED ${WEAPON_META[cev.weapon].shortLabel}`;
                  statusBannerTimer = 1.4;
                }
              } else if (isHitEvent) {
                if (cev.targetId === 'player') {
                  audioEngine.playWeaponHit();
                  cameraShakeTrauma = Math.min(1, cameraShakeTrauma + 0.65);
                  statusBanner = `WARNING: HIT BY ${WEAPON_META[cev.weapon].shortLabel} // HULL ${Math.round(player.energy)}%`;
                  statusBannerTimer = 1.65;
                } else if (cev.attackerId === 'player') {
                  audioEngine.playWeaponHit();
                  statusBanner = `${WEAPON_META[cev.weapon].shortLabel} HIT // ${cev.targetName}`;
                  statusBannerTimer = 1.5;
                }
              }
            }

            // Resolve Vehicle-to-Vehicle Collisions across all 6 craft
            const collisionEvents = resolveRacerCollisions(racers, trackSpec.lengthMeters);
            for (let c = 0; c < collisionEvents.length; c++) {
              const ev = collisionEvents[c];
              sampleTrackFrame(spline, ev.contactT, _pos, _fwd, _right, _up);
              _collisionOrigin
                .copy(_pos)
                .addScaledVector(_right, ev.contactLateral)
                .addScaledVector(_up, 0.75);
              spawnCollisionSparks(_collisionOrigin, 14);

              if (ev.involvesPlayer) {
                cameraShakeTrauma = Math.min(1, cameraShakeTrauma + 0.42 * ev.impactIntensity);
                audioEngine.playVehicleCollision(ev.impactIntensity);
                statusBanner = ev.playerShielded
                  ? `HEX SHIELD DEFLECT // ${ev.rivalName}`
                  : `HULL CONTACT // ${ev.rivalName} (-ENERGY)`;
                statusBannerTimer = 1.25;
              }
            }

            // Check if any racer reached 0 energy from guardrail/collision this frame
            for (let i = 0; i < racers.length; i++) {
              if (racers[i].isDestroyed) {
                triggerVehicleExplosion3D(racers[i]);
              }
            }

            // Update 3D Homing Missile Meshes in Scene
            for (let m = 0; m < MISSILE_POOL_SIZE; m++) {
              const meshGroup = missileMeshes[m];
              if (m < activeMissiles.length) {
                const ms = activeMissiles[m];
                sampleTrackFrame(spline, ms.t, _pos, _fwd, _right, _up);
                meshGroup.position
                  .copy(_pos)
                  .addScaledVector(_right, ms.lateralOffset)
                  .addScaledVector(_up, 0.85);
                _lookTarget.copy(meshGroup.position).add(_fwd);
                meshGroup.lookAt(_lookTarget);
                meshGroup.rotateZ(timeSec * 10);
                meshGroup.visible = true;
              } else {
                meshGroup.visible = false;
              }
            }

            // Update 3D Proximity Mine Meshes on Track
            for (let m = 0; m < MINE_POOL_SIZE; m++) {
              const meshGroup = mineMeshes[m];
              if (m < activeMines.length) {
                const mn = activeMines[m];
                sampleTrackFrame(spline, mn.t, _pos, _fwd, _right, _up);
                meshGroup.position
                  .copy(_pos)
                  .addScaledVector(_right, mn.lateralOffset)
                  .addScaledVector(_up, 0.32 + Math.sin(timeSec * 6 + mn.id) * 0.08);
                _lookTarget.copy(meshGroup.position).add(_fwd);
                meshGroup.lookAt(_lookTarget);
                meshGroup.rotation.y += simDt * 2.5;
                const pulse = 1.0 + Math.sin(timeSec * 14 + mn.id) * 0.14;
                meshGroup.scale.setScalar(pulse);
                meshGroup.visible = true;
              } else {
                meshGroup.visible = false;
              }
            }

            // Update 3D Vehicle Explosion Fireballs & Flying Debris
            for (let eIdx = 0; eIdx < explosionPool.length; eIdx++) {
              const ex = explosionPool[eIdx];
              if (!ex.active) continue;
              ex.timer += simDt;
              if (ex.timer >= ex.maxTimer) {
                ex.active = false;
                ex.group.visible = false;
                continue;
              }
              const prog = ex.timer / ex.maxTimer;
              const fireballScale = 0.8 + Math.pow(prog, 0.55) * 8.5;
              ex.fireball.scale.setScalar(fireballScale);
              (ex.fireball.material as THREE.MeshBasicMaterial).opacity = Math.max(
                0,
                (1 - prog) * 0.92
              );

              const ringScale = 1.0 + prog * 18.0;
              ex.shockRing.scale.setScalar(ringScale);
              (ex.shockRing.material as THREE.MeshBasicMaterial).opacity = Math.max(
                0,
                (1 - prog) * 0.88
              );

              for (let c = 0; c < ex.debrisChunks.length; c++) {
                const ch = ex.debrisChunks[c];
                ch.mesh.position.x += ch.vx * simDt;
                ch.mesh.position.y += ch.vy * simDt;
                ch.mesh.position.z += ch.vz * simDt;
                ch.vy -= 18.0 * simDt;
                ch.mesh.rotation.x += ch.rx * simDt;
                ch.mesh.rotation.y += ch.ry * simDt;
                ch.mesh.scale.setScalar(Math.max(0.05, 1 - prog * 0.85));
              }
            }

            audioEngine.updateEngine(
              player.isDestroyed ? 0 : player.speedKmh,
              player.isBoosting && !player.isDestroyed,
              currentWeather.intensity
            );
            updateAllShipTransforms(dt, true);

            // Handle Player Vehicle Explosion -> Game Over transition
            if (player.isDestroyed && mode === 'off' && !isDemo) {
              statusBanner = 'HULL ENERGY DEPLETED // VEHICLE EXPLODED!';
              statusBannerTimer = 2.0;
              playerExplosionTimer += dt;
              if (!playerExplosionHandled && playerExplosionTimer >= 1.45) {
                playerExplosionHandled = true;
                const standings = calculateStandings(racers);
                const finalPos = standings.findIndex((r) => r.isPlayer) + 1;
                audioEngine.stopEngine();
                callbacksRef.current.onRaceFinish({
                  victory: false,
                  reason: 'energy_depleted',
                  finalPosition: finalPos,
                  totalRacers: racers.length,
                  totalTimeMs: raceElapsedMs,
                  bestLapMs: player.bestLapMs,
                  topSpeedKmh: Math.round(topSpeedRecorded),
                  ringsPassed: ringsPassedCount,
                  boostPadsHit: boostPadsHitCount,
                  powerUpsCollected: powerUpsCollectedCount,
                  creditsEarned: player.creditsEarned,
                  crystalPoints: player.crystalPoints,
                  trackName: trackSpec.name,
                  shipName: SHIP_SPECS[player.shipId].name,
                });
              }
            } else if (pRes.raceFinished && mode === 'off' && !isDemo) {
              const standings = calculateStandings(racers);
              const finalPos = standings.findIndex((r) => r.isPlayer) + 1;
              audioEngine.stopEngine();
              callbacksRef.current.onRaceFinish({
                victory: finalPos <= 3,
                reason: 'finished',
                finalPosition: finalPos,
                totalRacers: racers.length,
                totalTimeMs: player.finishTimeMs,
                bestLapMs: player.bestLapMs,
                topSpeedKmh: Math.round(topSpeedRecorded),
                ringsPassed: ringsPassedCount,
                boostPadsHit: boostPadsHitCount,
                powerUpsCollected: powerUpsCollectedCount,
                creditsEarned: player.creditsEarned,
                crystalPoints: player.crystalPoints,
                trackName: trackSpec.name,
                shipName: SHIP_SPECS[player.shipId].name,
              });
            }
          }
        } else {
          // Simulation Frozen (either via P camera-pause or modal pause)
          audioEngine.updateEngine(0, false, 0);
          updateAllShipTransforms(0, false);
        }

        // Camera Controller Dispatch:
        // 1) 'explore' mode: Free 3D Environment Camera (Orbit + Pan + Zoom)
        // 2) 'vehicle_orbit' mode OR Menu-less [P] Pause: 360° Vehicle-Anchored Orbit & Zoom Camera
        // 3) 'off' mode: Standard Panoramic Intro -> Descent -> Chase/Close/Cockpit Camera
        sampleTrackFrame(spline, player.t, _pos, _fwd, _right, _up);
        _shipPos
          .copy(_pos)
          .addScaledVector(_right, player.lateralOffset)
          .addScaledVector(_up, 0.72);

        if (mode === 'explore') {
          statusBanner = isCamPaused
            ? 'EXPLORATION PAUSED [P] // CAMERA & ZOOM ACTIVE'
            : 'EXPLORATION MODE // ORBIT · PAN · ZOOM';
          const cosP = Math.cos(explorePitch);
          const sinP = Math.sin(explorePitch);
          _desiredCamPos.set(
            exploreTarget.x + Math.sin(exploreYaw) * cosP * exploreDistance,
            exploreTarget.y + sinP * exploreDistance,
            exploreTarget.z + Math.cos(exploreYaw) * cosP * exploreDistance
          );
          _desiredCamLook.copy(exploreTarget);

          const camLerp = 1 - Math.exp(-16 * dt);
          currentCamPos.lerp(_desiredCamPos, camLerp);
          currentCamLook.lerp(_desiredCamLook, camLerp);
          camera.position.copy(currentCamPos);
          camera.lookAt(currentCamLook);

          if (Math.abs(camera.fov - cfg.fov) > 0.1) {
            camera.fov += (cfg.fov - camera.fov) * (1 - Math.exp(-10 * dt));
            camera.updateProjectionMatrix();
          }
        } else if (mode === 'vehicle_orbit' || isCamPaused) {
          statusBanner = isCamPaused
            ? 'CAMERA PAUSE [P] // DRAG/ARROWS TO ORBIT · SCROLL/+/- TO ZOOM'
            : '360° VEHICLE ORBIT // DRAG/ARROWS TO ROTATE · [P] TO PAUSE';
          const cosP = Math.cos(orbitPitch);
          const sinP = Math.sin(orbitPitch);
          const backOffset = -Math.cos(orbitYaw) * cosP * orbitDistance;
          const sideOffset = Math.sin(orbitYaw) * cosP * orbitDistance;
          const upOffset = Math.max(0.35, sinP * orbitDistance + 1.05);

          smoothedCamLateral += (player.lateralOffset - smoothedCamLateral) * (1 - Math.exp(-14 * dt));
          const orbitAnchorLat = isCamPaused ? player.lateralOffset : smoothedCamLateral * 0.25;
          _desiredCamLook
            .copy(_pos)
            .addScaledVector(_right, orbitAnchorLat)
            .addScaledVector(_up, 0.72 + 0.9)
            .add(vehiclePanOffset);
          _desiredCamPos
            .copy(_pos)
            .addScaledVector(_right, orbitAnchorLat + sideOffset)
            .addScaledVector(_fwd, backOffset)
            .addScaledVector(_up, 0.72 + upOffset)
            .add(vehiclePanOffset);

          const camLerp = 1 - Math.exp(-18 * dt);
          currentCamPos.lerp(_desiredCamPos, camLerp);
          currentCamLook.lerp(_desiredCamLook, dampClamp(camLerp));
          camera.position.copy(currentCamPos);
          camera.lookAt(currentCamLook);

          if (Math.abs(camera.fov - cfg.fov) > 0.1) {
            camera.fov += (cfg.fov - camera.fov) * (1 - Math.exp(-10 * dt));
            camera.updateProjectionMatrix();
          }
        } else {
          // Selectable Camera Rig Modes:
          // - 'perspective' (Default): High-perspective distant vantage point (~19.5m behind, ~6.8m above, looking down at +6.5m/+0.65m)
          //   matching the reference screenshot so the craft sits compactly in the center of the roadway with full 4-lane perspective depth.
          // - 'chase': Medium chase camera (~13.5m behind, ~4.55m above)
          // - 'close': Low close-up thruster view (~8.5m behind, ~3.05m above)
          // - 'cockpit': First-person nose view (+0.6m ahead, +1.15m above)
          const camDist =
            cfg.cameraMode === 'cockpit'
              ? 0.6
              : cfg.cameraMode === 'close'
              ? -8.5
              : cfg.cameraMode === 'chase'
              ? -13.5
              : -19.5;
          const camHeight =
            cfg.cameraMode === 'cockpit'
              ? 1.15
              : cfg.cameraMode === 'close'
              ? 3.05
              : cfg.cameraMode === 'chase'
              ? 4.55
              : 6.8;
          const lookDist =
            cfg.cameraMode === 'cockpit'
              ? 48.0
              : cfg.cameraMode === 'close'
              ? 14.0
              : cfg.cameraMode === 'chase'
              ? 4.0
              : 6.5;
          const lookHeight =
            cfg.cameraMode === 'cockpit'
              ? 1.85
              : cfg.cameraMode === 'close'
              ? 1.45
              : cfg.cameraMode === 'chase'
              ? 0.95
              : 0.65;

          const playerSpec = SHIP_SPECS[player.shipId];
          const speedRatioFov = THREE.MathUtils.clamp(
            player.speedKmh / Math.max(1, playerSpec.maxSpeedKmh),
            0,
            1.45
          );

          // Subtle Camera Sway Following Vehicle's Drift Angle During High-Speed Maneuvers:
          // Follows player.yawOffset (drift angle) and lateral slip velocity scaled by high-speed factor
          const driftAngle =
            player.yawOffset -
            THREE.MathUtils.clamp(player.lateralVelocity * 0.0065, -0.22, 0.22);
          const highSpeedFactor =
            THREE.MathUtils.smoothstep(speedRatioFov, 0.15, 0.92) *
            (player.isBoosting ? 1.15 : 1.0);
          const targetDriftSwayLat = THREE.MathUtils.clamp(
            -Math.sin(driftAngle) * 0.45 * highSpeedFactor,
            -0.42,
            0.42
          );
          const targetDriftLookYaw = THREE.MathUtils.clamp(
            Math.sin(driftAngle) * 0.35 * highSpeedFactor,
            -0.32,
            0.32
          );
          const targetDriftRoll = THREE.MathUtils.clamp(
            -driftAngle * 0.075 * highSpeedFactor,
            -0.045,
            0.045
          );

          const swayLerp = 1 - Math.exp(-9.5 * dt);
          smoothedDriftSwayLat += (targetDriftSwayLat - smoothedDriftSwayLat) * swayLerp;
          smoothedDriftLookYaw += (targetDriftLookYaw - smoothedDriftLookYaw) * swayLerp;
          smoothedDriftRoll += (targetDriftRoll - smoothedDriftRoll) * swayLerp;

          // Keep the camera softly following the ship's lateral position (0.14..0.22 lateral follow)
          // so the entire roadway (guardrail to guardrail) stays framed steadily while the player's
          // ship visually glides and drifts smoothly from the left guardrail to the right guardrail!
          const basisLerp = 1 - Math.exp(-16 * dt);
          smoothedCamFwd.lerp(_fwd, basisLerp).normalize();
          smoothedCamRight.lerp(_right, basisLerp).normalize();
          smoothedCamUp.lerp(_up, basisLerp).normalize();
          smoothedCamLateral += (player.lateralOffset - smoothedCamLateral) * (1 - Math.exp(-15 * dt));

          const isCockpitCam = cfg.cameraMode === 'cockpit';
          const lateralFollowFactor = cfg.cameraMode === 'perspective' ? 0.14 : 0.22;
          const camPosLateral = isCockpitCam
            ? smoothedCamLateral
            : THREE.MathUtils.clamp(
                smoothedCamLateral * lateralFollowFactor + smoothedDriftSwayLat,
                -9.5,
                9.5
              );
          const camLookLateral = isCockpitCam
            ? smoothedCamLateral - Math.sin(player.yawOffset) * 10.0
            : THREE.MathUtils.clamp(
                smoothedCamLateral * (lateralFollowFactor + 0.08) - smoothedDriftLookYaw,
                -10.5,
                10.5
              );

          document.body.dataset.playerLateral = player.lateralOffset.toFixed(2);
          document.body.dataset.playerSpeed = player.speedKmh.toFixed(1);
          document.body.dataset.camDriftSway = smoothedDriftSwayLat.toFixed(4);

          _chasePos
            .copy(_pos)
            .addScaledVector(_right, camPosLateral)
            .addScaledVector(smoothedCamUp, 0.72 + camHeight)
            .addScaledVector(smoothedCamFwd, camDist);

          _chaseLook
            .copy(_pos)
            .addScaledVector(_right, camLookLateral)
            .addScaledVector(smoothedCamUp, 0.72 + lookHeight)
            .addScaledVector(smoothedCamFwd, lookDist);

          if (countdownTimer > LOCK_START_SEC) {
            // Phase 1: Lengthened Panoramic Aerial Sweep across the circuit & storm skyline
            const panT = THREE.MathUtils.clamp(
              (INTRO_TOTAL_SEC - countdownTimer) / (INTRO_TOTAL_SEC - LOCK_START_SEC),
              0,
              1
            );
            const smoothPan = panT * panT * (3 - 2 * panT);
            const orbitAngle = (1 - smoothPan) * 1.28 - 0.25;

            _overviewPos
              .copy(_shipPos)
              .addScaledVector(_fwd, 72 * (1 - smoothPan * 0.48))
              .addScaledVector(_right, Math.sin(orbitAngle) * -46)
              .addScaledVector(_up, 56 - smoothPan * 18);

            _overviewLook
              .copy(_shipPos)
              .addScaledVector(_fwd, 95 - smoothPan * 32)
              .addScaledVector(_right, Math.cos(orbitAngle) * 18)
              .addScaledVector(_up, 18 - smoothPan * 6);

            currentCamPos.copy(_overviewPos);
            currentCamLook.copy(_overviewLook);
          } else if (countdownTimer > STABILIZED_VIEW_SEC) {
            // Phase 2a: Swoop from Panoramic Vista into Stabilized Game View
            const swoopSpan = Math.max(0.1, LOCK_START_SEC - STABILIZED_VIEW_SEC);
            const lockT = THREE.MathUtils.clamp(
              (LOCK_START_SEC - countdownTimer) / swoopSpan,
              0,
              1
            );
            const ease = lockT * lockT * (3 - 2 * lockT);
            const startAngle = -0.25;

            _overviewPos
              .copy(_shipPos)
              .addScaledVector(_fwd, 37.4 * (1 - ease) + camDist * ease)
              .addScaledVector(_right, Math.sin(startAngle) * -46 * (1 - ease) + camPosLateral * ease)
              .addScaledVector(_up, 38 * (1 - ease) + (0.72 + camHeight) * ease);

            _overviewLook
              .copy(_shipPos)
              .addScaledVector(_fwd, 63 * (1 - ease) + lookDist * ease)
              .addScaledVector(_right, Math.cos(startAngle) * 18 * (1 - ease) + camLookLateral * ease)
              .addScaledVector(_up, 12 * (1 - ease) + (0.72 + lookHeight) * ease);

            currentCamPos.copy(_overviewPos);
            currentCamLook.copy(_overviewLook);
          } else {
            // Phase 2b (Stabilized in Game View for Thunder + Purple Lightning Bolt) & Phase 3 (3-2-1-GO! & Racing)
            currentCamPos.copy(_chasePos);
            currentCamLook.copy(_chaseLook);
          }

          // Fixed, stable camera transform without high-frequency positional shake
          camera.position.copy(currentCamPos);
          camera.lookAt(currentCamLook);

          cameraShakeTrauma = 0;
          boostShakeIntensity = 0;
          countdownFovKick *= Math.exp(-5.0 * dt);

          // Dynamic Velocity-Scaled Field of View (FOV): widens smoothly as craft speed & boost increase
          const velocityFovDelta =
            Math.pow(speedRatioFov, 1.35) * 13.5 +
            (player.isBoosting ? 4.5 : 0) +
            countdownFovKick;
          const targetFov = cfg.enableDynamicFov
            ? THREE.MathUtils.clamp(cfg.fov + velocityFovDelta, 55, 108)
            : cfg.fov;

          const fovDamp = 1 - Math.exp(-8.5 * dt);
          const nextFov = camera.fov + (targetFov - camera.fov) * fovDamp;
          if (Math.abs(camera.fov - nextFov) > 0.01) {
            camera.fov = nextFov;
            camera.updateProjectionMatrix();
          }

          // Optional Post-FX Camera G-Force Tilt (OFF by default) + Subtle Drift-Angle Sway Roll
          if (cfg.enableGForceTilt && countdownTimer <= COUNTDOWN_START_SEC) {
            const lookAheadT = (((player.t + 0.012) % 1) + 1) % 1;
            spline.getTangentAt(lookAheadT, _aheadTangent);
            const trackTurnRate = _fwd.x * _aheadTangent.z - _fwd.z * _aheadTangent.x;
            const gForceSpeedFactor = Math.pow(
              THREE.MathUtils.clamp(speedRatioFov, 0.15, 1.35),
              1.2
            );
            const rawGForceTilt =
              (player.rollAngle * 0.34 -
                player.lateralVelocity * 0.0046 -
                trackTurnRate * 0.52) *
              gForceSpeedFactor;
            const targetGForceTilt = THREE.MathUtils.clamp(rawGForceTilt, -0.118, 0.118);
            smoothedGForceTilt +=
              (targetGForceTilt - smoothedGForceTilt) * (1 - Math.exp(-11.5 * dt));
          } else {
            smoothedGForceTilt += (0 - smoothedGForceTilt) * (1 - Math.exp(-10.0 * dt));
          }

          const totalCamRoll = smoothedDriftRoll + smoothedGForceTilt;
          if (Math.abs(totalCamRoll) > 0.0001) {
            camera.rotateZ(totalCamRoll);
          }
          document.body.dataset.camTilt = totalCamRoll.toFixed(4);
        }
      }

      // Expose camera inspection state on dataset for seamless verification
      document.body.dataset.camDist = (
        mode === 'explore' ? exploreDistance : orbitDistance
      ).toFixed(2);
      document.body.dataset.camYaw = (mode === 'explore' ? exploreYaw : orbitYaw).toFixed(2);
      document.body.dataset.camFov = camera.fov.toFixed(2);
      document.body.dataset.playerT = player.t.toFixed(4);

      // Anchor overhead 3D Storm Cloud Canopy & Forward Swirling Purple Supercell Vortex + Lightning Bolt
      if (isStormActive) {
        stormCanopyMesh.position.set(
          camera.position.x,
          camera.position.y + 185,
          camera.position.z
        );
        // Position the swirling purple vortex & lightning bolt high ahead of the player along the camera/track view
        camera.getWorldDirection(_camFwdXZ);
        _camFwdXZ.y = 0;
        if (_camFwdXZ.lengthSq() < 0.001) {
          _camFwdXZ.set(0, 0, -1);
        } else {
          _camFwdXZ.normalize();
        }
        stormVortexMesh.position.set(
          camera.position.x + _camFwdXZ.x * 410,
          camera.position.y + 118,
          camera.position.z + _camFwdXZ.z * 410
        );
        stormVortexMesh.lookAt(
          camera.position.x,
          camera.position.y + 52,
          camera.position.z
        );
        stormLightningLight.position.set(
          camera.position.x + _camFwdXZ.x * 160,
          camera.position.y + 95,
          camera.position.z + _camFwdXZ.z * 160
        );
      }

      // Update 3D Dynamic Weather / Rising Lava Ember Particle Pool (World-Space Modulo Wrapping — zero camera-turn flicker)
      const activeWeatherCount = cfg.enableRisingEmbers
        ? Math.floor(WEATHER_POOL_SIZE * currentWeather.intensity)
        : 0;
      const isCityRain = isCityTrack(cfg.trackId);
      const spanXZ = 88;
      const halfXZ = 44;
      const spanY = 36;
      const halfY = 18;
      const windGustX = isCityRain ? -6.2 + Math.sin(timeSec * 1.45) * 2.4 : 0;
      const windGustZ = isCityRain ? -3.4 + Math.cos(timeSec * 1.15) * 1.8 : 0;

      for (let i = 0; i < WEATHER_POOL_SIZE; i++) {
        if (i >= activeWeatherCount) {
          _weatherDummy.position.set(0, -999, 0);
          _weatherDummy.scale.setScalar(0.001);
          _weatherDummy.updateMatrix();
          weatherInstanced.setMatrixAt(i, _weatherDummy.matrix);
          continue;
        }
        const drop = weatherDrops[i];
        if (isCityRain) {
          // Multi-layer high-velocity slanted cyber-storm rain streaks fixed in world space
          const layerSpeedMul = drop.layer === 0 ? 1.28 : drop.layer === 1 ? 1.0 : 0.78;
          drop.ry -= (52 + drop.speedY * 22) * layerSpeedMul * worldAnimDt;
          drop.rx += windGustX * layerSpeedMul * worldAnimDt;
          drop.rz += windGustZ * layerSpeedMul * worldAnimDt;

          const offsetX = ((((drop.rx - camera.position.x + halfXZ) % spanXZ) + spanXZ) % spanXZ) - halfXZ;
          const offsetY = ((((drop.ry - camera.position.y + halfY) % spanY) + spanY) % spanY) - halfY;
          const offsetZ = ((((drop.rz - camera.position.z + halfXZ) % spanXZ) + spanXZ) % spanXZ) - halfXZ;
          const wx = camera.position.x + offsetX;
          const wy = camera.position.y + offsetY;
          const wz = camera.position.z + offsetZ;
          const camDistSq = offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ;
          const nearFade = THREE.MathUtils.smoothstep(camDistSq, 28, 110);
          const streakLen =
            (drop.layer === 0 ? 2.55 : drop.layer === 1 ? 1.95 : 1.35) *
            drop.scale *
            nearFade;
          const streakThick = (drop.layer === 0 ? 0.038 : 0.028) * nearFade;

          _weatherDummy.position.set(wx, nearFade <= 0.01 ? -999 : wy, wz);
          _weatherDummy.rotation.set(0.21, 0, 0.13 + Math.sin(timeSec * 1.4) * 0.04);
          _weatherDummy.scale.set(streakThick, streakLen, streakThick);
        } else {
          // Buoyant glowing volcanic ember sparks rising upward from the molten lava below with convective thermal swirl
          drop.ry +=
            (6.4 * drop.speedY + Math.sin(timeSec * 2.1 + drop.driftPhase) * 2.2) * worldAnimDt;
          drop.rx += Math.cos(timeSec * 1.25 + drop.driftPhase) * 6.8 * worldAnimDt;
          drop.rz += Math.sin(timeSec * 1.05 + drop.driftPhase) * 6.2 * worldAnimDt;

          const offsetX = ((((drop.rx - camera.position.x + halfXZ) % spanXZ) + spanXZ) % spanXZ) - halfXZ;
          const offsetY = ((((drop.ry - camera.position.y + halfY) % spanY) + spanY) % spanY) - halfY;
          const offsetZ = ((((drop.rz - camera.position.z + halfXZ) % spanXZ) + spanXZ) % spanXZ) - halfXZ;
          const wx = camera.position.x + offsetX;
          const wy = camera.position.y + offsetY;
          const wz = camera.position.z + offsetZ;
          const camDistSq = offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ;
          const nearFade = THREE.MathUtils.smoothstep(camDistSq, 49, 144);

          _weatherDummy.position.set(wx, nearFade <= 0.01 ? -999 : wy, wz);
          _weatherDummy.rotation.set(
            Math.sin(timeSec * 1.5 + drop.driftPhase) * 0.25,
            Math.cos(timeSec + drop.driftPhase) * 0.4,
            Math.cos(timeSec * 1.3 + drop.driftPhase) * 0.22
          );
          const emberThickness = (drop.isEmber ? 0.052 : 0.038) * drop.scale * nearFade;
          const emberStreak = (drop.isEmber ? 0.36 : 0.24) * drop.scale * nearFade;
          _weatherDummy.scale.set(emberThickness, emberStreak, emberThickness);
        }
        _weatherDummy.updateMatrix();
        weatherInstanced.setMatrixAt(i, _weatherDummy.matrix);
      }
      weatherInstanced.instanceMatrix.needsUpdate = true;
      heatHazeScreenPass.uniforms.uTime.value = timeSec;

      // Update High-Speed Edge Motion Lines Post-Processing Pass (>80% max speed threshold)
      const playerShipSpec = SHIP_SPECS[player.shipId];
      const speedThreshold80 = playerShipSpec.maxSpeedKmh * 0.80;
      const rawMotionIntensity =
        player.speedKmh > speedThreshold80
          ? THREE.MathUtils.clamp(
              (player.speedKmh - speedThreshold80) / (playerShipSpec.maxSpeedKmh * 0.22),
              0.0,
              1.35
            )
          : 0.0;
      const targetMotionIntensity = cfg.enableMotionLines
        ? Math.max(rawMotionIntensity, motionLinesPreviewTimer > 0 ? 0.95 : 0.0)
        : 0.0;
      smoothedMotionLinesIntensity +=
        (targetMotionIntensity - smoothedMotionLinesIntensity) * (1 - Math.exp(-14 * dt));
      motionLinesPass.uniforms.uTime.value = timeSec;
      motionLinesPass.uniforms.uIntensity.value = smoothedMotionLinesIntensity;
      motionLinesPass.uniforms.uBoost.value = player.isBoosting ? 1.0 : 0.0;

      // Update Collision Spark Particle Pool
      for (let i = 0; i < SPARK_POOL_SIZE; i++) {
        const sp = sparks[i];
        if (!sp.active) {
          _sparkDummy.position.set(0, -999, 0);
          _sparkDummy.scale.setScalar(0.001);
          _sparkDummy.updateMatrix();
          sparkInstanced.setMatrixAt(i, _sparkDummy.matrix);
          continue;
        }
        sp.life += worldAnimDt;
        if (sp.life >= sp.maxLife) {
          sp.active = false;
          _sparkDummy.position.set(0, -999, 0);
          _sparkDummy.scale.setScalar(0.001);
          _sparkDummy.updateMatrix();
          sparkInstanced.setMatrixAt(i, _sparkDummy.matrix);
          continue;
        }
        sp.x += sp.vx * worldAnimDt;
        sp.y += sp.vy * worldAnimDt;
        sp.z += sp.vz * worldAnimDt;
        const fade = 1 - sp.life / sp.maxLife;
        _sparkDummy.position.set(sp.x, sp.y, sp.z);
        _sparkDummy.scale.set(sp.scale * fade, sp.scale * fade, sp.scale * (1 + fade * 1.4));
        _sparkDummy.lookAt(sp.x + sp.vx, sp.y + sp.vy, sp.z + sp.vz);
        _sparkDummy.updateMatrix();
        sparkInstanced.setMatrixAt(i, _sparkDummy.matrix);
      }
      sparkInstanced.instanceMatrix.needsUpdate = true;

      // Update Boost Thruster Neon-Cyan Spark Pool
      for (let i = 0; i < THRUSTER_SPARK_POOL_SIZE; i++) {
        const tsp = thrusterSparks[i];
        if (!tsp.active) {
          _thrusterDummy.position.set(0, -999, 0);
          _thrusterDummy.scale.setScalar(0.001);
          _thrusterDummy.updateMatrix();
          thrusterSparkInstanced.setMatrixAt(i, _thrusterDummy.matrix);
          continue;
        }
        tsp.life += worldAnimDt;
        if (tsp.life >= tsp.maxLife) {
          tsp.active = false;
          _thrusterDummy.position.set(0, -999, 0);
          _thrusterDummy.scale.setScalar(0.001);
          _thrusterDummy.updateMatrix();
          thrusterSparkInstanced.setMatrixAt(i, _thrusterDummy.matrix);
          continue;
        }
        tsp.x += tsp.vx * worldAnimDt;
        tsp.y += tsp.vy * worldAnimDt;
        tsp.z += tsp.vz * worldAnimDt;
        const dxCam = tsp.x - camera.position.x;
        const dyCam = tsp.y - camera.position.y;
        const dzCam = tsp.z - camera.position.z;
        const camGuard = THREE.MathUtils.smoothstep(dxCam * dxCam + dyCam * dyCam + dzCam * dzCam, 6.0, 18.0);
        const fade = (1 - tsp.life / tsp.maxLife) * camGuard;
        _thrusterDummy.position.set(tsp.x, tsp.y, tsp.z);
        _thrusterDummy.scale.set(
          tsp.scale * fade,
          tsp.scale * fade,
          tsp.scale * (1.0 + fade * 1.35 * tsp.streakFactor)
        );
        _thrusterDummy.lookAt(tsp.x + tsp.dirX, tsp.y + tsp.dirY, tsp.z + tsp.dirZ);
        _thrusterDummy.updateMatrix();
        thrusterSparkInstanced.setMatrixAt(i, _thrusterDummy.matrix);
      }
      thrusterSparkInstanced.instanceMatrix.needsUpdate = true;

      // Update Boost Thruster Thermal Heat-Haze Shimmer Pool
      for (let i = 0; i < HEAT_HAZE_POOL_SIZE; i++) {
        const hz = heatHazeParticles[i];
        if (!hz.active) {
          _hazeDummy.position.set(0, -999, 0);
          _hazeDummy.scale.setScalar(0.001);
          _hazeDummy.updateMatrix();
          heatHazeInstanced.setMatrixAt(i, _hazeDummy.matrix);
          continue;
        }
        hz.life += worldAnimDt;
        if (hz.life >= hz.maxLife) {
          hz.active = false;
          _hazeDummy.position.set(0, -999, 0);
          _hazeDummy.scale.setScalar(0.001);
          _hazeDummy.updateMatrix();
          heatHazeInstanced.setMatrixAt(i, _hazeDummy.matrix);
          continue;
        }
        hz.x += hz.vx * worldAnimDt;
        hz.y += hz.vy * worldAnimDt;
        hz.z += hz.vz * worldAnimDt;
        hz.roll += hz.rollSpeed * worldAnimDt;

        const dxCam = hz.x - camera.position.x;
        const dyCam = hz.y - camera.position.y;
        const dzCam = hz.z - camera.position.z;
        const camGuard = THREE.MathUtils.smoothstep(dxCam * dxCam + dyCam * dyCam + dzCam * dzCam, 9.0, 22.0);

        const lifeProg = hz.life / hz.maxLife;
        const envelope = Math.sin(lifeProg * Math.PI) * camGuard;
        const curScale = THREE.MathUtils.lerp(hz.startScale, hz.endScale, lifeProg) * (0.45 + 0.55 * envelope);

        _hazeDummy.position.set(hz.x, hz.y, hz.z);
        _hazeDummy.quaternion.copy(camera.quaternion);
        _hazeDummy.rotateZ(hz.roll);
        _hazeDummy.scale.set(curScale, curScale, 1);
        _hazeDummy.updateMatrix();
        heatHazeInstanced.setMatrixAt(i, _hazeDummy.matrix);
      }
      heatHazeInstanced.instanceMatrix.needsUpdate = true;

      // Update Proximity-Reactive Track Debris Particle Pool
      // Computes aerodynamic bow-wave & anti-gravity downwash forces from every nearby racer
      debrisMat.uniforms.uTime.value = timeSec;
      const proxRadiusSq = 16.5 * 16.5;

      for (let i = 0; i < DEBRIS_POOL_SIZE; i++) {
        const db = debrisParticles[i];
        if (!db.active || !cfg.enableTrackDebris) {
          _debrisDummy.position.set(0, -999, 0);
          _debrisDummy.scale.setScalar(0.001);
          _debrisDummy.updateMatrix();
          debrisInstanced.setMatrixAt(i, _debrisDummy.matrix);
          continue;
        }
        db.life += worldAnimDt;
        if (db.life >= db.maxLife) {
          db.active = false;
          _debrisDummy.position.set(0, -999, 0);
          _debrisDummy.scale.setScalar(0.001);
          _debrisDummy.updateMatrix();
          debrisInstanced.setMatrixAt(i, _debrisDummy.matrix);
          continue;
        }

        // Apply proximity aerodynamic turbulence from any racer passing within 16.5m
        if (worldAnimDt > 0) {
          for (let rIdx = 0; rIdx < shipRigs.length; rIdx++) {
            const rigPos = shipRigs[rIdx].root.position;
            const dx = db.x - rigPos.x;
            const dy = db.y - rigPos.y;
            const dz = db.z - rigPos.z;
            const dSq = dx * dx + dy * dy + dz * dz;
            if (dSq < proxRadiusSq && dSq > 0.04) {
              const dist = Math.sqrt(dSq);
              const proxFactor = Math.pow(1.0 - dist / 16.5, 1.6);
              const racerSpeedNorm = THREE.MathUtils.clamp(racers[rIdx].speedKmh / 850, 0.2, 1.4);
              const impulse = proxFactor * racerSpeedNorm * (isCityRain ? 32.0 : 26.0) * worldAnimDt;
              const invDist = 1.0 / dist;

              // Repel outward laterally + lift upward in the turbulent vortex wake
              db.vx += dx * invDist * impulse;
              db.vy += (isCityRain ? 0.85 : 0.68) * impulse;
              db.vz += dz * invDist * impulse;
              db.rollSpeed += (rIdx % 2 === 0 ? 1 : -1) * proxFactor * 6.5 * worldAnimDt;
              db.turbulenceBoost = Math.min(1.2, db.turbulenceBoost + proxFactor * 0.45);
            }
          }

          // Aerodynamic drag & gravity settling
          const drag = Math.exp(-2.2 * worldAnimDt);
          db.vx *= drag;
          db.vz *= drag;
          db.vy -= (isCityRain ? 9.8 : 2.6) * worldAnimDt;

          db.x += db.vx * worldAnimDt;
          db.y += db.vy * worldAnimDt;
          db.z += db.vz * worldAnimDt;
          db.roll += db.rollSpeed * worldAnimDt;
        }

        // Prevent particles from clipping into the near camera lens
        const dxCam = db.x - camera.position.x;
        const dyCam = db.y - camera.position.y;
        const dzCam = db.z - camera.position.z;
        const camGuard = THREE.MathUtils.smoothstep(
          dxCam * dxCam + dyCam * dyCam + dzCam * dzCam,
          14.0,
          36.0
        );

        const lifeProg = db.life / db.maxLife;
        const alphaBell = Math.sin(lifeProg * Math.PI) * camGuard;
        const curScale =
          THREE.MathUtils.lerp(db.startScale, db.endScale * (1.0 + db.turbulenceBoost * 0.35), lifeProg) *
          (0.35 + 0.65 * alphaBell);

        _debrisDummy.position.set(db.x, alphaBell <= 0.01 ? -999 : db.y, db.z);
        _debrisDummy.quaternion.copy(camera.quaternion);
        _debrisDummy.rotateZ(db.roll);
        _debrisDummy.scale.set(curScale, curScale * (isCityRain ? 0.82 : 0.92), 1);
        _debrisDummy.updateMatrix();
        debrisInstanced.setMatrixAt(i, _debrisDummy.matrix);
      }
      debrisInstanced.instanceMatrix.needsUpdate = true;

      // Throttle React HUD Telemetry Updates to ~12Hz
      if (now - lastHudEmitTime > 80 && currentWorld) {
        lastHudEmitTime = now;
        const standings = calculateStandings(racers);
        const playerRank = standings.findIndex((r) => r.isPlayer) + 1;

        const racerDots = racers.map((r) => {
          spline.getPointAt(((r.t % 1) + 1) % 1, _pos);
          spline.getTangentAt(((r.t % 1) + 1) % 1, _fwd);
          return {
            id: r.id,
            x: _pos.x,
            y: _pos.z,
            isPlayer: r.isPlayer,
            angle: Math.atan2(_fwd.z, _fwd.x),
          };
        });

        const opponentAhead = findOpponentInFront(player, racers);

        callbacksRef.current.onTelemetryUpdate({
          speedKmh: Math.round(player.speedKmh),
          energy: Math.round(player.energy),
          nitroReserve: Math.round(player.nitroReserve),
          crystalPoints: player.crystalPoints,
          crystalUpgradeLevel: player.crystalUpgradeLevel,
          creditsEarned: player.creditsEarned,
          totalCredits: totalCreditsRef.current,
          position: playerRank,
          totalRacers: racers.length,
          lap: player.lap,
          totalLaps: trackSpec.totalLaps,
          currentLapTimeMs: Math.max(0, raceElapsedMs - player.currentLapStartMs),
          bestLapTimeMs: player.bestLapMs,
          countdownValue:
            currentIntroPhase === 'countdown'
              ? currentCountdownVal
              : (statusBanner.startsWith('ENGAGE') || statusBanner.startsWith('TURBO')) &&
                statusBannerTimer > 0.75
              ? 0
              : -1,
          countdownProgress: currentCountdownProg,
          introPhase: currentIntroPhase,
          statusBanner,
          weatherLabel: currentWeather.label,
          weatherIntensity: currentWeather.intensity,
          surfaceGripPct: Math.round(currentWeather.surfaceGrip * 100),
          isBoosting: player.isBoosting,
          nitroActive: player.nitroTimer > 0,
          boostReady: player.energy > 20 && !player.isDestroyed,
          heldBonus: player.heldBonus,
          heldWeapon: player.heldWeapon,
          lastCollectedPowerUp: player.lastCollectedPowerUp,
          lastCollectedWeapon: player.lastCollectedWeapon,
          lastCollectedTimer: Number(player.lastCollectedTimer.toFixed(1)),
          ringChain: player.ringChain,
          boostComboCount: player.boostComboCount ?? 0,
          boostComboTimer: Number((player.boostComboTimer ?? 0).toFixed(2)),
          shieldActive: player.shieldTimer > 0,
          shieldRemainingSec: Number(player.shieldTimer.toFixed(1)),
          laserActive: player.laserActiveTimer > 0,
          shockwaveActive: player.shockwaveActiveTimer > 0,
          isDestroyed: player.isDestroyed,
          targetLockedName: opponentAhead ? opponentAhead.name : null,
          wrongWay: false,
          minimapPoints: currentWorld.minimapPoints,
          racerDots,
        });
      }

      if (isSoftwareGl) {
        renderer.render(scene, camera);
      } else {
        trackSsaoPass.enabled = settingsRef.current.enableTrackSsao;
        if (trackSsaoPass.enabled) {
          const prevBg = scene.background;
          const prevFog = scene.fog;
          const prevClearColor = renderer.getClearColor(new THREE.Color());
          const prevClearAlpha = renderer.getClearAlpha();

          scene.background = null;
          scene.fog = null;
          scene.overrideMaterial = trackNormalDepthMaterial;
          camera.layers.set(TRACK_SSAO_LAYER);

          renderer.setRenderTarget(trackNormalDepthTarget);
          renderer.setClearColor(0x000000, 0.0);
          renderer.clear();
          renderer.render(scene, camera);

          renderer.setRenderTarget(null);
          renderer.setClearColor(prevClearColor, prevClearAlpha);
          camera.layers.set(0);
          scene.overrideMaterial = null;
          scene.background = prevBg;
          scene.fog = prevFog;
        }
        composer.render();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    function dampClamp(v: number) {
      return Math.min(1, Math.max(0, v));
    }

    frameId = requestAnimationFrame(tick);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      trackNormalDepthTarget.setSize(
        Math.max(1, Math.floor(w * ssaoScale)),
        Math.max(1, Math.floor(h * ssaoScale))
      );
      trackSsaoPass.uniforms.uResolution.value.set(w, h);
      bloom.resolution.set(w, h);
      motionLinesPass.uniforms.uAspect.value = w / h;
      stormRainPass.uniforms.uAspect.value = w / h;
    };
    window.addEventListener('resize', onResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      domElem.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      domElem.removeEventListener('wheel', onWheel);
      domElem.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      window.removeEventListener('resize', onResize);
      audioEngine.stopEngine();
      stormCanopyGeo.dispose();
      stormCanopyMat.dispose();
      stormVortexGeo.dispose();
      stormVortexMat.dispose();
      trackNormalDepthTarget.dispose();
      trackNormalDepthMaterial.dispose();
      composer.dispose();
      renderer.dispose();
    };
  }, []);

  // Trigger scene rebuild when track, atmosphere, or neonIntensity changes
  useEffect(() => {
    rebuildSceneRef.current?.();
  }, [
    settings.trackId,
    settings.atmosphere,
    settings.neonIntensity,
  ]);

  // Hot-swap player ship model when shipId changes without rebuilding the track
  useEffect(() => {
    swapPlayerShipRef.current?.();
  }, [settings.shipId]);

  // Sync debug mode camera initialization when mode changes
  useEffect(() => {
    syncDebugModeInitRef.current?.(debugMode);
  }, [debugMode]);

  // Apply sector teleport bookmark in Exploration mode
  useEffect(() => {
    if (teleportRequest) {
      applyTeleportRef.current?.(teleportRequest);
    }
  }, [teleportRequest]);

  // Trigger race reset when raceNonce increments or entering 'playing'
  useEffect(() => {
    if (gameState === 'playing' && !cameraPaused && !debugMenuOpen) {
      audioEngine.startEngine();
    } else {
      audioEngine.stopEngine();
    }
  }, [gameState, cameraPaused, debugMenuOpen]);

  useEffect(() => {
    if (raceNonce > 0) {
      resetRaceStateRef.current?.();
    }
  }, [raceNonce]);

  return (
    <div
      ref={mountRef}
      tabIndex={0}
      data-testid="racing-canvas-container"
      className="movement-control-container fixed inset-0 w-full h-full overflow-hidden bg-[#05070d] outline-none"
    />
  );
};
