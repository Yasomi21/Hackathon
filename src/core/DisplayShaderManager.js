import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export class DisplayShaderManager {
  constructor({ renderer, scene, camera, width, height, initialMode = "tactical" }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.modes = {
      tactical: 0,
      nightVision: 1,
      infrared: 2,
    };
    this.mode = initialMode;

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.shaderPass = new ShaderPass(createDisplayShader());
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.shaderPass);
    this.composer.addPass(this.outputPass);

    this.setSize(width, height);
    this.setMode(initialMode);
  }

  setMode(mode) {
    if (!(mode in this.modes)) {
      return;
    }

    this.mode = mode;
    this.shaderPass.uniforms.mode.value = this.modes[mode];
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    this.shaderPass.uniforms.resolution.value.set(width, height);
  }

  update(dt) {
    this.shaderPass.uniforms.time.value += dt;
  }

  render() {
    this.composer.render();
  }
}

function createDisplayShader() {
  return {
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      mode: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float time;
      uniform int mode;

      varying vec2 vUv;

      float luminance(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
      }

      float random(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float vignette(vec2 uv, float strength, float radius) {
        float distanceFromCenter = distance(uv, vec2(0.5));
        return smoothstep(radius, strength, distanceFromCenter);
      }

      float screenEdge(vec2 uv) {
        vec2 texel = 1.0 / resolution;
        float center = luminance(texture2D(tDiffuse, uv).rgb);
        float north = luminance(texture2D(tDiffuse, uv + vec2(0.0, texel.y)).rgb);
        float south = luminance(texture2D(tDiffuse, uv - vec2(0.0, texel.y)).rgb);
        float east = luminance(texture2D(tDiffuse, uv + vec2(texel.x, 0.0)).rgb);
        float west = luminance(texture2D(tDiffuse, uv - vec2(texel.x, 0.0)).rgb);
        float northeast = luminance(texture2D(tDiffuse, uv + texel).rgb);
        float southwest = luminance(texture2D(tDiffuse, uv - texel).rgb);

        float axisEdge = abs(center - north) + abs(center - south) + abs(center - east) + abs(center - west);
        float diagonalEdge = abs(center - northeast) + abs(center - southwest);
        return smoothstep(0.055, 0.22, axisEdge + diagonalEdge * 0.55);
      }

      vec3 applyTactical(vec3 color, vec2 uv) {
        float edgeFade = 1.0 - vignette(uv, 0.78, 0.18) * 0.3;
        color = mix(color, color * vec3(0.82, 1.08, 0.9), 0.18);
        return color * edgeFade;
      }

      vec3 applyNightVision(vec3 color, vec2 uv) {
        float lum = luminance(color);
        float gain = smoothstep(0.01, 0.72, lum);
        float edge = screenEdge(uv);
        float scanline = sin(uv.y * resolution.y * 1.35 + time * 18.0) * 0.035;
        float noise = (random(uv * resolution + time * 23.0) - 0.5) * 0.12;
        float edgeFade = 1.0 - vignette(uv, 0.74, 0.08) * 0.55;

        vec3 phosphor = vec3(0.05, 0.62, 0.12) * (0.52 + gain * 1.7);
        phosphor += vec3(0.45, 1.0, 0.5) * pow(lum, 1.65) * 0.34;
        phosphor = mix(phosphor, vec3(0.78, 1.0, 0.58), edge * 0.92);
        phosphor += scanline + noise;

        return clamp(phosphor * edgeFade, 0.0, 1.0);
      }

      vec3 heatPalette(float heat) {
        vec3 cold = vec3(0.0, 0.02, 0.08);
        vec3 blue = vec3(0.0, 0.16, 0.72);
        vec3 violet = vec3(0.48, 0.02, 0.62);
        vec3 red = vec3(0.95, 0.05, 0.02);
        vec3 amber = vec3(1.0, 0.62, 0.02);
        vec3 whiteHot = vec3(1.0, 0.96, 0.72);

        if (heat < 0.18) {
          return mix(cold, blue, heat / 0.18);
        }

        if (heat < 0.42) {
          return mix(blue, violet, (heat - 0.18) / 0.24);
        }

        if (heat < 0.64) {
          return mix(violet, red, (heat - 0.42) / 0.22);
        }

        if (heat < 0.84) {
          return mix(red, amber, (heat - 0.64) / 0.2);
        }

        return mix(amber, whiteHot, (heat - 0.84) / 0.16);
      }

      vec3 applyInfrared(vec3 color, vec2 uv) {
        float lum = luminance(color);
        float edge = screenEdge(uv);
        float edgeFade = 1.0 - vignette(uv, 0.82, 0.24) * 0.25;
        float scanline = sin(uv.y * resolution.y * 0.62 + time * 10.0) * 0.025;
        float noise = (random(uv * resolution + time * 9.0) - 0.5) * 0.05;
        float heat = clamp(lum * 1.28 + color.r * 0.16 + color.g * 0.08 - color.b * 0.06, 0.0, 1.0);

        heat = smoothstep(0.02, 0.96, heat + scanline + noise);
        vec3 infrared = heatPalette(heat);
        infrared = mix(infrared, vec3(1.0, 0.94, 0.48), edge * 0.86);
        return clamp(infrared * edgeFade, 0.0, 1.0);
      }

      void main() {
        vec4 source = texture2D(tDiffuse, vUv);
        vec3 color = source.rgb;

        if (mode == 1) {
          color = applyNightVision(color, vUv);
        } else if (mode == 2) {
          color = applyInfrared(color, vUv);
        } else {
          color = applyTactical(color, vUv);
        }

        gl_FragColor = vec4(color, source.a);
      }
    `,
  };
}
