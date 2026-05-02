import * as THREE from "three";
import { Obstacle } from "./Obstacle.js";

export class Tree extends Obstacle {
  constructor(options = {}) {
    super({
      radius: options.radius ?? 7,
      height: options.height ?? 24,
      color: options.color ?? 0x4f8f4d,
      ...options,
    });
    this.trunkHeight = options.trunkHeight ?? this.height * 0.42;
  }

  createMesh() {
    const group = new THREE.Group();

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(this.radius * 0.18, this.radius * 0.28, this.trunkHeight, 10),
      new THREE.MeshStandardMaterial({
        color: 0x26362d,
        roughness: 0.82,
        metalness: 0.14,
      }),
    );
    trunk.rotation.x = Math.PI / 2;
    trunk.position.z = this.trunkHeight / 2;
    trunk.castShadow = true;

    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(this.radius, this.height - this.trunkHeight * 0.35, 12),
      new THREE.MeshStandardMaterial({
        color: this.color,
        emissive: 0x14351f,
        emissiveIntensity: 0.28,
        roughness: 0.76,
        metalness: 0.08,
      }),
    );
    canopy.rotation.x = Math.PI / 2;
    canopy.position.z = this.trunkHeight + (this.height - this.trunkHeight) / 2;
    canopy.castShadow = true;

    const canopyEdges = new THREE.LineSegments(
      new THREE.WireframeGeometry(canopy.geometry),
      new THREE.LineBasicMaterial({
        color: 0x5fff91,
        transparent: true,
        opacity: 0.2,
      }),
    );
    canopyEdges.rotation.copy(canopy.rotation);
    canopyEdges.position.copy(canopy.position);

    group.add(trunk, canopy, canopyEdges);
    return group;
  }

  getBlockingHeightAt(x, y, groundHeight) {
    const distance = Math.hypot(x - this.enuPosition.x, y - this.enuPosition.y);
    return distance <= this.radius ? groundHeight + this.height : groundHeight;
  }
}
