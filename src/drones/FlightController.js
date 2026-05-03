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
    this.arrivalFormationRadius = options.arrivalFormationRadius ?? 20;
    this.arrivalFormationEngageRadius = options.arrivalFormationEngageRadius ?? 115;

    this.windVelocity = new THREE.Vector3();
    this.windTarget = new THREE.Vector3();
    this.windTimer = 0;
  }

  setTarget(target) {
    this.target = enuVector(target);
    this.reachedTarget = false;
  }

  update(dt, worldMap) {
    if (this.reachedTarget) {
      this.releaseHoldIfDisplaced(worldMap);
    }

    if (!this.target || this.reachedTarget) {
      this.drone.acceleration.set(0, 0, 0);
      this.drone.angularVelocity.set(0, 0, 0);
      return;
    }

    this.updateWind(dt);

    const previousPosition = this.drone.position.clone();
    const finalTarget = this.getSafeFinalTarget(worldMap);
    const arrivalTarget = this.drone.radio.getLocalArrivalSlot(finalTarget, {
      formationRadius: this.arrivalFormationRadius,
      engageRadius: this.arrivalFormationEngageRadius,
    });
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
      worldMap,
    );
    const velocityDelta = desiredVelocity.sub(this.drone.velocity);
    const maxVelocityDelta = this.acceleration * dt;

    limitVectorLength(velocityDelta, maxVelocityDelta);
    this.drone.acceleration.copy(velocityDelta).divideScalar(Math.max(dt, 0.0001));
    this.drone.velocity.add(velocityDelta);
    limitVectorLength(
      this.drone.velocity,
      this.maxSpeed + (worldMap.windField?.speed ?? 0) + this.windStrength,
    );

    this.drone.position.addScaledVector(this.drone.velocity, dt);
    this.preventTerrainClipping(worldMap);
    this.updateOrientation(dt);
    this.trackDistance(previousPosition);
  }

  computeDesiredVelocity(adjustedTarget, distanceToAdjustedTarget, worldMap) {
    const desiredVelocity = adjustedTarget.clone().sub(this.drone.position);

    if (distanceToAdjustedTarget > 0.001) {
      desiredVelocity.normalize();
    }

    const speedScale = clamp(distanceToAdjustedTarget / this.slowRadius, 0.12, 1);
    desiredVelocity.multiplyScalar(this.maxSpeed * speedScale);
    desiredVelocity.add(this.computePeerAvoidance());
    desiredVelocity.add(this.computeWindInfluence(worldMap));
    desiredVelocity.add(this.windVelocity);
    return desiredVelocity;
  }

  computeWindInfluence(worldMap) {
    if (!worldMap?.windField) {
      return new THREE.Vector3();
    }

    const fieldWind = worldMap.windField.getVelocityAt(this.drone.position);
    const windMagnitude = fieldWind.length();

    if (windMagnitude <= 0.001) {
      return fieldWind;
    }

    const currentDirection = this.drone.velocity.clone();

    if (currentDirection.length() <= 0.001 && this.target) {
      currentDirection.copy(this.target).sub(this.drone.position);
    }

    const flightDirection =
      currentDirection.length() > 0.001
        ? currentDirection.normalize()
        : new THREE.Vector3(1, 0, 0);
    const windDirection = fieldWind.clone().normalize();
    const alignment = windDirection.dot(flightDirection);
    const pushOrDrag = 0.52 + alignment * 0.28;

    return fieldWind.multiplyScalar(clamp(pushOrDrag, 0.24, 0.82));
  }

  computePeerAvoidance() {
    const avoidance = new THREE.Vector3();
    const ownGps = enuVector(this.drone.gps.read());
    const ownAcceleration = enuVector(this.drone.imu.read().accelerometer);

    this.drone.radio.getPeerMessages().forEach((message) => {
      const neighborPosition = enuVector(message.position);
      const neighborAcceleration = enuVector(message.acceleration);
      const awayFromNeighbor = ownGps.clone().sub(neighborPosition);
      const distance = awayFromNeighbor.length();

      if (distance > this.separationRadius) {
        return;
      }

      if (distance < 0.001) {
        const indexAngle = this.getDeterministicPeerAngle();
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

  getDeterministicPeerAngle() {
    let hash = 0;

    for (let index = 0; index < this.drone.droneId.length; index += 1) {
      hash = (hash * 31 + this.drone.droneId.charCodeAt(index)) % 9973;
    }

    return (hash / 9973) * Math.PI * 2;
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

  releaseHoldIfDisplaced(worldMap = null) {
    if (!this.reachedTarget || !this.target || !worldMap) {
      return;
    }

    const finalTarget = this.getSafeFinalTarget(worldMap);
    const arrivalTarget = this.drone.radio.getLocalArrivalSlot(finalTarget, {
      formationRadius: this.arrivalFormationRadius,
      engageRadius: this.arrivalFormationEngageRadius,
    });
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
