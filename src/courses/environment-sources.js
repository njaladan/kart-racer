import * as THREE from "../../vendor/three/three.module.js";
import { createCourseKit, batchScenery } from "../rendering/course-kit.js";
import { createScenerySite } from "../rendering/scenery-sites.js";
import { registerLightPool } from "../rendering/course-lighting.js";

/** Visible hearths and working sources, so cinders and sparks originate in the world. */
export function buildEnvironmentalSources(scene, track, specs) {
  const root = new THREE.Group();
  root.name = "Working particle sources";
  scene.add(root);
  const kit = createCourseKit(root, track),
    site = createScenerySite(kit, track, root);
  const stone = kit.material("#63594e"),
    iron = kit.material("#3b414b", { metalness: 0.55, roughness: 0.65 });
  const animated = [],
    fires = [],
    sources = new Map();
  for (const spec of specs) {
    if (
      spec.source ||
      !/Torch cinders|Foundry incandescent|Foundry return|Obsidian vent|Cargo welding|Switchyard grinding/.test(
        spec.name,
      )
    )
      continue;
    const g = site(spec.section, spec.fraction ?? 0.5, spec.offset ?? 24, 5, 12);
    if (!g) continue;
    g.userData.environmentSource = spec.name;
    g.name = spec.name + " hearth";
    const height = g.position.y - (track.course.theme.groundHeight ?? -25);
    kit.box(stone, g, [0, -Math.max(2, height) / 2, 0], [5, Math.max(2, height), 5]);
    kit.mesh(new THREE.CylinderGeometry(2.1, 1.6, 1.3, 12), iron, g, [0, 1, 0]);
    for (const side of [-1, 1]) kit.box(iron, g, [side * 1.9, 2, 0], [0.25, 2.5, 3]);
    const fire = !/welding|grinding/i.test(spec.name);
    if (fire) {
      const clock = { value: 0 };
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { clock },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform float clock;varying vec2 vUv;
          void main(){float y=vUv.y;float x=(vUv.x-.5)*2.;
          x+=sin(y*13.-clock*7.)*.09*y+sin(y*22.-clock*11.)*.05;
          float edge=(1.-y)*(.85+.12*sin(clock*9.+y*17.));
          float a=(1.-smoothstep(edge*.65,edge,abs(x)))*(1.-smoothstep(.86,1.,y));
          vec3 color=mix(vec3(1.,.87,.35),vec3(1.,.16,.015),y);
          gl_FragColor=vec4(color,a*.7);}`,
      });
      for (let i = 0; i < 2; i++) {
        const flame = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 5.5), material);
        flame.position.set(0, 4, 0);
        flame.rotation.y = (i * Math.PI) / 2;
        flame.userData.skipBake = true;
        g.add(flame);
        animated.push(flame);
      }
      g.updateWorldMatrix(true, false);
      const pool = registerLightPool(scene, {
        position: g.localToWorld(new THREE.Vector3(0, 3, 0)),
        color: "#ffae54",
        intensity: 24,
        radius: 24,
      });
      const emitter = new THREE.Group();
      emitter.position.set(0, 3, 0);
      emitter.userData.bakeLight = { color: "#ffae54", intensity: 24, distance: 24 };
      g.add(emitter);
      fires.push({ clock, pool });
    } else {
      const tool = kit.box(iron, g, [0, 2, 0], [2.5, 1.5, 3.5]);
      tool.name = "Active workshop machine";
      kit.mesh(new THREE.CylinderGeometry(1, 1, 0.2, 16), iron, g, [0, 3, 0]).rotation.z =
        Math.PI / 2;
    }
    sources.set(spec.name, g);
  }
  batchScenery(root, animated);
  return {
    root,
    animated,
    sources,
    update(time) {
      for (const { clock, pool } of fires) {
        clock.value = time;
        pool.intensity = 24 * (0.84 + 0.12 * Math.sin(time * 11) + 0.08 * Math.sin(time * 19.3));
      }
    },
  };
}
