import * as THREE from "three";
import {
  clamp,
  horizontalDistance,
  limitVectorLength,
  makeHorizontalDirection,
  normalizeAngleRadians,
  randomCentered,
} from "../utils/MathUtils.js";
import { enuVector } from "../utils/ENU.js";

export class FlightController {
  constructor(drone, options = {}) {
    this.drone = drone;
    this.target = null;
    this.reachedTarget = false;

    this.maxSpeed = options.maxSpeed ?? 35;
    this.acceleration = options.acceleration ?? 18;
    this.cruiseAltitude = options.cruiseAltitude ?? 45;
    this.minTerrainClearance = options.minTerrainClearance ?? 8;
    this.windStrength = options.windStrength ?? 2.5;
    this.arrivalThreshold = options.arrivalThreshold ?? 5;
    this.slowRadius = options.slowRadius ?? 70;
    this.lookAheadDistance = options.lookAheadDistance ?? 90;
    this.separationRadius = options.separationRadius ?? 45;
    this.collisionRadius = options.collisionRadius ?? 13;
    this.avoidanceStrength = options.avoidanceStrength ?? 34;
    this.emergencyAvoidanceStrength = options.emergencyAvoidanceStrength ?? 70;
    this.holdPositionThreshold = options.holdPositionThreshold ?? 4.5;

    this.windVelocity = new THREE.Vector3();
    this.windTarget = new THREE.Vector3();
    this.windTimer = 0;
  }

  setTarget(target) {
    this.target = enuVector(target);
    this.reachedTarget = false;
  }

  update(dt, worldMap, swarm = null) {
    if (this.reachedTarget) {
      this.releaseHoldIfDisplaced(swarm, worldMap);
    }

    if (!this.target || this.reachedTarget) {
      this.drone.acceleration.set(0, 0, 0);
      this.drone.angularVelocity.set(0, 0, 0);
      return;
    }

    this.updateWind(dt);

    const previousPosition = this.drone.position.clone();
    const finalTarget = this.getSafeFinalTarget(worldMap);
    const arrivalTarget =
      swarm?.getArrivalPositionForDrone(this.drone, finalTarget) ?? finalTarget;
    arrivalTarget.z = Math.max(
      arrivalTarget.z,
      worldMap.getHeightAt(arrivalTarget.x, arrivalTarget.y) +
        this.minTerrainClearance,
    );
    const adjustedTarget = this.getTerrainAwareTarget(worldMap, arrivalTarget);
    const distanceToAdjustedTarget = adjustedTarget.distanceTo(this.drone.position);
    const distanceToSharedTarget = finalTarget.distanceTo(this.drone.position);
    const distanceToArrivalTarget = arrivalTarget.distanceTo(this.drone.position);

    if (
      distanceToSharedTarget <= this.arrivalThreshold &&
      distanceToArrivalTarget <= this.arrivalThreshold &&
      this.drone.velocity.length() <= this.maxSpeed * 0.1
    ) {
      this.completeArrival(arrivalTarget);
      return;
    }

    const desiredVelocity = this.computeDesiredVelocity(
      adjustedTarget,
      distanceToAdjustedTarget,
      swarm,
    );
    const velocityDelta = desiredVelocity.sub(this.drone.velocity);
    const maxVelocityDelta = this.acceleration * dt;

    limitVectorLength(velocityDelta, maxVelocityDelta);
    this.drone.acceleration.copy(velocityDelta).divideScalar(Math.max(dt, 0.0001));
    this.drone.velocity.add(velocityDelta);
    limitVectorLength(this.drone.velocity, this.maxSpeed + this.windStrength);

    this.drone.position.addScaledVector(this.drone.velocity, dt);
    this.preventTerrainClipping(worldMap);
    this.updateOrientation(dt);
    this.trackDistance(previousPosition);
  }

  computeDesiredVelocity(adjustedTarget, distanceToAdjustedTarget, swarm) {
    const desiredVelocity = adjustedTarget.clone().sub(this.drone.position);

    if (distanceToAdjustedTarget > 0.001) {
      desiredVelocity.normalize();
    }

    const speedScale = clamp(distanceToAdjustedTarget / this.slowRadius, 0.12, 1);
    desiredVelocity.multiplyScalar(this.maxSpeed * speedScale);
    desiredVelocity.add(this.computeSwarmAvoidance(swarm));
    desiredVelocity.add(this.windVelocity);
    return desiredVelocity;
  }

  computeSwarmAvoidance(swarm) {
    const avoidance = new THREE.Vector3();

    if (!swarm) {
      return avoidance;
    }

    const ownGps = enuVector(this.drone.gps.read());
    const ownAcceleration = enuVector(this.drone.imu.read().accelerometer);

    swarm.getNeighborSensorReadings(this.drone).forEach(({ gps, imu }) => {
      const neighborPosition = enuVector(gps);
      const neighborAcceleration = enuVector(imu.accelerometer);
      const awayFromNeighbor = ownGps.clone().sub(neighborPosition);
      const distance = awayFromNeighbor.length();

      if (distance > this.separationRadius) {
        return;
      }

      if (distance < 0.001) {
        const indexAngle = (this.drone.swarmIndex ?? 0) * 2.399963;
        awayFromNeighbor.set(Math.cos(indexAngle), Math.sin(indexAngle), 0.25);
      } else {
        awayFromNeighbor.divideScalar(distance);
      }

      const normalizedThreat = 1 - clamp(distance / this.separationRadius, 0, 1);
      const emergencyThreat = 1 - clamp(distance / this.collisionRadius, 0, 1);
      const normalAvoidance = normalizedThreat * normalizedThreat * this.avoidanceStrength;
      const emergencyAvoidance =
        emergencyThreat * emergencyThreat * this.emergencyAvoidanceStrength;

      avoidance.addScaledVector(awayFromNeighbor, normalAvoidance + emergencyAvoidance);

      const relativeAcceleration = ownAcceleration.clone().sub(neighborAcceleration);
      limitVectorLength(relativeAcceleration, this.avoidanceStrength * 0.25);
      avoidance.addScaledVector(relativeAcceleration, normalizedThreat * 0.12);
    });

    return avoidance;
  }

