import * as THREE from "three";
import { DroneRadio } from "../comms/DroneRadio.js";
import { FlightController } from "./FlightController.js";
import { GPS } from "../sensors/GPS.js";
import { IMU } from "../sensors/IMU.js";
import { ThermalSensor } from "../sensors/ThermalSensor.js";
import { enuVector } from "../utils/ENU.js";

export class Drone extends THREE.Group {
  constructor({
    id = "Drone",
    name = id,
    position = { x: 0, y: 0, z: 0 },
    radius = 5,
    color = 0x58d7ff,
    flightControllerOptions = {},
    radioOptions = {},
    thermalSensorOptions = {},
  } = {}) {
    super();
    this.droneId = id;
    this.displayName = name;
    this.name = name;
    this.radius = radius;
    this.baseColor = color;
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
    this.radio = new DroneRadio(this, radioOptions);
    this.thermalSensor = new ThermalSensor(this, thermalSensorOptions);
    this.thermalReading = this.thermalSensor.read();
    this.flightController = new FlightController(this, flightControllerOptions);

    this.pathPoints = [this.position.clone()];
    this.pathLine = this.createPathLine(color);
    this.setDisplayMode("tactical");
  }

  createDefaultMesh(color) {
    const group = new THREE.Group();
    group.name = `${this.displayName} Tactical Body`;

    this.bodyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, 24, 16),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.52,
        roughness: 0.28,
        metalness: 0.38,
      }),
    );
    this.bodyMesh.name = `${this.displayName} Sphere Body`;
    this.bodyMesh.castShadow = true;

    this.wireShell = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(this.radius * 1.08, 16, 10)),
      new THREE.LineBasicMaterial({
        color: 0xd6fff0,
        transparent: true,
        opacity: 0.38,
      }),
    );
    this.wireShell.name = `${this.displayName} Wire Shell`;

    this.sensorHalo = new THREE.Mesh(
      new THREE.TorusGeometry(this.radius * 2.2, 0.12, 8, 64),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
      }),
    );
    this.sensorHalo.name = `${this.displayName} Sensor Halo`;
    this.trackingRing = new THREE.Mesh(
      new THREE.TorusGeometry(this.radius * 3.1, 0.08, 8, 72),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.42,
      }),
    );
    this.trackingRing.name = `${this.displayName} Tracking Ring`;
    this.trackingRing.position.z = this.radius * 1.8;

    this.labelLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, this.radius * 1.7),
        new THREE.Vector3(0, 0, this.radius * 4.15),
      ]),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.72,
      }),
    );
    this.labelLine.name = `${this.displayName} Label Stem`;
    this.labelSprite = this.createLabelSprite(this.displayName, "#baffd0");
    this.labelSprite.position.z = this.radius * 4.75;

    group.add(
      this.bodyMesh,
      this.wireShell,
      this.sensorHalo,
      this.trackingRing,
      this.labelLine,
      this.labelSprite,
    );
    return group;
  }

  createLabelSprite(label, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(0, 8, 5, 0.72)";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 4;
    context.fillRect(76, 32, 360, 64);
    context.strokeRect(76, 32, 360, 64);
    context.font = "800 34px Consolas, monospace";
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color: new THREE.Color(color),
        transparent: true,
        depthTest: false,
      }),
    );
    sprite.name = `${label} Label`;
    sprite.scale.set(34, 8.5, 1);
    return sprite;
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

  update(dt, worldMap, peers = []) {
    this.radio.update(dt, peers);
    this.flightController.update(dt, worldMap);
    this.thermalReading = this.thermalSensor.read(worldMap);

    if (this.sensorHalo) {
      this.sensorHalo.rotation.z += dt * 1.8;
    }

    if (this.trackingRing) {
      this.trackingRing.rotation.z -= dt * 1.1;
    }
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

  setDisplayMode(mode) {
    const modes = {
      tactical: {
        color: this.baseColor,
        shell: 0xd6fff0,
        haloOpacity: 0.5,
        shellOpacity: 0.38,
        labelOpacity: 1,
      },
      nightVision: {
        color: 0xb7ff67,
        shell: 0xf1ffb8,
        haloOpacity: 0.96,
        shellOpacity: 0.86,
        labelOpacity: 1,
      },
      infrared: {
        color: 0xffb13d,
        shell: 0xfff0a4,
        haloOpacity: 0.92,
        shellOpacity: 0.8,
        labelOpacity: 1,
      },
    };
    const theme = modes[mode] ?? modes.tactical;

    this.bodyMesh.material.color.setHex(theme.color);
    this.bodyMesh.material.emissive.setHex(theme.color);
    this.bodyMesh.material.emissiveIntensity = mode === "tactical" ? 0.52 : 1.05;
    this.wireShell.material.color.setHex(theme.shell);
    this.wireShell.material.opacity = theme.shellOpacity;
    this.sensorHalo.material.color.setHex(theme.color);
    this.sensorHalo.material.opacity = theme.haloOpacity;
    this.trackingRing.material.color.setHex(theme.color);
    this.trackingRing.material.opacity = theme.haloOpacity * 0.74;
    this.labelLine.material.color.setHex(theme.color);
    this.labelLine.material.opacity = theme.haloOpacity;
    this.labelSprite.material.color.setHex(theme.color);
    this.labelSprite.material.opacity = theme.labelOpacity;
    this.pathLine.material.color.setHex(theme.color);
    this.pathLine.material.opacity = mode === "tactical" ? 0.88 : 1;
  }
}
