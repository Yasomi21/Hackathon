import * as THREE from "three";

export class DroneSwarm extends THREE.Group {
  constructor({ name = "Drone Swarm" } = {}) {
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

  update(dt, worldMap) {
    this.drones.forEach((drone) => drone.update(dt, worldMap));
  }
}
