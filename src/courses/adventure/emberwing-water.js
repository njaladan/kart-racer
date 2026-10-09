/** Calm graphic water: broad turquoise bands and slow white wave curls. */
export function emberwingWater(w, { y = -10, size = 2200 } = {}) {
  const { THREE, mesh, scenery, motion } = w;
  const clock = { value: 0 };
  const material = new THREE.ShaderMaterial({
    name: "Peaceful cel-shaded island water",
    fog: true,
    uniforms: { ...THREE.UniformsLib.fog, seaClock: clock },
    vertexShader: `varying vec2 seaXZ;
      #include <fog_pars_vertex>
      void main(){vec4 world=modelMatrix*vec4(position,1.);seaXZ=world.xz;
      vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float seaClock;varying vec2 seaXZ;
      #include <fog_pars_fragment>
      void main(){
      float swell=sin(seaXZ.x*.035+sin(seaXZ.y*.045)+seaClock*.22);
      vec3 sea=mix(vec3(.035,.33,.48),vec3(.08,.52,.61),smoothstep(-.15,-.05,swell));
      sea=mix(sea,vec3(.14,.65,.67),smoothstep(.68,.75,swell)*.45);
      vec2 cell=fract((seaXZ+vec2(seaClock*.65,seaClock*.18))/22.)-.5;
      float curl=length(cell*vec2(1.,1.65));
      float line=(1.-smoothstep(.008,.023,abs(curl-.28)))*smoothstep(-.05,.07,cell.y)*(1.-smoothstep(.1,.28,abs(cell.x)));
      sea=mix(sea,vec3(.73,.93,.9),line*.8);
      gl_FragColor=vec4(sea,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`,
  });
  const sea = mesh(new THREE.PlaneGeometry(size, size), material, scenery, [0, y, 0]);
  sea.name = "Peaceful cel-shaded island water";
  sea.rotation.x = -Math.PI / 2;
  sea.castShadow = false;
  sea.receiveShadow = false;
  sea.userData.skipBake = true;
  motion(sea, (time, state) => {
    clock.value = state?.motionEnabled === false ? 0 : time;
  });
  return sea;
}
