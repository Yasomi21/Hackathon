import * as THREE from "three";
import { Simulation } from "./src/core/Simulation.js";
import { WindField } from "./src/core/WindField.js";
import { WorldMap } from "./src/core/WorldMap.js";
import { Drone } from "./src/drones/Drone.js";
import { DroneSwarm } from "./src/drones/DroneSwarm.js";
import { Animal } from "./src/entities/Animal.js";
import { Human } from "./src/entities/Human.js";
import { Building } from "./src/obstacles/Building.js";
import { Hill } from "./src/obstacles/Hill.js";
import { Mountain } from "./src/obstacles/Mountain.js";
import { Tree } from "./src/obstacles/Tree.js";
import { formatENU } from "./src/utils/ENU.js";

const DRONE_CONFIGS = [
  { name: "Drone A", color: 0x52ffb1 },
  { name: "Drone B", color: 0x79ffd7 },
  { name: "Drone C", color: 0xa6ff75 },
  { name: "Drone D", color: 0xffd56a },
  { name: "Drone E", color: 0xff8f62 },
];
const DISPLAY_MODES = {
  tactical: "tactical",
  nightVision: "nightVision",
  infrared: "infrared",
};

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
simulation.setWorldMap(worldMap);

const markerLayer = new THREE.Group();
markerLayer.name = "Scenario Markers";
simulation.scene.add(markerLayer);

const flightParameters = {
  maxSpeed: 36,
  acceleration: 24,
  cruiseAltitude: 46,
  minTerrainClearance: 10,
  windStrength: 1.4,
  arrivalThreshold: 24,
  slowRadius: 95,
  lookAheadDistance: 95,
  separationRadius: 64,
  collisionRadius: 16,
  avoidanceStrength: 38,
  emergencyAvoidanceStrength: 92,
  holdPositionThreshold: 7,
};

const swarm = new DroneSwarm({
  collisionPadding: 4.5,
  arrivalFormationRadius: 20,
  arrivalFormationEngageRadius: 115,
});
simulation.setDroneSwarm(swarm);

let drones = [];
let selectedDrone = null;
let selectedDroneIndex = 0;
let currentDisplayMode = DISPLAY_MODES.tactical;
let currentEndpoint = null;

const hud = {
  selectedDroneCode: document.querySelector("#selectedDroneCode"),
  selectedDroneName: document.querySelector("#selectedDroneName"),
  statusBadge: document.querySelector("#statusBadge"),
  position: document.querySelector("#positionValue"),
  velocity: document.querySelector("#velocityValue"),
  target: document.querySelector("#targetValue"),
  gps: document.querySelector("#gpsValue"),
  imu: document.querySelector("#imuValue"),
  distance: document.querySelector("#distanceValue"),
  nearest: document.querySelector("#nearestValue"),
  thermal: document.querySelector("#thermalValue"),
  wind: document.querySelector("#windValue"),
  reached: document.querySelector("#reachedValue"),
};
const modeButtons = document.querySelectorAll("[data-display-mode]");
const droneButtons = document.querySelectorAll("[data-drone-index]");
const resetButton = document.querySelector("#resetScenarioButton");

setupDisplayModeControls(simulation, modeButtons);
setupDroneSelector(droneButtons);
setupResetControl(resetButton);
resetScenario();

simulation.setUpdateHook(() => {
  if (selectedDrone) {
    updateHud(selectedDrone, hud, swarm);
  }
});
simulation.start();

window.droneSwarmDemo = {
  simulation,
  worldMap,
  swarm,
  get drone() {
    return drones[0];
  },
  get drones() {
    return drones;
  },
  get endpoint() {
    return currentEndpoint;
  },
  resetScenario,
};

function resetScenario() {
  markerLayer.clear();
  worldMap.clearHeatEntities();
  worldMap.clearObstacles();
  swarm.clearDrones();
  worldMap.setWindField(WindField.random({ minSpeed: 1.5, maxSpeed: 14 }));

  randomizeObstacles(worldMap);
  randomizeHeatEntities(worldMap);
  currentEndpoint = createRandomEndpoint(worldMap);
  markerLayer.add(createPointMarker(currentEndpoint, worldMap, 0xffc45c));

  drones = createRandomDrones(worldMap, currentEndpoint);
  selectedDroneIndex = Math.min(selectedDroneIndex, drones.length - 1);
  selectDrone(selectedDroneIndex);
  updateSceneDisplayTheme(currentDisplayMode);
  updateDebugGlobals();
}

