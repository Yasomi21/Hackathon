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
    const group = new THREE.Group();
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 14),
      new THREE.MeshStandardMaterial({
        color: this.color,
        emissive: 0x0f2217,
        emissiveIntensity: 0.18,
        roughness: 0.88,
        metalness: 0.08,
        transparent: true,
        opacity: 0.18,
      }),
    );
    cap.scale.set(this.radius, this.radius, this.height);
    cap.position.z = -this.height * 0.2;
    cap.castShadow = false;
    cap.receiveShadow = true;

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(cap.geometry),
      new THREE.LineBasicMaterial({
        color: 0xb3ff68,
        transparent: true,
        opacity: 0.18,
      }),
    );
    wire.scale.copy(cap.scale);
    wire.position.copy(cap.position);

    group.add(cap, wire);
    return group;
  }

  getTerrainHeightContributionAt(x, y) {
    const dx = x - this.enuPosition.x;
    const dy = y - this.enuPosition.y;
    const sigma = this.radius * 0.58;
    return this.height * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
  }
}
