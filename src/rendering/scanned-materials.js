import * as THREE from "../../vendor/three/three.module.js";
import { patchMaterial } from "./surface-detail.js";

/** Choose physical surfaces, retaining explicit artist materials and course colors. */
export function scannedMaterialKind(material, courseId = "") {
  if (material.userData.surfaceKind) return material.userData.surfaceKind;
  const textureKind = material.map?.userData?.surfaceKind;
  if (textureKind)
    return (
      {
        grass: "leaf",
        leaves: "leaf",
        needles: "leaf",
        gravel: "stone",
        paving: "stone",
        asphalt: "rubber",
        tire: "rubber",
        concrete: "stone",
        blossom: "leaf",
      }[textureKind] || textureKind
    );
  const name = material.name.toLowerCase();
  if (/wood|timber|bamboo|crust|biscuit/.test(name)) return "wood";
  if (/paper|fold|origami/.test(name)) return "paper";
  if (/cloth|fabric|velvet|drape|canvas/.test(name)) return "fabric";
  if (/snow/.test(name)) return "snow";
  if (/bark|trunk/.test(name)) return "bark";
  if (/leaf|leaves|kelp|plant/.test(name)) return "leaf";
  if (/brick/.test(name)) return "brick";
  if (/ceramic|porcelain|ivory|cup/.test(name)) return "ceramic";
  if (/tire|rubber/.test(name)) return "rubber";
  if (/rock|basalt|cliff/.test(name)) return "rock";
  if (material.metalness > 0.3) return "metal";
  const color = material.color;
  const hsl = color.getHSL({});
  if (hsl.l < 0.055) return "rubber";
  if (courseId === "paper-revel") return "paper";
  if (courseId === "frostpeak-festival" && hsl.l > 0.72 && hsl.s < 0.28) return "snow";
  if (hsl.h > 0.2 && hsl.h < 0.47 && hsl.s > 0.22) return "leaf";
  if (hsl.h < 0.14 && hsl.s > 0.2 && hsl.l < 0.62) return "wood";
  if (courseId === "sunstone-ruins") return "stone";
  if (hsl.s < 0.14 && material.roughness > 0.75) return "stone";
  return material.roughness < 0.4 ? "ceramic" : "paint";
}

/** Three shared scan atlases give bare opaque meshes albedo, relief, roughness and AO.
 * World projection works on UV-less geometry and survives regional batching.
 * Lower tiers choose one projection; High/Ultra blend three without extra draws.
 */
