import * as THREE from "three";

// Rendering/update container only. Coordination decisions live onboard each drone.
export class DroneSwarm extends THREE.Group {
  constructor({ name = "Drone Fleet" } = {}) {
    super();
    this.name = name;
    this.drones = [];
  }

  addDrone(drone) {
    this.drones.push(drone);
    this.add(drone.pathLine);
    this.add(drone);
    return drone;
  }

  clearDrones() {
    this.drones.forEach((drone) => {
      this.remove(drone.pathLine);
      this.remove(drone);
    });
    this.drones = [];
  }

  update(dt, worldMap) {
    this.drones.forEach((drone) => drone.update(dt, worldMap, this.drones));
  }

  getClosestDroneDistance(drone) {
    return drone.radio.getClosestPeerDistance();
  }
}
