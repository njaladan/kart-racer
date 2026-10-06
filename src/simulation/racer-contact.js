/** Separate each pair once and apply a closing impulse in world metres. */
export function resolveRacerContacts(racers, { hitRacer, onContact }) {
  // Separate overlapping bodies once and apply an impulse, with a cooldown.
  for (let i = 0; i < racers.length; i++)
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i],
        b = racers[j];
      if (
        a.traversalIndex >= 0 ||
        b.traversalIndex >= 0 ||
        a.finished ||
        b.finished ||
        Math.abs(a.worldPos.y - b.worldPos.y) > 1.5
      )
        continue;
      let dx = a.worldPos.x - b.worldPos.x,
        dz = a.worldPos.z - b.worldPos.z;
      const distance = Math.hypot(dx, dz);
      const separation = 0.975 * ((a.scale || 1) + (b.scale || 1));
      if (distance >= separation) continue;
      if (distance < 0.001) {
        dx = 1;
        dz = 0;
      } else {
        dx /= distance;
        dz /= distance;
      }
      const push = (separation - distance) * 0.5;
      a.worldPos.x += dx * push;
      a.worldPos.z += dz * push;
      b.worldPos.x -= dx * push;
      b.worldPos.z -= dz * push;
      const closing = (a.vx - b.vx) * dx + (a.vz - b.vz) * dz;
      if (closing < 0) {
        const impulse = -closing * 0.56;
        a.vx += dx * impulse;
        a.vz += dz * impulse;
        b.vx -= dx * impulse;
        b.vz -= dz * impulse;
      }
      if (a.star > 0) hitRacer(b);
      else if (b.star > 0) hitRacer(a);
      onContact(a, b, closing);
    }
}
