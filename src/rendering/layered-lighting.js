import * as THREE from "../../vendor/three/three.module.js";
import { registerLightPool } from "./course-lighting.js";

const DEFAULTS = Object.freeze({ intensity: 2, radius: 14, kind: "practical", staticBake: true });
const PATTERNS = new Set(["lattice", "leaves", "stained-glass", "caustic"]);
const MAX_PATTERN_MESHES = 24;
const MAX_VISIBLE_PATTERN_MESHES = 6;
const MAX_SOURCE_MESHES = 12;
const MAX_SHAFT_MESHES = 4;
const SURFACE_VERTEX = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const SURFACE_FRAGMENT = `uniform vec3 tint;uniform float power;uniform float clock;uniform int patternId;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 p=vUv;float mask=1.;
if(patternId==1){vec2 q=fract(p*8.);float edge=min(min(q.x,1.-q.x),min(q.y,1.-q.y));mask=1.-(1.-smoothstep(.035,.035+max(fwidth(edge),.002),edge));}
else if(patternId==2){float leaf=abs(p.y-.5-.19*sin(p.x*22.+clock*.2));mask=1.-smoothstep(.035,.11,leaf);mask*=smoothstep(0.,.12,p.x)*smoothstep(0.,.12,1.-p.x);}
else if(patternId==3){vec2 cell=floor(p*4.);float pane=hash(cell);float seam=min(min(fract(p.x*4.),1.-fract(p.x*4.)),min(fract(p.y*4.),1.-fract(p.y*4.)));float bar=1.-smoothstep(.015,.015+max(fwidth(seam),.002),seam);mask=(.55+.45*pane)*(1.-bar);}
else if(patternId==4){float c=sin(p.x*24.+clock*.6+sin(p.y*18.))*sin(p.y*21.-clock*.4);mask=pow(max(0.,c),5.);}
float edge=1.-smoothstep(.72,1.,length((p-.5)*2.));float flicker=1.;if(power<0.)flicker=.88+.12*sin(clock*13.)*sin(clock*7.1);
gl_FragColor=vec4(tint,mask*edge*abs(power)*flicker);
#include <colorspace_fragment>
}`;

function vector(value, fallback = [0, 0, 0]) {
  return value?.isVector3 ? value.clone() : new THREE.Vector3(...(value || fallback));
}

function patternIndex(pattern) {
  return [null, "lattice", "leaves", "stained-glass", "caustic"].indexOf(pattern);
}

