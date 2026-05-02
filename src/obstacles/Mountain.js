import * as THREE from "three";
import { Obstacle } from "./Obstacle.js";

export class Mountain extends Obstacle {
  constructor(options = {}) {
    super({
      radius: options.radius ?? 70,
      height: options.height ?? 62,
      color: options.color ?? 0x8a7e66,
      ...options,
    });
    this.affectsTerrain = true;
    this.blocksFlight = false;
  }

  createMesh() {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(this.radius, this.height, 36, 1),
      new THREE.MeshStandardMaterial({
        color: this.color,
        roughness: 0.98,
        transparent: true,
        opacity: 0.26,
      }),
    );
    cone.rotation.x = Math.PI / 2;
    cone.position.z = this.height / 2;
    cone.castShadow = true;
    cone.receiveShadow = true;
    return cone;
  }

  getTerrainHeightContributionAt(x, y) {
    const distance = Math.hypot(x - this.enuPosition.x, y - this.enuPosition.y);
    const normalized = Math.max(0, 1 - distance / this.radius);
    return this.height * Math.pow(normalized, 1.6);
  }
}
