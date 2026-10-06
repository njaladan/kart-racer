import { patchMaterial } from "../../rendering/surface-detail.js";

/** Original masonry/metal weathering, in world space for merged scenery. */
export function architecturalDetail(material, kind = "masonry") {
  return patchMaterial(material, `architecture-${kind}`, (shader) => {
    shader.vertexShader = `varying vec3 vArchitecture;\n${shader.vertexShader}`.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
      vec4 ap=vec4(transformed,1.);
      #ifdef USE_BATCHING
        ap=batchingMatrix*ap;
      #endif
      #ifdef USE_INSTANCING
        ap=instanceMatrix*ap;
      #endif
      vArchitecture=(modelMatrix*ap).xyz;`,
    );
    shader.fragmentShader = `varying vec3 vArchitecture;
      float architectureHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec2 ac=vec2(vArchitecture.x+vArchitecture.z,vArchitecture.y)/vec2(3.,1.5);
      ac.x+=mod(floor(ac.y),2.)*.5;
      vec2 ae=min(fract(ac),1.-fract(ac));
      float joint=smoothstep(.007,.026+max(fwidth(ac.x),fwidth(ac.y)),min(ae.x,ae.y));
      ${
        kind === "masonry"
          ? "diffuseColor.rgb*=mix(.55,.88+architectureHash(floor(ac))*.22,joint);"
          : "float patina=architectureHash(floor(vArchitecture.xz*.4));diffuseColor.rgb*=.88+patina*.17;"
      }
      `,
    );
  });
}

/** Stamped deck plates: metre-based UVs follow the road instead of world axes. */
export function metalDeckDetail(material) {
  return patchMaterial(material, "metal-deck-plates", (shader) => {
    shader.vertexShader = `varying vec2 vDeck;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvDeck=uv*8.;",
    );
    shader.fragmentShader = `varying vec2 vDeck;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec2 dc=vDeck/vec2(2.6,4.);
      vec2 de=min(fract(dc),1.-fract(dc));
      float join=smoothstep(.008,.022+max(fwidth(dc.x),fwidth(dc.y)),min(de.x,de.y));
      float hatch=sin(vDeck.x*15.+vDeck.y*15.)*sin(vDeck.x*15.-vDeck.y*15.);
      float stamping=smoothstep(.45,.75,hatch);
      float brass=1.-smoothstep(.07,.13,abs(abs(vDeck.x)-8.8));
      diffuseColor.rgb*=mix(.37,.91+stamping*.13,join);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.58,.37,.14),brass*.8);`,
    );
  });
}
