import * as THREE from "../../vendor/three/three.module.js";
import { racerProjection } from "../track/route-branches.js";
import { patchMaterial } from "./surface-detail.js";
import { registerLayeredLight } from "./layered-lighting.js";

/** One bounded trail draw, sampled against each racer's actual route floor. */
export function createSurfaceInteractions(scene, track, racers, capacity = 256) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const births = new Float32Array(capacity).fill(-1000);
  geometry.setAttribute("trailBirth", new THREE.InstancedBufferAttribute(births, 1));
  const clock = { value: 0 };
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.98,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  patchMaterial(material, "wheel-contact-trails", (shader) => {
    shader.uniforms.trailClock = clock;
    shader.vertexShader =
      `attribute float trailBirth;varying float vTrailBirth;varying vec2 vTrailUv;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvTrailBirth=trailBirth;vTrailUv=uv;",
      );
    shader.fragmentShader =
      `uniform float trailClock;varying float vTrailBirth;varying vec2 vTrailUv;\n${shader.fragmentShader}`.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float trailAge=max(0.,trailClock-vTrailBirth);
      float sideFade=smoothstep(0.,.2,vTrailUv.x)*smoothstep(0.,.2,1.-vTrailUv.x);
      float endFade=smoothstep(0.,.12,vTrailUv.y)*smoothstep(0.,.12,1.-vTrailUv.y);
      diffuseColor.a*=(1.-smoothstep(3.,9.,trailAge))*sideFade*endFade;`,
      );
  });
  const trails = new THREE.InstancedMesh(geometry, material, capacity);
  trails.name = "Bounded tire contact trails";
  trails.userData.skipBake = true;
  trails.userData.excludeFromReflectionProbe = true;
  trails.frustumCulled = false;
  trails.count = 0;
  scene.add(trails);
  const histories = new Map(),
    lights = new Map();
  const dummy = new THREE.Object3D(),
    normal = new THREE.Vector3(),
    forward = new THREE.Vector3();
  const right = new THREE.Vector3(),
    basis = new THREE.Matrix4();
  let cursor = 0,
    lastTime = 0;
  for (const racer of racers)
    lights.set(
      racer,
      registerLayeredLight(scene, {
        position: [0, -100, 0],
        color: "#8cefff",
        intensity: 0,
        radius: 5.5,
        kind: "gameplay",
        staticBake: false,
        visibleSource: false,
      }),
    );
  function reset() {
    histories.clear();
    cursor = 0;
    trails.count = 0;
    births.fill(-1000);
  }
  function update(time, state = {}) {
    if (time < lastTime) reset();
    lastTime = time;
    clock.value = time;
    trails.visible = state.motionEnabled !== false;
    for (const racer of racers) {
      const light = lights.get(racer);
      light.basePosition.copy(racer.worldPos).y += 0.45;
      light.color.set(
        racer.star > 0 ? "#ffe097" : racer.driftBoostTier === 2 ? "#ffc678" : "#8cefff",
      );
      light.intensity = racer.boost > 0 ? 4 : racer.star > 0 ? 3 : racer.driftTier > 0 ? 1.3 : 0;
      if (!trails.visible || !state.running || !racer.grounded || racer.speed < 8) {
        histories.delete(racer);
        continue;
      }
      const surface = racerProjection(track, racer);
      const kind = surface.material || track.sectionAt(track.trackT(racer.s)).material;
      const loose = ["sand", "snow", "grass", "gravel", "needles"].includes(kind);
      const sliding =
        racer.driftDirection !== 0 && Math.abs(racer.lateralSpeed || racer.steering || 0) > 0.1;
      if (!loose && !sliding) continue;
      const previous = histories.get(racer);
      if (previous && time - previous.time < 0.065) continue;
      if (previous && racer.worldPos.distanceToSquared(previous.position) < 0.3) continue;
      const scale = racer.scale ?? 1;
      const tangent = new THREE.Vector3(-Math.sin(racer.yaw), 0, -Math.cos(racer.yaw));
      const length = previous
        ? THREE.MathUtils.clamp(racer.worldPos.distanceTo(previous.position), 0.35, 1.7) * scale
        : 0.5 * scale;
      for (const side of [-1, 1]) {
        const contact = racer.worldPos.clone().addScaledVector(tangent, -0.65 * scale);
        contact.x += Math.cos(racer.yaw) * side * 0.68 * scale;
        contact.z -= Math.sin(racer.yaw) * side * 0.68 * scale;
        const floor = racerProjection(track, racer, contact);
        contact.y = floor.height + 0.027;
        normal.copy(floor.frame.up);
        forward.copy(tangent).addScaledVector(normal, -tangent.dot(normal)).normalize();
        right.crossVectors(forward, normal).normalize();
        basis.makeBasis(right, normal, forward);
        dummy.position.copy(contact);
        dummy.quaternion.setFromRotationMatrix(basis);
        dummy.scale.set((kind === "snow" ? 0.24 : 0.15) * scale, 1, length);
        dummy.updateMatrix();
        trails.setMatrixAt(cursor, dummy.matrix);
        trails.setColorAt(
          cursor,
          new THREE.Color(
            kind === "snow"
              ? "#869fb8"
              : kind === "sand"
                ? "#9c784c"
                : loose
                  ? "#697054"
                  : "#2c3033",
          ),
        );
        births[cursor] = time;
        cursor = (cursor + 1) % capacity;
        trails.count = Math.min(capacity, trails.count + 1);
      }
      histories.set(racer, { time, position: racer.worldPos.clone() });
    }
    trails.instanceMatrix.needsUpdate = true;
    if (trails.instanceColor) trails.instanceColor.needsUpdate = true;
    geometry.attributes.trailBirth.needsUpdate = true;
  }
  return {
    trails,
    lights,
    update,
    reset,
    dispose() {
      trails.removeFromParent();
      geometry.dispose();
      material.dispose();
      for (const light of lights.values()) light.dispose();
    },
  };
}
