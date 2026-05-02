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
      new THREE.MeshStandardMaterial({ color: 0x6f5536, roughness: 0.86 }),
    );
    trunk.rotation.x = Math.PI / 2;
    trunk.position.z = this.trunkHeight / 2;
    trunk.castShadow = true;

    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(this.radius, this.height - this.trunkHeight * 0.35, 12),
      new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.9 }),
    );
    canopy.rotation.x = Math.PI / 2;
    canopy.position.z = this.trunkHeight + (this.height - this.trunkHeight) / 2;
    canopy.castShadow = true;

    group.add(trunk, canopy);
    return group;
  }

  getBlockingHeightAt(x, y, groundHeight) {
    const distance = Math.hypot(x - this.enuPosition.x, y - this.enuPosition.y);
    return distance <= this.radius ? groundHeight + this.height : groundHeight;
  }
}
