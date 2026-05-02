import * as THREE from "three";
import { Obstacle } from "./Obstacle.js";

export class Hill extends Obstacle {
  constructor(options = {}) {
    super({
      radius: options.radius ?? 60,
      height: options.height ?? 22,
      color: options.color ?? 0x7f9f62,
      ...options,
    });
    this.affectsTerrain = true;
    this.blocksFlight = false;
  }

  createMesh() {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 14),
      new THREE.MeshStandardMaterial({
        color: this.color,
        roughness: 0.95,
        transparent: true,
        opacity: 0.22,
      }),
    );
    cap.scale.set(this.radius, this.radius, this.height);
    cap.position.z = -this.height * 0.2;
    cap.castShadow = false;
    cap.receiveShadow = true;
    return cap;
  }

  getTerrainHeightContributionAt(x, y) {
    const dx = x - this.enuPosition.x;
    const dy = y - this.enuPosition.y;
    const sigma = this.radius * 0.58;
    return this.height * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
  }
}
