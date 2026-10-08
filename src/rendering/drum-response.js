/** Reconstruct the impact from authoritative flight age, including missed render frames. */
export function drumImpact(racers, index, time, previousImpact = -Infinity) {
  let impact = previousImpact;
  for (const racer of racers || []) {
    if (
      racer.jumpKind !== "drum" ||
      racer.lastDrumIndex !== index ||
      !Number.isFinite(racer.airTime)
    )
      continue;
    if (racer.airTime >= 0 && racer.airTime < 0.7) impact = Math.max(impact, time - racer.airTime);
  }
  const age = Math.max(0, time - impact);
  return {
    impact,
    strength: age < 0.7 ? Math.exp(-age * 7) * (Math.sin(age * 29) * 0.45 + 0.55) : 0,
  };
}
