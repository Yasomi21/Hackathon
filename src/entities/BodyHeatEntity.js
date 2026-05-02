import * as THREE from "three";

export class BodyHeatEntity extends THREE.Group {
  constructor({
    name = "Heat Signature",
    species = "unknown",
    position = { x: 0, y: 0, z: null },
    temperatureC = 37,
    radius = 2,
    height = 5,
    color = 0xff8b3d,
  } = {}) {
    super();
    this.name = name;
    this.species = species;
    this.enuPosition = {
      x: position.x ?? 0,
      y: position.y ?? 0,
      z: position.z ?? null,
    };
    this.temperatureC = temperatureC;
    this.radius = radius;
    this.height = height;
    this.color = color;
    this.mesh = null;
  }

  addToScene(parent, worldMap) {
    if (!this.mesh) {
      this.mesh = this.createMesh();
      this.add(this.mesh);
    }

    this.syncToTerrain(worldMap);
    parent.add(this);
    return this;
  }

  syncToTerrain(worldMap) {
    const z =
      this.enuPosition.z ??
      worldMap.getTerrainHeightAt(this.enuPosition.x, this.enuPosition.y);

    this.position.set(this.enuPosition.x, this.enuPosition.y, z);
    return z;
  }

  createHeatMaterial(color = this.color) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
    });
  }

  getThermalReading() {
    return {
      name: this.name,
      species: this.species,
      temperatureC: this.temperatureC,
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z + this.height * 0.5,
      },
    };
  }
}
