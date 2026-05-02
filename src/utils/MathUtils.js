import * as THREE from "three";

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function randomCentered(magnitude) {
  return (Math.random() * 2 - 1) * magnitude;
}

export function gaussian2D(x, y, centerX, centerY, radius, height) {
  const dx = x - centerX;
  const dy = y - centerY;
  const sigma = radius * 0.5;
  return height * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
}

export function limitVectorLength(vector, maxLength) {
  const length = vector.length();

  if (length > maxLength && length > 0) {
    vector.multiplyScalar(maxLength / length);
  }

  return vector;
}

export function horizontalDistance(a, b) {
  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));
}

export function normalizeAngleRadians(angle) {
  let normalized = angle;

  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;

  return normalized;
}

export function makeHorizontalDirection(from, to) {
  const direction = new THREE.Vector2((to.x ?? 0) - from.x, (to.y ?? 0) - from.y);
  const length = direction.length();

  if (length > 0) {
    direction.divideScalar(length);
  }

  return direction;
}
