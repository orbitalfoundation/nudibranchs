import * as THREE from 'three';
import { bodyProfiles, buildBodyMesh, surfacePoint } from './body.js';
import { buildAppendage } from './appendage.js';
import { buildDorsalField } from './dorsalField.js';
import { makeBodyMaterial, makeAppendageMaterial } from '../shading/NudiMaterial.js';
import { rng } from '../core/math.js';

const Y = new THREE.Vector3(0, 1, 0);

// Assembles a nudibranch from the parameter tree: swept-mesh body + the superset
// dorsal-appendage field (rosette / cerata / branches / bumps) + rhinophores.
// Pattern and motion layer on next.
export class NudibranchRig extends THREE.Group {
  constructor(p) {
    super();
    this.p = p;
    this.t = 0;
    this.profiles = bodyProfiles(p);

    const geo = buildBodyMesh(p);
    this.bodyMat = makeBodyMaterial(p.surface);
    this.bodyMesh = new THREE.Mesh(geo, this.bodyMat);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.add(this.bodyMesh);

    // The superset dorsal field — each family is skipped when its amount≈0.
    this.appMat = makeAppendageMaterial();
    let sk = 0;
    for (const key of ['bumps', 'branches', 'cerata', 'rosette']) {
      const fgeo = buildDorsalField(p.dorsal[key], this.profiles, ++sk);
      if (fgeo) {
        const mesh = new THREE.Mesh(fgeo, this.appMat);
        mesh.castShadow = true;
        this.add(mesh);
      }
    }
    this._buildRhinophores();

    // Extent for camera framing.
    geo.computeBoundingBox();
    this.bbox = geo.boundingBox.clone();
    this.span = Math.max(
      this.bbox.max.x - this.bbox.min.x,
      this.bbox.max.y - this.bbox.min.y,
      this.bbox.max.z - this.bbox.min.z
    );
    this.centre = this.bbox.getCenter(new THREE.Vector3());
  }

  _buildRhinophores() {
    const a = this.p.antennae;
    const geo = buildAppendage(a.spec, rng(101));
    const nrm = new THREE.Vector3(), q = new THREE.Quaternion(), tilt = new THREE.Quaternion();
    const posV = new THREE.Vector3(), scaleV = new THREE.Vector3(), m = new THREE.Matrix4();
    const sp = {};
    for (const side of [-1, 1]) {
      surfacePoint(this.profiles, 0.82, 0.5 + side * 0.12, sp);
      nrm.set(sp.nrm[0], sp.nrm[1], sp.nrm[2]);
      q.setFromUnitVectors(Y, nrm);
      tilt.setFromEuler(new THREE.Euler(-0.15, 0, side * a.splay)); // slight forward + splay
      q.multiply(tilt);
      posV.set(sp.pos[0], sp.pos[1], sp.pos[2]);
      scaleV.setScalar(1);
      m.compose(posV, q, scaleV);
      const mesh = new THREE.Mesh(geo.clone().applyMatrix4(m), this.appMat);
      mesh.castShadow = true;
      this.add(mesh);
    }
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    // Cerata / gill sway (vertex shader).
    if (this.appMat.userData.anim) {
      this.appMat.userData.anim.uTime.value = t;
      this.appMat.userData.anim.uSway.value = this.p.motion.swayAmp || 0.05;
    }
    // Gentle crawl: the whole animal creeps with a slow forward bob and a subtle
    // side-to-side body flex, plus (for swimmers) a bigger mantle-margin undulation.
    const swim = this.p.motion.mantleUndulate || 0;
    this.rotation.z = Math.sin(t * 0.5) * (0.02 + swim * 0.12);
    this.rotation.y = Math.sin(t * 0.3) * 0.05;
    this.position.y = Math.abs(Math.sin(t * 1.2)) * this.span * 0.006 * (this.p.motion.pedalWave || 0.4);
  }

  dispose() {
    this.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) Array.isArray(o.material) ? o.material.forEach((m) => m.dispose()) : o.material.dispose();
    });
  }
}
