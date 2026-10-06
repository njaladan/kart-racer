import * as THREE from "../../vendor/three/three.module.js";
import { resetMotion } from "./physics.js";

/**
 * Build the shared mutable record used by simulation, race, items, and view code.
 * Physics owns velocity/contact/drift fields; race owns progress/finish fields;
 * items owns inventory/effects; the browser view owns renderFrom, renderYawFrom, and kart.
 */
export function createRacerState(configuration = {}) {
  const state = {
    name: "RACER",
    color: "#ffffff",
    isPlayer: false,
    isBot: false,
    s: 0,
    x: 0,
    speed: 0,
    yaw: 0,
    worldPos: new THREE.Vector3(),
    renderFrom: new THREE.Vector3(),
    renderYawFrom: 0,
    lap: 0,
    nextCheckpoint: 1,
    finishTime: Infinity,
    finishDelay: 0,
    recoveryCount: 0,
    boost: 0,
    star: 0,
    spin: 0,
    hitFlipAxis: "x",
    hitFlipDirection: 1,
    hitFlipDuration: 0,
    hitFlipElapsed: 0,
    hitSlideVx: 0,
    hitSlideVz: 0,
    hitStartYaw: 0,
    hitLift: 0,
    drift: 0,
    driftTier: 0,
    driftBoost: 0,
    driftBoostTier: 0,
    item: null,
    itemCount: 0,
    cooldown: 0,
    air: 0,
    padCooldown: 0,
    finished: false,
    prevS: 0,
    skill: 0.8,
    ...configuration,
  };

  resetMotion(state);
  return state;
}
