import * as THREE from "../../../vendor/three/three.module.js";
import { patchMaterial } from "../../rendering/surface-detail.js";
import { sceneryGroundHeight } from "../../rendering/terrain-height.js";
import { courseWind } from "../../rendering/wind-field.js";

/** Regional opaque blade instances: no cards, alpha overdraw or grass shadow pass. */
export function buildMeadowGrass({ scene, scenery, track }) {
  let seed = 93017;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const positions = [],
    colors = [],
    indices = [];
  for (let blade = 0; blade < 12; blade++) {
    const angle = random() * Math.PI * 2;
    const height = 0.25 + random() * 0.45;
    const width = 0.028 + random() * 0.032;
    const x = Math.cos(angle) * random() * 0.55;
    const z = Math.sin(angle) * random() * 0.55;
    const dx = Math.cos(angle) * width;
    const dz = Math.sin(angle) * width;
    const leanX = Math.sin(angle) * 0.16;
    const leanZ = Math.cos(angle) * 0.16;
    const offset = positions.length / 3;
    positions.push(
      x - dx,
      0,
      z - dz,
      x + dx,
      0,
      z + dz,
      x - dx * 0.55 + leanX * 0.35,
      height * 0.55,
      z - dz * 0.55 + leanZ * 0.35,
      x + dx * 0.55 + leanX * 0.35,
      height * 0.55,
      z + dz * 0.55 + leanZ * 0.35,
      x + leanX,
      height,
      z + leanZ,
    );
    colors.push(0.48, 0.58, 0.35, 0.48, 0.58, 0.35, 0.82, 0.9, 0.7, 0.82, 0.9, 0.7, 1, 1, 0.9);
    indices.push(
      offset,
      offset + 1,
      offset + 2,
      offset + 1,
      offset + 3,
      offset + 2,
      offset + 2,
      offset + 3,
      offset + 4,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: "#70994f",
    roughness: 1,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  material.name = "Meadow grass: shaded roots and sunlit tips";
  material.userData.skipSurfaceDetail = true;
  const uniforms = {
    meadowTime: { value: 0 },
    meadowWind: { value: new THREE.Vector3(...courseWind(track.course.theme)) },
    meadowRange: { value: new THREE.Vector2(55, 85) },
    meadowBakeMap: { value: null },
    meadowBakeBounds: { value: new THREE.Vector4() },
    meadowBakeEnabled: { value: 0 },
  };
  patchMaterial(material, "meadow-blade-wind-and-baked-light-v1", (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform float meadowTime;uniform vec3 meadowWind;
      uniform vec2 meadowRange;varying vec3 vMeadowWorld;varying float vMeadowTip;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      vec4 meadowRoot=vec4(0.,0.,0.,1.);
      #ifdef USE_INSTANCING
        meadowRoot=instanceMatrix*meadowRoot;
      #endif
      meadowRoot=modelMatrix*meadowRoot;
      float meadowDistance=length(cameraPosition-meadowRoot.xyz);
      float meadowFade=1.-smoothstep(meadowRange.x,meadowRange.y,meadowDistance);
      float meadowPhase=dot(meadowRoot.xz,vec2(.21,.17));
      float meadowSway=sin(meadowTime*1.8+meadowPhase)*.07+sin(meadowTime*.63+meadowPhase*.7)*.045;
      transformed.xz+=meadowWind.xz*meadowSway*position.y*position.y;
      transformed.y*=meadowFade;
      vMeadowTip=clamp(position.y,0.,1.);`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `
      #include <worldpos_vertex>
      vec4 meadowPosition=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        meadowPosition=instanceMatrix*meadowPosition;
      #endif
      vMeadowWorld=(modelMatrix*meadowPosition).xyz;`,
    );
    shader.fragmentShader = `varying vec3 vMeadowWorld;varying float vMeadowTip;
      uniform sampler2D meadowBakeMap;uniform vec4 meadowBakeBounds;
      uniform float meadowBakeEnabled;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_end>",
      `
      #include <lights_fragment_end>
      if(meadowBakeEnabled>.5){
        vec2 meadowUv=(vMeadowWorld.xz-meadowBakeBounds.xy)/meadowBakeBounds.zw;
        vec4 meadowLight=texture2D(meadowBakeMap,meadowUv);
        reflectedLight.indirectDiffuse*=meadowLight.a;
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*meadowLight.rgb*.65;
      }
      // Thin blades transmit a little sky light; the vertex gradient keeps roots dark.
      reflectedLight.indirectDiffuse+=diffuseColor.rgb*vMeadowTip*.12;`,
    );
  });
  const cells = new Map();
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3();
  const locations = [];
  // Dense foreground in Blossom Common, with matching meadow at the finish.
  for (const sectionIndex of [0, 5, 7]) {
    const section = track.SECTIONS[sectionIndex];
    const length = (section.end - section.start) * track.COURSE_LENGTH;
    const stations = Math.ceil(length / (sectionIndex === 0 ? 1.7 : 2.7));
    for (let station = 0; station < stations; station++)
      for (const side of [-1, 1])
        for (let row = 0; row < 11; row++) {
          const t = track.sectorT(sectionIndex, (station + random()) / stations);
          const surface = track.surfaceAt(t);
          const edge = side > 0 ? surface.rightEdge : -surface.leftEdge;
          const offset = side * (edge + 1.85 + row * 2.25 + random() * 1.7);
          const pose = track.poseAt(t * track.TRACK, offset, 0);
          let near = track.projectTrack(pose.p, t * track.TRACK, true);
          const physical = near.offset > 0 ? near.rightEdge : -near.leftEdge;
          if (near.distance < physical + 0.7) continue;
          if (
            (track.branches || []).some(
              (branch) => branch.project(pose.p, t, true).distance < branch.halfWidth + 1,
            )
          )
            continue;
          pose.p.y = sceneryGroundHeight(near) - 0.025;
          // Lowering a plant from road height can select a different nearby
          // embankment. Resolve the planted position, not just the road pose.
          for (let step = 0; step < 4; step++) {
            near = track.projectTrack(pose.p, t * track.TRACK, true);
            const height = sceneryGroundHeight(near) - 0.025;
            if (Math.abs(height - pose.p.y) < 0.000001) break;
            pose.p.y = height;
          }
          const finalEdge = near.offset > 0 ? near.rightEdge : -near.leftEdge;
          if (near.distance < finalEdge + 1.1) continue;
          const key = `${Math.floor(pose.p.x / 32)},${Math.floor(pose.p.z / 32)}`;
          if (!cells.has(key)) cells.set(key, []);
          rotation.setFromAxisAngle(up, random() * Math.PI * 2);
          const size = 0.65 + random() * 0.75;
          scale.set(size, size * (row === 0 ? 0.55 : 1), size);
          matrix.compose(pose.p, rotation, scale);
          cells.get(key).push({ matrix: matrix.clone(), tint: 0.82 + random() * 0.3 });
          locations.push(pose.p.clone());
        }
  }
  const meshes = [];
  const tint = new THREE.Color();
  for (const entries of cells.values()) {
    // Shuffle within each cell so reducing instance count keeps an even meadow.
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    mesh.name = "Regional living meadow grass";
    mesh.userData.skipBake = true;
    mesh.userData.meadowGrass = true;
    mesh.userData.fullCount = entries.length;
    entries.forEach((entry, i) => {
      mesh.setMatrixAt(i, entry.matrix);
      mesh.setColorAt(i, tint.setRGB(entry.tint, entry.tint, entry.tint * 0.96));
    });
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    // Account for wind displacement in the frustum bounds.
    mesh.boundingBox.expandByScalar(0.25);
    mesh.boundingSphere.radius += 0.25;
    scenery.add(mesh);
    meshes.push(mesh);
  }
  // Small daisies share one draw across the valley. Vertex colors separate
  // pale petals, warm centers and green stems without another texture atlas.
  const flowerPositions = [],
    flowerColors = [];
  const triangle = (a, b, c, color) => {
    flowerPositions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) flowerColors.push(...color);
  };
  const stem = [0.2, 0.35, 0.08],
    petal = [0.86, 0.86, 0.7],
    center = [0.85, 0.48, 0.035];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3,
      b = ((i + 1) * Math.PI) / 3;
    const baseA = [Math.cos(a) * 0.012, 0, Math.sin(a) * 0.012];
    const baseB = [Math.cos(b) * 0.012, 0, Math.sin(b) * 0.012];
    const topA = [baseA[0], 0.48, baseA[2]],
      topB = [baseB[0], 0.48, baseB[2]];
    triangle(baseA, baseB, topA, stem);
    triangle(baseB, topB, topA, stem);
    const tip = [Math.cos(a) * 0.18, 0.48, Math.sin(a) * 0.18];
    const left = [Math.cos(a - 0.35) * 0.095, 0.51, Math.sin(a - 0.35) * 0.095];
    const right = [Math.cos(a + 0.35) * 0.095, 0.51, Math.sin(a + 0.35) * 0.095];
    triangle([0, 0.5, 0], left, tip, petal);
    triangle([0, 0.5, 0], tip, right, petal);
    triangle(
      [0, 0.525, 0],
      [Math.cos(a) * 0.045, 0.51, Math.sin(a) * 0.045],
      [Math.cos(b) * 0.045, 0.51, Math.sin(b) * 0.045],
      center,
    );
  }
  const flowerGeometry = new THREE.BufferGeometry();
  flowerGeometry.setAttribute("position", new THREE.Float32BufferAttribute(flowerPositions, 3));
  flowerGeometry.setAttribute("color", new THREE.Float32BufferAttribute(flowerColors, 3));
  flowerGeometry.computeVertexNormals();
  const flowerMaterial = material.clone();
  flowerMaterial.color.set("#ffffff");
  flowerMaterial.onBeforeCompile = material.onBeforeCompile;
  flowerMaterial.customProgramCacheKey = material.customProgramCacheKey;
  const flowerLocations = locations.filter((_p, i) => i % 17 === 0);
  const flowers = new THREE.InstancedMesh(flowerGeometry, flowerMaterial, flowerLocations.length);
  flowers.name = "Meadow daisies with stems, petals and pollen centers";
  flowers.userData.skipBake = true;
  flowers.userData.fullCount = flowerLocations.length;
  for (let i = 0; i < flowerLocations.length; i++) {
    rotation.setFromAxisAngle(up, random() * Math.PI * 2);
    scale.setScalar(0.85 + random() * 0.4);
    matrix.compose(flowerLocations[i], rotation, scale);
    flowers.setMatrixAt(i, matrix);
  }
  flowers.receiveShadow = true;
  flowers.computeBoundingBox();
  flowers.computeBoundingSphere();
  flowers.boundingBox.expandByScalar(0.25);
  flowers.boundingSphere.radius += 0.25;
  scenery.add(flowers);
  meshes.push(flowers);
  return {
    meshes,
    locations,
    uniforms,
    update(time, state = {}) {
      uniforms.meadowTime.value = state.motionEnabled === false || state.bake ? 0 : time;
      const bake = scene.userData.courseBakeUniforms;
      uniforms.meadowBakeEnabled.value = bake?.courseBakeEnabled.value ?? 0;
      if (bake) {
        uniforms.meadowBakeMap.value = bake.courseBakeMap.value;
        uniforms.meadowBakeBounds.value.copy(bake.courseBakeBounds.value);
      }
    },
    setQuality(tier) {
      const density = [0.35, 0.55, 0.8, 1][tier];
      for (const mesh of meshes) mesh.count = Math.ceil(mesh.userData.fullCount * density);
      uniforms.meadowRange.value.set(tier < 2 ? 35 : 55, tier < 2 ? 60 : 85);
    },
  };
}
