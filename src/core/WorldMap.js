import { Terrain } from "./Terrain.js";

export class WorldMap extends Terrain {
  constructor(options = {}) {
    super(options);
    this.name = "World Map";
    this.obstacles = [];
  }

  addObstacle(obstacle) {
    this.obstacles.push(obstacle);

    if (obstacle.affectsTerrain) {
      this.refreshTerrainGeometry((x, y) => this.getTerrainHeightAt(x, y));
    }

    obstacle.addToScene(this, this);
    this.syncObstaclesToTerrain();
    return obstacle;
  }

  addObstacles(obstacles) {
    obstacles.forEach((obstacle) => this.addObstacle(obstacle));
  }

  getTerrainHeightAt(x, y, { ignoreObstacle = null } = {}) {
    let height = super.getHeightAt(x, y);

    if (!this.obstacles) {
      return height;
    }

    this.obstacles.forEach((obstacle) => {
      if (obstacle !== ignoreObstacle && obstacle.affectsTerrain) {
        height += obstacle.getTerrainHeightContributionAt(x, y);
      }
    });

    return height;
  }

  getHeightAt(x, y, { ignoreObstacle = null } = {}) {
    const terrainHeight = this.getTerrainHeightAt(x, y, { ignoreObstacle });
    let height = terrainHeight;

    if (!this.obstacles) {
      return height;
    }

    this.obstacles.forEach((obstacle) => {
      if (obstacle !== ignoreObstacle && obstacle.blocksFlight) {
        height = Math.max(height, obstacle.getBlockingHeightAt(x, y, terrainHeight));
      }
    });

    return height;
  }

  syncObstaclesToTerrain() {
    this.obstacles.forEach((obstacle) => obstacle.syncToTerrain(this));
  }

  getObstacles() {
    return [...this.obstacles];
  }
}
