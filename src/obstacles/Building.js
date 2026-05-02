import * as THREE from "three";
import { Obstacle } from "./Obstacle.js";

export class Building extends Obstacle {
  constructor(options = {}) {
    const width = options.width ?? 30;
    const depth = options.depth ?? 30;

    super({
      radius: Math.max(width, depth) / 2,
      height: options.height ?? 35,
      color: options.color ?? 0xc8c0a8,
      ...options,
    });

    this.width = width;
    this.depth = depth;
  }

  createMesh() {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(this.width, this.depth, this.height),
      new THREE.MeshStandardMaterial({
        color: this.color,
        roughness: 0.72,
        metalness: 0.04,
      }),
    );
    body.position.z = this.height / 2;
    body.castShadow = true;
    body.receiveShadow = true;

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({
        color: 0x3f4238,
        transparent: true,
        opacity: 0.46,
      }),
    );
    edges.position.copy(body.position);

    group.add(body, edges);
    return group;
  }

  getBlockingHeightAt(x, y, groundHeight) {
    const insideX = Math.abs(x - this.enuPosition.x) <= this.width / 2;
    const insideY = Math.abs(y - this.enuPosition.y) <= this.depth / 2;
    return insideX && insideY ? groundHeight + this.height : groundHeight;
  }
}
