import * as THREE from "../../vendor/three/three.module.js";

const SPARK_COLORS = ["#d6edf1", "#8af6ff", "#ffc05e"];

/** Fixed-step visual emissions; clocks live here rather than in physics state. */
export function createRacerEffects({ spawnParticle, terrain = "grass" }) {
  const clocks = new Map();

  function positionBehind(state, side, rear, height) {
    return state.worldPos
      .clone()
      .add(
        new THREE.Vector3(
          Math.cos(state.yaw) * side + Math.sin(state.yaw) * rear,
          height,
          -Math.sin(state.yaw) * side + Math.cos(state.yaw) * rear,
        ),
      );
  }

  function update(state, events, dt) {
    let clock = clocks.get(state);
    if (!clock) {
      clock = { drift: 0, boost: 0 };
      clocks.set(state, clock);
    }
    if (events.landed) {
      const color = terrain === "snow" ? "#e9f5ff" : terrain === "sand" ? "#efd4a4" : "#c7d2c8";
      const count = state.isPlayer ? 10 : 5;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const velocity = new THREE.Vector3(Math.cos(angle) * 2.3, 0.45, Math.sin(angle) * 2.3);
        spawnParticle(
          positionBehind(state, i % 2 ? 0.68 : -0.68, 0.25, 0.1),
          color,
          0.32,
          0.2,
          velocity,
        );
      }
    }

    const drifting = events.sliding && state.grounded;
    clock.drift = drifting ? clock.drift + dt * (state.isPlayer ? 30 : 7) : 0;
    while (clock.drift >= 1) {
      clock.drift--;
      for (const side of [-1, 1]) {
        const velocity = new THREE.Vector3(
          Math.sin(state.yaw) * 2.8 + side * Math.cos(state.yaw) * 1.6,
          0.7 + Math.random() * 0.8,
          Math.cos(state.yaw) * 2.8 - side * Math.sin(state.yaw) * 1.6,
        );
        const tier = Math.min(2, state.driftTier || 0);
        spawnParticle(
          positionBehind(state, side * 0.68, 0.62, 0.2),
          SPARK_COLORS[tier],
          tier ? 0.28 : 0.2,
          tier ? 0.14 : 0.085,
          velocity,
        );
      }
    }

    const boosting = state.boost > 0 && state.speed > 10;
    clock.boost = boosting ? clock.boost + dt * (state.isPlayer ? 28 : 6) : 0;
    while (clock.boost >= 1) {
      clock.boost--;
      spawnParticle(
        positionBehind(state, 0, 1.42, 0.65),
        state.driftBoost > 0 && state.driftBoostTier === 1 ? "#83efff" : "#ffcf68",
        0.12,
        0.16,
        new THREE.Vector3(Math.sin(state.yaw) * 2, 0.15, Math.cos(state.yaw) * 2),
      );
    }
  }

  return { update, reset: () => clocks.clear() };
}
