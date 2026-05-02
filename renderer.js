// MoleculeForge — Three.js renderer.
// Stylized 3D with cel-shading + inverted-hull outlines (textbook orbital chart aesthetic).

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CPK } from "./molecules.js";

// ============================================================
//   STYLE CONSTANTS (per visual style spec)
// ============================================================
const BG_COLOR        = 0x0a0612;
const LIGHT_DIR       = new THREE.Vector3(2, 3, 4).normalize();
const WHITE           = new THREE.Color(1, 1, 1);
const OUTLINE_THICK   = 0.025;
const OUTLINE_RGB     = new THREE.Vector3(0.04, 0.02, 0.07);

const ORBITAL_COLORS = {
  s: new THREE.Color(0x38bdf8),
  p: new THREE.Color(0xa855f7),
  d: new THREE.Color(0xec4899),
  f: new THREE.Color(0xfacc15),
};

const HYBRID_WEIGHTS = {
  "sp":     { s: 0.50, p: 0.50 },
  "sp²":    { s: 0.33, p: 0.67 },
  "sp³":    { s: 0.25, p: 0.75 },
  "sp³d":   { s: 0.20, p: 0.60, d: 0.20 },
  "sp³d²":  { s: 0.17, p: 0.50, d: 0.33 },
};

const LONE_PAIR_COLOR = new THREE.Color(0xfb923c);
const BOND_COLOR      = new THREE.Color(0x444455);
const GUIDE_COLOR     = 0xc084fc;
const ANGLE_COLOR     = 0xfacc15;
const DIPOLE_COLOR    = 0xec4899;
const BONDARROW_COLOR = 0xfacc15;
const CANCEL_COLOR    = 0x4ade80;
const LABEL_COLOR     = "#fef3c7";

