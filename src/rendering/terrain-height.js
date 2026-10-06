// Terrain ribbons contain an inner and outer vertex at each road sample.
// Match the resulting linear cross-section when planting scenery on the slope.
export const TERRAIN_VERGE_WIDTH = 38;

export function sceneryGroundHeight(surface) {
  const { frame } = surface;
  const lane = surface.offset / Math.hypot(frame.right.x, frame.right.z);
  const edge = lane > 0 ? surface.rightEdge : surface.leftEdge;
  if (surface.pathway?.mode === "drop") return surface.groundHeight ?? -1.7;
  const shoulder = surface.pathway?.shoulder ?? 0;
  const blend = Math.max(
    0,
    Math.min(1, (Math.abs(lane) - Math.abs(edge) - shoulder) / TERRAIN_VERGE_WIDTH),
  );
  const edgeHeight = frame.p.y + frame.right.y * edge - 0.06;
  return edgeHeight + ((surface.groundHeight ?? -1.7) - edgeHeight) * blend;
}
