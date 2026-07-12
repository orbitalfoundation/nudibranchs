import * as THREE from 'three';

// A lit reef in atmospheric water. Keeps the "wet jewel under a dive light" thesis
// (the animal is opaque, lit, grounded on a substrate) but wraps it in the richer
// backdrop from the siphonophore project: a tinted downwelling gradient instead of
// a flat card, and a drifting, twinkling marine-snow field (added separately).
export function buildEnvironment(scene, renderer) {
  const top = new THREE.Color(0x143a52);   // faint downwelling light
  const bottom = new THREE.Color(0x05080f); // the deep

  // Gradient sky-dome (follows the camera; sized inside the frustum in update()).
  const domeGeo = new THREE.SphereGeometry(1, 48, 32);
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: top }, uBottom: { value: bottom }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uTop, uBottom;
      uniform float uTime;
      void main(){
        vec3 nd = normalize(vDir);
        float h = nd.y;
        float a = atan(nd.z, nd.x);
        vec3 col = mix(uBottom, uTop, smoothstep(-0.5, 0.95, h));
        float cells = 0.5 + 0.5 * sin(a * 2.0 + h * 3.0 + uTime * 0.05)
                          * cos(a * 3.0 - h * 2.0 - uTime * 0.03);
        col += vec3(0.012, 0.030, 0.045) * cells;             // slow teal/indigo drift
        col += uTop * 0.5 * smoothstep(0.25, 1.0, h);         // soft downwelling glow
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  scene.add(dome);

  scene.fog = new THREE.FogExp2(bottom.getHex(), 0.1); // fades the substrate into the water

  // Substrate the animal crawls on: a dark reef plane that fades into the fog.
  const subMat = new THREE.MeshStandardMaterial({ color: 0x0e1620, roughness: 0.92, metalness: 0.0 });
  const substrate = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), subMat);
  substrate.rotation.x = -Math.PI / 2;
  substrate.position.y = -0.001;
  substrate.receiveShadow = true;
  scene.add(substrate);

  // Dive-light rig: warm key (torch) with shadow, cool fill, cool back rim.
  const key = new THREE.DirectionalLight(0xfff0dc, 3.4);
  key.position.set(2.2, 4.0, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0005;
  const sc = key.shadow.camera;
  sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3;
  scene.add(key);

  const fill = new THREE.HemisphereLight(0x8fc0e8, 0x0a1018, 0.7);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x7fb0e0, 1.1);
  rim.position.set(-2.5, 1.2, -3.0);
  scene.add(rim);

  // Env map from the gradient (so the wet clearcoat has something to reflect).
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(domeGeo, domeMat.clone());
  envDome.scale.setScalar(10);
  envScene.add(envDome);
  envScene.add(new THREE.HemisphereLight(0x3a6f92, 0x0a1018, 1.2));
  scene.environment = pmrem.fromScene(envScene).texture;
  scene.environmentIntensity = 0.85;

  return {
    substrate,
    setScale(s) {
      scene.fog.density = 0.22 / (s + 0.4);
      key.position.set(s * 2.2, s * 4.0, s * 2.8);
      const c = key.shadow.camera;
      c.left = -s * 1.6; c.right = s * 1.6; c.top = s * 1.6; c.bottom = -s * 1.6;
      c.far = s * 20 + 5; c.updateProjectionMatrix();
    },
    update(t, camera) {
      domeMat.uniforms.uTime.value = t;
      if (camera) {
        dome.position.copy(camera.position);
        dome.scale.setScalar((camera.far - camera.near) * 0.45);
      }
    },
  };
}

// Marine snow — drifting, twinkling particulate in the water column above the reef.
// Custom point shader (per-particle size + twinkle, soft round sprite) so it reads
// as suspended matter catching the light rather than flat dots.
export function buildMarineSnow(scene, count = 1200) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const spd = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random() * 2 - 1;
    pos[i * 3 + 1] = Math.random();          // mostly above the substrate
    pos[i * 3 + 2] = Math.random() * 2 - 1;
    const big = Math.random() < 0.08;
    size[i] = big ? 1.6 + Math.random() * 2.2 : 0.35 + Math.random() * 0.9;
    phase[i] = Math.random();
    spd[i] = 0.2 + Math.random() * 0.8;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPxScale: { value: 30 }, uColor: { value: new THREE.Color(0x7fa8c8) } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aPhase;
      uniform float uTime, uPxScale; varying float vTw;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vTw = 0.5 + 0.5 * sin(uTime * 1.3 + aPhase * 6.2831);
        gl_PointSize = clamp(aSize * uPxScale / max(0.05, -mv.z), 0.0, 14.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float; uniform vec3 uColor; varying float vTw;
      void main(){
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, r);
        gl_FragColor = vec4(uColor * vTw, a * vTw * 0.45);
      }`,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  return {
    points,
    setScale(s) { points.scale.set(s * 2.6, s * 2.0, s * 2.6); mat.uniforms.uPxScale.value = s * 16 + 6; },
    update(dt) {
      mat.uniforms.uTime.value += dt;
      const p = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        p[i * 3 + 1] -= spd[i] * dt * 0.02;
        p[i * 3] += Math.sin((p[i * 3 + 1] + i) * 1.5) * dt * 0.006;
        if (p[i * 3 + 1] < 0.02) { p[i * 3 + 1] = 1; p[i * 3] = Math.random() * 2 - 1; }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
