import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import {
  createDriftReadiness,
  updateDriftReadiness,
  DRIFT_COLORS,
} from "../src/rendering/drift-readiness.js";
import { createRacerEffects } from "../src/rendering/racer-effects.js";

// Readiness stays visible between particle emissions and is distinct by shape.
test("readiness follows the kart, with one blue or two orange diamonds on each side", () => {
  const root = new THREE.Group();
  const markers = createDriftReadiness(root);
  assert.equal(markers.parent, root);
  assert.equal(markers.visible, false);
  const state = { driftTier: 1, driftDirection: 1, grounded: true, spin: 0 };
  updateDriftReadiness(markers, state, 0);
  assert.equal(markers.visible, true);
  for (const side of markers.children) {
    assert.equal(side.children[0].visible, true);
    assert.equal(side.children[1].visible, false);
    assert.equal(
      side.children[0].material.color.getHexString(),
      new THREE.Color(DRIFT_COLORS[1]).getHexString(),
    );
  }
  state.driftTier = 2;
  updateDriftReadiness(markers, state, 1);
  assert.ok(markers.children.every((side) => side.children[1].visible));
  assert.equal(
    markers.children[0].children[0].material.color.getHexString(),
    new THREE.Color(DRIFT_COLORS[2]).getHexString(),
  );
  for (const change of [
    { driftTier: 0 },
    { driftDirection: 0 },
    { grounded: false },
    { spin: 1 },
  ]) {
    updateDriftReadiness(markers, { ...state, ...change }, 2);
    assert.equal(markers.visible, false);
  }
});

test("earning a tier emits a bounded burst once and sparks use the readiness color", () => {
  const emissions = [];
  const effects = createRacerEffects({ spawnParticle: (...args) => emissions.push(args) });
  const state = {
    worldPos: new THREE.Vector3(),
    yaw: 0,
    s: 0,
    x: 0,
    isPlayer: true,
    grounded: true,
    speed: 0,
    driftTier: 1,
  };
  effects.update(state, { sliding: true }, 0);
  assert.equal(emissions.length, 16);
  assert.ok(emissions.every((args) => args[1] === DRIFT_COLORS[1]));
  effects.update(state, { sliding: true }, 0);
  assert.equal(emissions.length, 16);
  state.driftTier = 2;
  effects.update(state, { sliding: true }, 0);
  assert.equal(emissions.length, 32);
  assert.ok(emissions.slice(16).every((args) => args[1] === DRIFT_COLORS[2]));
  effects.update(state, { sliding: false }, 0);
  effects.update(state, { sliding: false }, 0.5);
  assert.equal(emissions.length, 32);
});
