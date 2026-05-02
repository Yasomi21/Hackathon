import * as THREE from "three";
import { BodyHeatEntity } from "./BodyHeatEntity.js";

export class Animal extends BodyHeatEntity {
  constructor(options = {}) {
    super({
      name: options.name ?? "Animal",
      species: "animal",
      temperatureC: options.temperatureC ?? 38 + Math.random() * 1.2,
      radius: options.radius ?? 2.1,
      height: options.height ?? 3,
      color: options.color ?? 0xff7a35,
      ...options,
    });
    this.length = options.length ?? this.radius * 2.9;
  }

  createMesh() {
    const group = new THREE.Group();
    const material = this.createHeatMaterial(this.color);
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(this.radius * 0.54, this.length, 5, 12),
      material,
    );
    body.rotation.z = Math.PI / 2;
    body.position.z = this.height * 0.45;
    body.castShadow = true;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 0.42, 10, 8),
      material,
    );
    head.position.set(this.length * 0.52, 0, this.height * 0.58);
    head.castShadow = true;

    const heatHalo = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 1.25, 12, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffd06a,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    heatHalo.scale.set(1.9, 0.9, 0.7);
    heatHalo.position.z = this.height * 0.44;

    group.add(body, head, heatHalo);
    return group;
  }
}
