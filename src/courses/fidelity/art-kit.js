import { reserveSceneryForTrack } from "../../rendering/scenery-clearance.js";
import { createScenerySite } from "../../rendering/scenery-sites.js";
import * as THREE from "../../../vendor/three/three.module.js";
import { registerLightPool } from "../../rendering/course-lighting.js";
import { batchScenery } from "../../rendering/course-kit.js";

/** Art layers share bounded effects and the authoritative race clock. */
export function artKit(context) {
  const { scene, track, textures = {}, kit } = context;
  const scenery = new THREE.Group();
  scenery.name = `${track.course.name} asset art direction`;
  scene.add(scenery);
  reserveSceneryForTrack(scenery, track);
  const animated = [],
    updates = [],
    fields = [];
  const mat = (color, kind = "rock", extra = {}) =>
    kit.material(color, {
      map: textures[kind],
      normalMap: textures[`${kind}Normal`],
      roughnessMap: textures[`${kind}Roughness`],
      normalScale: new THREE.Vector2(0.6, 0.6),
      ...(kind === "rock"
        ? { roughnessMap: null, roughness: 0.94, normalScale: new THREE.Vector2(0.32, 0.32) }
        : {}),
      ...extra,
    });
  const at = (section, fraction, offset = 0) =>
    kit.groupAt(track.sectorT(section, fraction), offset, scenery);
  const safe = createScenerySite(kit, track, scenery);
  function asset(name, parent, position, scale = 1) {
    if (!kit.hasAsset(`art:${name}`)) return null;
    return kit.fitAsset(`art:${name}`, parent, position, scale);
  }
  const motion = (object, update) => {
    // Repeated children of a moving assembly can still be instanced in its
    // local coordinates; world batching must leave the assembly transform alone.
    if (!animated.includes(object) && object.isGroup) {
      object.updateWorldMatrix(true, true);
      const inverse = object.matrixWorld.clone().invert();
      const meshes = [];
      object.traverse((child) => {
        if (child.isMesh) meshes.push(child);
      });
      for (const child of meshes) {
        const local = inverse.clone().multiply(child.matrixWorld);
        object.add(child);
        local.decompose(child.position, child.quaternion, child.scale);
        child.updateMatrix();
      }
      kit.batch(object);
    }
    animated.push(object);
    updates.push(update);
    return object;
  };
  function lamp(parent, position, color, radius = 28, intensity = 30) {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    );
    glow.position.set(...position);
    parent.add(glow);
    parent.updateWorldMatrix(true, false);
    registerLightPool(scene, {
      position: parent.localToWorld(new THREE.Vector3(...position)),
      color,
      radius,
      intensity,
    });
    return glow;
  }
  function beam(parent, position, color, length = 24, radius = 5, tilt = 0) {
    const geometry = new THREE.ConeGeometry(radius, length, 16, 1, true);
    geometry.translate(0, -length / 2, 0);
    const clock = { value: 0 };
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { tint: { value: new THREE.Color(color) }, clock },
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform vec3 tint; uniform float clock; varying vec2 vUv;
      void main(){float soft=pow(sin(vUv.x*3.14159),2.);float falloff=pow(vUv.y,1.3)*(1.-smoothstep(.93,1.,vUv.y));
      float dust=.8+.2*sin(vUv.y*23.-clock*.4+sin(vUv.x*21.));
      gl_FragColor=vec4(tint,soft*falloff*dust*.075);}`,
    });
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...position);
    m.rotation.z = tilt;
    m.userData.skipBake = true;
    parent.add(m);
    motion(m, (time) => {
      clock.value = time;
    });
    return m;
  }
  // All particle movement is evaluated on the GPU. One draw per style; no
  // allocating particles per frame and no square point sprites.
  function particles({
    color,
    count = 240,
    size = 0.22,
    style = "mote",
    speed = 0.4,
    height = 15,
    offset = 22,
    waterCeiling = null,
    sections = track.SECTIONS.map((_, i) => i),
  }) {
    const positions = [],
      phases = [],
      hues = [];
    const tint = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const t = track.sectorT(sections[i % sections.length], (i * 0.61803398875) % 1);
      const p = track.poseAt(
        t * track.TRACK,
        (i % 2 ? 1 : -1) * (offset + ((i * 13) % 23)),
        2 + ((i * 7) % height),
      ).p;
      if (waterCeiling != null) p.y = Math.min(p.y, waterCeiling - 3);
      positions.push(p.x, p.y, p.z);
      phases.push(i * 2.399963, 0.5 + (i % 7) / 7);
      const c = tint.clone().lerp(new THREE.Color("#ffffff"), (i % 5) * 0.08);
      hues.push(c.r, c.g, c.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("phase", new THREE.Float32BufferAttribute(phases, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(hues, 3));
    const clock = { value: 0 };
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        clock,
        size: { value: size },
        speed: { value: speed },
        pixelScale: { value: 500 },
        kind: { value: style === "bubble" ? 1 : style === "star" ? 2 : 0 },
      },
      vertexShader: `uniform float clock,size,speed,pixelScale;attribute vec2 phase;attribute vec3 color;varying vec3 tint;varying float pulse;
      void main(){vec3 p=position;float t=clock*speed;p.x+=sin(t+phase.x)*2.;p.z+=cos(t*.7+phase.x)*1.4;p.y+=sin(t*.8+phase.x)*2.5;
      vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;gl_PointSize=clamp(size*pixelScale/max(1.,-view.z),1.,18.);tint=color;pulse=.45+.55*pow(.5+.5*sin(t*2.+phase.x),2.);}`,
      fragmentShader: `uniform float kind;varying vec3 tint;varying float pulse;
      void main(){vec2 p=gl_PointCoord-.5;float r=length(p);float a=exp(-r*r*24.)*(1.-smoothstep(.35,.5,r));
      if(kind>.5&&kind<1.5)a=exp(-pow((r-.33)*23.,2.))*.5+exp(-length(p-vec2(-.12,.15))*20.)*.65;
      if(kind>1.5)a*=.35+.65*pow(abs(cos(atan(p.y,p.x)*2.)),6.);
      gl_FragColor=vec4(tint,a*pulse*.7);}`,
    });
    const points = new THREE.Points(geometry, material);
    points.name = `${style} ambient sparkle field`;
    points.frustumCulled = false;
    scenery.add(points);
    fields.push({ geometry, count, material });
    motion(points, (time) => {
      clock.value = time;
    });
  }
  function finish() {
    batchScenery(scenery, animated);
    return {
      scenery,
      animated,
      update(time, state) {
        const seconds = state?.motionEnabled === false ? 0 : time;
        updates.forEach((update) => update(seconds));
      },
      setQuality(tier) {
        fields.forEach(({ geometry, count }) =>
          geometry.setDrawRange(0, Math.round(count * [0.4, 0.6, 0.8, 1][tier])),
        );
      },
      updateCamera(_position, _tier) {
        // Keep point sizes correct across actual viewport sizes and adaptive resolution.
        if (context.renderer)
          fields.forEach(({ material }) => {
            material.uniforms.pixelScale.value =
              context.renderer.getDrawingBufferSize(new THREE.Vector2()).y * 0.7;
          });
      },
    };
  }
  return {
    ...context,
    THREE,
    scenery,
    mat,
    at,
    safe,
    asset,
    motion,
    lamp,
    beam,
    particles,
    finish,
    mesh: (geometry, material, parent = scenery, position, scale) =>
      kit.mesh(geometry, material, parent, position, scale),
    box: (material, parent = scenery, position, scale) =>
      kit.box(material, parent, position, scale),
  };
}
