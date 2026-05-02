import * as THREE from "three";

export const ENU_AXES = Object.freeze({
  EAST: new THREE.Vector3(1, 0, 0),
  NORTH: new THREE.Vector3(0, 1, 0),
  UP: new THREE.Vector3(0, 0, 1),
});

export function enuVector(position = {}) {
  return new THREE.Vector3(position.x ?? 0, position.y ?? 0, position.z ?? 0);
}

export function enuPlain(vector = {}) {
  return {
    x: vector.x ?? 0,
    y: vector.y ?? 0,
    z: vector.z ?? 0,
  };
}

export function cloneENU(position = {}) {
  return {
    x: position.x ?? 0,
    y: position.y ?? 0,
    z: position.z ?? 0,
  };
}

export function setENUPosition(object, position = {}) {
  object.position.set(position.x ?? 0, position.y ?? 0, position.z ?? 0);
  return object;
}

export function formatENU(position = {}, digits = 1) {
  const fixed = (value) => Number(value ?? 0).toFixed(digits);
  return `x ${fixed(position.x)} | y ${fixed(position.y)} | z ${fixed(
    position.z,
  )}`;
}
