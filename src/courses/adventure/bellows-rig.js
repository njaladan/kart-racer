/** A two-bone pleated cloth rig: end plates stay rigid while folds compress. */
export function bellowsRig(w, parent, material, length = 4, height = 3, depth = 2) {
  const { THREE } = w;
  const positions = [],
    normals = [],
    uv = [],
    indices = [],
    skinIndices = [],
    skinWeights = [];
  const folds = 24;
  for (let i = 0; i <= folds; i++) {
    const q = i / folds;
    const pleat = i % 2 ? 1 : 0.87;
    for (const [y, z] of [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ]) {
      positions.push((q - 0.5) * length, (y * height * pleat) / 2, (z * depth * pleat) / 2);
      normals.push(0, y / Math.SQRT2, z / Math.SQRT2);
      uv.push(q * 4, (y + z + 2) / 4);
      skinIndices.push(0, 1, 0, 0);
      skinWeights.push(1 - q, q, 0, 0);
    }
    if (i < folds)
      for (let j = 0; j < 4; j++) {
        const a = i * 4 + j,
          b = i * 4 + ((j + 1) % 4);
        indices.push(a, a + 4, b, b, a + 4, b + 4);
      }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(new Float32Array(positions.length).fill(1), 3),
  );
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const root = new THREE.Bone(),
    end = new THREE.Bone();
  root.position.x = -length / 2;
  end.position.x = length;
  root.add(end);
  const skin = new THREE.SkinnedMesh(geometry, material);
  skin.name = "Rigged pleated bellows";
  skin.add(root);
  parent.add(skin);
  skin.bind(new THREE.Skeleton([root, end]));
  skin.castShadow = skin.receiveShadow = true;
  // Explicit conservative deformation bounds keep expanded folds visible.
  skin.boundingBox = new THREE.Box3(
    new THREE.Vector3(-length, -height, -depth),
    new THREE.Vector3(length, height, depth),
  );
  skin.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(length, height, depth));
  return {
    skin,
    compress(amount) {
      const span = length * amount;
      root.position.x = -span / 2;
      end.position.x = span;
    },
  };
}
