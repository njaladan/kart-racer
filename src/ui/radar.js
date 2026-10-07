import { activeTrack, routePoint, poseAt, laneWidth } from "../track/track.js";

export function createRadar({ canvas: radar, player, bots, boxes }) {
  const radarContext = radar.getContext("2d");
  const TAU = Math.PI * 2;
  const radarPoints = Array.from({ length: 161 }, (_, i) => {
    const p = routePoint(i / 160);
    return [p.x, p.z];
  });
  const branchPoints = activeTrack.branches.map((branch) => ({
    branch,
    points: Array.from({ length: 81 }, (_, i) => {
      const p = branch.poseAt(i / 80).p;
      return [p.x, p.z];
    }),
  }));
  const allPoints = [...radarPoints, ...branchPoints.flatMap((route) => route.points)];
  const radarBounds = {
    minX: Math.min(...allPoints.map((p) => p[0])),
    maxX: Math.max(...allPoints.map((p) => p[0])),
    minZ: Math.min(...allPoints.map((p) => p[1])),
    maxZ: Math.max(...allPoints.map((p) => p[1])),
  };
  function updateRadar() {
    const cw = radar.width,
      ch = radar.height,
      pad = 18;
    radarContext.clearRect(0, 0, cw, ch);
    radarContext.fillStyle = "rgba(5,16,28,.78)";
    radarContext.beginPath();
    radarContext.roundRect(0, 0, cw, ch, 8);
    radarContext.fill();
    radarContext.strokeStyle = "rgba(206,247,244,.14)";
    radarContext.lineWidth = 9;
    radarContext.lineJoin = "round";
    radarContext.lineCap = "round";
    const points = radarPoints,
      { minX, maxX, minZ, maxZ } = radarBounds,
      scale = Math.min((cw - pad * 2) / (maxX - minX), (ch - pad * 2) / (maxZ - minZ));
    const map = (p) => [pad + (p[0] - minX) * scale, pad + (p[1] - minZ) * scale];
    radarContext.beginPath();
    points.forEach((p, i) => {
      const q = map(p);
      const replaced = activeTrack.branches.some(
        (b) => b.required && i / 160 > b.start && (i - 1) / 160 < b.end,
      );
      i && !replaced ? radarContext.lineTo(q[0], q[1]) : radarContext.moveTo(q[0], q[1]);
    });
    radarContext.stroke();
    radarContext.strokeStyle = "rgba(211,255,239,.45)";
    radarContext.lineWidth = 2;
    radarContext.stroke();
    for (const { branch, points } of branchPoints) {
      if (
        branch.lap != null &&
        branch.lap !== (player.lap || 0) % 3 &&
        ![player, ...bots].some((r) => r.routeChoice === branch.index)
      )
        continue;
      radarContext.beginPath();
      for (const [i, p] of points.entries()) {
        const q = map(p);
        i ? radarContext.lineTo(q[0], q[1]) : radarContext.moveTo(q[0], q[1]);
      }
      radarContext.strokeStyle = branch.color;
      radarContext.lineWidth = 2;
      radarContext.stroke();
    }
    const dot = (s, lane, color, size, position) => {
      const f = poseAt(s, laneWidth(lane), 0.2),
        q = map(position ? [position.x, position.z] : [f.p.x, f.p.z]);
      radarContext.fillStyle = color;
      radarContext.beginPath();
      radarContext.arc(q[0], q[1], size, 0, TAU);
      radarContext.fill();
    };
    for (const box of boxes) if (box.active) dot(box.s, box.x, "#5af2dd", 1.6);
    for (const b of bots) if (!b.finished) dot(b.s, b.x, b.color, 3.2, b.worldPos);
    dot(player.s, player.x, "#d5fa51", 4.2, player.worldPos);
    radarContext.fillStyle = "#d5fa51";
    radarContext.font = 'bold 9px "DM Mono",monospace';
    radarContext.fillText("TRACK RADAR", 10, ch - 7);
  }
  return { update: updateRadar };
}
