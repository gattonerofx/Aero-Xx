import * as THREE from 'three';
import { AtmosphereMode, TrackId } from './types';
import { isCityTrack } from './rules';

export interface TrackTextureSet {
  roadMap: THREE.CanvasTexture;
  roadEmissiveMap: THREE.CanvasTexture;
  roadBumpMap: THREE.CanvasTexture;
  roadRoughnessMap: THREE.CanvasTexture;
  buildingMap: THREE.CanvasTexture;
  buildingEmissiveMap: THREE.CanvasTexture;
  holoBillboardMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  thrusterFlareMap: THREE.CanvasTexture;
  chevronSignMap: THREE.CanvasTexture;
  // 8 Dedicated High-Resolution Lava Circuit Textures
  roadwayPanelsMap: THREE.Texture;
  obsidianRockMap: THREE.Texture;
  glowingLavaMap: THREE.Texture;
  brushedGraphiteMap: THREE.Texture;
  cyanNeonSurfaceMap: THREE.Texture;
  amberLaneMarkingsMap: THREE.Texture;
  volcanicGravelMap: THREE.Texture;
  cyanGuardrailMap: THREE.Texture;
  // 8 Dedicated High-Resolution Cyber-City Circuit Textures
  cityWetTrackMap: THREE.Texture;
  cityArmourPanelsMap: THREE.Texture;
  cityCyanBarrierMap: THREE.Texture;
  cityLaneAsphaltMap: THREE.Texture;
  cityMagentaRailMap: THREE.Texture;
  cityWindowFacadeMap: THREE.Texture;
  cityRainbowPavementMap: THREE.Texture;
  cityCorridorFloorMap: THREE.Texture;
  cityDecorativeAtlasMap: THREE.Texture;
  // Dedicated High-Resolution Lava Circuit Cyberpunk Decorative Atlases & Hologram Maps
  lavaDecorativeAtlas1Map: THREE.Texture;
  lavaDecorativeAtlas2Map: THREE.Texture;
  checkpointSignMap: THREE.CanvasTexture;
  cyberSphereSignMap: THREE.CanvasTexture;
  // 8 Dedicated 2048x2048 Volcanic Basalt PBR Maps for Lava Circuit Mountains & Volcano
  volcanicBasaltAlbedoMap: THREE.Texture;
  volcanicBasaltNormalMap: THREE.Texture;
  volcanicBasaltRoughnessMap: THREE.Texture;
  volcanicBasaltHeightMap: THREE.Texture;
  volcanicBasaltAoMap: THREE.Texture;
  volcanicBasaltMetallicMap: THREE.Texture;
  volcanicBasaltEmissiveMap: THREE.Texture;
  volcanicBasaltLavaMaskMap: THREE.Texture;
  // Seamless 4-channel RGBA turbulence/cloud texture (texture1 for TheGameMaker WebGL lava shader)
  lavaCloudMap: THREE.DataTexture;
  // Updates animated textures (16 multi-frame WebP City advertising panels)
  updateAnimatedTextures: (timeSec: number) => void;
}

const _textureLoader = new THREE.TextureLoader();
const _imageCache = new Map<string, HTMLImageElement>();
const _webpFramesCache = new Map<string, ImageBitmap[]>();
const _webpLoadingSet = new Set<string>();

export const CITY_ANIMATED_WEBP_PANELS: ReadonlyArray<{
  url: string;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}> = [
  // #0 VERT_NEO_TOKYO_CYBORG
  { url: '/assets/aistudio/01_neon_rider_vertical_c65dba73.webp', u0: 0.012, v0: 0.562, u1: 0.123, v1: 0.968 },
  // #1 AD_NEO_KOLA_CAN
  { url: '/assets/aistudio/02_neo_kola_can_063cb08d.webp', u0: 0.132, v0: 0.780, u1: 0.312, v1: 0.963 },
  // #2 AD_NEO_KOLA_ANDROID
  { url: '/assets/aistudio/03_neo_kola_android_de0cb050.webp', u0: 0.322, v0: 0.780, u1: 0.520, v1: 0.963 },
  // #3 AD_CYBBCORE_ANDROID
  { url: '/assets/aistudio/04_cybercore_android_d0e13588.webp', u0: 0.530, v0: 0.780, u1: 0.728, v1: 0.963 },
  // #4 VERT_NEO_TOKYO_WOMAN_TOP
  { url: '/assets/aistudio/05_neo_tokyo_motors_portrait_80aefe51.webp', u0: 0.742, v0: 0.540, u1: 0.865, v1: 0.965 },
  // #5 AD_CYBERNETICS_NOW
  { url: '/assets/aistudio/06_cybernetics_now_72a86dc1.webp', u0: 0.132, v0: 0.540, u1: 0.328, v1: 0.752 },
  // #6 AD_SHIBUYA_DRIFT
  { url: '/assets/aistudio/07_shibuya_drift_4fc271b7.webp', u0: 0.338, v0: 0.540, u1: 0.528, v1: 0.752 },
  // #7 AD_GLITCH_GEAR
  { url: '/assets/aistudio/08_glitch_gear_147f715b.webp', u0: 0.538, v0: 0.540, u1: 0.728, v1: 0.752 },
  // #8 VERT_KANJI_NEON
  { url: '/assets/aistudio/09_neon_city_vertical_ac9de690.webp', u0: 0.012, v0: 0.032, u1: 0.115, v1: 0.525 },
  // #9 AD_NEO_TOKYO_MOTORS_LOGO
  { url: '/assets/aistudio/10_neo_tokyo_motors_logo_0183a229.webp', u0: 0.128, v0: 0.285, u1: 0.302, v1: 0.505 },
  // #10 AD_CYBERDYNE_PYRAMID
  { url: '/assets/aistudio/11_cyberdyne_triangle_9fbf1233.webp', u0: 0.312, v0: 0.285, u1: 0.508, v1: 0.505 },
  // #11 AD_GLITCH_COLA
  { url: '/assets/aistudio/12_glitch_cola_b08c9f27.webp', u0: 0.518, v0: 0.285, u1: 0.712, v1: 0.505 },
  // #12 VERT_NEO_TOKYO_CRT
  { url: '/assets/aistudio/13_neo_tokyo_motors_chip_7ccc353d.webp', u0: 0.725, v0: 0.032, u1: 0.858, v1: 0.505 },
  // #13 VERT_NEO_TOKYO_WOMAN_FULL
  { url: '/assets/aistudio/14_neo_tokyo_motors_full_body_9a81bbf1.webp', u0: 0.870, v0: 0.032, u1: 0.985, v1: 0.505 },
  // #14 AD_NEO_TOKYO_MOTORS_WIDE
  { url: '/assets/aistudio/15_neo_tokyo_motors_android_9e5c8760.webp', u0: 0.128, v0: 0.032, u1: 0.508, v1: 0.258 },
  // #15 AD_CYBERDYNE_SLASH
  { url: '/assets/aistudio/16_cyberdyne_glitch_e1716177.webp', u0: 0.518, v0: 0.032, u1: 0.712, v1: 0.258 },
];

function decodeAnimatedWebpFrames(url: string, onDecoded?: () => void): void {
  if (_webpFramesCache.has(url) || _webpLoadingSet.has(url)) {
    if (_webpFramesCache.has(url) && onDecoded) onDecoded();
    return;
  }
  _webpLoadingSet.add(url);

  // Also load standard HTMLImageElement fallback immediately
  loadCachedImage(url, () => {
    if (onDecoded) onDecoded();
  });

  const AnyImageDecoder = (globalThis as unknown as {
    ImageDecoder?: new (init: { data: BufferSource; type: string }) => {
      tracks: { ready: Promise<void>; selectedTrack?: { frameCount: number } };
      decode: (opts: { frameIndex: number }) => Promise<{ image: VideoFrame }>;
      close: () => void;
    };
  }).ImageDecoder;

  if (!AnyImageDecoder || typeof fetch !== 'function' || typeof createImageBitmap !== 'function') {
    _webpLoadingSet.delete(url);
    return;
  }

  fetch(url)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('fetch failed'))))
    .then(async (buf) => {
      const decoder = new AnyImageDecoder({ data: buf, type: 'image/webp' });
      await decoder.tracks.ready;
      const frameCount = Math.min(32, Math.max(1, decoder.tracks.selectedTrack?.frameCount ?? 16));
      const bitmaps: ImageBitmap[] = [];
      for (let i = 0; i < frameCount; i++) {
        const { image } = await decoder.decode({ frameIndex: i });
        const bmp = await createImageBitmap(image);
        image.close();
        bitmaps.push(bmp);
      }
      decoder.close();
      if (bitmaps.length > 0) {
        _webpFramesCache.set(url, bitmaps);
        if (onDecoded) onDecoded();
      }
    })
    .catch(() => {
      // Fallback already handled via loadCachedImage
    })
    .finally(() => {
      _webpLoadingSet.delete(url);
    });
}

