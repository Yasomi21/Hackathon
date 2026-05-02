import * as THREE from "three";
import { Simulation } from "./src/core/Simulation.js";
import { WorldMap } from "./src/core/WorldMap.js";
import { Drone } from "./src/drones/Drone.js";
import { DroneSwarm } from "./src/drones/DroneSwarm.js";
import { Building } from "./src/obstacles/Building.js";
import { Hill } from "./src/obstacles/Hill.js";
import { Mountain } from "./src/obstacles/Mountain.js";
import { Tree } from "./src/obstacles/Tree.js";
import { formatENU } from "./src/utils/ENU.js";

const startPoint = { x: 0, y: 0, z: 50 };
const endPoint = { x: 300, y: 250, z: 50 };

const appElement = document.querySelector("#app");
const simulation = new Simulation({
  container: appElement,
  cameraPosition: { x: 430, y: -520, z: 310 },
  controlsTarget: { x: 145, y: 110, z: 35 },
});

const worldMap = new WorldMap({
  width: 720,
  depth: 640,
  segments: 150,
});

// Terrain-affecting obstacles are added first so the mesh and flight envelope
// include their elevation before buildings, trees, and drones are placed.
worldMap.addObstacle(
  new Hill({
    name: "South Ridge",
    position: { x: 80, y: 70 },
    radius: 95,
    height: 24,
    color: 0x829c60,
  }),
);
worldMap.addObstacle(
  new Mountain({
    name: "Central Mountain",
    position: { x: 165, y: 138 },
    radius: 86,
    height: 66,
    color: 0x8d8165,
  }),
);
worldMap.addObstacle(
  new Hill({
    name: "Northwest Hill",
    position: { x: -140, y: 160 },
    radius: 105,
    height: 20,
    color: 0x7f9f71,
  }),
);

worldMap.addObstacle(
  new Building({
    name: "Survey Tower",
    position: { x: 225, y: 35 },
    width: 28,
    depth: 28,
    height: 58,
    color: 0xd2c6a6,
  }),
);
worldMap.addObstacle(
  new Building({
    name: "Field Lab",
    position: { x: -85, y: -90 },
    width: 46,
    depth: 32,
    height: 24,
    color: 0xb7c0b0,
  }),
);

[
  { x: 45, y: -55 },
  { x: 98, y: -25 },
  { x: -165, y: 28 },
  { x: 245, y: 182 },
  { x: 284, y: 208 },
  { x: -45, y: 145 },
].forEach((position, index) => {
  worldMap.addObstacle(
    new Tree({
      name: `Tree ${index + 1}`,
      position,
      radius: 7 + (index % 2),
      height: 22 + index * 1.4,
    }),
  );
});

simulation.setWorldMap(worldMap);
simulation.scene.add(createPointMarker(startPoint, worldMap, 0x8bd3ff));
simulation.scene.add(createPointMarker(endPoint, worldMap, 0xffc45c));

const flightParameters = {
  maxSpeed: 38,
  acceleration: 22,
  cruiseAltitude: 46,
  minTerrainClearance: 10,
  windStrength: 3.2,
  arrivalThreshold: 5,
  slowRadius: 82,
  lookAheadDistance: 95,
};

const safeStartPoint = {
  ...startPoint,
  z: Math.max(
    startPoint.z,
    worldMap.getHeightAt(startPoint.x, startPoint.y) +
      flightParameters.minTerrainClearance,
  ),
};

const drone = new Drone({
  id: "Drone-01",
  position: safeStartPoint,
  radius: 5.8,
  color: 0x54d8ff,
  flightControllerOptions: flightParameters,
});
drone.setTarget(endPoint);

const swarm = new DroneSwarm();
swarm.addDrone(drone);
simulation.setDroneSwarm(swarm);

const hud = {
  statusBadge: document.querySelector("#statusBadge"),
  position: document.querySelector("#positionValue"),
  velocity: document.querySelector("#velocityValue"),
  target: document.querySelector("#targetValue"),
  gps: document.querySelector("#gpsValue"),
  imu: document.querySelector("#imuValue"),
  distance: document.querySelector("#distanceValue"),
  reached: document.querySelector("#reachedValue"),
};

simulation.setUpdateHook(() => updateHud(drone, hud));
simulation.start();

window.droneSwarmDemo = {
  simulation,
  worldMap,
  swarm,
  drone,
  startPoint,
  endPoint,
};

function createPointMarker(point, worldMap, color) {
  const groundZ = worldMap.getTerrainHeightAt(point.x, point.y);
  const markerTopZ = Math.max(point.z, groundZ + 4);
  const group = new THREE.Group();
  group.position.set(point.x, point.y, groundZ);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(10, 0.7, 10, 32),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.position.z = 0.35;

  const poleGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0.5),
    new THREE.Vector3(0, 0, markerTopZ - groundZ),
  ]);
  const pole = new THREE.Line(
    poleGeometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
  );

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 16, 10),
    new THREE.MeshBasicMaterial({ color }),
  );
  orb.position.z = markerTopZ - groundZ;

  group.add(ring, pole, orb);
  return group;
}

function updateHud(droneToDisplay, hudElements) {
  const gpsReading = droneToDisplay.gps.read();
  const imuReading = droneToDisplay.imu.read();
  const target = droneToDisplay.flightController.target;
  const reached = droneToDisplay.flightController.reachedTarget;

  hudElements.position.textContent = formatENU(droneToDisplay.position);
  hudElements.velocity.textContent = formatENU(droneToDisplay.velocity);
  hudElements.target.textContent = target ? formatENU(target) : "none";
  hudElements.gps.textContent = formatENU(gpsReading);
  hudElements.imu.textContent = [
    `accelerometer ${formatENU(imuReading.accelerometer)}`,
    `gyroscope ${formatENU(imuReading.gyroscope, 3)}`,
    `magnetometer ${formatENU(imuReading.magnetometer, 2)}`,
  ].join("\n");
  hudElements.distance.textContent = `${droneToDisplay.distanceTraveled.toFixed(
    1,
  )} m`;
  hudElements.reached.textContent = reached ? "Yes" : "No";
  hudElements.statusBadge.textContent = reached ? "Reached" : "Flying";
  hudElements.statusBadge.classList.toggle("reached", reached);
}