/** Register an authored source, its stable bake marker, and optional transmitted-light patch. */
export function registerLayeredLight(scene, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const parent = config.parent || scene;
  const initial = vector(config.position);
  const worldInitial = parent === scene ? initial.clone() : parent.localToWorld(initial.clone());
  const color = new THREE.Color(config.color || "#fff1cc");
  const record = {
    scene,
    parent,
    basePosition: initial,
    position: worldInitial.clone(),
    color,
    worldDirection: new THREE.Vector3(0, -1, 0),
    worldTarget: null,
    intensity: config.intensity,
    radius: config.radius,
    kind: config.kind,
    pattern: PATTERNS.has(config.pattern) ? config.pattern : null,
    direction: vector(config.direction, [0, -1, 0]).normalize(),
    target: config.target ? vector(config.target) : null,
    targetWorld: !!config.targetWorld,
    speed: config.speed || 0,
    phase: config.phase || 0,
    amplitude: config.amplitude || 0,
    staticBake: config.staticBake !== false,
    originalParent: parent,
    disposed: false,
  };
  for (let holder = parent; holder && holder !== scene; holder = holder.parent)
    holder.userData.layeredLightSource = true;
  if (record.staticBake) {
    record.pool = registerLightPool(scene, {
      position: worldInitial,
      color: color.getHex(),
      intensity: record.intensity,
      radius: record.radius,
    });
    record.pool.layerRecord = record;
  }

  record.sourceVisual = config.sourceObject || null;
  const activeSources = (scene.userData.layeredLights || []).filter(
    (entry) => entry.ownsSourceVisual,
  ).length;
  if (!record.sourceVisual && config.visibleSource && activeSources < MAX_SOURCE_MESHES) {
    const sourceGeo = new THREE.SphereGeometry(
      Math.max(0.12, Math.min(0.65, record.radius * 0.035)),
      8,
      6,
    );
    const sourceMat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    record.sourceVisual = new THREE.Mesh(sourceGeo, sourceMat);
    parent.add(record.sourceVisual);
    record.sourceVisual.position.copy(initial);
    record.ownsSourceVisual = true;
  }
  if (record.sourceVisual) {
    if (record.sourceVisual.parent !== parent && !config.sourceObject)
      parent.add(record.sourceVisual);
    if (config.sourceObject && record.sourceVisual.parent === parent)
      record.sourceVisual.position.copy(initial);
    record.sourceVisual.name ||= `Layered ${record.kind} source`;
    record.sourceVisual.userData.skipBake = true;
    record.sourceVisual.userData.layeredLightSource = true;
    record.sourceVisual.userData.excludeFromReflectionProbe = true;
    record.sourceVisual.castShadow = false;
    record.sourceVisual.receiveShadow = false;
  }

  const activePatterns = (scene.userData.layeredLights || []).filter((entry) => entry.patch).length;
  if (record.pattern && activePatterns < MAX_PATTERN_MESHES) {
    const pattern = record.pattern;
    const uniforms = {
      tint: { value: color.clone() },
      power: { value: record.intensity / Math.max(1, record.radius) },
      clock: { value: 0 },
      patternId: { value: patternIndex(pattern) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SURFACE_VERTEX,
      fragmentShader: SURFACE_FRAGMENT,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    patch.name = `Transmitted ${pattern} light`;
    patch.userData.skipBake = true;
    patch.userData.excludeFromReflectionProbe = true;
    patch.rotation.x = -Math.PI / 2;
    patch.scale.setScalar(record.radius * 1.15);
    scene.add(patch);
    record.patch = patch;
  }

  const activeShafts = (scene.userData.layeredLights || []).filter((entry) => entry.shaft).length;
  if ((config.shaft || config.kind === "shaft") && activeShafts < MAX_SHAFT_MESHES) {
    const shaftMat = new THREE.ShaderMaterial({
      uniforms: { tint: { value: color.clone() }, power: { value: 0.08 } },
      vertexShader: `varying float vDepth;void main(){vDepth=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform vec3 tint;uniform float power;varying float vDepth;void main(){float fade=(1.-smoothstep(.12,1.,vDepth))*smoothstep(0.,.18,vDepth);gl_FragColor=vec4(tint,power*fade);
      #include <colorspace_fragment>
      }`,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(
        record.radius * 0.42,
        record.radius * 0.04,
        record.radius * 1.4,
        12,
        1,
        false,
      ),
      shaftMat,
    );
    shaft.name = "Depth-tested light shaft";
    shaft.userData.skipBake = true;
    shaft.userData.excludeFromReflectionProbe = true;
    scene.add(shaft);
    record.shaft = shaft;
  }

  const list = (scene.userData.layeredLights ||= []);
  list.push(record);
  record.update = (time = 0, state = {}) => updateRecord(record, time, state);
  record.dispose = () => disposeRecord(record);
  record.update(0, { resolveReceivers: false });
  return record;
}

function updateRecord(record, time, state) {
  if (record.disposed) return;
  const motion = state.motionEnabled !== false;
  const t = motion ? time : 0;
  const offset = record.amplitude * Math.sin(t * record.speed + record.phase);
  const local = record.basePosition.clone();
  if (record.amplitude) local.y += offset;
  record.parent.updateWorldMatrix(true, false);
  record.position.copy(record.parent === record.scene ? local : record.parent.localToWorld(local));
  record.worldDirection.copy(record.direction);
  if (record.parent !== record.scene)
    record.worldDirection
      .applyQuaternion(record.parent.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
  record.worldTarget = record.target
    ? record.targetWorld || record.parent === record.scene
      ? record.target.clone()
      : record.parent.localToWorld(record.target.clone())
    : null;
  if (state.bake && record.pool) record.pool.position.copy(record.position);
  const weatherFlash = motion && Number.isFinite(state.stormFlash) ? state.stormFlash : 0;
  const flicker =
    record.kind === "fire" || record.kind === "heat"
      ? 0.9 + 0.07 * Math.sin(t * 11 + record.phase) + 0.03 * Math.sin(t * 19.3)
      : 1;
  record.currentIntensity =
    record.kind === "weather-flash" ? weatherFlash * record.intensity : record.intensity * flicker;
  if (record.sourceVisual) {
    if (record.sourceVisual.parent === record.parent) record.sourceVisual.position.copy(local);
    record.sourceVisual.visible = record.currentIntensity > 0;
    const strength = record.currentIntensity / Math.max(record.intensity, 0.001);
    const mat = record.sourceVisual.material;
    for (const material of Array.isArray(mat) ? mat : [mat]) {
      if (!material) continue;
      if (material.isMeshBasicMaterial && material.color)
        material.color.copy(record.color).multiplyScalar(THREE.MathUtils.clamp(strength, 0, 2));
      if (material.emissive)
        material.emissiveIntensity =
          (material.userData.layeredBaseEmissive ??= material.emissiveIntensity) * strength;
    }
  }
  if (record.patch) {
    const direction = record.worldTarget
      ? record.worldTarget.clone().sub(record.position).normalize()
      : record.worldDirection;
    const showPattern =
      state.showPattern !== false &&
      (state.qualityTier == null || state.qualityTier > 0) &&
      (!state.viewerPosition ||
        record.position.distanceToSquared(state.viewerPosition) < (record.radius * 6) ** 2);
    const receiver = !showPattern
      ? null
      : record.worldTarget
        ? { point: record.worldTarget.clone(), normal: direction.clone().negate() }
        : findReceiver(record, state);
    record.patch.visible = !!receiver;
    if (receiver) {
      record.patch.position.copy(receiver.point);
      record.patch.position.addScaledVector(receiver.normal, 0.025);
      record.patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), receiver.normal);
    }
    record.patch.material.uniforms.clock.value = t;
    record.patch.material.uniforms.power.value =
      record.currentIntensity / Math.max(1, record.radius);
  }
  if (record.shaft) {
    const length = record.radius * 1.4;
    record.shaft.position
      .copy(record.position)
      .addScaledVector(record.worldDirection, length * 0.5);
    record.shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), record.worldDirection);
    record.shaft.material.uniforms.power.value =
      (0.08 * record.currentIntensity) / Math.max(record.intensity, 0.001);
    record.shaft.visible =
      motion && record.currentIntensity > 0 && (state.qualityTier == null || state.qualityTier > 0);
  }
}

