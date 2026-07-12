import * as THREE from 'three';

// A "wet jewel under a dive light" — the deliberate mood shift from the siphonophore
// void. The animal crawls on a dark reef substrate, lit by a warm key (a diver's
// torch) with a cool fill and a rim, so the wet clearcoat throws bright glints and
// the saturated colour reads. Opaque, lit, grounded — NOT blackwater additive.
export function buildEnvironment(scene, renderer) {
  const bg = new THREE.Color(0x0a0f16);
  scene.background = bg;
  scene.fog = new THREE.FogExp2(bg.getHex(), 0.12);

  // Substrate the animal sits on: a large dark plane with a faint mottled tint,
  // receiving the key light's shadow to ground the animal.
  const subMat = new THREE.MeshStandardMaterial({ color: 0x121821, roughness: 0.9, metalness: 0.0 });
  const substrate = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), subMat);
  substrate.rotation.x = -Math.PI / 2;
  substrate.position.y = -0.001;
  substrate.receiveShadow = true;
  scene.add(substrate);

  // Lights: warm key (torch) from front-above with shadow, cool fill, cool back rim.
  const key = new THREE.DirectionalLight(0xfff0dc, 3.6);
  key.position.set(2.2, 4.0, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0005;
  const sc = key.shadow.camera;
  sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3;
  scene.add(key);

  const fill = new THREE.HemisphereLight(0x9fc4e8, 0x0a0f16, 0.8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x88b0e0, 1.1);
  rim.position.set(-2.5, 1.2, -3.0);
  scene.add(rim);

  // A cheap environment map (gradient) so the wet clearcoat has something to reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  const domeGeo = new THREE.SphereGeometry(10, 24, 16);
  const domeMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
  domeMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       float hh = normalize(vViewPosition).y;`
    );
  };
  const envDome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ color: 0x2a3a4e, side: THREE.BackSide }));
  envScene.add(envDome);
  envScene.add(new THREE.HemisphereLight(0xbfd8ee, 0x141a22, 1.2));
  scene.environment = pmrem.fromScene(envScene).texture;
  scene.environmentIntensity = 0.85;

  return {
    substrate,
    setScale(s) {
      scene.fog.density = 0.25 / (s + 0.4);
      key.position.set(s * 2.2, s * 4.0, s * 2.8);
      const c = key.shadow.camera;
      c.left = -s * 1.6; c.right = s * 1.6; c.top = s * 1.6; c.bottom = -s * 1.6;
      c.far = s * 20 + 5; c.updateProjectionMatrix();
      substrate.position.y = -0.001;
    },
    update() {},
  };
}
