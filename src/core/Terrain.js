import * as THREE from "three";
import { clamp, gaussian2D } from "../utils/MathUtils.js";

export class Terrain extends THREE.Group {
  constructor({
    width = 700,
    depth = 700,
    segments = 140,
    heightFunction = null,
  } = {}) {
    super();
    this.name = "Terrain";
    this.width = width;
    this.depth = depth;
    this.segments = segments;
    this.heightFunction = heightFunction ?? this.defaultHeightFunction.bind(this);

    this.mesh = this.createTerrainMesh();
    this.wireframe = this.createWireframeOverlay(this.mesh.geometry);
    this.add(this.mesh, this.wireframe);
    this.setDisplayMode("tactical");
  }

  getHeightAt(x, y) {
    return this.heightFunction(x, y);
  }

  defaultHeightFunction(x, y) {
    const rolling =
      5.2 * Math.sin(x * 0.025) +
      4.1 * Math.cos(y * 0.027) +
      3.5 * Math.sin((x + y) * 0.018);
    const longRidge = 6.5 * Math.sin((x - y) * 0.011);
    const broadHill = gaussian2D(x, y, -145, 108, 145, 18);
    const farRise = gaussian2D(x, y, 250, -120, 180, 16);

    return Math.max(-5, rolling + longRidge + broadHill + farRise);
  }

  createTerrainMesh() {
    const geometry = new THREE.PlaneGeometry(
      this.width,
      this.depth,
      this.segments,
      this.segments,
    );

    this.applyHeightToGeometry(geometry, (x, y) => this.getHeightAt(x, y));

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.18,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "Terrain Mesh";
    mesh.receiveShadow = true;
    return mesh;
  }

  refreshTerrainGeometry(heightResolver = (x, y) => this.getHeightAt(x, y)) {
    this.applyHeightToGeometry(this.mesh.geometry, heightResolver);
    this.refreshWireframeOverlay();
  }

  createWireframeOverlay(geometry) {
    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: 0x4cff8a,
        transparent: true,
        opacity: 0.12,
      }),
    );
    wireframe.name = "Terrain Tactical Wireframe";
    wireframe.position.z = 0.12;
    return wireframe;
  }

  refreshWireframeOverlay() {
    if (!this.wireframe) {
      return;
    }

    this.wireframe.geometry.dispose();
    this.wireframe.geometry = new THREE.WireframeGeometry(this.mesh.geometry);
  }

  setDisplayMode(mode) {
    const modes = {
      tactical: { wireColor: 0x4cff8a, wireOpacity: 0.12, emissive: 0x000000 },
      nightVision: { wireColor: 0xb3ff68, wireOpacity: 0.42, emissive: 0x071b07 },
      infrared: { wireColor: 0xffc65a, wireOpacity: 0.36, emissive: 0x190805 },
    };
    const theme = modes[mode] ?? modes.tactical;

    this.wireframe.material.color.setHex(theme.wireColor);
    this.wireframe.material.opacity = theme.wireOpacity;
    this.mesh.material.emissive.setHex(theme.emissive);
    this.mesh.material.emissiveIntensity = mode === "tactical" ? 0 : 0.28;
  }

  applyHeightToGeometry(geometry, heightResolver) {
    const positionAttribute = geometry.attributes.position;
    const heights = [];

    for (let index = 0; index < positionAttribute.count; index += 1) {
      const x = positionAttribute.getX(index);
      const y = positionAttribute.getY(index);
      const z = heightResolver(x, y);

      positionAttribute.setZ(index, z);
      heights.push(z);
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    this.applyVertexColors(geometry, heights);
  }

  applyVertexColors(geometry, heights) {
    const colors = [];
    const low = new THREE.Color(0x102018);
    const mid = new THREE.Color(0x25472e);
    const high = new THREE.Color(0x546b48);
    const snow = new THREE.Color(0xb8c7a1);

    heights.forEach((height) => {
      const t = clamp((height + 8) / 92, 0, 1);
      const color = new THREE.Color();

      if (t < 0.42) {
        color.copy(low).lerp(mid, t / 0.42);
      } else if (t < 0.78) {
        color.copy(mid).lerp(high, (t - 0.42) / 0.36);
      } else {
        color.copy(high).lerp(snow, (t - 0.78) / 0.22);
      }

      colors.push(color.r, color.g, color.b);
    });

    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.attributes.color.needsUpdate = true;
  }

  isInside(x, y) {
    return (
      x >= -this.width / 2 &&
      x <= this.width / 2 &&
      y >= -this.depth / 2 &&
      y <= this.depth / 2
    );
  }
}
