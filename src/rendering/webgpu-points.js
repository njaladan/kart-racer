import * as THREE from "../../vendor/three/three.module.js";

/** WebGPU point primitives are always one pixel. Render the existing mutable
 * particle attributes as instanced, camera-facing quads instead. The source
 * geometry stays intact for the course's animation and quality controllers. */
export function promotePointFields(scene) {
  const fields = [];
  scene.traverse((object) => {
    if (object.isPoints) fields.push(object);
  });
  for (const field of fields) {
    const source = field.geometry,
      original = field.material;
    const plane = new THREE.PlaneGeometry(2, 2);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = plane.index;
    geometry.setAttribute("position", plane.attributes.position);
    geometry.setAttribute("uv", plane.attributes.uv);
    const attributes = [];
    for (const [name, attribute] of Object.entries(source.attributes)) {
      const instance = new THREE.InstancedBufferAttribute(
        attribute.array,
        attribute.itemSize,
        attribute.normalized,
      );
      instance.setUsage(attribute.usage);
      geometry.setAttribute(name === "position" ? "pointPosition" : name, instance);
      attributes.push({ source: attribute, instance, version: -1 });
    }
    const uniforms = original.isShaderMaterial
      ? original.uniforms
      : {
          tint: {
            get value() {
              return original.color;
            },
          },
          opacity: {
            get value() {
              return original.opacity;
            },
          },
          size: {
            get value() {
              return original.size;
            },
          },
          ...(original.map ? { pointMap: { value: original.map } } : {}),
        };
    const vertexShader = original.isShaderMaterial
      ? original.vertexShader
      : `
      uniform float size; varying vec3 pointTint;
      void main(){vec4 view=modelViewMatrix*vec4(position,1.);
      gl_Position=projectionMatrix*view;gl_PointSize=size*300./max(1.,-view.z);
      pointTint=${original.vertexColors && source.hasAttribute("color") ? "color" : "vec3(1.)"};}`;
    const fragmentShader = original.isShaderMaterial
      ? original.fragmentShader
      : `
      uniform vec3 tint; uniform float opacity; varying vec3 pointTint;
      ${original.map ? "uniform sampler2D pointMap;" : ""}
      void main(){vec2 p=gl_PointCoord-.5;
      vec4 mask=${original.map ? "texture2D(pointMap,gl_PointCoord)" : "vec4(1.,1.,1.,1.-smoothstep(.1,.5,length(p)))"};
      gl_FragColor=vec4(tint*pointTint*mask.rgb,opacity*mask.a);}`;
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: original.transparent,
      depthWrite: original.depthWrite,
      depthTest: original.depthTest,
      blending: original.blending,
      toneMapped: original.toneMapped,
      fog: original.fog,
    });
    material.userData.webgpuBillboard = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${field.name} WebGPU billboards`;
    mesh.frustumCulled = false;
    mesh.renderOrder = field.renderOrder;
    mesh.userData.skipBake = true;
    mesh.userData.isParticle = true;
    mesh.onBeforeRender = (...args) => {
      field.onBeforeRender(...args);
      geometry.instanceCount = Math.min(source.attributes.position.count, source.drawRange.count);
      for (const entry of attributes)
        if (entry.version !== entry.source.version) {
          entry.instance.array = entry.source.array;
          entry.instance.needsUpdate = true;
          entry.version = entry.source.version;
        }
    };
    field.isPoints = false;
    field.add(mesh);
    geometry.instanceCount = Math.min(source.attributes.position.count, source.drawRange.count);
  }
  return fields.length;
}