function randomizeObstacles(map) {
  const hills = randomInt(2, 4);
  const mountains = randomInt(1, 3);
  const buildings = randomInt(3, 6);
  const trees = randomInt(12, 22);

  for (let index = 0; index < hills; index += 1) {
    map.addObstacle(
      new Hill({
        name: `Hill ${index + 1}`,
        position: randomMapPosition(map, 70),
        radius: randomFloat(62, 118),
        height: randomFloat(14, 32),
        color: 0x31523a,
      }),
    );
  }

  for (let index = 0; index < mountains; index += 1) {
    map.addObstacle(
      new Mountain({
        name: `Mountain ${index + 1}`,
        position: randomMapPosition(map, 90),
        radius: randomFloat(54, 92),
        height: randomFloat(42, 82),
        color: 0x5c604f,
      }),
    );
  }

  for (let index = 0; index < buildings; index += 1) {
    map.addObstacle(
      new Building({
        name: `Structure ${index + 1}`,
        position: randomMapPosition(map, 90),
        width: randomFloat(22, 52),
        depth: randomFloat(22, 46),
        height: randomFloat(20, 70),
        color: index % 2 === 0 ? 0x60706b : 0x4d6258,
      }),
    );
  }

  for (let index = 0; index < trees; index += 1) {
    map.addObstacle(
      new Tree({
        name: `Tree ${index + 1}`,
        position: randomMapPosition(map, 35),
        radius: randomFloat(5, 9),
        height: randomFloat(16, 34),
      }),
    );
  }
}

function randomizeHeatEntities(map) {
  const people = randomInt(4, 9);
  const animals = randomInt(5, 12);

  for (let index = 0; index < people; index += 1) {
    map.addHeatEntity(
      new Human({
        name: `Person ${index + 1}`,
        position: randomMapPosition(map, 50),
      }),
    );
  }

  for (let index = 0; index < animals; index += 1) {
    map.addHeatEntity(
      new Animal({
        name: `Animal ${index + 1}`,
        position: randomMapPosition(map, 50),
        radius: randomFloat(1.5, 2.7),
      }),
    );
  }
}

function createRandomDrones(map, endpoint) {
  return DRONE_CONFIGS.map((config, index) => {
    const launchPoint = createRandomDroneStart(map, endpoint);
    const drone = new Drone({
      id: `Drone-${String(index + 1).padStart(2, "0")}`,
      name: config.name,
      position: launchPoint,
      radius: 4.8,
      color: config.color,
      flightControllerOptions: flightParameters,
      thermalSensorOptions: { range: Math.hypot(map.width, map.depth) * 1.25 },
    });

    drone.setTarget(endpoint);
    swarm.addDrone(drone);
    markerLayer.add(createPointMarker(launchPoint, map, config.color, 9));
    return drone;
  });
}

function createRandomDroneStart(map, endpoint) {
  let point = randomMapPosition(map, 70);
  let attempts = 0;

  while (distance2D(point, endpoint) < 180 && attempts < 30) {
    point = randomMapPosition(map, 70);
    attempts += 1;
  }

  return {
    ...point,
    z: map.getHeightAt(point.x, point.y) + randomFloat(44, 82),
  };
}

function createRandomEndpoint(map) {
  const point = randomMapPosition(map, 85);

  return {
    ...point,
    z: map.getHeightAt(point.x, point.y) + randomFloat(42, 72),
  };
}

function createPointMarker(point, map, color, radius = 18) {
  const groundZ = map.getTerrainHeightAt(point.x, point.y);
  const markerTopZ = Math.max(point.z, groundZ + 4);
  const group = new THREE.Group();
  group.position.set(point.x, point.y, groundZ);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.66, 0.35, 8, 72),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88 }),
  );
  ring.position.z = 0.35;

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.18, 8, 96),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38 }),
  );
  outerRing.position.z = 0.5;

  const poleGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0.5),
    new THREE.Vector3(0, 0, markerTopZ - groundZ),
  ]);
  const pole = new THREE.Line(
    poleGeometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 }),
  );

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 16, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  orb.position.z = markerTopZ - groundZ;

  group.add(ring, outerRing, pole, orb);
  return group;
}