  getSafeFinalTarget(worldMap) {
    const groundAtTarget = worldMap.getHeightAt(this.target.x, this.target.y);
    return new THREE.Vector3(
      this.target.x,
      this.target.y,
      Math.max(this.target.z, groundAtTarget + this.minTerrainClearance),
    );
  }

  getTerrainAwareTarget(worldMap, finalTarget) {
    const horizontalRemaining = horizontalDistance(this.drone.position, finalTarget);
    const terrainEnvelope = this.sampleTerrainEnvelope(worldMap, finalTarget);
    const cruiseZ = terrainEnvelope + this.cruiseAltitude;
    const descentBlend = clamp(horizontalRemaining / this.slowRadius, 0, 1);
    const desiredZ = finalTarget.z + (cruiseZ - finalTarget.z) * descentBlend;

    return new THREE.Vector3(finalTarget.x, finalTarget.y, desiredZ);
  }

  sampleTerrainEnvelope(worldMap, finalTarget) {
    const position = this.drone.position;
    const direction = makeHorizontalDirection(position, finalTarget);
    const remaining = horizontalDistance(position, finalTarget);
    const lookAhead = Math.min(this.lookAheadDistance, remaining);
    let maxHeight = worldMap.getHeightAt(position.x, position.y);

    for (let step = 1; step <= 5; step += 1) {
      const distance = (lookAhead * step) / 5;
      const x = position.x + direction.x * distance;
      const y = position.y + direction.y * distance;
      maxHeight = Math.max(maxHeight, worldMap.getHeightAt(x, y));
    }

    return maxHeight;
  }

  preventTerrainClipping(worldMap) {
    const minimumZ =
      worldMap.getHeightAt(this.drone.position.x, this.drone.position.y) +
      this.minTerrainClearance;

    if (this.drone.position.z < minimumZ) {
      this.drone.position.z = minimumZ;
      this.drone.velocity.z = Math.max(0, this.drone.velocity.z);
      this.drone.acceleration.z = Math.max(0, this.drone.acceleration.z);
    }
  }

  updateWind(dt) {
    this.windTimer -= dt;

    if (this.windTimer <= 0) {
      this.windTarget.set(
        randomCentered(this.windStrength),
        randomCentered(this.windStrength),
        randomCentered(this.windStrength * 0.22),
      );
      this.windTimer = 0.65 + Math.random() * 1.2;
    }

    this.windVelocity.lerp(this.windTarget, clamp(dt * 0.85, 0, 1));
  }

  updateOrientation(dt) {
    const velocity = this.drone.velocity;
    const horizontalSpeed = Math.hypot(velocity.x, velocity.y);

    if (velocity.length() < 0.05) {
      this.drone.angularVelocity.set(0, 0, 0);
      return;
    }

    const previous = { ...this.drone.orientation };
    const yaw = Math.atan2(velocity.x, velocity.y);
    const pitch = Math.atan2(velocity.z, Math.max(horizontalSpeed, 0.001));
    const roll = clamp(-this.windVelocity.x / Math.max(this.maxSpeed, 1), -0.25, 0.25);

    this.drone.orientation = { roll, pitch, yaw };
    this.drone.angularVelocity.set(
      normalizeAngleRadians(roll - previous.roll) / dt,
      normalizeAngleRadians(pitch - previous.pitch) / dt,
      normalizeAngleRadians(yaw - previous.yaw) / dt,
    );
  }

  trackDistance(previousPosition) {
    this.drone.distanceTraveled += previousPosition.distanceTo(this.drone.position);
    this.drone.recordPathPoint();
  }

  completeArrival(finalTarget) {
    const previousPosition = this.drone.position.clone();
    this.drone.position.copy(finalTarget);
    this.drone.velocity.set(0, 0, 0);
    this.drone.acceleration.set(0, 0, 0);
    this.drone.angularVelocity.set(0, 0, 0);
    this.reachedTarget = true;
    this.trackDistance(previousPosition);
  }

  releaseHoldIfDisplaced(swarm = null, worldMap = null) {
    if (!this.reachedTarget || !this.target || !swarm || !worldMap) {
      return;
    }

    const finalTarget = this.getSafeFinalTarget(worldMap);
    const arrivalTarget = swarm.getArrivalPositionForDrone(this.drone, finalTarget);
    arrivalTarget.z = Math.max(
      arrivalTarget.z,
      worldMap.getHeightAt(arrivalTarget.x, arrivalTarget.y) +
        this.minTerrainClearance,
    );

    if (this.drone.position.distanceTo(arrivalTarget) > this.holdPositionThreshold) {
      this.reachedTarget = false;
    }
  }
}