export function installScannedMaterials(scene, library, courseId, animated = []) {
  const movingMaterials = new Set();
  for (const root of animated)
    root.traverse((object) => {
      if (object.isMesh)
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          movingMaterials.add(material);
    });
  if (!library?.atlases) return { covered: 0, retained: 0 };
  const seen = new Set();
  const stats = { covered: 0, retained: 0 };
  scene.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (seen.has(material)) continue;
      seen.add(material);
      if (
        !material.isMeshStandardMaterial ||
        material.normalMap ||
        material.bumpMap ||
        material.userData.waterUniforms ||
        material.userData.skipSurfaceDetail ||
        (material.transparent && material.opacity < 0.65) ||
        (material.emissiveIntensity > 0.6 && material.emissive.getHSL({}).l > 0.3)
      ) {
        stats.retained++;
        continue;
      }
      const kind = scannedMaterialKind(material, courseId);
      const role = library.materials.find((entry) => entry.name === kind) || library.materials[0];
      const originalMap = material.map;
      material.map ||= library.atlases.color;
      material.normalMap = library.atlases.normal;
      material.roughnessMap = library.atlases.response;
      material.userData.scannedSurface = kind;
      const uniforms = {
        scanTile: { value: new THREE.Vector2(role.tile % 4, Math.floor(role.tile / 4)) },
        scanRepeat: { value: 1 / role.metersPerRepeat },
        scanRelief: { value: role.relief },
        scanNormalStrength: { value: Math.min(0.5, role.relief * 3) },
        scanColorMap: { value: library.atlases.color },
        scanQuality: library.quality,
        scanLocal: { value: movingMaterials.has(material) ? 1 : 0 },
      };
      patchMaterial(
        material,
        `shared-physical-scan-v1-${originalMap ? "mapped" : "bare"}`,
        (shader) => {
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = `varying vec3 vScanWorld,vScanCoords;\nuniform float scanLocal;\n${shader.vertexShader}`;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <worldpos_vertex>",
            `
          #include <worldpos_vertex>
          vec4 scanPosition=vec4(transformed,1.);
          #ifdef USE_BATCHING
            scanPosition=batchingMatrix*scanPosition;
          #endif
          #ifdef USE_INSTANCING
            scanPosition=instanceMatrix*scanPosition;
          #endif
          vScanWorld=(modelMatrix*scanPosition).xyz;
          vec3 scanScale=vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));
          vScanCoords=mix(vScanWorld,scanPosition.xyz*scanScale,scanLocal);`,
          );
          shader.fragmentShader = `
          varying vec3 vScanWorld,vScanCoords;
          uniform vec2 scanTile;
          uniform float scanRepeat,scanRelief,scanQuality,scanNormalStrength;
          uniform sampler2D scanColorMap;
          mat3 scanTangentFrame(vec3 eye,vec3 n,vec2 uv){
            vec3 q0=dFdx(eye),q1=dFdy(eye);
            vec2 st0=dFdx(uv),st1=dFdy(uv);
            vec3 t=cross(q1,n)*st0.x+cross(n,q0)*st1.x;
            vec3 b=cross(q1,n)*st0.y+cross(n,q0)*st1.y;
            float d=max(dot(t,t),dot(b,b));
            float s=d>0.?inversesqrt(d):0.;
            return mat3(t*s,b*s,n);
          }
          vec2 scanUv(vec2 uv){
            // Sixteen-pixel wrapped gutters keep tile edges continuous.
            return (scanTile+vec2(.03125)+fract(uv)*.9375)/4.;
          }
          vec4 scanSample(sampler2D atlas,vec2 uv){
            return textureGrad(atlas,scanUv(uv),dFdx(uv)*.234375,dFdy(uv)*.234375);
          }
          ${shader.fragmentShader}`;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            `
          ${originalMap ? "#include <map_fragment>" : ""}
          // Derivatives provide the actual surface orientation, including instances.
          vec3 scanFace=normalize(cross(dFdx(vScanCoords),dFdy(vScanCoords)));
          scanFace*=gl_FrontFacing?1.:-1.;
          vec3 scanWeights=pow(abs(scanFace),vec3(6.));
          scanWeights/=max(.0001,dot(scanWeights,vec3(1.)));
          if(scanQuality<.5){
            scanWeights=scanWeights.x>scanWeights.y&&scanWeights.x>scanWeights.z?vec3(1.,0.,0.):
              scanWeights.y>scanWeights.z?vec3(0.,1.,0.):vec3(0.,0.,1.);
          }
          vec2 scanX=vScanCoords.zy*scanRepeat;
          vec2 scanY=vScanCoords.xz*scanRepeat;
          vec2 scanZ=vScanCoords.xy*scanRepeat;
          vec4 scanAlbedo=vec4(0.),scanResponse=vec4(0.);
          vec3 scanNormalX=vec3(0.,0.,1.),scanNormalY=vec3(0.,0.,1.),scanNormalZ=vec3(0.,0.,1.);
          if(scanWeights.x>.001){
            scanAlbedo+=scanSample(scanColorMap,scanX)*scanWeights.x;
            scanResponse+=scanSample(roughnessMap,scanX)*scanWeights.x;
            scanNormalX=scanSample(normalMap,scanX).xyz*2.-1.;
          }
          if(scanWeights.y>.001){
            scanAlbedo+=scanSample(scanColorMap,scanY)*scanWeights.y;
            scanResponse+=scanSample(roughnessMap,scanY)*scanWeights.y;
            scanNormalY=scanSample(normalMap,scanY).xyz*2.-1.;
          }
          if(scanWeights.z>.001){
            scanAlbedo+=scanSample(scanColorMap,scanZ)*scanWeights.z;
            scanResponse+=scanSample(roughnessMap,scanZ)*scanWeights.z;
            scanNormalZ=scanSample(normalMap,scanZ).xyz*2.-1.;
          }
          diffuseColor.rgb*=mix(vec3(1.),scanAlbedo.rgb*1.12,.6);`,
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <roughnessmap_fragment>",
            "float roughnessFactor=clamp(roughness*mix(.75,1.15,scanResponse.g),.08,1.);",
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <normal_fragment_maps>",
            `
          vec3 scanMapped=vec3(0.);
          if(scanWeights.x>.001)scanMapped+=normalize(scanTangentFrame(-vViewPosition,normal,scanX)*mix(vec3(0.,0.,1.),scanNormalX,scanNormalStrength))*scanWeights.x;
          if(scanWeights.y>.001)scanMapped+=normalize(scanTangentFrame(-vViewPosition,normal,scanY)*mix(vec3(0.,0.,1.),scanNormalY,scanNormalStrength))*scanWeights.y;
          if(scanWeights.z>.001)scanMapped+=normalize(scanTangentFrame(-vViewPosition,normal,scanZ)*mix(vec3(0.,0.,1.),scanNormalZ,scanNormalStrength))*scanWeights.z;
          vec3 scanBase=inverseTransformDirection(normalize(scanMapped),viewMatrix);
          // Height relief is a pixel-level perturbation, not a changed driving floor.
          vec3 scanQ0=dFdx(vScanWorld),scanQ1=dFdy(vScanWorld);
          vec3 scanR1=cross(scanQ1,scanBase),scanR2=cross(scanBase,scanQ0);
          float scanDet=dot(scanQ0,scanR1);
          vec3 scanHeight=(dFdx(scanResponse.r)*scanR1+dFdy(scanResponse.r)*scanR2)*scanRelief;
          vec3 scanNormal=normalize(abs(scanDet)*scanBase-sign(scanDet)*scanHeight);
          normal=normalize(mat3(viewMatrix)*scanNormal);`,
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <lights_fragment_end>",
            `
          #include <lights_fragment_end>
          reflectedLight.indirectDiffuse*=mix(.7,1.,scanResponse.b);`,
          );
        },
      );
      stats.covered++;
    }
  });
  scene.userData.scannedMaterials = stats;
  return stats;
}
