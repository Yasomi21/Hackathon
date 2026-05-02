import { Sensor } from "./Sensor.js";
import { enuPlain } from "../utils/ENU.js";

export class IMU extends Sensor {
  read() {
    return {
      accelerometer: enuPlain(this.drone.acceleration),
      gyroscope: enuPlain(this.drone.angularVelocity),
      magnetometer: { x: 0, y: 1, z: 0 },
    };
  }
}
