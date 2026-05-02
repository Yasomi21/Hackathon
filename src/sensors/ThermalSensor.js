import { Sensor } from "./Sensor.js";
import { enuVector } from "../utils/ENU.js";

export class ThermalSensor extends Sensor {
  constructor(drone, { range = 950 } = {}) {
    super(drone);
    this.range = range;
  }

  read(worldMap) {
    if (!worldMap) {
      return { people: 0, animals: 0, total: 0, detections: [] };
    }

    const dronePosition = enuVector(this.drone.gps.read());
    const detections = worldMap
      .getHeatEntities()
      .map((entity) => {
        const reading = entity.getThermalReading();
        const targetPosition = enuVector(reading.position);

        return {
          ...reading,
          distance: dronePosition.distanceTo(targetPosition),
        };
      })
      .filter((reading) => reading.distance <= this.range);

    return {
      people: detections.filter((reading) => reading.species === "human").length,
      animals: detections.filter((reading) => reading.species === "animal").length,
      total: detections.length,
      detections,
    };
  }
}
