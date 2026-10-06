import { patchMaterial } from "../../rendering/surface-detail.js";

/** Atlas reflections follow the road's bank and bend at every graphics tier.
 * Reuses the actual nearby sign art; static regional batches keep draws bounded.
 */
export function createRoadReflections({ THREE, scenery, track, textures }) {
  const makeMaterial = (map, opacity) =>
    new THREE.MeshBasicMaterial({
      map: map ?? null,
      color: "#b6cfe1",
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      side: THREE.DoubleSide,
    });
  const material = makeMaterial(textures.harborSigns, 0.52);
  const facades = [0, 1, 2].map((index) =>
    makeMaterial(textures[`harborFacadeEmission${index}`], 0.38),
  );
  for (const receiver of [material, ...facades])
    patchMaterial(receiver, "sign-road-reflection-v1", (shader) => {
      shader.vertexShader = `attribute vec2 reflectionUv;varying vec2 vReflectionUv;varying vec3 vReflectionWorld;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvReflectionUv=reflectionUv;vReflectionWorld=(modelMatrix*vec4(position,1.)).xyz;",
      );
      shader.fragmentShader = `varying vec2 vReflectionUv;varying vec3 vReflectionWorld;
      float reflectionHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float reflectionNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(reflectionHash(i),reflectionHash(i+vec2(1.,0.)),f.x),
          mix(reflectionHash(i+vec2(0.,1.)),reflectionHash(i+vec2(1.)),f.x),f.y);}
      ${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `vec2 reflectionWarp=vec2(sin(vReflectionWorld.x*13.+vReflectionWorld.z*8.),
        sin(vReflectionWorld.z*15.-vReflectionWorld.x*5.))*.0016;
      #ifdef USE_MAP
        diffuseColor*=texture2D(map,vMapUv+reflectionWarp);
      #endif
      float wet=reflectionNoise(vReflectionWorld.xz*vec2(.17,.31))*.8+
        reflectionNoise(vReflectionWorld.xz*.73)*.2;
      float pool=smoothstep(.40,.65,wet);
      float edge=sin(vReflectionUv.x*3.14159);
      float fade=pow(1.-vReflectionUv.y,1.3)*smoothstep(0.,.08,vReflectionUv.y);
      float grazing=1.-clamp(normalize(cameraPosition-vReflectionWorld).y,0.,1.);
      float brightness=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));
      diffuseColor.a*=pool*edge*edge*fade*(.25+grazing*.75)*smoothstep(.035,.18,brightness);`,
      );
    });
  function stamp(t, side, signIndex, width = 8.3, facade = false) {
    const positions = [],
      uv = [],
      local = [],
      indices = [];
    const rows = 12,
      columns = 4;
    for (let row = 0; row <= rows; row++) {
      const u = row / rows;
      const station = t + ((u - 0.5) * width) / track.COURSE_LENGTH;
      const surface = track.surfaceAt(station);
      const edge = side < 0 ? -surface.leftEdge : surface.rightEdge;
      for (let column = 0; column <= columns; column++) {
        const v = column / columns;
        // A sign across the pavement reflects toward the viewer, into the lane.
        const offset = side * (edge - 0.15 - v * Math.min(edge * 1.35, 13));
        const p = track.poseAt(station * track.TRACK, offset, facade ? 0.073 : 0.075).p;
        positions.push(p.x, p.y, p.z);
        if (facade) uv.push(u, 1 - v);
        else uv.push(((signIndex % 4) + u) / 4, (3 - Math.floor(signIndex / 4) + 1 - v) / 4);
        local.push(u, v);
        if (row < rows && column < columns) {
          const a = row * (columns + 1) + column;
          indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute("reflectionUv", new THREE.Float32BufferAttribute(local, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const reflection = new THREE.Mesh(geometry, facade ? facades[signIndex % 3] : material);
    reflection.name = "Rain-broken storefront reflection";
    reflection.userData.skipBake = true;
    scenery.add(reflection);
  }
  return { stamp };
}
