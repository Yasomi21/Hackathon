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
        emissive: 0x08120e,
        emissiveIntensity: 0.22,
        roughness: 0.48,
        metalness: 0.42,
      }),
    );
    body.position.z = this.height / 2;
    body.castShadow = true;
    body.receiveShadow = true;

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({
        color: 0x86ffc0,
        transparent: true,
        opacity: 0.44,
      }),
    );
    edges.position.copy(body.position);

    const antenna = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, this.height),
        new THREE.Vector3(0, 0, this.height + 16),
      ]),
      new THREE.LineBasicMaterial({
        color: 0xffc45c,
        transparent: true,
        opacity: 0.74,
      }),
    );

    group.add(body, edges, antenna);
    return group;
  }

  getBlockingHeightAt(x, y, groundHeight) {
    const insideX = Math.abs(x - this.enuPosition.x) <= this.width / 2;
    const insideY = Math.abs(y - this.enuPosition.y) <= this.depth / 2;
    return insideX && insideY ? groundHeight + this.height : groundHeight;
  }
}
