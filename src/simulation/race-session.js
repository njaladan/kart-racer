import { advanceRacer, botInput } from "./simulation.js";
import { resetMotion } from "./physics.js";
import { ranking } from "./race.js";
import { resetRaceGrid } from "./race-grid.js";
import { resolveRacerContacts } from "./racer-contact.js";
import { poseAt, yawFor } from "../track/track.js";

/** Race lifecycle and fixed-step orchestration. No DOM, renderer, or audio ownership. */
export function createRaceSession({
  racers,
  items,
  getPlayerInput,
  onReset = () => {},
  onBegin = () => {},
  onFinish = () => {},
  onPause = () => {},
  onCountdown = () => {},
  onRecover = () => {},
  onRacerEvent = () => {},
  onHit = () => {},
  onContact = () => {},
  onStep = () => {},
}) {
  const [player, ...bots] = racers;
  const state = {
    elapsed: 0,
    raceTime: 0,
    running: false,
    paused: false,
    started: false,
    finished: false,
    countdown: 0,
  };
  function reset() {
    resetRaceGrid(racers);
    items.reset();
    Object.assign(state, {
      elapsed: 0,
      raceTime: 0,
      running: false,
      paused: false,
      started: false,
      finished: false,
      countdown: 0,
    });
    onReset();
  }
  function begin(countdown = 3.45) {
    reset();
    state.started = true;
    state.countdown = countdown;
    onBegin();
  }
  function setPaused(value) {
    if (!state.started || state.finished || state.paused === value) return;
    state.paused = value;
    onPause(value);
  }
  function hitRacer(racer, seconds = 1.1) {
    if (racer.invulnerable > 0 || racer.star > 0 || racer.finished) return false;
    racer.spin = seconds;
    racer.spinDirection = Math.sign(racer.steering || racer.yawRate || 1);
    racer.yawRate = racer.spinDirection * 15;
    racer.hitDecel = 0.85;
    racer.invulnerable = seconds + 1;
    // Keep most incoming momentum, then bleed speed through impact drag.
    racer.vx *= 0.82;
    racer.vz *= 0.82;
    racer.drift = 0;
    racer.trickActive = false;
    racer.trickBuffer = 0;
    onHit(racer);
    return true;
  }
  function recoverPlayer() {
    const pose = poseAt(player.s, 0, 0.065);
    player.worldPos.copy(pose.p);
    player.renderFrom.copy(pose.p);
    player.yaw = yawFor(pose.tangent);
    player.renderYawFrom = player.yaw;
    player.x = 0;
    resetMotion(player);
    player.spin = 0;
    player.drift = 0;
    player.invulnerable = 1.5;
    onRecover();
  }
  function moveRacer(racer, input, dt) {
    const events = advanceRacer(racer, input, dt, state.raceTime);
    if (events.wallImpact && racer.contactCooldown === 0) {
      racer.contactCooldown = 0.45;
      events.wallContact = true;
    }
    racer.speed = Math.hypot(racer.vx, racer.vz) * 3.6;
    if (!Number.isFinite(racer.worldPos.y) || racer.worldPos.y < -12) {
      if (racer === player) recoverPlayer();
      else {
        racer.worldPos.copy(poseAt(racer.s, 0, 0.065).p);
        resetMotion(racer);
      }
    }
    if (events.finished && racer === player) racer.finishDelay = 0.35;
    onRacerEvent(racer, events, dt);
  }
  function step(dt) {
    if (state.paused) return;
    state.elapsed += dt;
    if (state.countdown > 0) {
      const previous = Math.ceil(state.countdown - 0.45);
      state.countdown -= dt;
      onCountdown(state.countdown, Math.ceil(state.countdown - 0.45) < previous);
      if (state.countdown <= 0) state.running = true;
      return;
    }
    if (!state.running || state.finished) return;
    state.raceTime += dt;
    if (!player.finished) moveRacer(player, getPlayerInput(state.raceTime, racers), dt);
    else {
      player.finishDelay -= dt;
      if (player.finishDelay <= 0) {
        state.finished = true;
        state.running = false;
        state.raceTime = player.finishTime;
        onFinish();
        return;
      }
    }
    bots.forEach((bot, index) => {
      if (bot.finished) return;
      moveRacer(bot, botInput(bot, index, state.raceTime, racers), dt);
      bot.cooldown -= dt;
      if (bot.item && bot.cooldown <= 0) {
        items.fire(bot);
        bot.cooldown = 5 + Math.random() * 6;
      }
    });
    resolveRacerContacts(racers, {
      hitRacer,
      onContact(a, b, closing) {
        if ((a === player || b === player) && player.contactCooldown === 0) {
          player.contactCooldown = 0.4;
          onContact(closing);
        }
      },
    });
    items.step(dt, state.raceTime);
    onStep(dt);
  }
  return {
    getState: () => ({ ...state }),
    place: () => ranking(racers).indexOf(player) + 1,
    reset,
    begin,
    setPaused,
    recoverPlayer,
    hitRacer,
    step,
  };
}
