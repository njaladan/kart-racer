import { createScenerySite } from "../../rendering/scenery-sites.js";
import { importedRockGeometry } from "../fidelity/imported-rock.js";
import { createWaterMaterial, installSurfaceDetail } from "../../rendering/surface-detail.js";
import { pendulumAt } from "../../simulation/course-mechanics.js";
export function worldKit(context) {
  const { THREE, scene, scenery, track, kit, textures = {} } = context;
  const { material, mesh, box, groupAt, sectorT, align } = kit;
  const animated = [],
    updates = [];
  const mat = (color, kind = "stone", extra = {}) => {
    const m = material(color, {
      map: textures[kind],
      normalMap: textures[`${kind}Normal`],
      roughnessMap: textures[`${kind}Roughness`],
      ...(kind === "rock" && textures.rockNormal
        ? { roughnessMap: null, roughness: 0.94, normalScale: new THREE.Vector2(0.32, 0.32) }
        : {}),
      bumpMap: textures[`${kind}Normal`] ? undefined : textures[kind],
      bumpScale: 0.025,
      ...extra,
    });
    if (!extra.transparent) installSurfaceDetail(m, { kind: "terrain", strength: 0.12 });
    return m;
  };
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12),
    sphere = new THREE.SphereGeometry(1, 16, 10),
    rock = importedRockGeometry(context.assets) || new THREE.IcosahedronGeometry(1, 1),
    torus = new THREE.TorusGeometry(1, 0.065, 6, 48),
    arch = new THREE.TorusGeometry(1, 0.05, 6, 24, Math.PI);
  const motion = (object, update) => {
    animated.push(object);
    updates.push(update);
    return object;
  };
  const at = (section, fraction, offset = 0) => groupAt(sectorT(section, fraction), offset);
  const safe = createScenerySite(kit, track, scenery);
  function tube(parent, start, end, radius, material) {
    const a = new THREE.Vector3(...start),
      b = new THREE.Vector3(...end),
      d = b.clone().sub(a);
    const m = mesh(cylinder, material, parent, a.clone().add(b).multiplyScalar(0.5).toArray(), [
      radius,
      d.length(),
      radius,
    ]);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  function sweep(section, start, end, left, right, material, above = 0.06) {
    const a = sectorT(section, start),
      b = sectorT(section, end),
      count = Math.max(12, Math.ceil(((b - a) * track.COURSE_LENGTH) / 2)),
      positions = [],
      uv = [],
      indices = [];
    for (let i = 0; i <= count; i++) {
      const t = a + ((b - a) * i) / count;
      for (const side of [left, right]) {
        const offset = typeof side === "function" ? side(t) : side,
          p = track.poseAt(t * track.TRACK, offset, above).p;
        positions.push(p.x, p.y, p.z);
        uv.push(offset / 8, (t * track.COURSE_LENGTH) / 8);
      }
      if (i < count) {
        const q = i * 2;
        indices.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const result = mesh(geo, material);
    result.userData.bakeReceiver = true;
    result.castShadow = false;
    return result;
  }
  function portal(section, fraction, color, width = 18, height = 20) {
    const t = sectorT(section, fraction);
    width = Math.max(
      width,
      Math.abs(track.platformEdgeAt(t, -1)) + 3,
      track.platformEdgeAt(t, 1) + 3,
    );
    const g = at(section, fraction),
      m = mat(color);
    for (const side of [-1, 1]) {
      box(m, g, [side * width, height / 2, 0], [2.5, height, 4]);
      box(m, g, [side * width, 1, 0], [4, 2, 5]);
    }
    box(m, g, [0, height, 0], [width * 2 + 4, 2, 4]);
    return g;
  }
  function ridge(section, side, color, height = 25, count = 18, offset = 32) {
    const m = mat(color, "rock");
    for (let i = 0; i < count; i++) {
      const g = safe(section, (i + 0.5) / count, side * (offset + (i % 3) * 6), 14);
      if (!g) continue;
      const r = mesh(
        rock,
        m,
        g,
        [0, height * 0.35 - 2, 0],
        [15, height * (0.7 + (i % 3) * 0.12), 15],
      );
      r.rotation.y = i * 0.71;
    }
  }
  function archway(section, fraction, color, radius = 18) {
    const g = at(section, fraction);
    mesh(arch, mat(color, "metal"), g, [0, 1, 0], [radius, radius, radius]);
    return g;
  }
  function water(color, y = 0, size = 1500) {
    const m = createWaterMaterial({ scene, color, roughness: 0.22, shoreRadius: 110, foam: true });
    const p = mesh(new THREE.PlaneGeometry(size, size, 20, 20), m, scenery, [0, y, 0]);
    p.rotation.x = -Math.PI / 2;
    p.castShadow = false;
    return p;
  }
  function points(color, sections, count = 160, size = 0.25) {
    const positions = [];
    for (let i = 0; i < count; i++) {
      const t = sectorT(sections[i % sections.length], (((i * 17) % count) + 0.5) / count),
        p = track.poseAt(t * track.TRACK, (i % 2 ? 1 : -1) * (13 + (i % 17)), 2 + (i % 12)).p;
      positions.push(p.x, p.y, p.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const p = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    scenery.add(p);
    motion(p, (time) => {
      p.position.y = Math.sin(time * 0.4) * 1.3;
      p.position.x = Math.sin(time * 0.2) * 0.5;
    });
    return p;
  }
  function pendulums(style, color) {
    for (const [i, d] of (track.course.pendulums || []).entries()) {
      const g = at(d.section, d.fraction),
        m = mat(color, "metal", { metalness: 0.55, roughness: 0.32 }),
        bob = mesh(
          style === "hammer" ? new THREE.BoxGeometry(1, 1, 1) : sphere,
          m,
          g,
          [0, 1.1, 0],
          [d.radius || 1.3, 1.3, d.radius || 1.3],
        ),
        rod = tube(g, [0, 21, 0], [0, 1.1, 0], style === "hammer" ? 0.3 : 0.12, m);
      portal(d.section, d.fraction, color, 18, 21);
      motion(g, (time) => {
        const pose = pendulumAt(track, d, time);
        g.updateWorldMatrix(true, false);
        const local = g.worldToLocal(pose.p.clone());
        local.y += 0.85;
        bob.position.copy(local);
        const anchor = new THREE.Vector3(0, 21, 0),
          direction = local.clone().sub(anchor);
        rod.position.copy(anchor).add(local).multiplyScalar(0.5);
        rod.scale.y = direction.length();
        rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      });
      for (const side of [-1, 1]) box(m, g, [side * 8, 0.08, 0], [0.25, 0.05, 9]);
      box(
        mat("#fff0c7", "metal", { emissive: "#fabc68", emissiveIntensity: 0.6 }),
        g,
        [0, 21, 0],
        [2, 0.2, 1],
      );
      if (i % 2 === 0) mesh(torus, m, g, [0, 24, 0], [3, 3, 3]);
    }
  }
  const finish = () => ({
    animated,
    update(time, state) {
      updates.forEach((update) => update(time, state));
    },
  });
  return {
    ...context,
    mat,
    mesh,
    box,
    groupAt,
    sectorT,
    align,
    at,
    safe,
    tube,
    sweep,
    motion,
    ridge,
    portal,
    archway,
    water,
    points,
    pendulums,
    finish,
    cylinder,
    sphere,
    rock,
    torus,
  };
}