function loadCachedImage(url: string, onReady: (img: HTMLImageElement) => void): void {
  const cached = _imageCache.get(url);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    onReady(cached);
    return;
  }
  const img = new Image();
  img.onload = () => {
    _imageCache.set(url, img);
    onReady(img);
  };
  img.src = url;
}

function loadRepeatingTexture(
  url: string,
  maxAniso: number,
  repeatX = 1,
  repeatY = 1,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
  onLoadCallback?: (tex: THREE.Texture) => void
): THREE.Texture {
  const tex = _textureLoader.load(url, (loaded) => {
    loaded.needsUpdate = true;
    if (onLoadCallback) onLoadCallback(loaded);
  });
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * Generates a seamless, periodic 256x256 4-channel RGBA turbulence cloud texture (`texture1`)
 * specifically designed for TheGameMaker's `webgl_shader_lava` dual-advection shader:
 * - RGB channels (.xyz) store decorrelated periodic FBM turbulence fields to warp T1 & T2 UVs.
 * - Alpha channel (.a) stores billowy convection intensity `p` in [0..1] for `color * (vec4(p) * 2.0) + (color * color - 0.1)`.
 */
function createSeamlessLavaCloudTexture(maxAniso: number): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);

  const hashPeriodic = (ix: number, iy: number, period: number, seed: number): number => {
    const wx = ((ix % period) + period) % period;
    const wy = ((iy % period) + period) % period;
    const n = Math.sin(wx * 127.1 + wy * 311.7 + seed * 74.7) * 43758.5453123;
    return n - Math.floor(n);
  };

  const samplePeriodicNoise = (u: number, v: number, freq: number, seed: number): number => {
    const x = u * freq;
    const y = v * freq;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3.0 - 2.0 * fx);
    const sy = fy * fy * (3.0 - 2.0 * fy);

    const n00 = hashPeriodic(ix, iy, freq, seed);
    const n10 = hashPeriodic(ix + 1, iy, freq, seed);
    const n01 = hashPeriodic(ix, iy + 1, freq, seed);
    const n11 = hashPeriodic(ix + 1, iy + 1, freq, seed);

    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  };

  const samplePeriodicFbm = (u: number, v: number, baseFreq: number, seed: number): number => {
    let val = 0.0;
    let amp = 0.5;
    let freq = baseFreq;
    for (let o = 0; o < 4; o++) {
      val += amp * samplePeriodicNoise(u, v, freq, seed + o * 19.3);
      freq *= 2;
      amp *= 0.5;
    }
    return val;
  };

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = (y * size + x) * 4;

      const nx = samplePeriodicFbm(u, v, 4, 1.1);
      const ny = samplePeriodicFbm(u, v, 4, 37.7);
      const nz = samplePeriodicFbm(u, v, 4, 83.9);

      // Alpha channel `p`: billowy convection cells with dark crust valleys and hot magma plumes
      const rawP = samplePeriodicFbm(u + (nx - 0.5) * 0.18, v + (ny - 0.5) * 0.18, 4, 149.3);
      const contrastP = THREE.MathUtils.clamp((rawP - 0.18) / 0.68, 0.04, 0.98);
      const shapedP = contrastP * contrastP * (3.0 - 2.0 * contrastP);

      data[idx] = Math.round(THREE.MathUtils.clamp(nx, 0, 1) * 255);
      data[idx + 1] = Math.round(THREE.MathUtils.clamp(ny, 0, 1) * 255);
      data[idx + 2] = Math.round(THREE.MathUtils.clamp(nz, 0, 1) * 255);
      data[idx + 3] = Math.round(shapedP * 255);
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(
  renderer: THREE.WebGLRenderer,
  trackId: TrackId,
  atmosphere: AtmosphereMode
): TrackTextureSet {
  const maxAniso = renderer.capabilities.getMaxAnisotropy() || 4;
  const isNeon = atmosphere === 'neon';
  const isCity = isCityTrack(trackId);
  const isCityV2 = trackId === 'city';

  // Load the 8 high-resolution Lava Circuit textures from /assets/aistudio/
  const roadwayPanelsMap = loadRepeatingTexture(
    '/assets/aistudio/01_roadway_panels_92956cd2.png',
    maxAniso,
    2,
    64
  );
  const obsidianRockMap = loadRepeatingTexture(
    '/assets/aistudio/02_obsidian_rock_74edfbd0.png',
    maxAniso,
    6,
    6
  );
  const glowingLavaMap = loadRepeatingTexture(
    '/assets/aistudio/03_glowing_lava_9aea767b.png',
    maxAniso,
    8,
    8
  );
  const brushedGraphiteMap = loadRepeatingTexture(
    '/assets/aistudio/04_brushed_graphite_3a5196f9.png',
    maxAniso,
    2,
    2
  );
  const cyanNeonSurfaceMap = loadRepeatingTexture(
    '/assets/aistudio/05_cyan_neon_surface_ff1a6f38.png',
    maxAniso,
    4,
    1
  );
  const amberLaneMarkingsMap = loadRepeatingTexture(
    '/assets/aistudio/06_amber_lane_markings_4d07587e.png',
    maxAniso,
    1,
    72
  );
  const volcanicGravelMap = loadRepeatingTexture(
    '/assets/aistudio/07_volcanic_gravel_c665594a.png',
    maxAniso,
    14,
    14
  );
  const cyanGuardrailMap = loadRepeatingTexture(
    '/assets/aistudio/08_cyan_guardrail_cab2c37a.png',
    maxAniso,
    96,
    1
  );

  // Load the 8 high-resolution Cyber-City Circuit textures from /assets/aistudio/
  const cityWetTrackMap = loadRepeatingTexture(
    '/assets/aistudio/01_wet_neon_track_92d2e945.png',
    maxAniso,
    2,
    64
  );
  const cityArmourPanelsMap = loadRepeatingTexture(
    '/assets/aistudio/02_dark_armour_panels_940b904f.png',
    maxAniso,
    3,
    3
  );
  const cityCyanBarrierMap = loadRepeatingTexture(
    '/assets/aistudio/03_cyan_light_barrier_7aa5e9af.png',
    maxAniso,
    96,
    1
  );
  const cityLaneAsphaltMap = loadRepeatingTexture(
    '/assets/aistudio/04_lane_marked_asphalt_114cfdbd.png',
    maxAniso,
    1,
    64
  );
  const cityMagentaRailMap = loadRepeatingTexture(
    '/assets/aistudio/05_magenta_neon_rail_9f9d1ec5.png',
    maxAniso,
    64,
    1
  );
  const cityWindowFacadeMap = loadRepeatingTexture(
    '/assets/aistudio/06_city_window_facade_c6d256d2.png',
    maxAniso,
    2,
    3
  );
  const cityRainbowPavementMap = loadRepeatingTexture(
    '/assets/aistudio/07_rainbow_wet_pavement_dbc30136.png',
    maxAniso,
    16,
    16
  );
  const cityCorridorFloorMap = loadRepeatingTexture(
    '/assets/aistudio/08_cyan_corridor_floor_bf8dbc94.png',
    maxAniso,
    2,
    32
  );
  // Dynamic 2048x1144 CanvasTexture for the 16 animated City advertising WebP panels
  const cityAtlasCanvas = document.createElement('canvas');
  cityAtlasCanvas.width = 2048;
  cityAtlasCanvas.height = 1144;
  const cityAtlasCtx = cityAtlasCanvas.getContext('2d')!;
  cityAtlasCtx.fillStyle = '#060812';
  cityAtlasCtx.fillRect(0, 0, 2048, 1144);

  const cityDecorativeAtlasMap = new THREE.CanvasTexture(cityAtlasCanvas);
  cityDecorativeAtlasMap.colorSpace = THREE.SRGBColorSpace;
  cityDecorativeAtlasMap.wrapS = THREE.ClampToEdgeWrapping;
  cityDecorativeAtlasMap.wrapT = THREE.ClampToEdgeWrapping;
  cityDecorativeAtlasMap.minFilter = THREE.LinearFilter;
  cityDecorativeAtlasMap.magFilter = THREE.LinearFilter;
  cityDecorativeAtlasMap.generateMipmaps = false;
  cityDecorativeAtlasMap.anisotropy = maxAniso;

  let lastAnimatedFrameTick = -1;
  let dirtyAnimatedAtlas = true;

  const drawCityAnimatedWebpAtlas = (frameTick: number) => {
    const W = cityAtlasCanvas.width;
    const H = cityAtlasCanvas.height;
    let drewAny = false;

    for (let i = 0; i < CITY_ANIMATED_WEBP_PANELS.length; i++) {
      const p = CITY_ANIMATED_WEBP_PANELS[i];
      const dx = Math.round(p.u0 * W);
      const dy = Math.round((1 - p.v1) * H);
      const dw = Math.round((p.u1 - p.u0) * W);
      const dh = Math.round((p.v1 - p.v0) * H);

      const frames = _webpFramesCache.get(p.url);
      if (frames && frames.length > 0) {
        // Stagger frame phase slightly per ad panel for organic multi-screen city life
        const fIdx = (frameTick + i * 2) % frames.length;
        cityAtlasCtx.drawImage(frames[fIdx], dx, dy, dw, dh);
        drewAny = true;
      } else {
        const fallbackImg = _imageCache.get(p.url);
        if (fallbackImg && fallbackImg.complete && fallbackImg.naturalWidth > 0) {
          cityAtlasCtx.drawImage(fallbackImg, dx, dy, dw, dh);
          drewAny = true;
        }
      }
    }

    if (drewAny) {
      cityDecorativeAtlasMap.needsUpdate = true;
    }
  };

  // Seed base atlas immediately with decorative2k_bbaeeaee.jpg and kick off all 16 animated WebP decodes
  loadCachedImage('/assets/aistudio/decorative2k_bbaeeaee.jpg', (baseImg) => {
    cityAtlasCtx.drawImage(baseImg, 0, 0, cityAtlasCanvas.width, cityAtlasCanvas.height);
    dirtyAnimatedAtlas = true;
    drawCityAnimatedWebpAtlas(0);
    cityDecorativeAtlasMap.needsUpdate = true;
  });

  for (let i = 0; i < CITY_ANIMATED_WEBP_PANELS.length; i++) {
    decodeAnimatedWebpFrames(CITY_ANIMATED_WEBP_PANELS[i].url, () => {
      dirtyAnimatedAtlas = true;
    });
  }

  const updateAnimatedTextures = (timeSec: number) => {
    // 16 frames @ 125ms per frame = 8 FPS native animation rate for the 16 WebP panels
    const frameTick = Math.floor(timeSec * 8);
    if (frameTick !== lastAnimatedFrameTick || dirtyAnimatedAtlas) {
      lastAnimatedFrameTick = frameTick;
      dirtyAnimatedAtlas = false;
      drawCityAnimatedWebpAtlas(Math.max(0, frameTick));
    }
  };

  // Load the 2 High-Resolution Lava Circuit Cyberpunk Decorative Atlases
  const lavaDecorativeAtlas1Map = _textureLoader.load(
    '/assets/aistudio/lava-Extracting_advertisements_from_i__2K_20261027000717_9d93f41b.jpg',
    (loaded) => {
      loaded.needsUpdate = true;
    }
  );
  lavaDecorativeAtlas1Map.colorSpace = THREE.SRGBColorSpace;
  lavaDecorativeAtlas1Map.wrapS = THREE.ClampToEdgeWrapping;
  lavaDecorativeAtlas1Map.wrapT = THREE.ClampToEdgeWrapping;
  lavaDecorativeAtlas1Map.minFilter = THREE.LinearMipmapLinearFilter;
  lavaDecorativeAtlas1Map.magFilter = THREE.LinearFilter;
  lavaDecorativeAtlas1Map.anisotropy = maxAniso;

  const lavaDecorativeAtlas2Map = _textureLoader.load(
    '/assets/aistudio/lava-Extracting_advertising_panels_fr__2K_20261027000810_520513ec.jpg',
    (loaded) => {
      loaded.needsUpdate = true;
    }
  );
  lavaDecorativeAtlas2Map.colorSpace = THREE.SRGBColorSpace;
  lavaDecorativeAtlas2Map.wrapS = THREE.ClampToEdgeWrapping;
  lavaDecorativeAtlas2Map.wrapT = THREE.ClampToEdgeWrapping;
  lavaDecorativeAtlas2Map.minFilter = THREE.LinearMipmapLinearFilter;
  lavaDecorativeAtlas2Map.magFilter = THREE.LinearFilter;
  lavaDecorativeAtlas2Map.anisotropy = maxAniso;

  // Procedural High-Resolution Holographic "CHECKPOINT" Arch Banner Texture (matches Sheet 2)
  const cpCanvas = document.createElement('canvas');
  cpCanvas.width = 1024;
  cpCanvas.height = 256;
  const cpCtx = cpCanvas.getContext('2d')!;
  cpCtx.clearRect(0, 0, 1024, 256);
  // Subtle holographic dark-cyan scanline backing plate with angled tech corners
  cpCtx.fillStyle = 'rgba(4, 24, 42, 0.78)';
  cpCtx.beginPath();
  cpCtx.moveTo(64, 36);
  cpCtx.lineTo(960, 36);
  cpCtx.lineTo(996, 128);
  cpCtx.lineTo(960, 220);
  cpCtx.lineTo(64, 220);
  cpCtx.lineTo(28, 128);
  cpCtx.closePath();
  cpCtx.fill();
  cpCtx.lineWidth = 5;
  cpCtx.strokeStyle = '#38bdf8';
  cpCtx.stroke();
  // Inner segmented tech frame lines
  cpCtx.lineWidth = 2;
  cpCtx.strokeStyle = 'rgba(125, 211, 252, 0.65)';
  cpCtx.strokeRect(86, 54, 852, 148);
  cpCtx.save();
  cpCtx.font = '700 84px "Orbitron", "Plus Jakarta Sans", sans-serif';
  cpCtx.textAlign = 'center';
  cpCtx.textBaseline = 'middle';
  cpCtx.shadowColor = '#00f2fe';
  cpCtx.shadowBlur = 22;
  cpCtx.fillStyle = '#e0f2fe';
  cpCtx.fillText('CHECKPOINT', 512, 132);
  cpCtx.restore();
  const checkpointSignMap = new THREE.CanvasTexture(cpCanvas);
  checkpointSignMap.colorSpace = THREE.SRGBColorSpace;
  checkpointSignMap.anisotropy = maxAniso;

  // Procedural High-Resolution Holographic "CYBRNETIC NOW" Sphere Core Decal Texture
  const csCanvas = document.createElement('canvas');
  csCanvas.width = 1024;
  csCanvas.height = 512;
  const csCtx = csCanvas.getContext('2d')!;
  csCtx.clearRect(0, 0, 1024, 512);
  csCtx.save();
  csCtx.font = '800 96px "Orbitron", "Plus Jakarta Sans", sans-serif';
  csCtx.textAlign = 'center';
  csCtx.textBaseline = 'middle';
  csCtx.shadowColor = '#00f2fe';
  csCtx.shadowBlur = 28;
  csCtx.fillStyle = '#bae6fd';
  csCtx.fillText('CYBRNETIC', 512, 206);
  csCtx.fillText('NOW', 512, 316);
  // Subtle holographic data nodes around text
  csCtx.fillStyle = '#38bdf8';
  csCtx.fillRect(148, 184, 18, 18);
  csCtx.fillRect(856, 298, 22, 16);
  csCtx.fillRect(720, 312, 14, 14);
  csCtx.restore();
  const cyberSphereSignMap = new THREE.CanvasTexture(csCanvas);
  cyberSphereSignMap.colorSpace = THREE.SRGBColorSpace;
  cyberSphereSignMap.anisotropy = maxAniso;

  // Load the 8 Dedicated 2048x2048 Volcanic Basalt PBR Maps per README_ThreeJS_a187822b.txt
  const volcanicBasaltAlbedoMap = loadRepeatingTexture(
    '/assets/aistudio/volcanic_basalt_albedo_4c647e1f.png',
    maxAniso,
    4,
    4,
    THREE.SRGBColorSpace
  );
  const volcanicBasaltNormalMap = loadRepeatingTexture(
    '/assets/aistudio/volcanic_basalt_normal_06d43536.png',
    maxAniso,
    4,
    4,
    THREE.NoColorSpace
  );
  const volcanicBasaltRoughnessMap = loadRepeatingTexture(
    '/assets/aistudio/volcanic_basalt_roughness_b68389fa.png',
    maxAniso,
    4,
    4,
    THREE.NoColorSpace
  );
  const volcanicBasaltHeightMap = loadRepeatingTexture(
    '/assets/aistudio/volcanic_basalt_height_a9f0ff49.png',
    maxAniso,
    4,
    4,
    THREE.NoColorSpace
  );
  const volcanicBasaltAoMap = loadRepeatingTexture(
    '/assets/aistudio/volcanic_basalt_ao_f4b01fd8.png',
    maxAniso,
    4,
    4,
    THREE.NoColorSpace
  );
  const volcanicBasaltMetallicMap = loadRepeatingTexture(
    '/assets/aistudio/volcanic_basalt_metallic_64e60d69.png',
    maxAniso,
    4,
    4,
    THREE.NoColorSpace
  );
  const volcanicBasaltEmissiveMap = loadRepeatingTexture(
    '/assets/aistudio/volcanic_basalt_emissive_784e3ee5.png',
    maxAniso,
    4,
    4,
    THREE.SRGBColorSpace
  );
  const volcanicBasaltLavaMaskMap = loadRepeatingTexture(
    '/assets/aistudio/volcanic_basalt_lava_mask_285f410b.png',
    maxAniso,
    4,
    4,
    THREE.NoColorSpace
  );

  const lavaCloudMap = createSeamlessLavaCloudTexture(maxAniso);

  // 1. High-Definition Wet Cyber-Asphalt / Segmented Roadway Albedo, Emissive, Bump & Roughness Maps
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 1024;
  roadCanvas.height = 1024;
  const rCtx = roadCanvas.getContext('2d')!;

  const roadEmissiveCanvas = document.createElement('canvas');
  roadEmissiveCanvas.width = 1024;
  roadEmissiveCanvas.height = 1024;
  const eCtx = roadEmissiveCanvas.getContext('2d')!;

  const roadBumpCanvas = document.createElement('canvas');
  roadBumpCanvas.width = 512;
  roadBumpCanvas.height = 512;
  const bCtx = roadBumpCanvas.getContext('2d')!;

  const roadRoughCanvas = document.createElement('canvas');
  roadRoughCanvas.width = 512;
  roadRoughCanvas.height = 512;
  const rgCtx = roadRoughCanvas.getContext('2d')!;

  // Base deep carbon-anthracite racing asphalt (uniform low-luminance base for maximum figure-ground separation)
  rCtx.fillStyle = isNeon ? '#060911' : '#1e2430';
  rCtx.fillRect(0, 0, 1024, 1024);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 1024, 1024);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  // Uniform satin-matte high-grip asphalt roughness map (prevents localized mirror glare on sloped/banked turns!)
  rgCtx.fillStyle = isNeon ? '#c4c4c4' : '#cccccc';
  rgCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 180; i++) {
    const rx = (i * 53) % 512;
    const ry = (i * 97) % 512;
    const rw = 8 + (i % 24);
    const rh = 64 + (i % 120);
    rgCtx.fillStyle = i % 2 === 0 ? 'rgba(185,185,185,0.22)' : 'rgba(215,215,215,0.22)';
    rgCtx.fillRect(rx, ry, rw, rh);
  }

  // Fine metallic asphalt micro-grain
  for (let i = 0; i < 9000; i++) {
    const x = (i * 73) % 1024;
    const y = (i * 137) % 1024;
    const v = 10 + (i % 14);
    rCtx.fillStyle = isNeon
      ? `rgba(${v}, ${v + 4}, ${v + 10}, 0.26)`
      : `rgba(${v + 28}, ${v + 32}, ${v + 38}, 0.22)`;
    rCtx.fillRect(x, y, 2, 5);
    bCtx.fillStyle = i % 2 === 0 ? '#888888' : '#787878';
    bCtx.fillRect((x >> 1) % 512, (y >> 1) % 512, 2, 2);
  }

  // Longitudinal recessed metallic lane grooves
  const seamXs = [156, 360, 664, 868];
  for (const sx of seamXs) {
    rCtx.fillStyle = 'rgba(2, 4, 9, 0.92)';
    rCtx.fillRect(sx, 0, 6, 1024);
    rCtx.fillStyle = isCity ? 'rgba(251, 191, 36, 0.28)' : 'rgba(0, 242, 254, 0.28)';
    rCtx.fillRect(sx + 6, 0, 2, 1024);
    bCtx.fillStyle = '#505050';
    bCtx.fillRect(sx >> 1, 0, 2, 512);
  }

  // Horizontal expansion joints / metallic drainage grates across track slabs
  const numSlabs = 8;
  for (let s = 0; s < numSlabs; s++) {
    const y = (s * 1024) / numSlabs;
    rCtx.fillStyle = '#03050a';
    rCtx.fillRect(0, y, 1024, 10);
    rCtx.fillStyle = '#161e2e';
    rCtx.fillRect(0, y + 10, 1024, 3);

    bCtx.fillStyle = '#484848';
    bCtx.fillRect(0, y / 2, 512, 5);
  }

  // Heterogeneous High-Contrast Outer Curb Rumble Strips & Boundary Lines:
  // - City Track: Warm Solar Gold (#fbbf24) & Crisp White (#f8fafc) curb blocks (contrasts sharply against cool blue/violet city skyline)
  // - Lava Track: Cool Electric Cyan (#00f2fe) & Crisp White (#f8fafc) curb blocks (contrasts sharply against warm orange/red volcano)
  const primaryTrackAccent = isCity ? '#fbbf24' : '#00f2fe';
  const primaryTrackEmissive = isCity ? '#f59e0b' : '#0284c7';
  const secondaryTrackAccent = '#f8fafc';

  for (let cy = 0; cy < 1024; cy += 64) {
    const isAlt = (cy / 64) % 2 === 0;
    const curbCol = isAlt ? primaryTrackAccent : '#1e293b';
    rCtx.fillStyle = curbCol;
    rCtx.fillRect(8, cy, 34, 58);
    rCtx.fillRect(1024 - 42, cy, 34, 58);

    if (isNeon && isAlt) {
      eCtx.fillStyle = primaryTrackEmissive;
      eCtx.fillRect(8, cy, 34, 58);
      eCtx.fillRect(1024 - 42, cy, 34, 58);
    }
  }

  // Continuous High-Visibility Inner Boundary Edge Lines
  rCtx.fillStyle = primaryTrackAccent;
  rCtx.fillRect(48, 0, 12, 1024);
  rCtx.fillRect(1024 - 60, 0, 12, 1024);
  rCtx.fillStyle = secondaryTrackAccent;
  rCtx.fillRect(64, 0, 5, 1024);
  rCtx.fillRect(1024 - 69, 0, 5, 1024);

  if (isNeon) {
    eCtx.save();
    eCtx.fillStyle = primaryTrackEmissive;
    eCtx.fillRect(48, 0, 12, 1024);
    eCtx.fillRect(1024 - 60, 0, 12, 1024);
    eCtx.fillStyle = '#cbd5e1';
    eCtx.fillRect(64, 0, 5, 1024);
    eCtx.fillRect(1024 - 69, 0, 5, 1024);
    eCtx.restore();
  }

  // Center Spine & High-Contrast Double Lane Dashes
  const centerX = 512;
  rCtx.fillStyle = '#03050a';
  rCtx.fillRect(centerX - 24, 0, 48, 1024);

  rCtx.fillStyle = primaryTrackAccent;
  rCtx.fillRect(centerX - 4, 0, 8, 1024);
  if (isNeon) {
    eCtx.fillStyle = primaryTrackEmissive;
    eCtx.fillRect(centerX - 4, 0, 8, 1024);
  }

  // Double dashed high-visibility lane lines flanking center spine
  for (let dy = 16; dy < 1024; dy += 128) {
    rCtx.fillStyle = secondaryTrackAccent;
    rCtx.fillRect(centerX - 38, dy, 10, 84);
    rCtx.fillRect(centerX + 28, dy, 10, 84);
    if (isNeon) {
      eCtx.fillStyle = '#94a3b8';
      eCtx.fillRect(centerX - 38, dy, 10, 84);
      eCtx.fillRect(centerX + 28, dy, 10, 84);
    }
  }

  const roadMap = new THREE.CanvasTexture(roadCanvas);
  roadMap.colorSpace = THREE.SRGBColorSpace;
  roadMap.wrapS = THREE.RepeatWrapping;
  roadMap.wrapT = THREE.RepeatWrapping;
  roadMap.repeat.set(1, 56);
  roadMap.anisotropy = maxAniso;

  const roadEmissiveMap = new THREE.CanvasTexture(roadEmissiveCanvas);
  roadEmissiveMap.colorSpace = THREE.SRGBColorSpace;
  roadEmissiveMap.wrapS = THREE.RepeatWrapping;
  roadEmissiveMap.wrapT = THREE.RepeatWrapping;
  roadEmissiveMap.repeat.set(1, 56);
  roadEmissiveMap.anisotropy = maxAniso;

  const roadBumpMap = new THREE.CanvasTexture(roadBumpCanvas);
  roadBumpMap.wrapS = THREE.RepeatWrapping;
  roadBumpMap.wrapT = THREE.RepeatWrapping;
  roadBumpMap.repeat.set(1, 56);
  roadBumpMap.anisotropy = maxAniso;

  const roadRoughnessMap = new THREE.CanvasTexture(roadRoughCanvas);
  roadRoughnessMap.wrapS = THREE.RepeatWrapping;
  roadRoughnessMap.wrapT = THREE.RepeatWrapping;
  roadRoughnessMap.repeat.set(1, 56);
  roadRoughnessMap.anisotropy = maxAniso;

  // 2. Monumental Neo-Metropolis Architectural Facade Texture (1024x1024)
  // Designed for clean primary/secondary/tertiary architectural reads:
  // - Deep obsidian-indigo glass curtain walls (70% dark reflective mass so silhouettes read cleanly)
  // - Bold continuous vertical neon laser channels & structural exoskeleton ribs
  // - Clean horizontal illuminated sky-lobby atriums & disciplined cool-cyan/magenta window ribbons
  const bldCanvas = document.createElement('canvas');
  bldCanvas.width = 1024;
  bldCanvas.height = 1024;
  const bldCtx = bldCanvas.getContext('2d')!;

  const bldEmissiveCanvas = document.createElement('canvas');
  bldEmissiveCanvas.width = 1024;
  bldEmissiveCanvas.height = 1024;
  const bldECtx = bldEmissiveCanvas.getContext('2d')!;

  // Disciplined Horizontal Architectural Bands & Ribbon Windows (32 major stories)
  const primaryGlow = isCity ? '#00f2fe' : '#fb923c';
  const secondaryGlow = isCity ? '#ff2a85' : '#fde047';
  const tertiaryGlow = isCity ? '#a855f7' : '#ef4444';

  const drawBuildingArchitecturalOverlays = () => {
    // Heavy Primary Structural Exoskeleton Piers (every 256px)
    for (let x = 0; x <= 1024; x += 256) {
      bldCtx.fillStyle = isNeon ? '#03050b' : '#1e293b';
      bldCtx.fillRect(x - 10, 0, 20, 1024);
    }

    // Bold Continuous Vertical Neon Laser Channels along the 4 Exoskeleton Zones
    if (isNeon) {
      const verticalChannels = [
        { x: 16, w: 6, color: primaryGlow },
        { x: 240, w: 5, color: secondaryGlow },
        { x: 272, w: 6, color: primaryGlow },
        { x: 506, w: 6, color: '#e0f2fe' },
        { x: 528, w: 5, color: secondaryGlow },
        { x: 752, w: 6, color: primaryGlow },
        { x: 784, w: 5, color: tertiaryGlow },
        { x: 1002, w: 6, color: primaryGlow },
      ];

      bldECtx.save();
      for (const ch of verticalChannels) {
        bldECtx.shadowColor = ch.color;
        bldECtx.shadowBlur = 12;
        bldECtx.fillStyle = ch.color;
        bldECtx.fillRect(ch.x, 0, ch.w, 1024);
      }

      // Two Monumental Recessed Cyber-Signage Monolith Panels on the Facade
      const panels = [
        { x: 84, y: 160, w: 88, h: 420, border: primaryGlow, fill: secondaryGlow },
        { x: 600, y: 320, w: 88, h: 440, border: secondaryGlow, fill: primaryGlow },
      ];
      for (const p of panels) {
        bldCtx.fillStyle = '#03050c';
        bldCtx.fillRect(p.x, p.y, p.w, p.h);

        bldECtx.fillStyle = '#000000';
        bldECtx.fillRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);

        bldECtx.strokeStyle = p.border;
        bldECtx.shadowColor = p.border;
        bldECtx.shadowBlur = 14;
        bldECtx.lineWidth = 5;
        bldECtx.strokeRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);

        // Bold Minimalist Futuristic Vector Chevron & Bars inside Monolith
        bldECtx.fillStyle = p.fill;
        bldECtx.fillRect(p.x + 18, p.y + 28, p.w - 36, 12);
        bldECtx.fillRect(p.x + 18, p.y + 52, p.w - 52, 8);

        // Large glowing diamond emblem
        const cx = p.x + p.w * 0.5;
        const cy = p.y + p.h * 0.45;
        bldECtx.beginPath();
        bldECtx.moveTo(cx, cy - 42);
        bldECtx.lineTo(cx + 28, cy);
        bldECtx.lineTo(cx, cy + 42);
        bldECtx.lineTo(cx - 28, cy);
        bldECtx.closePath();
        bldECtx.fill();

        // Horizontal telemetry bars in lower half of monolith
        bldECtx.fillStyle = '#e0f2fe';
        for (let by = p.y + p.h - 140; by < p.y + p.h - 24; by += 22) {
          bldECtx.fillRect(p.x + 20, by, p.w - 40, 8);
        }
      }
      bldECtx.restore();
    }
  };

  // Deep obsidian-indigo architectural glass base
  const baseGrad = bldCtx.createLinearGradient(0, 0, 0, 1024);
  if (isNeon) {
    baseGrad.addColorStop(0, '#050814');
    baseGrad.addColorStop(0.5, '#091024');
    baseGrad.addColorStop(1, '#04060e');
  } else {
    baseGrad.addColorStop(0, '#475569');
    baseGrad.addColorStop(0.5, '#334155');
    baseGrad.addColorStop(1, '#1e293b');
  }
  bldCtx.fillStyle = baseGrad;
  bldCtx.fillRect(0, 0, 1024, 1024);

  bldECtx.fillStyle = '#000000';
  bldECtx.fillRect(0, 0, 1024, 1024);

  // Subtle dark glass curtain-wall mullion grid (gives metallic specular surface detail without visual noise)
  bldCtx.fillStyle = isNeon ? '#0d1730' : '#475569';
  for (let x = 0; x < 1024; x += 32) {
    bldCtx.fillRect(x, 0, 2, 1024);
  }
  for (let y = 0; y < 1024; y += 16) {
    bldCtx.fillRect(0, y, 1024, 2);
  }

  for (let floor = 0; floor < 32; floor++) {
    const fy = floor * 32;

    // Every 8th floor: Double-Height Illuminated Sky-Lobby / Horizon Ring Band
    if (floor % 8 === 0) {
      bldCtx.fillStyle = isNeon ? '#040710' : '#1e293b';
      bldCtx.fillRect(0, fy, 1024, 28);

      if (isNeon) {
        const bandColor = floor % 16 === 0 ? primaryGlow : secondaryGlow;
        bldECtx.save();
        bldECtx.shadowColor = bandColor;
        bldECtx.shadowBlur = 10;
        bldECtx.fillStyle = bandColor;
        bldECtx.fillRect(0, fy + 4, 1024, 5);
        bldECtx.fillRect(0, fy + 20, 1024, 3);
        bldECtx.restore();

        // Sleek long horizontal atrium glass strips
        bldECtx.fillStyle = '#e0f2fe';
        for (let bx = 28; bx < 1024; bx += 256) {
          bldECtx.fillRect(bx, fy + 11, 200, 6);
        }
      }
      continue;
    }

    // Standard floors: Clean, sparse horizontal executive ribbon windows (leaves 65% dark glass for clean look!)
    for (let sec = 0; sec < 4; sec++) {
      const sx = sec * 256;
      const seed = (floor * 17 + sec * 31) % 16;

      // Only light ~35% of suites in cohesive horizontal strips so buildings look sleek, not speckled
      if (seed < 5) {
        const stripW = seed < 2 ? 176 : 96;
        const stripX = sx + (seed % 2 === 0 ? 36 : 112);
        const winHue =
          seed === 0
            ? secondaryGlow
            : seed === 1
            ? '#e0f2fe'
            : seed === 2
            ? primaryGlow
            : tertiaryGlow;

        bldCtx.fillStyle = isNeon ? '#162447' : '#64748b';
        bldCtx.fillRect(stripX, fy + 8, stripW, 12);

        if (isNeon) {
          bldECtx.fillStyle = winHue;
          bldECtx.globalAlpha = seed < 2 ? 0.92 : 0.68;
          bldECtx.fillRect(stripX, fy + 9, stripW, 10);
          // Internal mullion dividers inside the horizontal ribbon window
          bldECtx.fillStyle = '#050814';
          bldECtx.globalAlpha = 1.0;
          for (let mx = stripX + 32; mx < stripX + stripW; mx += 32) {
            bldECtx.fillRect(mx, fy + 8, 3, 12);
          }
        }
      }
    }
  }

  drawBuildingArchitecturalOverlays();

  const buildingMap = new THREE.CanvasTexture(bldCanvas);
  buildingMap.colorSpace = THREE.SRGBColorSpace;
  buildingMap.wrapS = THREE.RepeatWrapping;
  buildingMap.wrapT = THREE.RepeatWrapping;
  buildingMap.anisotropy = maxAniso;

  const buildingEmissiveMap = new THREE.CanvasTexture(bldEmissiveCanvas);
  buildingEmissiveMap.colorSpace = THREE.SRGBColorSpace;
  buildingEmissiveMap.wrapS = THREE.RepeatWrapping;
  buildingEmissiveMap.wrapT = THREE.RepeatWrapping;
  buildingEmissiveMap.anisotropy = maxAniso;

  // On upgraded 'city' (MK-II), composite 06_city_window_facade_c6d256d2.png into buildingMap & buildingEmissiveMap
  if (isCityV2) {
    loadCachedImage('/assets/aistudio/06_city_window_facade_c6d256d2.png', (facadeImg) => {
      bldCtx.save();
      bldCtx.globalAlpha = 0.96;
      for (let tx = 0; tx < 2; tx++) {
        for (let ty = 0; ty < 2; ty++) {
          bldCtx.drawImage(facadeImg, tx * 512, ty * 512, 512, 512);
        }
      }
      bldCtx.restore();

      if (isNeon) {
        bldECtx.save();
        bldECtx.fillStyle = '#000000';
        bldECtx.fillRect(0, 0, 1024, 1024);
        bldECtx.globalAlpha = 0.88;
        for (let tx = 0; tx < 2; tx++) {
          for (let ty = 0; ty < 2; ty++) {
            bldECtx.drawImage(facadeImg, tx * 512, ty * 512, 512, 512);
          }
        }
        bldECtx.restore();
      }

      // Layer the exoskeleton piers, sky-lobby neon bands, vertical laser channels & monoliths cleanly on top
      for (let floor = 0; floor < 32; floor += 8) {
        const fy = floor * 32;
        bldCtx.fillStyle = isNeon ? '#040710' : '#1e293b';
        bldCtx.fillRect(0, fy, 1024, 24);
        if (isNeon) {
          const bandColor = floor % 16 === 0 ? primaryGlow : secondaryGlow;
          bldECtx.save();
          bldECtx.shadowColor = bandColor;
          bldECtx.shadowBlur = 10;
          bldECtx.fillStyle = bandColor;
          bldECtx.fillRect(0, fy + 4, 1024, 5);
          bldECtx.fillRect(0, fy + 16, 1024, 3);
          bldECtx.restore();
        }
      }
      drawBuildingArchitecturalOverlays();
      buildingMap.needsUpdate = true;
      buildingEmissiveMap.needsUpdate = true;
    });
  }

  // 2B. High-Contrast Holographic Cyber-Billboard Texture (512x256) for Trackside & Skyline Holo-Ads
  const holoCanvas = document.createElement('canvas');
  holoCanvas.width = 512;
  holoCanvas.height = 256;
  const hCtx = holoCanvas.getContext('2d')!;

  hCtx.fillStyle = 'rgba(4, 9, 24, 0.82)';
  hCtx.fillRect(0, 0, 512, 256);

  // Outer Neon Frame & Corner Brackets
  const primaryHolo = isCity ? '#00f2fe' : '#fb923c';
  const secondaryHolo = isCity ? '#f43f5e' : '#fde047';

  hCtx.strokeStyle = primaryHolo;
  hCtx.lineWidth = 6;
  hCtx.strokeRect(10, 10, 492, 236);

  hCtx.strokeStyle = secondaryHolo;
  hCtx.lineWidth = 3;
  hCtx.strokeRect(20, 20, 472, 216);

  // Diagonal Cyber Telemetry Stripes
  hCtx.fillStyle = secondaryHolo;
  for (let i = 0; i < 6; i++) {
    hCtx.beginPath();
    hCtx.moveTo(34 + i * 22, 34);
    hCtx.lineTo(48 + i * 22, 34);
    hCtx.lineTo(36 + i * 22, 58);
    hCtx.lineTo(22 + i * 22, 58);
    hCtx.closePath();
    hCtx.fill();
  }

  // Bold Sector / League Typography
  hCtx.save();
  hCtx.shadowColor = primaryHolo;
  hCtx.shadowBlur = 14;
  hCtx.fillStyle = '#ffffff';
  hCtx.font = '900 38px "Orbitron", "Segoe UI", sans-serif';
  hCtx.fillText(isCity ? 'AERO-X // NEO-KYOTO' : 'CALDERA // MAGMA-09', 34, 118);

  hCtx.fillStyle = primaryHolo;
  hCtx.font = '700 22px "JetBrains Mono", monospace';
  hCtx.fillText('AG-LEAGUE HYPER-CIRCUIT // MACH 1.4', 36, 158);
  hCtx.restore();

  // Equalizer / Telemetry Waveform Bars along bottom right
  for (let b = 0; b < 18; b++) {
    const bh = 14 + ((b * 19) % 38);
    hCtx.fillStyle = b % 3 === 0 ? secondaryHolo : primaryHolo;
    hCtx.fillRect(36 + b * 24, 218 - bh, 16, bh);
  }

  const holoBillboardMap = new THREE.CanvasTexture(holoCanvas);
  holoBillboardMap.colorSpace = THREE.SRGBColorSpace;
  holoBillboardMap.anisotropy = maxAniso;

  // 3. Soft Radial Contact Shadow Disc beneath AG Ships
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(128, 128, 10, 128, 128, 122);
  grad.addColorStop(0, 'rgba(0, 242, 254, 0.72)');
  grad.addColorStop(0.28, 'rgba(56, 189, 248, 0.35)');
  grad.addColorStop(0.6, 'rgba(2, 6, 23, 0.65)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 256, 256);

  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;

  // 4. Volumetric Thruster Lens-Flare / Bloom Sprite Texture
  const flareCanvas = document.createElement('canvas');
  flareCanvas.width = 256;
  flareCanvas.height = 256;
  const fCtx = flareCanvas.getContext('2d')!;
  const fGrad = fCtx.createRadialGradient(128, 128, 4, 128, 128, 124);
  fGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  fGrad.addColorStop(0.18, 'rgba(186, 230, 253, 0.92)');
  fGrad.addColorStop(0.45, 'rgba(0, 242, 254, 0.48)');
  fGrad.addColorStop(0.75, 'rgba(168, 85, 247, 0.16)');
  fGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  fCtx.fillStyle = fGrad;
  fCtx.fillRect(0, 0, 256, 256);

  // Horizontal anamorphic lens flare streak
  const streakGrad = fCtx.createLinearGradient(0, 128, 256, 128);
  streakGrad.addColorStop(0, 'rgba(0, 242, 254, 0)');
  streakGrad.addColorStop(0.35, 'rgba(56, 189, 248, 0.45)');
  streakGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
  streakGrad.addColorStop(0.65, 'rgba(56, 189, 248, 0.45)');
  streakGrad.addColorStop(1, 'rgba(0, 242, 254, 0)');
  fCtx.fillStyle = streakGrad;
  fCtx.fillRect(8, 122, 240, 12);

  const thrusterFlareMap = new THREE.CanvasTexture(flareCanvas);
  thrusterFlareMap.colorSpace = THREE.SRGBColorSpace;

  // 5. Turn Warning Triple-Chevron Sign Texture (`>>>` matching FLOWING ARROWS / HAIRPIN decal style)
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 256;
  const sgCtx = signCanvas.getContext('2d')!;
  sgCtx.fillStyle = '#060911';
  sgCtx.fillRect(0, 0, 512, 256);

  // Dark beveled gunmetal frame with corner bolts
  sgCtx.strokeStyle = '#1e293b';
  sgCtx.lineWidth = 14;
  sgCtx.strokeRect(7, 7, 498, 242);

  // Top & bottom glowing red-amber LED rails (matching Screenshot_from_2026-10-29_22-06-44)
  const railGrad = sgCtx.createLinearGradient(0, 0, 512, 0);
  railGrad.addColorStop(0, '#ea580c');
  railGrad.addColorStop(0.5, '#fef08a');
  railGrad.addColorStop(1, '#ef4444');
  sgCtx.fillStyle = railGrad;
  sgCtx.shadowColor = '#f97316';
  sgCtx.shadowBlur = 14;
  sgCtx.fillRect(18, 14, 476, 8);
  sgCtx.fillRect(18, 234, 476, 8);

  // 3 stacked directional chevrons (`>>>`) with IDLE -> FLOWING ARROWS brightness progression
  const chevXs = [58, 198, 338];
  const chevAlphas = [0.42, 0.88, 1.0];
  for (let c = 0; c < 3; c++) {
    const cx = chevXs[c];
    const alpha = chevAlphas[c];
    sgCtx.save();
    sgCtx.globalAlpha = alpha;
    sgCtx.shadowColor = c === 2 ? '#ff4500' : '#f59e0b';
    sgCtx.shadowBlur = c === 2 ? 24 : 16;

    const cGrad = sgCtx.createLinearGradient(cx, 38, cx + 115, 218);
    cGrad.addColorStop(0, c === 2 ? '#fef08a' : '#fbbf24');
    cGrad.addColorStop(0.55, '#f97316');
    cGrad.addColorStop(1, '#ef4444');
    sgCtx.fillStyle = cGrad;

    sgCtx.beginPath();
    sgCtx.moveTo(cx, 42);
    sgCtx.lineTo(cx + 56, 42);
    sgCtx.lineTo(cx + 112, 128);
    sgCtx.lineTo(cx + 56, 214);
    sgCtx.lineTo(cx, 214);
    sgCtx.lineTo(cx + 56, 128);
    sgCtx.closePath();
    sgCtx.fill();

    // Crisp bright edge outline
    sgCtx.strokeStyle = c === 2 ? '#ffffff' : '#fde047';
    sgCtx.lineWidth = 3;
    sgCtx.stroke();
    sgCtx.restore();
  }

  const chevronSignMap = new THREE.CanvasTexture(signCanvas);
  chevronSignMap.colorSpace = THREE.SRGBColorSpace;

  // Composite authored road textures deterministically into the road deck texture
  let panelImg: HTMLImageElement | null = null;
  let cyanPanelImg: HTMLImageElement | null = null;

  // City V2 dedicated road deck textures
  let cityWetImg: HTMLImageElement | null = null;
  let cityCorridorImg: HTMLImageElement | null = null;

  // Helper to paint the beveled metallic road tile grid & alternating Cyan/Amber-Orange embedded curb lights
  // matching the In-Game Examples in `good_game_assets_aacb9e02.png` and `Screenshot_from_2026-10-29_22-07-54_7c765c69.png`
  const drawBeveledRoadTilesAndCurbLights = (isCityDeck: boolean) => {
    // 1) Segmented Metallic Roadway Tile Seams & Bevel Highlights (across the driving deck)
    for (let s = 0; s < 8; s++) {
      const y = (s * 1024) / 8;
      // Dark recessed transverse expansion joint
      rCtx.fillStyle = '#020409';
      rCtx.fillRect(58, y, 1024 - 116, 7);
      // Specular metallic bevel edge along tile lip
      rCtx.fillStyle = isCityDeck ? '#1e293b' : '#263248';
      rCtx.fillRect(58, y + 7, 1024 - 116, 3);
      // Bump map crease
      bCtx.fillStyle = '#050505';
      bCtx.fillRect(29, y * 0.5, 512 - 58, 4);
    }
    // Longitudinal armor plate seam lines with subtle rivet dots
    const seamXs = [168, 340, 512, 684, 856];
    for (const sx of seamXs) {
      rCtx.fillStyle = 'rgba(2, 5, 12, 0.72)';
      rCtx.fillRect(sx - 2, 0, 4, 1024);
      rCtx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      rCtx.fillRect(sx + 2, 0, 2, 1024);
    }

    // 2) Beveled Dark Gunmetal Outer Curb Housing with Alternating Cyan (#00e5ff) & Amber-Orange (#ff8c00)
    // Recessed Rectangular LED Curb Modules (matching `Screenshot_from_2026-10-29_22-07-54_7c765c69.png`)
    rCtx.fillStyle = '#0b111e';
    rCtx.fillRect(0, 0, 54, 1024);
    rCtx.fillRect(1024 - 54, 0, 54, 1024);

    // Metallic bevel lip separating curb housing from road deck
    rCtx.fillStyle = '#334155';
    rCtx.fillRect(50, 0, 4, 1024);
    rCtx.fillRect(1024 - 54, 0, 4, 1024);

    for (let cy = 0; cy < 1024; cy += 64) {
      const slotIdx = Math.floor(cy / 64);
      const isCyanModule = slotIdx % 2 === 0;
      const coreColor = isCyanModule ? '#38bdf8' : '#fb923c';
      const hotCenterColor = isCyanModule ? '#e0f2fe' : '#fef08a';
      const emissiveColor = isCyanModule ? '#00e5ff' : '#ff7b00';

      // Dark bolted curb recess plate
      rCtx.fillStyle = '#050811';
      rCtx.fillRect(6, cy + 4, 38, 56);
      rCtx.fillRect(1024 - 44, cy + 4, 38, 56);
      rCtx.strokeStyle = '#1e293b';
      rCtx.lineWidth = 2;
      rCtx.strokeRect(6, cy + 4, 38, 56);
      rCtx.strokeRect(1024 - 44, cy + 4, 38, 56);

      // Glowing rectangular LED module inset
      rCtx.fillStyle = coreColor;
      rCtx.fillRect(12, cy + 12, 26, 40);
      rCtx.fillRect(1024 - 38, cy + 12, 26, 40);

      // White-hot inner filament core
      rCtx.fillStyle = hotCenterColor;
      rCtx.fillRect(17, cy + 18, 16, 28);
      rCtx.fillRect(1024 - 33, cy + 18, 16, 28);

      if (isNeon) {
        eCtx.fillStyle = emissiveColor;
        eCtx.fillRect(11, cy + 11, 28, 42);
        eCtx.fillRect(1024 - 39, cy + 11, 28, 42);
      }
    }
  };

  const compositeRoadOverlays = () => {
    if (isCityV2) {
      // Upgraded Cyber-City MK-II Road Deck:
      // Deep carbon-anthracite metallic base (#060911) with beveled armor tiles & Cyan/Amber curb lights
      rCtx.fillStyle = isNeon ? '#060911' : '#1e2430';
      rCtx.fillRect(0, 0, 1024, 1024);

      if (cityWetImg) {
        rCtx.save();
        rCtx.globalAlpha = isNeon ? 0.24 : 0.35;
        for (let tx = 0; tx < 2; tx++) {
          for (let ty = 0; ty < 4; ty++) {
            rCtx.drawImage(cityWetImg, tx * 512, ty * 256, 512, 256);
          }
        }
        rCtx.restore();

        rCtx.fillStyle = isNeon ? 'rgba(5, 8, 15, 0.56)' : 'rgba(24, 30, 42, 0.42)';
        rCtx.fillRect(58, 0, 1024 - 116, 1024);

        bCtx.save();
        bCtx.globalAlpha = 0.85;
        for (let tx = 0; tx < 2; tx++) {
          for (let ty = 0; ty < 4; ty++) {
            bCtx.drawImage(cityWetImg, tx * 256, ty * 128, 256, 128);
          }
        }
        bCtx.restore();
      }

      if (cityCorridorImg) {
        rCtx.save();
        rCtx.globalAlpha = 0.38;
        for (let ty = 0; ty < 4; ty++) {
          rCtx.drawImage(cityCorridorImg, 54, ty * 256, 52, 256);
          rCtx.drawImage(cityCorridorImg, 1024 - 106, ty * 256, 52, 256);
        }
        rCtx.restore();
      }

      rCtx.save();
      eCtx.save();
      eCtx.fillStyle = '#000000';
      eCtx.fillRect(0, 0, 1024, 1024);

      drawBeveledRoadTilesAndCurbLights(true);

      // Continuous Bright Solar-Gold & Electric-Cyan Outer Track Boundary Lines
      rCtx.fillStyle = '#fbbf24';
      rCtx.fillRect(56, 0, 10, 1024);
      rCtx.fillRect(1024 - 66, 0, 10, 1024);

      rCtx.fillStyle = '#38bdf8';
      rCtx.fillRect(70, 0, 6, 1024);
      rCtx.fillRect(1024 - 76, 0, 6, 1024);

      // Center Spine + Racing Lane Dashes
      rCtx.fillStyle = '#fbbf24';
      rCtx.fillRect(centerX - 4, 0, 8, 1024);

      for (let dy = 14; dy < 1024; dy += 64) {
        rCtx.fillStyle = '#fbbf24';
        rCtx.fillRect(268, dy, 8, 38);
        rCtx.fillRect(1024 - 276, dy, 8, 38);

        if (isNeon) {
          eCtx.fillStyle = '#d97706';
          eCtx.fillRect(268, dy, 8, 38);
          eCtx.fillRect(1024 - 276, dy, 8, 38);
        }
      }

      if (isNeon) {
        eCtx.fillStyle = '#f59e0b';
        eCtx.fillRect(56, 0, 10, 1024);
        eCtx.fillRect(1024 - 66, 0, 10, 1024);
        eCtx.fillRect(centerX - 4, 0, 8, 1024);

        eCtx.fillStyle = '#00e5ff';
        eCtx.fillRect(70, 0, 6, 1024);
        eCtx.fillRect(1024 - 76, 0, 6, 1024);
      }

      eCtx.restore();
      rCtx.restore();

      roadBumpMap.needsUpdate = true;
      roadMap.needsUpdate = true;
      roadEmissiveMap.needsUpdate = true;
      return;
    }

    if (trackId === 'lava_v2') {
      // V2 Textured Lava Circuit matching the In-Game Examples in `good_game_assets_aacb9e02.png`!
      rCtx.fillStyle = '#060a14';
      rCtx.fillRect(0, 0, 1024, 1024);

      if (panelImg) {
        rCtx.save();
        rCtx.globalAlpha = 0.80;
        for (let tx = 0; tx < 2; tx++) {
          for (let ty = 0; ty < 4; ty++) {
            rCtx.drawImage(panelImg, tx * 512, ty * 256, 512, 256);
          }
        }
        rCtx.restore();

        bCtx.save();
        bCtx.globalAlpha = 0.85;
        for (let tx = 0; tx < 2; tx++) {
          for (let ty = 0; ty < 4; ty++) {
            bCtx.drawImage(panelImg, tx * 256, ty * 128, 256, 128);
          }
        }
        bCtx.restore();
      }

      if (cyanPanelImg) {
        rCtx.save();
        rCtx.globalAlpha = 0.45;
        for (let ty = 0; ty < 4; ty++) {
          rCtx.save();
          rCtx.translate(64, ty * 256 + 128);
          rCtx.rotate(Math.PI / 2);
          rCtx.drawImage(cyanPanelImg, -128, -24, 256, 48);
          rCtx.restore();

          rCtx.save();
          rCtx.translate(1024 - 64, ty * 256 + 128);
          rCtx.rotate(-Math.PI / 2);
          rCtx.drawImage(cyanPanelImg, -128, -24, 256, 48);
          rCtx.restore();
        }
        rCtx.restore();
      }

      rCtx.save();
      eCtx.save();
      eCtx.fillStyle = '#000000';
      eCtx.fillRect(0, 0, 1024, 1024);

      drawBeveledRoadTilesAndCurbLights(false);

      // Continuous Electric Cyan & Warm Amber Outer Track Boundary Lines
      rCtx.fillStyle = '#00f2fe';
      rCtx.fillRect(56, 0, 10, 1024);
      rCtx.fillRect(1024 - 66, 0, 10, 1024);
      rCtx.fillStyle = '#f97316';
      rCtx.fillRect(70, 0, 6, 1024);
      rCtx.fillRect(1024 - 76, 0, 6, 1024);

      // Parallel Blue & Orange Longitudinal Lane Stripes
      rCtx.fillStyle = '#f97316';
      rCtx.fillRect(184, 0, 8, 1024);
      rCtx.fillRect(1024 - 192, 0, 8, 1024);
      rCtx.fillStyle = '#38bdf8';
      rCtx.fillRect(200, 0, 8, 1024);
      rCtx.fillRect(1024 - 208, 0, 8, 1024);

      // Center double-amber spine + Luminous Twin White-Cyan Tracking Dashes
      rCtx.fillStyle = '#f97316';
      rCtx.fillRect(centerX - 18, 0, 8, 1024);
      rCtx.fillRect(centerX + 10, 0, 8, 1024);

      for (let dy = 18; dy < 1024; dy += 128) {
        rCtx.fillStyle = '#f8fafc';
        rCtx.fillRect(centerX - 68, dy, 10, 72);
        rCtx.fillRect(centerX + 58, dy, 10, 72);

        if (isNeon) {
          eCtx.fillStyle = '#bae6fd';
          eCtx.fillRect(centerX - 68, dy, 10, 72);
          eCtx.fillRect(centerX + 58, dy, 10, 72);
        }
      }

      if (isNeon) {
        eCtx.fillStyle = '#00e5ff';
        eCtx.fillRect(56, 0, 10, 1024);
        eCtx.fillRect(1024 - 66, 0, 10, 1024);
        eCtx.fillStyle = '#ea580c';
        eCtx.fillRect(70, 0, 6, 1024);
        eCtx.fillRect(1024 - 76, 0, 6, 1024);
        eCtx.fillRect(184, 0, 8, 1024);
        eCtx.fillRect(1024 - 192, 0, 8, 1024);
        eCtx.fillRect(centerX - 18, 0, 8, 1024);
        eCtx.fillRect(centerX + 10, 0, 8, 1024);
        eCtx.fillStyle = '#0284c7';
        eCtx.fillRect(200, 0, 8, 1024);
        eCtx.fillRect(1024 - 208, 0, 8, 1024);
      }

      eCtx.restore();
      rCtx.restore();

      roadBumpMap.needsUpdate = true;
      roadMap.needsUpdate = true;
      roadEmissiveMap.needsUpdate = true;
      return;
    }

    if (panelImg) {
      rCtx.save();
      rCtx.globalAlpha = trackId === 'lava' ? 0.72 : 0.45;
      for (let tx = 0; tx < 2; tx++) {
        for (let ty = 0; ty < 2; ty++) {
          rCtx.drawImage(panelImg, tx * 512, ty * 512, 512, 512);
        }
      }
      rCtx.restore();

      bCtx.save();
      bCtx.globalAlpha = 0.65;
      for (let tx = 0; tx < 2; tx++) {
        for (let ty = 0; ty < 2; ty++) {
          bCtx.drawImage(panelImg, tx * 256, ty * 256, 256, 256);
        }
      }
      bCtx.restore();
      roadBumpMap.needsUpdate = true;
    }

    // Re-reinforce heterogeneous outer curb lines and center spine cleanly on top
    rCtx.save();
    rCtx.globalAlpha = 1.0;
    const legacyAccent = isCity ? '#fbbf24' : '#00f2fe';
    rCtx.fillStyle = legacyAccent;
    rCtx.fillRect(48, 0, 12, 1024);
    rCtx.fillRect(1024 - 60, 0, 12, 1024);
    rCtx.fillStyle = '#ffffff';
    rCtx.fillRect(64, 0, 5, 1024);
    rCtx.fillRect(1024 - 69, 0, 5, 1024);
    rCtx.fillStyle = legacyAccent;
    rCtx.fillRect(centerX - 4, 0, 8, 1024);
    rCtx.restore();

    roadMap.needsUpdate = true;
  };

  if (isCityV2) {
    loadCachedImage('/assets/aistudio/01_wet_neon_track_92d2e945.png', (img) => {
      cityWetImg = img;
      compositeRoadOverlays();
    });
    loadCachedImage('/assets/aistudio/08_cyan_corridor_floor_bf8dbc94.png', (img) => {
      cityCorridorImg = img;
      compositeRoadOverlays();
    });
  } else {
    loadCachedImage('/assets/aistudio/01_roadway_panels_92956cd2.png', (img) => {
      panelImg = img;
      compositeRoadOverlays();
    });
    loadCachedImage('/assets/aistudio/05_cyan_neon_surface_ff1a6f38.png', (img) => {
      cyanPanelImg = img;
      compositeRoadOverlays();
    });
  }

  return {
    roadMap,
    roadEmissiveMap,
    roadBumpMap,
    roadRoughnessMap,
    buildingMap,
    buildingEmissiveMap,
    holoBillboardMap,
    contactShadowMap,
    thrusterFlareMap,
    chevronSignMap,
    roadwayPanelsMap,
    obsidianRockMap,
    glowingLavaMap,
    brushedGraphiteMap,
    cyanNeonSurfaceMap,
    amberLaneMarkingsMap,
    volcanicGravelMap,
    cyanGuardrailMap,
    cityWetTrackMap,
    cityArmourPanelsMap,
    cityCyanBarrierMap,
    cityLaneAsphaltMap,
    cityMagentaRailMap,
    cityWindowFacadeMap,
    cityRainbowPavementMap,
    cityCorridorFloorMap,
    cityDecorativeAtlasMap,
    lavaDecorativeAtlas1Map,
    lavaDecorativeAtlas2Map,
    checkpointSignMap,
    cyberSphereSignMap,
    volcanicBasaltAlbedoMap,
    volcanicBasaltNormalMap,
    volcanicBasaltRoughnessMap,
    volcanicBasaltHeightMap,
    volcanicBasaltAoMap,
    volcanicBasaltMetallicMap,
    volcanicBasaltEmissiveMap,
    volcanicBasaltLavaMaskMap,
    lavaCloudMap,
    updateAnimatedTextures,
  };
}
