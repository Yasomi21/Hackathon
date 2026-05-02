import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DisplayShaderManager } from "./DisplayShaderManager.js";

export class Simulation {
  constructor({
    container = document.body,
    cameraPosition = { x: 420, y: -520, z: 300 },
    controlsTarget = { x: 120, y: 80, z: 30 },
  } = {}) {
    THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050806);
    this.scene.fog = new THREE.FogExp2(0x050806, 0.00165);

    this.camera = new THREE.PerspectiveCamera(
      58,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      3000,
    );
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(controlsTarget.x, controlsTarget.y, controlsTarget.z);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.screenSpacePanning = false;

    this.clock = new THREE.Clock();
    this.worldMap = null;
    this.swarm = null;
    this.updateHook = null;
    this.displayShaderManager = new DisplayShaderManager({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      initialMode: "tactical",
    });

    this.addLighting();
    this.addReferenceHelpers();

    window.addEventListener("resize", () => this.handleResize());
  }

  setWorldMap(worldMap) {
    if (this.worldMap) {
      this.scene.remove(this.worldMap);
    }

    this.worldMap = worldMap;
    this.scene.add(worldMap);
  }

  setDroneSwarm(swarm) {
    if (this.swarm) {
      this.scene.remove(this.swarm);
    }

    this.swarm = swarm;
    this.scene.add(swarm);
  }

  setUpdateHook(updateHook) {
    this.updateHook = updateHook;
  }

  setDisplayMode(mode) {
    this.displayShaderManager.setMode(mode);
  }

  start() {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 1 / 24);

    if (this.swarm && this.worldMap) {
      this.swarm.update(dt, this.worldMap);
    }

    this.controls.update();

    if (this.updateHook) {
      this.updateHook({ dt, simulation: this });
    }

    this.displayShaderManager.update(dt);
    this.displayShaderManager.render();
  }

  handleResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.displayShaderManager.setSize(width, height);
  }

  addLighting() {
    const hemisphere = new THREE.HemisphereLight(0xb8ffd2, 0x050806, 0.95);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xd8ffe4, 1.65);
    sun.position.set(-260, -320, 520);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -460;
    sun.shadow.camera.right = 460;
    sun.shadow.camera.top = 460;
    sun.shadow.camera.bottom = -460;
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 900;
    this.scene.add(sun);

    const commandGlow = new THREE.PointLight(0x36ff8d, 1.15, 700, 1.8);
    commandGlow.position.set(180, -220, 210);
    this.scene.add(commandGlow);
  }

  addReferenceHelpers() {
    const tacticalGrid = new THREE.Group();
    tacticalGrid.name = "ENU Tactical Grid";

    const majorGrid = new THREE.GridHelper(720, 24, 0x55ff86, 0x123823);
    majorGrid.rotation.x = Math.PI / 2;
    majorGrid.position.z = -5.8;
    majorGrid.material.transparent = true;
    majorGrid.material.opacity = 0.42;

    const minorGrid = new THREE.GridHelper(720, 72, 0x1a6a41, 0x0d2419);
    minorGrid.rotation.x = Math.PI / 2;
    minorGrid.position.z = -5.7;
    minorGrid.material.transparent = true;
    minorGrid.material.opacity = 0.24;

    tacticalGrid.add(majorGrid, minorGrid, this.createBoundaryFrame(720, 640));
    this.scene.add(tacticalGrid);

    const axes = new THREE.AxesHelper(82);
    axes.name = "ENU Axes";
    this.scene.add(axes);

    this.scene.add(this.createTextSprite("+X East", { x: 108, y: 0, z: 0 }, "#ff7b7b"));
    this.scene.add(this.createTextSprite("+Y North", { x: 0, y: 108, z: 0 }, "#9be37d"));
    this.scene.add(this.createTextSprite("+Z Up", { x: 0, y: 0, z: 108 }, "#7bb7ff"));
  }

  createBoundaryFrame(width, depth) {
    const z = -4.5;
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const points = [
      new THREE.Vector3(-halfWidth, -halfDepth, z),
      new THREE.Vector3(halfWidth, -halfDepth, z),
      new THREE.Vector3(halfWidth, halfDepth, z),
      new THREE.Vector3(-halfWidth, halfDepth, z),
      new THREE.Vector3(-halfWidth, -halfDepth, z),
    ];

    const frame = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color: 0xffc45c,
        transparent: true,
        opacity: 0.58,
      }),
    );
    frame.name = "Simulation Boundary";
    return frame;
  }

  createTextSprite(text, position, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "700 42px system-ui, sans-serif";
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      }),
    );
    sprite.position.set(position.x, position.y, position.z);
    sprite.scale.set(70, 18, 1);
    return sprite;
  }
}
