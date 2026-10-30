import * as THREE from 'three';
import {
  ActiveWeaponId,
  AtmosphereMode,
  EnergyRing,
  PowerUpItemType,
  ShipId,
  TrackId,
  TrackPad,
} from './types';
import {
  POWERUP_ITEMS_ORDER,
  POWERUP_META,
  SHIP_SPECS,
  TRACK_HALF_WIDTH,
  WEAPON_META,
  estimateTrackCurvature,
  isCityTrack,
} from './rules';
import { TrackTextureSet } from './textures';

export const TRACK_SSAO_LAYER = 2;

export function enableTrackSsaoLayer(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (mat && !mat.transparent && mat.depthWrite !== false) {
        mesh.layers.enable(TRACK_SSAO_LAYER);
      }
    }
  });
}

export interface ShipMeshRig {
  root: THREE.Group;
  hullGroup: THREE.Group;
  leftFlame: THREE.Mesh;
  rightFlame: THREE.Mesh;
  leftOuterGlow: THREE.Mesh;
  rightOuterGlow: THREE.Mesh;
  leftContrail: THREE.Mesh;
  rightContrail: THREE.Mesh;
  leftFlare: THREE.Sprite;
  rightFlare: THREE.Sprite;
  plumeGroundGlow: THREE.Mesh;
  shieldMesh: THREE.Mesh;
  laserBeamGroup: THREE.Group;
  shockwaveMesh: THREE.Mesh;
  plumeMaterials: THREE.ShaderMaterial[];
}

/**
 * Custom GLSL Shader for Shock-Diamond Plasma Thruster Plumes
 */
function createPlasmaPlumeShaderMaterial(thrusterColorHex: number): THREE.ShaderMaterial {
  const c = new THREE.Color(thrusterColorHex);
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: c },
      uBoost: { value: 0 },
      uSpeed: { value: 0.2 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uBoost;
      uniform float uSpeed;
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        // vUv.y goes 0 (tip of cone) to 1 (base at nozzle) in ConeGeometry
        float axial = vUv.y;
        float shockwave = 0.76 + 0.24 * sin(axial * 32.0 - uTime * 46.0);
        float diamond = smoothstep(0.22, 0.92, sin(axial * 24.0 - uTime * 38.0)) * axial;
        vec3 whiteHotCore = vec3(0.75, 0.94, 1.0);
        vec3 electricCyan = vec3(0.05, 0.78, 0.96);
        vec3 violetTail = vec3(0.45, 0.16, 0.82);

        vec3 baseCol = mix(violetTail, mix(uColor, electricCyan, 0.55), smoothstep(0.05, 0.62, axial));
        vec3 finalCol = mix(baseCol, whiteHotCore, pow(axial, 1.85) * 0.65 + diamond * 0.28 + uBoost * 0.22);

        float edgeSoft = 0.42 + 0.58 * abs(vNormal.z);
        float throttle = clamp(0.28 + uSpeed * 0.58 + uBoost * 0.24, 0.25, 1.0);
        float alpha = smoothstep(0.0, 0.85, axial) * (0.48 + 0.24 * shockwave) * edgeSoft * throttle;
        gl_FragColor = vec4(finalCol * (0.72 + 0.28 * throttle), clamp(alpha, 0.0, 0.78));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Custom GLSL Shader for Aerodynamic Wingtip Vortex Contrail Ribbons
 */
function createContrailShaderMaterial(accentColorHex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(accentColorHex) },
      uBoost: { value: 0 },
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
      uniform vec3 uColor;
      uniform float uBoost;
      varying vec2 vUv;

      void main() {
        // vUv.y: 1 at wingtip leading edge, 0 at trailing tip
        float fade = pow(vUv.y, 1.5);
        float pulse = 0.78 + 0.22 * sin(vUv.y * 18.0 - uTime * 28.0);
        vec3 col = mix(uColor, vec3(0.88, 0.99, 1.0), uBoost * 0.48 + vUv.y * 0.38);
        float alpha = fade * pulse * (0.32 + uBoost * 0.28);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Custom GLSL Shader for a Feather-Light, Blue-Violet Fresnel Shield Orb with Hexagonal Energy Grid
 * Completely transparent across the center of the craft so it never obstructs player view,
 * with a soft blue-violet rim aura and delicate hexagonal lattice matching the SHIELD POWER-UP design.
 */
function createSoftShieldShaderMaterial(accentColorHex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x4f46e5) },
      uAccent: { value: new THREE.Color(accentColorHex || 0x38bdf8) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uAccent;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vLocalPos;

      float hexDist(vec2 p) {
        p = abs(p);
        return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
      }

      float hexGrid(vec2 uv) {
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h = r * 0.5;
        vec2 a = mod(uv, r) - h;
        vec2 b = mod(uv - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        float d = 0.5 - hexDist(gv);
        return smoothstep(0.06, 0.01, d);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewPosition);
        // Grazing angle Fresnel: 0 at center of craft, 1 only at outer silhouette rim
        float ndotv = abs(dot(N, V));
        float fresnel = pow(clamp(1.0 - ndotv, 0.0, 1.0), 3.1);

        // Subtle hexagonal energy grid projected onto the shield contour
        vec2 hexUv = vLocalPos.xz * 2.8 + vec2(0.0, vLocalPos.y * 2.2);
        float hexLine = hexGrid(hexUv);

        // Soft traveling energy ripple along the hull contour
        float wave = 0.78 + 0.22 * sin(vLocalPos.z * 3.2 - uTime * 5.5 + vLocalPos.x * 2.0);
        vec3 baseOrb = mix(vec3(0.23, 0.36, 0.96), uColor, 0.55);
        vec3 col = mix(baseOrb, uAccent, 0.28 + 0.25 * sin(uTime * 2.2 + vLocalPos.z));
        col = mix(col, vec3(0.75, 0.92, 1.0), hexLine * 0.65 + fresnel * 0.42);

        // Feather-light, non-invasive opacity (0.0 in center, max ~0.26 at extreme grazing rim)
        float alpha = (fresnel * 0.22 + hexLine * fresnel * 0.14) * wave;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.26));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

/**
 * Builds 5 distinct, studio-grade multi-part 3D Anti-Gravity Racing Craft models:
 * 1. `valkyrie`: Cyber-Delta Interceptor with glowing cyan circuit inlays & twin V-tails
 * 2. `spectre` : Forward-Swept X-Wing Stealth Razor with canards & exposed violet reactor spine
 * 3. `titan`   : Twin-Prong Catamaran Heavy Brawler with dual forward sponsons & rear spoiler arch
 * 4. `seraph`  : Orbital Halo-Wing Prototype with closed-loop ring airfoil & dorsal gyro-core
 * 5. `nemesis` : Matte-Obsidian Quad-Katana Hyper-Drifter with bi-plane blades & crimson conduits
 */
export function createShipMesh(
  shipId: ShipId,
  textures: TrackTextureSet,
  isSoftwareGl: boolean
): ShipMeshRig {
  const spec = SHIP_SPECS[shipId];
  const root = new THREE.Group();
  const hullGroup = new THREE.Group();
  root.add(hullGroup);

  // Shared high-grade PBR hull & trim materials
  const primaryMat = new THREE.MeshPhysicalMaterial({
    color: spec.primaryColor,
    map: textures.cityArmourPanelsMap,
    bumpMap: textures.cityArmourPanelsMap,
    bumpScale: 0.04,
    metalness: 0.84,
    roughness: 0.26,
    envMapIntensity: 0.35,
    clearcoat: isSoftwareGl ? 0 : 0.78,
    clearcoatRoughness: 0.16,
  });

  const secondaryArmorMat = new THREE.MeshStandardMaterial({
    color: 0x0b101d,
    map: textures.brushedGraphiteMap,
    metalness: 0.88,
    roughness: 0.32,
  });

  const darkCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x060911,
    metalness: 0.65,
    roughness: 0.58,
  });

  const neonAccentMat = new THREE.MeshBasicMaterial({
    color: spec.accentColor,
  });

  const cyanCircuitMat = new THREE.MeshBasicMaterial({
    color: shipId === 'valkyrie' ? 0x00f2fe : spec.accentColor,
  });

  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x040710,
    metalness: 0.38,
    roughness: 0.05,
    clearcoat: isSoftwareGl ? 0 : 1.0,
  });

  // Helper to add glowing circuit trace strips on the hull
  const addCircuitStrip = (
    w: number,
    h: number,
    len: number,
    x: number,
    y: number,
    z: number,
    rotY = 0,
    rotZ = 0,
    rotX = 0
  ) => {
    const g = new THREE.BoxGeometry(w, h, len);
    const m = new THREE.Mesh(g, cyanCircuitMat);
    m.position.set(x, y, z);
    m.rotation.set(rotX, rotY, rotZ);
    hullGroup.add(m);
  };

  if (shipId === 'valkyrie') {
    // =========================================================================
    // MODEL 1: VALKYRIE AG-01 — Cyber-Delta Interceptor (Reference Hero Craft!)
    // Faceted dark-armored delta hull with glowing cyan circuit traces,
    // swept delta wings, downward winglets, twin canted V-tails & nose splitters
    // =========================================================================
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 3.35); // Razor needle nose
    hullShape.lineTo(0.42, 2.25);
    hullShape.lineTo(0.88, 0.85);
    hullShape.lineTo(1.48, -1.35);
    hullShape.lineTo(1.12, -2.42);
    hullShape.lineTo(-1.12, -2.42);
    hullShape.lineTo(-1.48, -1.35);
    hullShape.lineTo(-0.88, 0.85);
    hullShape.lineTo(-0.42, 2.25);
    hullShape.closePath();

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      steps: 1,
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.13,
      bevelSize: 0.14,
      bevelSegments: 3,
    });
    hullGeo.rotateX(-Math.PI / 2);
    hullGeo.translate(0, 0.32, 0);
    const hullMesh = new THREE.Mesh(hullGeo, primaryMat);
    hullMesh.castShadow = !isSoftwareGl;
    hullGroup.add(hullMesh);

    // Sculpted dorsal armor cowling & side turbine sponsons
    const dorsalCowling = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.3, 2.95), secondaryArmorMat);
    dorsalCowling.position.set(0, 0.65, 0.1);
    hullGroup.add(dorsalCowling);

    for (const side of [-1, 1]) {
      const sponson = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 2.55), primaryMat);
      sponson.position.set(side * 0.74, 0.5, 0.58);
      sponson.rotation.y = -side * 0.065;
      hullGroup.add(sponson);

      // Forward chine splitter blades
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 1.35), secondaryArmorMat);
      splitter.position.set(side * 0.56, 0.34, -1.55);
      splitter.rotation.y = -side * 0.16;
      hullGroup.add(splitter);
    }

    // Swept Delta Main Wings + Downward Anhedral Outer Winglets
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0.76, 0.48);
    wingShape.lineTo(2.74, -1.32);
    wingShape.lineTo(2.58, -2.04);
    wingShape.lineTo(0.88, -1.82);
    wingShape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      steps: 1,
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    wingGeo.rotateX(-Math.PI / 2);

    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, secondaryArmorMat);
      wing.position.set(0, 0.36, 0);
      wing.scale.x = side;
      wing.rotation.z = -side * 0.055;
      hullGroup.add(wing);

      // Outer downward-angled aero winglet
      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.92), primaryMat);
      winglet.position.set(side * 2.64, 0.18, 1.66);
      winglet.rotation.z = -side * 0.42;
      hullGroup.add(winglet);

      // Outward-canted dorsal V-tail stabilizer fin
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.68, 1.15), primaryMat);
      fin.position.set(side * 0.88, 0.76, 1.55);
      fin.rotation.z = -side * 0.36;
      fin.rotation.x = -0.18;
      hullGroup.add(fin);

      // Glowing Cyan Circuitry Inlays matching the Reference Screenshot ship!
      addCircuitStrip(0.055, 0.04, 2.55, side * 0.38, 0.81, 0.12, -side * 0.04);
      addCircuitStrip(0.055, 0.04, 1.95, side * 0.76, 0.65, 0.62, -side * 0.07);
      addCircuitStrip(0.05, 0.04, 2.15, side * 1.68, 0.36, 1.02, -side * 0.68);
      addCircuitStrip(0.05, 0.04, 0.88, side * 1.72, 0.35, 1.84, 0);
    }
    // Central nose circuit spine
    addCircuitStrip(0.07, 0.04, 1.65, 0, 0.62, -2.05, 0, 0, 0.08);
  } else if (shipId === 'spectre') {
    // =========================================================================
    // MODEL 2: SPECTRE NX-7 — Forward-Swept X-Wing Stealth Razor
    // Aggressive forward-swept main wings, twin nose canards, exposed glowing
    // magenta-violet plasma core ribs, and inward-canted stealth tail fins
    // =========================================================================
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 3.65); // Ultra-long needle stealth nose
    hullShape.lineTo(0.34, 2.1);
    hullShape.lineTo(0.72, 0.5);
    hullShape.lineTo(1.18, -1.55);
    hullShape.lineTo(0.92, -2.45);
    hullShape.lineTo(-0.92, -2.45);
    hullShape.lineTo(-1.18, -1.55);
    hullShape.lineTo(-0.72, 0.5);
    hullShape.lineTo(-0.34, 2.1);
    hullShape.closePath();

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      steps: 1,
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.11,
      bevelSegments: 2,
    });
    hullGeo.rotateX(-Math.PI / 2);
    hullGeo.translate(0, 0.34, 0);
    hullGroup.add(new THREE.Mesh(hullGeo, secondaryArmorMat));

    // Exposed glowing violet-magenta reactor core spine ribs
    const coreTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 2.3, 12),
      neonAccentMat
    );
    coreTube.rotation.x = Math.PI / 2;
    coreTube.position.set(0, 0.68, 0.65);
    hullGroup.add(coreTube);

    for (let r = 0; r < 5; r++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 16, Math.PI), secondaryArmorMat);
      rib.position.set(0, 0.68, -0.15 + r * 0.42);
      hullGroup.add(rib);
    }

    // Forward-Swept Scissor Main Wings + Nose Canard Blades
    const fwdWingShape = new THREE.Shape();
    fwdWingShape.moveTo(0.68, -0.55);
    fwdWingShape.lineTo(2.78, 0.45); // Sweeps forward!
    fwdWingShape.lineTo(2.65, -0.28);
    fwdWingShape.lineTo(0.86, -1.75);
    fwdWingShape.closePath();
    const fwdWingGeo = new THREE.ExtrudeGeometry(fwdWingShape, {
      steps: 1,
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    fwdWingGeo.rotateX(-Math.PI / 2);

    for (const side of [-1, 1]) {
      const mainWing = new THREE.Mesh(fwdWingGeo, primaryMat);
      mainWing.position.set(0, 0.38, 0);
      mainWing.scale.x = side;
      hullGroup.add(mainWing);

      // Forward Nose Canards
      const canard = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.36), primaryMat);
      canard.position.set(side * 0.72, 0.42, -1.65);
      canard.rotation.y = side * 0.38;
      hullGroup.add(canard);

      // Inward-canted stealth dorsal tail fins
      const stealthFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 1.25), secondaryArmorMat);
      stealthFin.position.set(side * 0.78, 0.78, 1.58);
      stealthFin.rotation.z = side * 0.32; // Canted inward!
      hullGroup.add(stealthFin);

      // Glowing magenta-pink circuit traces along forward-swept wings
      addCircuitStrip(0.055, 0.04, 2.25, side * 1.72, 0.43, 0.15, side * 0.98);
      addCircuitStrip(0.055, 0.04, 2.4, side * 0.52, 0.56, -0.25, -side * 0.08);
    }
  } else if (shipId === 'titan') {
    // =========================================================================
    // MODEL 3: TITAN V12-G — Twin-Prong Catamaran Heavy Assault Brawler
    // Dual heavy armored forward catamaran sponsons flanking an open magnetic
    // ramming channel, bridged by a central cockpit pod & high rear spoiler arch
    // =========================================================================
    // Central rear core chassis
    const centralChassis = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.42, 2.85), primaryMat);
    centralChassis.position.set(0, 0.46, 0.55);
    hullGroup.add(centralChassis);

    // Twin Heavy Catamaran Forward Sponsons (Prongs)
    for (const side of [-1, 1]) {
      const prongGroup = new THREE.Group();
      const prongBody = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 4.85), primaryMat);
      prongBody.position.set(side * 0.98, 0.44, -0.15);
      prongGroup.add(prongBody);

      // Beveled armored ramming prow tip on each prong
      const prowTip = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.15, 4), secondaryArmorMat);
      prowTip.rotation.x = -Math.PI / 2;
      prowTip.rotation.z = Math.PI / 4;
      prowTip.position.set(side * 0.98, 0.44, -3.12);
      prongGroup.add(prowTip);

      // Exposed molten-amber fusion cooling coils along outer sponson wall
      const coilBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 2.65), neonAccentMat);
      coilBar.position.set(side * 1.32, 0.46, -0.25);
      prongGroup.add(coilBar);

      // Stubby heavy armored side delta barge wings
      const heavyWing = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 1.95), secondaryArmorMat);
      heavyWing.position.set(side * 1.82, 0.38, 0.85);
      heavyWing.rotation.y = -side * 0.28;
      prongGroup.add(heavyWing);

      // Auxiliary outer booster nozzle on each sponson
      const auxNozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.28, 0.48, 16),
        darkCarbonMat
      );
      auxNozzle.rotation.x = Math.PI / 2;
      auxNozzle.position.set(side * 1.12, 0.42, 2.38);
      prongGroup.add(auxNozzle);

      const auxRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 20), neonAccentMat);
      auxRing.position.set(side * 1.12, 0.42, 2.6);
      prongGroup.add(auxRing);

      addCircuitStrip(0.08, 0.04, 4.2, side * 0.98, 0.67, -0.15);
      hullGroup.add(prongGroup);
    }

    // High Overhead Rear Stabilizer Spoiler Arch bridging the two sponsons
    const spoilerDeck = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.1, 0.68), primaryMat);
    spoilerDeck.position.set(0, 1.08, 1.75);
    const spoilerLight = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.05, 0.12), neonAccentMat);
    spoilerLight.position.set(0, 1.08, 2.08);
    hullGroup.add(spoilerDeck, spoilerLight);

    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 0.58), secondaryArmorMat);
      strut.position.set(side * 1.12, 0.78, 1.75);
      strut.rotation.z = side * 0.18;
      hullGroup.add(strut);
    }
  } else if (shipId === 'seraph') {
    // =========================================================================
    // MODEL 4: SERAPH VX-9 — Orbital Halo-Wing Prototype
    // Needle-spear ceramic-white fuselage encircled by a continuous sculpted
    // elliptical Halo Ring-Wing & glowing emerald-aqua anti-gravity gyro core
    // =========================================================================
    const spearGeo = new THREE.ConeGeometry(0.68, 5.8, 6);
    spearGeo.rotateX(-Math.PI / 2);
    spearGeo.scale(1.15, 0.48, 1.0);
    spearGeo.translate(0, 0.44, -0.35);
    hullGroup.add(new THREE.Mesh(spearGeo, primaryMat));

    const rearPod = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.36, 2.25), secondaryArmorMat);
    rearPod.position.set(0, 0.42, 1.25);
    hullGroup.add(rearPod);

    // Sculpted Closed-Loop Elliptical Halo Ring-Wing encircling the fuselage!
    const haloWingGeo = new THREE.TorusGeometry(1.85, 0.14, 10, 48);
    haloWingGeo.rotateX(Math.PI / 2);
    haloWingGeo.scale(1.42, 1.0, 0.78);
    const haloWingMesh = new THREE.Mesh(haloWingGeo, primaryMat);
    haloWingMesh.position.set(0, 0.42, 0.68);
    hullGroup.add(haloWingMesh);

    // Glowing Emerald-Aqua Neon Inner Rim inside the Halo Ring-Wing
    const haloNeonGeo = new THREE.TorusGeometry(1.74, 0.045, 8, 48);
    haloNeonGeo.rotateX(Math.PI / 2);
    haloNeonGeo.scale(1.42, 1.0, 0.78);
    const haloNeonMesh = new THREE.Mesh(haloNeonGeo, neonAccentMat);
    haloNeonMesh.position.set(0, 0.44, 0.68);
    hullGroup.add(haloNeonMesh);

    // Exposed Dorsal Anti-Gravity Gyro-Core Ring behind cockpit
    const gyroRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 10, 28), neonAccentMat);
    gyroRing.rotation.x = Math.PI / 2;
    gyroRing.position.set(0, 0.76, 0.85);
    hullGroup.add(gyroRing);

    // High Swept Central Dorsal Tail Fin
    const centralFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 1.55), primaryMat);
    centralFin.position.set(0, 0.88, 1.55);
    centralFin.rotation.x = -0.24;
    const finNeonEdge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.94, 0.08), neonAccentMat);
    finNeonEdge.position.set(0, 0.88, 2.28);
    finNeonEdge.rotation.x = -0.24;
    hullGroup.add(centralFin, finNeonEdge);

    addCircuitStrip(0.06, 0.04, 3.4, 0, 0.69, -0.85);
  } else {
    // =========================================================================
    // MODEL 5: NEMESIS XR-0 — Cyber-Samurai Quad-Katana Hyper-Drifter
    // Matte-obsidian wedge hull with upper & lower bi-plane katana blade wings,
    // twin dorsal katana spine fins, and glowing crimson-red tachyon conduits
    // =========================================================================
    const wedgeShape = new THREE.Shape();
    wedgeShape.moveTo(0, 3.55);
    wedgeShape.lineTo(0.52, 1.95);
    wedgeShape.lineTo(1.05, 0.35);
    wedgeShape.lineTo(1.52, -1.65);
    wedgeShape.lineTo(1.15, -2.45);
    wedgeShape.lineTo(-1.15, -2.45);
    wedgeShape.lineTo(-1.52, -1.65);
    wedgeShape.lineTo(-1.05, 0.35);
    wedgeShape.lineTo(-0.52, 1.95);
    wedgeShape.closePath();

    const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
      steps: 1,
      depth: 0.3,
      bevelEnabled: true,
      bevelThickness: 0.11,
      bevelSize: 0.12,
      bevelSegments: 2,
    });
    wedgeGeo.rotateX(-Math.PI / 2);
    wedgeGeo.translate(0, 0.32, 0);
    hullGroup.add(new THREE.Mesh(wedgeGeo, secondaryArmorMat));

    // Quad Bi-Plane Katana Aero-Blades (Upper & Lower Swept Wings on each side)
    for (const side of [-1, 1]) {
      // Upper Katana Wing Blade (Dihedral)
      const upperBlade = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.06, 0.62), primaryMat);
      upperBlade.position.set(side * 1.65, 0.62, 0.85);
      upperBlade.rotation.y = -side * 0.42;
      upperBlade.rotation.z = side * 0.18;
      hullGroup.add(upperBlade);

      const upperLaserEdge = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.04, 0.07), neonAccentMat);
      upperLaserEdge.position.set(side * 1.65, 0.63, 0.56);
      upperLaserEdge.rotation.y = -side * 0.42;
      upperLaserEdge.rotation.z = side * 0.18;
      hullGroup.add(upperLaserEdge);

      // Lower Katana Wing Blade (Anhedral)
      const lowerBlade = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.06, 0.68), primaryMat);
      lowerBlade.position.set(side * 1.72, 0.24, 1.05);
      lowerBlade.rotation.y = -side * 0.46;
      lowerBlade.rotation.z = -side * 0.14;
      hullGroup.add(lowerBlade);

      const lowerLaserEdge = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.04, 0.07), neonAccentMat);
      lowerLaserEdge.position.set(side * 1.72, 0.24, 1.38);
      lowerLaserEdge.rotation.y = -side * 0.46;
      lowerLaserEdge.rotation.z = -side * 0.14;
      hullGroup.add(lowerLaserEdge);

      // Twin Dorsal Spine Katana Fins
      const katanaFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 1.65), secondaryArmorMat);
      katanaFin.position.set(side * 0.58, 0.82, 1.38);
      katanaFin.rotation.x = -0.28;
      katanaFin.rotation.z = -side * 0.14;
      hullGroup.add(katanaFin);

      // Crimson Tachyon Hull Conduits
      addCircuitStrip(0.065, 0.045, 2.85, side * 0.44, 0.66, -0.1, -side * 0.09);
      addCircuitStrip(0.065, 0.045, 2.15, side * 0.88, 0.58, 0.65, -side * 0.12);
    }
    addCircuitStrip(0.08, 0.045, 2.2, 0, 0.64, -1.65);
  }

  // ===========================================================================
  // SHARED STUDIO-GRADE SUB-ASSEMBLIES ACROSS ALL 5 HULLS:
  // Sculpted Armored Cockpit Canopy + Interior HUD Console + Ventral Repulsor
  // Levitation Pads + Twin Shock-Diamond Plasma Thrusters
  // ===========================================================================
  const canopyGroup = new THREE.Group();
  const canopyGlassGeo = new THREE.ConeGeometry(0.42, 1.95, 6);
  canopyGlassGeo.rotateX(-Math.PI / 2);
  canopyGlassGeo.scale(0.95, 0.52, 1.0);
  const canopyMesh = new THREE.Mesh(canopyGlassGeo, canopyMat);
  canopyMesh.position.set(0, 0.78, -0.32);
  canopyGroup.add(canopyMesh);

  // Glowing Cockpit Visor Frame Strip
  const visorStrip = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.08), neonAccentMat);
  visorStrip.position.set(0, 0.79, -0.92);
  canopyGroup.add(visorStrip);
  hullGroup.add(canopyGroup);

  // Under-Hull Anti-Gravity Levitation Repulsor Pads (visible when banking!)
  const repulsorGeo = new THREE.RingGeometry(0.18, 0.34, 16);
  repulsorGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const frontRepulsor = new THREE.Mesh(repulsorGeo, cyanCircuitMat);
    frontRepulsor.position.set(side * 0.52, 0.19, -0.95);
    const rearRepulsor = new THREE.Mesh(repulsorGeo, cyanCircuitMat);
    rearRepulsor.position.set(side * 0.88, 0.19, 1.15);
    hullGroup.add(frontRepulsor, rearRepulsor);
  }

  // Wingtip Navigation Strobes
  const wingLightGeo = new THREE.BoxGeometry(0.24, 0.08, 0.68);
  const wingLightMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
  const leftWingLight = new THREE.Mesh(wingLightGeo, wingLightMat);
  leftWingLight.position.set(-2.54, 0.29, 1.55);
  const rightWingLight = leftWingLight.clone();
  rightWingLight.position.x = 2.54;
  hullGroup.add(leftWingLight, rightWingLight);

  // Twin Rear Cylindrical Thruster Nozzles + Glowing Inner Rings + Rear Diffuser Grille
  const rearGrille = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.34), darkCarbonMat);
  rearGrille.position.set(0, 0.42, 2.3);
  hullGroup.add(rearGrille);

  const nozzleGeo = new THREE.CylinderGeometry(0.36, 0.45, 0.62, 24);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.94,
    roughness: 0.2,
  });
  const leftNozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
  leftNozzle.position.set(-0.64, 0.4, 2.32);
  const rightNozzle = leftNozzle.clone();
  rightNozzle.position.x = 0.64;

  const nozzleRingGeo = new THREE.TorusGeometry(0.36, 0.065, 12, 28);
  const nozzleRingMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
  const leftNozzleRing = new THREE.Mesh(nozzleRingGeo, nozzleRingMat);
  leftNozzleRing.position.set(-0.64, 0.4, 2.58);
  const rightNozzleRing = leftNozzleRing.clone();
  rightNozzleRing.position.x = 0.64;

  const nozzleCoreDiscGeo = new THREE.CircleGeometry(0.32, 20);
  const nozzleCoreDiscMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const leftCoreDisc = new THREE.Mesh(nozzleCoreDiscGeo, nozzleCoreDiscMat);
  leftCoreDisc.position.set(-0.64, 0.4, 2.56);
  const rightCoreDisc = leftCoreDisc.clone();
  rightCoreDisc.position.x = 0.64;

  hullGroup.add(
    leftNozzle,
    rightNozzle,
    leftNozzleRing,
    rightNozzleRing,
    leftCoreDisc,
    rightCoreDisc
  );

  // Custom GLSL Shock-Diamond Twin Plasma Plumes
  const plumeMatCore = createPlasmaPlumeShaderMaterial(0xe0f2fe);
  const plumeMatOuter = createPlasmaPlumeShaderMaterial(spec.thrusterColor);

  const coreFlameGeo = new THREE.ConeGeometry(0.32, 2.45, 20, 1, true);
  coreFlameGeo.rotateX(Math.PI / 2);
  coreFlameGeo.translate(0, 0, 1.22);

  const outerFlameGeo = new THREE.ConeGeometry(0.54, 3.35, 20, 1, true);
  outerFlameGeo.rotateX(Math.PI / 2);
  outerFlameGeo.translate(0, 0, 1.66);

  const leftFlame = new THREE.Mesh(coreFlameGeo, plumeMatCore);
  leftFlame.position.set(-0.64, 0.4, 2.54);
  const rightFlame = new THREE.Mesh(coreFlameGeo, plumeMatCore);
  rightFlame.position.set(0.64, 0.4, 2.54);

  const leftOuterGlow = new THREE.Mesh(outerFlameGeo, plumeMatOuter);
  leftOuterGlow.position.set(-0.64, 0.4, 2.54);
  const rightOuterGlow = new THREE.Mesh(outerFlameGeo, plumeMatOuter);
  rightOuterGlow.position.set(0.64, 0.4, 2.54);

  hullGroup.add(leftFlame, rightFlame, leftOuterGlow, rightOuterGlow);

  // Aerodynamic Wingtip Vortex Contrail Ribbons
  const contrailMat = createContrailShaderMaterial(spec.accentColor);
  const contrailGeo = new THREE.ConeGeometry(0.13, 2.8, 10, 1, true);
  contrailGeo.rotateX(Math.PI / 2);
  contrailGeo.translate(0, 0, 1.4);

  const leftContrail = new THREE.Mesh(contrailGeo, contrailMat);
  leftContrail.position.set(-2.52, 0.27, 1.92);
  leftContrail.visible = false;
  const rightContrail = new THREE.Mesh(contrailGeo, contrailMat);
  rightContrail.position.set(2.52, 0.27, 1.92);
  rightContrail.visible = false;
  hullGroup.add(leftContrail, rightContrail);

  // Vibrant Anamorphic Nozzle Exit Glow Sprites
  const flareMat = new THREE.SpriteMaterial({
    map: textures.thrusterFlareMap,
    color: spec.thrusterColor,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const leftFlare = new THREE.Sprite(flareMat);
  leftFlare.position.set(-0.64, 0.4, 2.62);
  leftFlare.scale.set(0.75, 0.42, 1);

  const rightFlare = new THREE.Sprite(flareMat);
  rightFlare.position.set(0.64, 0.4, 2.62);
  rightFlare.scale.set(0.75, 0.42, 1);
  hullGroup.add(leftFlare, rightFlare);

  // Ground Contact Shadow
  const shadowGeo = new THREE.PlaneGeometry(4.4, 5.4);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.set(0, -0.52, 0.1);
  root.add(shadowMesh);

  const plumeGroundGeo = new THREE.PlaneGeometry(2.0, 2.2);
  plumeGroundGeo.rotateX(-Math.PI / 2);
  const plumeGroundMat = new THREE.MeshBasicMaterial({
    map: textures.thrusterFlareMap,
    color: spec.thrusterColor,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const plumeGroundGlow = new THREE.Mesh(plumeGroundGeo, plumeGroundMat);
  plumeGroundGlow.position.set(0, -0.51, 2.55);
  plumeGroundGlow.visible = false;
  root.add(plumeGroundGlow);

  // Feather-Light, Soft Fresnel Contour Shield Aura (replaces wireframe bubble!)
  const shieldGeo = new THREE.SphereGeometry(2.65, 32, 20);
  shieldGeo.scale(0.98, 0.38, 1.22);
  const shieldMat = createSoftShieldShaderMaterial(spec.accentColor);
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldMesh.position.set(0, 0.48, 0.12);
  shieldMesh.visible = false;
  hullGroup.add(shieldMesh);

  // Weapon 2: Forward-Directed Coherent Laser Beam Rig (mounted at nose, points along -Z)
  const laserBeamGroup = new THREE.Group();
  laserBeamGroup.position.set(0, 0.42, -3.1);
  laserBeamGroup.visible = false;

  const beamLength = 74;
  const innerLaserGeo = new THREE.CylinderGeometry(0.11, 0.16, beamLength, 12, 1, true);
  innerLaserGeo.rotateX(-Math.PI / 2);
  innerLaserGeo.translate(0, 0, -beamLength / 2);
  const innerLaserMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.96,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  laserBeamGroup.add(new THREE.Mesh(innerLaserGeo, innerLaserMat));

  const outerLaserGeo = new THREE.CylinderGeometry(0.32, 0.52, beamLength, 16, 1, true);
  outerLaserGeo.rotateX(-Math.PI / 2);
  outerLaserGeo.translate(0, 0, -beamLength / 2);
  const outerLaserMat = new THREE.MeshBasicMaterial({
    color: 0x00ffaa,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  laserBeamGroup.add(new THREE.Mesh(outerLaserGeo, outerLaserMat));

  const muzzleRingGeo = new THREE.TorusGeometry(0.42, 0.08, 10, 24);
  const muzzleRingMat = new THREE.MeshBasicMaterial({
    color: 0x6ee7b7,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  laserBeamGroup.add(new THREE.Mesh(muzzleRingGeo, muzzleRingMat));
  hullGroup.add(laserBeamGroup);

  // Weapon 3: Radial Shockwave EMP Ring (expands around the craft when triggered)
  const shockwaveGeo = new THREE.TorusGeometry(1.0, 0.09, 14, 48);
  shockwaveGeo.rotateX(Math.PI / 2);
  const shockwaveMat = new THREE.MeshBasicMaterial({
    color: 0xff8800,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shockwaveMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
  shockwaveMesh.position.set(0, 0.35, 0);
  shockwaveMesh.visible = false;
  root.add(shockwaveMesh);

  return {
    root,
    hullGroup,
    leftFlame,
    rightFlame,
    leftOuterGlow,
    rightOuterGlow,
    leftContrail,
    rightContrail,
    leftFlare,
    rightFlare,
    plumeGroundGlow,
    shieldMesh,
    laserBeamGroup,
    shockwaveMesh,
    plumeMaterials: [plumeMatCore, plumeMatOuter, contrailMat, shieldMat],
  };
}

/**
 * Custom GLSL Atmospheric Sky & Nebula Dome
 * Renders volumetric FBM clouds, anti-aliased starfield, and vibrant horizon scattering
 * matching all reference images including the erupting volcanic sky!
 */
function createAtmosphericSkyDome(
  trackId: TrackId,
  atmosphere: AtmosphereMode
): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const isNeon = atmosphere === 'neon';
  const isCity = isCityTrack(trackId);

  const zenithColor = isNeon
    ? isCity
      ? new THREE.Color(0x050314)
      : new THREE.Color(0x030205)
    : isCity
    ? new THREE.Color(0x94a3b8)
    : new THREE.Color(0x78716c);

  const midSkyColor = isNeon
    ? isCity
      ? new THREE.Color(0x24104e)
      : new THREE.Color(0x0b0406)
    : isCity
    ? new THREE.Color(0xcbd5e1)
    : new THREE.Color(0xa8a29e);

  const horizonColor = isNeon
    ? isCity
      ? new THREE.Color(0x4c0d7a)
      : new THREE.Color(0x240705)
    : isCity
    ? new THREE.Color(0xe2e8f0)
    : new THREE.Color(0xd6d3d1);

  const nebulaAccent = isNeon
    ? isCity
      ? new THREE.Color(0x00f2fe)
      : new THREE.Color(0x8a2408)
    : new THREE.Color(0xffffff);

  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uZenith: { value: zenithColor },
      uMidSky: { value: midSkyColor },
      uHorizon: { value: horizonColor },
      uAccent: { value: nebulaAccent },
      uIsNeon: { value: isNeon ? 1.0 : 0.0 },
      uIsCity: { value: isCity ? 1.0 : 0.0 },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uMidSky;
      uniform vec3 uHorizon;
      uniform vec3 uAccent;
      uniform float uIsNeon;
      uniform float uIsCity;
      varying vec3 vWorldDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          v += amp * noise(p);
          p *= 2.04;
          amp *= 0.5;
        }
        return v;
      }

      float hash3(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float elev = clamp(dir.y, 0.0, 1.0);

        // Multi-stop vertical atmospheric gradient with rich lower-sky backlight
        vec3 col = mix(uHorizon, uMidSky, smoothstep(0.0, 0.34, elev));
        col = mix(col, uZenith, smoothstep(0.22, 0.78, elev));

        // Project sky dome coordinates for volumetric clouds & nebula
        vec2 skyUv = dir.xz / (elev + 0.26);
        float clouds = fbm(skyUv * 2.1 + vec2(uTime * 0.012, -uTime * 0.007));
        float detailClouds = fbm(skyUv * 4.8 - vec2(uTime * 0.014, 0.0));

        if (uIsNeon > 0.5) {
          float nebulaMask = smoothstep(0.38, 0.82, clouds) * (1.0 - smoothstep(0.45, 0.88, elev));
          col += uAccent * nebulaMask * (uIsCity > 0.5 ? 0.24 : 0.14);
          col += uHorizon * smoothstep(0.36, 0.78, detailClouds) * (uIsCity > 0.5 ? 0.32 : 0.15);

          if (uIsCity < 0.5) {
            // Brooding dark pyroclastic storm clouds with subtle smoldering caldera under-rim
            float ashCloud = smoothstep(0.38, 0.76, clouds * 0.65 + detailClouds * 0.35);
            vec3 darkAsh = vec3(0.02, 0.01, 0.015);
            vec3 emberRim = vec3(0.72, 0.18, 0.03) * smoothstep(0.52, 0.68, clouds) * pow(1.0 - elev, 2.5);
            col = mix(col, darkAsh, ashCloud * 0.72 * smoothstep(0.02, 0.42, elev));
            col += emberRim * 0.12;
          }

          // Anti-aliased, flicker-free 3D starfield (large soft cells so stars never sub-pixel shimmer on camera rotation)
          vec3 starCell = floor(dir * 82.0);
          vec3 starFract = fract(dir * 82.0) - 0.5;
          float h = hash3(starCell);
          float starDist = length(starFract);
          float starMask = step(0.986, h) * smoothstep(0.44, 0.14, starDist);
          col += vec3(0.88, 0.92, 0.98) * starMask * smoothstep(0.18, 0.48, elev) * 0.48;
        } else {
          // Dramatic Overcast Daylight Storm Clouds
          float cloudLayer = smoothstep(0.32, 0.75, clouds * 0.7 + detailClouds * 0.3);
          col = mix(col, vec3(0.88, 0.91, 0.95), cloudLayer * 0.42);
          col = mix(col, vec3(0.35, 0.38, 0.43), smoothstep(0.55, 0.88, detailClouds) * 0.32);
        }

        // Restrained horizon atmospheric glow band behind the mountain & skyscraper silhouettes
        float horizonGlow = pow(1.0 - elev, 4.5);
        col += uAccent * horizonGlow * (uIsNeon > 0.5 ? (uIsCity > 0.5 ? 0.28 : 0.12) : 0.06);

        gl_FragColor = vec4(clamp(col, 0.0, 0.92), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const skyGeo = new THREE.SphereGeometry(2600, 44, 32);
  const mesh = new THREE.Mesh(skyGeo, skyMat);
  mesh.position.set(520, 0, -140);
  return { mesh, material: skyMat };
}

/**
 * Custom GLSL Animated Plasma Core Tube Shader for Overhead Energy Portal Rings
 * Produces a scorching white-hot center with saturated neon cyan or fiery orange plasma bands
 */
function createRingPlasmaTubeMaterial(coreHex: number, glowHex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCore: { value: new THREE.Color(coreHex) },
      uGlow: { value: new THREE.Color(glowHex) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vViewNormal;
      void main() {
        vUv = uv;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCore;
      uniform vec3 uGlow;
      varying vec2 vUv;
      varying vec3 vViewNormal;

      void main() {
        float fresnel = clamp(abs(vViewNormal.z), 0.0, 1.0);
        float plasmaWave = 0.88 + 0.12 * sin(vUv.x * 24.0 + uTime * 4.5);
        vec3 col = mix(uGlow, uCore, pow(fresnel, 1.25) * 0.82) * plasmaWave;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * Radiant Neon Rim Halo Shader for the Circular Energy Gates
 * Uses an open-center RingGeometry with subtle falloff so gates look crisp without heavy translucent collars
 */
function createRingHaloMaterial(colorHex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colorHex) },
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
      uniform vec3 uColor;
      varying vec2 vUv;

      void main() {
        vec2 centered = (vUv - 0.5) * 2.0;
        float r = length(centered);
        float angle = atan(centered.y, centered.x);

        // Peak at r = 0.84 (matching the open RingGeometry)
        float distFromRing = abs(r - 0.84);
        float halo = exp(-distFromRing * 18.0);
        float plasmaArc = 0.88 + 0.12 * sin(angle * 8.0 + uTime * 4.0);
        vec3 coreTint = mix(uColor, vec3(0.95, 0.98, 1.0), exp(-distFromRing * 36.0) * 0.35);

        float alpha = halo * 0.16 * plasmaArc;
        gl_FragColor = vec4(coreTint, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function createTrackSpline(trackId: TrackId): THREE.CatmullRomCurve3 {
  if (isCityTrack(trackId)) {
    // Extended Neo-Metropolis Circuit (32 control points, 5,453.95 world units = 2.54x baseline):
    // - S1 (pts 0..8): Preserved Start/Finish & North Bean Curve -> Underpass (y=18m at (450,-260)) -> 680m High-Speed Neon Ascent
    // - S2 (pts 9..16): Skyline Crest (y=68m) -> Roller-Coaster Drop -> Hairpin 1 (Shibuya 180° Drift) -> Technical Cyber Esses
    // - S3 (pts 17..23): Hairpin 2 (Cyberdyne Turn) -> Banked Megatower Sweeper (y=64m) -> Set-Piece 1: Skyscraper Core Tunnel
    // - S4 (pts 24..31): Set-Piece 2: Twin-Tower Sky-Corridor -> Set-Piece 3: Skybridge Overpass (y=48m, +30m above Underpass) -> Bean Loop Return
    const pts = [
      // S1: Opening Grid & North Bean Curve (preserved from original circuit)
      new THREE.Vector3(0, 28, 0),
      new THREE.Vector3(-4, 30, -140),
      new THREE.Vector3(24, 34, -290),
      new THREE.Vector3(95, 38, -420),
      new THREE.Vector3(220, 35, -490),
      // Dive into X-Crossing Underpass (y = 18m at (450, -260), heading SE)
      new THREE.Vector3(345, 24, -390),
      new THREE.Vector3(450, 18, -260),
      // Long High-Speed Neon Ascent (680m straight + climb from y = 18m to y = 68m Crest)
      new THREE.Vector3(555, 22, -145),
      new THREE.Vector3(680, 32, -25),
      new THREE.Vector3(820, 46, 95),
      new THREE.Vector3(955, 60, 190),
      // S2: Skyline Crest (y = 68m) & Roller-Coaster Drop (y = 68m -> 24m)
      new THREE.Vector3(1085, 68, 210),
      new THREE.Vector3(1215, 52, 225),
      new THREE.Vector3(1315, 34, 180),
      // Hairpin 1: Shibuya 180° Drift Turn (wide entry into rounded R=62m turnaround)
      new THREE.Vector3(1380, 24, 90),
      new THREE.Vector3(1420, 22, -65),
      new THREE.Vector3(1330, 24, -195),
      // Technical Section: Rhythmic S-Curve / Cyber Esses Sequence
      new THREE.Vector3(1170, 28, -245),
      new THREE.Vector3(1040, 32, -165),
      new THREE.Vector3(910, 28, -240),
      new THREE.Vector3(850, 24, -395),
      // S3: Hairpin 2 (Cyberdyne Tight Turn) & Uphill Exit
      new THREE.Vector3(935, 22, -545),
      new THREE.Vector3(1095, 26, -595),
      new THREE.Vector3(1245, 36, -520),
      // High-Speed Banked Megatower Sweeper (climbs to y = 64m with 16° inward banking)
      new THREE.Vector3(1310, 50, -395),
      new THREE.Vector3(1195, 62, -295),
      new THREE.Vector3(1015, 64, -385),
      // Set-Piece 1: Skyscraper Core Tunnel & Set-Piece 2: Twin-Tower Glass Sky-Corridor
      new THREE.Vector3(835, 58, -455),
      new THREE.Vector3(675, 54, -420),
      new THREE.Vector3(555, 50, -345),
      // S4: Set-Piece 3: Elevated Skybridge Overpass (y = 48m at (450, -260), +30.0m above Underpass!)
      new THREE.Vector3(450, 48, -260),
      new THREE.Vector3(355, 44, -180),
      // Rejoin Original Bean Loop Southern Return
      new THREE.Vector3(280, 38, -60),
      new THREE.Vector3(285, 35, 75),
      new THREE.Vector3(335, 30, 225),
      new THREE.Vector3(240, 24, 360),
      new THREE.Vector3(90, 22, 310),
      new THREE.Vector3(18, 26, 160),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    curve.arcLengthDivisions = 1600;
    return curve;
  } else {
    // Extended Lava Circuit ("Caldera Prime Surge // Obsidian Rift MK-II" — 2.50x Baseline Length, 38 Control Points):
    // - Sector 1 (t = 0.00..0.21): Preserves the Start/Finish straight, starting grid, sweeping high-altitude
    //   Caldera Parabolica (pts 2..5, t ~ 0.055..0.125), and subterranean Volcano-Base Magma Cavern Tunnel
    //   (pts 6..8, t ~ 0.138..0.180) piercing through the Primary Erupting Stratovolcano at (312, 18, -395).
    // - Sector 2 (t = 0.21..0.50): Dives through the Obsidian Trench Underpass (y = 18m at (420, -140)) and
    //   launches into a long South-East Pyroclastic Ascent Straight climbing +50m to the Pyroclastic Summit
    //   Crest (y = 68m at (1135, 305)), followed by a Roller-Coaster Drop into Hairpin 1 (Southern Caldera 180° Turn).
    // - Sector 3 (t = 0.50..0.75): Technical Basalt Serpent Esses (3 rapid Left-Right-Left direction changes),
    //   Hairpin 2 (Northern Obsidian Rim 180° Turn at (1355, -615)), and High-Speed Banked Magma Rim Sweeper.
    // - Sector 4 (t = 0.75..1.00): Set-Piece 2 (Geothermal Refinery Core & Laser Gantry Corridor, t ~ 0.745..0.798),
    //   Set-Piece 3 (Elevated Magma Viaduct Overpass at (420, 48, -140), +30.0m vertical clearance above the
    //   Sector 2 Underpass!), and the preserved Southern Caldera Return back to Start/Finish.
    const pts = [
      // S1: Preserved Start/Finish Straight, Caldera Parabolica (t=0.055..0.125) & Volcano-Base Magma Tunnel (t=0.138..0.180)
      new THREE.Vector3(0, 34, 0),
      new THREE.Vector3(-6, 36, -155),
      new THREE.Vector3(16, 41, -310),
      new THREE.Vector3(64, 49, -455),
      new THREE.Vector3(148, 53, -555),
      new THREE.Vector3(242, 41, -575),
      new THREE.Vector3(295, 26, -495),
      new THREE.Vector3(312, 18, -395),
      new THREE.Vector3(330, 20, -295),
      new THREE.Vector3(365, 19, -215),
      // S2: Obsidian Trench Underpass (y = 18m at (420, -140)), SE Pyroclastic Ascent & Summit Crest (y = 68m), Drop & Hairpin 1
      new THREE.Vector3(420, 18, -140),
      new THREE.Vector3(530, 24, -30),
      new THREE.Vector3(665, 36, 85),
      new THREE.Vector3(815, 50, 195),
      new THREE.Vector3(975, 62, 275),
      new THREE.Vector3(1135, 68, 305),
      new THREE.Vector3(1285, 54, 275),
      new THREE.Vector3(1405, 36, 185),
      new THREE.Vector3(1455, 24, 55),
      new THREE.Vector3(1395, 22, -75),
      new THREE.Vector3(1265, 26, -125),
      // S3: Technical Basalt Serpent Esses, Hairpin 2 (Northern Obsidian Rim 180° Turn) & High-Speed Banked Magma Sweeper
      new THREE.Vector3(1125, 30, -145),
      new THREE.Vector3(1055, 34, -265),
      new THREE.Vector3(1165, 30, -385),
      new THREE.Vector3(1295, 26, -485),
      new THREE.Vector3(1355, 22, -615),
      new THREE.Vector3(1245, 24, -725),
      new THREE.Vector3(1095, 32, -695),
      new THREE.Vector3(945, 46, -595),
      new THREE.Vector3(805, 58, -485),
      // S4: Geothermal Refinery Core (t=0.745..0.798), Elevated Magma Viaduct Overpass (y=48m at (420,-140)) & Southern Return
      new THREE.Vector3(665, 62, -365),
      new THREE.Vector3(535, 54, -245),
      new THREE.Vector3(420, 48, -140),
      new THREE.Vector3(315, 42, -35),
      new THREE.Vector3(310, 35, 115),
      new THREE.Vector3(245, 28, 255),
      new THREE.Vector3(115, 26, 285),
      new THREE.Vector3(22, 30, 155),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    curve.arcLengthDivisions = 1600;
    return curve;
  }
}

const _tangent = new THREE.Vector3();
const _aheadTan = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _binormal = new THREE.Vector3();
const _normal = new THREE.Vector3();

export function sampleTrackFrame(
  spline: THREE.CatmullRomCurve3,
  t: number,
  outPos: THREE.Vector3,
  outForward: THREE.Vector3,
  outRight: THREE.Vector3,
  outUp: THREE.Vector3
) {
  const normT = ((t % 1) + 1) % 1;
  spline.getPointAt(normT, outPos);
  spline.getTangentAt(normT, _tangent).normalize();

  const aheadT = (normT + 0.006) % 1;
  spline.getTangentAt(aheadT, _aheadTan).normalize();
  const turnRate = _tangent.x * _aheadTan.z - _tangent.z * _aheadTan.x;
  // Enhanced parabolic banking along the high-speed Parabolica (t ~ 0.05..0.36)
  // and the Extended Circuits' High-Speed Banked Sweepers (t ~ 0.56..0.76)
  const parabolicaBoost =
    normT >= 0.05 && normT <= 0.36
      ? 1.0 + 0.68 * Math.sin(((normT - 0.05) / 0.31) * Math.PI)
      : normT >= 0.56 && normT <= 0.76
      ? 1.0 + 0.85 * Math.sin(((normT - 0.56) / 0.20) * Math.PI)
      : 1.0;
  // Smoothly flatten banking across the Start/Finish straight so the starting grid is dead-level
  const startGridEnvelope =
    normT < 0.025
      ? normT / 0.025
      : normT > 0.975
      ? (1.0 - normT) / 0.025
      : 1.0;
  const bankAngle = THREE.MathUtils.clamp(
    turnRate * 2.45 * parabolicaBoost * startGridEnvelope,
    -0.38,
    0.38
  );

  _binormal.crossVectors(_tangent, _up).normalize();
  _normal.crossVectors(_binormal, _tangent).normalize();

  outForward.copy(_tangent);
  outRight.copy(_binormal).applyAxisAngle(_tangent, bankAngle).normalize();
  outUp.copy(_normal).applyAxisAngle(_tangent, bankAngle).normalize();
}

export interface AerialTrafficSystem {
  mesh: THREE.InstancedMesh;
  items: Array<{
    cx: number;
    cz: number;
    radiusX: number;
    radiusZ: number;
    y: number;
    speed: number;
    phase: number;
    dir: number;
    length: number;
  }>;
}

export interface PowerUpPickupInstance {
  padId: number;
  powerUpType: PowerUpItemType;
  weaponType?: ActiveWeaponId;
  t: number;
  laneOffset: number;
  holderGroup: THREE.Group;
  itemGroup: THREE.Group;
  holoBoxGroup: THREE.Group;
  baseRingMesh: THREE.Mesh;
  respawnTimer: number; // > 0 when recently collected
  collectAnimProgress: number; // 0..1 burst animation
}

export interface BuiltTrackWorld {
  worldGroup: THREE.Group;
  animatedRings: THREE.Mesh[];
  animatedCrystals: THREE.Object3D[];
  powerUpBoxes: PowerUpPickupInstance[];
  animatedSearchlights: THREE.Object3D[];
  aerialTraffic: AerialTrafficSystem | null;
  lavaFallsMesh: THREE.Mesh | null;
  animatedShaders: THREE.ShaderMaterial[];
  minimapPoints: Array<{ x: number; y: number }>;
}

/**
 * Custom GLSL Animated Plasma-Chevron Shader for On-Track Recharge Pads
 * Uses NormalBlending and polygonOffset so pads are crisp, saturated, and never cause whiteout or Z-fighting
 */
function createPadShaderMaterial(
  primaryHex: number,
  secondaryHex: number,
  isNeon: boolean
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPrimary: { value: new THREE.Color(primaryHex) },
      uSecondary: { value: new THREE.Color(secondaryHex) },
      uOpacity: { value: isNeon ? 0.86 : 0.76 },
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
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform float uOpacity;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        float xSym = abs(uv.x - 0.5) * 2.0;
        // Scrolling triple-chevron pattern along track direction
        float scroll = uv.y * 4.0 - xSym * 1.15 - uTime * 3.2;
        float chevron = smoothstep(0.18, 0.52, fract(scroll)) * (1.0 - smoothstep(0.62, 0.90, fract(scroll)));
        float edgeRail = smoothstep(0.80, 0.92, xSym) * (1.0 - smoothstep(0.95, 1.0, xSym));
        float endFade = smoothstep(0.0, 0.14, uv.y) * (1.0 - smoothstep(0.86, 1.0, uv.y));
        float sideFade = 1.0 - smoothstep(0.92, 1.0, xSym);

        vec3 darkHousing = vec3(0.03, 0.06, 0.11);
        vec3 activeCol = mix(uPrimary, uSecondary, chevron * 0.65 + edgeRail * 0.45) * 0.82;
        vec3 col = mix(darkHousing, activeCol, clamp(chevron + edgeRail, 0.0, 1.0));

        float alpha = clamp((chevron * 0.82 + edgeRail * 0.72 + 0.22) * endFade * sideFade * uOpacity, 0.0, 0.88);
        gl_FragColor = vec4(clamp(col, 0.0, 0.85), alpha);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    side: THREE.DoubleSide,
  });
}

/**
 * Unified Standard Electric-Blue 3-Arrow Boost Pad Shader (`gpt-image-2.5-sunburst_a_Remove_the_backgroun_fa8e5d5f.png`):
 * - Used for ALL boost pads across ALL tracks (same size, same Electric Blue color).
 * - Renders 3 crisp, frameless, closed-loop electric-blue chevrons (^ ^ ^) directly on the track surface
 *   with ZERO rectangular background box:
 *   1) Outer royal-blue / cobalt beveled border (#0044ff -> #0088ff) with 3D specular edge highlight
 *   2) Continuous closed-loop white-cyan neon inner tube (#ffffff / #7df9ff) tracing all 6 edges of each chevron
 *   3) Electric-cyan interior (#00c8ff -> #52faff) with fine geometric diamond/hexagonal carbon-mesh pattern
 *      and a crisp central vertical spine crease at x = 0.5
 * - Lights up the 3 arrows in series (1 -> 2 -> 3) with a strong animated pulsating effect that runs at a
 *   progressively faster, more intense pace as the player chains boost pads in series (`uComboPhase` & `uComboLevel`).
 */
function createStandardElectricBlueBoostPadMaterial(
  isNeon: boolean
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uComboPhase: { value: 0 },
      uComboLevel: { value: 0 },
      uCoreColor: { value: new THREE.Color(0x00d8ff) },
      uRimColor: { value: new THREE.Color(0x0048ff) },
      uHotColor: { value: new THREE.Color(0xffffff) },
      uOpacity: { value: isNeon ? 0.99 : 0.95 },
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
      uniform float uComboPhase;
      uniform float uComboLevel;
      uniform vec3 uCoreColor;
      uniform vec3 uRimColor;
      uniform vec3 uHotColor;
      uniform float uOpacity;
      varying vec2 vUv;

      // Exact 2D Signed Distance Field (SDF) for a single closed-loop chevron with vertical wingtips:
      // Returns signed distance: < 0 inside the chevron, 0 on the outer royal-blue edge, > 0 outside.
      float chevronClosedLoopSdf(vec2 uv, float apexY, float slope, float vertHeight, float halfSpanX) {
        float x = abs(uv.x - 0.5);
        float invLen = inversesqrt(1.0 + slope * slope);
        float halfH = vertHeight * 0.5;

        // Perpendicular signed distances to upper slanted edge, lower slanted V-edge, and vertical wingtip
        float dTop = (uv.y - (apexY + halfH - x * slope)) * invLen;
        float dBot = ((apexY - halfH - x * slope) - uv.y) * invLen;
        float dSide = x - halfSpanX;

        float dSlant = max(dTop, dBot);
        float rCorner = 0.011;
        vec2 q = vec2(dSlant + rCorner, dSide + rCorner);
        return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - rCorner;
      }

      // Evaluates a single reference-accurate chevron layer (color + alpha) from its SDF
      vec4 evaluateChevron(
        vec2 uv,
        float sdf,
        float seqLit,
        float globalPulse
      ) {
        // Completely discard/transparent outside the tight neon rim around the chevron (NO rectangular box!)
        float outerAura = exp(-max(sdf, 0.0) * 145.0) * step(sdf, 0.024);
        float bodyMask = 1.0 - smoothstep(-0.0025, 0.0025, sdf);
        float totalAlpha = clamp(bodyMask + outerAura * 0.68, 0.0, 1.0);
        if (totalAlpha < 0.005) {
          return vec4(0.0);
        }

        // 1) Outer Royal-Blue Beveled Frame (-0.019 <= sdf <= 0.0)
        float outerBevelBand = smoothstep(-0.021, -0.015, sdf) * bodyMask;
        float outerSpecularCrest = exp(-pow((sdf + 0.007) / 0.0038, 2.0));

        // 2) Continuous Closed-Loop White-Cyan Neon Inner Tube (-0.031 <= sdf <= -0.017)
        float whiteTubeCore = exp(-pow((sdf + 0.0235) / 0.0046, 2.0));
        float cyanTubeBloom = exp(-pow((sdf + 0.0235) / 0.0105, 2.0));

        // 3) Inner Electric-Cyan Hexagonal/Diamond Mesh Interior (sdf < -0.027)
        float innerCoreMask = 1.0 - smoothstep(-0.028, -0.020, sdf);

        // Fine geometric diamond/carbon-hex micro-mesh texture matching gpt-image-2.5-sunburst reference
        vec2 meshCoord = vec2((uv.x - 0.5) * 210.0, uv.y * 340.0);
        float dGrid1 = sin(meshCoord.x + meshCoord.y);
        float dGrid2 = sin(meshCoord.x - meshCoord.y);
        float hexDots = clamp(dGrid1 * dGrid2, -1.0, 1.0) * 0.5 + 0.5;
        float meshPattern = mix(0.84, 1.12, smoothstep(0.22, 0.78, hexDots));

        // Central vertical spine ridge & 3D left/right wing facet shading at x = 0.5
        float centerDist = abs(uv.x - 0.5);
        float centerSpineLine = exp(-pow(centerDist / 0.0042, 2.0)) * innerCoreMask;
        float centerSpineGlow = exp(-pow(centerDist / 0.045, 2.0)) * innerCoreMask;
        float wingFacet = uv.x < 0.5 ? 1.04 : 0.96;

        // Compose colors from outside in:
        vec3 royalBlueOuter = mix(vec3(0.0, 0.22, 0.92), vec3(0.04, 0.52, 1.0), outerSpecularCrest);
        vec3 cyanInterior = mix(vec3(0.0, 0.72, 0.98), vec3(0.24, 0.94, 1.0), centerSpineGlow * 0.65 + 0.25)
                          * meshPattern * wingFacet;

        vec3 col = mix(royalBlueOuter, cyanInterior, innerCoreMask);
        // Add cyan inner-tube bloom and crisp closed-loop white neon inner tube
        col = mix(col, vec3(0.35, 0.96, 1.0), cyanTubeBloom * 0.65);
        col = mix(col, uHotColor, clamp(whiteTubeCore * 0.96 + centerSpineLine * 0.58, 0.0, 1.0));

        // Apply sequential 1 -> 2 -> 3 series ignition & progressive combo pulsation
        float ignitionFlash = max(0.0, seqLit - 0.85) * 0.65;
        col = mix(col, uHotColor, clamp(ignitionFlash * (whiteTubeCore + innerCoreMask * 0.45), 0.0, 0.85));
        col *= (0.72 + 0.42 * seqLit) * globalPulse;

        // Tight neon edge aura outside sdf > 0
        vec3 auraCol = mix(uRimColor, uCoreColor, 0.5) * (0.85 + 0.35 * seqLit) * globalPulse;
        vec3 finalRgb = mix(auraCol, col, bodyMask);

        return vec4(finalRgb, totalAlpha);
      }

      void main() {
        vec2 uv = vUv;

        // Progressive Series Combo Phase: lights up Chevron 1 -> Chevron 2 -> Chevron 3 in series at a progressively faster pace!
        float phase = uComboPhase > 0.001 ? uComboPhase : uTime * 2.6;
        float seqCycle = fract(phase);

        float d1 = abs(fract(seqCycle - 0.16 + 0.5) - 0.5);
        float d2 = abs(fract(seqCycle - 0.50 + 0.5) - 0.5);
        float d3 = abs(fract(seqCycle - 0.84 + 0.5) - 0.5);

        float lit1 = 0.46 + 0.94 * exp(-20.0 * d1 * d1);
        float lit2 = 0.46 + 0.94 * exp(-20.0 * d2 * d2);
        float lit3 = 0.46 + 0.94 * exp(-20.0 * d3 * d3);

        // Animated pulsating heartbeat that intensifies as combo level (1 -> 2 -> 3+) increases
        float globalPulse = 0.88 + 0.20 * sin(phase * 6.2831853) + min(0.42, uComboLevel * 0.11);

        // 3 Stacked Closed-Loop Electric-Blue Chevrons (^ ^ ^) matching gpt-image-2.5-sunburst_a_Remove_the_backgroun
        float sdf1 = chevronClosedLoopSdf(uv, 0.33, 0.52, 0.142, 0.42);
        float sdf2 = chevronClosedLoopSdf(uv, 0.61, 0.52, 0.142, 0.42);
        float sdf3 = chevronClosedLoopSdf(uv, 0.89, 0.52, 0.142, 0.42);

        vec4 ch1 = evaluateChevron(uv, sdf1, lit1, globalPulse);
        vec4 ch2 = evaluateChevron(uv, sdf2, lit2, globalPulse);
        vec4 ch3 = evaluateChevron(uv, sdf3, lit3, globalPulse);

        // Composite the 3 non-overlapping chevrons with 100% transparent background
        vec4 combined = ch1;
        combined.rgb = mix(combined.rgb, ch2.rgb, ch2.a);
        combined.a = max(combined.a, ch2.a);
        combined.rgb = mix(combined.rgb, ch3.rgb, ch3.a);
        combined.a = max(combined.a, ch3.a);

        if (combined.a < 0.015) discard;

        gl_FragColor = vec4(clamp(combined.rgb, vec3(0.0), vec3(1.45)), clamp(combined.a * uOpacity, 0.0, 0.99));
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
    side: THREE.DoubleSide,
  });
}

/**
 * Custom GLSL Curved-Guardrail Animated Arrow Wall Shader:
 * Renders the tall curved guardrail arrow modules mounted along parabolic/normal curves (YELLOW)
 * and difficult curves/hairpins (RED), featuring 3 large bold arrows (>>>) that light up in series!
 */
function createCurveGuardrailArrowWallMaterial(
  isDifficultRed: boolean,
  isNeon: boolean,
  neonIntensity: number
): THREE.ShaderMaterial {
  const coreHex = isDifficultRed ? 0xff1e1e : 0xffd000;
  const rimHex = isDifficultRed ? 0xb91c1c : 0xff8800;
  const hotHex = isDifficultRed ? 0xfecaca : 0xfef9c3;
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCoreColor: { value: new THREE.Color(coreHex) },
      uRimColor: { value: new THREE.Color(rimHex) },
      uHotColor: { value: new THREE.Color(hotHex) },
      uBrightness: {
        value: THREE.MathUtils.clamp((isNeon ? 0.96 : 0.72) * neonIntensity, 0.65, 1.38),
      },
      uSpeed: { value: isDifficultRed ? 3.4 : 2.6 },
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
      uniform vec3 uCoreColor;
      uniform vec3 uRimColor;
      uniform vec3 uHotColor;
      uniform float uBrightness;
      uniform float uSpeed;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        float ySym = abs(uv.y - 0.5) * 2.0;

        // Dark armored guardrail housing
        vec3 darkHousing = vec3(0.035, 0.048, 0.078);

        // Top & bottom continuous glowing LED trim rails framing the guardrail panel
        float topBotRail = smoothstep(0.80, 0.90, ySym);

        // 3 Large Bold Forward-Pointing Chevrons (>>>) across the guardrail panel
        float along = uv.x * 3.0;
        float cellX = fract(along - ySym * 0.36);
        float cellId = mod(floor(along - ySym * 0.36), 3.0);

        float chevShape = smoothstep(0.16, 0.28, cellX)
                        * (1.0 - smoothstep(0.68, 0.80, cellX))
                        * (1.0 - smoothstep(0.74, 0.84, ySym));
        float chevRim = (smoothstep(0.16, 0.24, cellX) * (1.0 - smoothstep(0.24, 0.32, cellX))
                       + smoothstep(0.60, 0.68, cellX) * (1.0 - smoothstep(0.68, 0.78, cellX)))
                       * (1.0 - smoothstep(0.74, 0.84, ySym));

        // Sequential 1 -> 2 -> 3 series lighting wave + rhythmic pulsation
        float wave = fract(uTime * uSpeed);
        float targetPhase = (cellId + 0.5) / 3.0;
        float dist = abs(fract(wave - targetPhase + 0.5) - 0.5);
        float seqLit = 0.38 + 1.05 * exp(-18.0 * dist * dist);
        float pulse = 0.88 + 0.18 * sin(uTime * uSpeed * 6.2831853);
        float arrowEnergy = clamp(seqLit * pulse, 0.28, 1.48);

        vec3 idleSlot = vec3(0.09, 0.11, 0.16);
        vec3 activeArrow = mix(uRimColor, uCoreColor, clamp(arrowEnergy * 0.85, 0.0, 1.0));
        activeArrow = mix(activeArrow, uHotColor, clamp(chevRim * 0.75 + max(0.0, arrowEnergy - 0.88) * 0.85, 0.0, 1.0)) * arrowEnergy;

        vec3 panelCol = mix(darkHousing, mix(idleSlot, activeArrow, clamp(arrowEnergy, 0.0, 1.0)), chevShape);
        vec3 railCol = mix(uRimColor, uHotColor, 0.45) * (0.85 + 0.20 * sin(uv.x * 12.56 - uTime * 9.0));
        vec3 finalCol = mix(panelCol, railCol, topBotRail);

        gl_FragColor = vec4(clamp(finalCol * uBrightness, vec3(0.0), vec3(1.42)), 1.0);
      }
    `,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
}

/**
 * Custom GLSL Guardrail Flowing-Arrow & Flowing-Light Channel Shader:
 * Renders the recessed mid-guardrail light channel along the entire circuit with:
 * - YELLOW animated flowing arrows (>>>) in Normal & Parabolic Curves (`vCurveType ≈ 1.0`)
 * - RED animated flowing arrows (>>>) in Difficult Curves & Sharp Hairpins (`vCurveType ≈ 2.0`)
 * - Sleek glowing cyan/amber guardrail channel on straightaways (`vCurveType ≈ 0.0`)
 */
function createFlowingGuardrailChannelMaterial(
  isCity: boolean,
  isNeon: boolean,
  neonIntensity: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIsCity: { value: isCity ? 1.0 : 0.0 },
      uBrightness: {
        value: THREE.MathUtils.clamp((isNeon ? 0.90 : 0.62) * neonIntensity, 0.58, 1.35),
      },
    },
    vertexShader: `
      attribute float aCurveType;
      varying vec2 vUv;
      varying float vCurveType;
      void main() {
        vUv = uv;
        vCurveType = aCurveType;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIsCity;
      uniform float uBrightness;
      varying vec2 vUv;
      varying float vCurveType;

      void main() {
        // Larger, bolder chevron cells (68 cells per tile = ~170 large arrows around the circuit)
        float along = vUv.x * 68.0;
        float vy = vUv.y;
        float ySym = abs(vy - 0.5) * 2.0;

        // Dark recessed metallic channel housing
        vec3 darkHousing = vec3(0.03, 0.045, 0.08);
        float topBotRail = smoothstep(0.76, 0.86, ySym);

        // Bold forward-pointing chevron geometry (>) inside each repeating cell along the guardrail
        float cellX = fract(along - ySym * 0.40);
        float cellId = floor(along - ySym * 0.40);
        float chevShape = smoothstep(0.16, 0.28, cellX)
                        * (1.0 - smoothstep(0.66, 0.78, cellX))
                        * (1.0 - smoothstep(0.74, 0.84, ySym));
        float chevRim = (smoothstep(0.16, 0.24, cellX) * (1.0 - smoothstep(0.24, 0.32, cellX))
                       + smoothstep(0.58, 0.66, cellX) * (1.0 - smoothstep(0.66, 0.76, cellX)))
                       * (1.0 - smoothstep(0.74, 0.84, ySym));

        // Curve classification weights from vertex attribute:
        // 0.0 = Straightaway, 1.0 = Normal / Parabolic Curve (YELLOW arrows), 2.0 = Difficult Curve (RED arrows)
        float inCurve = smoothstep(0.20, 0.75, vCurveType);
        float isDifficultCurve = smoothstep(1.25, 1.75, vCurveType);

        // High-speed sequential series lighting of 3 consecutive arrows along the guardrail
        float flowSpeed = mix(2.6, 3.6, isDifficultCurve);
        float flowWave = fract(cellId * 0.11 - uTime * flowSpeed);
        float flowingPacket = smoothstep(0.38, 0.86, flowWave) * (1.0 - smoothstep(0.88, 0.98, flowWave));
        float idleGlow = step(0.68, fract(cellId * 0.3333)) * 0.42;
        float arrowEnergy = clamp(flowingPacket * (1.25 + 0.30 * inCurve) + idleGlow + 0.16, 0.0, 1.52);

        // Straightaway palette (Electric Blue/Cyan) vs Normal Curve (Vibrant Yellow) vs Difficult Curve (Vibrant Red)
        vec3 straightCore = vec3(0.0, 0.88, 1.0);
        vec3 straightHot  = vec3(0.82, 0.97, 1.0);

        vec3 yellowCore   = vec3(1.0, 0.82, 0.0);
        vec3 yellowHot    = vec3(1.0, 0.98, 0.65);

        vec3 redCore      = vec3(1.0, 0.10, 0.10);
        vec3 redHot       = vec3(1.0, 0.78, 0.78);

        vec3 curveCore = mix(yellowCore, redCore, isDifficultCurve);
        vec3 curveHot  = mix(yellowHot, redHot, isDifficultCurve);

        vec3 activeCore = mix(straightCore, curveCore, inCurve);
        vec3 activeHot  = mix(straightHot, curveHot, inCurve);
        vec3 railColor  = mix(straightCore, curveCore, inCurve);

        vec3 slotBase = vec3(0.08, 0.11, 0.16);
        vec3 litChevron = mix(activeCore, activeHot, clamp((arrowEnergy - 0.50) * 0.92 + chevRim * 0.55, 0.0, 1.0)) * arrowEnergy;
        vec3 channelCol = mix(darkHousing, mix(slotBase, litChevron, clamp(arrowEnergy, 0.0, 1.0)), chevShape);

        float railPulse = 0.80 + 0.20 * sin(along * 0.35 - uTime * 9.0);
        vec3 finalCol = mix(channelCol, mix(railColor, activeHot, 0.35) * railPulse, topBotRail);

        gl_FragColor = vec4(clamp(finalCol * uBrightness, vec3(0.0), vec3(1.42)), 1.0);
      }
    `,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
}

/**
 * Custom GLSL Flowing Top Plasma Rail Shader (`Screenshot_from_2026-10-29_22-07-54_7c765c69.png`):
 * Renders the continuous blazing orange-red / solar-gold / electric-cyan upper plasma guardrail tube
 * with a high-velocity traveling energy current along the track perimeter!
 */
function createFlowingTopRailMaterial(
  isCity: boolean,
  isNeon: boolean,
  neonIntensity: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIsCity: { value: isCity ? 1.0 : 0.0 },
      uBrightness: {
        value: THREE.MathUtils.clamp((isNeon ? 0.92 : 0.62) * neonIntensity, 0.58, 1.32),
      },
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
      uniform float uIsCity;
      uniform float uBrightness;
      varying vec2 vUv;

      void main() {
        float along = vUv.x * 110.0;
        float coreProfile = 1.0 - abs(vUv.y - 0.5) * 1.75;
        float surge1 = 0.78 + 0.28 * sin(along - uTime * 14.0);
        float surge2 = smoothstep(0.65, 0.98, sin(along * 0.45 - uTime * 9.5)) * 0.38;

        // Warm blazing orange-red / solar-gold plasma tube (matching the In-Game Examples in good_game_assets_aacb9e02.png)
        vec3 basePlasma = uIsCity > 0.5 ? vec3(1.0, 0.62, 0.06) : vec3(1.0, 0.36, 0.04);
        vec3 hotCore = vec3(1.0, 0.95, 0.68);
        vec3 col = mix(basePlasma, hotCore, clamp(coreProfile * 0.65 + surge2, 0.0, 1.0)) * surge1;

        gl_FragColor = vec4(clamp(col * uBrightness, vec3(0.0), vec3(1.38)), 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

/**
 * Custom GLSL Beveled Lower Curb Light Strip Shader (`Screenshot_from_2026-10-29_22-07-54_7c765c69.png`):
 * Renders the 3D beveled metallic curb along the base of the guardrails with alternating
 * glowing Electric-Cyan (#00e5ff) and Amber-Orange (#ff8800) rectangular light modules!
 */
function createFlowingCurbLightStripMaterial(
  isNeon: boolean,
  neonIntensity: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBrightness: {
        value: THREE.MathUtils.clamp((isNeon ? 0.88 : 0.58) * neonIntensity, 0.52, 1.25),
      },
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
      uniform float uBrightness;
      varying vec2 vUv;

      void main() {
        float cellCoord = vUv.x * 140.0;
        float cellFract = fract(cellCoord);
        float cellIdx = floor(cellCoord);
        float ySym = abs(vUv.y - 0.5) * 2.0;

        // Dark beveled metallic curb housing
        vec3 curbMetal = vec3(0.07, 0.10, 0.16);
        float moduleMask = smoothstep(0.14, 0.20, cellFract) * (1.0 - smoothstep(0.80, 0.86, cellFract))
                         * (1.0 - smoothstep(0.62, 0.78, ySym));
        float innerCoreMask = smoothstep(0.24, 0.32, cellFract) * (1.0 - smoothstep(0.68, 0.76, cellFract))
                            * (1.0 - smoothstep(0.32, 0.52, ySym));

        // Alternating Electric Cyan (even) and Molten Amber-Orange (odd) curb light modules
        float isOrange = mod(cellIdx, 2.0);
        vec3 modCol = mix(vec3(0.0, 0.88, 1.0), vec3(1.0, 0.52, 0.04), isOrange);
        vec3 hotCol = mix(vec3(0.85, 0.98, 1.0), vec3(1.0, 0.94, 0.55), isOrange);

        // Sequential flowing wave pulse along the curb modules
        float flowPulse = 0.76 + 0.34 * sin(cellIdx * 0.45 - uTime * 8.5);
        vec3 litCol = mix(modCol, hotCol, innerCoreMask) * flowPulse * uBrightness;

        vec3 finalCol = mix(curbMetal, litCol, moduleMask);
        gl_FragColor = vec4(clamp(finalCol, vec3(0.0), vec3(1.35)), 1.0);
      }
    `,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide,
  });
}

/**
 * Soft Volumetric Sky Laser Beam Shader with View-Space Fresnel Edge Falloff
 */
function createSearchlightShaderMaterial(colorHex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colorHex) },
      uEnableVolumetric: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vViewNormal;
      void main() {
        vUv = uv;
        vec4 localP = vec4(position, 1.0);
        vec3 localN = normal;
        #ifdef USE_INSTANCING
          localP = instanceMatrix * localP;
          localN = mat3(instanceMatrix) * localN;
        #endif
        vViewNormal = normalize(normalMatrix * localN);
        gl_Position = projectionMatrix * modelViewMatrix * localP;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uEnableVolumetric;
      varying vec2 vUv;
      varying vec3 vViewNormal;

      void main() {
        // vUv.y = 0 at base emitter, 1 at top of sky beam
        float vFade = pow(1.0 - clamp(vUv.y, 0.0, 1.0), 1.8) * smoothstep(0.0, 0.12, vUv.y);
        // Soften cylinder silhouette edges using view-space normal Z
        float edgeSoft = pow(abs(vViewNormal.z), 2.2);
        float pulse = 0.88 + 0.12 * sin(uTime * 1.8 + vUv.y * 5.0);
        float alpha = vFade * edgeSoft * 0.18 * pulse * uEnableVolumetric;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function buildTrackAndWorld(
  spline: THREE.CatmullRomCurve3,
  trackId: TrackId,
  atmosphere: AtmosphereMode,
  pads: TrackPad[],
  rings: EnergyRing[],
  textures: TrackTextureSet,
  neonIntensity: number,
  isSoftwareGl: boolean
): BuiltTrackWorld {
  const worldGroup = new THREE.Group();
  const animatedRings: THREE.Mesh[] = [];
  const animatedCrystals: THREE.Object3D[] = [];
  const animatedSearchlights: THREE.Object3D[] = [];
  const animatedShaders: THREE.ShaderMaterial[] = [];
  const isNeon = atmosphere === 'neon';
  const isCity = isCityTrack(trackId);
  const isCityV2 = trackId === 'city';
  const isLavaV2 = trackId === 'lava_v2';
  const isUpgradedTrack = isCityV2 || isLavaV2;

  // 0. Custom GLSL Atmospheric Sky & Nebula Dome
  const skyDome = createAtmosphericSkyDome(trackId, atmosphere);
  worldGroup.add(skyDome.mesh);
  animatedShaders.push(skyDome.material);

  const segments = 960;
  const uvTileScale = 2.5;
  const halfW = TRACK_HALF_WIDTH;

  const roadPositions = new Float32Array((segments + 1) * 2 * 3);
  const roadNormals = new Float32Array((segments + 1) * 2 * 3);
  const roadUvs = new Float32Array((segments + 1) * 2 * 2);
  const roadIndices: number[] = [];

  // Outer-Shoulder Viaduct Deck Aprons & Deep Armored Viaduct Box-Girder Side Fascia Skirts
  const leftApronPositions = new Float32Array((segments + 1) * 2 * 3);
  const rightApronPositions = new Float32Array((segments + 1) * 2 * 3);
  const deckApronUvs = new Float32Array((segments + 1) * 2 * 2);

  const leftFasciaPositions = new Float32Array((segments + 1) * 2 * 3);
  const rightFasciaPositions = new Float32Array((segments + 1) * 2 * 3);

  // Segmented Armored Barrier Wall + 3D Upper Coping Cap + Separate 3D Light Strips
  const leftRailPositions = new Float32Array((segments + 1) * 2 * 3);
  const rightRailPositions = new Float32Array((segments + 1) * 2 * 3);
  const railUvs = new Float32Array((segments + 1) * 2 * 2);

  const leftCapPositions = new Float32Array((segments + 1) * 2 * 3);
  const rightCapPositions = new Float32Array((segments + 1) * 2 * 3);

  const leftMidCyanStripPositions = new Float32Array((segments + 1) * 2 * 3);
  const rightMidCyanStripPositions = new Float32Array((segments + 1) * 2 * 3);
  const railCurveTypeAttr = new Float32Array((segments + 1) * 2);

  const leftNeonStripPositions = new Float32Array((segments + 1) * 2 * 3);
  const rightNeonStripPositions = new Float32Array((segments + 1) * 2 * 3);
  const railIndices: number[] = [];

  const pos = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  const minimapPoints: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const vTile = t * uvTileScale;
    sampleTrackFrame(spline, t, pos, fwd, right, up);

    if (i < segments && i % 4 === 0) {
      minimapPoints.push({ x: pos.x, y: pos.z });
    }

    const lx = pos.x - right.x * halfW;
    const ly = pos.y - right.y * halfW;
    const lz = pos.z - right.z * halfW;

    const rx = pos.x + right.x * halfW;
    const ry = pos.y + right.y * halfW;
    const rz = pos.z + right.z * halfW;

    const vIdx = i * 2 * 3;
    roadPositions[vIdx] = lx;
    roadPositions[vIdx + 1] = ly;
    roadPositions[vIdx + 2] = lz;
    roadPositions[vIdx + 3] = rx;
    roadPositions[vIdx + 4] = ry;
    roadPositions[vIdx + 5] = rz;

    roadNormals[vIdx] = up.x;
    roadNormals[vIdx + 1] = up.y;
    roadNormals[vIdx + 2] = up.z;
    roadNormals[vIdx + 3] = up.x;
    roadNormals[vIdx + 4] = up.y;
    roadNormals[vIdx + 5] = up.z;

    const uvIdx = i * 2 * 2;
    roadUvs[uvIdx] = 0;
    roadUvs[uvIdx + 1] = vTile;
    roadUvs[uvIdx + 2] = 1;
    roadUvs[uvIdx + 3] = vTile;

    // Outer-Shoulder Viaduct Aprons (3.85m wide on upgraded city/lava_v2, 2.35m on legacy v1)
    const apronOuterW = isUpgradedTrack ? halfW + 3.85 : halfW + 2.35;
    const lAx = pos.x - right.x * apronOuterW;
    const lAy = pos.y - right.y * apronOuterW;
    const lAz = pos.z - right.z * apronOuterW;

    const rAx = pos.x + right.x * apronOuterW;
    const rAy = pos.y + right.y * apronOuterW;
    const rAz = pos.z + right.z * apronOuterW;

    leftApronPositions[vIdx] = lAx;
    leftApronPositions[vIdx + 1] = lAy;
    leftApronPositions[vIdx + 2] = lAz;
    leftApronPositions[vIdx + 3] = lx;
    leftApronPositions[vIdx + 4] = ly;
    leftApronPositions[vIdx + 5] = lz;

    rightApronPositions[vIdx] = rx;
    rightApronPositions[vIdx + 1] = ry;
    rightApronPositions[vIdx + 2] = rz;
    rightApronPositions[vIdx + 3] = rAx;
    rightApronPositions[vIdx + 4] = rAy;
    rightApronPositions[vIdx + 5] = rAz;

    // 3.4m-Deep Solid Armored Viaduct Box-Girder Side Fascia Skirt (physically separates elevated road from background buildings/terrain)
    const fasciaDepth = 3.4;
    leftFasciaPositions[vIdx] = lAx - up.x * fasciaDepth;
    leftFasciaPositions[vIdx + 1] = lAy - up.y * fasciaDepth;
    leftFasciaPositions[vIdx + 2] = lAz - up.z * fasciaDepth;
    leftFasciaPositions[vIdx + 3] = lAx;
    leftFasciaPositions[vIdx + 4] = lAy;
    leftFasciaPositions[vIdx + 5] = lAz;

    rightFasciaPositions[vIdx] = rAx;
    rightFasciaPositions[vIdx + 1] = rAy;
    rightFasciaPositions[vIdx + 2] = rAz;
    rightFasciaPositions[vIdx + 3] = rAx - up.x * fasciaDepth;
    rightFasciaPositions[vIdx + 4] = rAy - up.y * fasciaDepth;
    rightFasciaPositions[vIdx + 5] = rAz - up.z * fasciaDepth;

    deckApronUvs[uvIdx] = 0;
    deckApronUvs[uvIdx + 1] = vTile;
    deckApronUvs[uvIdx + 2] = isUpgradedTrack ? 0.5 : 0.25;
    deckApronUvs[uvIdx + 3] = vTile;

    // Smoothed local curvature magnitude to classify Straightaways (0.0), Normal/Parabolic Curves (1.0 -> Yellow Arrows),
    // and Difficult Curves/Hairpins (2.0 -> Red Arrows), while dynamically increasing guardrail height in curves!
    const k0 = Math.abs(estimateTrackCurvature(trackId, t));
    const kPrev = Math.abs(estimateTrackCurvature(trackId, (t - 0.010 + 1) % 1));
    const kNext = Math.abs(estimateTrackCurvature(trackId, (t + 0.010) % 1));
    const maxCurveK = Math.max(k0, (kPrev + k0 + kNext) / 3);
    const curveTypeVal = maxCurveK >= 0.30 ? 2.0 : maxCurveK >= 0.055 ? 1.0 : 0.0;
    railCurveTypeAttr[i * 2] = curveTypeVal;
    railCurveTypeAttr[i * 2 + 1] = curveTypeVal;

    // Larger, taller Segmented Armored Guardrail Base positioned at railW = halfW + 1.25 (14.75m)
    // so when a craft reaches its physical boundary limit (±12.13m), its outer wingtip (±2.54m -> 14.67m)
    // contacts the inner guardrail face cleanly without ever clipping through the wall or curve arrows!
    const railOutset = 1.25;
    const gLx = lx - right.x * railOutset;
    const gLy = ly - right.y * railOutset;
    const gLz = lz - right.z * railOutset;
    const gRx = rx + right.x * railOutset;
    const gRy = ry + right.y * railOutset;
    const gRz = rz + right.z * railOutset;

    const railH = curveTypeVal >= 1.5 ? 2.55 : curveTypeVal >= 0.5 ? 2.25 : 1.72;
    leftRailPositions[vIdx] = gLx;
    leftRailPositions[vIdx + 1] = gLy;
    leftRailPositions[vIdx + 2] = gLz;
    leftRailPositions[vIdx + 3] = gLx + up.x * railH;
    leftRailPositions[vIdx + 4] = gLy + up.y * railH;
    leftRailPositions[vIdx + 5] = gLz + up.z * railH;

    rightRailPositions[vIdx] = gRx;
    rightRailPositions[vIdx + 1] = gRy;
    rightRailPositions[vIdx + 2] = gRz;
    rightRailPositions[vIdx + 3] = gRx + up.x * railH;
    rightRailPositions[vIdx + 4] = gRy + up.y * railH;
    rightRailPositions[vIdx + 5] = gRz + up.z * railH;

    railUvs[uvIdx] = vTile;
    railUvs[uvIdx + 1] = 0;
    railUvs[uvIdx + 2] = vTile;
    railUvs[uvIdx + 3] = 1;

    // 3D Beveled Upper Barrier Coping Flange cleanly above the taller guardrail wall
    const capH = railH + 0.04;
    const capW = 0.62;
    leftCapPositions[vIdx] = gLx - right.x * capW + up.x * capH;
    leftCapPositions[vIdx + 1] = gLy - right.y * capW + up.y * capH;
    leftCapPositions[vIdx + 2] = gLz - right.z * capW + up.z * capH;
    leftCapPositions[vIdx + 3] = gLx + right.x * 0.08 + up.x * capH;
    leftCapPositions[vIdx + 4] = gLy + right.y * 0.08 + up.y * capH;
    leftCapPositions[vIdx + 5] = gLz + right.z * 0.08 + up.z * capH;

    rightCapPositions[vIdx] = gRx - right.x * 0.08 + up.x * capH;
    rightCapPositions[vIdx + 1] = gRy - right.y * 0.08 + up.y * capH;
    rightCapPositions[vIdx + 2] = gRz - right.z * 0.08 + up.z * capH;
    rightCapPositions[vIdx + 3] = gRx + right.x * capW + up.x * capH;
    rightCapPositions[vIdx + 4] = gRy + right.y * capW + up.y * capH;
    rightCapPositions[vIdx + 5] = gRz + right.z * capW + up.z * capH;

    // Large, High-Visibility 3D Animated Arrow Channel inside the Recessed Guardrail (0.36m to railH - 0.24m)
    const midH1 = 0.36;
    const midH2 = railH - 0.24;
    const inwardOffset = 0.075;
    leftMidCyanStripPositions[vIdx] = gLx + right.x * inwardOffset + up.x * midH1;
    leftMidCyanStripPositions[vIdx + 1] = gLy + right.y * inwardOffset + up.y * midH1;
    leftMidCyanStripPositions[vIdx + 2] = gLz + right.z * inwardOffset + up.z * midH1;
    leftMidCyanStripPositions[vIdx + 3] = gLx + right.x * inwardOffset + up.x * midH2;
    leftMidCyanStripPositions[vIdx + 4] = gLy + right.y * inwardOffset + up.y * midH2;
    leftMidCyanStripPositions[vIdx + 5] = gLz + right.z * inwardOffset + up.z * midH2;

    rightMidCyanStripPositions[vIdx] = gRx - right.x * inwardOffset + up.x * midH1;
    rightMidCyanStripPositions[vIdx + 1] = gRy - right.y * inwardOffset + up.y * midH1;
    rightMidCyanStripPositions[vIdx + 2] = gRz - right.z * inwardOffset + up.z * midH1;
    rightMidCyanStripPositions[vIdx + 3] = gRx - right.x * inwardOffset + up.x * midH2;
    rightMidCyanStripPositions[vIdx + 4] = gRy - right.y * inwardOffset + up.y * midH2;
    rightMidCyanStripPositions[vIdx + 5] = gRz - right.z * inwardOffset + up.z * midH2;

    // Flowing Plasma Top Rail Strip cleanly above the Coping Cap
    const stripH1 = railH + 0.06;
    const stripH2 = railH + 0.28;
    leftNeonStripPositions[vIdx] = gLx + up.x * stripH1;
    leftNeonStripPositions[vIdx + 1] = gLy + up.y * stripH1;
    leftNeonStripPositions[vIdx + 2] = gLz + up.z * stripH1;
    leftNeonStripPositions[vIdx + 3] = gLx + up.x * stripH2;
    leftNeonStripPositions[vIdx + 4] = gLy + up.y * stripH2;
    leftNeonStripPositions[vIdx + 5] = gLz + up.z * stripH2;

    rightNeonStripPositions[vIdx] = gRx + up.x * stripH1;
    rightNeonStripPositions[vIdx + 1] = gRy + up.y * stripH1;
    rightNeonStripPositions[vIdx + 2] = gRz + up.z * stripH1;
    rightNeonStripPositions[vIdx + 3] = gRx + up.x * stripH2;
    rightNeonStripPositions[vIdx + 4] = gRy + up.y * stripH2;
    rightNeonStripPositions[vIdx + 5] = gRz + up.z * stripH2;

    if (i < segments) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      roadIndices.push(a, b, c, b, d, c);
      railIndices.push(a, c, b, b, c, d);
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('normal', new THREE.BufferAttribute(roadNormals, 3));
  roadGeo.setAttribute('uv', new THREE.BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);

  // High-contrast dark carbon-anthracite racing deck with crisp luminous lane telemetry
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    map: textures.roadMap,
    emissive: new THREE.Color(isNeon ? 0xffffff : 0x22d3ee),
    emissiveMap: textures.roadEmissiveMap,
    emissiveIntensity: isNeon ? (isUpgradedTrack ? 0.52 : 0.38) * neonIntensity : 0.14,
    bumpMap: textures.roadBumpMap,
    bumpScale: isUpgradedTrack ? 0.055 : 0.035,
    roughnessMap: textures.roadRoughnessMap,
    roughness: isUpgradedTrack ? 0.78 : 0.82,
    metalness: isUpgradedTrack ? 0.18 : 0.12,
    envMapIntensity: 0.0,
    side: THREE.DoubleSide,
  });

  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = !isSoftwareGl;
  worldGroup.add(roadMesh);

  // Outer-Shoulder Structural Viaduct Aprons & Deep Box-Girder Side Fascia Skirts:
  // Uses solid dark armored steel plating (zero rainbow emissive wash) so the track's outer silhouette
  // forms a dark, unmistakable physical chassis frame separating the road from the background environment!
  const leftApronGeo = new THREE.BufferGeometry();
  leftApronGeo.setAttribute('position', new THREE.BufferAttribute(leftApronPositions, 3));
  leftApronGeo.setAttribute('normal', new THREE.BufferAttribute(roadNormals, 3));
  leftApronGeo.setAttribute('uv', new THREE.BufferAttribute(deckApronUvs, 2));
  leftApronGeo.setIndex(roadIndices);

  const rightApronGeo = new THREE.BufferGeometry();
  rightApronGeo.setAttribute('position', new THREE.BufferAttribute(rightApronPositions, 3));
  rightApronGeo.setAttribute('normal', new THREE.BufferAttribute(roadNormals, 3));
  rightApronGeo.setAttribute('uv', new THREE.BufferAttribute(deckApronUvs, 2));
  rightApronGeo.setIndex(roadIndices);

  const leftFasciaGeo = new THREE.BufferGeometry();
  leftFasciaGeo.setAttribute('position', new THREE.BufferAttribute(leftFasciaPositions, 3));
  leftFasciaGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  leftFasciaGeo.setIndex(railIndices);
  leftFasciaGeo.computeVertexNormals();

  const rightFasciaGeo = new THREE.BufferGeometry();
  rightFasciaGeo.setAttribute('position', new THREE.BufferAttribute(rightFasciaPositions, 3));
  rightFasciaGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  rightFasciaGeo.setIndex(railIndices);
  rightFasciaGeo.computeVertexNormals();

  const apronTex = isCityV2
    ? textures.cityArmourPanelsMap
    : isLavaV2
    ? textures.volcanicGravelMap
    : textures.roadwayPanelsMap;
  const deckApronMat = new THREE.MeshStandardMaterial({
    color: isNeon ? 0x0b101d : 0x334155,
    map: apronTex,
    bumpMap: apronTex,
    bumpScale: isLavaV2 ? 0.14 : 0.08,
    roughness: 0.64,
    metalness: 0.68,
    envMapIntensity: 0.08,
    side: THREE.DoubleSide,
  });
  worldGroup.add(new THREE.Mesh(leftApronGeo, deckApronMat));
  worldGroup.add(new THREE.Mesh(rightApronGeo, deckApronMat));
  worldGroup.add(new THREE.Mesh(leftFasciaGeo, deckApronMat));
  worldGroup.add(new THREE.Mesh(rightFasciaGeo, deckApronMat));

  // Segmented Armored Guardrail Walls
  const leftRailGeo = new THREE.BufferGeometry();
  leftRailGeo.setAttribute('position', new THREE.BufferAttribute(leftRailPositions, 3));
  leftRailGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  leftRailGeo.setIndex(railIndices);
  leftRailGeo.computeVertexNormals();

  const rightRailGeo = new THREE.BufferGeometry();
  rightRailGeo.setAttribute('position', new THREE.BufferAttribute(rightRailPositions, 3));
  rightRailGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  rightRailGeo.setIndex(railIndices);
  rightRailGeo.computeVertexNormals();

  const barrierTex = isCityV2 ? textures.cityCyanBarrierMap : textures.cyanGuardrailMap;
  const metalStructureTex = isCityV2 ? textures.cityArmourPanelsMap : textures.brushedGraphiteMap;

  // Guardrail Wall: Dark armored housing with high-contrast heterogeneous rim tint
  const guardrailBarrierMat = new THREE.MeshStandardMaterial({
    color: isNeon ? 0x1e293b : 0x64748b,
    map: metalStructureTex,
    emissive: new THREE.Color(
      isNeon ? (isCity ? 0xf59e0b : 0x00d8ff) : 0x000000
    ),
    emissiveMap: barrierTex,
    emissiveIntensity: isNeon ? 0.36 * neonIntensity : 0,
    bumpMap: metalStructureTex,
    bumpScale: 0.06,
    metalness: 0.68,
    roughness: 0.42,
    envMapIntensity: 0.12,
    side: THREE.DoubleSide,
  });
  worldGroup.add(new THREE.Mesh(leftRailGeo, guardrailBarrierMat));
  worldGroup.add(new THREE.Mesh(rightRailGeo, guardrailBarrierMat));

  // 3D Upper Barrier Coping Cap (Dark Armored Titanium-Graphite Flange)
  const leftCapGeo = new THREE.BufferGeometry();
  leftCapGeo.setAttribute('position', new THREE.BufferAttribute(leftCapPositions, 3));
  leftCapGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  leftCapGeo.setIndex(roadIndices);
  leftCapGeo.computeVertexNormals();

  const rightCapGeo = new THREE.BufferGeometry();
  rightCapGeo.setAttribute('position', new THREE.BufferAttribute(rightCapPositions, 3));
  rightCapGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  rightCapGeo.setIndex(roadIndices);
  rightCapGeo.computeVertexNormals();

  const graphiteStructureMat = new THREE.MeshStandardMaterial({
    color: isNeon ? 0x0f172a : 0x475569,
    map: metalStructureTex,
    bumpMap: metalStructureTex,
    bumpScale: 0.045,
    metalness: 0.72,
    roughness: 0.38,
    envMapIntensity: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide,
  });
  worldGroup.add(new THREE.Mesh(leftCapGeo, graphiteStructureMat));
  worldGroup.add(new THREE.Mesh(rightCapGeo, graphiteStructureMat));

  // Separate 3D Geometric Flowing-Arrow & Flowing-Light Channel inside the Recessed Guardrail
  const leftMidCyanGeo = new THREE.BufferGeometry();
  leftMidCyanGeo.setAttribute('position', new THREE.BufferAttribute(leftMidCyanStripPositions, 3));
  leftMidCyanGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  leftMidCyanGeo.setAttribute('aCurveType', new THREE.BufferAttribute(railCurveTypeAttr, 1));
  leftMidCyanGeo.setIndex(railIndices);

  const rightMidCyanGeo = new THREE.BufferGeometry();
  rightMidCyanGeo.setAttribute('position', new THREE.BufferAttribute(rightMidCyanStripPositions, 3));
  rightMidCyanGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  rightMidCyanGeo.setAttribute('aCurveType', new THREE.BufferAttribute(railCurveTypeAttr, 1));
  rightMidCyanGeo.setIndex(railIndices);

  const stripBrightness = THREE.MathUtils.clamp(0.45 + 0.38 * neonIntensity, 0.48, 0.96);
  const midStripColor = new THREE.Color(isCity ? 0xfef08a : 0x00f2fe).multiplyScalar(stripBrightness);
  const midCyanLightMat = new THREE.MeshBasicMaterial({
    color: midStripColor,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide,
  });
  const flowingGuardrailChannelMat = createFlowingGuardrailChannelMaterial(isCity, isNeon, neonIntensity);
  animatedShaders.push(flowingGuardrailChannelMat);
  worldGroup.add(new THREE.Mesh(leftMidCyanGeo, flowingGuardrailChannelMat));
  worldGroup.add(new THREE.Mesh(rightMidCyanGeo, flowingGuardrailChannelMat));

  // Flowing Top Plasma Rail Strips (`Screenshot_from_2026-10-29_22-07-54_7c765c69.png`)
  const leftStripGeo = new THREE.BufferGeometry();
  leftStripGeo.setAttribute('position', new THREE.BufferAttribute(leftNeonStripPositions, 3));
  leftStripGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  leftStripGeo.setIndex(railIndices);

  const rightStripGeo = new THREE.BufferGeometry();
  rightStripGeo.setAttribute('position', new THREE.BufferAttribute(rightNeonStripPositions, 3));
  rightStripGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  rightStripGeo.setIndex(railIndices);

  const flowingTopRailMat = createFlowingTopRailMaterial(isCity, isNeon, neonIntensity);
  animatedShaders.push(flowingTopRailMat);
  worldGroup.add(new THREE.Mesh(leftStripGeo, flowingTopRailMat));
  worldGroup.add(new THREE.Mesh(rightStripGeo, flowingTopRailMat));

  // 3D Beveled Lower Curb Light Strip with Alternating Electric-Cyan & Amber-Orange Modules along both guardrails
  const leftCurbStripPositions = new Float32Array((segments + 1) * 2 * 3);
  const rightCurbStripPositions = new Float32Array((segments + 1) * 2 * 3);
  for (let i = 0; i <= segments; i++) {
    const vIdx = i * 2 * 3;
    const lx = leftRailPositions[vIdx];
    const ly = leftRailPositions[vIdx + 1];
    const lz = leftRailPositions[vIdx + 2];
    const rx = rightRailPositions[vIdx];
    const ry = rightRailPositions[vIdx + 1];
    const rz = rightRailPositions[vIdx + 2];
    const ux = roadNormals[vIdx];
    const uy = roadNormals[vIdx + 1];
    const uz = roadNormals[vIdx + 2];
    const spanW = (halfW + 1.25) * 2;
    const rVecX = (rx - lx) / spanW;
    const rVecY = (ry - ly) / spanW;
    const rVecZ = (rz - lz) / spanW;

    // Slanted 3D curb face bridging the road edge (inward 1.25m, height 0.03m) to the guardrail base (inward 0.08m, height 0.30m)
    leftCurbStripPositions[vIdx] = lx + rVecX * 1.25 + ux * 0.03;
    leftCurbStripPositions[vIdx + 1] = ly + rVecY * 1.25 + uy * 0.03;
    leftCurbStripPositions[vIdx + 2] = lz + rVecZ * 1.25 + uz * 0.03;
    leftCurbStripPositions[vIdx + 3] = lx + rVecX * 0.08 + ux * 0.30;
    leftCurbStripPositions[vIdx + 4] = ly + rVecY * 0.08 + uy * 0.30;
    leftCurbStripPositions[vIdx + 5] = lz + rVecZ * 0.08 + uz * 0.30;

    rightCurbStripPositions[vIdx] = rx - rVecX * 1.25 + ux * 0.03;
    rightCurbStripPositions[vIdx + 1] = ry - rVecY * 1.25 + uy * 0.03;
    rightCurbStripPositions[vIdx + 2] = rz - rVecZ * 1.25 + uz * 0.03;
    rightCurbStripPositions[vIdx + 3] = rx - rVecX * 0.08 + ux * 0.30;
    rightCurbStripPositions[vIdx + 4] = ry - rVecY * 0.08 + uy * 0.30;
    rightCurbStripPositions[vIdx + 5] = rz - rVecZ * 0.08 + uz * 0.30;
  }
  const leftCurbStripGeo = new THREE.BufferGeometry();
  leftCurbStripGeo.setAttribute('position', new THREE.BufferAttribute(leftCurbStripPositions, 3));
  leftCurbStripGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  leftCurbStripGeo.setIndex(railIndices);

  const rightCurbStripGeo = new THREE.BufferGeometry();
  rightCurbStripGeo.setAttribute('position', new THREE.BufferAttribute(rightCurbStripPositions, 3));
  rightCurbStripGeo.setAttribute('uv', new THREE.BufferAttribute(railUvs, 2));
  rightCurbStripGeo.setIndex(railIndices);

  const curbLightStripMat = createFlowingCurbLightStripMaterial(isNeon, neonIntensity);
  animatedShaders.push(curbLightStripMat);
  worldGroup.add(new THREE.Mesh(leftCurbStripGeo, curbLightStripMat));
  worldGroup.add(new THREE.Mesh(rightCurbStripGeo, curbLightStripMat));

  // Guardrail Rib Stanchions & Support Brackets (scaled to 260 on Extended City Circuit)
  const stanchionCount = isCity ? 260 : 120;
  const stanchionGeo = new THREE.BoxGeometry(0.52, 1.52, 0.72);
  const stanchionMat = new THREE.MeshStandardMaterial({
    color: isNeon ? 0x1e293b : 0x64748b,
    map: metalStructureTex,
    emissive: new THREE.Color(isNeon ? (isCity ? 0xf59e0b : 0x00d8ff) : 0x000000),
    emissiveMap: textures.cyanNeonSurfaceMap,
    emissiveIntensity: isNeon ? 0.24 * neonIntensity : 0,
    metalness: 0.58,
    roughness: 0.52,
    envMapIntensity: 0.12,
  });
  const leftStanchions = new THREE.InstancedMesh(stanchionGeo, stanchionMat, stanchionCount);
  const rightStanchions = new THREE.InstancedMesh(stanchionGeo, stanchionMat, stanchionCount);

  const dummy = new THREE.Object3D();
  const rotMat = new THREE.Matrix4();
  const lookTarget = new THREE.Vector3();

  for (let i = 0; i < stanchionCount; i++) {
    const t = i / stanchionCount;
    sampleTrackFrame(spline, t, pos, fwd, right, up);
    lookTarget.copy(pos).add(fwd);
    rotMat.lookAt(pos, lookTarget, up);

    dummy.position
      .copy(pos)
      .addScaledVector(right, -(halfW + 1.58))
      .addScaledVector(up, 0.72);
    dummy.quaternion.setFromRotationMatrix(rotMat);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    leftStanchions.setMatrixAt(i, dummy.matrix);

    dummy.position
      .copy(pos)
      .addScaledVector(right, halfW + 1.58)
      .addScaledVector(up, 0.72);
    dummy.updateMatrix();
    rightStanchions.setMatrixAt(i, dummy.matrix);
  }
  leftStanchions.computeBoundingSphere();
  rightStanchions.computeBoundingSphere();
  worldGroup.add(leftStanchions, rightStanchions);

  // Support Pylons & Under-bridge Structural Girders (02_dark_armour_panels on 'city', 04_brushed_graphite on lava)
  // Note: Skip central vertical pylons at the Skybridge / Magma Viaduct Overpasses and subterranean tunnels
  // so no central pylon ever drops down into an underpass or tunnel below!
  const pylonCount = 58;
  const pylonGeo = new THREE.CylinderGeometry(1.4, 2.2, 70, 8);
  const crossBeamGeo = new THREE.BoxGeometry(halfW * 2.1, 1.45, 2.6);
  const pylonMat = new THREE.MeshStandardMaterial({
    color: isNeon ? 0x475569 : 0x94a3b8,
    map: metalStructureTex,
    bumpMap: metalStructureTex,
    bumpScale: 0.03,
    metalness: 0.58,
    roughness: 0.52,
    envMapIntensity: 0.12,
  });

  const pylonInstanced = new THREE.InstancedMesh(pylonGeo, pylonMat, pylonCount);
  const beamInstanced = new THREE.InstancedMesh(crossBeamGeo, pylonMat, pylonCount);
  const pylonCheckSamples = buildTrackSamplesXZ(spline, 720);
  const minPylonHorizClearanceSq = (halfW + 24.0) * (halfW + 24.0);

  for (let i = 0; i < pylonCount; i++) {
    const t = i / pylonCount;
    sampleTrackFrame(spline, t, pos, fwd, right, up);
    lookTarget.copy(pos).add(fwd);
    rotMat.lookAt(pos, lookTarget, up);

    let collidesWithOtherSegment = isCity
      ? (t >= 0.145 && t <= 0.225) || (t >= 0.695 && t <= 0.835)
      : (t >= 0.132 && t <= 0.184) || (t >= 0.742 && t <= 0.858);
    if (!collidesWithOtherSegment) {
      for (let sIdx = 0; sIdx < pylonCheckSamples.length; sIdx++) {
        const sT = sIdx / pylonCheckSamples.length;
        const dT = Math.abs(t - sT);
        if (dT > 0.018 && dT < 0.982) {
          const dx = pos.x - pylonCheckSamples[sIdx].x;
          const dz = pos.z - pylonCheckSamples[sIdx].z;
          if (dx * dx + dz * dz < minPylonHorizClearanceSq) {
            collidesWithOtherSegment = true;
            break;
          }
        }
      }
    }

    if (collidesWithOtherSegment) {
      dummy.position.set(0, -999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      pylonInstanced.setMatrixAt(i, dummy.matrix);
    } else {
      // Pylon top is at pos.y - 6.5m so it never pokes through steep descents or banked track
      dummy.position.set(pos.x, pos.y - 41.5, pos.z);
      dummy.rotation.set(0, Math.atan2(fwd.x, fwd.z), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pylonInstanced.setMatrixAt(i, dummy.matrix);
    }

    // Cross-beam is rotated with the track's 3D bank/pitch and sits 2.6m below the road surface
    dummy.position.copy(pos).addScaledVector(up, -2.6);
    dummy.quaternion.setFromRotationMatrix(rotMat);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    beamInstanced.setMatrixAt(i, dummy.matrix);
  }
  pylonInstanced.computeBoundingSphere();
  beamInstanced.computeBoundingSphere();
  worldGroup.add(pylonInstanced, beamInstanced);

  // Overhead Circular Energy Rings with Armored Outer Collar, Support Brackets & Neon Trim Panels
  const outerRingGeo = new THREE.TorusGeometry(halfW * 1.22, 0.38, 16, 64);
  const innerRingGeo = new THREE.TorusGeometry(halfW * 1.12, 0.62, 20, 64);
  const haloRingGeo = new THREE.RingGeometry(halfW * 0.92, halfW * 1.32, 64);
  const coilFinGeo = new THREE.BoxGeometry(0.88, 2.35, 2.15);
  const ringSupportBracketGeo = new THREE.BoxGeometry(1.15, 4.6, 1.45);
  const ringTrimPanelGeo = new THREE.BoxGeometry(0.22, 3.6, 1.52);
  const ringEmissiveStripGeo = new THREE.BoxGeometry(0.28, 3.4, 0.18);

  const outerFrameMat = new THREE.MeshStandardMaterial({
    color: isNeon ? 0x64748b : 0x94a3b8,
    map: metalStructureTex,
    bumpMap: metalStructureTex,
    bumpScale: 0.025,
    metalness: 0.58,
    roughness: 0.48,
    envMapIntensity: 0.12,
  });

  const cyanTrimPanelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    map: isCityV2 ? textures.cityMagentaRailMap : textures.cyanNeonSurfaceMap,
    emissive: new THREE.Color(isCityV2 && isNeon ? 0xff2a85 : 0x000000),
    emissiveMap: isCityV2 ? textures.cityMagentaRailMap : null,
    emissiveIntensity: isCityV2 && isNeon ? 0.35 * neonIntensity : 0,
    roughness: 0.50,
    metalness: 0.48,
    envMapIntensity: 0.12,
  });

  const cyanTubeMat = createRingPlasmaTubeMaterial(0xcffafe, 0x00d8ff);
  const orangeTubeMat = createRingPlasmaTubeMaterial(0xfde68a, 0xff5500);
  const cyanHaloMat = createRingHaloMaterial(0x00d8ff);
  const orangeHaloMat = createRingHaloMaterial(0xff6b00);
  animatedShaders.push(cyanTubeMat, orangeTubeMat, cyanHaloMat, orangeHaloMat);

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    sampleTrackFrame(spline, ring.t, pos, fwd, right, up);

    const ringGroup = new THREE.Group();
    ringGroup.position.copy(pos).addScaledVector(up, 3.2);
    lookTarget.copy(ringGroup.position).add(fwd);
    rotMat.lookAt(ringGroup.position, lookTarget, up);
    ringGroup.quaternion.setFromRotationMatrix(rotMat);

    const isOrange = ring.colorType === 'orange' && isNeon;
    const outerMesh = new THREE.Mesh(outerRingGeo, outerFrameMat);
    const innerMesh = new THREE.Mesh(innerRingGeo, isOrange ? orangeTubeMat : cyanTubeMat);
    const haloMesh = new THREE.Mesh(haloRingGeo, isOrange ? orangeHaloMat : cyanHaloMat);

    // 6 Radial Magnetic Accelerator Fins around each portal ring
    const ringRadius = halfW * 1.22;
    for (let f = 0; f < 6; f++) {
      const angle = (f / 6) * Math.PI * 2;
      const finMesh = new THREE.Mesh(coilFinGeo, outerFrameMat);
      finMesh.position.set(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, 0);
      finMesh.rotation.z = angle + Math.PI / 2;
      ringGroup.add(finMesh);
    }

    // Twin Trackside Ring Support Brackets
    for (const side of [-1, 1]) {
      const bracket = new THREE.Mesh(ringSupportBracketGeo, outerFrameMat);
      bracket.position.set(side * (halfW + 1.15), -1.35, 0);
      bracket.rotation.z = side * 0.22;
      ringGroup.add(bracket);

      const trimPanel = new THREE.Mesh(ringTrimPanelGeo, cyanTrimPanelMat);
      trimPanel.position.set(side * (halfW + 0.62), -1.35, 0);
      trimPanel.rotation.z = side * 0.22;
      ringGroup.add(trimPanel);

      const lightStrip = new THREE.Mesh(ringEmissiveStripGeo, midCyanLightMat);
      lightStrip.position.set(side * (halfW + 0.52), -1.35, 0);
      lightStrip.rotation.z = side * 0.22;
      ringGroup.add(lightStrip);
    }

    // Hard-surface segmented platform footing beneath each energy ring gate:
    // - On 'city' (MK-II): 08_cyan_corridor_floor.png tech deck plates with twin cyan strips & ventilation louvers
    // - On 'lava_v2' (MK-II): 01_roadway_panels.png dark segmented road plates
    if (isUpgradedTrack) {
      const ringPlatformGeo = new THREE.BoxGeometry(halfW * 2 + 6.4, 0.42, 4.8);
      const platTex = isCityV2 ? textures.cityCorridorFloorMap : textures.roadwayPanelsMap;
      const ringPlatformMat = new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        map: platTex,
        bumpMap: platTex,
        bumpScale: 0.08,
        emissive: new THREE.Color(isCityV2 && isNeon ? 0x00d8ff : 0x000000),
        emissiveMap: isCityV2 ? platTex : null,
        emissiveIntensity: isCityV2 && isNeon ? 0.28 * neonIntensity : 0,
        roughness: 0.58,
        metalness: 0.48,
        envMapIntensity: 0.12,
      });
      const ringPlat = new THREE.Mesh(ringPlatformGeo, ringPlatformMat);
      // Positioned cleanly beneath the road deck (-3.72m in ringGroup = -0.52m below road surface) to prevent road Z-fighting
      ringPlat.position.set(0, -3.72, 0);
      ringGroup.add(ringPlat);
    }

    ringGroup.add(outerMesh, innerMesh, haloMesh);
    worldGroup.add(ringGroup);
    animatedRings.push(innerMesh);
  }

  // ============================================================================
  // ON-TRACK 3D POWER-UP / BONUS SYSTEM WITH FLOATING 3D SPINNING HOLOGRAPHIC BOXES
  // Strictly modeled after the 6 reference items for both City and Lava circuits:
  // 1. BOOST          — Flat on-track yellow triple-arrow velocity boost pad
  // 2. NITRO POWER-UP — Tilted compact canister filled with glowing blue fuel
  // 3. CRYSTAL BONUS  — Sharp faceted magenta crystal floating above the track
  // 4. SHIELD POWER-UP— Blue-violet orb protected by a glowing hexagonal energy grid & clamps
  // 5. REPAIR POWER-UP— Reinforced dark-metal crate with a glowing cyan medical cross (+)
  // 6. CREDIT BONUS   — Gold-edged circular token with a raised central hexagonal emblem
  // ============================================================================
  const powerUpBoxes: PowerUpPickupInstance[] = [];

  // Unified Standard Lane-Wide Electric-Blue 3-Arrow Velocity-Boost Pad (9.2m wide x 18.6m long):
  // Modeled strictly after `Screenshot_from_2026-10-29_22-37-54_b7ecbeab.png`:
  // - One single standard boost pad across all tracks (same size, same Electric Blue color).
  // - Wide enough to cover a full lane of the track (9.2m) and long in proportion (18.6m).
  // - 3 Electric Blue arrows (>>>) that light up in series with a progressive combo pulsation!
  const boostPadGeo = new THREE.PlaneGeometry(9.2, 18.6);
  boostPadGeo.rotateX(-Math.PI / 2);

  const standardBoostPadMat = createStandardElectricBlueBoostPadMaterial(isNeon);
  const rechargePadMat = createPadShaderMaterial(0x10b981, 0x22d3ee, isNeon);
  animatedShaders.push(standardBoostPadMat, rechargePadMat);

  // Shared materials for the 6 Power-Up 3D models & In-Game Pickup Box frames
  const darkCasingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    map: metalStructureTex,
    metalness: 0.85,
    roughness: 0.28,
  });
  const gunmetalTrimMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    map: metalStructureTex,
    metalness: 0.82,
    roughness: 0.34,
  });

  // 1. BOOST materials
  const boostCyanCoreMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
  const boostWhiteInnerMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.9,
  });

  // 2. NITRO POWER-UP materials
  const nitroGlassMat = new THREE.MeshStandardMaterial({
    color: 0x00d2ff,
    emissive: new THREE.Color(0x0284c7),
    emissiveIntensity: 0.95,
    metalness: 0.2,
    roughness: 0.12,
    transparent: true,
    opacity: 0.86,
  });
  const nitroCoreMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
  });

  // 3. CRYSTAL BONUS materials
  const crystalMagentaMat = new THREE.MeshStandardMaterial({
    color: 0xd946ef,
    emissive: new THREE.Color(0x9333ea),
    emissiveIntensity: 0.85,
    metalness: 0.35,
    roughness: 0.15,
  });
  const crystalFacetWireMat = new THREE.MeshBasicMaterial({
    color: 0xf5d0fe,
    wireframe: true,
    transparent: true,
    opacity: 0.72,
  });

  // 4. SHIELD POWER-UP materials
  const shieldOrbMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    emissive: new THREE.Color(0x4f46e5),
    emissiveIntensity: 0.82,
    metalness: 0.3,
    roughness: 0.18,
    transparent: true,
    opacity: 0.92,
  });
  const shieldHexGridMat = new THREE.MeshBasicMaterial({
    color: 0x93c5fd,
    wireframe: true,
    transparent: true,
    opacity: 0.88,
  });

  // 5. REPAIR POWER-UP materials
  const repairCrossMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
  });

  // 6. CREDIT BONUS materials
  const creditGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: new THREE.Color(0xd97706),
    emissiveIntensity: 0.55,
    metalness: 0.88,
    roughness: 0.22,
  });
  const creditGlowRingMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
  });

  // Shared geometries for High-Visibility 3D Spinning Power-Up, Bonus & Weapon Boxes Floating Above the Track
  const baseGlowRingGeo = new THREE.RingGeometry(1.15, 1.68, 32);
  baseGlowRingGeo.rotateX(-Math.PI / 2);
  const baseInnerDiscGeo = new THREE.CircleGeometry(1.15, 32);
  baseInnerDiscGeo.rotateX(-Math.PI / 2);
  const holoCrateSize = 2.56;
  const holoCrateHalf = holoCrateSize * 0.5;
  const holoCrateGlassGeo = new THREE.BoxGeometry(2.44, 2.44, 2.44);
  const holoStrutBarXGeo = new THREE.BoxGeometry(holoCrateSize, 0.16, 0.16);
  const holoStrutBarYGeo = new THREE.BoxGeometry(0.16, holoCrateSize, 0.16);
  const holoStrutBarZGeo = new THREE.BoxGeometry(0.16, 0.16, holoCrateSize);
  const holoInnerOctaGeo = new THREE.OctahedronGeometry(1.48, 0);
  const cornerBracketGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);

  const create3DPowerUpModel = (pType: PowerUpItemType): THREE.Group => {
    const itemGroup = new THREE.Group();

    if (pType === 'boost') {
      // BOOST — Circular cyan energy ring with bright inner glow & 4 segmented dark-metal clamps
      const mainRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.13, 14, 36),
        boostCyanCoreMat
      );
      const innerGlowRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.50, 0.045, 10, 32),
        boostWhiteInnerMat
      );
      itemGroup.add(mainRing, innerGlowRing);

      // 4 Segmented Dark-Metal Armor Clamps around the ring (12, 3, 6, 9 o'clock)
      const clampGeo = new THREE.TorusGeometry(0.62, 0.165, 12, 14, 0.52);
      for (let c = 0; c < 4; c++) {
        const clampMesh = new THREE.Mesh(clampGeo, darkCasingMat);
        clampMesh.rotation.z = c * (Math.PI / 2) - 0.26;
        itemGroup.add(clampMesh);
      }

      // Inner vertical cyan energy light streaks rising inside the ring
      const streakGeo = new THREE.BoxGeometry(0.045, 0.68, 0.045);
      for (let s = -2; s <= 2; s++) {
        const streak = new THREE.Mesh(streakGeo, boostWhiteInnerMat);
        streak.position.set(s * 0.14, (Math.abs(s) % 2) * 0.08 - 0.06, 0);
        streak.scale.y = 1.0 - Math.abs(s) * 0.18;
        itemGroup.add(streak);
      }
    } else if (pType === 'nitro') {
      // NITRO POWER-UP — Tilted compact canister filled with glowing blue fuel & dark-metal caps
      const canisterGroup = new THREE.Group();
      canisterGroup.rotation.z = -0.46; // Tilted matching the reference artwork

      const fuelCylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 1.04, 24),
        nitroGlassMat
      );
      const innerFuelCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.96, 16),
        nitroCoreMat
      );
      canisterGroup.add(fuelCylinder, innerFuelCore);

      // Top & Bottom Dark-Metal Armored End Caps
      const capCylinderGeo = new THREE.CylinderGeometry(0.41, 0.41, 0.22, 24);
      const topCap = new THREE.Mesh(capCylinderGeo, darkCasingMat);
      topCap.position.y = 0.52;
      const botCap = new THREE.Mesh(capCylinderGeo, darkCasingMat);
      botCap.position.y = -0.52;
      canisterGroup.add(topCap, botCap);

      // Glowing Cyan Valve Nozzles on Both Ends
      const nozzleGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.10, 16);
      const topNozzle = new THREE.Mesh(nozzleGeo, boostCyanCoreMat);
      topNozzle.position.y = 0.66;
      const botNozzle = new THREE.Mesh(nozzleGeo, boostCyanCoreMat);
      botNozzle.position.y = -0.66;
      canisterGroup.add(topNozzle, botNozzle);

      // 3 Longitudinal Dark-Metal Containment Struts
      const strutGeo = new THREE.BoxGeometry(0.06, 1.02, 0.06);
      for (let k = 0; k < 3; k++) {
        const angle = (k / 3) * Math.PI * 2;
        const strut = new THREE.Mesh(strutGeo, gunmetalTrimMat);
        strut.position.set(Math.cos(angle) * 0.37, 0, Math.sin(angle) * 0.37);
        canisterGroup.add(strut);
      }

      itemGroup.add(canisterGroup);
    } else if (pType === 'crystal') {
      // CRYSTAL BONUS — Sharp, faceted magenta crystal floating above the track with sparkles
      const crystalGroup = new THREE.Group();
      crystalGroup.rotation.z = -0.18;

      const mainCrystalGeo = new THREE.OctahedronGeometry(0.62, 0);
      mainCrystalGeo.scale(0.72, 1.46, 0.72);
      const mainCrystal = new THREE.Mesh(mainCrystalGeo, crystalMagentaMat);

      const facetOverlayGeo = new THREE.OctahedronGeometry(0.635, 0);
      facetOverlayGeo.scale(0.72, 1.46, 0.72);
      const facetWire = new THREE.Mesh(facetOverlayGeo, crystalFacetWireMat);

      // Secondary rotated crystal facet cluster for authentic multi-faceted gem cut
      const subCrystalGeo = new THREE.OctahedronGeometry(0.52, 0);
      subCrystalGeo.scale(0.68, 1.28, 0.68);
      const subCrystal = new THREE.Mesh(subCrystalGeo, crystalMagentaMat);
      subCrystal.rotation.y = Math.PI / 4;

      crystalGroup.add(mainCrystal, facetWire, subCrystal);

      // Floating Magenta Sparkle Shards around lower crystal
      const shardGeo = new THREE.OctahedronGeometry(0.08, 0);
      shardGeo.scale(0.6, 1.8, 0.6);
      for (let s = 0; s < 6; s++) {
        const ang = (s / 6) * Math.PI * 2;
        const shard = new THREE.Mesh(shardGeo, crystalFacetWireMat);
        shard.position.set(
          Math.cos(ang) * 0.48,
          -0.38 + (s % 3) * 0.22,
          Math.sin(ang) * 0.48
        );
        crystalGroup.add(shard);
      }

      itemGroup.add(crystalGroup);
    } else if (pType === 'shield') {
      // SHIELD POWER-UP — Blue-violet orb protected by a glowing hexagonal energy grid & 4 clamps
      const coreOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.56, 24, 18),
        shieldOrbMat
      );
      const hexGridSphere = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.585, 1),
        shieldHexGridMat
      );
      itemGroup.add(coreOrb, hexGridSphere);

      // Outer Segmented Dark-Metal Armor Ring + 4 Heavy Clamps
      const outerCollar = new THREE.Mesh(
        new THREE.TorusGeometry(0.64, 0.06, 10, 36),
        gunmetalTrimMat
      );
      itemGroup.add(outerCollar);

      const shieldClampGeo = new THREE.TorusGeometry(0.64, 0.13, 10, 12, 0.56);
      for (let c = 0; c < 4; c++) {
        const clamp = new THREE.Mesh(shieldClampGeo, darkCasingMat);
        clamp.rotation.z = c * (Math.PI / 2) - 0.28 + Math.PI / 4;
        itemGroup.add(clamp);
      }
    } else if (pType === 'repair') {
      // REPAIR POWER-UP — Reinforced dark-metal crate with a glowing cyan medical cross (+)
      const crateBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.84, 0.84, 0.84),
        darkCasingMat
      );
      itemGroup.add(crateBody);

      // 8 Reinforced Beveled Metallic Corner Brackets
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const corner = new THREE.Mesh(cornerBracketGeo, gunmetalTrimMat);
            corner.scale.setScalar(0.75);
            corner.position.set(sx * 0.36, sy * 0.36, sz * 0.36);
            itemGroup.add(corner);
          }
        }
      }

      // Glowing Cyan Medical Cross (+) on all 4 vertical faces + Top Light Panel
      const crossHorizZ = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.16, 0.88),
        repairCrossMat
      );
      const crossVertZ = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.48, 0.88),
        repairCrossMat
      );
      const crossHorizX = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.16, 0.48),
        repairCrossMat
      );
      const crossVertX = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.48, 0.16),
        repairCrossMat
      );
      const topPanel = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.87, 0.46),
        repairCrossMat
      );
      itemGroup.add(crossHorizZ, crossVertZ, crossHorizX, crossVertX, topPanel);
    } else {
      // CREDIT BONUS — Gold-edged circular token with a raised central hexagonal emblem
      const tokenGroup = new THREE.Group();
      tokenGroup.rotation.y = 0.22;

      // Outer Dark-Metallic Segmented Coin Rim
      const coinDiscGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.16, 36);
      coinDiscGeo.rotateX(Math.PI / 2);
      const coinDisc = new THREE.Mesh(coinDiscGeo, darkCasingMat);
      tokenGroup.add(coinDisc);

      // Glowing Golden Inner Ring on both faces
      const goldRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.50, 0.055, 12, 36),
        creditGlowRingMat
      );
      goldRing.scale.z = 1.85;
      tokenGroup.add(goldRing);

      // Raised Central Hexagonal Gold Emblem
      const hexEmblemGeo = new THREE.CylinderGeometry(0.31, 0.33, 0.22, 6);
      hexEmblemGeo.rotateX(Math.PI / 2);
      const hexEmblem = new THREE.Mesh(hexEmblemGeo, creditGoldMat);

      const innerHexDarkGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.24, 6);
      innerHexDarkGeo.rotateX(Math.PI / 2);
      const innerHexDark = new THREE.Mesh(innerHexDarkGeo, gunmetalTrimMat);
      tokenGroup.add(hexEmblem, innerHexDark);

      // 4 Gold Edge Notches at Cardinal Points
      const notchGeo = new THREE.BoxGeometry(0.12, 0.12, 0.20);
      for (let n = 0; n < 4; n++) {
        const ang = (n / 4) * Math.PI * 2;
        const notch = new THREE.Mesh(notchGeo, creditGoldMat);
        notch.position.set(Math.cos(ang) * 0.62, Math.sin(ang) * 0.62, 0);
        notch.rotation.z = ang;
        tokenGroup.add(notch);
      }

      itemGroup.add(tokenGroup);
    }

    return itemGroup;
  };

  // Helper to build 3D Army / Weapon Models inside Tactical Ordnance Boxes
  const create3DWeaponModel = (wType: ActiveWeaponId): THREE.Group => {
    const itemGroup = new THREE.Group();
    const wMeta = WEAPON_META[wType];
    const glowMat = new THREE.MeshBasicMaterial({ color: wMeta.accentHex });
    const coreMat = new THREE.MeshBasicMaterial({ color: wMeta.glowHex });

    if (wType === 'missile') {
      // Weapon 1: Homing Missile (tilted tactical guided warhead with 4 stabilizer fins)
      const missileGroup = new THREE.Group();
      missileGroup.rotation.z = -0.42;
      missileGroup.rotation.x = 0.28;

      const bodyGeo = new THREE.CylinderGeometry(0.2, 0.24, 1.05, 16);
      missileGroup.add(new THREE.Mesh(bodyGeo, darkCasingMat));

      const noseGeo = new THREE.ConeGeometry(0.2, 0.46, 16);
      const noseMesh = new THREE.Mesh(noseGeo, glowMat);
      noseMesh.position.y = 0.75;
      missileGroup.add(noseMesh);

      const stripeGeo = new THREE.TorusGeometry(0.215, 0.035, 8, 20);
      stripeGeo.rotateX(Math.PI / 2);
      const stripe1 = new THREE.Mesh(stripeGeo, coreMat);
      stripe1.position.y = 0.25;
      const stripe2 = new THREE.Mesh(stripeGeo, glowMat);
      stripe2.position.y = -0.18;
      missileGroup.add(stripe1, stripe2);

      const finGeo = new THREE.BoxGeometry(0.05, 0.38, 0.42);
      for (let f = 0; f < 4; f++) {
        const fin = new THREE.Mesh(finGeo, glowMat);
        const ang = (f / 4) * Math.PI * 2;
        fin.position.set(Math.cos(ang) * 0.24, -0.34, Math.sin(ang) * 0.24);
        fin.rotation.y = -ang;
        missileGroup.add(fin);
      }

      const thrusterNozzleGeo = new THREE.CylinderGeometry(0.14, 0.19, 0.18, 12);
      const nozzle = new THREE.Mesh(thrusterNozzleGeo, coreMat);
      nozzle.position.y = -0.6;
      missileGroup.add(nozzle);

      itemGroup.add(missileGroup);
    } else if (wType === 'laser') {
      // Weapon 2: Hyper-Laser Emitter (Twin-barrel plasma beam cannon with emerald focusing rings)
      const laserGroup = new THREE.Group();
      laserGroup.rotation.x = 0.22;
      laserGroup.rotation.y = 0.35;

      const chassisGeo = new THREE.BoxGeometry(0.68, 0.42, 0.72);
      laserGroup.add(new THREE.Mesh(chassisGeo, darkCasingMat));

      const barrelGeo = new THREE.CylinderGeometry(0.085, 0.1, 1.15, 12);
      barrelGeo.rotateX(Math.PI / 2);
      for (const sx of [-0.19, 0.19]) {
        const barrel = new THREE.Mesh(barrelGeo, darkCasingMat);
        barrel.position.set(sx, 0, 0.24);
        laserGroup.add(barrel);

        const coreRodGeo = new THREE.CylinderGeometry(0.055, 0.055, 1.24, 10);
        coreRodGeo.rotateX(Math.PI / 2);
        const coreRod = new THREE.Mesh(coreRodGeo, glowMat);
        coreRod.position.set(sx, 0, 0.28);
        laserGroup.add(coreRod);
      }

      const coilGeo = new THREE.TorusGeometry(0.42, 0.045, 10, 24);
      const coil1 = new THREE.Mesh(coilGeo, glowMat);
      coil1.position.z = 0.45;
      const coil2 = new THREE.Mesh(coilGeo, coreMat);
      coil2.position.z = 0.72;
      laserGroup.add(coil1, coil2);

      itemGroup.add(laserGroup);
    } else if (wType === 'shockwave') {
      // Weapon 3: Shockwave Pulse Core (Levitation plasma sphere surrounded by 3 intersecting EMP rings)
      const swGroup = new THREE.Group();
      const sphereGeo = new THREE.SphereGeometry(0.38, 20, 16);
      swGroup.add(new THREE.Mesh(sphereGeo, coreMat));

      const ringGeo1 = new THREE.TorusGeometry(0.64, 0.055, 10, 28);
      const ring1 = new THREE.Mesh(ringGeo1, glowMat);
      ring1.rotation.x = Math.PI / 2;
      swGroup.add(ring1);

      const ring2 = new THREE.Mesh(ringGeo1, glowMat);
      ring2.rotation.x = Math.PI / 3;
      ring2.rotation.y = Math.PI / 4;
      swGroup.add(ring2);

      const ring3 = new THREE.Mesh(ringGeo1, darkCasingMat);
      ring3.rotation.x = -Math.PI / 3;
      ring3.rotation.z = Math.PI / 4;
      swGroup.add(ring3);

      itemGroup.add(swGroup);
    } else {
      // Weapon 4: Proximity Mines (Armored spiked naval/track mine with glowing hazard nodes)
      const mineGroup = new THREE.Group();
      const coreHullGeo = new THREE.IcosahedronGeometry(0.48, 1);
      mineGroup.add(new THREE.Mesh(coreHullGeo, darkCasingMat));

      const equatorRingGeo = new THREE.TorusGeometry(0.52, 0.05, 10, 24);
      equatorRingGeo.rotateX(Math.PI / 2);
      mineGroup.add(new THREE.Mesh(equatorRingGeo, glowMat));

      const spikeGeo = new THREE.ConeGeometry(0.09, 0.34, 8);
      const spikeDirs = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
        [0.7, 0.7, 0],
        [-0.7, 0.7, 0],
        [0, 0.7, 0.7],
        [0, 0.7, -0.7],
      ];
      for (const [dx, dy, dz] of spikeDirs) {
        const dirVec = new THREE.Vector3(dx, dy, dz).normalize();
        const spike = new THREE.Mesh(spikeGeo, glowMat);
        spike.position.copy(dirVec).multiplyScalar(0.54);
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec);
        mineGroup.add(spike);
      }

      const topBeaconGeo = new THREE.SphereGeometry(0.14, 12, 10);
      const topBeacon = new THREE.Mesh(topBeaconGeo, coreMat);
      topBeacon.position.y = 0.5;
      mineGroup.add(topBeacon);

      itemGroup.add(mineGroup);
    }

    return itemGroup;
  };

  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    const isFixedBoostPad = pad.type === 'boost' || pad.powerUpType === 'boost';
    const isWeaponPad = pad.type === 'weapon' && !!pad.weaponType;
    const wType: ActiveWeaponId | undefined = isWeaponPad ? pad.weaponType : undefined;
    const pType: PowerUpItemType =
      pad.powerUpType ??
      (pad.type === 'boost'
        ? 'boost'
        : pad.type === 'recharge'
        ? 'repair'
        : POWERUP_ITEMS_ORDER[i % POWERUP_ITEMS_ORDER.length]);

    const accentHex = wType ? WEAPON_META[wType].accentHex : POWERUP_META[pType].accentHex;
    const glowHex = wType ? WEAPON_META[wType].glowHex : POWERUP_META[pType].glowHex;

    sampleTrackFrame(spline, pad.t, pos, fwd, right, up);
    const worldXOffset = pad.laneOffset * (halfW - 2.2);

    const padHolder = new THREE.Group();
    padHolder.position
      .copy(pos)
      .addScaledVector(right, worldXOffset)
      .addScaledVector(up, 0.09);
    lookTarget.copy(padHolder.position).add(fwd);
    rotMat.lookAt(padHolder.position, lookTarget, up);
    padHolder.quaternion.setFromRotationMatrix(rotMat);

    // Unified Standard On-Track Velocity Boost Pad (9.2m wide x 18.6m long, Electric Blue 3-Arrows in Series):
    // Identical size and Electric Blue color across all tracks (`Screenshot_from_2026-10-29_22-37-54_b7ecbeab.png`)
    if (isFixedBoostPad) {
      // Frameless 3-Arrow Electric-Blue Decal Surface directly on the track (NO blue rectangle skirt or ghosted mesh)
      const padSurface = new THREE.Mesh(boostPadGeo, standardBoostPadMat);
      padSurface.position.y = -0.02;
      padHolder.add(padSurface);

      worldGroup.add(padHolder);
      continue;
    }

    // Respawning 3D Spinning Power-Up, Bonus & Weapon Boxes Floating Above the Track:
    // Projected holographic ground ring directly under the floating 3D box
    const baseRingMat = new THREE.MeshBasicMaterial({
      color: glowHex,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const baseRingMesh = new THREE.Mesh(baseGlowRingGeo, baseRingMat);
    baseRingMesh.position.y = 0.05;
    padHolder.add(baseRingMesh);

    const baseDiscMat = new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const baseDiscMesh = new THREE.Mesh(baseInnerDiscGeo, baseDiscMat);
    baseDiscMesh.position.y = 0.04;
    padHolder.add(baseDiscMesh);

    // High-Visibility 3D Spinning Cube Floating Above the Track (y = 2.15m)
    const holoBoxGroup = new THREE.Group();
    holoBoxGroup.position.y = 2.15;

    // 1. Glowing semi-transparent 3D holographic glass cube faces
    const holoGlassMat = new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: isWeaponPad ? 0.36 : 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const holoGlassCube = new THREE.Mesh(holoCrateGlassGeo, holoGlassMat);
    holoBoxGroup.add(holoGlassCube);

    // 2. Solid 12-Edge 3D Structural Neon Cube Frame (unmistakable 3D cube silhouette from 200m+ away!)
    const strutFrameMat = new THREE.MeshBasicMaterial({
      color: glowHex,
      transparent: true,
      opacity: 0.96,
    });
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const barX = new THREE.Mesh(holoStrutBarXGeo, strutFrameMat);
        barX.position.set(0, sy * holoCrateHalf, sz * holoCrateHalf);
        holoBoxGroup.add(barX);
      }
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const barY = new THREE.Mesh(holoStrutBarYGeo, strutFrameMat);
        barY.position.set(sx * holoCrateHalf, 0, sz * holoCrateHalf);
        holoBoxGroup.add(barY);
      }
    }
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const barZ = new THREE.Mesh(holoStrutBarZGeo, strutFrameMat);
        barZ.position.set(sx * holoCrateHalf, sy * holoCrateHalf, 0);
        holoBoxGroup.add(barZ);
      }
    }

    // 3. Inner 3D octahedral energy core cage inside the spinning cube
    const holoInnerOctaMat = new THREE.MeshBasicMaterial({
      color: glowHex,
      wireframe: true,
      transparent: true,
      opacity: 0.72,
    });
    const holoInnerOcta = new THREE.Mesh(holoInnerOctaGeo, holoInnerOctaMat);
    holoBoxGroup.add(holoInnerOcta);

    // 4. 8 Illuminated Chunky 3D Corner Nodes on the Spinning 3D Cube
    const cornerMat = new THREE.MeshBasicMaterial({
      color: accentHex,
    });
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const cb = new THREE.Mesh(cornerBracketGeo, cornerMat);
          cb.position.set(sx * holoCrateHalf, sy * holoCrateHalf, sz * holoCrateHalf);
          holoBoxGroup.add(cb);
        }
      }
    }
    padHolder.add(holoBoxGroup);

    // 3D Power-Up, Bonus, or Weapon Model floating & counter-spinning inside the 3D Cube
    const itemGroup = wType ? create3DWeaponModel(wType) : create3DPowerUpModel(pType);
    itemGroup.position.y = 2.15;
    itemGroup.scale.setScalar(isWeaponPad ? 1.55 : 1.45);
    padHolder.add(itemGroup);
    animatedCrystals.push(itemGroup);

    worldGroup.add(padHolder);

    powerUpBoxes.push({
      padId: pad.id,
      powerUpType: pType,
      weaponType: wType,
      t: pad.t,
      laneOffset: pad.laneOffset,
      holderGroup: padHolder,
      itemGroup,
      holoBoxGroup,
      baseRingMesh,
      respawnTimer: 0,
      collectAnimProgress: 0,
    });
  }

  // ============================================================================
  // TALL ANIMATED-ARROW CURVE GUARDRAIL WALLS IN PARABOLIC & DIFFICULT CURVES:
  // - Normal & Parabolic Curves (`severity === 'caution'`): Tall Guardrail Walls with YELLOW Animated Flowing Arrows (>>>)
  // - Difficult Curves & Sharp Hairpins (`severity === 'hairpin'`): Tall Guardrail Walls with RED Animated Flowing Arrows (>>>)
  // - No yellow or red arrows are placed on the road surface itself so road decals are exclusively Electric Blue Boost Pads!
  // ============================================================================
  const yellowCurveGuardrailMat = createCurveGuardrailArrowWallMaterial(false, isNeon, neonIntensity);
  const redCurveGuardrailMat = createCurveGuardrailArrowWallMaterial(true, isNeon, neonIntensity);
  animatedShaders.push(yellowCurveGuardrailMat, redCurveGuardrailMat);

  // Larger, taller Guardrail Arrow Wall Panels (6.4m long x 2.75m tall) mounted along the guardrail in all curves
  const signGeo = new THREE.BoxGeometry(0.36, 2.75, 6.4);
  const signFrameGeo = new THREE.BoxGeometry(0.28, 3.05, 6.75);

  // Build comprehensive curve guardrail placements covering every parabolic curve, normal curve, S-bend, and difficult hairpin
  const curveGuardrailSpecs: Array<{ t: number; side: -1 | 1; severity: 'caution' | 'hairpin' }> = [];
  const sampleCount = 115;
  for (let s = 0; s < sampleCount; s++) {
    const t = Number(((s + 0.5) / sampleCount).toFixed(4));
    if (t < 0.032 || t > 0.968) continue;

    const kCenter = estimateTrackCurvature(trackId, t);
    const kPrev = estimateTrackCurvature(trackId, (t - 0.008 + 1) % 1);
    const kNext = estimateTrackCurvature(trackId, (t + 0.008) % 1);
    const smoothK = (kPrev + kCenter * 2 + kNext) * 0.25;
    const absK = Math.abs(smoothK);

    if (absK >= 0.055) {
      // Positive curvature = right-hand turn (outer guardrail is left = -1); Negative = left-hand turn (outer guardrail is right = +1)
      const outerSide: -1 | 1 = smoothK >= 0 ? -1 : 1;
      const severity: 'caution' | 'hairpin' = absK >= 0.30 ? 'hairpin' : 'caution';
      curveGuardrailSpecs.push({ t, side: outerSide, severity });

      // On intense parabolic sweepers and difficult curves (|k| >= 0.14), also line the inner guardrail so both sides of the curve blaze with animated arrows!
      if (absK >= 0.14 && s % 2 === 0) {
        const innerSide: -1 | 1 = outerSide === -1 ? 1 : -1;
        curveGuardrailSpecs.push({ t, side: innerSide, severity });
      }
    }
  }

  for (let i = 0; i < curveGuardrailSpecs.length; i++) {
    const { t, side, severity } = curveGuardrailSpecs[i];
    sampleTrackFrame(spline, t, pos, fwd, right, up);

    const signGrp = new THREE.Group();
    signGrp.position
      .copy(pos)
      .addScaledVector(right, side * (halfW + 1.65))
      .addScaledVector(up, 2.35);
    lookTarget.copy(signGrp.position).add(fwd);
    rotMat.lookAt(signGrp.position, lookTarget, up);
    signGrp.quaternion.setFromRotationMatrix(rotMat);

    const panelMat = severity === 'hairpin' ? redCurveGuardrailMat : yellowCurveGuardrailMat;
    const signBacking = new THREE.Mesh(signFrameGeo, graphiteStructureMat);
    const signMesh = new THREE.Mesh(signGeo, panelMat);
    signGrp.add(signBacking, signMesh);
    worldGroup.add(signGrp);
  }

  // 3D Sector Split Timing Gantries at t = 0.00 (Start/Finish), 0.25 (S2), 0.50 (S3), and 0.75 (S4)
  const sectorGantryTs = [0.0, 0.25, 0.50, 0.75];
  const secPillarGeo = new THREE.BoxGeometry(1.6, 13.5, 2.2);
  const secBeamGeo = new THREE.BoxGeometry((halfW + 3.2) * 2, 2.1, 2.6);
  const secBannerGeo = new THREE.PlaneGeometry(halfW * 1.45, 2.6);
  const secBannerMat = new THREE.MeshBasicMaterial({
    map: textures.checkpointSignMap,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
  });
  for (let sIdx = 0; sIdx < sectorGantryTs.length; sIdx++) {
    const st = sectorGantryTs[sIdx];
    sampleTrackFrame(spline, st, pos, fwd, right, up);
    const secGrp = new THREE.Group();
    secGrp.position.copy(pos);
    lookTarget.copy(pos).add(fwd);
    rotMat.lookAt(pos, lookTarget, up);
    secGrp.quaternion.setFromRotationMatrix(rotMat);

    for (const side of [-1, 1]) {
      const pil = new THREE.Mesh(secPillarGeo, graphiteStructureMat);
      pil.position.set(side * (halfW + 2.4), 6.2, 0);
      secGrp.add(pil);
    }
    const topBeam = new THREE.Mesh(secBeamGeo, graphiteStructureMat);
    topBeam.position.set(0, 12.6, 0);
    const banner = new THREE.Mesh(secBannerGeo, secBannerMat);
    banner.position.set(0, 10.6, 0);
    secGrp.add(topBeam, banner);
    worldGroup.add(secGrp);
  }

  // Tag all playable track geometry (road deck, curbs, viaduct aprons, box-girder fascia,
  // armored guardrails, coping caps, stanchions, support pylons, cross-beams, and portal collars)
  // on TRACK_SSAO_LAYER so the dedicated Track SSAO pass deepens track crevices and track-to-background separation!
  enableTrackSsaoLayer(worldGroup);

  let lavaFallsMesh: THREE.Mesh | null = null;
  let aerialTraffic: AerialTrafficSystem | null = null;
  if (isCity) {
    aerialTraffic = buildCityEnvironment(
      worldGroup,
      spline,
      textures,
      isNeon,
      neonIntensity,
      animatedShaders,
      animatedSearchlights,
      isCityV2
    );
  } else {
    lavaFallsMesh = buildLavaEnvironment(
      worldGroup,
      spline,
      textures,
      isNeon,
      neonIntensity,
      animatedShaders,
      isLavaV2
    );
  }

  return {
    worldGroup,
    animatedRings,
    animatedCrystals,
    powerUpBoxes,
    animatedSearchlights,
    aerialTraffic,
    lavaFallsMesh,
    animatedShaders,
    minimapPoints,
  };
}

/**
 * Samples the entire closed track spline into 720 2D XZ points and pushes any
 * candidate world object position (x, z) with footprint `objectRadius` outside
 * the track corridor across all 720 samples!
 */
function buildTrackSamplesXZ(
  spline: THREE.CatmullRomCurve3,
  sampleCount = 720
): Array<{ x: number; z: number }> {
  const pts: Array<{ x: number; z: number }> = [];
  const p = new THREE.Vector3();
  for (let i = 0; i < sampleCount; i++) {
    spline.getPointAt(i / sampleCount, p);
    pts.push({ x: p.x, z: p.z });
  }
  return pts;
}

export function ensureTrackClearanceXZ(
  initX: number,
  initZ: number,
  objectRadius: number,
  trackSamples: Array<{ x: number; z: number }>,
  minBuffer = 38
): { x: number; z: number } {
  let x = initX;
  let z = initZ;
  const requiredDist = TRACK_HALF_WIDTH + objectRadius + minBuffer;
  const loopCenterX = 710;
  const loopCenterZ = -135;

  // For colossal horizon massifs/domes (requiredDist > 165m), project outside the extended circuit's bounding envelope first
  if (requiredDist > 165) {
    const ex = (x - loopCenterX) / 960;
    const ez = (z - loopCenterZ) / 680;
    const eNorm = Math.hypot(ex, ez);
    if (eNorm < 1.15) {
      const ux = eNorm > 0.001 ? ex / eNorm : 1;
      const uz = eNorm > 0.001 ? ez / eNorm : 0;
      x = loopCenterX + ux * (960 * 1.18 + objectRadius * 0.5);
      z = loopCenterZ + uz * (680 * 1.18 + objectRadius * 0.5);
    }
  }

  // Phase 1: Multi-sample repulsive relaxation so points between two figure-8 lobes don't ping-pong onto a neighboring road
  for (let iter = 0; iter < 85; iter++) {
    let closestDistSq = Infinity;
    let repulseX = 0;
    let repulseZ = 0;
    let violatingCount = 0;

    for (let i = 0; i < trackSamples.length; i++) {
      const s = trackSamples[i];
      const dx = x - s.x;
      const dz = z - s.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
      }
      if (dSq < requiredDist * requiredDist) {
        const d = Math.sqrt(dSq) || 0.001;
        const pen = requiredDist - d + 4.0;
        repulseX += (dx / d) * pen;
        repulseZ += (dz / d) * pen;
        violatingCount++;
      }
    }

    if (closestDistSq >= requiredDist * requiredDist || violatingCount === 0) {
      break;
    }

    const avgDx = repulseX / violatingCount;
    const avgDz = repulseZ / violatingCount;
    const avgLen = Math.hypot(avgDx, avgDz);
    if (avgLen > 0.5) {
      x += avgDx * 0.65;
      z += avgDz * 0.65;
    } else {
      // Caught symmetrically between two nearby track lobes -> eject radially outward from circuit center
      let outDx = x - loopCenterX;
      let outDz = z - loopCenterZ;
      const outLen = Math.hypot(outDx, outDz) || 1;
      outDx /= outLen;
      outDz /= outLen;
      x += outDx * (requiredDist * 1.45 + 32);
      z += outDz * (requiredDist * 1.45 + 32);
    }
  }

  // Phase 2: Hard mathematical guarantee — if still within requiredDist of ANY track sample, push radially outside the circuit perimeter
  for (let guardIter = 0; guardIter < 40; guardIter++) {
    let minDSq = Infinity;
    for (let i = 0; i < trackSamples.length; i++) {
      const dx = x - trackSamples[i].x;
      const dz = z - trackSamples[i].z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDSq) minDSq = dSq;
    }
    if (minDSq >= requiredDist * requiredDist) {
      break;
    }
    let outDx = x - loopCenterX;
    let outDz = z - loopCenterZ;
    const outLen = Math.hypot(outDx, outDz) || 1;
    const stepOut = Math.max(24, requiredDist - Math.sqrt(minDSq) + 18);
    x += (outDx / outLen) * stepOut;
    z += (outDz / outLen) * stepOut;
  }

  return { x, z };
}

/**
 * Studio-Grade GLSL Cyberpunk Skyscraper & Megastructure Architectural Shader (`createCyberpunkBuildingShaderMaterial`)
 * Combines all 8 high-resolution City Circuit textures:
 * - `06_city_window_facade_c6d256d2.png`: High-rise curtain-wall glass facade with interior depth parallax & per-floor lighting
 * - `02_dark_armour_panels_940b904f.png`: Heavy beveled dark sci-fi armor exoskeleton corner columns, transfer trusses & roof plates
 * - `08_cyan_corridor_floor_bf8dbc94.png`: Recessed vertical tech-core elevator spines with twin cyan light tubes & louvers
 * - `03_cyan_light_barrier_7aa5e9af.png`: Recessed horizontal cyan plasma sky-lobby belts
 * - `05_magenta_neon_rail_9f9d1ec5.png`: Recessed horizontal magenta-violet neon sky-lobby & crown belts
 * - `07_rainbow_wet_pavement_dbc30136.png`: Rain-drenched neon specular reflections on glass curtain walls
 * - `01_wet_neon_track_92d2e945.png`: Wet metallic rooftop helipad & terrace deck plating
 */
function createCyberpunkBuildingShaderMaterial(
  textures: TrackTextureSet,
  isNeon: boolean,
  neonIntensity: number,
  isCityV2: boolean
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIsNeon: { value: isNeon ? 1.0 : 0.0 },
      uNeonIntensity: { value: neonIntensity },
      uUseV2Tex: { value: isCityV2 ? 1.0 : 0.0 },
      uWindowFacadeTex: { value: textures.cityWindowFacadeMap },
      uFallbackBldTex: { value: textures.buildingMap },
      uFallbackEmissiveTex: { value: textures.buildingEmissiveMap },
      uArmourTex: { value: textures.cityArmourPanelsMap },
      uCyanBarrierTex: { value: textures.cityCyanBarrierMap },
      uMagentaRailTex: { value: textures.cityMagentaRailMap },
      uCorridorTex: { value: textures.cityCorridorFloorMap },
      uRainbowTex: { value: textures.cityRainbowPavementMap },
      uWetTrackTex: { value: textures.cityWetTrackMap },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vLocalNormal;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vScale;
      varying vec3 vInstanceTint;
      varying float vBuildingSeed;

      void main() {
        vUv = uv;
        vLocalPos = position;
        vLocalNormal = normal;

        mat4 instMat = mat4(1.0);
        vec3 instColor = vec3(0.88, 0.95, 1.0);
        #ifdef USE_INSTANCING
          instMat = instanceMatrix;
          #ifdef USE_INSTANCING_COLOR
            instColor = instanceColor;
          #endif
        #endif
        vInstanceTint = instColor;

        mat4 totalMat = modelMatrix * instMat;
        float sx = length(totalMat[0].xyz);
        float sy = length(totalMat[1].xyz);
        float sz = length(totalMat[2].xyz);
        vScale = max(vec3(sx, sy, sz), vec3(1.0));

        vec4 wp = totalMat * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(totalMat) * normal);

        // Deterministic per-building seed from base world XZ position
        vec3 originWp = (totalMat * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vBuildingSeed = fract(sin(dot(originWp.xz, vec2(12.9898, 78.233))) * 43758.5453);

        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIsNeon;
      uniform float uNeonIntensity;
      uniform float uUseV2Tex;
      uniform sampler2D uWindowFacadeTex;
      uniform sampler2D uFallbackBldTex;
      uniform sampler2D uFallbackEmissiveTex;
      uniform sampler2D uArmourTex;
      uniform sampler2D uCyanBarrierTex;
      uniform sampler2D uMagentaRailTex;
      uniform sampler2D uCorridorTex;
      uniform sampler2D uRainbowTex;
      uniform sampler2D uWetTrackTex;

      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vLocalNormal;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vScale;
      varying vec3 vInstanceTint;
      varying float vBuildingSeed;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(0.0, dot(N, V)), 2.6);

        // 1. HORIZONTAL ROOFTOP & TERRACE DECKS (Zero stretched windows on roofs!)
        if (abs(vLocalNormal.y) > 0.65) {
          vec2 roofUv = vWorldPos.xz * 0.085;
          vec3 armourRoof = texture2D(uArmourTex, roofUv).rgb * 0.42;
          vec3 wetDeck = texture2D(uWetTrackTex, roofUv * 0.65).rgb * 0.35;
          vec3 corridorDeck = texture2D(uCorridorTex, vUv * 2.0).rgb * 0.55;
          vec3 roofCol = mix(armourRoof, wetDeck, 0.45);
          roofCol = mix(roofCol, corridorDeck, smoothstep(0.32, 0.38, abs(vUv.x - 0.5)) * 0.65);

          // Glowing rooftop helipad / drone-pad ring on larger tower roofs
          float roofRad = length(vUv - vec2(0.5));
          float helipadRing = smoothstep(0.28, 0.31, roofRad) * (1.0 - smoothstep(0.33, 0.36, roofRad));
          if (uIsNeon > 0.5) {
            vec3 padColor = vBuildingSeed > 0.5 ? vec3(0.0, 0.92, 1.0) : vec3(1.0, 0.18, 0.58);
            roofCol += padColor * helipadRing * 0.72 * uNeonIntensity;
          }

          float camDistRoof = length(cameraPosition - vWorldPos);
          float fogRoof = 1.0 - exp(-camDistRoof * 0.00075);
          vec3 fogTargetRoof = uIsNeon > 0.5 ? vec3(0.035, 0.02, 0.08) : vec3(0.68, 0.74, 0.82);
          gl_FragColor = vec4(mix(roofCol, fogTargetRoof, clamp(fogRoof * 0.65, 0.0, 0.75)), 1.0);
          return;
        }

        // 2. ARCHITECTURAL METER-SCALED CURTAIN-WALL FACADE COORDINATES
        float faceWidth = abs(vLocalNormal.x) > 0.5 ? vScale.z : vScale.x;
        float towerHeight = vScale.y;
        float hNorm = clamp(vLocalPos.y, 0.0, 1.0);
        float worldElevMeters = hNorm * towerHeight;

        // Horizontal coordinate across the facade in [0..1]
        float uFace = vUv.x;
        float edgeDist = min(uFace, 1.0 - uFace);
        float centerDist = abs(uFace - 0.5);

        // Tile 06_city_window_facade at crisp real-world architectural proportions (~16m wide bay, ~24m vertical module)
        vec2 windowTiles = vec2(max(1.0, floor(faceWidth / 15.0 + 0.5)), max(2.0, towerHeight / 22.0));
        vec2 archUv = vec2(uFace * windowTiles.x, hNorm * windowTiles.y);

        // Subtle interior room depth parallax based on view vector
        vec2 parallaxOffset = vec2(dot(V.xz, vec2(-N.z, N.x)), V.y) * 0.022;
        vec2 sampleWinUv = archUv + parallaxOffset;

        vec3 facadeSample = uUseV2Tex > 0.5
          ? texture2D(uWindowFacadeTex, sampleWinUv).rgb
          : texture2D(uFallbackBldTex, sampleWinUv * 0.5).rgb;
        vec3 fallbackEmissive = texture2D(uFallbackEmissiveTex, sampleWinUv * 0.5).rgb;

        // Extract window luminance vs dark mullion frame from 06_city_window_facade
        float winLuma = dot(facadeSample, vec3(0.299, 0.587, 0.114));
        float isLitWindow = smoothstep(0.18, 0.52, winLuma);

        // Per-floor & per-suite architectural color variation:
        // Restricted to cool atmospheric indigo, violet, and deep cyber-teal (zero warm gold so gold belongs exclusively to the playable track!)
        vec2 suiteCell = floor(archUv * vec2(4.0, 8.0));
        float suiteHash = hash21(suiteCell + vec2(vBuildingSeed * 37.0));
        float floorBandHash = hash21(vec2(floor(archUv.y * 8.0), vBuildingSeed * 19.0));
        float suiteActiveMask = smoothstep(0.32, 0.68, suiteHash + floorBandHash * 0.22);

        vec3 tealSuite = vec3(0.12, 0.58, 0.78);
        vec3 indigoSuite = vec3(0.28, 0.36, 0.85);
        vec3 violetSuite = vec3(0.54, 0.24, 0.82);
        vec3 magentaSuite = vec3(0.76, 0.16, 0.52);

        vec3 suiteTint = suiteHash < 0.36
          ? indigoSuite
          : suiteHash < 0.66
          ? violetSuite
          : suiteHash < 0.86
          ? tealSuite
          : magentaSuite;
        suiteTint = mix(suiteTint, vInstanceTint * 0.75, 0.35);

        // Deep dark midnight-indigo curtain-wall glass & mullion grid so buildings act as dark silhouettes behind the track
        vec3 darkCurtainWall = facadeSample * vec3(0.08, 0.10, 0.18);
        vec3 litWindowCol = mix(facadeSample * 0.58, suiteTint * (0.42 + 0.48 * winLuma), 0.62);

        vec3 col = darkCurtainWall;
        if (uIsNeon > 0.5) {
          float effectiveWinGlow = (uUseV2Tex > 0.5 ? isLitWindow : dot(fallbackEmissive, vec3(0.333))) * suiteActiveMask;
          col = mix(darkCurtainWall, litWindowCol * min(0.74, 0.54 * uNeonIntensity), effectiveWinGlow);
        } else {
          col = facadeSample * 0.72 + vec3(0.12, 0.16, 0.24) * fresnel;
        }

        // 3. HEAVY ARMORED CORNER EXOSKELETON PIERS & STRUCTURAL BRACING (02_dark_armour_panels_940b904f.png)
        float cornerPierWidth = clamp(2.4 / max(12.0, faceWidth), 0.07, 0.14);
        float isCornerPier = 1.0 - smoothstep(cornerPierWidth * 0.82, cornerPierWidth, edgeDist);
        float bayMullion = 1.0 - smoothstep(0.0, 0.045, min(fract(archUv.x), 1.0 - fract(archUv.x)));
        float armourMask = clamp(isCornerPier + bayMullion * 0.55, 0.0, 1.0);

        vec2 armourUv = vec2(uFace * max(2.0, faceWidth / 8.0), worldElevMeters / 10.0);
        vec3 armourTex = texture2D(uArmourTex, armourUv).rgb;
        vec3 darkArmourSteel = armourTex * (uIsNeon > 0.5 ? 0.28 : 0.68);
        darkArmourSteel += mix(vec3(0.18, 0.38, 0.72), vec3(0.58, 0.18, 0.62), vBuildingSeed) * fresnel * 0.14;
        col = mix(col, darkArmourSteel, armourMask);

        // Subdued vertical neon edge trim slot recessed inside the armored corner piers
        float cornerNeonSlot = smoothstep(cornerPierWidth * 0.88, cornerPierWidth * 1.02, edgeDist) *
                               (1.0 - smoothstep(cornerPierWidth * 1.02, cornerPierWidth * 1.18, edgeDist));
        if (uIsNeon > 0.5 && vBuildingSeed > 0.35) {
          vec3 edgeNeonCol = mod(floor(vBuildingSeed * 10.0), 2.0) < 0.5
            ? vec3(0.24, 0.48, 0.88)
            : vec3(0.68, 0.18, 0.58);
          col = mix(col, edgeNeonCol * 0.52, cornerNeonSlot * 0.55);
        }

        // 4. RECESSED VERTICAL TECH SPINE & EXTERIOR ELEVATOR SHAFT (08_cyan_corridor_floor_bf8dbc94.png)
        if (faceWidth >= 19.0 && vBuildingSeed > 0.35) {
          float spineHalfW = clamp(1.85 / faceWidth, 0.045, 0.095);
          float spineMask = 1.0 - smoothstep(spineHalfW * 0.80, spineHalfW, centerDist);
          if (spineMask > 0.01) {
            vec2 spineUv = vec2((uFace - (0.5 - spineHalfW)) / (2.0 * spineHalfW), worldElevMeters / 7.5);
            vec3 corridorSample = texture2D(uCorridorTex, spineUv).rgb;
            float elevDir = vBuildingSeed > 0.64 ? 1.0 : -1.0;
            float elevPos = fract(worldElevMeters / 65.0 - uTime * 0.18 * elevDir + vBuildingSeed * 5.0);
            float elevCar = smoothstep(0.0, 0.06, elevPos) * (1.0 - smoothstep(0.06, 0.14, elevPos));
            vec3 spineCol = corridorSample * (uIsNeon > 0.5 ? 0.46 : 0.65);
            if (uIsNeon > 0.5) {
              spineCol += vec3(0.35, 0.62, 0.95) * elevCar * 0.48;
            }
            col = mix(col, spineCol, spineMask);
          }
        }

        // 5. MECHANICAL SKY-LOBBY FLOORS & CROWN COLLARS (subdued so they never compete with track guardrails)
        float lobbyInterval = 38.0;
        float lobbyPhase = mod(worldElevMeters + 10.0, lobbyInterval);
        float isSkyLobby = smoothstep(0.0, 0.6, lobbyPhase) * (1.0 - smoothstep(2.4, 3.0, lobbyPhase));
        float isCrownBelt = smoothstep(towerHeight - 4.0, towerHeight - 3.2, worldElevMeters) *
                            (1.0 - smoothstep(towerHeight - 1.2, towerHeight - 0.5, worldElevMeters));
        float beltMask = clamp(isSkyLobby + isCrownBelt, 0.0, 1.0);

        if (beltMask > 0.01) {
          float beltV = isCrownBelt > 0.5
            ? clamp((worldElevMeters - (towerHeight - 4.0)) / 2.8, 0.0, 1.0)
            : clamp(lobbyPhase / 3.0, 0.0, 1.0);
          vec2 beltUv = vec2(uFace * max(2.0, faceWidth / 6.0), beltV);
          bool useMagentaBelt = mod(floor(worldElevMeters / lobbyInterval + vBuildingSeed * 6.0), 2.0) < 0.5;
          vec3 barrierSample = useMagentaBelt
            ? texture2D(uMagentaRailTex, beltUv).rgb
            : texture2D(uCyanBarrierTex, beltUv).rgb;
          col = mix(col, barrierSample * (uIsNeon > 0.5 ? 0.48 : 0.58), beltMask * (1.0 - isCornerPier * 0.55));
        }

        // 6. SUBTLE GLASS REFLECTIONS & DEEP ATMOSPHERIC PERSPECTIVE RECESSION
        if (uIsNeon > 0.5) {
          vec2 reflUv = vec2(uFace * 2.0 + V.x * 0.15, hNorm * 3.0 - uTime * 0.04);
          vec3 rainbowRefl = texture2D(uRainbowTex, reflUv).rgb;
          col += rainbowRefl * fresnel * 0.14;
        }

        float sunDiff = clamp(dot(N, normalize(vec3(0.45, 0.75, -0.35))) * 0.5 + 0.5, 0.0, 1.0);
        col *= (uIsNeon > 0.5 ? (0.72 + 0.22 * sunDiff) : (0.68 + 0.42 * sunDiff));

        // Strong atmospheric depth veil so background skyscrapers recede cleanly behind the foreground track
        float camDist = length(cameraPosition - vWorldPos);
        float distFog = 1.0 - exp(-camDist * 0.00145);
        vec3 fogTarget = uIsNeon > 0.5 ? vec3(0.028, 0.018, 0.068) : vec3(0.68, 0.74, 0.82);
        col = mix(col, fogTarget, clamp(distFog * 0.76, 0.18, 0.82));

        gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(0.95)), 1.0);
      }
    `,
  });
}

function buildCityEnvironment(
  worldGroup: THREE.Group,
  spline: THREE.CatmullRomCurve3,
  textures: TrackTextureSet,
  isNeon: boolean,
  neonIntensity: number,
  animatedShaders: THREE.ShaderMaterial[],
  animatedSearchlights: THREE.Object3D[],
  isCityV2 = true
): AerialTrafficSystem {
  const trackSamples = buildTrackSamplesXZ(spline, 720);

  // 0. Deep Cyber-Metropolis Abyss Street-Grid Floor beneath the suspended track (`y = -66`)
  // Expanded to 3600m x 2800m centered at (650, -66, -150) to span the entire extended 4-sector circuit!
  const abyssGeo = new THREE.PlaneGeometry(3600, 2800, 1, 1);
  abyssGeo.rotateX(-Math.PI / 2);
  const abyssMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIsNeon: { value: isNeon ? 1.0 : 0.0 },
      uUseV2Tex: { value: isCityV2 ? 1.0 : 0.0 },
      uRainbowMap: { value: textures.cityRainbowPavementMap },
      uCorridorMap: { value: textures.cityCorridorFloorMap },
      uLaneAsphaltMap: { value: textures.cityLaneAsphaltMap },
      uWetTrackMap: { value: textures.cityWetTrackMap },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv * 72.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIsNeon;
      uniform float uUseV2Tex;
      uniform sampler2D uRainbowMap;
      uniform sampler2D uCorridorMap;
      uniform sampler2D uLaneAsphaltMap;
      uniform sampler2D uWetTrackMap;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec2 cell = floor(vUv);
        vec2 f = fract(vUv);

        // Major arterial cyber-avenues & secondary street grid
        float majorRoadX = 1.0 - smoothstep(0.0, 0.085, abs(f.x - 0.5));
        float majorRoadY = 1.0 - smoothstep(0.0, 0.085, abs(f.y - 0.5));
        float subGrid = (1.0 - smoothstep(0.0, 0.032, min(f.x, 1.0 - f.x))) +
                        (1.0 - smoothstep(0.0, 0.032, min(f.y, 1.0 - f.y)));

        // Moving traffic light pulses along lower-city avenues
        float pulseX = smoothstep(0.74, 0.98, sin(vUv.x * 6.5 + uTime * 3.8 + cell.y));
        float pulseY = smoothstep(0.74, 0.98, cos(vUv.y * 6.5 - uTime * 3.5 + cell.x));

        vec3 baseDark = uIsNeon > 0.5 ? vec3(0.018, 0.026, 0.062) : vec3(0.28, 0.32, 0.38);
        if (uUseV2Tex > 0.5) {
          vec3 rainbowTex = texture2D(uRainbowMap, vUv * 0.42).rgb;
          vec3 corridorTex = texture2D(uCorridorMap, vUv * 0.95).rgb;
          vec3 wetPlazaTex = texture2D(uWetTrackMap, vUv * 0.65).rgb;
          vec3 laneX = texture2D(uLaneAsphaltMap, vec2((f.x - 0.415) * 5.8, vUv.y * 2.5)).rgb;
          vec3 laneY = texture2D(uLaneAsphaltMap, vec2((f.y - 0.415) * 5.8, vUv.x * 2.5)).rgb;

          baseDark = mix(baseDark, mix(rainbowTex, wetPlazaTex, 0.42) * (uIsNeon > 0.5 ? 0.44 : 0.65), 0.72);
          baseDark = mix(baseDark, laneX * 0.75, majorRoadX * 0.78);
          baseDark = mix(baseDark, laneY * 0.75, majorRoadY * 0.78);
          baseDark += corridorTex * clamp(subGrid, 0.0, 1.0) * 0.32;
        }
        float blockId = hash(cell);
        vec3 cyanGrid = vec3(0.0, 0.82, 1.0);
        vec3 magentaGrid = vec3(0.95, 0.18, 0.58);

        vec3 col = baseDark;
        if (uIsNeon > 0.5) {
          col += cyanGrid * clamp(subGrid, 0.0, 1.0) * 0.22;
          col += magentaGrid * (majorRoadX + majorRoadY) * 0.28;
          col += vec3(0.65, 0.96, 1.0) * (majorRoadX * pulseY + majorRoadY * pulseX) * 0.58;
          if (blockId > 0.68) {
            float innerPad = step(0.18, f.x) * step(f.x, 0.82) * step(0.18, f.y) * step(f.y, 0.82);
            vec3 padTex = texture2D(uCorridorMap, f * 2.0).rgb;
            col += mix(cyanGrid, magentaGrid, fract(blockId * 7.3)) * padTex * innerPad * 0.24;
          }
        } else {
          col += vec3(0.42, 0.47, 0.54) * clamp(subGrid, 0.0, 1.0) * 0.25;
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const abyssFloor = new THREE.Mesh(abyssGeo, abyssMat);
  abyssFloor.position.set(650, -66, -150);
  worldGroup.add(abyssFloor);
  animatedShaders.push(abyssMat);

  // 1. Iconic Colossal Geodesic Bio-Dome & Central Energy Core on the Right-Ahead Horizon
  const domeRadius = 155;
  const safeDomePos = ensureTrackClearanceXZ(175, -675, domeRadius, trackSamples, 38);
  const domeGroup = new THREE.Group();
  domeGroup.position.set(safeDomePos.x, 95, safeDomePos.z);

  const domeGeo = new THREE.IcosahedronGeometry(domeRadius, 3);
  const domeWireframe = new THREE.WireframeGeometry(domeGeo);
  const domeLineMat = new THREE.LineBasicMaterial({
    color: isNeon ? 0x38bdf8 : 0x475569,
    transparent: true,
    opacity: isNeon ? 0.74 : 0.75,
  });
  domeGroup.add(new THREE.LineSegments(domeWireframe, domeLineMat));

  const domeSolidMat = new THREE.MeshStandardMaterial({
    color: isCityV2 ? 0x8ea4c8 : isNeon ? 0x161238 : 0xe2e8f0,
    map: isCityV2 ? textures.cityArmourPanelsMap : null,
    emissive: new THREE.Color(isNeon ? 0x3b0764 : 0x000000),
    emissiveIntensity: isNeon ? 0.45 : 0,
    roughness: 0.28,
    metalness: 0.72,
    transparent: true,
    opacity: isNeon ? 0.48 : 0.94,
  });
  const domeInner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(domeRadius * 0.985, 2),
    domeSolidMat
  );
  domeGroup.add(domeInner);

  if (isNeon) {
    // Dual Counter-Tilted Orbital Accelerator Rings around Geodesic Core
    const orbitRingGeo1 = new THREE.RingGeometry(domeRadius * 1.14, domeRadius * 1.21, 64);
    orbitRingGeo1.rotateX(Math.PI * 0.42);
    orbitRingGeo1.rotateY(0.24);
    const orbitRingMat1 = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    domeGroup.add(new THREE.Mesh(orbitRingGeo1, orbitRingMat1));

    const orbitRingGeo2 = new THREE.RingGeometry(domeRadius * 1.26, domeRadius * 1.31, 64);
    orbitRingGeo2.rotateX(-Math.PI * 0.36);
    orbitRingGeo2.rotateZ(0.32);
    const orbitRingMat2 = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    domeGroup.add(new THREE.Mesh(orbitRingGeo2, orbitRingMat2));
  }
  worldGroup.add(domeGroup);

  // 2. Studio-Grade Multi-Archetype Cyberpunk Skyline powered by `createCyberpunkBuildingShaderMaterial`
  const cyberBuildingShaderMat = createCyberpunkBuildingShaderMaterial(
    textures,
    isNeon,
    neonIntensity,
    isCityV2
  );
  animatedShaders.push(cyberBuildingShaderMat);

  // Archetype A: 185 3-Tier Setback Corporate Supertowers spanning all 4 Sectors
  const bldCount = 185;
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  towerGeo.translate(0, 0.5, 0);

  // Beveled Dark Armored Penthouse Crown & Podium Collar (`02_dark_armour_panels_940b904f.png`)
  const penthouseCrownGeo = new THREE.BoxGeometry(1.03, 1.8, 1.03);
  penthouseCrownGeo.translate(0, 0.9, 0);
  const penthouseCrownMat = new THREE.MeshStandardMaterial({
    color: isCityV2 ? 0x334155 : isNeon ? 0x050811 : 0x1e293b,
    map: isCityV2 ? textures.cityArmourPanelsMap : null,
    bumpMap: isCityV2 ? textures.cityArmourPanelsMap : null,
    bumpScale: 0.24,
    metalness: 0.88,
    roughness: 0.28,
  });

  // Open-Ended 4-Sided Perimeter Neon Rim Collars (subdued intensity so background towers don't compete with the track)
  const neonRimGeo = new THREE.CylinderGeometry(
    Math.SQRT1_2 * 1.04,
    Math.SQRT1_2 * 1.04,
    1.35,
    4,
    1,
    true
  );
  neonRimGeo.rotateY(Math.PI / 4);
  const neonRimMagentaMat = new THREE.MeshBasicMaterial({
    color: isNeon ? 0x64748b : 0x475569,
    map: isCityV2 && isNeon ? textures.cityMagentaRailMap : null,
    side: THREE.DoubleSide,
  });
  const neonRimCyanMat = new THREE.MeshBasicMaterial({
    color: isNeon ? 0x475569 : 0x475569,
    map: isCityV2 && isNeon ? textures.cityCyanBarrierMap : null,
    side: THREE.DoubleSide,
  });

  const spireGeo = new THREE.CylinderGeometry(0.08, 0.78, 46, 6);
  spireGeo.translate(0, 23, 0);
  const spireMat = new THREE.MeshBasicMaterial({
    color: isNeon ? 0x1e293b : 0x475569,
  });

  const podiumInstanced = new THREE.InstancedMesh(towerGeo, cyberBuildingShaderMat, bldCount);
  const towerInstanced = new THREE.InstancedMesh(towerGeo, cyberBuildingShaderMat, bldCount);
  const upperTierInstanced = new THREE.InstancedMesh(towerGeo, cyberBuildingShaderMat, bldCount);
  const penthouseCrownInstanced = new THREE.InstancedMesh(
    penthouseCrownGeo,
    penthouseCrownMat,
    bldCount * 2
  );
  const neonRimInstanced = new THREE.InstancedMesh(neonRimGeo, neonRimMagentaMat, bldCount);
  const upperCyanRimInstanced = new THREE.InstancedMesh(neonRimGeo, neonRimCyanMat, bldCount);
  const spireInstanced = new THREE.InstancedMesh(spireGeo, spireMat, bldCount);

  podiumInstanced.frustumCulled = false;
  towerInstanced.frustumCulled = false;
  upperTierInstanced.frustumCulled = false;
  penthouseCrownInstanced.frustumCulled = false;
  neonRimInstanced.frustumCulled = false;
  upperCyanRimInstanced.frustumCulled = false;
  spireInstanced.frustumCulled = false;

  // Archetype B: 68 Octagonal Fluted Arcology Megatowers with Triple Ring Halos
  const arcologyCount = 68;
  const arcologyGeo = new THREE.CylinderGeometry(0.86, 1.0, 1, 8);
  arcologyGeo.translate(0, 0.5, 0);
  const arcologyInstanced = new THREE.InstancedMesh(
    arcologyGeo,
    cyberBuildingShaderMat,
    arcologyCount
  );
  arcologyInstanced.frustumCulled = false;

  const arcologyHaloGeo = new THREE.CylinderGeometry(1.06, 1.06, 1.45, 8, 1, true);
  const arcologyHaloMat = new THREE.MeshBasicMaterial({
    color: isNeon ? 0x475569 : 0x334155,
    map: isCityV2 && isNeon ? textures.cityCyanBarrierMap : null,
    side: THREE.DoubleSide,
  });
  const arcologyHaloInstanced = new THREE.InstancedMesh(
    arcologyHaloGeo,
    arcologyHaloMat,
    arcologyCount * 3
  );
  arcologyHaloInstanced.frustumCulled = false;

  // Archetype C: 34 Colossal Stepped Pyramid-Ziggurat Megastructures
  const zigguratCount = 34;
  const zigguratGeo = new THREE.CylinderGeometry(0.44, 1.0, 1, 4);
  zigguratGeo.rotateY(Math.PI / 4);
  zigguratGeo.translate(0, 0.5, 0);
  const zigguratInstanced = new THREE.InstancedMesh(
    zigguratGeo,
    cyberBuildingShaderMat,
    zigguratCount
  );
  const zigguratCrownInstanced = new THREE.InstancedMesh(
    zigguratGeo,
    cyberBuildingShaderMat,
    zigguratCount
  );
  zigguratInstanced.frustumCulled = false;
  zigguratCrownInstanced.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const samplePos = new THREE.Vector3();
  const sampleFwd = new THREE.Vector3();
  const sampleRight = new THREE.Vector3();
  const sampleUp = new THREE.Vector3();
  const bldTint = new THREE.Color();
  const rimTint = new THREE.Color();

  // Cool indigo/violet/slate architectural color tints for per-building identity (no warm gold so track stays heterogeneous)
  const facadeTints = isNeon
    ? [0x818cf8, 0x6366f1, 0xa855f7, 0x38bdf8, 0x9333ea, 0x64748b]
    : [0xffffff, 0xe2e8f0, 0xcbd5e1];
  const neonRimTints = isNeon
    ? [0x6366f1, 0xa855f7, 0x3b82f6, 0xec4899, 0x8b5cf6]
    : [0x475569];

  // Store skyscraper placements so we can mount vertical neon banners & hanging power cables onto them
  const skyscraperPlacements: Array<{
    bx: number;
    bz: number;
    w: number;
    d: number;
    h: number;
    upperH: number;
    side: number;
    t: number;
    fwdX: number;
    fwdZ: number;
    rightX: number;
    rightZ: number;
  }> = [];

  for (let i = 0; i < bldCount; i++) {
    const t = (i / bldCount) % 1;
    sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);

    const side = i % 2 === 0 ? -1 : 1;
    const inFrontRightVista = side === 1 && (t < 0.16 || t > 0.92);
    const distFromTrack = (inFrontRightVista ? 76 : 44) + ((i * 29) % 92);
    const rawBx = samplePos.x + sampleRight.x * side * distFromTrack;
    const rawBz = samplePos.z + sampleRight.z * side * distFromTrack;

    const w = 20 + ((i * 13) % 24);
    const d = 20 + ((i * 17) % 24);
    const h = inFrontRightVista ? 72 + (i % 38) : 108 + ((i * 43) % 158);
    const rotY = (i * 0.42) % Math.PI;

    const footprintRadius = Math.hypot(w * 1.28, d * 1.28) * 0.62;
    const { x: bx, z: bz } = ensureTrackClearanceXZ(
      rawBx,
      rawBz,
      footprintRadius,
      trackSamples,
      44
    );

    bldTint.setHex(facadeTints[i % facadeTints.length]);
    rimTint.setHex(neonRimTints[i % neonRimTints.length]);

    // 1) Wide Armored Podium Base rising from the Abyss Street Grid (`y = -66`)
    const podiumH = Math.min(48, h * 0.34);
    dummy.position.set(bx, -66, bz);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(w * 1.22, podiumH, d * 1.22);
    dummy.updateMatrix();
    podiumInstanced.setMatrixAt(i, dummy.matrix);
    podiumInstanced.setColorAt(i, bldTint);

    // 2) Main Skyscraper Curtain-Wall Shaft
    dummy.position.set(bx, -66, bz);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    towerInstanced.setMatrixAt(i, dummy.matrix);
    towerInstanced.setColorAt(i, bldTint);

    // Dark Armored Setback Terrace Cap on Main Tower Roof (`02_dark_armour_panels`)
    dummy.position.set(bx, -66 + h, bz);
    dummy.scale.set(w * 1.02, 1.1, d * 1.02);
    dummy.updateMatrix();
    penthouseCrownInstanced.setMatrixAt(i * 2, dummy.matrix);

    // 3) Upper Setback Tier
    const upperH = h * 0.34;
    dummy.position.set(bx, -66 + h, bz);
    dummy.scale.set(w * 0.68, upperH, d * 0.68);
    dummy.updateMatrix();
    upperTierInstanced.setMatrixAt(i, dummy.matrix);
    upperTierInstanced.setColorAt(i, bldTint);

    // Dark Armored Penthouse Crown on top of Upper Tier (`02_dark_armour_panels`)
    dummy.position.set(bx, -66 + h + upperH, bz);
    dummy.scale.set(w * 0.69, 1.4, d * 0.69);
    dummy.updateMatrix();
    penthouseCrownInstanced.setMatrixAt(i * 2 + 1, dummy.matrix);

    // Glowing Magenta Neon Rail Collar at Main Setback Ledge (`05_magenta_neon_rail`)
    dummy.position.set(bx, -66 + h - 0.8, bz);
    dummy.scale.set(w, 1.35, d);
    dummy.updateMatrix();
    neonRimInstanced.setMatrixAt(i, dummy.matrix);
    neonRimInstanced.setColorAt(i, rimTint);

    // Glowing Cyan Light Barrier Collar on Upper Tier Crown (`03_cyan_light_barrier`)
    dummy.position.set(bx, -66 + h + upperH - 0.9, bz);
    dummy.scale.set(w * 0.68, 1.25, d * 0.68);
    dummy.updateMatrix();
    upperCyanRimInstanced.setMatrixAt(i, dummy.matrix);
    upperCyanRimInstanced.setColorAt(i, bldTint);

    // Rooftop Telemetry Spire Antenna
    dummy.position.set(bx, -66 + h + upperH + 2.2, bz);
    dummy.scale.set(1, 0.85 + (i % 3) * 0.28, 1);
    dummy.updateMatrix();
    spireInstanced.setMatrixAt(i, dummy.matrix);

    skyscraperPlacements.push({
      bx,
      bz,
      w,
      d,
      h,
      upperH,
      side,
      t,
      fwdX: sampleFwd.x,
      fwdZ: sampleFwd.z,
      rightX: sampleRight.x,
      rightZ: sampleRight.z,
    });
  }

  // Populate Archetype B: 48 Octagonal Fluted Arcology Megatowers
  for (let i = 0; i < arcologyCount; i++) {
    const t = ((i + 0.35) / arcologyCount) % 1;
    sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);
    const side = i % 2 === 0 ? 1 : -1;
    const inFrontRightVista = side === 1 && (t < 0.16 || t > 0.92);
    const dist = (inFrontRightVista ? 92 : 56) + ((i * 37) % 98);
    const rawAx = samplePos.x + sampleRight.x * side * dist;
    const rawAz = samplePos.z + sampleRight.z * side * dist;
    const radius = 13 + (i % 10);
    const h = inFrontRightVista ? 82 + (i % 36) : 124 + ((i * 39) % 148);

    const { x: ax, z: az } = ensureTrackClearanceXZ(rawAx, rawAz, radius * 1.36, trackSamples, 44);

    bldTint.setHex(facadeTints[(i + 2) % facadeTints.length]);
    rimTint.setHex(neonRimTints[(i + 1) % neonRimTints.length]);

    dummy.position.set(ax, -66, az);
    dummy.rotation.set(0, i * 0.3, 0);
    dummy.scale.set(radius, h, radius);
    dummy.updateMatrix();
    arcologyInstanced.setMatrixAt(i, dummy.matrix);
    arcologyInstanced.setColorAt(i, bldTint);

    // 3 Glowing Cyan/Magenta Light Barrier Ring Halos per Arcology Tower (at 42%, 70%, and 94% height)
    const haloFracs = [0.42, 0.70, 0.94];
    for (let hIdx = 0; hIdx < 3; hIdx++) {
      const hf = haloFracs[hIdx];
      const ringScaleR = radius * THREE.MathUtils.lerp(1.01, 0.89, hf);
      dummy.position.set(ax, -66 + h * hf, az);
      dummy.scale.set(ringScaleR, 1.5, ringScaleR);
      dummy.updateMatrix();
      arcologyHaloInstanced.setMatrixAt(i * 3 + hIdx, dummy.matrix);
      arcologyHaloInstanced.setColorAt(i * 3 + hIdx, hIdx === 1 ? bldTint : rimTint);
    }
  }

  // Populate Archetype C: 24 Colossal Stepped Ziggurat Megastructures + Sky Beacons
  for (let i = 0; i < zigguratCount; i++) {
    const t = ((i + 0.15) / zigguratCount) % 1;
    sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);
    const side = i % 2 === 0 ? -1 : 1;
    const dist = 122 + ((i * 47) % 115);
    const rawZx = samplePos.x + sampleRight.x * side * dist;
    const rawZz = samplePos.z + sampleRight.z * side * dist;
    const baseR = 28 + (i % 16);
    const h = 168 + ((i * 53) % 128);

    const { x: zx, z: zz } = ensureTrackClearanceXZ(rawZx, rawZz, baseR * 1.32, trackSamples, 48);

    bldTint.setHex(facadeTints[(i + 4) % facadeTints.length]);
    dummy.position.set(zx, -66, zz);
    dummy.rotation.set(0, (i * Math.PI) / 4, 0);
    dummy.scale.set(baseR, h, baseR);
    dummy.updateMatrix();
    zigguratInstanced.setMatrixAt(i, dummy.matrix);
    zigguratInstanced.setColorAt(i, bldTint);

    // Upper stepped ziggurat citadel tier
    const crownH = h * 0.36;
    dummy.position.set(zx, -66 + h * 0.88, zz);
    dummy.rotation.set(0, (i * Math.PI) / 4, 0);
    dummy.scale.set(baseR * 0.56, crownH, baseR * 0.56);
    dummy.updateMatrix();
    zigguratCrownInstanced.setMatrixAt(i, dummy.matrix);
    zigguratCrownInstanced.setColorAt(i, bldTint);
  }

  if (podiumInstanced.instanceColor) podiumInstanced.instanceColor.needsUpdate = true;
  if (towerInstanced.instanceColor) towerInstanced.instanceColor.needsUpdate = true;
  if (upperTierInstanced.instanceColor) upperTierInstanced.instanceColor.needsUpdate = true;
  if (neonRimInstanced.instanceColor) neonRimInstanced.instanceColor.needsUpdate = true;
  if (upperCyanRimInstanced.instanceColor) upperCyanRimInstanced.instanceColor.needsUpdate = true;
  if (arcologyInstanced.instanceColor) arcologyInstanced.instanceColor.needsUpdate = true;
  if (arcologyHaloInstanced.instanceColor) arcologyHaloInstanced.instanceColor.needsUpdate = true;
  if (zigguratInstanced.instanceColor) zigguratInstanced.instanceColor.needsUpdate = true;
  if (zigguratCrownInstanced.instanceColor) zigguratCrownInstanced.instanceColor.needsUpdate = true;

  podiumInstanced.computeBoundingSphere();
  towerInstanced.computeBoundingSphere();
  upperTierInstanced.computeBoundingSphere();
  penthouseCrownInstanced.computeBoundingSphere();
  neonRimInstanced.computeBoundingSphere();
  upperCyanRimInstanced.computeBoundingSphere();
  spireInstanced.computeBoundingSphere();
  arcologyInstanced.computeBoundingSphere();
  arcologyHaloInstanced.computeBoundingSphere();
  zigguratInstanced.computeBoundingSphere();
  zigguratCrownInstanced.computeBoundingSphere();

  worldGroup.add(
    podiumInstanced,
    towerInstanced,
    upperTierInstanced,
    penthouseCrownInstanced,
    neonRimInstanced,
    upperCyanRimInstanced,
    spireInstanced,
    arcologyInstanced,
    arcologyHaloInstanced,
    zigguratInstanced,
    zigguratCrownInstanced
  );

  // 3. Cyberpunk Advertising Billboard & Vertical Neon Banner System (`decorative2k_bbaeeaee.jpg`)
  // Helper that builds a PlaneGeometry with exact sub-atlas UV coordinates (u0, v0, u1, v1)
  // and stores local panel 0..1 UVs in attribute `aPanelUv` for scanline & glass reflection effects
  const createAtlasPanelGeometry = (
    width: number,
    height: number,
    u0: number,
    v0: number,
    u1: number,
    v1: number
  ): THREE.BufferGeometry => {
    const geo = new THREE.PlaneGeometry(width, height, 1, 1);
    const uvAttr = geo.attributes.uv as THREE.BufferAttribute;
    // PlaneGeometry vertex order: 0:(0,1) top-left, 1:(1,1) top-right, 2:(0,0) bottom-left, 3:(1,0) bottom-right
    const panelUvs = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
    geo.setAttribute('aPanelUv', new THREE.BufferAttribute(panelUvs, 2));
    uvAttr.setXY(0, u0, v1);
    uvAttr.setXY(1, u1, v1);
    uvAttr.setXY(2, u0, v0);
    uvAttr.setXY(3, u1, v0);
    uvAttr.needsUpdate = true;
    return geo;
  };

  // Exact UV sub-rectangles for all 16 cyberpunk signs & banners in `/assets/aistudio/decorative2k_bbaeeaee.jpg` (2752x1536)
  const DECORATIVE_ATLAS_PANELS = {
    // 5 Tall Vertical Skyscraper & Pylon Neon Banners
    VERT_NEO_TOKYO_CYBORG: { u0: 0.0203, v0: 0.6432, u1: 0.1061, v1: 0.9688, aspect: 0.47 }, // #0
    VERT_NEO_TOKYO_WOMAN_TOP: { u0: 0.8924, v0: 0.6432, u1: 0.9797, v1: 0.9714, aspect: 0.48 }, // #4
    VERT_KANJI_NEON: { u0: 0.0189, v0: 0.0365, u1: 0.1061, v1: 0.4818, aspect: 0.35 }, // #8
    VERT_NEO_TOKYO_CRT: { u0: 0.7616, v0: 0.0365, u1: 0.8634, v1: 0.4818, aspect: 0.41 }, // #12
    VERT_NEO_TOKYO_WOMAN_FULL: { u0: 0.8924, v0: 0.0365, u1: 0.9797, v1: 0.4818, aspect: 0.35 }, // #13

    // 11 Landscape Trackside, Overhead & Megastructure Billboards
    AD_NEO_KOLA_CAN: { u0: 0.1366, v0: 0.7474, u1: 0.3561, v1: 0.9688, aspect: 1.78 }, // #1
    AD_NEO_KOLA_ANDROID: { u0: 0.3924, v0: 0.7500, u1: 0.6119, v1: 0.9688, aspect: 1.80 }, // #2
    AD_CYBBCORE_ANDROID: { u0: 0.6395, v0: 0.7604, u1: 0.8605, v1: 0.9714, aspect: 1.88 }, // #3
    AD_CYBERNETICS_NOW: { u0: 0.1366, v0: 0.5182, u1: 0.3561, v1: 0.7135, aspect: 2.01 }, // #5
    AD_SHIBUYA_DRIFT: { u0: 0.3924, v0: 0.5182, u1: 0.6105, v1: 0.7161, aspect: 1.97 }, // #6
    AD_GLITCH_GEAR: { u0: 0.6410, v0: 0.5182, u1: 0.8605, v1: 0.7083, aspect: 2.07 }, // #7
    AD_NEO_TOKYO_MOTORS_LOGO: { u0: 0.1366, v0: 0.2891, u1: 0.3183, v1: 0.4818, aspect: 1.69 }, // #9
    AD_CYBERDYNE_PYRAMID: { u0: 0.3474, v0: 0.2891, u1: 0.5116, v1: 0.4818, aspect: 1.53 }, // #10
    AD_GLITCH_COLA: { u0: 0.5465, v0: 0.2891, u1: 0.7282, v1: 0.4818, aspect: 1.69 }, // #11
    AD_NEO_TOKYO_MOTORS_WIDE: { u0: 0.1352, v0: 0.0365, u1: 0.4942, v1: 0.2526, aspect: 2.98 }, // #14
    AD_CYBERDYNE_SLASH: { u0: 0.5334, v0: 0.0365, u1: 0.7326, v1: 0.2526, aspect: 1.65 }, // #15
  };

  // Custom GLSL LED Billboard Screen Material powered by `decorative2k_bbaeeaee.jpg`
  const cyberAdScreenMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAtlasMap: { value: textures.cityDecorativeAtlasMap },
      uIsNeon: { value: isNeon ? 1.0 : 0.0 },
      uNeonIntensity: { value: neonIntensity },
    },
    vertexShader: `
      attribute vec2 aPanelUv;
      varying vec2 vUv;
      varying vec2 vPanelUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vPanelUv = aPanelUv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uAtlasMap;
      uniform float uIsNeon;
      uniform float uNeonIntensity;
      varying vec2 vUv;
      varying vec2 vPanelUv;
      varying vec3 vWorldPos;

      void main() {
        // Subtle periodic horizontal cyber-glitch wave
        float seed = fract(sin(dot(floor(vWorldPos.xz * 0.05), vec2(12.9898, 78.233))) * 43758.5453);
        float glitchWindow = smoothstep(0.965, 0.995, sin(uTime * 2.3 + seed * 6.2831));
        float band = step(0.65, fract(vPanelUv.y * 9.0 + uTime * 4.0));
        vec2 sampleUv = vUv;
        sampleUv.x += glitchWindow * band * 0.0028 * sin(uTime * 45.0);

        vec3 texCol = texture2D(uAtlasMap, sampleUv).rgb;

        // Fine LED matrix scanlines & moving diagonal glass reflection sheen
        float scanline = 0.91 + 0.09 * sin(vPanelUv.y * 140.0 - uTime * 11.0);
        float glassSheen = smoothstep(0.86, 0.99, sin((vPanelUv.x * 0.75 + vPanelUv.y) * 3.6 - uTime * 1.65 + seed * 5.0)) * 0.16;

        // Subtle inner bezel frame darkening at panel edges
        float edgeX = smoothstep(0.0, 0.025, vPanelUv.x) * smoothstep(0.0, 0.025, 1.0 - vPanelUv.x);
        float edgeY = smoothstep(0.0, 0.025, vPanelUv.y) * smoothstep(0.0, 0.025, 1.0 - vPanelUv.y);
        float bezelMask = 0.72 + 0.28 * (edgeX * edgeY);

        float emissiveGain = uIsNeon > 0.5 ? (1.14 * clamp(uNeonIntensity, 0.85, 1.35)) : 0.88;
        vec3 col = texCol * scanline * emissiveGain * bezelMask + vec3(0.18, 0.86, 1.0) * glassSheen;

        // Atmospheric distance fog blend
        float camDist = length(cameraPosition - vWorldPos);
        float distFog = 1.0 - exp(-camDist * 0.00062);
        vec3 fogTarget = uIsNeon > 0.5 ? vec3(0.04, 0.02, 0.09) : vec3(0.68, 0.74, 0.82);
        col = mix(col, fogTarget, clamp(distFog * 0.45, 0.0, 0.55));

        gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.32)), 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
  animatedShaders.push(cyberAdScreenMat);

  // Shared Architectural Materials using the 8 uploaded City textures
  const sharedArmourMat = new THREE.MeshStandardMaterial({
    color: isCityV2 ? 0xdbeafe : 0x090d16,
    map: isCityV2 ? textures.cityArmourPanelsMap : null,
    bumpMap: isCityV2 ? textures.cityArmourPanelsMap : null,
    bumpScale: 0.22,
    metalness: 0.86,
    roughness: 0.24,
  });
  const sharedCyanBarrierMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.cityCyanBarrierMap,
    emissive: new THREE.Color(isNeon ? 0x38bdf8 : 0x0ea5e9),
    emissiveMap: textures.cityCyanBarrierMap,
    emissiveIntensity: isNeon ? 0.82 * neonIntensity : 0.22,
    roughness: 0.24,
    metalness: 0.78,
  });
  const sharedMagentaRailMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: textures.cityMagentaRailMap,
  });
  const sharedCorridorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.cityCorridorFloorMap,
    emissive: new THREE.Color(isNeon ? 0x67e8f9 : 0x1e293b),
    emissiveMap: textures.cityCorridorFloorMap,
    emissiveIntensity: isNeon ? 0.68 * neonIntensity : 0.18,
    roughness: 0.22,
    metalness: 0.78,
  });
  const sharedWetDeckMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.cityWetTrackMap,
    emissive: new THREE.Color(isNeon ? 0x818cf8 : 0x1e293b),
    emissiveMap: textures.cityWetTrackMap,
    emissiveIntensity: isNeon ? 0.42 * neonIntensity : 0.12,
    roughness: 0.16,
    metalness: 0.82,
  });
  const darkCableMat = new THREE.MeshStandardMaterial({
    color: 0x090c15,
    roughness: 0.42,
    metalness: 0.78,
  });

  // Helper to construct a framed 3D cyberpunk billboard with armored casing, neon perimeter trim bars & truss struts
  const buildFramedBillboardGroup = (
    panel: { u0: number; v0: number; u1: number; v1: number; aspect: number },
    height: number,
    useMagentaTrim: boolean,
    withSupportLegs = false,
    legHeight = 8.0
  ): THREE.Group => {
    const width = height * panel.aspect;
    const grp = new THREE.Group();

    // Front & rear UV-cropped animated WebP LED screens (double-sided visibility)
    const screenGeo = createAtlasPanelGeometry(width, height, panel.u0, panel.v0, panel.u1, panel.v1);
    const frontScreen = new THREE.Mesh(screenGeo, cyberAdScreenMat);
    frontScreen.position.z = 0.34;
    const rearScreen = new THREE.Mesh(screenGeo, cyberAdScreenMat);
    rearScreen.position.z = -0.34;
    rearScreen.rotation.y = Math.PI;
    grp.add(frontScreen, rearScreen);

    // Beveled Dark Armored Backing Frame (`02_dark_armour_panels`)
    const backingMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.95, height + 0.95, 0.56),
      sharedArmourMat
    );
    grp.add(backingMesh);

    // Top, Bottom, Left & Right Glowing Neon Frame Strips (`03_cyan_light_barrier` / `05_magenta_neon_rail`)
    const trimMat = useMagentaTrim ? sharedMagentaRailMat : sharedCyanBarrierMat;
    const altTrimMat = useMagentaTrim ? sharedCyanBarrierMat : sharedMagentaRailMat;
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(width + 1.15, 0.38, 0.74), trimMat);
    topBar.position.set(0, height * 0.5 + 0.48, 0.05);
    const botBar = new THREE.Mesh(new THREE.BoxGeometry(width + 1.15, 0.38, 0.74), trimMat);
    botBar.position.set(0, -height * 0.5 - 0.48, 0.05);
    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, height + 0.65, 0.70), altTrimMat);
    leftBar.position.set(-width * 0.5 - 0.48, 0, 0.05);
    const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, height + 0.65, 0.70), altTrimMat);
    rightBar.position.set(width * 0.5 + 0.48, 0, 0.05);
    grp.add(topBar, botBar, leftBar, rightBar);

    if (withSupportLegs) {
      const legGeo = new THREE.BoxGeometry(0.62, legHeight, 0.68);
      const leftLeg = new THREE.Mesh(legGeo, sharedArmourMat);
      leftLeg.position.set(-width * 0.34, -height * 0.5 - legHeight * 0.5, -0.15);
      const rightLeg = new THREE.Mesh(legGeo, sharedArmourMat);
      rightLeg.position.set(width * 0.34, -height * 0.5 - legHeight * 0.5, -0.15);
      grp.add(leftLeg, rightLeg);
    }

    return grp;
  };

  // Helper to drape realistic 3D catenary power cables (`TubeGeometry`) between two world 3D points
  const addCatenaryCableBundle = (
    pStart: THREE.Vector3,
    pEnd: THREE.Vector3,
    cableCount: number,
    sagMeters: number,
    radius = 0.14
  ) => {
    for (let c = 0; c < cableCount; c++) {
      const spreadY = (c - (cableCount - 1) * 0.5) * 0.55;
      const spreadX = ((c % 2) - 0.5) * 0.45;
      const sag = sagMeters + c * 0.85;

      const p0 = new THREE.Vector3(pStart.x + spreadX, pStart.y + spreadY, pStart.z);
      const p4 = new THREE.Vector3(pEnd.x + spreadX, pEnd.y + spreadY * 0.7, pEnd.z);
      const p1 = new THREE.Vector3().lerpVectors(p0, p4, 0.25);
      p1.y -= sag * 0.72;
      const p2 = new THREE.Vector3().lerpVectors(p0, p4, 0.5);
      p2.y -= sag;
      const p3 = new THREE.Vector3().lerpVectors(p0, p4, 0.75);
      p3.y -= sag * 0.72;

      const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4]);
      const tubeGeo = new THREE.TubeGeometry(curve, 14, radius, 5, false);
      const tubeMesh = new THREE.Mesh(tubeGeo, darkCableMat);
      worldGroup.add(tubeMesh);
    }
  };

  // 3A. Mount Tall Vertical Neon Banners & Corporate Facade Billboards onto Skyscrapers (`decorative2k_bbaeeaee.jpg`)
  const verticalBannerPanels = [
    DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CYBORG,
    DECORATIVE_ATLAS_PANELS.VERT_KANJI_NEON,
    DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CRT,
    DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_WOMAN_TOP,
    DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_WOMAN_FULL,
  ];
  const facadeLandscapePanels = [
    DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_PYRAMID,
    DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_LOGO,
    DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_SLASH,
    DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_ANDROID,
    DECORATIVE_ATLAS_PANELS.AD_GLITCH_COLA,
  ];
  const lookTarget = new THREE.Vector3();

  for (let i = 0; i < skyscraperPlacements.length; i++) {
    // Mount vertical neon banners on ~55% of skyscrapers, and on 100% of starting-straight vista towers (t < 0.14 or t > 0.90)
    const sp = skyscraperPlacements[i];
    const isStartVista = sp.t < 0.14 || sp.t > 0.90;
    if (!isStartVista && i % 2 !== 0) continue;

    const vPanel = verticalBannerPanels[i % verticalBannerPanels.length];
    const bannerH = THREE.MathUtils.clamp(sp.h * 0.36, 26, 48);
    const bannerGrp = buildFramedBillboardGroup(vPanel, bannerH, i % 2 === 0, false);

    // Position on the track-facing side of the skyscraper shaft and verify track clearance
    const faceOffset = Math.max(sp.w, sp.d) * 0.52 + 1.2;
    const rawBannerX = sp.bx - sp.rightX * sp.side * faceOffset;
    const rawBannerZ = sp.bz - sp.rightZ * sp.side * faceOffset;
    const bannerHalfW = bannerH * vPanel.aspect * 0.55;
    const { x: bannerX, z: bannerZ } = ensureTrackClearanceXZ(
      rawBannerX,
      rawBannerZ,
      bannerHalfW,
      trackSamples,
      34
    );
    const bannerY = -66 + sp.h * 0.64;

    bannerGrp.position.set(bannerX, bannerY, bannerZ);
    // Angle slightly toward approaching racers along the track
    lookTarget
      .set(
        bannerX - sp.rightX * sp.side * 12 - sp.fwdX * 8,
        bannerY - 2,
        bannerZ - sp.rightZ * sp.side * 12 - sp.fwdZ * 8
      );
    bannerGrp.lookAt(lookTarget);
    worldGroup.add(bannerGrp);

    // On starting-vista and every 3rd skyscraper, also mount a lower podium corporate sign (e.g. CYBERDYNE SYSTEMS / NEO-TOKYO MOTORS)
    if (isStartVista || i % 3 === 0) {
      const lPanel = facadeLandscapePanels[(i + 1) % facadeLandscapePanels.length];
      const lowSignH = 9.5;
      const lowSignHalfW = lowSignH * lPanel.aspect * 0.55;
      const lowSignGrp = buildFramedBillboardGroup(lPanel, lowSignH, i % 2 !== 0, false);
      const lowY = -66 + Math.min(sp.h * 0.34, 42) + 8.5;
      const safeLowPos = ensureTrackClearanceXZ(
        bannerX - sp.rightX * sp.side * 1.4,
        bannerZ - sp.rightZ * sp.side * 1.4,
        lowSignHalfW,
        trackSamples,
        34
      );
      lowSignGrp.position.set(safeLowPos.x, lowY, safeLowPos.z);
      lookTarget.set(
        lowSignGrp.position.x - sp.rightX * sp.side * 10 - sp.fwdX * 14,
        lowY - 1,
        lowSignGrp.position.z - sp.rightZ * sp.side * 10 - sp.fwdZ * 14
      );
      lowSignGrp.lookAt(lookTarget);
      worldGroup.add(lowSignGrp);
    }
  }

  // 3B. 6 Colossal Horizon Landmark Twin-Spire Megastructure Complexes framing key circuit vistas!
  const heroVistaT = [0.08, 0.24, 0.41, 0.58, 0.74, 0.90];
  const heroComplexFootprint = 68;
  const megaFacadePanels = [
    DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_WIDE,
    DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_ANDROID,
    DECORATIVE_ATLAS_PANELS.AD_CYBBCORE_ANDROID,
    DECORATIVE_ATLAS_PANELS.AD_SHIBUYA_DRIFT,
    DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_PYRAMID,
    DECORATIVE_ATLAS_PANELS.AD_GLITCH_GEAR,
  ];

  for (let hIdx = 0; hIdx < heroVistaT.length; hIdx++) {
    const t = heroVistaT[hIdx];
    sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);
    const side = hIdx % 2 === 0 ? -1 : 1;
    const rawMx = samplePos.x + sampleRight.x * side * 128;
    const rawMz = samplePos.z + sampleRight.z * side * 128;
    const { x: mx, z: mz } = ensureTrackClearanceXZ(
      rawMx,
      rawMz,
      heroComplexFootprint,
      trackSamples,
      50
    );

    const megaGroup = new THREE.Group();
    megaGroup.position.set(mx, -66, mz);
    megaGroup.rotation.y = Math.atan2(sampleFwd.x, sampleFwd.z) + (side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5);

    const megaH = 235 + (hIdx % 3) * 32;
    // Shared Stepped Armored Podium Base
    const basePodium = new THREE.Mesh(towerGeo, cyberBuildingShaderMat);
    basePodium.scale.set(74, 58, 42);
    megaGroup.add(basePodium);

    const podiumArmourCap = new THREE.Mesh(
      new THREE.BoxGeometry(76, 3.2, 44),
      sharedArmourMat
    );
    podiumArmourCap.position.set(0, 58, 0);
    megaGroup.add(podiumArmourCap);

    const podiumHelipad = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.8, 28),
      sharedWetDeckMat
    );
    podiumHelipad.position.set(0, 59.8, 0);
    megaGroup.add(podiumHelipad);

    // Twin Supertower Spires rising from the Podium
    for (let sDir = -1; sDir <= 1; sDir += 2) {
      const spireX = sDir * 21;
      const mainSpire = new THREE.Mesh(towerGeo, cyberBuildingShaderMat);
      mainSpire.position.set(spireX, 58, 0);
      mainSpire.scale.set(24, megaH - 58, 26);
      megaGroup.add(mainSpire);

      // Armored Corner Exoskeleton Buttress Ribs (`02_dark_armour_panels`)
      const exoRib = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, megaH - 40, 28.4),
        sharedArmourMat
      );
      exoRib.position.set(spireX + sDir * 11.2, 58 + (megaH - 58) * 0.48, 0);
      megaGroup.add(exoRib);

      // Upper Setback Penthouse Tower
      const crownSpire = new THREE.Mesh(towerGeo, cyberBuildingShaderMat);
      crownSpire.position.set(spireX, megaH, 0);
      crownSpire.scale.set(16, 44, 18);
      megaGroup.add(crownSpire);

      // Cyan & Magenta Sky-Lobby Light Collars (`03_cyan_light_barrier` & `05_magenta_neon_rail`)
      const collar1 = new THREE.Mesh(
        new THREE.BoxGeometry(25.4, 3.6, 27.4),
        sDir < 0 ? sharedCyanBarrierMat : sharedMagentaRailMat
      );
      collar1.position.set(spireX, megaH, 0);
      megaGroup.add(collar1);

      const collar2 = new THREE.Mesh(
        new THREE.BoxGeometry(17.2, 3.2, 19.2),
        sDir < 0 ? sharedMagentaRailMat : sharedCyanBarrierMat
      );
      collar2.position.set(spireX, megaH + 44, 0);
      megaGroup.add(collar2);

      // Tall Vertical Decorative2k Banner on each Twin Spire face
      const spireVertPanel =
        verticalBannerPanels[(hIdx * 2 + (sDir < 0 ? 0 : 1)) % verticalBannerPanels.length];
      const spireBanner = buildFramedBillboardGroup(spireVertPanel, 44, sDir < 0, false);
      spireBanner.position.set(spireX, 118, 13.8);
      megaGroup.add(spireBanner);
    }

    // Dual High-Altitude Sky-Bridges connecting the Twin Spires (`08_cyan_corridor_floor` + `03_cyan_light_barrier`)
    const skyBridgeHeights = [megaH * 0.56, megaH * 0.84];
    for (let bIdx = 0; bIdx < skyBridgeHeights.length; bIdx++) {
      const by = skyBridgeHeights[bIdx];
      const bridgeDeck = new THREE.Mesh(
        new THREE.BoxGeometry(22, 4.2, 14),
        sharedCorridorMat
      );
      bridgeDeck.position.set(0, by, 0);
      megaGroup.add(bridgeDeck);

      const bridgeSideBarrier = new THREE.Mesh(
        new THREE.BoxGeometry(22.4, 2.2, 14.8),
        bIdx === 0 ? sharedCyanBarrierMat : sharedMagentaRailMat
      );
      bridgeSideBarrier.position.set(0, by + 2.4, 0);
      megaGroup.add(bridgeSideBarrier);
    }

    // Giant Ultra-Wide Decorative2k Billboard mounted on the Track-Facing Podium Front
    const podiumBillboard = buildFramedBillboardGroup(
      megaFacadePanels[hIdx % megaFacadePanels.length],
      16,
      hIdx % 2 === 0,
      false
    );
    podiumBillboard.position.set(0, 82, 21.6);
    megaGroup.add(podiumBillboard);

    worldGroup.add(megaGroup);
  }

  // 3C. Trackside Barrier Advertising Billboard Corridor (Matching Reference Images 1 & 2!)
  // Includes the exact hero starting-straight composition (NEO-KOLA, SHIBUYA DRIFT, CYBERNETICS NOW,
  // GLITCH GEAR, NEO-TOKYO MOTORS, GLITCH COLA, CYBERDYNE SYSTEMS) plus full-circuit coverage
  const tracksideBillboardSpecs: Array<{
    t: number;
    side: -1 | 1;
    panel: { u0: number; v0: number; u1: number; v1: number; aspect: number };
    height: number;
    elevOffset: number;
    lateralExtra: number;
    inwardYaw: number;
    magentaTrim: boolean;
  }> = [
    // Starting-Grid Foreground & Mid-Straight Hero Gallery (visible immediately from the starting grid!)
    {
      t: 0.015,
      side: -1,
      panel: DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_CAN,
      height: 5.6,
      elevOffset: 4.2,
      lateralExtra: 5.2,
      inwardYaw: 0.32,
      magentaTrim: true,
    },
    {
      t: 0.016,
      side: 1,
      panel: DECORATIVE_ATLAS_PANELS.AD_SHIBUYA_DRIFT,
      height: 5.6,
      elevOffset: 4.2,
      lateralExtra: 5.2,
      inwardYaw: -0.32,
      magentaTrim: false,
    },
    {
      t: 0.024,
      side: -1,
      panel: DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_LOGO,
      height: 5.2,
      elevOffset: 4.0,
      lateralExtra: 5.6,
      inwardYaw: 0.28,
      magentaTrim: false,
    },
    {
      t: 0.025,
      side: 1,
      panel: DECORATIVE_ATLAS_PANELS.AD_GLITCH_COLA,
      height: 5.2,
      elevOffset: 4.0,
      lateralExtra: 5.6,
      inwardYaw: -0.28,
      magentaTrim: true,
    },
    {
      t: 0.035,
      side: -1,
      panel: DECORATIVE_ATLAS_PANELS.AD_CYBERNETICS_NOW,
      height: 5.4,
      elevOffset: 4.3,
      lateralExtra: 5.4,
      inwardYaw: 0.26,
      magentaTrim: false,
    },
    {
      t: 0.036,
      side: 1,
      panel: DECORATIVE_ATLAS_PANELS.AD_GLITCH_GEAR,
      height: 5.4,
      elevOffset: 4.3,
      lateralExtra: 5.4,
      inwardYaw: -0.26,
      magentaTrim: true,
    },
    {
      t: 0.050,
      side: -1,
      panel: DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_PYRAMID,
      height: 6.2,
      elevOffset: 5.0,
      lateralExtra: 6.2,
      inwardYaw: 0.24,
      magentaTrim: true,
    },
    {
      t: 0.052,
      side: 1,
      panel: DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_SLASH,
      height: 6.2,
      elevOffset: 5.0,
      lateralExtra: 6.2,
      inwardYaw: -0.24,
      magentaTrim: false,
    },
    {
      t: 0.068,
      side: -1,
      panel: DECORATIVE_ATLAS_PANELS.AD_SHIBUYA_DRIFT,
      height: 6.5,
      elevOffset: 5.8,
      lateralExtra: 6.8,
      inwardYaw: 0.22,
      magentaTrim: false,
    },
    {
      t: 0.070,
      side: 1,
      panel: DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_CAN,
      height: 6.5,
      elevOffset: 5.8,
      lateralExtra: 6.8,
      inwardYaw: -0.22,
      magentaTrim: true,
    },
  ];

  // Add 58 more trackside billboards around the rest of the 2.54x extended circuit (t = 0.088 .. 0.968)
  const circuitLandscapeSequence = [
    DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_CAN,
    DECORATIVE_ATLAS_PANELS.AD_SHIBUYA_DRIFT,
    DECORATIVE_ATLAS_PANELS.AD_CYBERNETICS_NOW,
    DECORATIVE_ATLAS_PANELS.AD_GLITCH_GEAR,
    DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_LOGO,
    DECORATIVE_ATLAS_PANELS.AD_GLITCH_COLA,
    DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_PYRAMID,
    DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_ANDROID,
    DECORATIVE_ATLAS_PANELS.AD_CYBBCORE_ANDROID,
    DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_SLASH,
    DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_WIDE,
  ];
  for (let idx = 0; idx < 58; idx++) {
    const t = 0.088 + (idx / 58) * 0.88;
    const side: -1 | 1 = idx % 2 === 0 ? -1 : 1;
    const panel = circuitLandscapeSequence[idx % circuitLandscapeSequence.length];
    tracksideBillboardSpecs.push({
      t,
      side,
      panel,
      height: 5.6 + (idx % 3) * 0.8,
      elevOffset: 4.4 + (idx % 2) * 1.1,
      lateralExtra: 5.6 + (idx % 3) * 0.9,
      inwardYaw: side < 0 ? 0.26 : -0.26,
      magentaTrim: idx % 2 === 0,
    });
  }

  for (let i = 0; i < tracksideBillboardSpecs.length; i++) {
    const spec = tracksideBillboardSpecs[i];
    // Skip tunnel / sky-corridor / overpass spans where set-piece architecture frames the road
    if (spec.t >= 0.700 && spec.t <= 0.815) continue;

    sampleTrackFrame(spline, spec.t, samplePos, sampleFwd, sampleRight, sampleUp);
    const billWidth = spec.height * spec.panel.aspect;
    // Ensure lateral offset is always wide enough for the angled billboard width + support legs on curves
    const safeLateralExtra = Math.max(spec.lateralExtra, billWidth * 0.52 + 6.2);
    const offsetDist = TRACK_HALF_WIDTH + safeLateralExtra;
    const rawBx = samplePos.x + sampleRight.x * spec.side * offsetDist;
    const rawBz = samplePos.z + sampleRight.z * spec.side * offsetDist;
    const { x: bx, z: bz } = ensureTrackClearanceXZ(
      rawBx,
      rawBz,
      billWidth * 0.58,
      trackSamples,
      15.0
    );
    const by = samplePos.y + spec.elevOffset;

    const bbGroup = buildFramedBillboardGroup(
      spec.panel,
      spec.height,
      spec.magentaTrim,
      false
    );
    bbGroup.position.set(bx, by, bz);

    // Orient facing approaching racers, angled slightly inward toward the track centerline
    lookTarget
      .copy(bbGroup.position)
      .sub(sampleFwd)
      .addScaledVector(sampleRight, -spec.side * Math.abs(Math.tan(spec.inwardYaw * 0.75)));
    bbGroup.lookAt(lookTarget);
    worldGroup.add(bbGroup);
  }

  // 3C-II. Over-Track Animated Cyber-Advertising Gantry Portals spanning the roadway
  // Showcases all 16 animated WebP advertising panels directly above the player's sightline!
  const adGantrySpecs: Array<{
    t: number;
    leftPanel: { u0: number; v0: number; u1: number; v1: number; aspect: number };
    rightPanel: { u0: number; v0: number; u1: number; v1: number; aspect: number };
    leftVertPanel: { u0: number; v0: number; u1: number; v1: number; aspect: number };
    rightVertPanel: { u0: number; v0: number; u1: number; v1: number; aspect: number };
  }> = [
    {
      t: 0.042,
      leftPanel: DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_CAN,
      rightPanel: DECORATIVE_ATLAS_PANELS.AD_SHIBUYA_DRIFT,
      leftVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CYBORG,
      rightVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_WOMAN_TOP,
    },
    {
      t: 0.145,
      leftPanel: DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_ANDROID,
      rightPanel: DECORATIVE_ATLAS_PANELS.AD_CYBBCORE_ANDROID,
      leftVertPanel: DECORATIVE_ATLAS_PANELS.VERT_KANJI_NEON,
      rightVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CRT,
    },
    {
      t: 0.275,
      leftPanel: DECORATIVE_ATLAS_PANELS.AD_CYBERNETICS_NOW,
      rightPanel: DECORATIVE_ATLAS_PANELS.AD_GLITCH_GEAR,
      leftVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_WOMAN_FULL,
      rightVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CYBORG,
    },
    {
      t: 0.395,
      leftPanel: DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_LOGO,
      rightPanel: DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_PYRAMID,
      leftVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_WOMAN_TOP,
      rightVertPanel: DECORATIVE_ATLAS_PANELS.VERT_KANJI_NEON,
    },
    {
      t: 0.510,
      leftPanel: DECORATIVE_ATLAS_PANELS.AD_GLITCH_COLA,
      rightPanel: DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_SLASH,
      leftVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CRT,
      rightVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_WOMAN_FULL,
    },
    {
      t: 0.635,
      leftPanel: DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_WIDE,
      rightPanel: DECORATIVE_ATLAS_PANELS.AD_SHIBUYA_DRIFT,
      leftVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CYBORG,
      rightVertPanel: DECORATIVE_ATLAS_PANELS.VERT_KANJI_NEON,
    },
    {
      t: 0.855,
      leftPanel: DECORATIVE_ATLAS_PANELS.AD_CYBBCORE_ANDROID,
      rightPanel: DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_CAN,
      leftVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_WOMAN_TOP,
      rightVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CRT,
    },
    {
      t: 0.945,
      leftPanel: DECORATIVE_ATLAS_PANELS.AD_GLITCH_GEAR,
      rightPanel: DECORATIVE_ATLAS_PANELS.AD_CYBERNETICS_NOW,
      leftVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_WOMAN_FULL,
      rightVertPanel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CYBORG,
    },
  ];

  const gantryPillarSpanX = TRACK_HALF_WIDTH + 3.4;
  const gantryCrossbarY = 12.2;
  const gantryPillarGeo = new THREE.BoxGeometry(1.35, gantryCrossbarY + 3.0, 1.45);
  const gantryBeamGeo = new THREE.BoxGeometry(gantryPillarSpanX * 2 + 2.4, 1.15, 1.35);

  for (let gIdx = 0; gIdx < adGantrySpecs.length; gIdx++) {
    const gSpec = adGantrySpecs[gIdx];
    sampleTrackFrame(spline, gSpec.t, samplePos, sampleFwd, sampleRight, sampleUp);

    const gantryGroup = new THREE.Group();
    gantryGroup.position.copy(samplePos);
    lookTarget.copy(samplePos).add(sampleFwd);
    const gRot = new THREE.Matrix4().lookAt(samplePos, lookTarget, sampleUp);
    gantryGroup.quaternion.setFromRotationMatrix(gRot);

    // Left & Right Armored Gantry Towers outside the track guardrails
    const leftPillar = new THREE.Mesh(gantryPillarGeo, sharedArmourMat);
    leftPillar.position.set(-gantryPillarSpanX, gantryCrossbarY * 0.5 - 1.0, 0);
    const rightPillar = new THREE.Mesh(gantryPillarGeo, sharedArmourMat);
    rightPillar.position.set(gantryPillarSpanX, gantryCrossbarY * 0.5 - 1.0, 0);
    const crossBeam = new THREE.Mesh(gantryBeamGeo, sharedArmourMat);
    crossBeam.position.set(0, gantryCrossbarY, 0);
    gantryGroup.add(leftPillar, rightPillar, crossBeam);

    // Dual Overhead Landscape Animated Ad Screens suspended from the gantry crossbar
    const leftOverheadAd = buildFramedBillboardGroup(gSpec.leftPanel, 4.6, gIdx % 2 === 0, false);
    leftOverheadAd.position.set(-6.4, gantryCrossbarY + 0.3, 0);
    const rightOverheadAd = buildFramedBillboardGroup(gSpec.rightPanel, 4.6, gIdx % 2 !== 0, false);
    rightOverheadAd.position.set(6.4, gantryCrossbarY + 0.3, 0);
    gantryGroup.add(leftOverheadAd, rightOverheadAd);

    // Twin Vertical Animated Portrait Hologram Columns flanking the gantry pillars
    const leftVertAd = buildFramedBillboardGroup(gSpec.leftVertPanel, 9.8, true, false);
    leftVertAd.position.set(-gantryPillarSpanX - 2.6, 6.8, 0);
    leftVertAd.rotation.y = -0.22;
    const rightVertAd = buildFramedBillboardGroup(gSpec.rightVertPanel, 9.8, false, false);
    rightVertAd.position.set(gantryPillarSpanX + 2.6, 6.8, 0);
    rightVertAd.rotation.y = 0.22;
    gantryGroup.add(leftVertAd, rightVertAd);

    worldGroup.add(gantryGroup);
  }

  // 3D. High-Mounted Cantilevered Over-Track Megabillboards with Draping Catenary Power Cables!
  // Recreates the iconic upper-left ("NEO-KOLA" android) and upper-right ("CYBBCORE" android / "NEO-TOKYO MOTORS" CRT)
  // elevated billboards with bundles of hanging power cables from Reference Images 1 & 2!
  const elevatedBillboardSpecs: Array<{
    t: number;
    side: -1 | 1;
    panel: { u0: number; v0: number; u1: number; v1: number; aspect: number };
    height: number;
    elevY: number;
    lateralOffset: number;
    inwardYaw: number;
    downPitch: number;
    magentaTrim: boolean;
  }> = [
    // Starting-grid iconic upper-left & upper-right suspended megabillboards
    {
      t: 0.009,
      side: -1,
      panel: DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_ANDROID,
      height: 8.6,
      elevY: 14.8,
      lateralOffset: TRACK_HALF_WIDTH + 9.2,
      inwardYaw: 0.36,
      downPitch: 0.16,
      magentaTrim: false,
    },
    {
      t: 0.010,
      side: 1,
      panel: DECORATIVE_ATLAS_PANELS.AD_CYBBCORE_ANDROID,
      height: 8.6,
      elevY: 15.2,
      lateralOffset: TRACK_HALF_WIDTH + 9.6,
      inwardYaw: -0.36,
      downPitch: 0.16,
      magentaTrim: true,
    },
    // Right-side tall vertical CRT & cables billboard from Reference Image 2
    {
      t: 0.015,
      side: 1,
      panel: DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CRT,
      height: 15.5,
      elevY: 15.8,
      lateralOffset: TRACK_HALF_WIDTH + 11.4,
      inwardYaw: -0.34,
      downPitch: 0.08,
      magentaTrim: false,
    },
    // Left-side tall vertical Neo-Tokyo Cyborg / Kanji sign
    {
      t: 0.020,
      side: -1,
      panel: DECORATIVE_ATLAS_PANELS.VERT_KANJI_NEON,
      height: 15.0,
      elevY: 15.0,
      lateralOffset: TRACK_HALF_WIDTH + 11.0,
      inwardYaw: 0.32,
      downPitch: 0.08,
      magentaTrim: true,
    },
  ];

  // Add 28 more elevated cantilevered megabillboards with hanging power cables around the extended circuit
  const elevatedPanels = [
    DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_ANDROID,
    DECORATIVE_ATLAS_PANELS.AD_CYBBCORE_ANDROID,
    DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_WIDE,
    DECORATIVE_ATLAS_PANELS.AD_SHIBUYA_DRIFT,
    DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CRT,
    DECORATIVE_ATLAS_PANELS.AD_GLITCH_GEAR,
    DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_CAN,
  ];
  for (let eIdx = 0; eIdx < 28; eIdx++) {
    const t = 0.048 + (eIdx / 28) * 0.91;
    const side: -1 | 1 = eIdx % 2 === 0 ? -1 : 1;
    const panel = elevatedPanels[eIdx % elevatedPanels.length];
    const isVert = panel.aspect < 0.8;
    elevatedBillboardSpecs.push({
      t,
      side,
      panel,
      height: isVert ? 15.0 : 8.4,
      elevY: 14.5 + (eIdx % 3) * 2.2,
      lateralOffset: TRACK_HALF_WIDTH + (isVert ? 11.5 : 10.2),
      inwardYaw: side < 0 ? 0.34 : -0.34,
      downPitch: isVert ? 0.08 : 0.15,
      magentaTrim: eIdx % 2 === 0,
    });
  }

  const nextSamplePos = new THREE.Vector3();
  const nextSampleFwd = new THREE.Vector3();
  const nextSampleRight = new THREE.Vector3();
  const nextSampleUp = new THREE.Vector3();

  for (let i = 0; i < elevatedBillboardSpecs.length; i++) {
    const spec = elevatedBillboardSpecs[i];
    if (spec.t >= 0.700 && spec.t <= 0.815) continue;

    sampleTrackFrame(spline, spec.t, samplePos, sampleFwd, sampleRight, sampleUp);
    const elevWidth = spec.height * spec.panel.aspect;
    const safeLatOffset = Math.max(spec.lateralOffset, TRACK_HALF_WIDTH + elevWidth * 0.52 + 8.5);
    const rawEx = samplePos.x + sampleRight.x * spec.side * safeLatOffset;
    const rawEz = samplePos.z + sampleRight.z * spec.side * safeLatOffset;
    const { x: ex, z: ez } = ensureTrackClearanceXZ(
      rawEx,
      rawEz,
      elevWidth * 0.58,
      trackSamples,
      16.0
    );
    const ey = samplePos.y + spec.elevY;

    const elevGroup = buildFramedBillboardGroup(
      spec.panel,
      spec.height,
      spec.magentaTrim,
      false
    );
    elevGroup.position.set(ex, ey, ez);

    lookTarget
      .copy(elevGroup.position)
      .sub(sampleFwd)
      .addScaledVector(sampleRight, -spec.side * Math.abs(Math.tan(spec.inwardYaw * 0.75)))
      .addScaledVector(sampleUp, -Math.tan(spec.downPitch));
    elevGroup.lookAt(lookTarget);

    // Industrial Steel Cantilever Mast & Cross-Arm anchoring the elevated billboard safely outside all track spans
    const rawMastX = ex + sampleRight.x * spec.side * 5.8;
    const rawMastZ = ez + sampleRight.z * spec.side * 5.8;
    const { x: mastX, z: mastZ } = ensureTrackClearanceXZ(
      rawMastX,
      rawMastZ,
      2.5,
      trackSamples,
      16.0
    );
    const mastH = spec.elevY + 4;
    const mastMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, mastH, 1.45),
      sharedArmourMat
    );
    mastMesh.position.set(mastX, samplePos.y + mastH * 0.5 - 1.5, mastZ);
    worldGroup.add(mastMesh, elevGroup);

    // Drape 4 Heavy Catenary Power Cables strictly outward from the billboard to its support mast & outer building line
    // so cables NEVER cross or sag into the curved track corridor!
    const cableStart = new THREE.Vector3(
      ex + sampleRight.x * spec.side * 1.2,
      ey - spec.height * 0.38,
      ez + sampleRight.z * spec.side * 1.2
    );
    const cableEndMast = new THREE.Vector3(
      mastX + sampleRight.x * spec.side * 1.5,
      samplePos.y + 9.5,
      mastZ + sampleRight.z * spec.side * 1.5
    );
    addCatenaryCableBundle(cableStart, cableEndMast, 4, 2.2, 0.13);

    // Second bundle sweeping outward from the upper billboard corner to the outer building line
    const cableOuterEnd = new THREE.Vector3(
      ex + sampleRight.x * spec.side * 18 - sampleFwd.x * 10,
      ey + 3.5,
      ez + sampleRight.z * spec.side * 18 - sampleFwd.z * 10
    );
    addCatenaryCableBundle(
      new THREE.Vector3(ex, ey + spec.height * 0.35, ez),
      cableOuterEnd,
      3,
      2.4,
      0.12
    );
  }

  // 3E. High-Visibility Solar-Gold Barrier Guide Beams & Distant Trackside Wireframe Globes
  if (isNeon) {
    // Continuous Warm Solar-Gold Laser Guide Beams running above both Left & Right Track Guardrails
    // (Provides an unmistakable warm golden-amber boundary rail against the cool indigo/violet skyline!)
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const laserGlowMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (const railSide of [-1, 1]) {
      const railPts: THREE.Vector3[] = [];
      const railSampleCount = 480;
      for (let s = 0; s < railSampleCount; s++) {
        sampleTrackFrame(spline, s / railSampleCount, samplePos, sampleFwd, sampleRight, sampleUp);
        railPts.push(
          new THREE.Vector3()
            .copy(samplePos)
            .addScaledVector(sampleRight, railSide * (TRACK_HALF_WIDTH + 0.35))
            .addScaledVector(sampleUp, 1.72)
        );
      }
      const railCurve = new THREE.CatmullRomCurve3(railPts, true);
      const laserCoreGeo = new THREE.TubeGeometry(railCurve, 520, 0.085, 5, true);
      const laserHaloGeo = new THREE.TubeGeometry(railCurve, 520, 0.26, 5, true);
      worldGroup.add(
        new THREE.Mesh(laserCoreGeo, laserMat),
        new THREE.Mesh(laserHaloGeo, laserGlowMat)
      );
    }

    // Trackside Floating Wireframe Globes (placed well outside the viaduct at +28m lateral offset)
    const wireGlobeGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(5.2, 14, 10));
    const wireGlobeMat = new THREE.LineBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.48,
    });

    const holoPropTs = [0.015, 0.032, 0.12, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88];
    for (let h = 0; h < holoPropTs.length; h++) {
      const t = holoPropTs[h];
      sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);
      const side = h < 2 ? 1 : h % 2 === 0 ? 1 : -1;
      const gx = samplePos.x + sampleRight.x * side * (TRACK_HALF_WIDTH + 28);
      const gz = samplePos.z + sampleRight.z * side * (TRACK_HALF_WIDTH + 28);

      const globeGrp = new THREE.Group();
      globeGrp.position.set(gx, samplePos.y + 8.5, gz);
      globeGrp.add(new THREE.LineSegments(wireGlobeGeo, wireGlobeMat));
      worldGroup.add(globeGrp);
    }

    // 3F. Ethereal Sky-Projected Cloud Holograms & Building-to-Mid-Air Holographic Projections (`decorative2k_bbaeeaee.jpg`)
    // Renders soft, borderless, translucent additive holograms projected into the clouds and mid-air from building rooftops,
    // with automatic camera-proximity fade and zero light pillars/cones so they are never invasive on the player's racing line view!
    const skyHoloMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAtlasMap: { value: textures.cityDecorativeAtlasMap },
      },
      vertexShader: `
        attribute vec2 aPanelUv;
        varying vec2 vUv;
        varying vec2 vPanelUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vPanelUv = aPanelUv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uAtlasMap;
        varying vec2 vUv;
        varying vec2 vPanelUv;
        varying vec3 vWorldPos;

        void main() {
          float seed = fract(sin(dot(floor(vWorldPos.xz * 0.02), vec2(12.9898, 78.233))) * 43758.5453);
          float scan = 0.78 + 0.22 * sin(vPanelUv.y * 110.0 - uTime * 14.0);
          float drift = 0.0022 * sin(vPanelUv.y * 12.0 + uTime * 3.2 + seed * 6.28);
          vec3 texCol = texture2D(uAtlasMap, vec2(vUv.x + drift, vUv.y)).rgb;

          float luma = dot(texCol, vec3(0.299, 0.587, 0.114));
          float chroma = max(texCol.r, max(texCol.g, texCol.b)) - min(texCol.r, min(texCol.g, texCol.b));
          float holoMask = smoothstep(0.08, 0.42, luma + chroma * 0.55);

          float featherX = smoothstep(0.0, 0.12, vPanelUv.x) * smoothstep(0.0, 0.12, 1.0 - vPanelUv.x);
          float featherY = smoothstep(0.0, 0.14, vPanelUv.y) * smoothstep(0.0, 0.14, 1.0 - vPanelUv.y);
          float edgeSoft = featherX * featherY;

          vec3 holoTint = mix(texCol, vec3(0.38, 0.68, 1.0) * (luma + 0.25), 0.32);
          float flicker = 0.88 + 0.12 * sin(uTime * 5.0 + seed * 12.0);

          float camDist = length(cameraPosition - vWorldPos);
          float proxGuard = smoothstep(45.0, 95.0, camDist);

          float alpha = holoMask * edgeSoft * scan * flicker * proxGuard * 0.38;
          gl_FragColor = vec4(holoTint * 0.95, clamp(alpha, 0.0, 0.42));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    animatedShaders.push(skyHoloMat);

    // 1) 14 Colossal Sky / Cloud-Layer Projected Holograms across all 4 sectors
    const cloudHoloPanels = [
      DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_ANDROID,
      DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_WIDE,
      DECORATIVE_ATLAS_PANELS.AD_CYBBCORE_ANDROID,
      DECORATIVE_ATLAS_PANELS.AD_SHIBUYA_DRIFT,
      DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_PYRAMID,
      DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_CAN,
      DECORATIVE_ATLAS_PANELS.AD_GLITCH_GEAR,
      DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_LOGO,
    ];
    for (let cIdx = 0; cIdx < 14; cIdx++) {
      const t = (0.035 + cIdx * 0.068) % 1;
      sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);
      const side = cIdx % 2 === 0 ? -1 : 1;
      const lateralDist = 145 + (cIdx % 3) * 28;
      const hx = samplePos.x + sampleRight.x * side * lateralDist;
      const hz = samplePos.z + sampleRight.z * side * lateralDist;
      const hy = samplePos.y + 122 + (cIdx % 3) * 22;

      const panel = cloudHoloPanels[cIdx % cloudHoloPanels.length];
      const holoH = 44 + (cIdx % 2) * 10;
      const holoW = holoH * panel.aspect;
      const holoGeo = createAtlasPanelGeometry(holoW, holoH, panel.u0, panel.v0, panel.u1, panel.v1);
      const cloudHoloMesh = new THREE.Mesh(holoGeo, skyHoloMat);
      cloudHoloMesh.position.set(hx, hy, hz);

      lookTarget
        .copy(samplePos)
        .addScaledVector(sampleFwd, -35)
        .addScaledVector(sampleUp, 18);
      cloudHoloMesh.lookAt(lookTarget);
      worldGroup.add(cloudHoloMesh);
    }

    // 2) 20 Building-to-Mid-Air Holographic Projections floating high above/beside the circuit
    const midAirHoloPanels = [
      DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_CYBORG,
      DECORATIVE_ATLAS_PANELS.AD_CYBERNETICS_NOW,
      DECORATIVE_ATLAS_PANELS.VERT_KANJI_NEON,
      DECORATIVE_ATLAS_PANELS.AD_GLITCH_COLA,
      DECORATIVE_ATLAS_PANELS.AD_SHIBUYA_DRIFT,
      DECORATIVE_ATLAS_PANELS.VERT_NEO_TOKYO_WOMAN_TOP,
      DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_ANDROID,
      DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_SLASH,
    ];
    for (let mIdx = 0; mIdx < 20; mIdx++) {
      const t = (0.020 + mIdx * 0.048) % 1;
      sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);
      const side = mIdx % 2 === 0 ? 1 : -1;
      const panel = midAirHoloPanels[mIdx % midAirHoloPanels.length];
      const isVert = panel.aspect < 0.8;

      const airLateral = TRACK_HALF_WIDTH + 26 + (mIdx % 3) * 6;
      const ax = samplePos.x + sampleRight.x * side * airLateral;
      const az = samplePos.z + sampleRight.z * side * airLateral;
      const ay = samplePos.y + 34 + (mIdx % 3) * 6;

      const airH = isVert ? 24 : 13.5;
      const airW = airH * panel.aspect;
      const airGeo = createAtlasPanelGeometry(airW, airH, panel.u0, panel.v0, panel.u1, panel.v1);
      const airHoloMesh = new THREE.Mesh(airGeo, skyHoloMat);
      airHoloMesh.position.set(ax, ay, az);

      lookTarget
        .copy(airHoloMesh.position)
        .sub(sampleFwd)
        .addScaledVector(sampleRight, -side * 0.35)
        .addScaledVector(sampleUp, -0.18);
      airHoloMesh.lookAt(lookTarget);
      worldGroup.add(airHoloMesh);
    }
  }

  // 4. Elevated Distant Cyber-Skybridges
  const bridgeGeo = new THREE.BoxGeometry(2.4, 2.6, 68);
  const bridgeMat = sharedArmourMat;

  for (let i = 0; i < 24; i++) {
    const t = ((i * 0.041) + 0.03) % 1;
    sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);
    const side = i % 2 === 0 ? 1 : -1;
    const rawBrX = samplePos.x + sampleRight.x * side * 105;
    const rawBrZ = samplePos.z + sampleRight.z * side * 105;
    const { x: brX, z: brZ } = ensureTrackClearanceXZ(rawBrX, rawBrZ, 36, trackSamples, 38);

    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(brX, 8 + (i % 4) * 16, brZ);
    bridgeGroup.rotation.y = Math.atan2(sampleFwd.x, sampleFwd.z) + (i % 3 === 0 ? Math.PI / 4 : 0);
    bridgeGroup.add(new THREE.Mesh(bridgeGeo, bridgeMat));
    worldGroup.add(bridgeGroup);
  }

  // 4b. THREE SIGNATURE ARCHITECTURAL SET-PIECES ON EXTENDED CIRCUIT:
  // (1) SET-PIECE 1: Skyscraper Core Tunnel (t = 0.706 .. 0.752) — Colossal megatower straddling the track with vaulted neon ribs
  // (2) SET-PIECE 2: Twin-Tower Glass-Walled Sky-Corridor (t = 0.756 .. 0.792) — High-rise towers flanking the track with overhead skybridges
  // (3) SET-PIECE 3: Elevated Skybridge Overpass Plaza & Holographic Wall (t = 0.796 .. 0.824 at (450, 48, -260)) — Straddle suspension trusses & triple billboard wall
  {
    const setPieceRotMat = new THREE.Matrix4();

    // --- SET-PIECE 1: SKYSCRAPER CORE TUNNEL (t = 0.706 .. 0.752) ---
    // Built from spline-following segmented portal bastions & overhead megatower blocks so it follows
    // the curve with 100% roadway & ceiling clearance (never cutting across the curved road)!
    const ribPillarGeo = new THREE.BoxGeometry(2.6, 17.5, 3.4);
    const ribCeilingGeo = new THREE.BoxGeometry((TRACK_HALF_WIDTH + 8.5) * 2, 3.2, 3.8);
    const ribNeonStripGeo = new THREE.BoxGeometry((TRACK_HALF_WIDTH + 6.5) * 2, 0.65, 1.2);
    for (let r = 0; r < 10; r++) {
      const rt = 0.706 + (r / 9) * 0.046;
      sampleTrackFrame(spline, rt, samplePos, sampleFwd, sampleRight, sampleUp);
      const ribGrp = new THREE.Group();
      ribGrp.position.copy(samplePos);
      lookTarget.copy(samplePos).add(sampleFwd);
      setPieceRotMat.lookAt(samplePos, lookTarget, sampleUp);
      ribGrp.quaternion.setFromRotationMatrix(setPieceRotMat);

      const ribMat = r % 2 === 0 ? sharedCyanBarrierMat : sharedMagentaRailMat;
      for (const side of [-1, 1]) {
        const pil = new THREE.Mesh(ribPillarGeo, sharedArmourMat);
        pil.position.set(side * (TRACK_HALF_WIDTH + 7.2), 8.2, 0);
        const innerGlow = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 15.5, 1.4),
          ribMat
        );
        innerGlow.position.set(side * (TRACK_HALF_WIDTH + 5.7), 8.2, 0);
        ribGrp.add(pil, innerGlow);

        // Segmented Megatower Support Bastions flanking the curved tunnel well outside all track decks
        if (r % 2 === 0) {
          const rawBastionX = samplePos.x + sampleRight.x * side * (TRACK_HALF_WIDTH + 46);
          const rawBastionZ = samplePos.z + sampleRight.z * side * (TRACK_HALF_WIDTH + 46);
          const safeBastion = ensureTrackClearanceXZ(
            rawBastionX,
            rawBastionZ,
            26,
            trackSamples,
            40
          );
          const bastion = new THREE.Mesh(towerGeo, cyberBuildingShaderMat);
          bastion.position.set(safeBastion.x, -66, safeBastion.z);
          bastion.rotation.y = Math.atan2(sampleFwd.x, sampleFwd.z);
          bastion.scale.set(28, 108, 18);
          worldGroup.add(bastion);
        }
      }
      const ceilBeam = new THREE.Mesh(ribCeilingGeo, sharedArmourMat);
      ceilBeam.position.set(0, 18.2, 0);
      const ceilNeon = new THREE.Mesh(ribNeonStripGeo, ribMat);
      ceilNeon.position.set(0, 16.3, 0);
      ribGrp.add(ceilBeam, ceilNeon);

      // Note: Do not attach a wide 84m tower directly to the banked ribGrp, as banking tilts tall meshes across neighboring curves.

      // Entrance & Exit Corporate Portal Signs mounted high above the portal archways
      if (r === 0) {
        const tunnelEntrySign = buildFramedBillboardGroup(
          DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_WIDE,
          12,
          false,
          false
        );
        tunnelEntrySign.position.set(0, 27.5, -2.0);
        tunnelEntrySign.rotation.y = Math.PI;
        ribGrp.add(tunnelEntrySign);
      } else if (r === 9) {
        const tunnelExitSign = buildFramedBillboardGroup(
          DECORATIVE_ATLAS_PANELS.AD_CYBERDYNE_PYRAMID,
          12,
          true,
          false
        );
        tunnelExitSign.position.set(0, 27.5, 2.0);
        ribGrp.add(tunnelExitSign);
      }

      worldGroup.add(ribGrp);
    }

    // --- SET-PIECE 2: TWIN-TOWER GLASS-WALLED SKY-CORRIDOR (t = 0.754 .. 0.780) ---
    const glassWallGeo = new THREE.BoxGeometry(0.65, 9.5, 11.5);
    const glassWallMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color(isNeon ? 0x0284c7 : 0x000000),
      emissiveIntensity: isNeon ? 0.45 : 0,
      transparent: true,
      opacity: 0.34,
      roughness: 0.12,
      metalness: 0.85,
    });
    for (let c = 0; c < 6; c++) {
      const ct = 0.754 + (c / 5) * 0.026;
      sampleTrackFrame(spline, ct, samplePos, sampleFwd, sampleRight, sampleUp);
      const corrGrp = new THREE.Group();
      corrGrp.position.copy(samplePos);
      lookTarget.copy(samplePos).add(sampleFwd);
      setPieceRotMat.lookAt(samplePos, lookTarget, sampleUp);
      corrGrp.quaternion.setFromRotationMatrix(setPieceRotMat);

      for (const side of [-1, 1]) {
        // Flanking High-Rise Curtain-Wall Towers rising beside the corridor with full lower-underpass clearance
        if (c % 2 === 0) {
          const rawTwinX = samplePos.x + sampleRight.x * side * (TRACK_HALF_WIDTH + 52);
          const rawTwinZ = samplePos.z + sampleRight.z * side * (TRACK_HALF_WIDTH + 52);
          const safeTwin = ensureTrackClearanceXZ(
            rawTwinX,
            rawTwinZ,
            28,
            trackSamples,
            40
          );
          const twinTower = new THREE.Mesh(towerGeo, cyberBuildingShaderMat);
          twinTower.position.set(safeTwin.x, -66, safeTwin.z);
          twinTower.rotation.y = Math.atan2(sampleFwd.x, sampleFwd.z);
          twinTower.scale.set(28, 210, 28);
          worldGroup.add(twinTower);
        }
        // Translucent Cyber-Glass Corridor Side Walls safely outside the guardrails & viaduct apron
        const glassPanel = new THREE.Mesh(glassWallGeo, glassWallMat);
        glassPanel.position.set(side * (TRACK_HALF_WIDTH + 6.4), 5.2, 0);
        const topRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.65, 11.8),
          c % 2 === 0 ? sharedCyanBarrierMat : sharedMagentaRailMat
        );
        topRail.position.set(side * (TRACK_HALF_WIDTH + 6.4), 10.1, 0);
        corrGrp.add(glassPanel, topRail);
      }

      // Overhead Glass & Neon Skybridge connecting the Twin Towers across the track
      const skyWalk = new THREE.Mesh(
        new THREE.BoxGeometry((TRACK_HALF_WIDTH + 26) * 2, 3.2, 8.5),
        sharedCorridorMat
      );
      skyWalk.position.set(0, 21.0, 0);
      corrGrp.add(skyWalk);
      worldGroup.add(corrGrp);
    }

    // --- SET-PIECE 3: ELEVATED SKYBRIDGE OVERPASS & PANORAMIC HOLOGRAPHIC WALL (t = 0.785 .. 0.803) ---
    // Crosses at y = 48m directly over Sector 1's Underpass (y = 18m) at (450, -260).
    // Uses upper-deck-mounted portal arch pillars (bottom at y = -0.5 on the upper viaduct apron) so zero columns ever drop into the lower Sector 1 Underpass!
    const overpassTrussTs = [0.785, 0.794, 0.803];
    const archTowerGeo = new THREE.BoxGeometry(2.8, 29.0, 3.6);
    const archCrossGeo = new THREE.BoxGeometry((TRACK_HALF_WIDTH + 5.2) * 2, 3.4, 4.2);
    for (let oIdx = 0; oIdx < overpassTrussTs.length; oIdx++) {
      sampleTrackFrame(spline, overpassTrussTs[oIdx], samplePos, sampleFwd, sampleRight, sampleUp);
      const ovGrp = new THREE.Group();
      ovGrp.position.copy(samplePos);
      lookTarget.copy(samplePos).add(sampleFwd);
      setPieceRotMat.lookAt(samplePos, lookTarget, sampleUp);
      ovGrp.quaternion.setFromRotationMatrix(setPieceRotMat);

      for (const side of [-1, 1]) {
        const tower = new THREE.Mesh(archTowerGeo, sharedArmourMat);
        tower.position.set(side * (TRACK_HALF_WIDTH + 4.2), 14.0, 0);
        ovGrp.add(tower);
      }
      const topArch = new THREE.Mesh(archCrossGeo, sharedArmourMat);
      topArch.position.set(0, 28, 0);
      const topArchNeon = new THREE.Mesh(
        new THREE.BoxGeometry((TRACK_HALF_WIDTH + 4.8) * 2, 0.85, 4.6),
        oIdx === 1 ? sharedMagentaRailMat : sharedCyanBarrierMat
      );
      topArchNeon.position.set(0, 25.8, 0);
      ovGrp.add(topArch, topArchNeon);

      // Giant Panoramic Billboard Wall running alongside the Skybridge Overpass safely outside the upper guardrail
      const wallPanel =
        oIdx === 0
          ? DECORATIVE_ATLAS_PANELS.AD_SHIBUYA_DRIFT
          : oIdx === 1
          ? DECORATIVE_ATLAS_PANELS.AD_NEO_KOLA_ANDROID
          : DECORATIVE_ATLAS_PANELS.AD_NEO_TOKYO_MOTORS_WIDE;
      const panoSign = buildFramedBillboardGroup(wallPanel, 12.0, oIdx % 2 === 0, false);
      panoSign.position.set(-(TRACK_HALF_WIDTH + 10.5), 12.5, 0);
      panoSign.rotation.y = Math.PI * 0.42;
      ovGrp.add(panoSign);

      worldGroup.add(ovGrp);
    }
  }

  // 4c. 26 High-Clearance Overhead Armored Cyber-Gantry Portals framing the track corridor
  if (isCityV2) {
    const gantryPillarGeo = new THREE.BoxGeometry(1.95, 18.5, 2.4);
    const gantryCrossbeamGeo = new THREE.BoxGeometry(2 * (TRACK_HALF_WIDTH + 4.8), 2.2, 2.8);
    const gantryLightBarGeo = new THREE.BoxGeometry(2 * (TRACK_HALF_WIDTH + 4.2), 0.55, 3.0);
    const gantryGoldMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const gantryRotMat = new THREE.Matrix4();

    for (let g = 0; g < 26; g++) {
      const t = ((g + 0.45) / 26) % 1;
      // Skip placing standard gantries inside the Skyscraper Core Tunnel & Skybridge Overpass (t = 0.70..0.82)
      if (t >= 0.70 && t <= 0.82) continue;
      sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);
      const gantryGroup = new THREE.Group();
      gantryGroup.position.copy(samplePos);
      lookTarget.copy(samplePos).add(sampleFwd);
      gantryRotMat.lookAt(samplePos, lookTarget, sampleUp);
      gantryGroup.quaternion.setFromRotationMatrix(gantryRotMat);

      const pillarOffset = TRACK_HALF_WIDTH + 3.6;
      const leftPillar = new THREE.Mesh(gantryPillarGeo, sharedArmourMat);
      leftPillar.position.set(-pillarOffset, 8.2, 0);
      const rightPillar = new THREE.Mesh(gantryPillarGeo, sharedArmourMat);
      rightPillar.position.set(pillarOffset, 8.2, 0);

      const topCrossbeam = new THREE.Mesh(gantryCrossbeamGeo, sharedArmourMat);
      topCrossbeam.position.set(0, 17.6, 0);

      const lowerTrimBar = new THREE.Mesh(gantryLightBarGeo, gantryGoldMat);
      lowerTrimBar.position.set(0, 16.3, 0);

      gantryGroup.add(leftPillar, rightPillar, topCrossbeam, lowerTrimBar);
      worldGroup.add(gantryGroup);
    }
  }

  // 5. Animated Multi-Altitude Aerial Skyway Traffic Streams (260 Flying Cyber-Cruisers across the Extended Metropolis)
  const trafficCount = 260;
  const trafficGeo = new THREE.BoxGeometry(0.65, 0.38, 1.0);
  const trafficMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
  const trafficInstanced = new THREE.InstancedMesh(trafficGeo, trafficMat, trafficCount);
  trafficInstanced.frustumCulled = false;

  const trafficItems: AerialTrafficSystem['items'] = [];
  const trafficColor = new THREE.Color();

  for (let i = 0; i < trafficCount; i++) {
    const laneIdx = i % 6;
    const dir = laneIdx % 2 === 0 ? 1 : -1;
    const isEastLoop = i % 2 === 1;
    const radiusX = (isEastLoop ? 380 : 240) + laneIdx * 55 + ((i * 17) % 35);
    const radiusZ = (isEastLoop ? 320 : 280) + laneIdx * 60 + ((i * 23) % 40);
    const y = -28 + laneIdx * 18 + ((i * 11) % 14);
    const speed = (0.14 + (laneIdx % 3) * 0.05) * (0.85 + ((i * 7) % 5) * 0.08);
    const phase = (i / trafficCount) * Math.PI * 2;
    const length = 5.5 + (i % 4) * 2.2;

    trafficItems.push({
      cx: isEastLoop ? 980 : 185,
      cz: isEastLoop ? -210 : -115,
      radiusX,
      radiusZ,
      y,
      speed,
      phase,
      dir,
      length,
    });

    // Cyan/Ice-White head-cruisers in one direction, Neon Magenta/Amber tail-cruisers in opposite lanes
    if (isNeon) {
      trafficColor.setHex(
        dir > 0
          ? i % 3 === 0
            ? 0xe0f2fe
            : 0x00f2fe
          : i % 3 === 0
          ? 0xfbbf24
          : 0xff2a85
      );
    } else {
      trafficColor.setHex(dir > 0 ? 0x38bdf8 : 0xf43f5e);
    }
    trafficInstanced.setColorAt(i, trafficColor);
  }
  if (trafficInstanced.instanceColor) {
    trafficInstanced.instanceColor.needsUpdate = true;
  }
  worldGroup.add(trafficInstanced);

  return {
    mesh: trafficInstanced,
    items: trafficItems,
  };
}

/**
 * Custom GLSL Lava Shader Material based on Three.js `webgl_shader_lava` by TheGameMaker.
 * Uses dual-advection UV turbulence (`T1`, `T2`) driven by 4-channel RGBA cloud noise (`texture1`: lavaCloudMap)
 * and the volcanic lava texture (`texture2`: 03_glowing_lava.png), cross-channel HDR color bleed
 * (`if(temp.r > 1.0)...`), controlled HDR peak clamping for UnrealBloomPass, and `exp2` depth fog.
 */
function createTheGameMakerLavaShaderMaterial(
  textures: TrackTextureSet,
  uvScale: THREE.Vector2,
  timeScale = 1.35,
  fogDensity = 0.00085,
  fogColor = new THREE.Color(0x050204),
  hdrCap = 1.38,
  doubleSided = true,
  flowDir = new THREE.Vector2(1.0, 0.0),
  displacementAmp = 0.42
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTimeScale: { value: timeScale },
      uHdrCap: { value: hdrCap },
      uFlowDir: { value: flowDir },
      uDisplacementAmp: { value: displacementAmp },
      uEnableDisplacement: { value: 1.0 },
      fogDensity: { value: fogDensity },
      fogColor: { value: fogColor },
      texture1: { value: textures.lavaCloudMap },
      texture2: { value: textures.glowingLavaMap },
      uBasaltAlbedo: { value: textures.volcanicBasaltAlbedoMap },
      uBasaltLavaMask: { value: textures.volcanicBasaltLavaMaskMap },
      uvScale: { value: uvScale },
    },
    vertexShader: `
      uniform vec2 uvScale;
      uniform float uTime;
      uniform float uTimeScale;
      uniform vec2 uFlowDir;
      uniform float uDisplacementAmp;
      uniform float uEnableDisplacement;
      uniform sampler2D texture1;
      varying vec2 vUv;
      varying vec2 vRawUv;
      varying float vWaveCrest;
      varying vec3 vViewDir;
      varying vec3 vPerturbedNormal;

      void main() {
        vRawUv = uv;
        vUv = uvScale * uv;
        float time = uTime * uTimeScale;

        // Parabolic viscous channel envelope: calmer near rock banks, undulating liquid swells in the channel core
        float crossChannel = abs(uv.y - 0.5) * 2.0;
        float bankEnvelope = clamp(1.0 - 0.55 * crossChannel * crossChannel, 0.18, 1.0);

        // Sample procedural cloud noise texture in vertex shader for organic convective magma domes
        vec2 noiseUv = vUv * 0.28 - uFlowDir * (time * 0.12);
        vec4 vNoise = texture2D(texture1, noiseUv);

        // Multi-layered travelling harmonic fluid waves + convective magma surges
        float phaseX = vUv.x * 3.8 - uFlowDir.x * time * 2.6;
        float phaseY = vUv.y * 5.2 - uFlowDir.y * time * 2.2;
        float swell1 = sin(phaseX + vNoise.r * 3.2) * cos(phaseY * 0.85 + time * 1.4);
        float swell2 = sin(phaseX * 2.15 - time * 3.4 + vNoise.g * 2.4) * 0.45;
        float convectiveBubble = (vNoise.a - 0.48) * 1.35 * sin(time * 2.1 + (uv.x + uv.y) * 14.0);

        float dispAmp = uDisplacementAmp * uEnableDisplacement;
        float combinedWave = (swell1 * 0.55 + swell2 * 0.30 + convectiveBubble * 0.35) * bankEnvelope * uEnableDisplacement;
        vWaveCrest = clamp(combinedWave * 0.65 + 0.5, 0.0, 1.0);

        // Analytical wave gradient to perturb surface normal for liquid specular/incandescent crest response
        float dWaveDx = cos(phaseX + vNoise.r * 3.2) * 0.42 + cos(phaseX * 2.15 - time * 3.4) * 0.32;
        float dWaveDy = -sin(phaseY * 0.85 + time * 1.4) * 0.36;

        vec3 localPos = position + normal * (combinedWave * uDisplacementAmp);
        // Subtle tangential peristaltic surge along the flow vector
        localPos.xz += uFlowDir * (swell1 * dispAmp * 0.22 * bankEnvelope);

        vec4 localP = vec4(localPos, 1.0);
        vec3 localN = normalize(normal + vec3(-dWaveDx * dispAmp, 0.0, -dWaveDy * dispAmp));
        #ifdef USE_INSTANCING
          localP = instanceMatrix * localP;
          localN = mat3(instanceMatrix) * localN;
        #endif

        vec4 worldPos = modelMatrix * localP;
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        vPerturbedNormal = normalize(mat3(modelMatrix) * localN);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uTimeScale;
      uniform float uHdrCap;
      uniform vec2 uFlowDir;
      uniform float uEnableDisplacement;
      uniform float fogDensity;
      uniform vec3 fogColor;
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D uBasaltAlbedo;
      uniform sampler2D uBasaltLavaMask;

      varying vec2 vUv;
      varying vec2 vRawUv;
      varying float vWaveCrest;
      varying vec3 vViewDir;
      varying vec3 vPerturbedNormal;

      void main( void ) {
        float time = uTime * uTimeScale;

        // Parabolic viscous channel flow profile: faster in the center of the channel, slower & crustier near banks
        float crossChannel = abs(vRawUv.y - 0.5) * 2.0;
        float channelProfile = 1.0 - 0.42 * crossChannel * crossChannel;

        // High-frequency refractive thermal heat-distortion shimmer across undulating magma waves
        vec2 heatDistort = vec2(
          sin(vUv.y * 22.0 + time * 4.8 + vWaveCrest * 3.5) + cos(vUv.x * 16.0 - time * 3.6) * 0.5,
          cos(vUv.x * 20.0 - time * 4.2 + vWaveCrest * 3.0) + sin(vUv.y * 14.0 + time * 3.9) * 0.5
        ) * (0.014 + 0.012 * vWaveCrest) * uEnableDisplacement;

        vec2 advectedUv = vUv - uFlowDir * (time * 0.18 * channelProfile) + heatDistort;

        vec4 noise = texture2D( texture1, advectedUv );
        vec2 T1 = advectedUv + vec2( 1.5, - 1.5 ) * time * 0.024 - uFlowDir * time * 0.08 + heatDistort * 1.4;
        vec2 T2 = advectedUv + vec2( - 0.5, 2.0 ) * time * 0.014 - uFlowDir * time * 0.14 - heatDistort * 0.9;

        T1.x += noise.x * 2.15;
        T1.y += noise.y * 2.15;
        T2.x -= noise.y * 0.28;
        T2.y += noise.z * 0.28;

        float p = texture2D( texture1, T1 * 2.0 ).a;
        vec4 color = texture2D( texture2, T2 * 2.0 );
        vec4 temp = color * ( vec4( p, p, p, p ) * 2.15 ) + ( color * color - 0.08 );

        if( temp.r > 1.0 ) { temp.bg += clamp( temp.r - 1.85, 0.0, 100.0 ); }
        if( temp.g > 1.0 ) { temp.rb += temp.g - 1.0; }
        if( temp.b > 1.0 ) { temp.rg += temp.b - 1.0; }

        // Drifting dark charcoal-obsidian cooling crust islands floating on the moving magma stream
        vec3 crustTex = texture2D( uBasaltAlbedo, advectedUv * 0.65 ).rgb * 0.10;
        float crustMask = texture2D( uBasaltLavaMask, T2 * 0.85 ).r;
        float bankCrust = smoothstep(0.58, 0.94, crossChannel) * (1.0 - smoothstep(0.35, 0.75, p));
        float floatingRafts = smoothstep(0.52, 0.82, (1.0 - p) * (1.0 - crustMask * 0.65));

        vec3 moltenCore = clamp( temp.rgb, vec3( 0.0 ), vec3( uHdrCap ) );
        // Enrich thermal blackbody gradient boosted at undulating wave crests
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vPerturbedNormal), normalize(vViewDir))), 2.2);
        float heat = dot(moltenCore, vec3(0.38, 0.48, 0.14)) + (vWaveCrest - 0.45) * 0.26 + fresnel * 0.16;
        vec3 blackbody = mix(
          vec3(0.68, 0.08, 0.01),
          mix(vec3(1.05, 0.34, 0.02), vec3(1.38, 1.14, 0.52), smoothstep(0.44, 0.98, heat)),
          smoothstep(0.14, 0.78, heat)
        );
        vec3 activeLava = mix(moltenCore, blackbody, 0.56);
        vec3 finalRgb = mix(activeLava, crustTex, clamp(floatingRafts * 0.65 + bankCrust * 0.74, 0.0, 0.88));

        gl_FragColor = vec4( clamp(finalRgb, vec3(0.0), vec3(uHdrCap)), 1.0 );

        float depth = gl_FragCoord.z / gl_FragCoord.w;
        const float LOG2 = 1.442695;
        float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
        fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );

        gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );
      }
    `,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    fog: false,
  });
}

/**
 * Studio-Grade GLSL Volcanic Basalt Cordillera, Active Volcano & Animated Fluid Lava Flow Shader
 * Combines the 8 2048x2048 Volcanic Basalt PBR maps (`volcanic_basalt_albedo`, `normal`, `roughness`,
 * `height`, `ao`, `metallic`, `emissive`, `lava_mask`) with dark obsidian/charcoal basalt rock,
 * sharply defined domain-warped dendritic downhill lava rivers, heat-shimmer distortion, and atmospheric depth.
 */
function createVolcanicTerrainShaderMaterial(
  textures: TrackTextureSet,
  isNeon: boolean,
  hasSummitCrater: boolean,
  craterHeight: number,
  fissureDensity = 1.0,
  isLavaV2 = true
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIsNeon: { value: isNeon ? 1.0 : 0.0 },
      uUseBasaltPbr: { value: isLavaV2 ? 1.0 : 0.9 },
      uHasCrater: { value: hasSummitCrater ? 1.0 : 0.0 },
      uCraterHeight: { value: craterHeight },
      uFissureDensity: { value: fissureDensity },
      uObsidianTex: { value: textures.obsidianRockMap },
      uCloudTex: { value: textures.lavaCloudMap },
      uLavaTex: { value: textures.glowingLavaMap },
      uGravelTex: { value: textures.volcanicGravelMap },
      // 8 Volcanic Basalt PBR Maps
      uBasaltAlbedo: { value: textures.volcanicBasaltAlbedoMap },
      uBasaltNormal: { value: textures.volcanicBasaltNormalMap },
      uBasaltRoughness: { value: textures.volcanicBasaltRoughnessMap },
      uBasaltHeight: { value: textures.volcanicBasaltHeightMap },
      uBasaltAo: { value: textures.volcanicBasaltAoMap },
      uBasaltMetallic: { value: textures.volcanicBasaltMetallicMap },
      uBasaltEmissive: { value: textures.volcanicBasaltEmissiveMap },
      uBasaltLavaMask: { value: textures.volcanicBasaltLavaMaskMap },
    },
    vertexShader: `
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;
      void main() {
        vLocalPos = position;
        vUv = uv;
        vec4 localP = vec4(position, 1.0);
        vec3 localN = normal;
        #ifdef USE_INSTANCING
          localP = instanceMatrix * localP;
          localN = mat3(instanceMatrix) * localN;
        #endif
        vec4 wp = modelMatrix * localP;
        vWorldPos = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * localN);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIsNeon;
      uniform float uUseBasaltPbr;
      uniform float uHasCrater;
      uniform float uCraterHeight;
      uniform float uFissureDensity;
      uniform sampler2D uObsidianTex;
      uniform sampler2D uCloudTex;
      uniform sampler2D uLavaTex;
      uniform sampler2D uGravelTex;
      uniform sampler2D uBasaltAlbedo;
      uniform sampler2D uBasaltNormal;
      uniform sampler2D uBasaltRoughness;
      uniform sampler2D uBasaltHeight;
      uniform sampler2D uBasaltAo;
      uniform sampler2D uBasaltMetallic;
      uniform sampler2D uBasaltEmissive;
      uniform sampler2D uBasaltLavaMask;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
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
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          v += amp * noise(p);
          p *= 2.12;
          amp *= 0.5;
        }
        return v;
      }

      float ridged(vec2 p) {
        float v = 0.0;
        float amp = 0.55;
        for (int i = 0; i < 4; i++) {
          float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
          v += amp * n * n;
          p *= 2.18;
          amp *= 0.5;
        }
        return v;
      }

      // Advected Fluid Magma Evaluator with Downhill Flow Vector & Refractive Heat Shimmer
      vec3 sampleFluidSlopeLava(vec2 flowUv, float time) {
        vec2 shimmer = vec2(
          sin(flowUv.y * 18.0 + time * 4.2),
          cos(flowUv.x * 16.0 - time * 3.8)
        ) * 0.015;
        vec2 warpedUv = flowUv + shimmer;
        vec4 n = texture2D(uCloudTex, warpedUv);
        vec2 T1 = warpedUv + vec2(0.6, 1.85) * time * 0.032;
        vec2 T2 = warpedUv + vec2(-0.4, 2.65) * time * 0.022;
        T1.x += n.x * 1.85;
        T1.y += n.y * 2.15;
        T2.x -= n.y * 0.26;
        T2.y += n.z * 0.32;
        float p = texture2D(uCloudTex, T1 * 1.85).a;
        vec4 color = texture2D(uLavaTex, T2 * 1.85);
        vec4 temp = color * (vec4(p, p, p, p) * 2.15) + (color * color - 0.08);
        if (temp.r > 1.0) { temp.bg += clamp(temp.r - 1.85, 0.0, 100.0); }
        if (temp.g > 1.0) { temp.rb += temp.g - 1.0; }
        if (temp.b > 1.0) { temp.rg += temp.b - 1.0; }
        return clamp(temp.rgb, vec3(0.0), vec3(1.38));
      }

      // Tri-planar sampling helper for massive 3D volcanic massifs and cliffs
      vec3 sampleTriplanarRGB(sampler2D tex, vec3 wPos, vec3 blend, float scale) {
        vec3 cx = texture2D(tex, wPos.zy * scale).rgb;
        vec3 cy = texture2D(tex, wPos.xz * scale).rgb;
        vec3 cz = texture2D(tex, wPos.xy * scale).rgb;
        return cx * blend.x + cy * blend.y + cz * blend.z;
      }

      float sampleTriplanarR(sampler2D tex, vec3 wPos, vec3 blend, float scale) {
        float cx = texture2D(tex, wPos.zy * scale).r;
        float cy = texture2D(tex, wPos.xz * scale).r;
        float cz = texture2D(tex, wPos.xy * scale).r;
        return cx * blend.x + cy * blend.y + cz * blend.z;
      }

      void main() {
        vec2 worldUv = vWorldPos.xz * 0.018;
        vec2 detailCoord = worldUv * 4.2 + vec2(vWorldPos.y * 0.018);

        vec3 triBlend = abs(vNormal);
        triBlend = pow(max(triBlend, 0.0001), vec3(4.0));
        triBlend /= (triBlend.x + triBlend.y + triBlend.z);

        // Multi-scale sampling of the 8 Volcanic Basalt 2048x2048 PBR maps (macro + micro detail)
        float pbrScale = 0.018;
        float microScale = 0.052;
        vec3 basaltAlbedo = mix(
          sampleTriplanarRGB(uBasaltAlbedo, vWorldPos, triBlend, pbrScale),
          sampleTriplanarRGB(uBasaltAlbedo, vWorldPos, triBlend, microScale),
          0.35
        );
        vec3 basaltNormalRaw = mix(
          sampleTriplanarRGB(uBasaltNormal, vWorldPos, triBlend, pbrScale),
          sampleTriplanarRGB(uBasaltNormal, vWorldPos, triBlend, microScale),
          0.42
        ) * 2.0 - 1.0;
        float basaltRoughness = sampleTriplanarR(uBasaltRoughness, vWorldPos, triBlend, pbrScale);
        float basaltHeight = sampleTriplanarR(uBasaltHeight, vWorldPos, triBlend, pbrScale);
        float basaltAo = sampleTriplanarR(uBasaltAo, vWorldPos, triBlend, pbrScale);
        float basaltMetallic = sampleTriplanarR(uBasaltMetallic, vWorldPos, triBlend, pbrScale);
        vec3 basaltEmissive = sampleTriplanarRGB(uBasaltEmissive, vWorldPos, triBlend, pbrScale);
        float basaltLavaMask = sampleTriplanarR(uBasaltLavaMask, vWorldPos, triBlend, pbrScale);

        // Desaturate any warm tint in the raw rock textures so the base mountain is deep charcoal/obsidian basalt
        vec3 obsidianTexCol = sampleTriplanarRGB(uObsidianTex, vWorldPos, triBlend, 0.028);
        vec3 rawRock = mix(obsidianTexCol, basaltAlbedo, uUseBasaltPbr * 0.82);
        float rockLuma = dot(rawRock, vec3(0.299, 0.587, 0.114));
        vec3 neutralBasalt = mix(vec3(rockLuma), rawRock, 0.32);
        vec3 gravelTexCol = texture2D(uGravelTex, vWorldPos.xz * 0.045).rgb * 0.32;

        // Geological basalt strata terraces + ridged mountain crags + normal/height map perturbation
        float rCenter = ridged(detailCoord);
        float rDx = ridged(detailCoord + vec2(0.032, 0.0)) - rCenter;
        float rDz = ridged(detailCoord + vec2(0.0, 0.032)) - rCenter;
        float strataWave = sin(vWorldPos.y * 0.22 + fbm(worldUv * 1.6) * 6.5);
        float heightBump = (basaltHeight - 0.5) * 1.45;

        vec3 normalOffset = vec3(
          (rDx + basaltNormalRaw.x * 0.92 + heightBump * 0.38) * 1.65,
          strataWave * 0.18 + basaltNormalRaw.y * 0.48,
          (rDz + basaltNormalRaw.y * 0.92 + heightBump * 0.38) * 1.65
        );
        vec3 N = normalize(vNormal + normalOffset);

        // Multi-scale basalt rock strata, height relief & deep crevice ambient occlusion
        float rockMacro = fbm(worldUv * 1.25);
        float rockDetail = mix(rCenter, basaltHeight * 1.18, 0.56);
        float strata = strataWave * 0.5 + 0.5;
        float columnar = sin(vWorldPos.x * 0.36 + vWorldPos.z * 0.36 + rockMacro * 4.5) * 0.5 + 0.5;
        float aoFactor = mix(1.0, clamp(basaltAo * 1.08, 0.08, 1.0), 0.92);

        // PBR Directional + Volcanic Caldera Rim + Roughness/Metallic Specular Lighting
        vec3 keyDir = normalize(vec3(0.42, 0.72, -0.55));
        vec3 rimDir = normalize(vec3(-0.62, 0.38, -0.68));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float diff = max(0.0, dot(N, keyDir));
        float ridgeRim = pow(max(0.0, dot(N, rimDir)), 2.4) * (0.30 + 0.70 * rockDetail);
        vec3 halfVec = normalize(keyDir + viewDir);
        float gloss = clamp(1.0 - basaltRoughness * 0.82, 0.12, 0.88);
        float specPower = mix(18.0, 64.0, gloss);
        float basaltSpec = pow(max(0.0, dot(N, halfVec)), specPower) * (0.28 + 0.65 * gloss + 0.45 * basaltMetallic);
        float slopeSteepness = 1.0 - abs(N.y);

        // Deep, brooding charcoal & obsidian basalt rock palette (high contrast against incandescent lava)
        vec3 darkBasalt = uIsNeon > 0.5
          ? neutralBasalt * vec3(0.09, 0.085, 0.095) * aoFactor
          : vec3(0.16, 0.15, 0.15) * (0.50 + 0.50 * rockLuma) * aoFactor;
        vec3 basaltMid = uIsNeon > 0.5
          ? neutralBasalt * vec3(0.22, 0.19, 0.19) * aoFactor
          : vec3(0.32, 0.30, 0.29) * aoFactor;
        vec3 ridgeCrest = uIsNeon > 0.5
          ? neutralBasalt * vec3(0.34, 0.29, 0.27)
          : vec3(0.48, 0.45, 0.43);

        float litFactor = (diff * 0.62 + rockDetail * 0.38) * (0.55 + 0.28 * strata + 0.17 * columnar);
        vec3 col = mix(darkBasalt, basaltMid, clamp(litFactor * 1.15, 0.0, 1.0));
        col = mix(col, ridgeCrest, smoothstep(0.62, 0.90, rockDetail * (0.45 + 0.55 * diff)));

        // Blend dark volcanic gravel on lower talus slopes and broad mountain benches
        float talusMask = smoothstep(0.52, 0.84, abs(N.y)) * clamp(1.0 - (vWorldPos.y + 38.0) / 82.0, 0.0, 1.0);
        col = mix(col, gravelTexCol * (0.35 + 0.45 * diff) * aoFactor, talusMask * 0.62);

        // Subtle cool-slate & obsidian specular glints on fractured basalt facets
        vec3 specTint = mix(vec3(0.48, 0.42, 0.38), neutralBasalt * 0.85 + vec3(0.22), basaltMetallic * 0.5);
        col += specTint * basaltSpec * (uIsNeon > 0.5 ? 0.32 : 0.24);

        // Compute normalized mountain elevation and azimuth for animated downhill fluid lava flows
        float angle = atan(vLocalPos.z, vLocalPos.x);
        float hNorm = clamp(vLocalPos.y / max(1.0, uCraterHeight), 0.0, 1.0);

        // Sharply defined domain-warped dendritic downhill lava couloirs & branching streams
        float warp1 = (fbm(vec2(angle * 3.2, hNorm * 3.8)) - 0.5) * 1.35;
        float warp2 = (fbm(vec2(angle * 7.5 + 2.3, hNorm * 6.5)) - 0.5) * 0.68;
        float primaryCouloir = 1.0 - abs(sin((angle + warp1) * 5.0));
        float tributaryCouloir = 1.0 - abs(sin((angle * 2.0 - warp2) * 6.0));
        float valleyTrough = clamp(1.0 - rCenter * 1.15, 0.0, 1.0);

        // Downhill flow speed accelerates on steeper slopes
        float flowCoordY = hNorm * 7.5 + uTime * (0.48 + 0.20 * uFissureDensity);
        vec2 downhillFlowUv = vec2(angle * 4.5 + warp1 * 0.8, flowCoordY);
        float flowSurge = 0.72 + 0.28 * fbm(vec2(angle * 6.0, hNorm * 9.0 + uTime * 0.85));

        // High exponents (9.5 and 12.5) keep lava streams focused inside deep volcanic couloirs instead of tinting the whole mountain orange
        float mainRiverMask = pow(clamp(primaryCouloir, 0.0, 1.0), 9.5) * (0.55 + 0.45 * valleyTrough);
        float branchRiverMask = pow(clamp(tributaryCouloir, 0.0, 1.0), 12.5) * smoothstep(0.14, 0.82, 1.0 - hNorm);
        float maskFissure = smoothstep(0.38, 0.84, basaltLavaMask) * (0.52 + 0.48 * flowSurge);
        float baseMagmaCracks = pow(ridged(worldUv * 3.2 + vec2(0.0, uTime * 0.04)), 6.0) * clamp(1.0 - (vWorldPos.y + 28.0) / 85.0, 0.0, 1.0);

        float totalLavaMask =
          (mainRiverMask * 1.15 + branchRiverMask * 0.75) * flowSurge * uFissureDensity +
          maskFissure * (0.58 * uFissureDensity) +
          baseMagmaCracks * 0.42;

        if (uIsNeon > 0.5) {
          // Restrained volcanic rim-light on sharp mountain crests + tight low-altitude magma bounce right above the lava sea
          col += vec3(0.68, 0.16, 0.02) * ridgeRim * 0.14;
          float magmaBounce = clamp(1.0 - (vWorldPos.y + 42.0) / 38.0, 0.0, 1.0);
          col += vec3(0.75, 0.18, 0.02) * magmaBounce * slopeSteepness * 0.14;

          // Tight subsurface cherry-red thermal glow strictly on the narrow basalt rock banks bordering active lava streams
          float bankHeatHalo = smoothstep(0.22, 0.42, totalLavaMask) * (1.0 - smoothstep(0.42, 0.68, totalLavaMask));
          col += vec3(0.82, 0.12, 0.01) * bankHeatHalo * 0.42;

          // Authored volcanic_basalt_emissive map masked by actual fissure depth so flat rock stays dark charcoal
          vec3 pbrEmissiveGlow = basaltEmissive * vec3(1.0, 0.20, 0.015) * smoothstep(0.24, 0.76, basaltLavaMask) * (0.85 + 0.35 * uFissureDensity);
          col += pbrEmissiveGlow;

          // Evaluate animated downhill fluid magma inside the mountain couloirs & basalt fissures
          vec3 gmLava = sampleFluidSlopeLava(downhillFlowUv * 0.55 + worldUv * 0.85, uTime * 1.45);
          vec3 crimsonMargin = vec3(0.82, 0.10, 0.01);
          vec3 moltenOrange = max(gmLava, vec3(1.06, 0.30, 0.02));
          vec3 whiteGoldCore = vec3(1.36, 1.15, 0.54);

          vec3 streamCol = mix(crimsonMargin, moltenOrange, smoothstep(0.32, 0.64, totalLavaMask));
          streamCol = mix(streamCol, whiteGoldCore, smoothstep(0.66, 0.98, totalLavaMask));

          // Floating dark basalt crust islands drifting down the center of wide lava streams
          float crustRaft = smoothstep(0.64, 0.88, fbm(downhillFlowUv * 3.2)) * (1.0 - smoothstep(0.80, 1.05, totalLavaMask));
          streamCol = mix(streamCol, darkBasalt * 0.55, crustRaft * 0.55);

          col = mix(col, streamCol, clamp(smoothstep(0.30, 0.72, totalLavaMask), 0.0, 1.0));

          // Blazing Superheated Caldera Crater Rim restricted to the immediate summit lip (top 9%)
          if (uHasCrater > 0.5) {
            float craterNoise = fbm(vec2(angle * 5.0, hNorm * 6.0 + uTime * 0.65));
            float craterGlow = smoothstep(0.89, 0.985, hNorm + (craterNoise - 0.5) * 0.06);
            vec3 craterCol = mix(
              gmLava * 1.12 + vec3(0.45, 0.12, 0.01),
              vec3(1.34, 1.14, 0.62),
              smoothstep(0.93, 0.99, hNorm)
            );
            col = mix(col, craterCol, craterGlow * 0.88);
          }
        } else {
          // Daylight warm incandescent lava streams & emissive fissures
          vec3 gmLavaDay = sampleFluidSlopeLava(downhillFlowUv * 0.55 + worldUv * 0.85, uTime * 1.25);
          col += basaltEmissive * vec3(1.0, 0.22, 0.02) * smoothstep(0.28, 0.78, basaltLavaMask) * 0.45;
          col = mix(col, gmLavaDay * 0.95, clamp(smoothstep(0.34, 0.78, totalLavaMask) * 0.72, 0.0, 0.82));
        }

        // Dark smoky volcanic distance haze so colossal background cordilleras read as dark silhouettes
        float camDist = length(cameraPosition - vWorldPos);
        float distHaze = 1.0 - exp(-camDist * 0.00052);
        vec3 hazeColor = uIsNeon > 0.5 ? vec3(0.03, 0.012, 0.018) : vec3(0.48, 0.46, 0.44);
        col = mix(col, hazeColor, clamp(distHaze * 0.45, 0.0, 0.52));

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * Exact normalized radial multiplier (strictly <= 1.0) for broad-shouldered Volcanic Mountain Massifs
 * so that `baseRadius` is a guaranteed upper bound on horizontal extent (preventing track invasion)
 * while preserving imposing multi-lobed shoulders, stepped basalt benches, and wide talus aprons.
 */
function computeMassifRadialMultiplier(
  hFrac: number,
  angle: number,
  seed: number,
  openTop: boolean
): number {
  const ridgeAxisAngle = seed * 1.37;
  const cosRidge = Math.cos(angle - ridgeAxisAngle);
  const ridgeStretch = openTop ? 1.0 + 0.08 * cosRidge * cosRidge : 1.0 + 0.16 * cosRidge * cosRidge;

  const warp = Math.sin(hFrac * 3.2 + seed * 1.3) * 0.38 + Math.cos(angle * 2.0 + seed) * 0.24;
  const buttress1 = Math.sin((angle + warp) * 3.0 + seed * 1.7) * 0.5 + 0.5;
  const buttress2 = Math.cos((angle - warp * 0.6) * 5.0 + seed * 3.1) * 0.5 + 0.5;
  const couloirGroove = Math.pow(Math.sin((angle + warp * 0.8) * 5.0), 2.0);

  const basaltTerrace = Math.sin(hFrac * 14.0 + buttress1 * 2.2) * 0.022 * (1.0 - hFrac * 0.5);
  const talusFlare = Math.pow(1.0 - hFrac, 1.45) * 0.14;

  const shoulder1 = Math.max(0, Math.cos(angle - seed * 2.1)) * Math.sin(hFrac * Math.PI * 0.85) * 0.11;
  const shoulder2 = Math.max(0, Math.cos(angle + seed * 1.4 + 2.1)) * Math.sin(hFrac * Math.PI * 0.9) * 0.09;
  const shoulder3 = Math.max(0, Math.sin(angle * 2.0 - seed * 0.9)) * (1.0 - hFrac * 0.4) * 0.07;

  const radialProfile =
    0.64 +
    talusFlare +
    Math.sin(hFrac * Math.PI) * (0.11 * buttress1 + 0.07 * buttress2 - 0.04 * couloirGroove) +
    shoulder1 +
    shoulder2 +
    shoulder3 +
    basaltTerrace;

  return Math.min(1.0, radialProfile * ridgeStretch);
}

/**
 * Generates an imposing, broad-shouldered 3D Volcanic Mountain Massif / Cordillera Ridge Geometry
 * OR an Active Erupting Stratovolcano with a sunken caldera crater bowl and lava spillways.
 * Completely eliminates sharp conical spikes (`topRadius > 0`) and guarantees all vertices stay
 * within `<= 1.0 * baseRadius` horizontally so no mountain ever invades the race track.
 */
function createDisplacedMountainGeometry(
  baseRadius: number,
  height: number,
  radialSegs: number,
  heightSegs: number,
  seed: number,
  openTop = false,
  tunnelCarve?: {
    worldX: number;
    worldY: number;
    worldZ: number;
    samples: Array<{ x: number; y: number; z: number }>;
    openAirSamples?: Array<{ x: number; y: number; z: number }>;
  }
): THREE.BufferGeometry {
  // Broad summit crown (0.44 of baseRadius for mountain massifs, 0.24 for stratovolcanoes) — never a pointy 0.0 cone!
  const topRadius = openTop ? baseRadius * 0.24 : baseRadius * 0.44;
  const geo = new THREE.CylinderGeometry(topRadius, baseRadius, height, radialSegs, heightSegs, openTop);
  geo.translate(0, height * 0.5, 0);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const hFrac = THREE.MathUtils.clamp(vy / height, 0, 1);
    const angle = Math.atan2(vz, vx);
    const rawR = Math.hypot(vx, vz);
    const expectedRingR = THREE.MathUtils.lerp(baseRadius, topRadius, hFrac);
    const capFrac = expectedRingR > 0.001 ? THREE.MathUtils.clamp(rawR / expectedRingR, 0, 1) : 0;

    const warp = Math.sin(hFrac * 3.2 + seed * 1.3) * 0.38 + Math.cos(angle * 2.0 + seed) * 0.24;
    const buttress1 = Math.sin((angle + warp) * 3.0 + seed * 1.7) * 0.5 + 0.5;
    const buttress2 = Math.cos((angle - warp * 0.6) * 5.0 + seed * 3.1) * 0.5 + 0.5;

    const radialMult = computeMassifRadialMultiplier(hFrac, angle, seed, openTop);
    const displacedR = rawR * radialMult;

    // Sculpt broad, imposing volcanic summit domes, caldera rims, and multi-peak cordillera crowns (NO sharp spikes!)
    let finalY = vy;
    if (openTop) {
      // Stratovolcano crater rim with breached lava spillway notches where fluid lava rivers pour out
      const spillwayNotch = Math.pow(Math.max(0, Math.sin(angle * 4.0 + seed)), 4.0) * 0.065;
      const rimUndulation = (buttress1 * 0.6 + buttress2 * 0.4 - 0.45) * 0.055 - spillwayNotch;
      finalY = vy + (hFrac > 0.72 ? rimUndulation * height * ((hFrac - 0.72) / 0.28) : 0);
    } else {
      // Broad multi-peak volcanic massif crown + sunken caldera depression on the upper plateau
      const lobePeak =
        Math.sin(angle * 2.0 + seed * 1.9) * 0.085 +
        Math.cos(angle * 3.0 - seed * 2.7) * 0.065 +
        (buttress1 - 0.5) * 0.055;
      if (hFrac > 0.985 && capFrac < 0.92) {
        const domeArch = Math.sin(capFrac * Math.PI * 0.82) * 0.095 - (1.0 - capFrac) * 0.035;
        finalY = height * (1.0 + domeArch + lobePeak * capFrac);
      } else {
        const crownBlend = smoothstepScalar(0.52, 1.0, hFrac);
        finalY = vy + lobePeak * height * crownBlend;
      }
    }

    let clampedR = displacedR;
    if (tunnelCarve && tunnelCarve.openAirSamples) {
      const ux = Math.cos(angle);
      const uz = Math.sin(angle);
      const openSamples = tunnelCarve.openAirSamples;
      const minOpenClearance = TRACK_HALF_WIDTH + 38.0;
      const clearSq = minOpenClearance * minOpenClearance;
      for (let s = 0; s < openSamples.length; s++) {
        const relX = openSamples[s].x - tunnelCarve.worldX;
        const relZ = openSamples[s].z - tunnelCarve.worldZ;
        const proj = relX * ux + relZ * uz;
        if (proj > 0) {
          const dSq = relX * relX + relZ * relZ;
          const perpSq = dSq - proj * proj;
          if (perpSq < clearSq) {
            const rLimit = proj - Math.sqrt(clearSq - perpSq);
            if (clampedR > rLimit) {
              clampedR = Math.max(14, rLimit);
            }
          }
        }
      }
    }

    const finalX = Math.cos(angle) * clampedR;
    const finalZ = Math.sin(angle) * clampedR;

    // If this mountain straddles the Volcano-Base Tunnel, arch its lower flank cleanly above the tunnel vault roof!
    if (tunnelCarve) {
      const wx = tunnelCarve.worldX + finalX;
      const wz = tunnelCarve.worldZ + finalZ;

      let minDistSq = Infinity;
      let nearestTrackY = 20;
      const samples = tunnelCarve.samples;
      for (let s = 0; s < samples.length; s++) {
        const dx = wx - samples[s].x;
        const dz = wz - samples[s].z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          nearestTrackY = samples[s].y;
        }
      }
      const dist = Math.sqrt(minDistSq);
      const clearanceRadius = 44.0;
      if (dist < clearanceRadius) {
        const archFactor = Math.cos((dist / clearanceRadius) * (Math.PI * 0.5));
        const minWorldY = nearestTrackY + 22.8 + archFactor * 15.5;
        const requiredLocalY = minWorldY - tunnelCarve.worldY;
        if (finalY < requiredLocalY) {
          finalY = requiredLocalY;
        }
      }
    }

    pos.setXYZ(i, finalX, finalY, finalZ);
  }
  if (geo.attributes.uv) {
    geo.setAttribute('uv1', geo.attributes.uv);
    geo.setAttribute('uv2', geo.attributes.uv);
  }
  geo.computeVertexNormals();
  return geo;
}

function smoothstepScalar(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Generates a broad, stepped 3D Columnar Basalt Cliff Buttress / Volcanic Rock Massif Geometry
 * (Replaces sharp conical spikes with imposing hexagonal-stepped volcanic rock formations).
 * Strictly normalized to horizontal radius <= 1.0 so instance scaling is an exact radius bound.
 */
function createJaggedObsidianOutcropGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.62, 0.92, 1.0, 24, 14);
  geo.translate(0, 0.5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const angle = Math.atan2(vz, vx);
    const r = Math.hypot(vx, vz);

    // Broad hexagonal/columnar basalt cliff ribs and terraced volcanic ledges (zero sharp conical tips)
    const columnRib = Math.sin(angle * 6.0 + seed * 1.9) * 0.08 + Math.cos(angle * 4.0 - seed * 2.3) * 0.09;
    const terraceStep = Math.floor(vy * 4.5) / 4.5;
    const radialScale = Math.min(1.0, r * (0.76 + columnRib + (1.0 - terraceStep) * 0.14));
    const crownUndulation = vy > 0.72 ? Math.sin(angle * 3.0 + seed * 2.1) * 0.08 * ((vy - 0.72) / 0.28) : 0;

    pos.setXYZ(
      i,
      Math.cos(angle) * radialScale,
      Math.max(0, vy + crownUndulation),
      Math.sin(angle) * radialScale
    );
  }
  if (geo.attributes.uv) {
    geo.setAttribute('uv1', geo.attributes.uv);
    geo.setAttribute('uv2', geo.attributes.uv);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Custom GLSL Subterranean Magma Cavern Tunnel Wall & Ceiling Shader
 * Upgraded with the 8 Volcanic Basalt PBR textures (`volcanic_basalt_albedo`, `normal`, `roughness`,
 * `ao`, `emissive`, `lava_mask`) and TheGameMaker's dual-advected `lavaCloudMap` + `03_glowing_lava.png` shader.
 */
function createCavernWallShaderMaterial(textures: TrackTextureSet, isNeon: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIsNeon: { value: isNeon ? 1.0 : 0.0 },
      uObsidianTex: { value: textures.obsidianRockMap },
      uCloudTex: { value: textures.lavaCloudMap },
      uLavaTex: { value: textures.glowingLavaMap },
      uBasaltAlbedo: { value: textures.volcanicBasaltAlbedoMap },
      uBasaltNormal: { value: textures.volcanicBasaltNormalMap },
      uBasaltAo: { value: textures.volcanicBasaltAoMap },
      uBasaltEmissive: { value: textures.volcanicBasaltEmissiveMap },
      uBasaltLavaMask: { value: textures.volcanicBasaltLavaMaskMap },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIsNeon;
      uniform sampler2D uObsidianTex;
      uniform sampler2D uCloudTex;
      uniform sampler2D uLavaTex;
      uniform sampler2D uBasaltAlbedo;
      uniform sampler2D uBasaltNormal;
      uniform sampler2D uBasaltAo;
      uniform sampler2D uBasaltEmissive;
      uniform sampler2D uBasaltLavaMask;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

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
      float ridged(vec2 p) {
        float v = 0.0;
        float amp = 0.55;
        for (int i = 0; i < 3; i++) {
          float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
          v += amp * n * n;
          p *= 2.2;
          amp *= 0.5;
        }
        return v;
      }

      vec3 sampleGameMakerLava(vec2 lavaUv, float time) {
        vec4 n = texture2D(uCloudTex, lavaUv);
        vec2 T1 = lavaUv + vec2(1.5, -1.5) * time * 0.02;
        vec2 T2 = lavaUv + vec2(-0.5, 2.0) * time * 0.01;
        T1.x += n.x * 2.0;
        T1.y += n.y * 2.0;
        T2.x -= n.y * 0.2;
        T2.y += n.z * 0.2;
        float p = texture2D(uCloudTex, T1 * 2.0).a;
        vec4 color = texture2D(uLavaTex, T2 * 2.0);
        vec4 temp = color * (vec4(p, p, p, p) * 2.0) + (color * color - 0.1);
        if (temp.r > 1.0) { temp.bg += clamp(temp.r - 2.0, 0.0, 100.0); }
        if (temp.g > 1.0) { temp.rb += temp.g - 1.0; }
        if (temp.b > 1.0) { temp.rg += temp.b - 1.0; }
        return clamp(temp.rgb, vec3(0.0), vec3(1.36));
      }

      void main() {
        vec2 uvScaled = vec2(vUv.x * 6.0, vUv.y * 18.0);
        vec3 basaltCol = texture2D(uBasaltAlbedo, uvScaled).rgb;
        vec3 basaltNorm = texture2D(uBasaltNormal, uvScaled).rgb * 2.0 - 1.0;
        float basaltAo = texture2D(uBasaltAo, uvScaled).r;
        vec3 basaltEmissive = texture2D(uBasaltEmissive, uvScaled).rgb;
        float basaltMask = texture2D(uBasaltLavaMask, uvScaled).r;

        vec3 obsidianTex = texture2D(uObsidianTex, uvScaled * 0.75).rgb;
        vec3 rawRock = mix(obsidianTex, basaltCol, 0.75);
        float obsidianLuma = dot(rawRock, vec3(0.299, 0.587, 0.114));
        vec3 rockBaseTex = mix(vec3(obsidianLuma), rawRock, 0.30);
        float rock = ridged(uvScaled);
        float fineRock = ridged(uvScaled * 2.6 + vec2(1.7, 3.1));

        // Magma veins pulsing along the cavern vault and lower side channels
        float veinPattern = ridged(uvScaled * 1.35 + vec2(0.0, -uTime * 0.22));
        float sideProximity = 1.0 - sin(vUv.x * 3.14159265);
        float veinMask = clamp(
          smoothstep(0.76, 0.94, veinPattern + sideProximity * 0.12) + smoothstep(0.42, 0.86, basaltMask) * 0.55,
          0.0,
          1.0
        );

        float normalRelief = clamp(0.55 + 0.45 * basaltNorm.y, 0.28, 1.15);
        vec3 obsidianBase = rockBaseTex * (0.14 + 0.26 * rock) * basaltAo * normalRelief;
        vec3 warmBasalt = (rockBaseTex * vec3(0.32, 0.26, 0.24) + vec3(0.02, 0.008, 0.004)) * basaltAo;
        vec3 col = mix(obsidianBase, warmBasalt, rock * 0.45 + fineRock * 0.22 + obsidianLuma * 0.18);

        if (uIsNeon > 0.5) {
          // Restrained warm bounce light from the subterranean lava rivers along the lower tunnel walls
          col += vec3(0.65, 0.16, 0.02) * pow(sideProximity, 2.6) * (0.18 + 0.24 * obsidianLuma);
          col += basaltEmissive * vec3(1.0, 0.18, 0.015) * smoothstep(0.28, 0.80, basaltMask) * 0.95;

          // TheGameMaker dual-advected lava inside cavern cracks & basalt lava mask
          vec3 gmLava = sampleGameMakerLava(uvScaled * 0.35, uTime * 1.45);
          vec3 lavaVein = mix(max(gmLava, vec3(1.05, 0.30, 0.03)), vec3(1.36, 1.16, 0.56), smoothstep(0.80, 0.96, veinPattern));
          col = mix(col, lavaVein, veinMask * 0.82);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

/**
 * Custom GLSL Volumetric Caldera Eruption Plume & Pyroclastic Fire/Ash Column Shader
 */
function createEruptionPlumeShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnableVolumetric: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vViewNormal;
      void main() {
        vUv = uv;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uEnableVolumetric;
      varying vec2 vUv;
      varying vec3 vViewNormal;

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
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.1;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        // vUv.y: 0 at crater base, 1 at high ash cloud top
        float h = vUv.y;
        float billow = fbm(vec2(vUv.x * 6.0, h * 3.5 - uTime * 0.85));
        float fineBillow = fbm(vec2(vUv.x * 12.0 + 1.7, h * 7.0 - uTime * 1.4));
        float cloud = billow * 0.65 + fineBillow * 0.35;

        vec3 whiteGold = vec3(1.0, 0.97, 0.82);
        vec3 fieryOrange = vec3(1.0, 0.42, 0.04);
        vec3 crimsonAsh = vec3(0.45, 0.06, 0.02);

        float heatCore = pow(1.0 - h, 1.45) * smoothstep(0.28, 0.85, cloud);
        vec3 col = mix(crimsonAsh, fieryOrange, smoothstep(0.18, 0.65, heatCore));
        col = mix(col, whiteGold, smoothstep(0.55, 0.92, heatCore));

        float edgeSoft = pow(abs(vViewNormal.z), 1.4);
        float verticalMask = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.65, 1.0, h));
        float alpha = verticalMask * edgeSoft * smoothstep(0.25, 0.82, cloud) * 0.85 * uEnableVolumetric;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Custom GLSL Cascading Molten Lava Waterfall Shader
 * Powered by TheGameMaker's `webgl_shader_lava` dual-advection (`texture1` + `texture2`) with vertical cascade flow
 */
function createLavaWaterfallShaderMaterial(textures: TrackTextureSet): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      texture1: { value: textures.lavaCloudMap },
      texture2: { value: textures.glowingLavaMap },
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
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      varying vec2 vUv;

      void main() {
        float xEdge = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float streamMask = smoothstep(0.06, 0.48, xEdge);

        // Parabolic cascade flow speed (faster in the center of the lava fall, dragging along the rock margins)
        float centerBoost = 0.75 + 0.45 * streamMask;
        vec2 cascadeUv = vec2(vUv.x * 1.65, vUv.y * 3.1 + uTime * 1.15 * centerBoost);
        float time = uTime * 2.65;

        vec4 noise = texture2D(texture1, cascadeUv);
        vec2 T1 = cascadeUv + vec2(1.5, -1.5) * time * 0.022;
        vec2 T2 = cascadeUv + vec2(-0.5, 2.0) * time * 0.014;

        T1.x += noise.x * 2.0;
        T1.y += noise.y * 2.0;
        T2.x -= noise.y * 0.24;
        T2.y += noise.z * 0.24;

        float p = texture2D(texture1, T1 * 2.0).a;
        vec4 color = texture2D(texture2, T2 * 2.0);
        vec4 temp = color * (vec4(p, p, p, p) * 2.15) + (color * color - 0.08);

        if (temp.r > 1.0) { temp.bg += clamp(temp.r - 1.85, 0.0, 100.0); }
        if (temp.g > 1.0) { temp.rb += temp.g - 1.0; }
        if (temp.b > 1.0) { temp.rg += temp.b - 1.0; }

        vec3 col = clamp(temp.rgb, vec3(0.0), vec3(1.38));
        float alpha = streamMask * smoothstep(0.10, 0.40, p * streamMask);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
}

/**
 * Builds the High-Speed Parabolic Curve ("Caldera Parabolica", t in [0.145, 0.335])
 * and the Volcano-Base Magma Cavern Tunnel (t in [0.345, 0.525]) with:
 * - Brushed graphite (04_brushed_graphite.png) structural ribs, brackets & portal arches
 * - Cyan neon surface trim panels (05_cyan_neon_surface.png) paired with separate 3D emissive light strips
 * - Dark segmented roadway panel platforms (01_roadway_panels.png) along tunnel thresholds
 * - Dark volcanic gravel shore banks (07_volcanic_gravel.png) and 3D jagged obsidian rock formations (02_obsidian_rock.png)
 * - Twin subterranean glowing lava rivers (03_glowing_lava.png) + separate emissive magma surge ribbons
 */
function buildParabolicaAndVolcanoTunnel(
  worldGroup: THREE.Group,
  spline: THREE.CatmullRomCurve3,
  textures: TrackTextureSet,
  isNeon: boolean,
  fallMat: THREE.ShaderMaterial,
  animatedShaders: THREE.ShaderMaterial[]
) {
  const pos = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const rotMat = new THREE.Matrix4();
  const halfW = TRACK_HALF_WIDTH;

  const brushedGraphiteMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    map: textures.brushedGraphiteMap,
    bumpMap: textures.brushedGraphiteMap,
    bumpScale: 0.16,
    metalness: 0.68,
    roughness: 0.42,
    envMapIntensity: 0.18,
  });

  const cyanTrimPanelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    map: textures.cyanNeonSurfaceMap,
    emissive: new THREE.Color(isNeon ? 0x00d8ff : 0x0284c7),
    emissiveMap: textures.cyanNeonSurfaceMap,
    emissiveIntensity: isNeon ? 0.35 : 0.12,
    metalness: 0.55,
    roughness: 0.38,
    envMapIntensity: 0.18,
  });

  const cyanLightStripMat = new THREE.MeshBasicMaterial({
    color: isNeon ? 0x22d3ee : 0x38bdf8,
    fog: false,
  });

  const platformPanelMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    map: textures.roadwayPanelsMap,
    bumpMap: textures.roadwayPanelsMap,
    bumpScale: 0.20,
    metalness: 0.52,
    roughness: 0.55,
    envMapIntensity: 0.15,
  });

  const obsidianRockMat = new THREE.MeshStandardMaterial({
    color: 0x3f3f46,
    map: textures.volcanicBasaltAlbedoMap,
    normalMap: textures.volcanicBasaltNormalMap,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: textures.volcanicBasaltRoughnessMap,
    roughness: 1.0,
    aoMap: textures.volcanicBasaltAoMap,
    aoMapIntensity: 0.94,
    metalnessMap: textures.volcanicBasaltMetallicMap,
    metalness: 0.14,
    bumpMap: textures.volcanicBasaltHeightMap,
    bumpScale: 0.35,
    emissive: new THREE.Color(1.0, 0.18, 0.015),
    emissiveMap: textures.volcanicBasaltEmissiveMap,
    emissiveIntensity: isNeon ? 0.85 : 0.25,
    envMapIntensity: 0.12,
  });

  // ============================================================================
  // PART A: HIGH-SPEED PARABOLIC CURVE ("CALDERA PARABOLICA", t in [0.055, 0.125])
  // Outer banked plasma arrestor wall + cantilevered parabolic telemetry ribs
  // ============================================================================
  const paraSteps = 32;
  const paraStart = 0.055;
  const paraEnd = 0.125;
  const paraWallPositions = new Float32Array((paraSteps + 1) * 2 * 3);
  const paraWallUvs = new Float32Array((paraSteps + 1) * 2 * 2);
  const paraWallIndices: number[] = [];

  const ribArchGeo = new THREE.BoxGeometry(0.72, 6.4, 1.25);
  const ribBracketGeo = new THREE.BoxGeometry(1.45, 1.15, 1.55);
  const ribCyanPanelGeo = new THREE.BoxGeometry(0.78, 3.8, 0.52);
  const ribLightStripGeo = new THREE.BoxGeometry(0.18, 5.2, 0.22);
  const ribTipGeo = new THREE.BoxGeometry(0.55, 0.48, 3.6);
  const ribTipEmissiveGeo = new THREE.BoxGeometry(0.24, 0.22, 3.65);

  for (let i = 0; i <= paraSteps; i++) {
    const u = i / paraSteps;
    const t = THREE.MathUtils.lerp(paraStart, paraEnd, u);
    sampleTrackFrame(spline, t, pos, fwd, right, up);

    // Outer edge of the right-hand Parabolic Curve is the LEFT side (-right)
    const outerDist = -(halfW + 0.55);
    const wallHeight = 4.6 * Math.sin(u * Math.PI);

    const bx = pos.x + right.x * outerDist + up.x * 1.1;
    const by = pos.y + right.y * outerDist + up.y * 1.1;
    const bz = pos.z + right.z * outerDist + up.z * 1.1;

    const tx = bx + up.x * wallHeight - right.x * (wallHeight * 0.18);
    const ty = by + up.y * wallHeight - right.y * (wallHeight * 0.18);
    const tz = bz + up.z * wallHeight - right.z * (wallHeight * 0.18);

    const vIdx = i * 2 * 3;
    paraWallPositions[vIdx] = bx;
    paraWallPositions[vIdx + 1] = by;
    paraWallPositions[vIdx + 2] = bz;
    paraWallPositions[vIdx + 3] = tx;
    paraWallPositions[vIdx + 4] = ty;
    paraWallPositions[vIdx + 5] = tz;

    const uvIdx = i * 2 * 2;
    paraWallUvs[uvIdx] = u * 14.0;
    paraWallUvs[uvIdx + 1] = 0;
    paraWallUvs[uvIdx + 2] = u * 14.0;
    paraWallUvs[uvIdx + 3] = 1;

    if (i < paraSteps) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      paraWallIndices.push(a, b, c, b, d, c);
    }

    // Cantilevered Parabolic Curve Telemetry Ribs (04_brushed_graphite + 05_cyan_neon_surface + separate 3D light strip)
    if (i > 0 && i < paraSteps && i % 2 === 0) {
      const ribGroup = new THREE.Group();
      ribGroup.position
        .copy(pos)
        .addScaledVector(right, -(halfW + 1.25))
        .addScaledVector(up, 3.2);
      lookTarget.copy(ribGroup.position).add(fwd);
      rotMat.lookAt(ribGroup.position, lookTarget, up);
      ribGroup.quaternion.setFromRotationMatrix(rotMat);

      const baseBracket = new THREE.Mesh(ribBracketGeo, brushedGraphiteMat);
      baseBracket.position.set(-0.2, -2.6, 0);
      ribGroup.add(baseBracket);

      const post = new THREE.Mesh(ribArchGeo, brushedGraphiteMat);
      post.rotation.z = -0.28;
      ribGroup.add(post);

      const cyanPanel = new THREE.Mesh(ribCyanPanelGeo, cyanTrimPanelMat);
      cyanPanel.rotation.z = -0.28;
      cyanPanel.position.set(0.06, 0.1, 0);
      ribGroup.add(cyanPanel);

      // Separate 3D geometric emissive light strip along the inner face of the rib
      const innerLightStrip = new THREE.Mesh(ribLightStripGeo, cyanLightStripMat);
      innerLightStrip.rotation.z = -0.28;
      innerLightStrip.position.set(0.42, 0.2, 0);
      ribGroup.add(innerLightStrip);

      const overhang = new THREE.Mesh(ribTipGeo, cyanTrimPanelMat);
      overhang.position.set(1.6, 2.85, 0);
      overhang.rotation.y = Math.PI / 2;
      ribGroup.add(overhang);

      const overhangLight = new THREE.Mesh(
        ribTipEmissiveGeo,
        i % 4 === 0 ? cyanLightStripMat : createRingPlasmaTubeMaterial(0xfef08a, 0xff6b00)
      );
      overhangLight.position.set(1.6, 2.55, 0);
      overhangLight.rotation.y = Math.PI / 2;
      ribGroup.add(overhangLight);

      worldGroup.add(ribGroup);
    }
  }

  const paraWallGeo = new THREE.BufferGeometry();
  paraWallGeo.setAttribute('position', new THREE.BufferAttribute(paraWallPositions, 3));
  paraWallGeo.setAttribute('uv', new THREE.BufferAttribute(paraWallUvs, 2));
  paraWallGeo.setIndex(paraWallIndices);
  paraWallGeo.computeVertexNormals();

  const paraWallMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
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
      varying vec2 vUv;
      void main() {
        float chevron = fract(vUv.x - abs(vUv.y - 0.5) * 1.4 - uTime * 3.2);
        float pulse = smoothstep(0.15, 0.48, chevron) * (1.0 - smoothstep(0.58, 0.88, chevron));
        float topRail = smoothstep(0.82, 0.96, vUv.y);
        vec3 col = mix(vec3(1.0, 0.38, 0.02), vec3(0.0, 0.95, 1.0), topRail + pulse * 0.55);
        float alpha = (pulse * 0.55 + topRail * 0.85 + 0.12) * smoothstep(0.0, 0.15, vUv.y);
        gl_FragColor = vec4(col, alpha * 0.78);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  animatedShaders.push(paraWallMat);
  worldGroup.add(new THREE.Mesh(paraWallGeo, paraWallMat));

  // ============================================================================
  // PART B: SET-PIECE 1 — VOLCANO-BASE MAGMA CAVERN TUNNEL (t in [0.138, 0.180])
  // Pierces directly through the base of the Erupting Stratovolcano with:
  // 1. Vaulted obsidian-magma cavern roof & walls (02_obsidian_rock + 03_glowing_lava)
  // 2. Hard-surface platform decks (01_roadway_panels) & dark volcanic gravel banks (07_volcanic_gravel)
  // 3. Twin subterranean flowing molten lava rivers (03_glowing_lava) + separate emissive magma core strips
  // 4. 3D Jagged Obsidian Rock Spires (02_obsidian_rock) rising along the tunnel riverbanks
  // 5. Brushed graphite (04_brushed_graphite) & cyan neon trim (05_cyan_neon_surface) containment ribs
  // ============================================================================
  const tunnelStart = 0.138;
  const tunnelEnd = 0.180;
  const lenSteps = 64;
  const arcSteps = 24;

  const vaultPositions = new Float32Array((lenSteps + 1) * (arcSteps + 1) * 3);
  const vaultUvs = new Float32Array((lenSteps + 1) * (arcSteps + 1) * 2);
  const vaultIndices: number[] = [];

  // Twin subterranean lava river ribbons running alongside left & right edges of the road inside the tunnel
  const leftRiverPositions = new Float32Array((lenSteps + 1) * 2 * 3);
  const rightRiverPositions = new Float32Array((lenSteps + 1) * 2 * 3);
  const riverUvs = new Float32Array((lenSteps + 1) * 2 * 2);
  const riverIndices: number[] = [];

  // Separate raised emissive magma core ribbons running along the center of each subterranean lava river
  const leftEmissiveCorePositions = new Float32Array((lenSteps + 1) * 2 * 3);
  const rightEmissiveCorePositions = new Float32Array((lenSteps + 1) * 2 * 3);

  // Dark Volcanic Gravel Shore Banks (07_volcanic_gravel) bordering the subterranean lava rivers
  const leftGravelPositions = new Float32Array((lenSteps + 1) * 2 * 3);
  const rightGravelPositions = new Float32Array((lenSteps + 1) * 2 * 3);
  const gravelUvs = new Float32Array((lenSteps + 1) * 2 * 2);

  for (let i = 0; i <= lenSteps; i++) {
    const u = i / lenSteps;
    const t = THREE.MathUtils.lerp(tunnelStart, tunnelEnd, u);
    sampleTrackFrame(spline, t, pos, fwd, right, up);

    // Subterranean Left & Right Molten Lava Channels (from lateral 14.2m to 22.0m, 1.1m below road surface)
    const innerLat = halfW + 0.7;
    const outerLat = halfW + 8.5;
    const riverDrop = -1.1;

    const rIdx = i * 2 * 3;
    // Left Lava River
    leftRiverPositions[rIdx] = pos.x - right.x * outerLat + up.x * riverDrop;
    leftRiverPositions[rIdx + 1] = pos.y - right.y * outerLat + up.y * riverDrop;
    leftRiverPositions[rIdx + 2] = pos.z - right.z * outerLat + up.z * riverDrop;
    leftRiverPositions[rIdx + 3] = pos.x - right.x * innerLat + up.x * riverDrop;
    leftRiverPositions[rIdx + 4] = pos.y - right.y * innerLat + up.y * riverDrop;
    leftRiverPositions[rIdx + 5] = pos.z - right.z * innerLat + up.z * riverDrop;

    // Right Lava River
    rightRiverPositions[rIdx] = pos.x + right.x * innerLat + up.x * riverDrop;
    rightRiverPositions[rIdx + 1] = pos.y + right.y * innerLat + up.y * riverDrop;
    rightRiverPositions[rIdx + 2] = pos.z + right.z * innerLat + up.z * riverDrop;
    rightRiverPositions[rIdx + 3] = pos.x + right.x * outerLat + up.x * riverDrop;
    rightRiverPositions[rIdx + 4] = pos.y + right.y * outerLat + up.y * riverDrop;
    rightRiverPositions[rIdx + 5] = pos.z + right.z * outerLat + up.z * riverDrop;

    // Separate Emissive Magma Core Ribbons hovering 0.08m above the 03_glowing_lava base
    const coreMeander = Math.sin(u * Math.PI * 10.0) * 0.85;
    const coreInnerLat = halfW + 3.6 + coreMeander;
    const coreOuterLat = halfW + 5.4 + coreMeander;
    const coreDrop = -1.02;

    leftEmissiveCorePositions[rIdx] = pos.x - right.x * coreOuterLat + up.x * coreDrop;
    leftEmissiveCorePositions[rIdx + 1] = pos.y - right.y * coreOuterLat + up.y * coreDrop;
    leftEmissiveCorePositions[rIdx + 2] = pos.z - right.z * coreOuterLat + up.z * coreDrop;
    leftEmissiveCorePositions[rIdx + 3] = pos.x - right.x * coreInnerLat + up.x * coreDrop;
    leftEmissiveCorePositions[rIdx + 4] = pos.y - right.y * coreInnerLat + up.y * coreDrop;
    leftEmissiveCorePositions[rIdx + 5] = pos.z - right.z * coreInnerLat + up.z * coreDrop;

    rightEmissiveCorePositions[rIdx] = pos.x + right.x * coreInnerLat + up.x * coreDrop;
    rightEmissiveCorePositions[rIdx + 1] = pos.y + right.y * coreInnerLat + up.y * coreDrop;
    rightEmissiveCorePositions[rIdx + 2] = pos.z + right.z * coreInnerLat + up.z * coreDrop;
    rightEmissiveCorePositions[rIdx + 3] = pos.x + right.x * coreOuterLat + up.x * coreDrop;
    rightEmissiveCorePositions[rIdx + 4] = pos.y + right.y * coreOuterLat + up.y * coreDrop;
    rightEmissiveCorePositions[rIdx + 5] = pos.z + right.z * coreOuterLat + up.z * coreDrop;

    // Sculpted Dark Volcanic Gravel Banks (starting outside viaduct aprons to prevent Z-fighting)
    const gravelInnerLat = halfW + 3.85;
    const gravelOuterLat = innerLat + 0.35;
    const gravelWave = Math.sin(u * Math.PI * 16.0) * 0.22;
    leftGravelPositions[rIdx] = pos.x - right.x * (gravelOuterLat + gravelWave) + up.x * (riverDrop - 0.06);
    leftGravelPositions[rIdx + 1] = pos.y - right.y * (gravelOuterLat + gravelWave) + up.y * (riverDrop - 0.06);
    leftGravelPositions[rIdx + 2] = pos.z - right.z * (gravelOuterLat + gravelWave) + up.z * (riverDrop - 0.06);
    leftGravelPositions[rIdx + 3] = pos.x - right.x * gravelInnerLat - up.x * 0.32;
    leftGravelPositions[rIdx + 4] = pos.y - right.y * gravelInnerLat - up.y * 0.32;
    leftGravelPositions[rIdx + 5] = pos.z - right.z * gravelInnerLat - up.z * 0.32;

    rightGravelPositions[rIdx] = pos.x + right.x * gravelInnerLat - up.x * 0.32;
    rightGravelPositions[rIdx + 1] = pos.y + right.y * gravelInnerLat - up.y * 0.32;
    rightGravelPositions[rIdx + 2] = pos.z + right.z * gravelInnerLat - up.z * 0.32;
    rightGravelPositions[rIdx + 3] = pos.x + right.x * (gravelOuterLat - gravelWave) + up.x * (riverDrop - 0.06);
    rightGravelPositions[rIdx + 4] = pos.y + right.y * (gravelOuterLat - gravelWave) + up.y * (riverDrop - 0.06);
    rightGravelPositions[rIdx + 5] = pos.z + right.z * (gravelOuterLat - gravelWave) + up.z * (riverDrop - 0.06);

    const rUvIdx = i * 2 * 2;
    riverUvs[rUvIdx] = 0;
    riverUvs[rUvIdx + 1] = u * 12.0;
    riverUvs[rUvIdx + 2] = 1;
    riverUvs[rUvIdx + 3] = u * 12.0;

    gravelUvs[rUvIdx] = 0;
    gravelUvs[rUvIdx + 1] = u * 22.0;
    gravelUvs[rUvIdx + 2] = 1;
    gravelUvs[rUvIdx + 3] = u * 22.0;

    if (i < lenSteps) {
      const ra = i * 2;
      const rb = i * 2 + 1;
      const rc = (i + 1) * 2;
      const rd = (i + 1) * 2 + 1;
      riverIndices.push(ra, rb, rc, rb, rd, rc);
    }

    // Vaulted Cavern Arch cross-section wrapping from right channel (-0.08*PI) over ceiling to left channel (1.08*PI)
    for (let j = 0; j <= arcSteps; j++) {
      const v = j / arcSteps;
      const theta = THREE.MathUtils.lerp(-0.08 * Math.PI, 1.08 * Math.PI, v);
      const archSin = Math.sin(theta);
      const archCos = Math.cos(theta);

      // Organic craggy rock displacement on cavern walls & ceiling (never intruding inside 21.5m radius!)
      const cragWave =
        Math.sin(u * Math.PI * 18.0 + v * Math.PI * 9.0) * 1.35 +
        Math.cos(u * Math.PI * 31.0 - v * Math.PI * 13.0) * 0.85;
      const portalFlare = (u < 0.08 ? (0.08 - u) / 0.08 : u > 0.92 ? (u - 0.92) / 0.08 : 0) * 3.8;

      const radLat = 22.8 + cragWave * 0.75 + portalFlare;
      const radUp = 22.4 + cragWave + portalFlare * 0.8;

      const localX = archCos * radLat;
      const localY = Math.max(-2.2, archSin * radUp);

      const vx = pos.x + right.x * localX + up.x * localY;
      const vy = pos.y + right.y * localX + up.y * localY;
      const vz = pos.z + right.z * localX + up.z * localY;

      const pIdx = (i * (arcSteps + 1) + j) * 3;
      vaultPositions[pIdx] = vx;
      vaultPositions[pIdx + 1] = vy;
      vaultPositions[pIdx + 2] = vz;

      const uIdx = (i * (arcSteps + 1) + j) * 2;
      vaultUvs[uIdx] = v;
      vaultUvs[uIdx + 1] = u;

      if (i < lenSteps && j < arcSteps) {
        const a = i * (arcSteps + 1) + j;
        const b = a + 1;
        const c = (i + 1) * (arcSteps + 1) + j;
        const d = c + 1;
        vaultIndices.push(a, b, c, b, d, c);
      }
    }
  }

  const vaultGeo = new THREE.BufferGeometry();
  vaultGeo.setAttribute('position', new THREE.BufferAttribute(vaultPositions, 3));
  vaultGeo.setAttribute('uv', new THREE.BufferAttribute(vaultUvs, 2));
  vaultGeo.setIndex(vaultIndices);
  vaultGeo.computeVertexNormals();

  const cavernWallMat = createCavernWallShaderMaterial(textures, isNeon);
  animatedShaders.push(cavernWallMat);
  worldGroup.add(new THREE.Mesh(vaultGeo, cavernWallMat));

  // Dark Volcanic Gravel Shore Banks (07_volcanic_gravel.png) bordering the subterranean lava rivers
  const leftGravelGeo = new THREE.BufferGeometry();
  leftGravelGeo.setAttribute('position', new THREE.BufferAttribute(leftGravelPositions, 3));
  leftGravelGeo.setAttribute('uv', new THREE.BufferAttribute(gravelUvs, 2));
  leftGravelGeo.setIndex(riverIndices);
  leftGravelGeo.computeVertexNormals();

  const rightGravelGeo = new THREE.BufferGeometry();
  rightGravelGeo.setAttribute('position', new THREE.BufferAttribute(rightGravelPositions, 3));
  rightGravelGeo.setAttribute('uv', new THREE.BufferAttribute(gravelUvs, 2));
  rightGravelGeo.setIndex(riverIndices);
  rightGravelGeo.computeVertexNormals();

  const tunnelGravelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    map: textures.volcanicGravelMap,
    bumpMap: textures.volcanicGravelMap,
    bumpScale: 0.45,
    roughness: 0.88,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  worldGroup.add(new THREE.Mesh(leftGravelGeo, tunnelGravelMat));
  worldGroup.add(new THREE.Mesh(rightGravelGeo, tunnelGravelMat));

  // Subterranean Molten Lava River Meshes along both sides of the tunnel roadway
  // Powered by TheGameMaker's `webgl_shader_lava` dual-advection shader (texture1: lavaCloudMap + texture2: 03_glowing_lava.png)
  const leftRiverGeo = new THREE.BufferGeometry();
  leftRiverGeo.setAttribute('position', new THREE.BufferAttribute(leftRiverPositions, 3));
  leftRiverGeo.setAttribute('uv', new THREE.BufferAttribute(riverUvs, 2));
  leftRiverGeo.setIndex(riverIndices);

  const rightRiverGeo = new THREE.BufferGeometry();
  rightRiverGeo.setAttribute('position', new THREE.BufferAttribute(rightRiverPositions, 3));
  rightRiverGeo.setAttribute('uv', new THREE.BufferAttribute(riverUvs, 2));
  rightRiverGeo.setIndex(riverIndices);

  const tunnelRiverMat = createTheGameMakerLavaShaderMaterial(
    textures,
    new THREE.Vector2(2.4, 0.42),
    2.35,
    0.00055,
    new THREE.Color(0x0c0306),
    1.36,
    true
  );
  animatedShaders.push(tunnelRiverMat);
  worldGroup.add(new THREE.Mesh(leftRiverGeo, tunnelRiverMat));
  worldGroup.add(new THREE.Mesh(rightRiverGeo, tunnelRiverMat));

  // Subtle Emissive Magma Core Filament over the churning TheGameMaker lava river
  const leftCoreGeo = new THREE.BufferGeometry();
  leftCoreGeo.setAttribute('position', new THREE.BufferAttribute(leftEmissiveCorePositions, 3));
  leftCoreGeo.setAttribute('uv', new THREE.BufferAttribute(riverUvs, 2));
  leftCoreGeo.setIndex(riverIndices);

  const rightCoreGeo = new THREE.BufferGeometry();
  rightCoreGeo.setAttribute('position', new THREE.BufferAttribute(rightEmissiveCorePositions, 3));
  rightCoreGeo.setAttribute('uv', new THREE.BufferAttribute(riverUvs, 2));
  rightCoreGeo.setIndex(riverIndices);

  const emissiveCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  worldGroup.add(new THREE.Mesh(leftCoreGeo, emissiveCoreMat));
  worldGroup.add(new THREE.Mesh(rightCoreGeo, emissiveCoreMat));

  // Reinforced Brushed-Graphite Geothermal Containment Ribs, Portal Platforms & Jagged Obsidian Rock Spires
  const ribCount = 14;
  const archRibGeo = new THREE.TorusGeometry(21.6, 0.95, 10, 36, Math.PI);
  const archCyanTrimGeo = new THREE.TorusGeometry(21.1, 0.42, 8, 36, Math.PI);
  const archNeonGeo = new THREE.TorusGeometry(20.65, 0.22, 8, 36, Math.PI);
  const portalArchGeo = new THREE.TorusGeometry(23.2, 2.2, 12, 40, Math.PI);
  const portalThresholdDeckGeo = new THREE.BoxGeometry(halfW * 2 + 6.5, 0.55, 12.0);
  const sidePlatformPadGeo = new THREE.BoxGeometry(2.6, 0.42, 5.2);
  const tunnelObsidianSpireGeo = createJaggedObsidianOutcropGeometry(4.2);

  const archNeonMat = new THREE.MeshBasicMaterial({
    color: isNeon ? 0xff6b00 : 0x38bdf8,
    fog: false,
  });
  const portalBeaconMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    fog: false,
  });

  for (let r = 0; r <= ribCount; r++) {
    const u = r / ribCount;
    const t = THREE.MathUtils.lerp(tunnelStart, tunnelEnd, u);
    sampleTrackFrame(spline, t, pos, fwd, right, up);

    const ribHolder = new THREE.Group();
    ribHolder.position.copy(pos);
    lookTarget.copy(ribHolder.position).add(fwd);
    rotMat.lookAt(ribHolder.position, lookTarget, up);
    ribHolder.quaternion.setFromRotationMatrix(rotMat);

    const isPortal = r === 0 || r === ribCount;
    ribHolder.add(new THREE.Mesh(isPortal ? portalArchGeo : archRibGeo, brushedGraphiteMat));
    ribHolder.add(new THREE.Mesh(archCyanTrimGeo, cyanTrimPanelMat));
    ribHolder.add(
      new THREE.Mesh(archNeonGeo, isPortal ? portalBeaconMat : r % 2 === 0 ? cyanLightStripMat : archNeonMat)
    );

    // Hard-surface segmented platform decks (01_roadway_panels.png) positioned cleanly below road deck to prevent Z-fighting
    if (isPortal) {
      const portalDeck = new THREE.Mesh(portalThresholdDeckGeo, platformPanelMat);
      portalDeck.position.set(0, -0.58, 0);
      ribHolder.add(portalDeck);
    } else if (r % 2 === 0) {
      for (const side of [-1, 1]) {
        const sidePad = new THREE.Mesh(sidePlatformPadGeo, platformPanelMat);
        sidePad.position.set(side * (halfW + 4.8), -0.38, 0);
        ribHolder.add(sidePad);
      }
    }

    // 3D Jagged Obsidian Rock Formations (02_obsidian_rock.png) jutting out along the outer lava riverbanks
    for (const side of [-1, 1]) {
      const rockSpire = new THREE.Mesh(tunnelObsidianSpireGeo, obsidianRockMat);
      rockSpire.position.set(side * (halfW + 7.2), -2.2, 1.8);
      rockSpire.scale.set(2.4, 5.5 + (r % 3) * 1.8, 2.4);
      rockSpire.rotation.y = r * 1.1 + side * 0.5;
      rockSpire.rotation.z = side * 0.18;
      ribHolder.add(rockSpire);
    }

    // Portal Entrance & Exit Twin Lava Aqueduct Cascades flanking the tunnel gates!
    if (isPortal && isNeon) {
      const portalCascadeGeo = new THREE.PlaneGeometry(5.5, 22.0);
      for (const side of [-1, 1]) {
        const cascade = new THREE.Mesh(portalCascadeGeo, fallMat);
        cascade.position.set(side * 20.5, 9.5, 0);
        cascade.rotation.y = side * -0.35;
        ribHolder.add(cascade);
      }
    }

    worldGroup.add(ribHolder);
  }

  // 10 Scenic Interior Molten Lava Waterfalls & Glowing Splash Pools pouring down the Cavern Walls!
  if (isNeon) {
    const interiorFallGeo = new THREE.PlaneGeometry(7.2, 21.5, 8, 8);
    const splashFlareMat = new THREE.SpriteMaterial({
      map: textures.thrusterFlareMap,
      color: 0xff6600,
      transparent: true,
      opacity: 0.30,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const stalactiteGeo = createJaggedObsidianOutcropGeometry(7.9);
    stalactiteGeo.rotateX(Math.PI);

    const fallCount = 10;
    for (let f = 0; f < fallCount; f++) {
      const u = (f + 0.8) / (fallCount + 0.6);
      const t = THREE.MathUtils.lerp(tunnelStart, tunnelEnd, u);
      sampleTrackFrame(spline, t, pos, fwd, right, up);

      const fallGroup = new THREE.Group();
      fallGroup.position.copy(pos);
      lookTarget.copy(fallGroup.position).add(fwd);
      rotMat.lookAt(fallGroup.position, lookTarget, up);
      fallGroup.quaternion.setFromRotationMatrix(rotMat);

      const side = f % 2 === 0 ? -1 : 1;
      const fallMesh = new THREE.Mesh(interiorFallGeo, fallMat);
      // Angled from upper cavern ceiling fissure (x = ±16.5, y = 17.5) down into side lava river (x = ±18.5, y = 0)
      fallMesh.position.set(side * 17.6, 8.8, 0);
      fallMesh.rotation.y = side * -Math.PI * 0.46;
      fallMesh.rotation.x = side * 0.12;
      fallGroup.add(fallMesh);

      const splash = new THREE.Sprite(splashFlareMat);
      splash.position.set(side * 17.2, 0.2, 0);
      splash.scale.set(14, 7, 1);
      fallGroup.add(splash);

      // 3D Jagged Obsidian Stalactites hanging from the high cavern ceiling crown (y = 20.5m, well above rings!)
      const stal = new THREE.Mesh(stalactiteGeo, obsidianRockMat);
      stal.position.set(side * 5.5, 21.8, 0);
      stal.scale.set(1.6, 4.8, 1.6);
      fallGroup.add(stal);

      worldGroup.add(fallGroup);
    }
  }

  // ============================================================================
  // PART C: SET-PIECE 2 — GEOTHERMAL REFINERY CORE & LASER GANTRY CORRIDOR (t in [0.745, 0.798])
  // High-altitude industrial geothermal reactor gallery with 10 armored containment
  // arches, twin overhead magma-plasma conduits, and basalt turbine buttresses!
  // ============================================================================
  {
    const refineryStart = 0.745;
    const refineryEnd = 0.798;
    const refineryArchCount = 10;
    const refArchGeo = new THREE.TorusGeometry(halfW + 6.4, 0.85, 10, 36, Math.PI);
    const refInnerNeonGeo = new THREE.TorusGeometry(halfW + 5.5, 0.28, 8, 36, Math.PI);
    const refPillarGeo = new THREE.BoxGeometry(2.4, 14.0, 2.8);
    const refTurbinePodGeo = new THREE.CylinderGeometry(1.6, 2.1, 8.5, 10);
    const refConduitGeo = new THREE.CylinderGeometry(0.45, 0.45, 28.0, 8);
    refConduitGeo.rotateX(Math.PI / 2);

    const orangePlasmaMat = createRingPlasmaTubeMaterial(0xfef08a, 0xff5500);
    animatedShaders.push(orangePlasmaMat);

    for (let r = 0; r <= refineryArchCount; r++) {
      const u = r / refineryArchCount;
      const t = THREE.MathUtils.lerp(refineryStart, refineryEnd, u);
      sampleTrackFrame(spline, t, pos, fwd, right, up);

      const refGroup = new THREE.Group();
      refGroup.position.copy(pos);
      lookTarget.copy(refGroup.position).add(fwd);
      rotMat.lookAt(refGroup.position, lookTarget, up);
      refGroup.quaternion.setFromRotationMatrix(rotMat);

      const archMesh = new THREE.Mesh(refArchGeo, brushedGraphiteMat);
      archMesh.position.y = 2.0;
      archMesh.layers.enable(TRACK_SSAO_LAYER);
      refGroup.add(archMesh);

      const neonMesh = new THREE.Mesh(
        refInnerNeonGeo,
        r % 2 === 0 ? cyanLightStripMat : orangePlasmaMat
      );
      neonMesh.position.y = 2.0;
      refGroup.add(neonMesh);

      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(refPillarGeo, brushedGraphiteMat);
        pillar.position.set(side * (halfW + 6.2), 3.2, 0);
        pillar.layers.enable(TRACK_SSAO_LAYER);
        refGroup.add(pillar);

        const turbinePod = new THREE.Mesh(refTurbinePodGeo, cyanTrimPanelMat);
        turbinePod.position.set(side * (halfW + 8.4), 5.6, 0);
        refGroup.add(turbinePod);
      }

      if (r < refineryArchCount && r % 2 === 0) {
        for (const side of [-1, 1]) {
          const conduit = new THREE.Mesh(refConduitGeo, orangePlasmaMat);
          conduit.position.set(side * (halfW + 4.2), 14.5, 12.0);
          refGroup.add(conduit);
        }
      }

      worldGroup.add(refGroup);
    }
  }

  // ============================================================================
  // PART D: SET-PIECE 3 — ELEVATED MAGMA VIADUCT OVERPASS (t in [0.822, 0.854])
  // Crosses 30.0m cleanly above the Sector 2 Obsidian Trench Underpass at (420, -140)
  // with overhead brushed-graphite suspension trusses and twin cascading lava falls!
  // ============================================================================
  {
    const viaductStart = 0.822;
    const viaductEnd = 0.854;
    const trussCount = 8;
    const towerGeo = new THREE.BoxGeometry(1.9, 18.5, 2.2);
    const crossGantryGeo = new THREE.BoxGeometry((halfW + 4.8) * 2, 1.5, 2.0);
    const neonSpanGeo = new THREE.BoxGeometry((halfW + 4.2) * 2, 0.28, 0.42);

    for (let k = 0; k <= trussCount; k++) {
      const u = k / trussCount;
      const t = THREE.MathUtils.lerp(viaductStart, viaductEnd, u);
      sampleTrackFrame(spline, t, pos, fwd, right, up);

      const vGroup = new THREE.Group();
      vGroup.position.copy(pos);
      lookTarget.copy(vGroup.position).add(fwd);
      rotMat.lookAt(vGroup.position, lookTarget, up);
      vGroup.quaternion.setFromRotationMatrix(rotMat);

      for (const side of [-1, 1]) {
        const tower = new THREE.Mesh(towerGeo, brushedGraphiteMat);
        tower.position.set(side * (halfW + 3.8), 7.8, 0);
        tower.layers.enable(TRACK_SSAO_LAYER);
        vGroup.add(tower);
      }

      const crossBeam = new THREE.Mesh(crossGantryGeo, brushedGraphiteMat);
      crossBeam.position.set(0, 16.4, 0);
      crossBeam.layers.enable(TRACK_SSAO_LAYER);
      vGroup.add(crossBeam);

      const neonSpan = new THREE.Mesh(
        neonSpanGeo,
        k % 2 === 0 ? cyanLightStripMat : archNeonMat
      );
      neonSpan.position.set(0, 15.4, 0);
      vGroup.add(neonSpan);

      worldGroup.add(vGroup);
    }
  }
}

/**
 * Custom GLSL Volumetric God-Rays / Crepuscular Light Shafts Shader for the Central Erupting Volcano
 * Simulates dramatic volumetric light beams piercing through rising pyroclastic ash & sulfur clouds
 */
function createVolumetricVolcanoRaysShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnableVolumetric: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vViewNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uEnableVolumetric;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vWorldPos;

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
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.08;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        // vUv.y: 0 at caldera crater source, 1 at high outer sky termination
        float distAlongRay = vUv.y;

        // Animated radial crepuscular light striations & rising ash shadow occlusion
        float rayStriation = 0.55 + 0.45 * sin(vUv.x * 37.699 + uTime * 0.45 + fbm(vec2(vUv.x * 8.0, distAlongRay * 2.5 - uTime * 0.35)) * 4.2);
        float ashShadow = smoothstep(0.24, 0.78, fbm(vec2(vUv.x * 5.0 + uTime * 0.12, distAlongRay * 3.8 - uTime * 0.62)));

        // Soft Fresnel silhouette falloff so cone geometry edges are 100% invisible
        float fresnelSoft = pow(abs(vViewNormal.z), 1.75);
        float longitudinalFade = smoothstep(0.0, 0.14, distAlongRay) * pow(1.0 - distAlongRay, 1.65);

        // Near-camera safety fade so rays never wash out if camera orbits close
        float camDist = length(cameraPosition - vWorldPos);
        float nearGuard = smoothstep(35.0, 110.0, camDist);

        vec3 coreGold = vec3(1.18, 0.76, 0.28);
        vec3 midAmber = vec3(0.95, 0.32, 0.04);
        vec3 outerCrimson = vec3(0.48, 0.06, 0.015);
        vec3 rayCol = mix(coreGold, midAmber, smoothstep(0.05, 0.48, distAlongRay));
        rayCol = mix(rayCol, outerCrimson, smoothstep(0.45, 0.92, distAlongRay));

        float alpha = longitudinalFade * fresnelSoft * rayStriation * (0.45 + 0.55 * ashShadow) * nearGuard * 0.22 * uEnableVolumetric;
        gl_FragColor = vec4(rayCol, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
}

/**
 * GPU-Animated Rising Lava Ember & Thermal Spark Plume System (`lava_v2`)
 * Simulates hundreds of buoyant incandescent embers rising from the magma sea, trackside lava pools,
 * and the central erupting Stratovolcano with helical thermal updraft swirl.
 */
function createRisingLavaEmbersSystem(
  spline: THREE.CatmullRomCurve3,
  volcanoWorldPos: THREE.Vector3,
  volcanoHeight: number,
  animatedShaders: THREE.ShaderMaterial[]
): THREE.Points {
  const emberCount = 1440;
  const positions = new Float32Array(emberCount * 3);
  const phases = new Float32Array(emberCount);
  const speeds = new Float32Array(emberCount);
  const rises = new Float32Array(emberCount);
  const colors = new Float32Array(emberCount * 3);

  const samplePos = new THREE.Vector3();
  const sampleFwd = new THREE.Vector3();
  const sampleRight = new THREE.Vector3();
  const sampleUp = new THREE.Vector3();
  const c = new THREE.Color();
  const emberPalette = [0xfff08a, 0xffaa00, 0xff5500, 0xff2a00, 0xf97316];

  for (let i = 0; i < emberCount; i++) {
    let bx = 0;
    let by = -42;
    let bz = 0;
    let maxRise = 95;

    if (i < 960) {
      // 960 embers rising from lava channels & magma sea along the entire 2.5x extended circuit corridor
      const t = (i / 960) % 1;
      sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);
      const side = i % 2 === 0 ? -1 : 1;
      const lateral = TRACK_HALF_WIDTH + 8.0 + ((i * 17) % 58);
      bx = samplePos.x + sampleRight.x * side * lateral + Math.sin(i * 2.1) * 8.0;
      bz = samplePos.z + sampleRight.z * side * lateral + Math.cos(i * 1.7) * 8.0;
      by = i % 3 === 0 ? samplePos.y - 10.0 : -43.0;
      maxRise = i % 3 === 0 ? 48 + (i % 24) : 95 + (i % 45);
    } else {
      // 480 high-altitude embers rising in a thermal column from the Central Volcano caldera & flanks
      const angle = (i * 2.39996) % (Math.PI * 2);
      const rad = 12 + ((i * 13) % 145);
      bx = volcanoWorldPos.x + Math.cos(angle) * rad;
      bz = volcanoWorldPos.z + Math.sin(angle) * rad;
      by = volcanoWorldPos.y + volcanoHeight * (0.45 + 0.52 * (1 - rad / 160));
      maxRise = 135 + (i % 70);
    }

    positions[i * 3] = bx;
    positions[i * 3 + 1] = by;
    positions[i * 3 + 2] = bz;

    phases[i] = (i * 0.6180339887) % 1.0;
    speeds[i] = 0.065 + (i % 9) * 0.014;
    rises[i] = maxRise;

    c.setHex(emberPalette[i % emberPalette.length]);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geo.setAttribute('aRise', new THREE.BufferAttribute(rises, 1));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnableRisingEmbers: { value: 1.0 },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aRise;
      attribute vec3 color;
      uniform float uTime;
      varying vec3 vColor;
      varying float vLife;
      varying float vFlicker;

      void main() {
        vColor = color;
        float life = fract(aPhase + uTime * aSpeed);
        vLife = life;

        // Buoyant upward rise with helical convective thermal updraft swirl
        float swirlAngle = uTime * (1.2 + aSpeed * 6.0) + aPhase * 25.1327 + life * 6.2831;
        float swirlRadius = (1.5 + life * 6.5) * (0.6 + 0.4 * sin(aPhase * 43.0));
        vec3 displaced = position;
        displaced.y += life * aRise;
        displaced.x += cos(swirlAngle) * swirlRadius;
        displaced.z += sin(swirlAngle) * swirlRadius;

        vFlicker = 0.72 + 0.28 * sin(uTime * 11.0 + aPhase * 62.8);

        vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float dist = max(12.0, -mvPosition.z);
        gl_PointSize = clamp((210.0 / dist) * sin(life * 3.14159265), 1.5, 11.0);
      }
    `,
    fragmentShader: `
      uniform float uEnableRisingEmbers;
      varying vec3 vColor;
      varying float vLife;
      varying float vFlicker;

      void main() {
        if (uEnableRisingEmbers < 0.01) discard;
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;

        float core = exp(-r2 * 4.2);
        float envelope = sin(vLife * 3.14159265);
        vec3 hotCore = mix(vColor, vec3(1.35, 1.18, 0.72), core * 0.65);
        float alpha = core * envelope * vFlicker * 0.88 * uEnableRisingEmbers;
        gl_FragColor = vec4(hotCore, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });

  animatedShaders.push(mat);
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

function buildLavaEnvironment(
  worldGroup: THREE.Group,
  spline: THREE.CatmullRomCurve3,
  textures: TrackTextureSet,
  isNeon: boolean,
  neonIntensity: number,
  animatedShaders: THREE.ShaderMaterial[],
  isLavaV2 = false
): THREE.Mesh | null {
  const trackSamples = buildTrackSamplesXZ(spline, 720);

  // Sample 3D points along the Volcano-Base Tunnel corridor (t in [0.135, 0.183])
  // AND along all open-air track sectors outside the tunnel so the Stratovolcano never invades open-air road!
  const tunnelSamples3D: Array<{ x: number; y: number; z: number }> = [];
  const openAirSamples3D: Array<{ x: number; y: number; z: number }> = [];
  const tSample = new THREE.Vector3();
  for (let s = 0; s <= 110; s++) {
    const t = THREE.MathUtils.lerp(0.135, 0.183, s / 110);
    spline.getPointAt(t, tSample);
    tunnelSamples3D.push({ x: tSample.x, y: tSample.y, z: tSample.z });
  }
  for (let s = 0; s < 720; s++) {
    const t = s / 720;
    if (t < 0.132 || t > 0.186) {
      spline.getPointAt(t, tSample);
      openAirSamples3D.push({ x: tSample.x, y: tSample.y, z: tSample.z });
    }
  }

  // 0. Glowing Molten Magma Sea / Caldera Floor beneath the elevated viaduct (expanded to 3400x3400 for 2.5x extended loop)
  // Subdivided 160x160 mesh on lava_v2 for genuine 3D vertex-displaced undulating liquid magma swells,
  // dark charcoal cooling basalt crust plates, and thermal refraction heat shimmer
  const floorSegs = isLavaV2 ? 160 : 32;
  const magmaFloorGeo = new THREE.PlaneGeometry(3400, 3400, floorSegs, floorSegs);
  magmaFloorGeo.rotateX(-Math.PI / 2);
  const magmaFloorMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIsNeon: { value: isNeon ? 1.0 : 0.0 },
      uIsV2: { value: isLavaV2 ? 1.0 : 0.0 },
      uEnableDisplacement: { value: 1.0 },
      uvScale: { value: new THREE.Vector2(isLavaV2 ? 52.0 : 46.0, isLavaV2 ? 52.0 : 46.0) },
      fogDensity: { value: 0.00088 },
      fogColor: { value: new THREE.Color(isNeon ? 0x050204 : 0x1e293b) },
      texture1: { value: textures.lavaCloudMap },
      texture2: { value: textures.glowingLavaMap },
      uGravelTex: { value: textures.volcanicGravelMap },
      uBasaltAlbedo: { value: textures.volcanicBasaltAlbedoMap },
      uBasaltLavaMask: { value: textures.volcanicBasaltLavaMaskMap },
    },
    vertexShader: `
      uniform vec2 uvScale;
      uniform float uTime;
      uniform float uIsV2;
      uniform float uEnableDisplacement;
      uniform sampler2D texture1;
      varying vec2 vUv;
      varying float vWaveCrest;

      void main() {
        vUv = uvScale * uv;
        vec3 pos = position;

        // Multi-directional undulating liquid magma swells & convective domes (active on lava_v2)
        float time = uTime * 1.35;
        vec4 vNoise = texture2D(texture1, vUv * 0.14 + vec2(time * 0.018, -time * 0.014));
        float swellA = sin(pos.x * 0.038 + time * 1.85 + vNoise.r * 3.4) * cos(pos.z * 0.034 - time * 1.45);
        float swellB = cos((pos.x - pos.z) * 0.052 - time * 2.35 + vNoise.g * 2.8) * 0.55;
        float convectiveDome = (vNoise.a - 0.48) * 1.65;
        float waveHeight = (swellA * 1.45 + swellB * 0.95 + convectiveDome * 1.15) * (0.35 + 0.65 * uIsV2) * uEnableDisplacement;

        pos.y += waveHeight;
        vWaveCrest = clamp(waveHeight * 0.25 + 0.5, 0.0, 1.0);

        vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIsNeon;
      uniform float uIsV2;
      uniform float uEnableDisplacement;
      uniform float fogDensity;
      uniform vec3 fogColor;
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D uGravelTex;
      uniform sampler2D uBasaltAlbedo;
      uniform sampler2D uBasaltLavaMask;
      varying vec2 vUv;
      varying float vWaveCrest;

      void main( void ) {
        float time = uTime * 1.48;

        // Refractive thermal heat-distortion shimmer across the undulating liquid surface
        vec2 heatShimmer = vec2(
          sin(vUv.y * 18.0 + time * 4.4 + vWaveCrest * 3.2),
          cos(vUv.x * 16.0 - time * 3.9 + vWaveCrest * 2.8)
        ) * (0.016 + 0.014 * uIsV2 * vWaveCrest) * uEnableDisplacement;

        vec2 distortedUv = vUv + heatShimmer;

        // Multi-scale curl-like domain warp for viscous convective magma currents
        vec4 noiseA = texture2D( texture1, distortedUv * 0.65 + vec2( time * 0.014, -time * 0.011 ) );
        vec4 noiseB = texture2D( texture1, distortedUv * 1.35 + vec2( -time * 0.019, time * 0.016 ) );
        vec2 curlWarp = ( noiseA.xy - 0.5 ) * 0.85 + ( noiseB.yz - 0.5 ) * 0.45;

        vec2 T1 = distortedUv + vec2( 1.6, -1.3 ) * time * 0.024 + curlWarp * 1.35;
        vec2 T2 = distortedUv + vec2( -0.8, 1.9 ) * time * 0.015 - curlWarp * 0.65;

        float p1 = texture2D( texture1, T1 * 1.75 ).a;
        float p2 = texture2D( texture1, T2 * 2.45 ).r;
        float p = mix( p1, p2, 0.42 );

        vec4 color = texture2D( texture2, T2 * 1.85 );
        vec4 temp = color * ( vec4( p, p, p, p ) * 2.1 ) + ( color * color - 0.08 );

        // Physical blackbody thermal gradient accentuated at undulating liquid wave crests
        float heat = clamp( dot( temp.rgb, vec3( 0.44, 0.38, 0.18 ) ) * 0.88 + (vWaveCrest - 0.5) * 0.24, 0.0, 1.45 );
        vec3 deepCrimson = vec3( 0.38, 0.03, 0.008 );
        vec3 blazingOrange = vec3( 0.96, 0.24, 0.018 );
        vec3 liquidGold = vec3( 1.24, 0.70, 0.12 );
        vec3 whiteHot = vec3( 1.35, 1.06, 0.58 );

        vec3 blackbody = mix( deepCrimson, blazingOrange, smoothstep( 0.14, 0.50, heat ) );
        blackbody = mix( blackbody, liquidGold, smoothstep( 0.50, 0.88, heat ) );
        blackbody = mix( blackbody, whiteHot, smoothstep( 0.88, 1.28, heat ) * 0.55 );

        // Dark charcoal/obsidian cooled basalt crust plates carried atop the moving lava sea
        vec2 crustUv = distortedUv * 0.92 + vec2( time * 0.012, -time * 0.009 ) + curlWarp * 0.28;
        vec3 gravelCol = texture2D( uGravelTex, crustUv * 1.25 ).rgb * 0.09;
        vec3 basaltCol = texture2D( uBasaltAlbedo, crustUv ).rgb * 0.08;
        float basaltMask = texture2D( uBasaltLavaMask, crustUv ).r;
        vec3 crustCol = mix( gravelCol, basaltCol, 0.65 );

        // Sharply defined glowing arterial lava channels winding between dark cooling basalt plates (not an orange wash!)
        float magmaActivity = p + basaltMask * 0.32 + (vWaveCrest - 0.5) * 0.18;
        float channelFlow = smoothstep( 0.34, 0.64, magmaActivity );
        float rimSubsurface = smoothstep( 0.22, 0.36, magmaActivity ) * ( 1.0 - channelFlow );
        crustCol += vec3( 0.72, 0.11, 0.01 ) * rimSubsurface * 0.55;

        vec3 baseLavaPlate = texture2D( texture2, distortedUv * 1.35 + vec2( uTime * 0.018, -uTime * 0.012 ) + curlWarp * 0.22 ).rgb;
        vec3 lavaCol = mix( baseLavaPlate * 1.05, blackbody, 0.76 );
        vec3 finalRgb = uIsNeon > 0.5 ? mix( crustCol, lavaCol, channelFlow ) : crustCol * 1.85;

        gl_FragColor = vec4( finalRgb, 1.0 );

        float depth = gl_FragCoord.z / gl_FragCoord.w;
        const float LOG2 = 1.442695;
        float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
        fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );

        gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );
      }
    `,
    fog: false,
  });
  const magmaFloor = new THREE.Mesh(magmaFloorGeo, magmaFloorMat);
  magmaFloor.position.set(620, -45, -180);
  worldGroup.add(magmaFloor);
  animatedShaders.push(magmaFloorMat);

  // Shared High-Detail Volcanic Basalt PBR, Waterfall & Fluid Slope Lava Shader Materials
  const volcanoShaderMat = createVolcanicTerrainShaderMaterial(textures, isNeon, true, 305, 1.05, isLavaV2);
  const secondaryVolcanoShaderMat = createVolcanicTerrainShaderMaterial(textures, isNeon, true, 282, 0.95, isLavaV2);
  const heroMountainShaderMat = createVolcanicTerrainShaderMaterial(textures, isNeon, false, 265, 0.78, isLavaV2);
  const mountainShaderMat = createVolcanicTerrainShaderMaterial(textures, isNeon, false, 1.0, 0.68, isLavaV2);
  const fallMat = createLavaWaterfallShaderMaterial(textures);
  const slopeLavaShaderMat = createTheGameMakerLavaShaderMaterial(
    textures,
    new THREE.Vector2(9.0, 2.2),
    2.25,
    0.00052,
    new THREE.Color(0x050204),
    1.22,
    false,
    new THREE.Vector2(1.0, 0.22),
    isLavaV2 ? 0.52 : 0.25
  );
  const calderaLavaTorusMat = createTheGameMakerLavaShaderMaterial(
    textures,
    new THREE.Vector2(4.0, 1.5),
    1.85,
    0.00045,
    new THREE.Color(0x050204),
    1.18,
    false,
    new THREE.Vector2(0.85, 0.45),
    isLavaV2 ? 0.65 : 0.30
  );
  const eruptionPlumeMat = createEruptionPlumeShaderMaterial();
  const volumetricRaysMat = createVolumetricVolcanoRaysShaderMaterial();
  animatedShaders.push(
    volcanoShaderMat,
    secondaryVolcanoShaderMat,
    heroMountainShaderMat,
    mountainShaderMat,
    fallMat,
    slopeLavaShaderMat,
    calderaLavaTorusMat,
    eruptionPlumeMat,
    volumetricRaysMat
  );

  // Exact radial surface coordinate helper matching `createDisplacedMountainGeometry`
  // so 3D sculpted fluid lava rivers hug the mountain massif flanks cleanly
  const evalMassifRadiusAt = (
    y: number,
    a: number,
    baseRadius: number,
    height: number,
    seed: number,
    openTop: boolean
  ) => {
    const hFrac = THREE.MathUtils.clamp(y / height, 0, 1);
    const topRadius = openTop ? baseRadius * 0.24 : baseRadius * 0.44;
    const expectedRingR = THREE.MathUtils.lerp(baseRadius, topRadius, hFrac);
    const radialMult = computeMassifRadialMultiplier(hFrac, a, seed, openTop);
    return Math.max(10, expectedRingR * radialMult - 0.5);
  };

  // Build the High-Speed Parabolic Curve ("Caldera Parabolica") & Volcano-Base Magma Cavern Tunnel!
  buildParabolicaAndVolcanoTunnel(worldGroup, spline, textures, isNeon, fallMat, animatedShaders);

  // 1. Colossal Primary Erupting Stratovolcano Massif Towering Over the Eastern Volcano-Tunnel Sector!
  // Verified via `ensureTrackClearanceXZ` so neither the massif nor any of its 16 3D fluid lava rivers
  // ever encroaches on the open-air roadway or tunnel portals!
  const volcanoBaseRadius = 186;
  const volcanoHeight = 310;
  const safeVolcanoPos = ensureTrackClearanceXZ(515, -395, volcanoBaseRadius + 24, trackSamples, 56);
  const volcanoWorldX = safeVolcanoPos.x;
  const volcanoWorldY = -44;
  const volcanoWorldZ = safeVolcanoPos.z;

  const volcanoGroup = new THREE.Group();
  volcanoGroup.position.set(volcanoWorldX, volcanoWorldY, volcanoWorldZ);

  const volcanoGeo = createDisplacedMountainGeometry(
    volcanoBaseRadius,
    volcanoHeight,
    120,
    68,
    1.0,
    true,
    {
      worldX: volcanoWorldX,
      worldY: volcanoWorldY,
      worldZ: volcanoWorldZ,
      samples: tunnelSamples3D,
      openAirSamples: openAirSamples3D,
    }
  );
  const volcanoMesh = new THREE.Mesh(volcanoGeo, volcanoShaderMat);
  volcanoGroup.add(volcanoMesh);

  let lavaFallsMesh: THREE.Mesh | null = null;
  if (isNeon) {
    // Multi-Layer Volumetric Caldera Eruption Plume, Rising Pyroclastic Fire Cloud & Radial Eruption Rays
    const plumeColumnGeo = new THREE.CylinderGeometry(86, 32, 195, 36, 18, true);
    plumeColumnGeo.translate(0, volcanoHeight + 70, 0);
    lavaFallsMesh = new THREE.Mesh(plumeColumnGeo, eruptionPlumeMat);
    volcanoGroup.add(lavaFallsMesh);

    // Volumetric Lighting Rays (God-Rays) radiating from the Central Stratovolcano Caldera!
    const rayCount = isLavaV2 ? 14 : 8;
    const rayGroup = new THREE.Group();
    rayGroup.position.set(0, volcanoHeight - 6.0, 0);
    for (let rayIdx = 0; rayIdx < rayCount; rayIdx++) {
      const rayAngle = (rayIdx / rayCount) * Math.PI * 2 + (rayIdx % 2) * 0.14;
      const rayLength = 285 + (rayIdx % 4) * 45;
      const topSpread = 52 + (rayIdx % 3) * 18;
      const rayConeGeo = new THREE.CylinderGeometry(topSpread, 11.0, rayLength, 20, 1, true);
      rayConeGeo.translate(0, rayLength * 0.5, 0);

      const rayPivot = new THREE.Group();
      rayPivot.rotation.y = rayAngle;
      // Fan volumetric rays outward at dramatic crepuscular angles (22° to 46° from vertical)
      rayPivot.rotation.z = 0.38 + (rayIdx % 4) * 0.11;
      rayPivot.add(new THREE.Mesh(rayConeGeo, volumetricRaysMat));
      rayGroup.add(rayPivot);
    }
    volcanoGroup.add(rayGroup);

    // Wide Boiling Caldera Magma Lake & Rim Torus nestled inside the Volcano Summit Crater
    const calderaLavaTorusGeo = new THREE.TorusGeometry(28.0, 6.2, 28, 56);
    calderaLavaTorusGeo.rotateX(Math.PI * 0.5);
    const calderaLavaTorusMesh = new THREE.Mesh(calderaLavaTorusGeo, calderaLavaTorusMat);
    calderaLavaTorusMesh.position.set(0, volcanoHeight - 4.5, 0);
    volcanoGroup.add(calderaLavaTorusMesh);

    const calderaLakeDiskGeo = new THREE.PlaneGeometry(58, 58, 28, 28);
    calderaLakeDiskGeo.rotateX(-Math.PI * 0.5);
    const calderaLakeDiskMesh = new THREE.Mesh(calderaLakeDiskGeo, calderaLavaTorusMat);
    calderaLakeDiskMesh.position.set(0, volcanoHeight - 6.8, 0);
    volcanoGroup.add(calderaLakeDiskMesh);

    // Restrained Caldera Summit Glow Halo
    const outerEruptionFlareMat = new THREE.SpriteMaterial({
      map: textures.thrusterFlareMap,
      color: 0xff4500,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const outerEruptionSprite = new THREE.Sprite(outerEruptionFlareMat);
    outerEruptionSprite.position.set(-4, volcanoHeight + 10, 12);
    outerEruptionSprite.scale.set(145, 85, 1);
    volcanoGroup.add(outerEruptionSprite);

    // Ejected Glowing Magma Bombs / Pyroclastic Boulders around the erupting peak
    const bombGeo = new THREE.DodecahedronGeometry(2.6, 0);
    const bombMat = new THREE.MeshBasicMaterial({ color: 0xff9500, fog: false });
    for (let b = 0; b < 18; b++) {
      const bAngle = (b / 18) * Math.PI * 2 + b * 0.4;
      const bRad = 20 + (b % 5) * 12;
      const bHeight = volcanoHeight + 14 + (b % 5) * 20;
      const bomb = new THREE.Mesh(bombGeo, bombMat);
      bomb.position.set(Math.cos(bAngle) * bRad, bHeight, Math.sin(bAngle) * bRad);
      bomb.scale.setScalar(0.6 + (b % 4) * 0.25);
      volcanoGroup.add(bomb);
    }

    // 16 Wide, Viscous 3D Branching Fluid Lava Rivers with high-subdivision vertex displacement flowing down the Stratovolcano flanks
    for (let r = 0; r < 16; r++) {
      const riverAngle = (r / 16) * Math.PI * 2;
      const sway = (r % 2 === 0 ? 1 : -1) * 0.05;
      const rAt = (y: number, a: number) =>
        evalMassifRadiusAt(y, a, volcanoBaseRadius, volcanoHeight, 1.0, true);

      const a0 = riverAngle;
      const a1 = riverAngle + sway;
      const a2 = riverAngle - sway * 0.85;
      const a3 = riverAngle + sway * 0.5;
      const a4 = riverAngle - sway * 0.3;
      const riverPts = [
        new THREE.Vector3(Math.cos(a0) * rAt(282, a0), 282, Math.sin(a0) * rAt(282, a0)),
        new THREE.Vector3(Math.cos(a1) * rAt(225, a1), 225, Math.sin(a1) * rAt(225, a1)),
        new THREE.Vector3(Math.cos(a2) * rAt(168, a2), 168, Math.sin(a2) * rAt(168, a2)),
        new THREE.Vector3(Math.cos(a3) * rAt(110, a3), 110, Math.sin(a3) * rAt(110, a3)),
        new THREE.Vector3(Math.cos(a4) * rAt(52, a4), 52, Math.sin(a4) * rAt(52, a4)),
      ];
      const riverCurve = new THREE.CatmullRomCurve3(riverPts);
      const riverBaseRadius = r % 3 === 0 ? 3.2 : r % 2 === 0 ? 2.5 : 2.0;
      const riverTube = new THREE.TubeGeometry(riverCurve, 44, riverBaseRadius, 16, false);
      volcanoGroup.add(new THREE.Mesh(riverTube, slopeLavaShaderMat));
    }
  }

  worldGroup.add(volcanoGroup);

  // Add GPU-Animated Rising Lava Ember & Thermal Spark Plume System on lava_v2
  if (isNeon && isLavaV2) {
    const risingEmbers = createRisingLavaEmbersSystem(
      spline,
      new THREE.Vector3(volcanoWorldX, volcanoWorldY, volcanoWorldZ),
      volcanoHeight,
      animatedShaders
    );
    worldGroup.add(risingEmbers);
  }

  // 2. Monumental Active Parabolica Overlook Volcano Massif & Triple Lava Falls (framing the North Horizon!)
  // Pass `parabolicaBaseRadius + 36` to `ensureTrackClearanceXZ` so both the massif AND its front lava falls stay 55m+ clear of the Parabolica!
  const parabolicaBaseRadius = 185;
  const parabolicaHeight = 285;
  const parabolicaPeakPos = ensureTrackClearanceXZ(105, -810, parabolicaBaseRadius + 36, trackSamples, 55);
  const parabolicaPeakGroup = new THREE.Group();
  parabolicaPeakGroup.position.set(parabolicaPeakPos.x, -44, parabolicaPeakPos.z);
  const parabolicaPeakGeo = createDisplacedMountainGeometry(
    parabolicaBaseRadius,
    parabolicaHeight,
    96,
    52,
    4.9,
    true
  );
  parabolicaPeakGroup.add(new THREE.Mesh(parabolicaPeakGeo, secondaryVolcanoShaderMat));

  if (isNeon) {
    // Active Summit Caldera Lake & Eruption Plume on the Parabolica Overlook Volcano
    const paraPlumeGeo = new THREE.CylinderGeometry(68, 28, 155, 28, 14, true);
    paraPlumeGeo.translate(0, parabolicaHeight + 52, 0);
    parabolicaPeakGroup.add(new THREE.Mesh(paraPlumeGeo, eruptionPlumeMat));

    const paraLakeGeo = new THREE.TorusGeometry(28.0, 6.2, 20, 40);
    paraLakeGeo.rotateX(Math.PI * 0.5);
    const paraLakeMesh = new THREE.Mesh(paraLakeGeo, calderaLavaTorusMat);
    paraLakeMesh.position.set(0, parabolicaHeight - 4.5, 0);
    parabolicaPeakGroup.add(paraLakeMesh);

    // 10 Sculpted 3D Fluid Lava Rivers winding down the Parabolica Overlook Massif
    for (let r = 0; r < 10; r++) {
      const riverAngle = (r / 10) * Math.PI * 2;
      const sway = (r % 2 === 0 ? 1 : -1) * 0.06;
      const rAt = (y: number, a: number) =>
        evalMassifRadiusAt(y, a, parabolicaBaseRadius, parabolicaHeight, 4.9, true);
      const pts = [
        new THREE.Vector3(Math.cos(riverAngle) * rAt(254, riverAngle), 254, Math.sin(riverAngle) * rAt(254, riverAngle)),
        new THREE.Vector3(Math.cos(riverAngle + sway) * rAt(188, riverAngle + sway), 188, Math.sin(riverAngle + sway) * rAt(188, riverAngle + sway)),
        new THREE.Vector3(Math.cos(riverAngle - sway) * rAt(118, riverAngle - sway), 118, Math.sin(riverAngle - sway) * rAt(118, riverAngle - sway)),
        new THREE.Vector3(Math.cos(riverAngle) * rAt(48, riverAngle), 48, Math.sin(riverAngle) * rAt(48, riverAngle)),
      ];
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, r % 2 === 0 ? 2.8 : 2.1, 14, false);
      parabolicaPeakGroup.add(new THREE.Mesh(tube, slopeLavaShaderMat));
    }

    // Triple Cascading Molten Lava Waterfalls plunging down the Parabolica Overlook Cliffs
    for (let w = -1; w <= 1; w++) {
      const fallSheetGeo = new THREE.CylinderGeometry(
        11.0,
        22.0,
        168,
        24,
        10,
        true,
        -Math.PI * 0.30,
        Math.PI * 0.60
      );
      fallSheetGeo.translate(0, 84, 0);
      const sheet = new THREE.Mesh(fallSheetGeo, fallMat);
      sheet.position.set(w * 38, 8, 56);
      sheet.rotation.y = w * 0.22;
      parabolicaPeakGroup.add(sheet);
    }
  }
  worldGroup.add(parabolicaPeakGroup);

  // 3. Colossal Active Western Cordillera Volcano Massif & Planetary Geodesic Shield Dome
  const leftPeakRadius = 188;
  const leftPeakHeight = 280;
  const safeLeftPeak = ensureTrackClearanceXZ(-265, -355, leftPeakRadius + 18, trackSamples, 56);
  const leftPeakGroup = new THREE.Group();
  leftPeakGroup.position.set(safeLeftPeak.x, -44, safeLeftPeak.z);
  const leftPeakGeo = createDisplacedMountainGeometry(
    leftPeakRadius,
    leftPeakHeight,
    96,
    52,
    3.7,
    true
  );
  const leftPeakMesh = new THREE.Mesh(leftPeakGeo, secondaryVolcanoShaderMat);
  leftPeakGroup.add(leftPeakMesh);

  if (isNeon) {
    // Active Eruption Plume & Caldera Magma Ring on the Western Horizon Volcano
    const westPlumeGeo = new THREE.CylinderGeometry(64, 26, 148, 28, 14, true);
    westPlumeGeo.translate(0, leftPeakHeight + 48, 0);
    leftPeakGroup.add(new THREE.Mesh(westPlumeGeo, eruptionPlumeMat));

    const westLakeGeo = new THREE.TorusGeometry(28.0, 6.2, 20, 40);
    westLakeGeo.rotateX(Math.PI * 0.5);
    const westLakeMesh = new THREE.Mesh(westLakeGeo, calderaLavaTorusMat);
    westLakeMesh.position.set(0, leftPeakHeight - 4.5, 0);
    leftPeakGroup.add(westLakeMesh);

    // 10 Wide 3D Fluid Lava Rivers streaming down the Western Volcano flanks
    for (let r = 0; r < 10; r++) {
      const riverAngle = (r / 10) * Math.PI * 2;
      const sway = (r % 2 === 0 ? -1 : 1) * 0.055;
      const rAt = (y: number, a: number) =>
        evalMassifRadiusAt(y, a, leftPeakRadius, leftPeakHeight, 3.7, true);
      const pts = [
        new THREE.Vector3(Math.cos(riverAngle) * rAt(250, riverAngle), 250, Math.sin(riverAngle) * rAt(250, riverAngle)),
        new THREE.Vector3(Math.cos(riverAngle + sway) * rAt(184, riverAngle + sway), 184, Math.sin(riverAngle + sway) * rAt(184, riverAngle + sway)),
        new THREE.Vector3(Math.cos(riverAngle - sway) * rAt(114, riverAngle - sway), 114, Math.sin(riverAngle - sway) * rAt(114, riverAngle - sway)),
        new THREE.Vector3(Math.cos(riverAngle) * rAt(44, riverAngle), 44, Math.sin(riverAngle) * rAt(44, riverAngle)),
      ];
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, r % 2 === 0 ? 2.8 : 2.1, 14, false);
      leftPeakGroup.add(new THREE.Mesh(tube, slopeLavaShaderMat));
    }
  }
  worldGroup.add(leftPeakGroup);

  // Secondary North-West Broad Volcanic Massif Ridge bridging the Western Cordillera and the Parabolica
  const nwPeakRadius = 165;
  const nwPeakHeight = 262;
  const nwScaleX = 1.24;
  const nwScaleZ = 0.96;
  const safeNwPeak = ensureTrackClearanceXZ(
    -235,
    -635,
    nwPeakRadius * Math.max(nwScaleX, nwScaleZ),
    trackSamples,
    54
  );
  const nwPeakGeo = createDisplacedMountainGeometry(nwPeakRadius, nwPeakHeight, 84, 46, 8.4, false);
  const nwPeakMesh = new THREE.Mesh(nwPeakGeo, heroMountainShaderMat);
  nwPeakMesh.position.set(safeNwPeak.x, -44, safeNwPeak.z);
  nwPeakMesh.scale.set(nwScaleX, 1.0, nwScaleZ);
  worldGroup.add(nwPeakMesh);

  // South-East Horizon Volcanic Massif Range framing the Pyroclastic Summit Crest & Southern Hairpin 1
  const sePeakRadius = 178;
  const seScaleX = 1.18;
  const seScaleZ = 1.28;
  const safeSePeak = ensureTrackClearanceXZ(
    1150,
    595,
    sePeakRadius * Math.max(seScaleX, seScaleZ),
    trackSamples,
    58
  );
  const sePeakGeo = createDisplacedMountainGeometry(sePeakRadius, 276, 84, 46, 6.2, false);
  const sePeakMesh = new THREE.Mesh(sePeakGeo, heroMountainShaderMat);
  sePeakMesh.position.set(safeSePeak.x, -44, safeSePeak.z);
  sePeakMesh.scale.set(seScaleX, 1.0, seScaleZ);
  worldGroup.add(sePeakMesh);

  // Colossal Eastern Caldera Stratovolcano & Lava Falls framing the Extended Eastern Hairpins & Basalt Serpent Esses!
  {
    const eastVolcanoRadius = 192;
    const eastVolcanoHeight = 296;
    const safeEastVolcano = ensureTrackClearanceXZ(1685, -280, eastVolcanoRadius + 32, trackSamples, 58);
    const eastVolcanoGroup = new THREE.Group();
    eastVolcanoGroup.position.set(safeEastVolcano.x, -44, safeEastVolcano.z);
    const eastVolcanoGeo = createDisplacedMountainGeometry(
      eastVolcanoRadius,
      eastVolcanoHeight,
      96,
      52,
      7.4,
      true
    );
    eastVolcanoGroup.add(new THREE.Mesh(eastVolcanoGeo, secondaryVolcanoShaderMat));

    if (isNeon) {
      const eastPlumeGeo = new THREE.CylinderGeometry(72, 28, 165, 28, 14, true);
      eastPlumeGeo.translate(0, eastVolcanoHeight + 55, 0);
      eastVolcanoGroup.add(new THREE.Mesh(eastPlumeGeo, eruptionPlumeMat));

      const eastLakeGeo = new THREE.TorusGeometry(28.0, 6.2, 20, 40);
      eastLakeGeo.rotateX(Math.PI * 0.5);
      const eastLakeMesh = new THREE.Mesh(eastLakeGeo, calderaLavaTorusMat);
      eastLakeMesh.position.set(0, eastVolcanoHeight - 4.5, 0);
      eastVolcanoGroup.add(eastLakeMesh);

      for (let r = 0; r < 10; r++) {
        const riverAngle = (r / 10) * Math.PI * 2;
        const sway = (r % 2 === 0 ? 1 : -1) * 0.055;
        const rAt = (y: number, a: number) =>
          evalMassifRadiusAt(y, a, eastVolcanoRadius, eastVolcanoHeight, 7.4, true);
        const pts = [
          new THREE.Vector3(Math.cos(riverAngle) * rAt(264, riverAngle), 264, Math.sin(riverAngle) * rAt(264, riverAngle)),
          new THREE.Vector3(Math.cos(riverAngle + sway) * rAt(196, riverAngle + sway), 196, Math.sin(riverAngle + sway) * rAt(196, riverAngle + sway)),
          new THREE.Vector3(Math.cos(riverAngle - sway) * rAt(124, riverAngle - sway), 124, Math.sin(riverAngle - sway) * rAt(124, riverAngle - sway)),
          new THREE.Vector3(Math.cos(riverAngle) * rAt(50, riverAngle), 50, Math.sin(riverAngle) * rAt(50, riverAngle)),
        ];
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, r % 2 === 0 ? 2.8 : 2.1, 14, false);
        eastVolcanoGroup.add(new THREE.Mesh(tube, slopeLavaShaderMat));
      }
    }
    worldGroup.add(eastVolcanoGroup);
  }

  if (isNeon) {
    // Colossal Geodesic Planetary Dome in the Upper-Left Sky behind the Western Volcanic Cordillera
    const domeRadius = 148;
    const domeGeo = new THREE.IcosahedronGeometry(domeRadius, 3);
    const domeShellMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vLocalPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vLocalPos;
        void main() {
          float rim = pow(1.0 - abs(vNormal.z), 2.2);
          float latRing = smoothstep(0.92, 0.98, abs(sin(vLocalPos.y * 0.18)));
          float lonRing = smoothstep(0.92, 0.98, abs(sin(atan(vLocalPos.z, vLocalPos.x) * 12.0)));
          float grid = max(latRing, lonRing) * 0.45;
          vec3 col = mix(vec3(0.75, 0.22, 0.04), vec3(0.95, 0.62, 0.25), rim * 0.7 + grid);
          float alpha = (rim * 0.18 + grid * 0.14) * smoothstep(-40.0, 60.0, vLocalPos.y);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    animatedShaders.push(domeShellMat);

    const domeGroup = new THREE.Group();
    domeGroup.position.set(-255, 162, -495);
    domeGroup.add(new THREE.Mesh(domeGeo, domeShellMat));

    const skyWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(domeRadius * 1.005, 2)),
      new THREE.LineBasicMaterial({
        color: 0xc2410c,
        transparent: true,
        opacity: 0.18,
        fog: false,
      })
    );
    domeGroup.add(skyWire);
    worldGroup.add(domeGroup);
  }

  // 4. Central Caldera Volcanic Cliff Massif & Cascading Molten Lava Waterfall
  // Seated safely in the center of the caldera lake at (152, -215), 140m+ clear of both the West and East track legs!
  if (isNeon) {
    const cliffRadius = 52;
    const waterfallPos = ensureTrackClearanceXZ(152, -215, cliffRadius + 16, trackSamples, 42);
    const waterfallGroup = new THREE.Group();
    waterfallGroup.position.set(waterfallPos.x, -44, waterfallPos.z);

    const cliffGeo = createDisplacedMountainGeometry(cliffRadius, 158, 56, 32, 7.2, false);
    const cliffMesh = new THREE.Mesh(cliffGeo, heroMountainShaderMat);
    waterfallGroup.add(cliffMesh);

    const fallSheetGeo = new THREE.CylinderGeometry(9.5, 19.5, 126, 24, 10, true, -Math.PI * 0.35, Math.PI * 0.7);
    fallSheetGeo.translate(0, 63, 0);
    const fallSheet = new THREE.Mesh(fallSheetGeo, fallMat);
    fallSheet.rotation.y = Math.PI * 0.85;
    fallSheet.position.set(-14, 0, 10);
    waterfallGroup.add(fallSheet);

    const splashFlareMat = new THREE.SpriteMaterial({
      map: textures.thrusterFlareMap,
      color: 0xff5500,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const splashSprite = new THREE.Sprite(splashFlareMat);
    splashSprite.position.set(-20, 6, 16);
    splashSprite.scale.set(54, 24, 1);
    waterfallGroup.add(splashSprite);

    worldGroup.add(waterfallGroup);
  }

  // 5. Continuous Screen-Filling Volcanic Cordillera Massifs, Stepped Columnar Basalt Buttresses,
  //    Dark Volcanic Gravel Ground Islands (07_volcanic_gravel), and Geothermal Industrial Platforms!
  const cragCount = 162;
  const perArchetype = cragCount / 3;
  const cragGeoA = createDisplacedMountainGeometry(1, 1, 56, 32, 2.3, false);
  const cragGeoB = createDisplacedMountainGeometry(1, 1, 56, 32, 5.8, false);
  const cragGeoC = createDisplacedMountainGeometry(1, 1, 56, 32, 9.1, false);
  const cragInstancedA = new THREE.InstancedMesh(cragGeoA, mountainShaderMat, perArchetype);
  const cragInstancedB = new THREE.InstancedMesh(cragGeoB, mountainShaderMat, perArchetype);
  const cragInstancedC = new THREE.InstancedMesh(cragGeoC, mountainShaderMat, perArchetype);
  cragInstancedA.frustumCulled = false;
  cragInstancedB.frustumCulled = false;
  cragInstancedC.frustumCulled = false;

  // Dark Volcanic Gravel Ground Islands (07_volcanic_gravel.png) between rock formations and around lava zones
  // Strictly normalized so horizontal radius <= 1.0
  const gravelIslandGeo = new THREE.CylinderGeometry(0.68, 0.85, 3.8, 18, 2);
  gravelIslandGeo.translate(0, 1.9, 0);
  const gPos = gravelIslandGeo.attributes.position;
  const gUv = gravelIslandGeo.attributes.uv;
  for (let vi = 0; vi < gPos.count; vi++) {
    const gx = gPos.getX(vi);
    const gy = gPos.getY(vi);
    const gz = gPos.getZ(vi);
    const ga = Math.atan2(gz, gx);
    const shoreWave = Math.min(1.0, 0.84 + 0.09 * Math.sin(ga * 5.0) + 0.07 * Math.cos(ga * 8.0));
    gPos.setXYZ(vi, gx * shoreWave, gy + (gy > 2.0 ? Math.sin(ga * 4.0) * 0.45 : 0), gz * shoreWave);
    gUv.setXY(vi, gx * 1.8, gz * 1.8);
  }
  gravelIslandGeo.computeVertexNormals();

  const gravelIslandMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    map: textures.volcanicGravelMap,
    bumpMap: textures.volcanicGravelMap,
    bumpScale: 0.65,
    emissive: new THREE.Color(isLavaV2 && isNeon ? 0x9a3412 : 0x000000),
    emissiveMap: isLavaV2 ? textures.volcanicGravelMap : null,
    emissiveIntensity: isLavaV2 && isNeon ? 0.05 : 0,
    roughness: 0.94,
    metalness: 0.08,
    envMapIntensity: 0.08,
  });
  const gravelIslandInstanced = new THREE.InstancedMesh(gravelIslandGeo, gravelIslandMat, cragCount);
  gravelIslandInstanced.frustumCulled = false;

  // 3D Stepped Columnar Volcanic Basalt Buttresses & Crag Massifs rising from the volcanic gravel ground
  // Configured with dark charcoal-obsidian base and glowing magma veins
  const obsidianOutcropGeo = createJaggedObsidianOutcropGeometry(6.4);
  const obsidianOutcropMat = new THREE.MeshStandardMaterial({
    color: 0x3f3f46,
    map: textures.volcanicBasaltAlbedoMap,
    normalMap: textures.volcanicBasaltNormalMap,
    normalScale: new THREE.Vector2(1.35, 1.35),
    roughnessMap: textures.volcanicBasaltRoughnessMap,
    roughness: 1.0,
    aoMap: textures.volcanicBasaltAoMap,
    aoMapIntensity: 0.95,
    metalnessMap: textures.volcanicBasaltMetallicMap,
    metalness: 0.14,
    bumpMap: textures.volcanicBasaltHeightMap,
    bumpScale: 0.45,
    emissive: new THREE.Color(1.0, 0.20, 0.015),
    emissiveMap: textures.volcanicBasaltEmissiveMap,
    emissiveIntensity: isNeon ? (isLavaV2 ? 0.92 : 0.75) : 0.25,
    envMapIntensity: 0.10,
  });
  const obsidianOutcropInstanced = new THREE.InstancedMesh(obsidianOutcropGeo, obsidianOutcropMat, cragCount);
  obsidianOutcropInstanced.frustumCulled = false;

  // Geothermal Industrial Structures using 04_brushed_graphite, 01_roadway_panels platforms, and 05_cyan_neon_surface
  const citadelCount = 36;
  const citadelGeo = new THREE.CylinderGeometry(2.4, 4.4, 54, 8);
  citadelGeo.translate(0, 27, 0);
  const citadelMat = new THREE.MeshStandardMaterial({
    color: isLavaV2 ? 0x64748b : 0x475569,
    map: textures.brushedGraphiteMap,
    bumpMap: textures.brushedGraphiteMap,
    bumpScale: 0.22,
    metalness: 0.68,
    roughness: 0.44,
    envMapIntensity: 0.15,
  });
  const citadelInstanced = new THREE.InstancedMesh(citadelGeo, citadelMat, citadelCount);
  citadelInstanced.frustumCulled = false;

  const citadelPadGeo = new THREE.CylinderGeometry(11.5, 13.5, 4.5, 8);
  citadelPadGeo.translate(0, 2.25, 0);
  const citadelPadMat = new THREE.MeshStandardMaterial({
    color: isLavaV2 ? 0x64748b : 0x475569,
    map: textures.roadwayPanelsMap,
    bumpMap: textures.roadwayPanelsMap,
    bumpScale: 0.28,
    metalness: 0.55,
    roughness: 0.52,
    envMapIntensity: 0.12,
  });
  const citadelPadInstanced = new THREE.InstancedMesh(citadelPadGeo, citadelPadMat, citadelCount);
  citadelPadInstanced.frustumCulled = false;

  const citadelCyanRingGeo = new THREE.TorusGeometry(3.4, 0.48, 8, 16);
  citadelCyanRingGeo.rotateX(Math.PI / 2);
  citadelCyanRingGeo.translate(0, 44, 0);
  const citadelCyanRingMat = new THREE.MeshBasicMaterial({
    color: isNeon ? 0x00d8ff : 0x38bdf8,
    fog: false,
  });
  const citadelCyanRingInstanced = new THREE.InstancedMesh(citadelCyanRingGeo, citadelCyanRingMat, citadelCount);
  citadelCyanRingInstanced.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const samplePos = new THREE.Vector3();
  const sampleFwd = new THREE.Vector3();
  const sampleRight = new THREE.Vector3();
  const sampleUp = new THREE.Vector3();

  for (let i = 0; i < cragCount; i++) {
    const t = (i / cragCount) % 1;
    sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);
    // Place 80% of massifs on the outer perimeter as colossal cordillera ranges, and 20% as medium central caldera massifs!
    const isOuterPerimeter = i % 5 !== 0;
    const side = isOuterPerimeter ? -1 : 1;

    const r = isOuterPerimeter ? 82 + ((i * 19) % 68) : 34 + (i % 18);
    const ridgeRatio = isOuterPerimeter ? 1.18 + (i % 4) * 0.12 : 1.05 + (i % 3) * 0.08;
    const maxHorizRadius = r * ridgeRatio;
    const apronRadius = maxHorizRadius * 1.18;
    const h = isOuterPerimeter ? 175 + ((i * 43) % 130) : 115 + (i % 45);

    const baseDist = isOuterPerimeter ? maxHorizRadius + 75 + ((i * 37) % 120) : 85 + ((i * 23) % 35);
    const rawCx = samplePos.x + sampleRight.x * side * baseDist;
    const rawCz = samplePos.z + sampleRight.z * side * baseDist;

    // Guarantee every mountain massif AND its volcanic gravel apron is at least 48m clear of every segment of the track!
    const { x: cx, z: cz } = ensureTrackClearanceXZ(rawCx, rawCz, apronRadius, trackSamples, 48);

    dummy.position.set(cx, -45, cz);
    dummy.rotation.set(0, i * 0.95, 0);
    dummy.scale.set(r, h, r * ridgeRatio);
    dummy.updateMatrix();
    const bucket = i % 3;
    const idx = Math.floor(i / 3);
    if (bucket === 0) {
      cragInstancedA.setMatrixAt(idx, dummy.matrix);
    } else if (bucket === 1) {
      cragInstancedB.setMatrixAt(idx, dummy.matrix);
    } else {
      cragInstancedC.setMatrixAt(idx, dummy.matrix);
    }

    // Place Dark Volcanic Gravel Ground apron (07_volcanic_gravel) around the base of the massif & lava zone
    dummy.position.set(cx, -45.2, cz);
    dummy.rotation.set(0, i * 0.65, 0);
    dummy.scale.set(r * 1.18, 1.1 + (i % 3) * 0.35, r * ridgeRatio * 1.18);
    dummy.updateMatrix();
    gravelIslandInstanced.setMatrixAt(i, dummy.matrix);

    // Place Broad Stepped Columnar Basalt Buttress Formations between the mountain base and the lava sea
    const outcropScaleX = 16 + (i % 9);
    const outcropScaleZ = 15 + ((i + 3) % 9);
    const outcropMaxR = Math.max(outcropScaleX, outcropScaleZ);
    const outcropPos = ensureTrackClearanceXZ(
      cx - side * (r * 0.55),
      cz + ((i % 2 === 0 ? 1 : -1) * r * 0.35),
      outcropMaxR,
      trackSamples,
      40
    );
    dummy.position.set(outcropPos.x, -45, outcropPos.z);
    dummy.rotation.set(0, i * 1.37, 0);
    dummy.scale.set(outcropScaleX, 20 + (i % 5) * 5, outcropScaleZ);
    dummy.updateMatrix();
    obsidianOutcropInstanced.setMatrixAt(i, dummy.matrix);

    if (i < citadelCount) {
      const citadelPos = ensureTrackClearanceXZ(cx - side * (r * 0.42), cz + 6, 16, trackSamples, 42);
      const scaleY = 1.15 + (i % 3) * 0.35;
      dummy.position.set(citadelPos.x, -44, citadelPos.z);
      dummy.rotation.set(0, (i * Math.PI) / 4, 0);
      dummy.scale.set(1, scaleY, 1);
      dummy.updateMatrix();
      citadelInstanced.setMatrixAt(i, dummy.matrix);
      citadelCyanRingInstanced.setMatrixAt(i, dummy.matrix);

      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      citadelPadInstanced.setMatrixAt(i, dummy.matrix);
    }
  }

  // On lava_v2, add 52 Trackside Basalt Buttress Terraces seated on Volcanic Gravel Benches
  // with Subdivided Vertex-Displaced Flowing Lava Pools safely outside the viaduct corridor!
  if (isLavaV2) {
    const tracksideCount = 52;
    const benchGeo = new THREE.CylinderGeometry(6.8, 8.8, 2.4, 14);
    const lavaPoolGeo = new THREE.PlaneGeometry(8.8, 8.8, 20, 20);
    lavaPoolGeo.rotateX(-Math.PI / 2);

    const benchInstanced = new THREE.InstancedMesh(benchGeo, gravelIslandMat, tracksideCount);
    const spireInstanced = new THREE.InstancedMesh(obsidianOutcropGeo, obsidianOutcropMat, tracksideCount);
    const poolInstanced = new THREE.InstancedMesh(
      lavaPoolGeo,
      isNeon ? slopeLavaShaderMat : gravelIslandMat,
      tracksideCount
    );
    benchInstanced.frustumCulled = false;
    spireInstanced.frustumCulled = false;
    poolInstanced.frustumCulled = false;

    for (let k = 0; k < tracksideCount; k++) {
      const t = (k / tracksideCount) % 1;
      // Skip the subterranean tunnel & the Overpass/Underpass crossing so no trackside terrace floats near the crossing
      if ((t >= 0.125 && t <= 0.225) || (t >= 0.815 && t <= 0.860)) {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        benchInstanced.setMatrixAt(k, dummy.matrix);
        spireInstanced.setMatrixAt(k, dummy.matrix);
        poolInstanced.setMatrixAt(k, dummy.matrix);
        continue;
      }
      sampleTrackFrame(spline, t, samplePos, sampleFwd, sampleRight, sampleUp);
      const side = k % 2 === 0 ? -1 : 1;
      const lateralDist = TRACK_HALF_WIDTH + 26.0 + (k % 3) * 5.0;
      const rawBx = samplePos.x + sampleRight.x * side * lateralDist;
      const rawBz = samplePos.z + sampleRight.z * side * lateralDist;
      const { x: bx, z: bz } = ensureTrackClearanceXZ(rawBx, rawBz, 12.5, trackSamples, 18);
      const by = samplePos.y - 6.5;

      dummy.position.set(bx, by, bz);
      dummy.rotation.set(0, k * 0.8, 0);
      dummy.scale.set(1.18, 1.0, 1.18);
      dummy.updateMatrix();
      benchInstanced.setMatrixAt(k, dummy.matrix);

      dummy.position.set(bx, by + 1.24, bz);
      dummy.rotation.set(0, k * 0.8, 0);
      dummy.scale.set(1.0, 1.0, 1.0);
      dummy.updateMatrix();
      poolInstanced.setMatrixAt(k, dummy.matrix);

      dummy.position.set(bx + side * 2.2, by + 0.6, bz);
      dummy.rotation.set(0, k * 1.3, side * -0.06);
      dummy.scale.set(6.8 + (k % 3) * 1.4, 8.2 + (k % 4) * 2.2, 6.4 + ((k + 1) % 3) * 1.4);
      dummy.updateMatrix();
      spireInstanced.setMatrixAt(k, dummy.matrix);
    }
    benchInstanced.computeBoundingSphere();
    spireInstanced.computeBoundingSphere();
    poolInstanced.computeBoundingSphere();
    worldGroup.add(benchInstanced, spireInstanced, poolInstanced);
  }

  cragInstancedA.computeBoundingSphere();
  cragInstancedB.computeBoundingSphere();
  cragInstancedC.computeBoundingSphere();
  gravelIslandInstanced.computeBoundingSphere();
  obsidianOutcropInstanced.computeBoundingSphere();
  citadelInstanced.computeBoundingSphere();
  citadelPadInstanced.computeBoundingSphere();
  citadelCyanRingInstanced.computeBoundingSphere();
  worldGroup.add(
    cragInstancedA,
    cragInstancedB,
    cragInstancedC,
    gravelIslandInstanced,
    obsidianOutcropInstanced,
    citadelInstanced,
    citadelPadInstanced,
    citadelCyanRingInstanced
  );

  // ============================================================================
  // 6. LAVA CIRCUIT CYBERPUNK DECORATIVE UPGRADE (lava-Extracting_advertisements_from_i & lava-Extracting_advertising_panels_fr + lavaaAdding_cyberpunk_advertising_bil Reference)
  // ============================================================================
  {
    const decorGroup = new THREE.Group();

    interface LavaAtlasCrop {
      sheet: 1 | 2;
      u0: number;
      v0: number;
      u1: number;
      v1: number;
      aspect: number;
    }

    // Exact normalized UV bounding boxes extracted from the 2 uploaded 2752x1536 Lava Advertising Sheets:
    // Sheet 1: lava-Extracting_advertisements_from_i__2K_20261027000717_9d93f41b.jpg
    const S1_NEO_TOKYO_CORP_MAIN: LavaAtlasCrop = { sheet: 1, u0: 0.0153, v0: 0.7012, u1: 0.2809, v1: 0.9850, aspect: 1.68 };
    const S1_VERT_CYBERNETICS_PINK: LavaAtlasCrop = { sheet: 1, u0: 0.3150, v0: 0.6803, u1: 0.4088, v1: 0.9844, aspect: 0.55 };
    const S1_CYBERNETICS_NOW_WIDE: LavaAtlasCrop = { sheet: 1, u0: 0.4520, v0: 0.8223, u1: 0.7576, v1: 0.9831, aspect: 3.40 };
    const S1_NIGHT_CITY_RACING_BAR: LavaAtlasCrop = { sheet: 1, u0: 0.4404, v0: 0.6947, u1: 0.7725, v1: 0.7812, aspect: 6.87 };
    const S1_SYNTHETIC_SOUL: LavaAtlasCrop = { sheet: 1, u0: 0.7976, v0: 0.8021, u1: 0.9804, v1: 0.9824, aspect: 1.82 };
    const S1_NEO_TOKYO_CYBER_SIGN: LavaAtlasCrop = { sheet: 1, u0: 0.2140, v0: 0.5228, u1: 0.4233, v1: 0.6243, aspect: 3.69 };
    const S1_NEO_TOKYO_CORP_BADGE: LavaAtlasCrop = { sheet: 1, u0: 0.4658, v0: 0.5254, u1: 0.5956, v1: 0.6270, aspect: 2.29 };
    const S1_CYBERPUNK_2077_GOLD: LavaAtlasCrop = { sheet: 1, u0: 0.6523, v0: 0.5365, u1: 0.9876, v1: 0.6198, aspect: 7.21 };
    const S1_NEO_TOKYO_AMBER_AD: LavaAtlasCrop = { sheet: 1, u0: 0.2148, v0: 0.3438, u1: 0.4037, v1: 0.4844, aspect: 2.41 };
    const S1_NEO_TOKYO_RACING_VIOLET: LavaAtlasCrop = { sheet: 1, u0: 0.4706, v0: 0.4141, u1: 0.7605, v1: 0.4876, aspect: 7.06 };
    const S1_KANJI_CYBER_RACING: LavaAtlasCrop = { sheet: 1, u0: 0.7878, v0: 0.4121, u1: 0.9869, v1: 0.4922, aspect: 4.46 };
    const S1_VERT_PINK_ANDROID_PORT: LavaAtlasCrop = { sheet: 1, u0: 0.0327, v0: 0.0410, u1: 0.1762, v1: 0.3431, aspect: 0.85 };
    const S1_BUSINESS_CYBORG_AD: LavaAtlasCrop = { sheet: 1, u0: 0.2078, v0: 0.0417, u1: 0.3416, v1: 0.2487, aspect: 1.16 };
    const S1_VERT_BLUE_SILHOUETTE: LavaAtlasCrop = { sheet: 1, u0: 0.7318, v0: 0.0456, u1: 0.7918, v1: 0.3385, aspect: 0.37 };
    const S1_VERT_CYBERNETICS_GREEN: LavaAtlasCrop = { sheet: 1, u0: 0.8212, v0: 0.0417, u1: 0.9818, v1: 0.3431, aspect: 0.95 };

    // Sheet 2: lava-Extracting_advertising_panels_fr__2K_20261027000810_520513ec.jpg
    const S2_NEO_TOKYO_CORP_TOP: LavaAtlasCrop = { sheet: 2, u0: 0.0174, v0: 0.7376, u1: 0.2456, v1: 0.9740, aspect: 1.73 };
    const S2_CYBERNETICS_GREEN_CAN: LavaAtlasCrop = { sheet: 2, u0: 0.2624, v0: 0.7389, u1: 0.5182, v1: 0.9740, aspect: 1.95 };
    const S2_SYNTHETIC_SOUL_COMPACT: LavaAtlasCrop = { sheet: 2, u0: 0.7333, v0: 0.8294, u1: 0.8528, v1: 0.9707, aspect: 1.52 };
    const S2_NIGHT_CITY_RACING_NEON: LavaAtlasCrop = { sheet: 2, u0: 0.8837, v0: 0.9030, u1: 0.9800, v1: 0.9740, aspect: 2.43 };
    const S2_NEO_TOKYO_CORP_LARGE: LavaAtlasCrop = { sheet: 2, u0: 0.0167, v0: 0.4010, u1: 0.3379, v1: 0.7070, aspect: 1.88 };
    const S2_VERT_CYBERPUNK_FEST23: LavaAtlasCrop = { sheet: 2, u0: 0.3645, v0: 0.3730, u1: 0.4575, v1: 0.7083, aspect: 0.50 };
    const S2_TOKYO_KATAKANA_NEON: LavaAtlasCrop = { sheet: 2, u0: 0.4811, v0: 0.5560, u1: 0.7467, v1: 0.6719, aspect: 4.11 };
    const S2_NIGHT_CITY_CORP_HUD: LavaAtlasCrop = { sheet: 2, u0: 0.4818, v0: 0.2129, u1: 0.7445, v1: 0.5273, aspect: 1.50 };
    const S2_BLUE_AI_HOLOGRAM_HUD: LavaAtlasCrop = { sheet: 2, u0: 0.7649, v0: 0.2682, u1: 0.9793, v1: 0.5098, aspect: 1.59 };

    const createCroppedPlaneGeo = (width: number, height: number, crop: LavaAtlasCrop): THREE.PlaneGeometry => {
      const geo = new THREE.PlaneGeometry(width, height);
      const uvAttr = geo.attributes.uv as THREE.BufferAttribute;
      uvAttr.setXY(0, crop.u0, crop.v1);
      uvAttr.setXY(1, crop.u1, crop.v1);
      uvAttr.setXY(2, crop.u0, crop.v0);
      uvAttr.setXY(3, crop.u1, crop.v0);
      uvAttr.needsUpdate = true;
      return geo;
    };

    const createLavaAdScreenShader = (sheet: 1 | 2, brightness = 0.98): THREE.ShaderMaterial => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uAtlas: { value: sheet === 1 ? textures.lavaDecorativeAtlas1Map : textures.lavaDecorativeAtlas2Map },
          uTime: { value: 0 },
          uBrightness: { value: isNeon ? brightness * Math.min(1.18, 0.72 + neonIntensity * 0.36) : 0.84 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform sampler2D uAtlas;
          uniform float uTime;
          uniform float uBrightness;
          varying vec2 vUv;
          varying vec3 vWorldPos;

          void main() {
            vec3 tex = texture2D(uAtlas, vUv).rgb;
            // Subtle CRT scanline & cybernetic refresh shimmer
            float scanline = 0.93 + 0.07 * sin(vUv.y * 520.0 - uTime * 9.5);
            float pulse = 0.96 + 0.04 * sin(uTime * 2.8 + vWorldPos.x * 0.04 + vWorldPos.z * 0.04);
            vec3 col = tex * scanline * pulse * uBrightness;

            // Volcanic atmospheric distance blend
            float dist = length(cameraPosition - vWorldPos);
            float fogFactor = 1.0 - exp(-dist * 0.00068);
            col = mix(col, vec3(0.05, 0.02, 0.015), clamp(fogFactor * 0.58, 0.0, 0.72));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
        side: THREE.DoubleSide,
      });
      animatedShaders.push(mat);
      return mat;
    };

    const adScreenMat1 = createLavaAdScreenShader(1, 0.98);
    const adScreenMat2 = createLavaAdScreenShader(2, 0.98);
    const getAdMat = (crop: LavaAtlasCrop) => (crop.sheet === 1 ? adScreenMat1 : adScreenMat2);

    const frameCasingMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f19,
      map: textures.brushedGraphiteMap,
      roughness: 0.44,
      metalness: 0.78,
      envMapIntensity: 0.14,
    });

    const cyanNeonTrimMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x00f2fe).multiplyScalar(isNeon ? 0.88 : 0.48),
    });

    const orangeNeonTrimMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xff6b00).multiplyScalar(isNeon ? 0.88 : 0.48),
    });

    const magentaNeonTrimMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xff2a85).multiplyScalar(isNeon ? 0.86 : 0.48),
    });

    const cableMat = new THREE.MeshStandardMaterial({
      color: 0x060911,
      roughness: 0.65,
      metalness: 0.55,
      envMapIntensity: 0.08,
    });

    // Helper: Build a framed cyberpunk billboard (casing + screen + top/bottom neon bars + optional support legs)
    const createFramedLavaBillboard = (
      width: number,
      height: number,
      crop: LavaAtlasCrop,
      trimType: 'cyan' | 'orange' | 'magenta' = 'cyan',
      legLength = 4.6
    ): THREE.Group => {
      const group = new THREE.Group();

      const casing = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.68, height + 0.68, 0.54),
        frameCasingMat
      );
      casing.position.z = -0.28;
      group.add(casing);

      const screenGeo = createCroppedPlaneGeo(width, height, crop);
      const screenFront = new THREE.Mesh(screenGeo, getAdMat(crop));
      screenFront.position.z = 0.02;
      group.add(screenFront);

      const screenBack = new THREE.Mesh(screenGeo, getAdMat(crop));
      screenBack.rotation.y = Math.PI;
      screenBack.position.z = -0.57;
      group.add(screenBack);

      const trimMat =
        trimType === 'cyan'
          ? cyanNeonTrimMat
          : trimType === 'orange'
          ? orangeNeonTrimMat
          : magentaNeonTrimMat;
      const trimGeo = new THREE.BoxGeometry(width + 0.74, 0.15, 0.64);
      const topTrim = new THREE.Mesh(trimGeo, trimMat);
      topTrim.position.set(0, height * 0.5 + 0.30, -0.26);
      const botTrim = new THREE.Mesh(trimGeo, trimMat);
      botTrim.position.set(0, -height * 0.5 - 0.30, -0.26);
      group.add(topTrim, botTrim);

      if (legLength > 0) {
        const legGeo = new THREE.BoxGeometry(0.32, legLength, 0.36);
        const braceGeo = new THREE.BoxGeometry(0.24, legLength * 0.85, 0.24);
        for (const lx of [-width * 0.36, width * 0.36]) {
          const leg = new THREE.Mesh(legGeo, frameCasingMat);
          leg.position.set(lx, -height * 0.5 - legLength * 0.5, -0.26);
          group.add(leg);

          const brace = new THREE.Mesh(braceGeo, frameCasingMat);
          brace.position.set(lx, -height * 0.5 - legLength * 0.45, -1.15);
          brace.rotation.x = 0.38;
          group.add(brace);
        }
      }

      return group;
    };

    // Helper: Build a draping 3D catenary power cable between two world points
    const addCatenaryCable = (
      pStart: THREE.Vector3,
      pEnd: THREE.Vector3,
      sag: number,
      radius = 0.085
    ) => {
      const pts: THREE.Vector3[] = [];
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const pt = new THREE.Vector3().lerpVectors(pStart, pEnd, u);
        pt.y -= Math.sin(u * Math.PI) * sag;
        pts.push(pt);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, 12, radius, 5, false);
      decorGroup.add(new THREE.Mesh(tubeGeo, cableMat));
    };

    const halfW = TRACK_HALF_WIDTH;
    const bPos = new THREE.Vector3();
    const bFwd = new THREE.Vector3();
    const bRight = new THREE.Vector3();
    const bUp = new THREE.Vector3();
    const bLook = new THREE.Vector3();
    const bRotMat = new THREE.Matrix4();

    // ------------------------------------------------------------------------
    // 6A. BARRIER-MOUNTED LED ADVERTISING TICKER STRIPS & CONTINUOUS GUARDRAIL LASER LINES
    // (Matching the reference image where LED banners 'CYBERNETICS NOW', 'NIGHT CITY RACING',
    // 'SYNTHETIC SOUL', 'CYBERPUNK 2077', 'NEO-TOKYO RACING' line the outer trackside barriers)
    // ------------------------------------------------------------------------
    const railTickerCrops: LavaAtlasCrop[] = [
      S1_NIGHT_CITY_RACING_BAR,
      S1_CYBERNETICS_NOW_WIDE,
      S1_CYBERPUNK_2077_GOLD,
      S1_NEO_TOKYO_RACING_VIOLET,
      S1_KANJI_CYBER_RACING,
      S1_NEO_TOKYO_CYBER_SIGN,
      S2_TOKYO_KATAKANA_NEON,
      S2_NIGHT_CITY_RACING_NEON,
    ];

    const tickerCount = 36;
    for (let i = 0; i < tickerCount; i++) {
      const t = (i / tickerCount + 0.008) % 1;
      // Keep subterranean lava cavern & its entry/exit approaches uncluttered
      if (t > 0.128 && t < 0.188) continue;

      sampleTrackFrame(spline, t, bPos, bFwd, bRight, bUp);
      const crop = railTickerCrops[i % railTickerCrops.length];
      const nextCrop = railTickerCrops[(i + 3) % railTickerCrops.length];

      for (const side of [-1, 1]) {
        const activeCrop = side === -1 ? crop : nextCrop;
        const panelW = 7.6;
        const panelH = 1.95;
        const panelGroup = createFramedLavaBillboard(
          panelW,
          panelH,
          activeCrop,
          side === -1 ? 'cyan' : 'orange',
          1.8
        );

        const rawPx = bPos.x + bRight.x * side * (halfW + 6.2);
        const rawPz = bPos.z + bRight.z * side * (halfW + 6.2);
        const safeP = ensureTrackClearanceXZ(rawPx, rawPz, panelW * 0.55, trackSamples, 5.2);

        panelGroup.position.set(safeP.x, bPos.y + bUp.y * 2.35, safeP.z);

        // Angle inward slightly toward the racing line so approaching pilots read the LED strip clearly
        bLook
          .copy(panelGroup.position)
          .addScaledVector(bFwd, -1.0)
          .addScaledVector(bRight, -side * 0.16);
        bRotMat.lookAt(panelGroup.position, bLook, bUp);
        panelGroup.quaternion.setFromRotationMatrix(bRotMat);

        decorGroup.add(panelGroup);
      }
    }

    // Dual Continuous Elevated Guardrail Laser Guide Ribbons (Electric Cyan + Magma Orange)
    {
      const laserSegs = 720;
      const leftLaserPts: THREE.Vector3[] = [];
      const rightLaserPts: THREE.Vector3[] = [];
      for (let i = 0; i <= laserSegs; i++) {
        sampleTrackFrame(spline, (i / laserSegs) % 1, bPos, bFwd, bRight, bUp);
        leftLaserPts.push(
          bPos.clone().addScaledVector(bRight, -(halfW + 0.42)).addScaledVector(bUp, 1.98)
        );
        rightLaserPts.push(
          bPos.clone().addScaledVector(bRight, halfW + 0.42).addScaledVector(bUp, 1.98)
        );
      }
      const leftLaserCurve = new THREE.CatmullRomCurve3(leftLaserPts, true);
      const rightLaserCurve = new THREE.CatmullRomCurve3(rightLaserPts, true);
      const laserLineMat = new THREE.MeshBasicMaterial({
        color: isNeon ? 0x38bdf8 : 0x0284c7,
        transparent: true,
        opacity: isNeon ? 0.84 : 0.45,
      });
      decorGroup.add(
        new THREE.Mesh(new THREE.TubeGeometry(leftLaserCurve, 640, 0.065, 5, true), laserLineMat),
        new THREE.Mesh(new THREE.TubeGeometry(rightLaserCurve, 640, 0.065, 5, true), laserLineMat)
      );
    }

    // ------------------------------------------------------------------------
    // 6B. SEGMENTED CIRCULAR CYBERPUNK OVER-TRACK RING ARCHWAYS & GLOWING CYAN "CHECKPOINT" PORTALS
    // (Distributed across all 4 sectors of the Extended Lava Circuit!)
    // ------------------------------------------------------------------------
    const circularArchTs = [0.048, 0.118, 0.245, 0.345, 0.425, 0.505, 0.595, 0.685, 0.735, 0.885, 0.962];
    const archRadius = halfW + 6.2;

    const holoCyanArchMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(0x00f2fe) },
        uColorB: { value: new THREE.Color(0x38bdf8) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          float dash = smoothstep(0.15, 0.85, 0.5 + 0.5 * sin(vUv.x * 42.0 - uTime * 4.5));
          float scan = 0.82 + 0.18 * sin(vUv.y * 28.0 + uTime * 6.0);
          vec3 col = mix(uColorB, uColorA, dash) * scan;
          float alpha = (0.36 + 0.34 * dash);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    animatedShaders.push(holoCyanArchMat);

    const checkpointBannerMat = new THREE.MeshBasicMaterial({
      map: textures.checkpointSignMap,
      transparent: true,
      opacity: isNeon ? 0.94 : 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let idx = 0; idx < circularArchTs.length; idx++) {
      const t = circularArchTs[idx];
      sampleTrackFrame(spline, t, bPos, bFwd, bRight, bUp);

      const archGroup = new THREE.Group();
      archGroup.position.copy(bPos);
      bLook.copy(bPos).add(bFwd);
      bRotMat.lookAt(bPos, bLook, bUp);
      archGroup.quaternion.setFromRotationMatrix(bRotMat);

      const isCheckpointGate = idx % 2 === 0;

      // Heavy dark-graphite segmented outer structural ring frame (tagged for Track SSAO)
      const outerSteelTorus = new THREE.Mesh(
        new THREE.TorusGeometry(archRadius, 0.58, 12, 56, Math.PI * 1.16),
        frameCasingMat
      );
      outerSteelTorus.position.set(0, 2.2, 0);
      outerSteelTorus.rotation.z = -Math.PI * 0.08;
      outerSteelTorus.layers.enable(TRACK_SSAO_LAYER);
      archGroup.add(outerSteelTorus);

      // Twin Concentric Glowing Cyan Energy Tubes
      const innerCyanTube = new THREE.Mesh(
        new THREE.TorusGeometry(archRadius - 0.85, 0.22, 10, 56, Math.PI * 1.14),
        cyanNeonTrimMat
      );
      innerCyanTube.position.set(0, 2.2, 0);
      innerCyanTube.rotation.z = -Math.PI * 0.07;
      archGroup.add(innerCyanTube);

      const secondCyanRibbon = new THREE.Mesh(
        new THREE.TorusGeometry(archRadius - 2.05, 0.34, 8, 56, Math.PI * 1.08),
        holoCyanArchMat
      );
      secondCyanRibbon.position.set(0, 2.2, 0.35);
      secondCyanRibbon.rotation.z = -Math.PI * 0.04;
      archGroup.add(secondCyanRibbon);

      // Heavy armored footing piers anchored outside the track barriers
      const pierGeo = new THREE.BoxGeometry(2.1, 7.5, 2.6);
      for (const side of [-1, 1]) {
        const pier = new THREE.Mesh(pierGeo, frameCasingMat);
        pier.position.set(side * (archRadius - 0.4), 1.4, 0);
        pier.layers.enable(TRACK_SSAO_LAYER);
        archGroup.add(pier);
      }

      if (isCheckpointGate) {
        // Suspended Glowing Cyan "CHECKPOINT" Holographic Header Banner at the crown of the ring
        const cpBanner = new THREE.Mesh(new THREE.PlaneGeometry(14.8, 3.3), checkpointBannerMat);
        cpBanner.position.set(0, archRadius - 1.25, 0.45);
        cpBanner.rotation.y = Math.PI;
        archGroup.add(cpBanner);

        const cpBannerBack = new THREE.Mesh(new THREE.PlaneGeometry(14.8, 3.3), checkpointBannerMat);
        cpBannerBack.position.set(0, archRadius - 1.25, -0.45);
        archGroup.add(cpBannerBack);
      } else {
        // Crown Advertising Header ("CYBERNETICS NOW" / "NEO-TOKYO CORP") mounted on the circular ring arch
        const crownCrop = idx % 3 === 0 ? S1_CYBERNETICS_NOW_WIDE : S1_NEO_TOKYO_CYBER_SIGN;
        const crownAd = createFramedLavaBillboard(13.6, 3.4, crownCrop, 'cyan', 0);
        crownAd.position.set(0, archRadius + 0.55, 0.35);
        crownAd.rotation.y = Math.PI;
        archGroup.add(crownAd);
      }

      // Flanking Vertical Wing Banners mounted on the left & right sides of the circular ring arch
      const leftWingCrop = idx % 2 === 0 ? S1_VERT_CYBERNETICS_PINK : S2_VERT_CYBERPUNK_FEST23;
      const rightWingCrop = idx % 2 === 0 ? S1_VERT_CYBERNETICS_GREEN : S1_VERT_PINK_ANDROID_PORT;
      const leftWingAd = createFramedLavaBillboard(4.2, 8.2, leftWingCrop, 'magenta', 0);
      leftWingAd.position.set(-(archRadius + 2.2), 7.8, 0);
      leftWingAd.rotation.y = Math.PI - 0.18;
      archGroup.add(leftWingAd);

      const rightWingAd = createFramedLavaBillboard(4.2, 8.2, rightWingCrop, 'cyan', 0);
      rightWingAd.position.set(archRadius + 2.2, 7.8, 0);
      rightWingAd.rotation.y = Math.PI + 0.18;
      archGroup.add(rightWingAd);

      decorGroup.add(archGroup);
    }

    // ------------------------------------------------------------------------
    // 6C. TRACKSIDE & VOLCANIC-SLOPE FRAMED CYBERPUNK BILLBOARDS WITH CATENARY POWER CABLES
    // (Distributed across all 4 sectors of the Extended Lava Circuit!)
    // ------------------------------------------------------------------------
    const slopeBillboardSpecs: Array<{
      t: number;
      side: -1 | 1;
      crop: LavaAtlasCrop;
      w: number;
      h: number;
      lateralExtra: number;
      elevOffset: number;
      trim: 'cyan' | 'orange' | 'magenta';
      yawInward: number;
    }> = [
      // Sector 1: Start/Finish & Caldera Parabolica (0.01 -> 0.12)
      { t: 0.015, side: -1, crop: S1_NEO_TOKYO_CORP_MAIN, w: 19.5, h: 11.6, lateralExtra: 11.5, elevOffset: 6.4, trim: 'orange', yawInward: 0.34 },
      { t: 0.020, side: 1, crop: S2_CYBERNETICS_GREEN_CAN, w: 18.8, h: 9.8, lateralExtra: 11.2, elevOffset: 6.0, trim: 'cyan', yawInward: -0.34 },
      { t: 0.038, side: -1, crop: S1_VERT_CYBERNETICS_PINK, w: 6.2, h: 11.4, lateralExtra: 9.8, elevOffset: 6.8, trim: 'magenta', yawInward: 0.28 },
      { t: 0.044, side: 1, crop: S1_SYNTHETIC_SOUL, w: 15.6, h: 8.6, lateralExtra: 10.4, elevOffset: 5.4, trim: 'magenta', yawInward: -0.30 },
      { t: 0.068, side: -1, crop: S2_NEO_TOKYO_CORP_LARGE, w: 21.0, h: 11.2, lateralExtra: 12.8, elevOffset: 6.8, trim: 'cyan', yawInward: 0.32 },
      { t: 0.082, side: 1, crop: S1_VERT_PINK_ANDROID_PORT, w: 8.4, h: 10.2, lateralExtra: 10.2, elevOffset: 6.2, trim: 'magenta', yawInward: -0.28 },
      { t: 0.104, side: -1, crop: S1_CYBERNETICS_NOW_WIDE, w: 18.5, h: 5.8, lateralExtra: 10.8, elevOffset: 5.2, trim: 'cyan', yawInward: 0.26 },
      { t: 0.122, side: 1, crop: S1_NEO_TOKYO_AMBER_AD, w: 16.4, h: 6.8, lateralExtra: 10.6, elevOffset: 5.6, trim: 'orange', yawInward: -0.28 },
      // Sector 2: Pyroclastic Ascent, Summit Crest, Roller-Coaster Drop & Hairpin 1 (0.22 -> 0.49)
      { t: 0.225, side: -1, crop: S2_NEO_TOKYO_CORP_TOP, w: 18.2, h: 10.4, lateralExtra: 11.8, elevOffset: 6.2, trim: 'orange', yawInward: 0.32 },
      { t: 0.252, side: 1, crop: S1_VERT_CYBERNETICS_GREEN, w: 9.2, h: 9.8, lateralExtra: 10.4, elevOffset: 6.0, trim: 'cyan', yawInward: -0.28 },
      { t: 0.282, side: -1, crop: S1_BUSINESS_CYBORG_AD, w: 12.6, h: 10.8, lateralExtra: 11.2, elevOffset: 6.4, trim: 'cyan', yawInward: 0.30 },
      { t: 0.312, side: 1, crop: S2_SYNTHETIC_SOUL_COMPACT, w: 14.8, h: 9.6, lateralExtra: 11.0, elevOffset: 5.8, trim: 'magenta', yawInward: -0.30 },
      { t: 0.342, side: -1, crop: S2_VERT_CYBERPUNK_FEST23, w: 6.4, h: 12.6, lateralExtra: 9.8, elevOffset: 7.2, trim: 'orange', yawInward: 0.26 },
      { t: 0.372, side: 1, crop: S1_NEO_TOKYO_CORP_BADGE, w: 15.2, h: 6.8, lateralExtra: 10.2, elevOffset: 5.2, trim: 'cyan', yawInward: -0.28 },
      { t: 0.402, side: -1, crop: S1_NEO_TOKYO_CORP_MAIN, w: 20.0, h: 11.8, lateralExtra: 12.2, elevOffset: 6.5, trim: 'orange', yawInward: 0.32 },
      { t: 0.435, side: 1, crop: S2_CYBERNETICS_GREEN_CAN, w: 18.6, h: 9.6, lateralExtra: 11.4, elevOffset: 6.0, trim: 'cyan', yawInward: -0.32 },
      { t: 0.468, side: -1, crop: S1_SYNTHETIC_SOUL, w: 16.4, h: 9.0, lateralExtra: 11.0, elevOffset: 5.8, trim: 'magenta', yawInward: 0.28 },
      { t: 0.492, side: 1, crop: S2_NEO_TOKYO_CORP_LARGE, w: 19.6, h: 10.4, lateralExtra: 12.0, elevOffset: 6.4, trim: 'orange', yawInward: -0.30 },
      // Sector 3: Basalt Serpent Esses, Hairpin 2 & High-Speed Banked Sweeper (0.51 -> 0.74)
      { t: 0.522, side: -1, crop: S1_VERT_BLUE_SILHOUETTE, w: 5.6, h: 14.2, lateralExtra: 9.6, elevOffset: 8.0, trim: 'cyan', yawInward: 0.25 },
      { t: 0.552, side: 1, crop: S1_NEO_TOKYO_AMBER_AD, w: 17.2, h: 7.2, lateralExtra: 11.0, elevOffset: 5.6, trim: 'orange', yawInward: -0.28 },
      { t: 0.582, side: -1, crop: S2_NEO_TOKYO_CORP_TOP, w: 18.8, h: 10.8, lateralExtra: 11.8, elevOffset: 6.4, trim: 'cyan', yawInward: 0.32 },
      { t: 0.618, side: 1, crop: S1_VERT_CYBERNETICS_PINK, w: 6.4, h: 11.6, lateralExtra: 9.8, elevOffset: 6.6, trim: 'magenta', yawInward: -0.28 },
      { t: 0.652, side: -1, crop: S2_CYBERNETICS_GREEN_CAN, w: 19.0, h: 9.8, lateralExtra: 11.6, elevOffset: 6.0, trim: 'cyan', yawInward: 0.30 },
      { t: 0.688, side: 1, crop: S1_NEO_TOKYO_CORP_MAIN, w: 19.4, h: 11.4, lateralExtra: 12.0, elevOffset: 6.4, trim: 'orange', yawInward: -0.32 },
      { t: 0.722, side: -1, crop: S1_SYNTHETIC_SOUL, w: 16.0, h: 8.8, lateralExtra: 10.8, elevOffset: 5.6, trim: 'magenta', yawInward: 0.28 },
      // Sector 4: Post-Overpass Southern Caldera Return (0.87 -> 0.98)
      { t: 0.875, side: -1, crop: S2_NEO_TOKYO_CORP_LARGE, w: 20.2, h: 11.0, lateralExtra: 12.2, elevOffset: 6.4, trim: 'cyan', yawInward: 0.30 },
      { t: 0.905, side: 1, crop: S1_NEO_TOKYO_CORP_MAIN, w: 19.4, h: 11.4, lateralExtra: 12.0, elevOffset: 6.4, trim: 'orange', yawInward: -0.32 },
      { t: 0.942, side: -1, crop: S1_SYNTHETIC_SOUL, w: 16.0, h: 8.8, lateralExtra: 10.8, elevOffset: 5.6, trim: 'magenta', yawInward: 0.28 },
      { t: 0.975, side: 1, crop: S1_CYBERNETICS_NOW_WIDE, w: 18.2, h: 5.6, lateralExtra: 10.8, elevOffset: 5.2, trim: 'cyan', yawInward: -0.28 },
    ];

    for (let i = 0; i < slopeBillboardSpecs.length; i++) {
      const spec = slopeBillboardSpecs[i];
      sampleTrackFrame(spline, spec.t, bPos, bFwd, bRight, bUp);

      const bbGroup = createFramedLavaBillboard(spec.w, spec.h, spec.crop, spec.trim, 7.2);
      const safeLatExtra = Math.max(spec.lateralExtra, spec.w * 0.52 + 6.8);
      const latDist = halfW + safeLatExtra;
      const rawSx = bPos.x + bRight.x * spec.side * latDist;
      const rawSz = bPos.z + bRight.z * spec.side * latDist;
      const safeS = ensureTrackClearanceXZ(rawSx, rawSz, spec.w * 0.55, trackSamples, 6.5);

      bbGroup.position.set(safeS.x, bPos.y + spec.elevOffset, safeS.z);

      // Face incoming racers along the track tangent with gentle inward angle
      bLook
        .copy(bbGroup.position)
        .addScaledVector(bFwd, -1.0)
        .addScaledVector(bRight, spec.yawInward * 0.72);
      bRotMat.lookAt(bbGroup.position, bLook, bUp);
      bbGroup.quaternion.setFromRotationMatrix(bRotMat);

      decorGroup.add(bbGroup);
    }

    // ------------------------------------------------------------------------
    // 6D. HIGH-MOUNTED CANTILEVERED MEGABILLBOARDS WITH HANGING POWER CABLE BUNDLES
    // ------------------------------------------------------------------------
    const megaGantrySpecs: Array<{
      t: number;
      leftCrop: LavaAtlasCrop;
      rightCrop: LavaAtlasCrop;
    }> = [
      { t: 0.028, leftCrop: S2_NEO_TOKYO_CORP_TOP, rightCrop: S2_CYBERNETICS_GREEN_CAN },
      { t: 0.095, leftCrop: S1_NEO_TOKYO_CORP_MAIN, rightCrop: S1_CYBERNETICS_NOW_WIDE },
      { t: 0.268, leftCrop: S2_NEO_TOKYO_CORP_LARGE, rightCrop: S1_SYNTHETIC_SOUL },
      { t: 0.388, leftCrop: S1_NEO_TOKYO_CORP_MAIN, rightCrop: S2_CYBERNETICS_GREEN_CAN },
      { t: 0.535, leftCrop: S2_NEO_TOKYO_CORP_TOP, rightCrop: S1_NEO_TOKYO_AMBER_AD },
      { t: 0.665, leftCrop: S2_NEO_TOKYO_CORP_LARGE, rightCrop: S1_CYBERNETICS_NOW_WIDE },
      { t: 0.725, leftCrop: S1_NEO_TOKYO_CORP_MAIN, rightCrop: S2_CYBERNETICS_GREEN_CAN },
      { t: 0.918, leftCrop: S2_NEO_TOKYO_CORP_LARGE, rightCrop: S2_CYBERNETICS_GREEN_CAN },
    ];

    for (let i = 0; i < megaGantrySpecs.length; i++) {
      const mSpec = megaGantrySpecs[i];
      sampleTrackFrame(spline, mSpec.t, bPos, bFwd, bRight, bUp);

      for (const side of [-1, 1] as const) {
        const crop = side === -1 ? mSpec.leftCrop : mSpec.rightCrop;
        const mw = 21.5;
        const mh = 12.2;
        const megaBoard = createFramedLavaBillboard(
          mw,
          mh,
          crop,
          side === -1 ? 'orange' : 'cyan',
          0
        );

        const latOffset = side * (halfW + 19.5);
        const elevOffset = 20.5;
        const rawMx = bPos.x + bRight.x * latOffset;
        const rawMz = bPos.z + bRight.z * latOffset;
        const safeM = ensureTrackClearanceXZ(rawMx, rawMz, mw * 0.55, trackSamples, 8.0);

        megaBoard.position.set(safeM.x, bPos.y + elevOffset, safeM.z);

        bLook
          .copy(megaBoard.position)
          .addScaledVector(bFwd, -1.0)
          .addScaledVector(bRight, -side * 0.22)
          .addScaledVector(bUp, -0.14);
        bRotMat.lookAt(megaBoard.position, bLook, bUp);
        megaBoard.quaternion.setFromRotationMatrix(bRotMat);

        // Heavy vertical truss mast supporting the cantilevered megabillboard
        const mastH = 26.0;
        const mast = new THREE.Mesh(
          new THREE.BoxGeometry(1.35, mastH, 1.35),
          frameCasingMat
        );
        mast.position.set(
          safeM.x + bRight.x * side * 5.2,
          bPos.y + elevOffset - mastH * 0.35,
          safeM.z + bRight.z * side * 5.2
        );
        decorGroup.add(mast, megaBoard);

        // 4 Sweeping Catenary Power Cables draping outward from the megabillboard to the outer support mast
        const anchorMast = mast.position.clone().addScaledVector(bUp, -4.5);
        for (let c = 0; c < 4; c++) {
          const startPt = megaBoard.position
            .clone()
            .addScaledVector(bUp, -mh * 0.35 + c * 1.1)
            .addScaledVector(bRight, side * (mw * 0.35));
          addCatenaryCable(startPt, anchorMast, 2.2 + c * 0.45, 0.095);
        }
      }
    }

    // ------------------------------------------------------------------------
    // 6E. COLOSSAL FLOATING HOLOGRAPHIC WIREFRAME GEODESIC SPHERES ("CYBRNETIC NOW")
    // & VOLCANIC-SLOPE CYAN WIREFRAME TOPOLOGICAL GRID STRUCTURES
    // ------------------------------------------------------------------------
    const holoWireGeoMat = new THREE.MeshBasicMaterial({
      color: isNeon ? 0x22d3ee : 0x0284c7,
      wireframe: true,
      transparent: true,
      opacity: isNeon ? 0.32 : 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const sphereCoreMat = new THREE.MeshBasicMaterial({
      map: textures.cyberSphereSignMap,
      transparent: true,
      opacity: isNeon ? 0.88 : 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const holoSphereSpecs = [
      { t: 0.075, side: 1, dist: 112, height: 68, radius: 34 },
      { t: 0.285, side: -1, dist: 125, height: 74, radius: 38 },
      { t: 0.455, side: -1, dist: 118, height: 72, radius: 36 },
      { t: 0.635, side: 1, dist: 122, height: 72, radius: 36 },
      { t: 0.765, side: -1, dist: 118, height: 70, radius: 34 },
      { t: 0.905, side: 1, dist: 115, height: 68, radius: 34 },
    ];

    for (let i = 0; i < holoSphereSpecs.length; i++) {
      const sp = holoSphereSpecs[i];
      sampleTrackFrame(spline, sp.t, bPos, bFwd, bRight, bUp);

      const sphereGroup = new THREE.Group();
      sphereGroup.position
        .copy(bPos)
        .addScaledVector(bRight, sp.side * sp.dist)
        .addScaledVector(bUp, sp.height);

      // Outer geodesic wireframe latitude/longitude sphere
      const wireSphere = new THREE.Mesh(
        new THREE.SphereGeometry(sp.radius, 24, 18),
        holoWireGeoMat
      );
      sphereGroup.add(wireSphere);

      // Equatorial orbital ring around the holographic sphere
      const orbitalRing = new THREE.Mesh(
        new THREE.TorusGeometry(sp.radius * 1.24, 0.32, 8, 48),
        cyanNeonTrimMat
      );
      orbitalRing.rotation.x = Math.PI * 0.42;
      orbitalRing.rotation.y = 0.28;
      sphereGroup.add(orbitalRing);

      // Glowing "CYBRNETIC NOW" core emblem inside the sphere facing the track
      const coreSign = new THREE.Mesh(
        new THREE.PlaneGeometry(sp.radius * 1.45, sp.radius * 0.72),
        sphereCoreMat
      );
      bLook.copy(bPos).addScaledVector(bUp, 6.0);
      bRotMat.lookAt(sphereGroup.position, bLook, new THREE.Vector3(0, 1, 0));
      coreSign.quaternion.setFromRotationMatrix(bRotMat);
      coreSign.rotateY(Math.PI);
      sphereGroup.add(coreSign);

      decorGroup.add(sphereGroup);
    }

    // Cyan Topological Wireframe Rock Cages & Terraced Grid Meshes on the outer volcanic slopes
    const wireRockGeo = new THREE.IcosahedronGeometry(12.5, 1);
    const wireGridPlaneGeo = new THREE.PlaneGeometry(36, 22, 12, 8);
    wireGridPlaneGeo.rotateX(-Math.PI / 2);

    const wireSlopeTs = [0.028, 0.088, 0.235, 0.315, 0.395, 0.475, 0.555, 0.635, 0.705, 0.875, 0.945];
    for (let i = 0; i < wireSlopeTs.length; i++) {
      sampleTrackFrame(spline, wireSlopeTs[i], bPos, bFwd, bRight, bUp);
      for (const side of [-1, 1]) {
        const rawWx = bPos.x + bRight.x * side * (halfW + 28 + (i % 3) * 6);
        const rawWz = bPos.z + bRight.z * side * (halfW + 28 + (i % 3) * 6);
        const safeW = ensureTrackClearanceXZ(rawWx, rawWz, 18.0, trackSamples, 14.0);

        const wireCage = new THREE.Mesh(wireRockGeo, holoWireGeoMat);
        wireCage.position.set(safeW.x, bPos.y + 2.5, safeW.z);
        wireCage.scale.set(1.4, 0.85 + (i % 2) * 0.35, 1.3);
        wireCage.rotation.y = i * 0.8;
        decorGroup.add(wireCage);

        const wireGrid = new THREE.Mesh(wireGridPlaneGeo, holoWireGeoMat);
        wireGrid.position.set(safeW.x, bPos.y - 0.4, safeW.z);
        bLook.copy(wireGrid.position).add(bFwd);
        bRotMat.lookAt(wireGrid.position, bLook, bUp);
        wireGrid.quaternion.setFromRotationMatrix(bRotMat);
        wireGrid.rotateZ(side * 0.22);
        decorGroup.add(wireGrid);
      }
    }

    // ------------------------------------------------------------------------
    // 6F. SKY-PROJECTED & MID-AIR HOLOGRAPHIC HUD PROJECTIONS (NON-INVASIVE, ZERO LIGHT PILLARS)
    // ------------------------------------------------------------------------
    const createLavaSkyHoloShader = (sheet: 1 | 2, tintHex: number, maxOpacity: number): THREE.ShaderMaterial => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uAtlas: { value: sheet === 1 ? textures.lavaDecorativeAtlas1Map : textures.lavaDecorativeAtlas2Map },
          uTime: { value: 0 },
          uTint: { value: new THREE.Color(tintHex) },
          uMaxOpacity: { value: isNeon ? maxOpacity : maxOpacity * 0.45 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform sampler2D uAtlas;
          uniform float uTime;
          uniform vec3 uTint;
          uniform float uMaxOpacity;
          varying vec2 vUv;
          varying vec3 vWorldPos;

          void main() {
            float jitter = sin(uTime * 15.0 + vWorldPos.x * 0.12) * smoothstep(0.93, 1.0, sin(uTime * 2.4)) * 0.004;
            vec3 tex = texture2D(uAtlas, vUv + vec2(jitter, 0.0)).rgb;
            float luma = dot(tex, vec3(0.299, 0.587, 0.114));
            float mask = smoothstep(0.08, 0.52, luma);

            float scan = 0.80 + 0.20 * sin(vUv.y * 210.0 - uTime * 8.5);
            vec2 edgeDist = smoothstep(vec2(0.0), vec2(0.09), vUv) * smoothstep(vec2(0.0), vec2(0.09), 1.0 - vUv);
            float borderGlow = (1.0 - edgeDist.x * edgeDist.y) * 0.32;

            float camDist = length(cameraPosition - vWorldPos);
            float proxFade = smoothstep(32.0, 78.0, camDist);
            float farFade = 1.0 - smoothstep(420.0, 680.0, camDist);

            vec3 holoCol = mix(tex, uTint * (0.65 + 0.75 * luma), 0.36) * scan + uTint * borderGlow * 0.45;
            float alpha = (mask * 0.85 + borderGlow * 0.25) * uMaxOpacity * proxFade * farFade * edgeDist.x * edgeDist.y;
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(holoCol, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      animatedShaders.push(mat);
      return mat;
    };

    const holoMatS2Cyan = createLavaSkyHoloShader(2, 0x00f2fe, 0.46);
    const holoMatS1Amber = createLavaSkyHoloShader(1, 0xff9500, 0.44);

    const midAirHoloSpecs: Array<{
      t: number;
      side: -1 | 1;
      crop: LavaAtlasCrop;
      w: number;
      h: number;
      latDist: number;
      elev: number;
    }> = [
      { t: 0.052, side: 1, crop: S2_BLUE_AI_HOLOGRAM_HUD, w: 28, h: 18, latDist: 38, elev: 28 },
      { t: 0.112, side: -1, crop: S2_NIGHT_CITY_CORP_HUD, w: 30, h: 20, latDist: 42, elev: 30 },
      { t: 0.275, side: 1, crop: S2_TOKYO_KATAKANA_NEON, w: 34, h: 9, latDist: 36, elev: 26 },
      { t: 0.395, side: -1, crop: S2_BLUE_AI_HOLOGRAM_HUD, w: 28, h: 18, latDist: 40, elev: 29 },
      { t: 0.545, side: 1, crop: S2_NIGHT_CITY_CORP_HUD, w: 30, h: 20, latDist: 42, elev: 31 },
      { t: 0.665, side: -1, crop: S1_KANJI_CYBER_RACING, w: 32, h: 8, latDist: 38, elev: 27 },
      { t: 0.775, side: 1, crop: S2_BLUE_AI_HOLOGRAM_HUD, w: 28, h: 18, latDist: 40, elev: 29 },
      { t: 0.905, side: -1, crop: S2_TOKYO_KATAKANA_NEON, w: 34, h: 9, latDist: 38, elev: 27 },
    ];

    for (let i = 0; i < midAirHoloSpecs.length; i++) {
      const hs = midAirHoloSpecs[i];
      sampleTrackFrame(spline, hs.t, bPos, bFwd, bRight, bUp);
      const geo = createCroppedPlaneGeo(hs.w, hs.h, hs.crop);
      const mat = hs.crop.sheet === 2 ? holoMatS2Cyan : holoMatS1Amber;
      const holoMesh = new THREE.Mesh(geo, mat);

      holoMesh.position
        .copy(bPos)
        .addScaledVector(bRight, hs.side * hs.latDist)
        .addScaledVector(bUp, hs.elev);

      bLook
        .copy(holoMesh.position)
        .addScaledVector(bFwd, -1.0)
        .addScaledVector(bRight, -hs.side * 0.35)
        .addScaledVector(bUp, -0.18);
      bRotMat.lookAt(holoMesh.position, bLook, bUp);
      holoMesh.quaternion.setFromRotationMatrix(bRotMat);

      decorGroup.add(holoMesh);
    }

    worldGroup.add(decorGroup);
  }

  return lavaFallsMesh;
}

