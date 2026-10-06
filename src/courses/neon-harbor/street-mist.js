/** Small depth-tested vapor banks, shared mask and no screen-sized fog layers. */
export function createStreetMist({ THREE, scenery, track, animated }) {
  const pixels = new Uint8Array(64 * 32 * 4);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 64; x++) {
      const u = (x - 31.5) / 31.5,
        v = (y - 15.5) / 15.5;
      const wisps = 0.7 + 0.3 * Math.sin(x * 0.23 + Math.sin(y * 0.35) * 2);
      const k = (y * 64 + x) * 4;
      pixels[k] = pixels[k + 1] = pixels[k + 2] = 255;
      pixels[k + 3] = Math.round(Math.max(0, 1 - u * u - v * v) ** 2 * wisps * 255);
    }
  const texture = new THREE.DataTexture(pixels, 64, 32);
  texture.needsUpdate = true;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: "#9caec7",
    opacity: 0.12,
    depthWrite: false,
  });
  const banks = [];
  for (const district of [0, 1, 2, 7])
    for (let i = 0; i < 4; i++) {
      const t = track.sectorT(district, (i + 0.5) / 4);
      const side = i % 2 ? 1 : -1;
      const p = track.poseAt(t * track.TRACK, side * (track.roadHalfWidth(t) - 1), 1.1).p;
      const sprite = new THREE.Sprite(material);
      sprite.name = "Low harbor street vapor";
      sprite.position.copy(p);
      sprite.scale.set(13 + i, 2.5, 1);
      scenery.add(sprite);
      animated.push(sprite);
      banks.push({ sprite, p });
    }
  return {
    setQuality(tier) {
      banks.forEach(({ sprite }, i) => {
        sprite.visible = i % 4 < [1, 2, 3, 4][tier];
      });
    },
    update(time) {
      banks.forEach(({ sprite, p }, i) => {
        sprite.position.x = p.x + Math.sin(time * 0.15 + i) * 1.3;
        sprite.position.y = p.y + Math.sin(time * 0.24 + i) * 0.18;
      });
    },
  };
}
