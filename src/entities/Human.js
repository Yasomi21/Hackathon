import * as THREE from "three";
import { BodyHeatEntity } from "./BodyHeatEntity.js";

export class Human extends BodyHeatEntity {
  constructor(options = {}) {
    super({
      name: options.name ?? "Person",
      species: "human",
      temperatureC: options.temperatureC ?? 36.8 + Math.random() * 0.8,
      radius: options.radius ?? 1.4,
      height: options.height ?? 5.8,
      color: options.color ?? 0xffe16a,
      ...options,
    });
  }

  createMesh() {
    const group = new THREE.Group();
    const material = this.createHeatMaterial(this.color);
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(this.radius * 0.62, this.height * 0.46, 5, 10),
      material,
    );
    torso.position.z = this.height * 0.47;
    torso.castShadow = true;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 0.52, 12, 8),
      material,
    );
    head.position.z = this.height * 0.86;
    head.castShadow = true;

    const heatHalo = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 1.4, 12, 8),
      new THREE.MeshBasicMaterial({
        color: 0xfff1a1,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    heatHalo.position.z = this.height * 0.58;

    group.add(torso, head, heatHalo);
    return group;
  }
}
