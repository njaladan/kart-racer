/** Keep the kart visible when a concave floor rises between it and the chase rig. */
export function clearAreaCamera(area, camera, kart, clearance = 0.35) {
  if (!area) return;
  const target = kart.clone();
  target.y += 0.9;
  for (let i = 1; i <= 32; i++) {
    const q = i / 32;
    const point = target.clone().lerp(camera, q);
    if (!area.contains(point)) continue;
    const floor = area.heightAt(point) + clearance;
    camera.y = Math.max(camera.y, (floor - target.y * (1 - q)) / q);
  }
}

/** Quarterpipes rise above the open snow floor, including beside the powder line. */
export function clearMountainCamera(track, camera, kart, nearT) {
  const mountain = track.mountainSurface;
  if (!mountain?.containsT(nearT)) return;
  clearAreaCamera(
    {
      contains: (p) => {
        const c = mountain.coordinatesAt(p, nearT);
        return mountain.containsT(c.t) && Math.abs(c.offset) <= mountain.widthAt(c.t);
      },
      heightAt: (p) => mountain.heightAt(p, nearT) + (mountain.rampAt(p, nearT)?.height || 0),
    },
    camera,
    kart,
  );
}