function updateHud(droneToDisplay, hudElements, swarmToDisplay) {
  const gpsReading = droneToDisplay.gps.read();
  const imuReading = droneToDisplay.imu.read();
  const thermalReading = droneToDisplay.thermalReading;
  const target = droneToDisplay.flightController.target;
  const reached = droneToDisplay.flightController.reachedTarget;
  const nearestDroneDistance = swarmToDisplay.getClosestDroneDistance(droneToDisplay);
  const wind = worldMap.windField;

  hudElements.selectedDroneCode.textContent = `COMMAND / ${droneToDisplay.name.toUpperCase()}`;
  hudElements.selectedDroneName.textContent = droneToDisplay.name;
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
  hudElements.nearest.textContent = Number.isFinite(nearestDroneDistance)
    ? `${nearestDroneDistance.toFixed(1)} m`
    : "none";
  hudElements.thermal.textContent = `people ${thermalReading.people} | animals ${thermalReading.animals}`;
  hudElements.wind.textContent = `${wind.speed.toFixed(1)} m/s @ ${wind
    .getDirectionDegrees()
    .toFixed(0)} deg`;
  hudElements.reached.textContent = reached ? "Yes" : "No";
  hudElements.statusBadge.textContent = reached ? "Reached" : "Flying";
  hudElements.statusBadge.classList.toggle("reached", reached);
}

function setupDroneSelector(buttons) {
  buttons.forEach((button) => {
    button.addEventListener("click", () => selectDrone(Number(button.dataset.droneIndex)));
  });
}

function selectDrone(index) {
  selectedDroneIndex = index;
  selectedDrone = drones[index] ?? drones[0] ?? null;

  droneButtons.forEach((button) => {
    const isActive = Number(button.dataset.droneIndex) === index;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setupResetControl(button) {
  button?.addEventListener("click", () => resetScenario());
}

function setupDisplayModeControls(simulationInstance, buttons) {
  const setMode = (mode) => {
    currentDisplayMode = mode;
    simulationInstance.setDisplayMode(mode);
    updateSceneDisplayTheme(mode);
    document.body.dataset.displayMode = mode;

    buttons.forEach((button) => {
      const isActive = button.dataset.displayMode === mode;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.displayMode));
  });

  setMode(DISPLAY_MODES.tactical);
}

function updateSceneDisplayTheme(mode) {
  worldMap.setDisplayMode(mode);
  worldMap.getObstacles().forEach((obstacle) => {
    obstacle.traverse((object) => {
      if (object.isLine || object.isLineSegments) {
        object.material.color.setHex(mode === DISPLAY_MODES.infrared ? 0xffc65a : 0xb3ff68);
        object.material.opacity = mode === DISPLAY_MODES.tactical ? 0.44 : 0.92;
      }

      if (object.isMesh && object.material?.emissive) {
        const emissiveColor = mode === DISPLAY_MODES.infrared ? 0x331005 : 0x102c10;
        object.material.emissive.setHex(
          mode === DISPLAY_MODES.tactical ? 0x08120e : emissiveColor,
        );
        object.material.emissiveIntensity = mode === DISPLAY_MODES.tactical ? 0.22 : 0.52;
      }
    });
  });
  worldMap.getHeatEntities().forEach((entity) => {
    entity.traverse((object) => {
      if (object.isMesh && object.material?.color) {
        object.material.opacity = mode === DISPLAY_MODES.tactical ? 0.72 : 1;
      }
    });
  });
  swarm.drones.forEach((swarmDrone) => swarmDrone.setDisplayMode(mode));
}

function updateDebugGlobals() {
  // Debug globals are exposed as getters, so no mutation is needed here.
}

function randomMapPosition(map, margin = 40) {
  return {
    x: randomFloat(-map.width / 2 + margin, map.width / 2 - margin),
    y: randomFloat(-map.depth / 2 + margin, map.depth / 2 - margin),
  };
}

function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomFloat(min, max + 1));
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
