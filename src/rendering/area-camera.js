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