// ============================================================
//   SHADERS
// ============================================================
const TOON_VS = /* glsl */`
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const TOON_FS = /* glsl */`
precision highp float;
varying vec3 vNormal;
uniform vec3 uLightDir;
uniform vec3 uColorDark, uColorMid, uColorLight, uColorHi;
void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uLightDir);
  float ndl = max(dot(N, L), 0.0);
  vec3 col;
  if      (ndl < 0.25) col = uColorDark;
  else if (ndl < 0.55) col = uColorMid;
  else if (ndl < 0.85) col = uColorLight;
  else                 col = uColorHi;
  gl_FragColor = vec4(col, 1.0);
}
`;

const OUTLINE_VS = /* glsl */`
uniform float uThickness;
void main() {
  vec3 expanded = position + normal * uThickness;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(expanded, 1.0);
}
`;

const OUTLINE_FS = /* glsl */`
precision highp float;
uniform vec3 uColor;
void main() { gl_FragColor = vec4(uColor, 1.0); }
`;

// ============================================================
//   COLOR + MATERIAL HELPERS
// ============================================================
function blendHybrid(hybridStr) {
  const w = HYBRID_WEIGHTS[hybridStr] || HYBRID_WEIGHTS["sp³"];
  const c = new THREE.Color(0, 0, 0);
  for (const k of Object.keys(w)) {
    const oc = ORBITAL_COLORS[k];
    c.r += oc.r * w[k];
    c.g += oc.g * w[k];
    c.b += oc.b * w[k];
  }
  return c;
}

function toonBands(base) {
  return {
    dark:  base.clone().multiplyScalar(0.30),
    mid:   base.clone().multiplyScalar(0.65),
    light: base.clone(),
    hi:    base.clone().lerp(WHITE, 0.45),
  };
}

function makeToonMaterial(baseColor) {
  const b = toonBands(baseColor);
  return new THREE.ShaderMaterial({
    uniforms: {
      uLightDir:   { value: LIGHT_DIR.clone() },
      uColorDark:  { value: b.dark.clone() },
      uColorMid:   { value: b.mid.clone() },
      uColorLight: { value: b.light.clone() },
      uColorHi:    { value: b.hi.clone() },
    },
    vertexShader: TOON_VS,
    fragmentShader: TOON_FS,
  });
}

function makeOutlineMaterial(thickness = OUTLINE_THICK) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor:     { value: OUTLINE_RGB.clone() },
    },
    vertexShader: OUTLINE_VS,
    fragmentShader: OUTLINE_FS,
    side: THREE.BackSide,
  });
}

// Group containing outline child (added first, per spec) + filled child for one geometry.
function makeOutlinedMesh(geometry, baseColor, thickness = OUTLINE_THICK) {
  const grp = new THREE.Group();
  const outlineMesh = new THREE.Mesh(geometry, makeOutlineMaterial(thickness));
  const fillMesh    = new THREE.Mesh(geometry, makeToonMaterial(baseColor));
  grp.add(outlineMesh);
  grp.add(fillMesh);
  grp.userData.outlineMesh = outlineMesh;
  grp.userData.fillMesh    = fillMesh;
  return grp;
}

// ============================================================
//   LOBE PROFILES (textbook teardrop, revolved)
// ============================================================
function makeMainLobeProfile(length, segments = 48) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let r;
    if (t < 0.08) {
      r = t * 0.6;
    } else if (t < 0.85) {
      const u = (t - 0.08) / (0.85 - 0.08);
      const bulge = Math.pow(Math.sin(u * Math.PI), 0.55);
      r = 0.05 + bulge * 0.42;
    } else {
      const u = (t - 0.85) / 0.15;
      r = 0.42 * Math.pow(Math.cos(u * Math.PI / 2), 0.7) * (1 - u * 0.3);
      r = Math.max(r, 0.001);
    }
    pts.push(new THREE.Vector2(r, t * length));
  }
  return pts;
}

function makeBackLobeProfile(length, segments = 32) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let r;
    if (t < 0.1) {
      r = t * 0.5;
    } else if (t < 0.85) {
      const u = (t - 0.1) / (0.85 - 0.1);
      r = 0.04 + Math.pow(Math.sin(u * Math.PI), 0.6) * 0.18;
    } else {
      const u = (t - 0.85) / 0.15;
      r = 0.18 * Math.cos(u * Math.PI / 2);
      r = Math.max(r, 0.001);
    }
    pts.push(new THREE.Vector2(r, t * length));
  }
  return pts;
}

const LOBE_LEN_MAIN  = 1.55;
const LOBE_LEN_BACK  = 0.55;
const MAIN_LOBE_GEOM = new THREE.LatheGeometry(makeMainLobeProfile(LOBE_LEN_MAIN, 48), 40);
const BACK_LOBE_GEOM = new THREE.LatheGeometry(makeBackLobeProfile(LOBE_LEN_BACK, 32), 28);

// ============================================================
//   SHARED GEOMETRY
// ============================================================
const SPHERE_GEOM   = new THREE.SphereGeometry(1, 32, 32);
const PARTICLE_GEOM = new THREE.SphereGeometry(0.045, 8, 6);
const BOND_GEOM     = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 16);

const SHARED_GEOMS = new Set([SPHERE_GEOM, PARTICLE_GEOM, BOND_GEOM, MAIN_LOBE_GEOM, BACK_LOBE_GEOM]);

// ============================================================
//   ATOM STYLE
// ============================================================
function atomBaseColor(element) {
  if (element === "H") return new THREE.Color(0xcfcfcf);
  if (element === "C") return new THREE.Color(0x2d2d2d);
  const cpk = CPK[element];
  if (cpk) return new THREE.Color(cpk.color);
  return new THREE.Color(0x888888);
}

function atomRadius(element) {
  if (element === "H") return 0.16;
  if (element === "C") return 0.22;
  const cpk = CPK[element] || { radius: 0.4 };
  return Math.min(0.30, Math.max(0.18, cpk.radius * 0.50));
}

// ============================================================
//   EASINGS
// ============================================================
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack  = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// =================================================================
//                       MOLECULE RENDERER
// =================================================================
export class MoleculeRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.opts = Object.assign({ autoRotateAfterIdle: true }, options);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG_COLOR);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;

    this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    this.camera.position.set(3.0, 2.2, 5.0);

    // Lighting per spec — single key + ambient (multiple lights mush toon bands).
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(2, 3, 4);
    this.scene.add(key);

    this.moleculeGroup = new THREE.Group();
    this.scene.add(this.moleculeGroup);

    // HTML overlay for atom + angle labels (per spec, 2D in screen space).
    this.labelOverlay = document.createElement("div");
    this.labelOverlay.className = "label-overlay";
    if (this.canvas.parentElement) {
      this.canvas.parentElement.appendChild(this.labelOverlay);
    }

    // State trackers
    this.atomMeshes = [];
    this.bondMeshes = [];
    this.bondingLobes = [];
    this.lonePairMeshes = [];
    this.dipoleArrows = [];
    this.netDipole = null;
    this.guideLines = [];
    this.angleArcs = [];
    this.particleSystems = [];
    this.animations = [];
    this.currentMolecule = null;

    this._setupControls();

    this.labelsVisible = false;
    this.anglesVisible = false;
    this.idleSince = performance.now();
    this.autoRotateEnabled = !!this.opts.autoRotateAfterIdle;

    window.addEventListener("resize", () => this.onResize());
    const bumpIdle = () => { this.idleSince = performance.now(); };
    this.canvas.addEventListener("pointerdown", bumpIdle);
    this.canvas.addEventListener("pointermove", e => { if (e.buttons) bumpIdle(); });
    this.canvas.addEventListener("wheel", bumpIdle, { passive: true });

    this._clock = new THREE.Clock();
    this._animateBound = this._animate.bind(this);
    requestAnimationFrame(this._animateBound);

    this._tmpV = new THREE.Vector3();
  }

  _setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 20;
    this.controls.target.set(0, 0, 0);
    const bump = () => { this.idleSince = performance.now(); };
    this.controls.addEventListener("start", bump);
    this.controls.addEventListener("end",   bump);
    this.controls.update();
  }

  onResize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setMolecule(molecule) {
    this.currentMolecule = molecule;
  }

  setAutoRotate(enabled) {
    this.autoRotateEnabled = !!enabled;
    this.idleSince = performance.now();
  }

  setLabelsVisible(v) {
    this.labelsVisible = !!v;
  }

  setAnglesVisible(v) {
    this.anglesVisible = !!v;
    if (!v) {
      for (const arc of this.angleArcs) {
        if (arc.line && arc.line.parent) arc.line.parent.remove(arc.line);
        if (arc.line && arc.line.geometry) arc.line.geometry.dispose();
        if (arc.line && arc.line.material) arc.line.material.dispose();
        if (arc.label && arc.label.parentNode) arc.label.parentNode.removeChild(arc.label);
      }
      this.angleArcs = [];
      return;
    }
    this._buildAngleArcs();
  }

  // -------- Animation harness --------
  _addAnim(durMs, updateFn, completeFn) {
    this.animations.push({
      start: performance.now(), dur: durMs, update: updateFn, complete: completeFn,
    });
  }

  _animate() {
    requestAnimationFrame(this._animateBound);
    if (this.canvas.offsetParent === null && this.canvas.tagName === "CANVAS") return;

    const dt = this._clock.getDelta();
    const now = performance.now();

    this.animations = this.animations.filter(a => {
      const t = Math.min((now - a.start) / a.dur, 1);
      a.update(t);
      if (t >= 1) { a.complete && a.complete(); return false; }
      return true;
    });

    // Subtle lone pair pulse
    for (const lp of this.lonePairMeshes) {
      const s = 1 + 0.05 * Math.sin(now * 0.003 + lp.phase);
      lp.group.scale.setScalar(s);
    }

    if (this.autoRotateEnabled && (now - this.idleSince) > 5000) {
      this.moleculeGroup.rotation.y += 0.4 * dt;
    }

    // Particle FX
    for (const sys of this.particleSystems) {
      const age = (now - sys.born) / sys.life;
      if (age >= 1) {
        sys.group.parent && sys.group.parent.remove(sys.group);
        sys.group.traverse(o => {
          if (o.material) o.material.dispose && o.material.dispose();
        });
        sys.dead = true;
        continue;
      }
      sys.group.children.forEach((m, i) => {
        const v = sys.vels[i];
        m.position.x = v.ox + v.x * age;
        m.position.y = v.oy + v.y * age - 1.0 * age * age;
        m.position.z = v.oz + v.z * age;
        m.material.opacity = 1 - age;
      });
    }
    this.particleSystems = this.particleSystems.filter(s => !s.dead);

    this._updateLabels();

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _updateLabels() {
    if (!this.labelOverlay) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const m = this.moleculeGroup.matrixWorld;

    for (const a of this.atomMeshes) {
      if (!a.label) continue;
      this._tmpV.copy(a.labelAnchor).applyMatrix4(m).project(this.camera);
      const x = (this._tmpV.x *  0.5 + 0.5) * w;
      const y = (this._tmpV.y * -0.5 + 0.5) * h;
      a.label.style.left = x + "px";
      a.label.style.top  = y + "px";
      const visible = this.labelsVisible && this._tmpV.z > -1 && this._tmpV.z < 1;
      a.label.style.display = visible ? "block" : "none";
    }
    for (const arc of this.angleArcs) {
      if (!arc.label) continue;
      this._tmpV.copy(arc.anchor).applyMatrix4(m).project(this.camera);
      const x = (this._tmpV.x *  0.5 + 0.5) * w;
      const y = (this._tmpV.y * -0.5 + 0.5) * h;
      arc.label.style.left = x + "px";
      arc.label.style.top  = y + "px";
      arc.label.style.display = (this._tmpV.z > -1 && this._tmpV.z < 1) ? "block" : "none";
    }
  }

  // -------- Cleanup --------
  clearMolecule() {
    while (this.moleculeGroup.children.length) {
      const c = this.moleculeGroup.children[0];
      this.moleculeGroup.remove(c);
      c.traverse(o => {
        const g = o.geometry;
        if (g && !SHARED_GEOMS.has(g) && g.userData && g.userData.disposable) {
          g.dispose && g.dispose();
        }
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m && m.map && m.map.dispose) m.map.dispose();
            m && m.dispose && m.dispose();
          }
        }
      });
    }
    if (this.labelOverlay) this.labelOverlay.innerHTML = "";

    this.atomMeshes = [];
    this.bondMeshes = [];
    this.bondingLobes = [];
    this.lonePairMeshes = [];
    this.dipoleArrows = [];
    this.netDipole = null;
    this.guideLines = [];
    this.angleArcs = [];
    this.animations = [];
    this.particleSystems = [];
    this.currentMolecule = null;
    this.moleculeGroup.rotation.set(0, 0, 0);
    this.idleSince = performance.now();
  }

  // -------- Atom + bond + lobe builders --------
  _makeAtom(element) {
    const radius = atomRadius(element);
    const baseColor = atomBaseColor(element);
    const grp = new THREE.Group();
    // Outline thickness scaled inversely so world thickness stays constant after group-scale.
    const outline = new THREE.Mesh(SPHERE_GEOM, makeOutlineMaterial(OUTLINE_THICK / radius));
    const fill    = new THREE.Mesh(SPHERE_GEOM, makeToonMaterial(baseColor));
    grp.add(outline);
    grp.add(fill);
    grp.scale.setScalar(radius);
    grp.userData.radius = radius;
    grp.userData.outlineMesh = outline;
    grp.userData.fillMesh    = fill;
    return grp;
  }

  _attachLabel(record, element) {
    if (!this.labelOverlay) return;
    const el = document.createElement("div");
    el.className = "atom-label";
    el.textContent = element;
    el.style.display = "none";
    this.labelOverlay.appendChild(el);
    record.label = el;
  }

  // -------- Public API: stage 1 — central atom --------
  addCentralAtom(element, position = [0, 0, 0], animate = true, onDone = null) {
    const grp = this._makeAtom(element);
    grp.position.fromArray(position);
    const r = grp.userData.radius;
    const rec = {
      group: grp,
      element,
      position: position.slice(),
      isCentral: true,
      labelAnchor: new THREE.Vector3(position[0], position[1] + r + 0.45, position[2]),
    };
    this._attachLabel(rec, element);
    this.moleculeGroup.add(grp);
    this.atomMeshes.push(rec);

    if (animate) {
      this._spawnParticleBurst(grp.position, atomBaseColor(element).getHex(), 14);
      const target = r;
      grp.scale.setScalar(0.001);
      this._addAnim(620, t => {
        const s = easeOutBack(t) * target;
        grp.scale.setScalar(Math.max(0.001, s));
      }, () => {
        grp.scale.setScalar(target);
        onDone && onDone();
      });
    } else {
      onDone && onDone();
    }
    return rec;
  }

  _spawnParticleBurst(origin, hexColor, count = 14) {
    const group = new THREE.Group();
    const vels = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        PARTICLE_GEOM,
        new THREE.MeshBasicMaterial({
          color: hexColor,
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
        })
      );
      m.position.copy(origin);
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const speed = 1.2 + Math.random() * 0.8;
      vels.push({
        ox: origin.x, oy: origin.y, oz: origin.z,
        x: Math.sin(phi) * Math.cos(theta) * speed,
        y: Math.cos(phi) * speed,
        z: Math.sin(phi) * Math.sin(theta) * speed,
      });
      group.add(m);
    }
    this.moleculeGroup.add(group);
    this.particleSystems.push({ group, born: performance.now(), life: 700, vels });
  }

  // -------- Public API: stage 2 — guide lines (electron domain skeleton) --------
  showGuideLines(directions, fromAtomPos = [0,0,0], length = 1.55) {
    const origin = new THREE.Vector3().fromArray(fromAtomPos);
    for (const d of directions) {
      const v = new THREE.Vector3().fromArray(d);
      if (v.lengthSq() < 1e-6) continue;
      const dirVec = v.normalize().multiplyScalar(length);
      const start = origin.clone();
      const end   = start.clone().add(dirVec);
      const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
      geom.userData.disposable = true;
      const mat = new THREE.LineBasicMaterial({
        color: GUIDE_COLOR, transparent: true, opacity: 0,
      });
      const line = new THREE.Line(geom, mat);
      this.moleculeGroup.add(line);
      this.guideLines.push(line);
    }
    this._addAnim(420, t => {
      for (const ln of this.guideLines) ln.material.opacity = 0.55 * t;
    });
  }

  // -------- Public API: stage 3 — bonded atoms + central hybrid lobes + bonds --------
  addBondedAtoms(atoms, bonds, bondOrders, centralIdx = 0, onDone = null) {
    const central = this.atomMeshes[centralIdx];
    if (!central) { onDone && onDone(); return; }
    const cPos = new THREE.Vector3().fromArray(atoms[centralIdx].position);
    const hybridization = (this.currentMolecule && this.currentMolecule.hybridization) || "sp³";
    const lobeColor = blendHybrid(hybridization);

    // 1) Surrounding atoms
    const records = [];
    const targetPositions = [];
    const startPositions  = [];
    for (let i = 0; i < atoms.length; i++) {
      if (i === centralIdx) { records.push(central); continue; }
      const a = atoms[i];
      const pos = new THREE.Vector3().fromArray(a.position);
      const grp = this._makeAtom(a.element);
      const startPos = pos.clone().multiplyScalar(2.6);
      grp.position.copy(startPos);
      grp.scale.setScalar(0.001);
      const r = grp.userData.radius;
      const labelAnchor = pos.clone().add(new THREE.Vector3(0, r + 0.45, 0));
      const rec = {
        group: grp,
        element: a.element,
        position: a.position.slice(),
        labelAnchor,
      };
      this._attachLabel(rec, a.element);
      this.moleculeGroup.add(grp);
      this.atomMeshes.push(rec);
      records.push(rec);
      startPositions[i]  = startPos;
      targetPositions[i] = pos;
    }

    // 2) Central hybrid lobes (main + back per bond) and bond cylinders
    const animItems = [];
    for (let bi = 0; bi < bonds.length; bi++) {
      const [aIdx, bIdx] = bonds[bi];
      const otherIdx = aIdx === centralIdx ? bIdx : aIdx;
      const otherPos = new THREE.Vector3().fromArray(atoms[otherIdx].position);
      const dir = otherPos.clone().sub(cPos).normalize();
      const bondLen = otherPos.clone().sub(cPos).length();
      const order = bondOrders ? bondOrders[bi] : 1;

      // Main lobe
      const main = makeOutlinedMesh(MAIN_LOBE_GEOM, lobeColor);
      main.position.copy(cPos);
      main.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      main.scale.set(1, 0.001, 1);
      this.moleculeGroup.add(main);
      animItems.push({ type: "lobe", obj: main });
      this.bondingLobes.push(main);

      // Back lobe
      const back = makeOutlinedMesh(BACK_LOBE_GEOM, lobeColor);
      back.position.copy(cPos);
      back.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
      back.scale.set(1, 0.001, 1);
      this.moleculeGroup.add(back);
      animItems.push({ type: "lobe", obj: back });
      this.bondingLobes.push(back);

      // Bond cylinder(s)
      const worldUp = new THREE.Vector3(0, 1, 0);
      let perp;
      if (Math.abs(dir.dot(worldUp)) > 0.95) {
        perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
      } else {
        perp = new THREE.Vector3().crossVectors(dir, worldUp).normalize();
      }
      const offsets = order === 1 ? [0] : order === 2 ? [-0.08, 0.08] : [-0.13, 0, 0.13];
      const midpoint = cPos.clone().lerp(otherPos, 0.5);
      for (const off of offsets) {
        const bondGrp = makeOutlinedMesh(BOND_GEOM, BOND_COLOR);
        bondGrp.position.copy(midpoint).addScaledVector(perp, off);
        bondGrp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        bondGrp.scale.set(1, 0.001, 1);
        this.moleculeGroup.add(bondGrp);
        animItems.push({ type: "bond", obj: bondGrp, len: bondLen });
      }

      this.bondMeshes.push({
        start: cPos.clone(),
        end:   otherPos.clone(),
        fullLen: bondLen,
        order,
      });
    }

    // 3) Animate atom fly-in + lobe + bond growth
    this._addAnim(700, t => {
      const e = easeOutCubic(t);
      for (let i = 0; i < atoms.length; i++) {
        if (i === centralIdx) continue;
        const rec = records[i];
        const sp = startPositions[i], fp = targetPositions[i];
        rec.group.position.lerpVectors(sp, fp, e);
        rec.group.scale.setScalar(rec.group.userData.radius * e);
      }
      for (const it of animItems) {
        if (it.type === "bond") it.obj.scale.y = Math.max(0.001, it.len * e);
        else                    it.obj.scale.y = Math.max(0.001, e);
      }
    }, () => {
      for (let i = 0; i < atoms.length; i++) {
        if (i === centralIdx) continue;
        const rec = records[i];
        rec.group.position.copy(targetPositions[i]);
        rec.group.scale.setScalar(rec.group.userData.radius);
      }
      for (const it of animItems) {
        if (it.type === "bond") it.obj.scale.y = it.len;
        else                    it.obj.scale.y = 1;
      }
      onDone && onDone();
    });
  }

  // -------- Public API: lone pairs (orange override per spec) --------
  addLonePairs(positions, fromAtomPos = [0, 0, 0]) {
    const origin = new THREE.Vector3().fromArray(fromAtomPos);
    for (const p of positions) {
      const v = new THREE.Vector3().fromArray(p);
      if (v.lengthSq() < 1e-6) continue;
      const dir = v.clone().normalize();

      const grp = new THREE.Group();
      grp.position.copy(origin);

      const main = makeOutlinedMesh(MAIN_LOBE_GEOM, LONE_PAIR_COLOR);
      main.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      main.scale.set(1, 0.001, 1);
      grp.add(main);

      const back = makeOutlinedMesh(BACK_LOBE_GEOM, LONE_PAIR_COLOR);
      back.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
      back.scale.set(1, 0.001, 1);
      grp.add(back);

      this.moleculeGroup.add(grp);
      this.lonePairMeshes.push({
        group: grp, main, back, phase: Math.random() * Math.PI * 2,
      });

      this._addAnim(450, t => {
        const e = easeOutCubic(t);
        main.scale.y = Math.max(0.001, e);
        back.scale.y = Math.max(0.001, e);
      });
    }
  }

  // -------- Public API: dipole arrows --------
  showDipoles(molecule, isPolar) {
    this._clearDipoles();
    if (!this.atomMeshes[0]) return;

    const bondArrows = [];
    for (let bi = 0; bi < molecule.bonds.length; bi++) {
      const [a, b] = molecule.bonds[bi];
      const start = new THREE.Vector3().fromArray(molecule.atoms[a].position);
      const end   = new THREE.Vector3().fromArray(molecule.atoms[b].position);
      const dir = new THREE.Vector3().subVectors(end, start).normalize();
      const mid = new THREE.Vector3().lerpVectors(start, end, 0.55);
      const arrow = new THREE.ArrowHelper(dir, mid, 0.7, BONDARROW_COLOR, 0.22, 0.14);
      arrow.line.material.transparent = true;
      arrow.cone.material.transparent = true;
      arrow.line.material.opacity = 0;
      arrow.cone.material.opacity = 0;
      this.moleculeGroup.add(arrow);
      bondArrows.push(arrow);
      this.dipoleArrows.push(arrow);
    }

    this._addAnim(400, t => {
      for (const a of bondArrows) {
        a.line.material.opacity = t;
        a.cone.material.opacity = t;
      }
    }, () => {
      setTimeout(() => {
        this._addAnim(420, t => {
          for (const a of bondArrows) {
            a.line.material.opacity = 1 - t;
            a.cone.material.opacity = 1 - t;
          }
        }, () => {
          setTimeout(() => {
            if (isPolar) this._showNetDipole(molecule);
            else         this._showCancellation();
          }, 480);
        });
      }, 700);
    });
  }

  _showNetDipole(molecule) {
    const v = new THREE.Vector3().fromArray(molecule.net_dipole_vector || [0, 1, 0]);
    if (v.lengthSq() < 1e-4) v.set(0, 1, 0);
    const dir = v.clone().normalize();
    const mag = Math.min(2.0, Math.max(0.9, v.length() * 1.6));

    const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), mag, DIPOLE_COLOR, 0.28, 0.16);
    arrow.line.material.transparent = true;
    arrow.cone.material.transparent = true;
    arrow.line.material.opacity = 0;
    arrow.cone.material.opacity = 0;
    arrow.scale.setScalar(0.001);
    this.moleculeGroup.add(arrow);
    this.netDipole = arrow;

    this._addAnim(420, t => {
      const s = easeOutBack(t);
      arrow.scale.setScalar(Math.max(0.001, s));
      arrow.line.material.opacity = t;
      arrow.cone.material.opacity = t;
    });
  }

  _showCancellation() {
    const grp = new THREE.Group();
    const barGeom = new THREE.BoxGeometry(0.6, 0.06, 0.06);
    barGeom.userData.disposable = true;
    const matA = new THREE.MeshBasicMaterial({ color: CANCEL_COLOR, transparent: true, opacity: 0 });
    const matB = matA.clone();
    const b1 = new THREE.Mesh(barGeom, matA);
    const b2 = new THREE.Mesh(barGeom, matB);
    b1.rotation.z =  Math.PI / 4;
    b2.rotation.z = -Math.PI / 4;
    grp.add(b1); grp.add(b2);
    this.moleculeGroup.add(grp);
    this.netDipole = grp;
    this._addAnim(450, t => {
      matA.opacity = t;
      matB.opacity = t;
      grp.scale.setScalar(1 + 0.2 * (1 - t));
    });
  }

  _clearDipoles() {
    for (const a of this.dipoleArrows) {
      a.parent && a.parent.remove(a);
      if (a.line && a.line.material) a.line.material.dispose();
      if (a.cone && a.cone.material) a.cone.material.dispose();
    }
    this.dipoleArrows = [];
    if (this.netDipole) {
      this.netDipole.parent && this.netDipole.parent.remove(this.netDipole);
      this.netDipole.traverse && this.netDipole.traverse(o => {
        if (o.geometry && o.geometry.userData && o.geometry.userData.disposable) o.geometry.dispose();
        if (o.material) o.material.dispose && o.material.dispose();
      });
      this.netDipole = null;
    }
  }

  // -------- Public API: full-molecule build (Learn / Polarity) --------
  buildFullMolecule(molecule, { showDipoles = false } = {}) {
    this.clearMolecule();
    this.setMolecule(molecule);
    const cAtom = molecule.atoms[0];
    this.addCentralAtom(cAtom.element, cAtom.position, true);

    setTimeout(() => {
      this.addBondedAtoms(molecule.atoms, molecule.bonds, molecule.bond_orders, 0);
    }, 250);
    setTimeout(() => {
      if (molecule.lone_pair_positions && molecule.lone_pair_positions.length) {
        this.addLonePairs(molecule.lone_pair_positions, cAtom.position);
      }
    }, 950);
    if (showDipoles) {
      setTimeout(() => this.showDipoles(molecule, molecule.polar), 1500);
    }
    if (molecule.charge) {
      setTimeout(() => this.addChargeBadge(molecule.charge), 1100);
    }
  }

  // -------- Public API: charge badge --------
  addChargeBadge(text, color = "#facc15", position = [2.2, 1.6, 0]) {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const g = c.getContext("2d");
    g.font = "bold 88px JetBrains Mono, monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(10,6,18,0.9)";
    g.beginPath(); g.arc(64, 64, 48, 0, Math.PI * 2); g.fill();
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = color;
    g.fillText(text, 64, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.fromArray(position);
    sprite.scale.setScalar(0.7);
    sprite.renderOrder = 1000;
    sprite.userData.isChargeBadge = true;
    this.moleculeGroup.add(sprite);
    sprite.scale.setScalar(0.001);
    this._addAnim(500, t => {
      sprite.scale.setScalar(0.7 * easeOutBack(t));
    });
    return sprite;
  }

  // -------- Angle arcs --------
  _buildAngleArcs() {
    const central = this.atomMeshes[0];
    if (!central) return;
    const cPos = new THREE.Vector3().fromArray(central.position);
    const bonds = this.bondMeshes;
    if (bonds.length < 2) return;

    const dirs = bonds.map(b => {
      const isStartCentral = b.start.distanceTo(cPos) < 0.01;
      const other = isStartCentral ? b.end : b.start;
      return { dir: other.clone().sub(cPos).normalize(), len: cPos.distanceTo(other) };
    });

    for (let i = 0; i < dirs.length; i++) {
      for (let j = i + 1; j < dirs.length; j++) {
        const a = dirs[i].dir, b = dirs[j].dir;
        const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
        const angleRad = Math.acos(dot);
        const angleDeg = angleRad * 180 / Math.PI;
        if (angleDeg > 175) continue;
        if (angleDeg < 30) continue;

        const arcRadius = 0.6;
        const segments = 32;
        const pts = [];
        const axis = new THREE.Vector3().crossVectors(a, b).normalize();
        if (axis.lengthSq() < 1e-4) continue;
        for (let s = 0; s <= segments; s++) {
          const t = (s / segments) * angleRad;
          const v = a.clone().applyAxisAngle(axis, t).multiplyScalar(arcRadius).add(cPos);
          pts.push(v);
        }
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        geom.userData.disposable = true;
        const mat = new THREE.LineBasicMaterial({ color: ANGLE_COLOR, transparent: true, opacity: 0.9 });
        const arc = new THREE.Line(geom, mat);
        this.moleculeGroup.add(arc);

        const midT = angleRad / 2;
        const midP = a.clone().applyAxisAngle(axis, midT).multiplyScalar(arcRadius * 1.25).add(cPos);

        const labelEl = document.createElement("div");
        labelEl.className = "angle-label";
        labelEl.textContent = `${angleDeg.toFixed(0)}°`;
        if (this.labelOverlay) this.labelOverlay.appendChild(labelEl);

        this.angleArcs.push({ line: arc, label: labelEl, anchor: midP });
      }
    }
  }
}
