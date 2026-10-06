import * as THREE from "../../vendor/three/three.module.js";
import { poseAt, laneWidth } from "../track/track.js";
import { createRacerEffects } from "../rendering/racer-effects.js";

const PICKUP_NAMES = {
  mushroom: "TRIPLE MUSHROOMS",
  green: "GREEN SHELL",
  red: "HOMING RED SHELL",
  banana: "BANANA PEELS",
  star: "RAINBOW STAR",
};

/** Translate race events into sound, messages, camera shake, and spark emissions. */
export function createRaceFeedback({ player, audio, particles, toast, terrain }) {
  let toastLeft = 0,
    shake = 0;
  const spawnParticle = (...args) => particles.spawn(...args);
  const racerEffects = createRacerEffects({ spawnParticle, terrain });
  function notify(text) {
    toast.textContent = text;
    toastLeft = 1.65;
  }
  function racerEvent(racer, events, dt) {
    racerEffects.update(racer, events, dt);
    if (events.deckBoarded && racer === player) {
      notify("ALL ABOARD THE EXPRESS");
      audio.play("train-board");
    }
    if (events.deckLeft && racer === player) audio.play("land");
    if (events.traversalStarted && racer === player) {
      notify(events.traversalKind === "lift" ? "ALL ABOARD THE SKY LIFT" : "CANNON FLIGHT!");
      audio.play(events.traversalKind === "lift" ? "mechanism" : "cannon");
    }
    if (events.wallContact) {
      if (racer === player) {
        shake = 0.1;
        audio.play("hit");
      }
    }
    if (events.launched && racer === player) {
      notify("TAP DRIFT TO TRICK!");
      audio.play("jump");
    }
    if (events.trickStarted && racer === player) {
      notify("TRICK!");
      audio.play("trick");
      for (let n = 0; n < 12; n++)
        spawnParticle(
          racer.worldPos.clone().add(new THREE.Vector3(0, 0.7, 0)),
          "#ffe680",
          0.5,
          0.15,
        );
    }
    if (events.landed && racer === player) {
      audio.play("land");
      shake = 0.09;
      notify(events.trickLanded ? "TRICK LANDING BOOST!" : "SMOOTH LANDING");
      if (events.trickLanded) audio.play("boost");
    }
    if (events.turboTier && racer === player) {
      notify(events.turboTier === 2 ? "ORANGE MINI-TURBO!" : "BLUE MINI-TURBO!");
      audio.play(events.turboTier === 2 ? "turbo-orange" : "turbo-blue");
    }
    if (events.padBoost && !events.traversalFinished && racer === player) {
      notify("TURBO PANEL!");
      audio.play("boost");
    }
    if (events.cartImpact && racer === player) {
      notify("WATCH THE MECHANISM!");
      shake = 0.15;
      audio.play("hit");
    }
    if (events.newLap && racer === player) {
      notify(`LAP ${racer.lap + 1} — KEEP IT UP!`);
      audio.tone(520, 0.22, "square", 0.1, 300);
    }
  }
  function itemUsed(who, type) {
    const isPlayer = who === player;
    if (type === "mushroom") {
      if (isPlayer) {
        notify(who.itemCount ? `TURBO! ${who.itemCount} LEFT` : "MUSHROOM BOOST!");
        audio.play("boost");
      }
      for (let n = 0; n < 17; n++)
        spawnParticle(poseAt(who.s, laneWidth(who.x), 1).p, "#ff9c4d", 0.5, 0.15);
    } else if (isPlayer) {
      notify(
        {
          star: "RAINBOW STAR!",
          banana: "BANANAS AWAY!",
          red: "HOMING RED SHELL!",
          green: "GREEN SHELL!",
        }[type],
      );
      audio.play(type === "star" ? "star" : "shell");
    }
  }
  return {
    racerEvent,
    itemUsed,
    getShake: () => shake,
    collected(who) {
      if (who !== player) return;
      notify(`${PICKUP_NAMES[who.item]}!`);
      audio.play("pickup");
    },
    impact(who, message) {
      if (who === player) notify(message);
    },
    hit(who) {
      if (who !== player) return;
      shake = 0.42;
      audio.play("hit");
      const origin = who.worldPos.clone().add(new THREE.Vector3(0, 0.75, 0));
      for (let n = 0; n < 18; n++) {
        const angle = (n / 18) * Math.PI * 2 + Math.random() * 0.2;
        const speed = 1.5 + Math.random() * 3.5;
        const velocity = new THREE.Vector3(
          Math.cos(angle) * speed,
          0.5 + Math.random() * 2.2,
          Math.sin(angle) * speed,
        );
        spawnParticle(origin, n % 3 ? "#ffd66b" : "#ff824d", 0.48, 0.12, velocity);
      }
    },
    contact(closing) {
      shake = 0.08;
      if (closing < -2) audio.play("hit");
    },
    recovered() {
      notify("BACK ON TRACK");
    },
    step(dt) {
      toastLeft = Math.max(0, toastLeft - dt);
      if (!toastLeft) toast.textContent = "";
      shake = Math.max(0, shake - dt);
      particles.step(dt);
    },
    reset() {
      toastLeft = shake = 0;
      toast.textContent = "";
      particles.clear();
      racerEffects.reset();
    },
  };
}
