import { patchMaterial } from "../../rendering/surface-detail.js";
/** Crisp route-space planks and glazed kitchen tiles at driving-camera scale. */
export function kitchenRoadDetail(material, tiles = false) {
  patchMaterial(material, tiles ? "pantry-tiles" : "pantry-planks", (shader) => {
    shader.vertexShader = `varying vec2 vKitchen;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvKitchen=uv;",
    );
    shader.fragmentShader = `varying vec2 vKitchen;\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      tiles
        ? `#include <color_fragment>
      vec2 cells=vKitchen*2.;
      vec2 edge=min(fract(cells),1.-fract(cells));
      float grout=smoothstep(.012,.035+max(fwidth(cells.x),fwidth(cells.y)),min(edge.x,edge.y));
      float checker=mod(floor(cells.x)+floor(cells.y),2.);
      diffuseColor.rgb=mix(vec3(.19,.36,.34),diffuseColor.rgb,checker*.32+.68)*mix(.45,1.,grout);`
        : `#include <color_fragment>
      vec2 cells=vKitchen*vec2(3.,.6);
      cells.y+=mod(floor(cells.x),2.)*.5;
      vec2 edge=min(fract(cells),1.-fract(cells));
      float seam=smoothstep(.003,.012+max(fwidth(cells.x),fwidth(cells.y)),min(edge.x,edge.y));
      float grain=sin(vKitchen.y*73.+sin(vKitchen.x*31.)*3.);
      diffuseColor.rgb*=mix(.5,.94+grain*.035,seam);`,
    );
  });
}
