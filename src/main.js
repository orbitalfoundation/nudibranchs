import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import GUI from 'lil-gui';

import { makeSpecies, SPECIES_ORDER, SPECIES_LABELS } from './species/presets.js';
import { NudibranchRig } from './rig/NudibranchRig.js';
import { buildEnvironment, buildMarineSnow } from './scene/environment.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 0.3;
controls.maxDistance = 40;

const env = buildEnvironment(scene, renderer);
const snow = buildMarineSnow(scene);

// Subtle bloom only on the wettest specular highlights (they gleam, not glow).
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.5, 1.05);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const DEFAULT_ID = SPECIES_ORDER[Math.floor(Math.random() * SPECIES_ORDER.length)];
let params = makeSpecies(DEFAULT_ID);
let rig = null;
let currentSpecies = DEFAULT_ID;

function frameCamera(preserve = false) {
  const s = rig.span;
  const c = rig.centre;
  const dist = s * 1.15 + 0.25;
  if (!preserve) {
    camera.position.set(c.x + s * 0.15, c.y + s * 1.05, dist);
    controls.target.set(c.x, c.y - s * 0.02, c.z);
  }
  camera.near = Math.max(0.01, s * 0.02);
  camera.far = s * 60 + 20;
  camera.updateProjectionMatrix();
  env.setScale(s);
  snow.setScale(s);
}

function rebuild(preserveCamera = true) {
  if (rig) { scene.remove(rig); rig.dispose(); }
  rig = new NudibranchRig(params);
  scene.add(rig);
  frameCamera(preserveCamera);
  updateLabels();
}

function updateLabels() {
  document.getElementById('species-name').textContent = params.displayName;
  document.getElementById('mode-line').textContent = `${params.clade} · a parametric sea slug`;
}

// ---- GUI ----
const ui = { autoRotate: false, paused: false };
const gui = new GUI({ title: '🐌 nudibranch' });
gui.domElement.id = 'gui-panel';
if (gui.$title) gui.$title.style.display = 'none';

function setSpecies(id) {
  currentSpecies = id;
  params = makeSpecies(id);
  rebuild(false);
  highlightSpecies(id);
  refreshControllers();
}

const fExplore = gui.addFolder('explore');
const speciesChips = {};
function highlightSpecies(id) { for (const k in speciesChips) speciesChips[k].classList.toggle('active', k === id); }
(function buildChips() {
  const bar = document.createElement('div');
  bar.className = 'species-chips';
  for (const id of SPECIES_ORDER) {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = SPECIES_LABELS[id] || id;
    b.addEventListener('click', () => setSpecies(id));
    speciesChips[id] = b; bar.appendChild(b);
  }
  const container = fExplore.$children || fExplore.domElement;
  container.insertBefore(bar, container.firstChild);
})();

const rb = () => rebuild(true);
const fBody = gui.addFolder('body');
fBody.add(params.body, 'length', 0.5, 1.8, 0.01).name('length').listen().onChange(rb);
fBody.add(params.body, 'width', 0.1, 0.6, 0.01).name('width').listen().onChange(rb);
fBody.add(params.body, 'height', 0.1, 0.45, 0.01).name('height').listen().onChange(rb);
fBody.add(params.body, 'mantleOverhang', 0, 0.6, 0.01).name('mantle skirt').listen().onChange(rb);
fBody.add(params.body, 'tailTaper', 0, 1, 0.01).name('tail taper').listen().onChange(rb);
fBody.add(params.body, 'blend', 0.02, 0.12, 0.005).name('smin blend').listen().onChange(rb);
fBody.close();

const fLook = gui.addFolder('appearance');
fLook.addColor(params.surface, 'base').name('base colour').listen().onChange(rb);
fLook.add(params.surface, 'gloss', 0, 1, 0.01).name('wet gloss').listen().onChange(rb);
fLook.close();

const fScene = gui.addFolder('scene');
fScene.add(ui, 'autoRotate').name('auto-rotate').onChange((v) => (controls.autoRotate = v));
fScene.add(ui, 'paused').name('pause');
fScene.add({ reset: () => frameCamera(false) }, 'reset').name('reset camera');
fScene.close();

function refreshControllers() { for (const c of gui.controllersRecursive()) c.updateDisplay(); }

const panelTab = document.getElementById('panel-tab');
gui.domElement.addEventListener('click', (e) => e.stopPropagation());
panelTab?.addEventListener('click', () => document.body.classList.toggle('panel-open'));
if (innerWidth > 560) document.body.classList.add('panel-open');

rebuild(false);
highlightSpecies(currentSpecies);
refreshControllers();
document.getElementById('loader').style.opacity = '0';
setTimeout(() => document.getElementById('loader')?.remove(), 700);

const clock = new THREE.Clock();
const hud = document.getElementById('hud');
let frames = 0, fpsT = 0, fps = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!ui.paused && rig) rig.update(dt);
  snow.update(dt);
  env.update(clock.elapsedTime, camera);
  controls.update();
  composer.render();
  frames++; fpsT += dt;
  if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  hud.textContent = `${params.id} · ${params.clade} · ${rig ? rig.bodyMesh.geometry.userData.verts : 0} v · ${fps} fps`;
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

window.NUDI = { get params() { return params; }, rig: () => rig, setSpecies };
