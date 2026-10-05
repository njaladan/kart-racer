import * as THREE from "../../vendor/three/three.module.js";

// A single sky pass supplies layered clouds, the celestial disk and atmospheric
// scattering. All movement is driven by the race clock, never wall-clock time.
export function addGradientSky(scene, theme = {}) {
  const night = theme.terrain === "concrete",
    desert = theme.terrain === "sand";
  const uniforms = {
    zenith: { value: new THREE.Color(theme.sky || "#56ace2") },
    horizon: { value: new THREE.Color(theme.fog || "#c2e1e6") },
    cloudLight: { value: new THREE.Color(night ? "#4f6482" : "#fff7e8") },
    cloudShade: { value: new THREE.Color(night ? "#202c48" : desert ? "#cdbfa9" : "#9ebbcf") },
    celestial: { value: new THREE.Color(night ? "#d5e8ff" : "#fff3c5") },
    sunDirection: { value: new THREE.Vector3(-65, 95, 45).normalize() },
    time: { value: 0 },
    night: { value: night ? 1 : 0 },
    cloudCover: { value: desert ? 0.3 : night ? 0.5 : 0.68 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      uniforms,
      vertexShader: `varying vec3 direction;
      void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform vec3 zenith,horizon,cloudLight,cloudShade,celestial,sunDirection;
      uniform float time,night,cloudCover; varying vec3 direction;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
      float cloud(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.01)*.15;}
      void main(){
        vec3 d=normalize(direction); float h=max(0.,d.y);
        vec3 color=mix(horizon,zenith,pow(h,.52));
        float sun=max(0.,dot(d,sunDirection));
        float halo=pow(sun,48.)*.22+pow(sun,8.)*.055;
        color+=celestial*halo*mix(1.,.38,night);
        float disk=smoothstep(.99915,.9996,sun);
        color=mix(color,celestial,disk*.95);
        // The night disk has a mottled, softly lit lunar surface.
        color-=vec3(disk*night*noise(d.xz*310.)*.16);
        vec2 cp=d.xz/(max(d.y,.04)+.24)*2.6+vec2(time*.004,time*.0015);
        float field=cloud(cp);
        float density=smoothstep(.6-cloudCover*.17,.79-cloudCover*.2,field);
        density*=smoothstep(.015,.16,h)*(1.-smoothstep(.8,1.,h))*.88;
        vec3 clouds=mix(cloudShade,cloudLight,smoothstep(.35,.68,field));
        clouds+=celestial*pow(sun,12.)*.08;
        color=mix(color,clouds,density);
        if(night>.5){
          vec2 stars=d.xz/(h+.35)*360.; vec2 cell=floor(stars); vec2 local=fract(stars)-.5;
          float star=(1.-smoothstep(.035,.12,length(local)))*step(.994,hash(cell));
          color+=vec3(.72,.83,1.)*star*smoothstep(.08,.3,h)*(1.-density)*(.7+.3*sin(time*.4+hash(cell)*60.));
        }
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`,
    }),
  );
  sky.name = "Layered painted sky, drifting clouds and sun or moon";
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  sky.onBeforeRender = (_renderer, _scene, camera) => {
    sky.position.copy(camera.position);
    sky.updateMatrixWorld();
  };
  scene.add(sky);
  return {
    mesh: sky,
    update(time) {
      uniforms.time.value = time;
    },
  };
}
