import { createWaterMaterial, patchMaterial } from "../../rendering/surface-detail.js";

/** Refracted scenery remains readable on the dive; the underside has Snell's window. */
export function glasshouseWater(scene) {
  const material = createWaterMaterial({
    scene,
    color: "#effff9",
    roughness: 0.075,
    foam: false,
    transmission: 1,
    thickness: 3,
    ior: 1.333,
    attenuationColor: "#8dd9cb",
    attenuationDistance: 65,
  });
  material.name = "Clear refractive Pelagic seawater";
  material.forceSinglePass = true;
  patchMaterial(material, "pelagic-water-interface-v1", (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <transmission_fragment>",
      `// Snell's law uses the inverse index when looking out from underwater.
      // Skip refraction outside its critical angle to avoid normalizing a zero ray.
      float interfaceCos=clamp(abs(dot(normal,normalize(vViewPosition))),0.,1.);
      float eta=gl_FrontFacing?1./ior:ior;
      float transmittedSin2=eta*eta*(1.-interfaceCos*interfaceCos);
      vec3 interfaceReflection=totalSpecular;
      #ifdef USE_ENVMAP
        interfaceReflection=getIBLRadiance(normalize(vViewPosition),normal,material.roughness);
      #endif
      material.transmissionAlpha=1.;
      if(transmittedSin2<1.){
        material.ior=gl_FrontFacing?ior:1./ior;
        #include <transmission_fragment>
        if(!gl_FrontFacing){
          float transmittedCos=sqrt(1.-transmittedSin2);
          float rs=(eta*interfaceCos-transmittedCos)/(eta*interfaceCos+transmittedCos);
          float rp=(interfaceCos-eta*transmittedCos)/(interfaceCos+eta*transmittedCos);
          float interfaceReflectance=.5*(rs*rs+rp*rp);
          totalDiffuse*=1.-interfaceReflectance;
          totalSpecular=mix(totalSpecular,interfaceReflection,interfaceReflectance);
        }
      }else{
        totalDiffuse=vec3(0.);
        totalSpecular=interfaceReflection;
      }`,
    );
  });
  return material;
}

/** Analytic shallow caustics stay aligned across merged/instanced scenery and road. */
export function marineCaustics(material, scene) {
  patchMaterial(material, "underwater-caustics-v2", (shader) => {
    const clock = { value: 0 };
    (scene.userData.surfaceAnimations ||= []).push(clock);
    shader.uniforms.waterClock = clock;
    shader.vertexShader = `varying vec3 vReef;\n${shader.vertexShader}`.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\nvec4 reefWorld=vec4(transformed,1.);\n#ifdef USE_BATCHING\nreefWorld=batchingMatrix*reefWorld;\n#endif\n#ifdef USE_INSTANCING\nreefWorld=instanceMatrix*reefWorld;\n#endif\nvReef=(modelMatrix*reefWorld).xyz;",
    );
    shader.fragmentShader = `uniform float waterClock; varying vec3 vReef;
      vec2 reefHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
      float reefCaustic(vec2 p){
        vec2 cell=floor(p),local=fract(p);float nearest=8.,second=8.;
        for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
          vec2 offset=vec2(float(x),float(y)),seed=reefHash(cell+offset);
          vec2 center=.5+.3*sin(waterClock*.65+seed*6.2831853);
          float d=length(offset+center-local);
          if(d<nearest){second=nearest;nearest=d;}else second=min(second,d);
        }
        float edge=second-nearest,aa=max(fwidth(edge),.012);
        return 1.-smoothstep(.018,.065+aa,edge);
      }
      ${shader.fragmentShader}`.replace(
      "#include <opaque_fragment>",
      `vec2 reefP=(vReef.xz+vReef.y*vec2(.28,-.18))*.24;
      reefP+=vec2(sin(reefP.y*1.7+waterClock*.3),cos(reefP.x*1.4-waterClock*.25))*.24;
      float reefLight=reefCaustic(reefP);
      float reefDepth=max(0.,-vReef.y);
      // Caustics fade quickly below the shallow reef shelves; a broad spatial
      // shelter mask leaves deeper pockets dark enough to read as depth.
      float reefSubmerged=(1.-smoothstep(-.65,0.,vReef.y))*exp(-reefDepth*.032);
      float reefShelterField=.5+.5*sin(vReef.x*.012+sin(vReef.z*.019)*1.7)*sin(vReef.z*.014-vReef.x*.009);
      float reefShelter=mix(.36,1.,smoothstep(.24,.78,reefShelterField));
      vec3 reefNormal=inverseTransformDirection(normal,viewMatrix);
      float reefFacing=.3+.7*max(0.,reefNormal.y);
      float reefEnergy=reefLight*reefSubmerged*reefFacing*reefShelter;
      outgoingLight+=diffuseColor.rgb*vec3(.72,1.,.88)*reefEnergy*.72;
      #include <opaque_fragment>`,
    );
  });
}

/** Pale glazed road tiles maintain a crisp line through the moving reef light. */
export function glasshouseRoad(material, scene) {
  marineCaustics(material, scene);
  patchMaterial(material, "glasshouse-ceramic", (shader) => {
    shader.vertexShader = `varying vec2 vCeramic;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvCeramic=uv;",
    );
    shader.fragmentShader = `varying vec2 vCeramic;\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec2 tile=vCeramic*vec2(2.,1.);
      vec2 edge=min(fract(tile),1.-fract(tile));
      float seam=smoothstep(.008,.023+max(fwidth(tile.x),fwidth(tile.y)),min(edge.x,edge.y));
      diffuseColor.rgb*=mix(.64,1.,seam);`,
    );
  });
}
