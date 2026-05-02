import * as THREE from "three";

export class Obstacle extends THREE.Group {
  constructor({
    name = "Obstacle",
    position = { x: 0, y: 0, z: null },
    radius = 10,
    height = 10,
    color = 0xffffff,
  } = {}) {
    super();
    this.name = name;
    this.enuPosition = {
      x: position.x ?? 0,
      y: position.y ?? 0,
      z: position.z ?? null,
    };
    this.radius = radius;
    this.height = height;
    this.color = color;
    this.mesh = null;
    this.affectsTerrain = false;
    this.blocksFlight = true;
  }

  createMesh() {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, 16, 12),
      new THREE.MeshStandardMaterial({ color: this.color }),
    );
    mesh.position.z = this.radius;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  addToScene(parent, worldMap) {
    if (!this.mesh) {
      this.mesh = this.createMesh(worldMap);
      this.add(this.mesh);
    }

    this.syncToTerrain(worldMap);
    parent.add(this);
    return this;
  }

  syncToTerrain(worldMap) {
    const baseZ =
      this.enuPosition.z ??
      worldMap.getTerrainHeightAt(this.enuPosition.x, this.enuPosition.y, {
        ignoreObstacle: this,
      });

    this.position.set(this.enuPosition.x, this.enuPosition.y, baseZ);
    return baseZ;
  }

  getTerrainHeightContributionAt() {
    return 0;
  }

  getBlockingHeightAt(_x, _y, groundHeight) {
    return groundHeight;
  }
}