function disposeRecord(record) {
  if (record.disposed) return;
  record.disposed = true;
  const records = record.scene.userData.layeredLights;
  if (records) records.splice(records.indexOf(record), 1);
  if (record.pool) {
    const pools = record.scene.userData.localLightPools || [];
    pools.splice(pools.indexOf(record.pool), 1);
  }
  if (record.sourceVisual && record.ownsSourceVisual) {
    record.sourceVisual.removeFromParent();
    record.sourceVisual.geometry.dispose();
    record.sourceVisual.material.dispose();
  }
  record.sourceVisual = undefined;
  for (const mesh of [record.patch, record.shaft]) {
    if (!mesh) continue;
    mesh.removeFromParent();
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  record.patch = undefined;
  record.shaft = undefined;
}

export function updateLayeredLighting(scene, time = 0, state = {}) {
  if (!scene.userData.layeredReceiverMeshes)
    scene.userData.layeredReceiverMeshes = collectReceiverMeshes(scene);
  const records = scene.userData.layeredLights || [];
  const viewer = state.viewerPosition;
  const visiblePatterns = new Set(
    records
      .filter((record) => record.patch)
      .sort((a, b) =>
        viewer ? a.position.distanceToSquared(viewer) - b.position.distanceToSquared(viewer) : 0,
      )
      .slice(0, MAX_VISIBLE_PATTERN_MESHES),
  );
  const receiverFrame = { updated: false };
  for (const record of records)
    record.update(time, {
      ...state,
      receiverFrame,
      showPattern: record.patch ? visiblePatterns.has(record) : false,
    });
}

/** Call after adding or replacing receiver geometry in an already running scene. */
export function invalidateLayeredReceivers(scene) {
  delete scene.userData.layeredReceiverMeshes;
  for (const record of scene.userData.layeredLights || []) {
    record.receiver = null;
    record.receiverObject = null;
    record.receiverSourcePosition = null;
  }
}

function collectReceiverMeshes(scene) {
  const meshes = [];
  scene.traverse((object) => {
    if (
      !object.isMesh ||
      !object.geometry ||
      object.userData.skipBake ||
      object.userData.excludeFromReflectionProbe
    )
      return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const name = `${object.name} ${materials.map((material) => material?.name || "").join(" ")}`;
    if (
      /sky|water|ocean|sea|glow|light|effect|particle|kart|vehicle|racer|sprite/i.test(name) ||
      object.userData.isWater ||
      object.userData.waterSurface ||
      materials.length === 0 ||
      materials.some(
        (material) =>
          !material ||
          material.isMeshBasicMaterial ||
          material.isShaderMaterial ||
          material.transparent ||
          (material.emissive?.getHex?.() !== 0 && (material.emissiveIntensity || 0) > 0.5),
      )
    )
      return;
    meshes.push(object);
  });
  return meshes;
}

function findReceiver(record, state) {
  if (state.resolveReceivers === false) return null;
  record.receiverObject?.updateWorldMatrix(true, false);
  if (
    !state.resolveReceivers &&
    record.receiverSourcePosition?.equals(record.position) &&
    record.receiverSourceDirection?.equals(record.worldDirection) &&
    (!record.receiverObject || record.receiverObject.matrixWorld.equals(record.receiverMatrix))
  )
    return record.receiver;
  const raycaster = new THREE.Raycaster(
    record.position,
    record.worldDirection,
    0.02,
    record.radius * 4,
  );
  // Several moving lights can need fresh rays in one frame. Refresh receiver
  // transforms once for the whole lighting update, not once per light.
  if (!state.receiverFrame?.updated) {
    record.scene.updateMatrixWorld();
    if (state.receiverFrame) state.receiverFrame.updated = true;
  }
  const intersections = raycaster.intersectObjects(
    record.scene.userData.layeredReceiverMeshes || [],
    false,
  );
  for (const hit of intersections) {
    const object = hit.object;
    if (
      object === record.sourceVisual ||
      object.userData.skipBake ||
      object.userData.excludeFromReflectionProbe
    )
      continue;
    const normal = hit.face?.normal?.clone() || record.worldDirection.clone().negate();
    normal.applyMatrix3(new THREE.Matrix3().getNormalMatrix(object.matrixWorld)).normalize();
    record.receiver = { point: hit.point.clone(), normal };
    record.receiverSourcePosition = record.position.clone();
    record.receiverSourceDirection = record.worldDirection.clone();
    record.receiverObject = object;
    record.receiverMatrix = object.matrixWorld.clone();
    return record.receiver;
  }
  record.receiver = null;
  record.receiverSourcePosition = record.position.clone();
  record.receiverSourceDirection = record.worldDirection.clone();
  record.receiverObject = null;
  record.receiverMatrix = null;
  return null;
}
