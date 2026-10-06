/** A changing celebration above the racing sightline, with bounded buffers. */
export function buildFestivalSky({ THREE, scene, track, festival }) {
  const { palette: p, geometry: geo, mesh, box, lantern, sectorT, edgeOffset } = festival;
  const root = new THREE.Group();
  root.name = "Starfall lanterns, summit frost motes and fireworks";
  scene.add(root);
  root.userData.skipBake = true;
  const skyLanterns = [];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    root.add(g);
    const t = sectorT(7, 0.12 + (i % 7) * 0.1),
      base = track.poseAt(t * track.TRACK, edgeOffset(t, i % 2 ? 1 : -1, 14 + (i % 3) * 6), 12).p;
    mesh(geo.cylinder, p.gold, g, [0, 0, 0], [0.75, 1.8, 0.75]);
    box(p.timber, g, [0, -0.95, 0], [1.3, 0.08, 1.3]);
    skyLanterns.push({ g, base, phase: i * 0.071 });
  }
  const count = 540,
    positions = new Float32Array(count * 3),
    colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const fireworks = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.48,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  fireworks.frustumCulled = false;
  root.add(fireworks);
  const origins = [
    track.poseAt(sectorT(0, 0.17) * track.TRACK, 40, 40).p,
    track.poseAt(sectorT(7, 0.51) * track.TRACK, -42, 46).p,
    track.poseAt(sectorT(3, 0.42) * track.TRACK, -25, 31).p,
  ];
  const palette = [
    new THREE.Color("#ffca80"),
    new THREE.Color("#87e6ef"),
    new THREE.Color("#f0a3d3"),
  ];
  const motes = new Float32Array(110 * 3),
    moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motes, 3));
  const sparkle = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      color: "#d1efff",
      size: 0.12,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  );
  root.add(sparkle);
  const glacierFrames = Array.from(
    { length: 110 },
    (_, i) =>
      track.poseAt(sectorT(2, (i + 0.5) / 110) * track.TRACK, Math.sin(i * 5.4) * 7, 4 + (i % 7)).p,
  );
  // An opaque-free, small ribbon provides a gentle auroral echo of the glacier.
  const auroraGeo = new THREE.PlaneGeometry(470, 65, 48, 4);
  const auroraMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv;uniform float time;void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*.018+time*.13)*24.;p.y+=sin(p.x*.025+time*.1)*13.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:
      `varying vec2 vUv;uniform float time;void main(){float bands=pow(.5+.5*sin(vUv.x*90.+sin(vUv.x*18.+time*.18)*5.),3.);float envelope=pow(sin(vUv.y*3.14159),2.)*sin(vUv.x*3.14159);vec3 c=mix(vec3(.13,.52,.5),vec3(.42,.19,.56),vUv.y);gl_FragColor=vec4(c,envelope*(.08+bands*.11));#include <colorspace_fragment>}`.replace(
        ";#include",
        ";\n#include",
      ),
  });
  const aurora = new THREE.Mesh(auroraGeo, auroraMaterial);
  aurora.position.set(0, 150, -390);
  aurora.renderOrder = 2;
  root.add(aurora);
  // The visible mountain beacons tie the summit festival to the valley below.
  const beacon = festival.groupAt(sectorT(3, 0.06));
  lantern(beacon, [0, 16, 0], 2.2);
  return {
    animated: [root],
    update(time) {
      auroraMaterial.uniforms.time.value = time;
      for (const { g, base, phase } of skyLanterns) {
        const u = (time * 0.014 + phase) % 1;
        g.position.copy(base);
        g.position.y += u * 46;
        g.position.x += u * 12 + Math.sin(time * 0.35 + phase * 30) * 1.2;
        g.rotation.z = Math.sin(time * 0.6 + phase) * 0.07;
        g.visible = u > 0.05 && u < 0.94;
      }
      for (let burst = 0; burst < 3; burst++) {
        const u = ((time + burst * 3.9) % 14) / 14,
          age = u * 14 - 2,
          origin = origins[burst],
          color = palette[burst];
        for (let j = 0; j < 180; j++) {
          const index = burst * 180 + j,
            z = 1 - (2 * (j + 0.5)) / 180,
            a = j * 2.399963,
            r = Math.sqrt(1 - z * z),
            speed = 4.5 + (j % 5) * 0.35;
          const active = age > 0 && age < 3.7,
            fade = active ? Math.pow(1 - age / 3.7, 1.4) : 0;
          positions[index * 3] = origin.x + (active ? Math.cos(a) * r * speed * age : 0);
          positions[index * 3 + 1] = origin.y + (active ? z * speed * age - age * age * 0.8 : 0);
          positions[index * 3 + 2] = origin.z + (active ? Math.sin(a) * r * speed * age : 0);
          colors[index * 3] = color.r * fade;
          colors[index * 3 + 1] = color.g * fade;
          colors[index * 3 + 2] = color.b * fade;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      for (let i = 0; i < 110; i++) {
        const base = glacierFrames[i];
        motes[i * 3] = base.x + Math.sin(time * 0.3 + i) * 0.6;
        motes[i * 3 + 1] = base.y + Math.sin(time * 0.5 + i) * 0.8;
        motes[i * 3 + 2] = base.z + Math.cos(time * 0.4 + i) * 0.6;
      }
      moteGeo.attributes.position.needsUpdate = true;
    },
  };
}
