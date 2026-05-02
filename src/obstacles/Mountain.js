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
    const group = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(this.radius, this.height, 36, 1),
      new THREE.MeshStandardMaterial({
        color: this.color,
        emissive: 0x101811,
        emissiveIntensity: 0.18,
        roughness: 0.82,
        metalness: 0.12,
        transparent: true,
        opacity: 0.24,
      }),
    );
    cone.rotation.x = Math.PI / 2;
    cone.position.z = this.height / 2;
    cone.castShadow = true;
    cone.receiveShadow = true;

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(cone.geometry),
      new THREE.LineBasicMaterial({
        color: 0xb3ff68,
        transparent: true,
        opacity: 0.2,
      }),
    );
    wire.rotation.copy(cone.rotation);
    wire.position.copy(cone.position);

    group.add(cone, wire);
    return group;
  }

  getTerrainHeightContributionAt(x, y) {
    const distance = Math.hypot(x - this.enuPosition.x, y - this.enuPosition.y);
    const normalized = Math.max(0, 1 - distance / this.radius);
    return this.height * Math.pow(normalized, 1.6);
  }
}
