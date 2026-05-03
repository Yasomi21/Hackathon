import { enuPlain, enuVector } from "../utils/ENU.js";

export class DroneRadio {
  constructor(drone, { range = 140, messageTtl = 2.5 } = {}) {
    this.drone = drone;
    this.range = range;
    this.messageTtl = messageTtl;
    this.clock = 0;
    this.peerMessages = new Map();
  }

  update(dt, peers = []) {
    this.clock += dt;

    peers.forEach((peer) => {
      if (peer === this.drone) {
        return;
      }

      const distance = this.drone.position.distanceTo(peer.position);

      if (distance <= this.range) {
        this.peerMessages.set(peer.droneId, {
          droneId: peer.droneId,
          name: peer.name,
          radius: peer.radius,
          position: peer.gps.read(),
          velocity: enuPlain(peer.velocity),
          acceleration: peer.imu.read().accelerometer,
          target: peer.flightController.target
            ? enuPlain(peer.flightController.target)
            : null,
          reachedTarget: peer.flightController.reachedTarget,
          receivedAt: this.clock,
          distance,
        });
      }
    });

    this.pruneExpiredMessages();
  }

  getPeerMessages() {
    this.pruneExpiredMessages();
    return [...this.peerMessages.values()];
  }

  getClosestPeerDistance() {
    return this.getPeerMessages().reduce(
      (closest, message) => Math.min(closest, message.distance),
      Infinity,
    );
  }

  getDistributedRoster() {
    const roster = [
      {
        droneId: this.drone.droneId,
        name: this.drone.name,
        position: enuPlain(this.drone.position),
      },
      ...this.getPeerMessages().map((message) => ({
        droneId: message.droneId,
        name: message.name,
        position: message.position,
      })),
    ];

    return roster.sort((a, b) => a.droneId.localeCompare(b.droneId));
  }

  getLocalArrivalSlot(sharedTarget, { formationRadius = 20, engageRadius = 115 } = {}) {
    const targetVector = enuVector(sharedTarget);

    if (this.drone.position.distanceTo(targetVector) > engageRadius) {
      return targetVector;
    }

    const roster = this.getDistributedRoster();

    if (roster.length <= 1) {
      return targetVector;
    }

    const index = Math.max(
      0,
      roster.findIndex((entry) => entry.droneId === this.drone.droneId),
    );
    const angle = -Math.PI / 2 + (index / roster.length) * Math.PI * 2;

    targetVector.x += Math.cos(angle) * formationRadius;
    targetVector.y += Math.sin(angle) * formationRadius;
    return targetVector;
  }

  pruneExpiredMessages() {
    this.peerMessages.forEach((message, droneId) => {
      if (this.clock - message.receivedAt > this.messageTtl) {
        this.peerMessages.delete(droneId);
      }
    });
  }
}
