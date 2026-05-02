import { Sensor } from "./Sensor.js";
import { enuPlain } from "../utils/ENU.js";

export class GPS extends Sensor {
  read() {
    return enuPlain(this.drone.position);
  }
}
