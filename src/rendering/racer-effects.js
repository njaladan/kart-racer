import * as THREE from "../../vendor/three/three.module.js";
import { activeTrack, trackT } from "../track/track.js";

const SPARK_COLORS = ["#d6edf1", "#8af6ff", "#ffc05e"];

/** Fixed-step visual emissions; clocks live here rather than in physics state. */
export function createRacerEffects({ spawnParticle, terrain = "grass" }) {
  const clocks = new Map();

  function positionBehind(state, side, rear, height) {
    const scale = state.scale ?? 1;
    return state.worldPos
      .clone()
      .add(
        new THREE.Vector3(
          (Math.cos(state.yaw) * side + Math.sin(state.yaw) * rear) * scale,
          height * scale,
          (-Math.sin(state.yaw) * side + Math.cos(state.yaw) * rear) * scale,
        ),
      );
  }

  function update(state, events, dt) {
    const storm = activeTrack.course.theme.atmosphere === "storm",
      paper = activeTrack.course.theme.terrain === "paper";
    let clock = clocks.get(state);
    if (!clock) {
      clock = { drift: 0, boost: 0, surface: 0, scale: state.scale ?? 1 };
      clocks.set(state, clock);
    }
    const scale = state.scale ?? 1;
    if (clock.scale > 0.6 !== scale > 0.6) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        spawnParticle(
          state.worldPos
            .clone()
            .add(new THREE.Vector3(Math.cos(a) * scale, 0.5, Math.sin(a) * scale)),
          scale < 0.6 ? "#ffc9df" : "#9bebd0",
          0.5,
          0.12,
          new THREE.Vector3(Math.cos(a) * 2, 1.2, Math.sin(a) * 2),
        );
      }
    }
    clock.scale = scale;
    if (events.landed) {
      const color =
        state.underwater || storm
          ? "#b6eaf3"
          : paper
            ? "#f2b5c7"
            : terrain === "snow"
              ? "#e9f5ff"
              : terrain === "sand"
                ? "#efd4a4"
                : "#c7d2c8";
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

    const surface = activeTrack.surfaceAt(trackT(state.s), (state.x || 0) * 6.25).material;
    const loose =
      ["snow", "sand", "gravel", "needles", "grass", "paper"].includes(surface) ||
      Math.abs(state.x) > 1;
    const wet = state.underwater || storm || terrain === "concrete" || surface === "ice";
    clock.surface =
      state.grounded && state.speed > 12 && (loose || wet)
        ? clock.surface + dt * (state.isPlayer ? 14 : 3)
        : 0;
    while (clock.surface >= 1) {
      clock.surface--;
      const color =
        surface === "snow" || terrain === "snow"
          ? "#e8f6ff"
          : paper
            ? ["#f6a6c0", "#a6b4e0", "#ffdb88"][Math.floor(state.s) % 3]
            : wet
              ? "#96cdd9"
              : terrain === "sand"
                ? "#d8b985"
                : "#aaa785";
      for (const side of [-1, 1])
        spawnParticle(
          positionBehind(state, side * 0.7, 0.74, 0.12),
          color,
          wet ? 0.25 : 0.48,
          wet ? 0.08 : 0.17,
          new THREE.Vector3(
            Math.sin(state.yaw) * 2 + side * Math.cos(state.yaw) * 0.8,
            wet ? 0.65 : 0.35,
            Math.cos(state.yaw) * 2 - side * Math.sin(state.yaw) * 0.8,
          ),
        );
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
