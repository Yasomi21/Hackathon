import * as THREE from "three";
import { enuVector } from "../utils/ENU.js";

export class DroneSwarm extends THREE.Group {
  constructor({
    name = "Drone Swarm",
    collisionPadding = 3.5,
    arrivalFormationRadius = 20,
    arrivalFormationEngageRadius = 120,
  } = {}) {
    super();
    this.name = name;
    this.drones = [];
    this.collisionPadding = collisionPadding;
    this.arrivalFormationRadius = arrivalFormationRadius;
    this.arrivalFormationEngageRadius = arrivalFormationEngageRadius;
  }

  addDrone(drone) {
    drone.swarmIndex = this.drones.length;
    this.drones.push(drone);
    this.add(drone.pathLine);
    this.add(drone);
    return drone;
  }

  update(dt, worldMap) {
    this.drones.forEach((drone) => drone.update(dt, worldMap, this));
    this.resolveDroneSeparation(worldMap);
  }

  getNeighborSensorReadings(drone) {
    return this.drones
      .filter((candidate) => candidate !== drone)
      .map((neighbor) => ({
        drone: neighbor,
        gps: neighbor.gps.read(),
        imu: neighbor.imu.read(),
      }));
  }

  getClosestDroneDistance(drone) {
    const ownPosition = enuVector(drone.gps.read());
    let closest = Infinity;

    this.getNeighborSensorReadings(drone).forEach(({ gps }) => {
      closest = Math.min(closest, ownPosition.distanceTo(enuVector(gps)));
    });

    return closest;
  }

  getArrivalPositionForDrone(drone, sharedTarget) {
    if (this.drones.length <= 1) {
      return sharedTarget.clone();
    }

    if (drone.position.distanceTo(sharedTarget) > this.arrivalFormationEngageRadius) {
      return sharedTarget.clone();
    }

    const index = Math.max(0, this.drones.indexOf(drone));
    const angle = -Math.PI / 2 + (index / this.drones.length) * Math.PI * 2;
    const radius = this.arrivalFormationRadius;

    return new THREE.Vector3(
      sharedTarget.x + Math.cos(angle) * radius,
      sharedTarget.y + Math.sin(angle) * radius,
      sharedTarget.z,
    );
  }

  getMinimumSeparation(droneA, droneB) {
    return droneA.radius + droneB.radius + this.collisionPadding;
  }

  resolveDroneSeparation(worldMap) {
    for (let iteration = 0; iteration < 3; iteration += 1) {
      for (let aIndex = 0; aIndex < this.drones.length; aIndex += 1) {
        for (let bIndex = aIndex + 1; bIndex < this.drones.length; bIndex += 1) {
          this.resolveDronePair(this.drones[aIndex], this.drones[bIndex], worldMap);
        }
      }
    }
  }

  resolveDronePair(droneA, droneB, worldMap) {
    const separation = droneA.position.clone().sub(droneB.position);
    const distance = separation.length();
    const minimumSeparation = this.getMinimumSeparation(droneA, droneB);

    if (distance >= minimumSeparation) {
      return;
    }

    if (distance < 0.001) {
      separation.set(1, 0, 0);
    } else {
      separation.divideScalar(distance);
    }

    const correctionDistance = (minimumSeparation - Math.max(distance, 0.001)) / 2;
    this.applySeparationCorrection(
      droneA,
      separation.clone().multiplyScalar(correctionDistance),
      worldMap,
    );
    this.applySeparationCorrection(
      droneB,
      separation.clone().multiplyScalar(-correctionDistance),
      worldMap,
    );

    const relativeVelocity = droneA.velocity.clone().sub(droneB.velocity);
    const closingSpeed = relativeVelocity.dot(separation);

    if (closingSpeed < 0) {
      const impulse = separation.clone().multiplyScalar(-closingSpeed * 0.5);
      droneA.velocity.add(impulse);
      droneB.velocity.sub(impulse);
    }
  }

  applySeparationCorrection(drone, correction, worldMap) {
    const previousPosition = drone.position.clone();
    drone.position.add(correction);

    const minimumZ =
      worldMap.getHeightAt(drone.position.x, drone.position.y) +
      drone.flightController.minTerrainClearance;

    if (drone.position.z < minimumZ) {
      drone.position.z = minimumZ;
      drone.velocity.z = Math.max(0, drone.velocity.z);
    }

    const correctionDistance = previousPosition.distanceTo(drone.position);

    if (correctionDistance > 0.001) {
      drone.distanceTraveled += correctionDistance;
      drone.recordPathPoint();
      drone.flightController.releaseHoldIfDisplaced(this, worldMap);
    }
  }
}
