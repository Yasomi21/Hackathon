import * as THREE from "three";

export class WindField {
  constructor({
    directionRadians = 0,
    speed = 0,
    verticalDraft = 0,
    turbulence = 0,
  } = {}) {
    this.directionRadians = directionRadians;
    this.speed = speed;
    this.verticalDraft = verticalDraft;
    this.turbulence = turbulence;
    this.time = 0;
  }

  static random({
    minSpeed = 0,
    maxSpeed = 13,
    maxVerticalDraft = 1.4,
    maxTurbulence = 2.8,
  } = {}) {
    return new WindField({
      directionRadians: Math.random() * Math.PI * 2,
      speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
      verticalDraft: (Math.random() * 2 - 1) * maxVerticalDraft,
      turbulence: 0.6 + Math.random() * maxTurbulence,
    });
  }

  update(dt) {
    this.time += dt;
  }

  getVelocityAt(position = { x: 0, y: 0, z: 0 }) {
    const base = new THREE.Vector3(
      Math.cos(this.directionRadians) * this.speed,
      Math.sin(this.directionRadians) * this.speed,
      this.verticalDraft,
    );
    const gust = Math.sin(
      this.time * 1.2 + (position.x ?? 0) * 0.018 + (position.y ?? 0) * 0.013,
    );
    const crossGust = Math.cos(
      this.time * 0.8 + (position.x ?? 0) * 0.011 - (position.y ?? 0) * 0.017,
    );

    base.x += gust * this.turbulence;
    base.y += crossGust * this.turbulence * 0.72;
    base.z += Math.sin(this.time * 1.6 + (position.z ?? 0) * 0.03) * this.turbulence * 0.16;
    return base;
  }

  getDirectionDegrees() {
    const degrees = THREE.MathUtils.radToDeg(this.directionRadians);
    return (degrees + 360) % 360;
  }
}
