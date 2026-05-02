export class Sensor {
  constructor(drone) {
    this.drone = drone;
  }

  read() {
    throw new Error("Sensor subclasses must implement read().");
  }
}
