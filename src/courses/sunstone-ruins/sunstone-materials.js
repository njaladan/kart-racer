import { patchMaterial } from "../../rendering/surface-detail.js";

// Derivative relief keeps joints in the lighting, with no tessellation or maps.
function addStoneRelief(shader, height) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <normal_fragment_maps>",
    `#include <normal_fragment_maps>
    vec3 stoneDx=dFdx(-vViewPosition),stoneDy=dFdy(-vViewPosition);
    vec3 stoneRx=cross(stoneDy,normal),stoneRy=cross(normal,stoneDx);
    float stoneDet=dot(stoneDx,stoneRx);
    normal=normalize(abs(stoneDet)*normal-sign(stoneDet)*
      (dFdx(${height})*stoneRx+dFdy(${height})*stoneRy));`,
  );
}

/** Carved sandstone uses world-space strata, seams and weathering at every LOD. */
export function carvedSandstone(material, { scale = 1, carved = false } = {}) {
  return patchMaterial(material, `sunstone-carving-v2-${scale}-${carved}`, (shader) => {
    shader.vertexShader = `varying vec3 vSunstone,vStoneAxis;\n${shader.vertexShader}`;
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
    vSunstone=(modelMatrix*sandstonePosition).xyz;
    vStoneAxis=normalize(mat3(modelMatrix)*objectNormal);`,
    );
    shader.fragmentShader = `varying vec3 vSunstone,vStoneAxis;
    float sandstoneHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
    vec3 sp=vSunstone*${scale.toFixed(3)};
    float strata=sin(sp.y*2.1+sin(sp.x*.045)*1.2+sin(sp.z*.035));
    float grain=sandstoneHash(floor(sp*18.));
    diffuseColor.rgb*=.92+strata*.065+grain*.09;
    float stoneRelief=strata*.025;
    ${
      carved
        ? `vec3 stoneAxis=abs(vStoneAxis);
      vec2 blockP=stoneAxis.y>max(stoneAxis.x,stoneAxis.z)?sp.xz:
        (stoneAxis.x>stoneAxis.z?sp.zy:sp.xy);
      blockP/=vec2(3.8,2.1);
      blockP.x+=mod(floor(blockP.y),2.)*.5;
      vec2 stoneCell=floor(blockP),stoneUv=fract(blockP);
      vec2 stoneEdge=min(stoneUv,1.-stoneUv);
      float stoneAA=max(fwidth(blockP.x),fwidth(blockP.y));
      float chip=sin(blockP.x*63.+sin(blockP.y*19.))*sin(blockP.y*47.)*.004;
      float joint=smoothstep(.012,.035+stoneAA,min(stoneEdge.x,stoneEdge.y)+chip);
      float blockTone=.86+sandstoneHash(vec3(stoneCell,0.))*.22;
      diffuseColor.rgb*=mix(.42,blockTone,joint);
      stoneRelief+=joint*.075;`
        : ""
    }
   `,
    );
    addStoneRelief(shader, "stoneRelief");
  });
}

/** Route-space paving: worn individual blocks, engraved joints and grain.
 * The ribbon UVs are measured in metres, so the pattern follows every bend.
 */
export function templePaving(material, { ceremonial = false } = {}) {
  return patchMaterial(material, `temple-paving-v2-${ceremonial}`, (shader) => {
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
      float chippedEdge=sin(vTempleFloor.x*39.+sin(vTempleFloor.y*7.))*sin(vTempleFloor.y*29.)*.004;
      float mortar=smoothstep(.012,.038+pavingAA,min(pavingEdge.x,pavingEdge.y)+chippedEdge);
      float tileTone=.83+pavingHash(pavingCell)*.24;
      float fineGrain=pavingHash(floor(vTempleFloor*31.));
      float pavingWeather=pavingHash(floor(vTempleFloor*2.7));
      float pavingRelief=mortar*.065+sin(vTempleFloor.x*3.1)*sin(vTempleFloor.y*2.3)*.008;
      diffuseColor.rgb*=mix(.28,tileTone,mortar)*(.91+pavingWeather*.10+fineGrain*.04);
      float moss=(1.-mortar)*smoothstep(.53,.78,pavingHash(pavingCell+19.));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.19,.08),moss*.58);
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
    addStoneRelief(shader, "pavingRelief");
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
