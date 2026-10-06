import { patchMaterial } from "../../rendering/surface-detail.js";

/** Carved sandstone uses world-space strata, seams and weathering at every LOD. */
export function carvedSandstone(material, { scale = 1, carved = false } = {}) {
  return patchMaterial(material, `sunstone-carving-${scale}-${carved}`, (shader) => {
    shader.vertexShader = `varying vec3 vSunstone;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
    vec4 sandstonePosition=vec4(transformed,1.);
    #ifdef USE_BATCHING
     sandstonePosition=batchingMatrix*sandstonePosition;
    #endif
    #ifdef USE_INSTANCING
     sandstonePosition=instanceMatrix*sandstonePosition;
    #endif
    vSunstone=(modelMatrix*sandstonePosition).xyz;`,
    );
    shader.fragmentShader = `varying vec3 vSunstone;
    float sandstoneHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
    vec3 sp=vSunstone*${scale.toFixed(3)};
    float strata=sin(sp.y*2.1+sin(sp.x*.045)*1.2+sin(sp.z*.035));
    float grain=sandstoneHash(floor(sp*18.));
    diffuseColor.rgb*=.92+strata*.065+grain*.09;
    ${
      carved
        ? `float blockY=abs(fract(sp.y/2.6)-.5);
      float jointY=1.-smoothstep(.474,.496,blockY);
      float jointX=1.-smoothstep(.48,.495,abs(fract((sp.x+sp.z)/4.+floor(sp.y/2.6)*.5)-.5));
      diffuseColor.rgb*=mix(.56,1.,jointY*jointX);`
        : ""
    }
   `,
    );
  });
}

/** Route-space paving: worn individual blocks, engraved joints and grain.
 * The ribbon UVs are measured in metres, so the pattern follows every bend.
 */
export function templePaving(material, { ceremonial = false } = {}) {
  return patchMaterial(material, `temple-paving-${ceremonial}`, (shader) => {
    shader.vertexShader = `varying vec2 vTempleFloor;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvTempleFloor=uv*8.;",
    );
    shader.fragmentShader = `varying vec2 vTempleFloor;
      float pavingHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec2 pavingP=vTempleFloor/vec2(2.2,3.1);
      pavingP.x+=mod(floor(pavingP.y),2.)*.5;
      vec2 pavingCell=floor(pavingP), pavingUv=fract(pavingP);
      vec2 pavingEdge=min(pavingUv,1.-pavingUv);
      float pavingAA=max(fwidth(pavingP.x),fwidth(pavingP.y));
      float mortar=smoothstep(.006,.022+pavingAA,min(pavingEdge.x,pavingEdge.y));
      float tileTone=.83+pavingHash(pavingCell)*.24;
      float fineGrain=pavingHash(floor(vTempleFloor*31.));
      diffuseColor.rgb*=mix(.39,tileTone,mortar)*(.96+fineGrain*.08);
      ${
        ceremonial
          ? `float border=abs(abs(vTempleFloor.x)-7.8);
        float band=1.-smoothstep(.38,.46,border);
        float lozenge=step(.46,abs(fract(vTempleFloor.y/2.)-.5)+border*.55);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.20,.34,.32),band*.68);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.74,.48,.16),band*lozenge*.68);`
          : ""
      }
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nroughnessFactor=mix(.97,.74+pavingHash(pavingCell)*.15,mortar);",
    );
  });
}

/** Depth-tested sunlight shafts; a few planes replace a volumetric march. */
export function sunShaft(THREE, { width = 4, height = 19, length = 12, color = "#ffe0a0" } = {}) {
  const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { shaftColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform vec3 shaftColor;void main(){float edge=sin(vUv.x*3.14159);float fade=pow(sin(vUv.y*3.14159),.7);gl_FragColor=vec4(shaftColor,edge*edge*fade*.08);}`,
  });
  const group = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.y = (i * Math.PI) / 3;
    plane.position.z = (i - 1) * length * 0.18;
    plane.castShadow = false;
    group.add(plane);
  }
  group.rotation.z = -0.3;
  return group;
}
