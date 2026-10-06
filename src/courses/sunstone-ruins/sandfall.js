/** Four shared shader ribbons carry sand downward without a particle emitter. */
export function createSandfall(THREE) {
  const time = { value: 0 };
  const geometry = new THREE.PlaneGeometry(7, 29, 12, 24);
  // Include the shader's widening and flutter in CPU-side frustum bounds.
  geometry.computeBoundingBox();
  geometry.boundingBox.expandByScalar(0.52);
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { sandTime: time, sandColor: { value: new THREE.Color("#ecc680") } },
    vertexShader: `uniform float sandTime;varying vec2 vSandUv;
      void main(){
        vSandUv=uv;vec3 p=position;
        float descent=1.-uv.y;
        p.x*=.72+descent*.38;
        p.x+=sin(uv.y*9.+sandTime*1.1)*descent*.16;
        p.z+=sin(uv.x*19.+uv.y*8.-sandTime*2.)*descent*.18;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `uniform float sandTime;uniform vec3 sandColor;varying vec2 vSandUv;
      float sandHash(float p){return fract(sin(p*127.1)*43758.5453);}
      void main(){
        float x=vSandUv.x*43.;
        float strand=floor(x),seed=sandHash(strand);
        float center=.5+sin(vSandUv.y*17.+seed*6.+sandTime)*.12;
        float aa=max(fwidth(x),.025);
        float thread=1.-smoothstep(.09,.24+aa,abs(fract(x)-center));
        float falling=fract(vSandUv.y*(17.+seed*11.)+sandTime*(2.4+seed*1.5)+seed);
        float grains=smoothstep(.15,.3,falling)*(1.-smoothstep(.55,.9,falling));
        float edge=smoothstep(0.,.12,vSandUv.x)*(1.-smoothstep(.88,1.,vSandUv.x));
        float ends=smoothstep(0.,.08,vSandUv.y)*(1.-smoothstep(.94,1.,vSandUv.y));
        float alpha=thread*(.16+grains*.5)*edge*ends;
        gl_FragColor=vec4(sandColor*(.78+seed*.22+grains*.13),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return { geometry, material, update: (seconds) => (time.value = seconds) };
}
