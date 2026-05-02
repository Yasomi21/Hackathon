import * as THREE from "three";
import { FlightController } from "./FlightController.js";
import { GPS } from "../sensors/GPS.js";
import { IMU } from "../sensors/IMU.js";
import { enuVector } from "../utils/ENU.js";

export class Drone extends THREE.Group {
  constructor({
    id = "Drone",
    position = { x: 0, y: 0, z: 0 },
    radius = 5,
    color = 0x58d7ff,
    flightControllerOptions = {},
  } = {}) {
    super();
    this.name = id;
    this.droneId = id;
    this.radius = radius;
    this.velocity = new THREE.Vector3();
    this.acceleration = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.orientation = { roll: 0, pitch: 0, yaw: 0 };
    this.distanceTraveled = 0;
    this.maxPathPoints = 1200;

    this.position.copy(enuVector(position));
    this.mesh = this.createDefaultMesh(color);
    this.add(this.mesh);

    this.gps = new GPS(this);
    this.imu = new IMU(this);
    this.flightController = new FlightController(this, flightControllerOptions);

    this.pathPoints = [this.position.clone()];
    this.pathLine = this.createPathLine(color);
  }

  createDefaultMesh(color) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, 24, 16),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        roughness: 0.45,
        metalness: 0.1,
      }),
    );
    mesh.name = `${this.droneId} Sphere Body`;
    mesh.castShadow = true;
    return mesh;
  }

  createPathLine(color) {
    const geometry = new THREE.BufferGeometry().setFromPoints(this.pathPoints);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.88,
    });
    const line = new THREE.Line(geometry, material);
    line.name = `${this.droneId} 3D Path`;
    return line;
  }

  setTarget(target) {
    this.flightController.setTarget(target);
  }

  update(dt, worldMap) {
    this.flightController.update(dt, worldMap);
  }

  recordPathPoint() {
    const lastPoint = this.pathPoints[this.pathPoints.length - 1];

    if (lastPoint && lastPoint.distanceTo(this.position) < 1.2) {
      return;
    }

    this.pathPoints.push(this.position.clone());

    if (this.pathPoints.length > this.maxPathPoints) {
      this.pathPoints.shift();
    }

    this.pathLine.geometry.dispose();
    this.pathLine.geometry = new THREE.BufferGeometry().setFromPoints(this.pathPoints);
  }
}
