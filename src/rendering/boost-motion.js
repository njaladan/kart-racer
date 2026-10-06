/** One presentation envelope for pads, items, tricks, mini-turbos and stars. */
export function createBoostMotion() {
  let strength = 0;
  let kick = 0;
  let previousDuration = 0;
  return {
    update(player, enabled, dt) {
      const duration = enabled && player.spin <= 0 ? Math.max(player.boost, player.star) : 0;
      if (duration > previousDuration + 0.08) kick = 1;
      previousDuration = duration;
      strength +=
        ((duration > 0 ? 1 : 0) - strength) * (1 - Math.exp(-dt * (duration > 0 ? 24 : 7)));
      kick *= Math.exp(-dt * 9);
      if (!enabled) strength = kick = 0;
      return { strength, kick };
    },
    reset() {
      strength = kick = previousDuration = 0;
    },
  };
}
