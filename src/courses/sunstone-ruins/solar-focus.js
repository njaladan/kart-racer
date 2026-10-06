import { solarLaneAt } from "../../simulation/course-mechanics.js";

/** A single open cone per lens connects its core to the authoritative lane. */
export function createSolarFocus({ THREE, track, kit, t, index, pad, sourceGroup, scenery }) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { focusColor: { value: new THREE.Color("#ffd487") } },
    vertexShader: `varying vec2 vFocusUv;void main(){
      vFocusUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`,
    fragmentShader: `uniform vec3 focusColor;varying vec2 vFocusUv;void main(){
      float ends=smoothstep(0.,.07,vFocusUv.y)*(1.-smoothstep(.94,1.,vFocusUv.y));
      float strand=pow(.5+.5*cos(vFocusUv.x*75.3982),8.);
      gl_FragColor=vec4(focusColor,ends*(.035+strand*.035));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.9, 1, 24, 1, true), material);
  beam.name = `Solar focus beam ${index + 1}`;
  beam.castShadow = beam.receiveShadow = false;
  scenery.add(beam);
  sourceGroup.updateWorldMatrix(true, false);
  const source = sourceGroup.localToWorld(new THREE.Vector3(0, 19, 0));
  const direction = new THREE.Vector3(),
    target = new THREE.Vector3(),
    axis = new THREE.Vector3(0, 1, 0);
  const footprint = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 32),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { focusColor: material.uniforms.focusColor },
      vertexShader: material.vertexShader,
      fragmentShader: `uniform vec3 focusColor;varying vec2 vFocusUv;void main(){
        float radius=length(vFocusUv-.5)*2.;
        float glow=(1.-smoothstep(.15,1.,radius))*.22;
        gl_FragColor=vec4(focusColor,glow);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  );
  footprint.name = `Solar focus footprint ${index + 1}`;
  footprint.rotation.x = -Math.PI / 2;
  footprint.position.y = 0.27;
  footprint.castShadow = footprint.receiveShadow = false;
  pad.add(footprint);
  function update(time) {
    const offset = solarLaneAt(track.course, time, index);
    kit.align(pad, track.poseAt(t * track.TRACK, offset, 0.03));
    footprint.getWorldPosition(target);
    direction.subVectors(source, target);
    beam.position.copy(source).add(target).multiplyScalar(0.5);
    beam.scale.y = direction.length();
    beam.quaternion.setFromUnitVectors(axis, direction.normalize());
  }
  update(0);
  return { beam, footprint, update };
}
