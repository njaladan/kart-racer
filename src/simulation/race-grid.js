import { createRacerState } from "./racer-state.js";
import { resetMotion } from "./physics.js";
import { resetRaceProgress } from "./race.js";
import { TRACK, frameAt, trackT, laneWidth, poseAt, yawFor } from "../track/track.js";

function placeRacer(racer) {
  racer.worldPos.copy(poseAt(racer.s, laneWidth(racer.x), 0.065).p);
  racer.renderFrom.copy(racer.worldPos);
  racer.yaw = yawFor(frameAt(trackT(racer.s)).tangent);
  racer.renderYawFrom = racer.yaw;
}

export function createRaceGrid(roster) {
  const racers = roster.map((entry, index) =>
    createRacerState({
      name: index === 0 ? "YOU" : entry.name.toUpperCase(),
      color: entry.color,
      racerId: entry.id,
      isPlayer: index === 0,
      s: index === 0 ? 0 : [-18, -30, -43, -55, -70][index - 1],
      x: index === 0 ? 0 : [-0.35, 0.32, -0.12, 0.43, -0.42][index - 1],
      skill: index === 0 ? 0.8 : [0.91, 0.86, 0.81, 0.77, 0.72][index - 1],
    }),
  );
  racers.forEach(placeRacer);
  return racers;
}

export function resetRaceGrid(racers) {
  racers.forEach((racer, index) => {
    const botIndex = index - 1;
    Object.assign(racer, {
      s: index === 0 ? 0 : -46 - Math.floor(botIndex / 2) * 60 - (botIndex % 2) * 5,
      x: index === 0 ? 0 : botIndex % 2 === 0 ? -0.4 : 0.4,
      speed: 0,
      lap: 0,
      boost: 0,
      star: 0,
      spin: 0,
      drift: 0,
      driftTier: 0,
      item: null,
      itemCount: 0,
      air: 0,
      padCooldown: 0,
      finished: false,
      finishTime: Infinity,
      finishDelay: 0,
      cooldown: index === 0 ? 0 : 4 + botIndex * 1.5,
    });
    racer.prevS = racer.s;
    resetMotion(racer);
    resetRaceProgress(racer, TRACK);
    placeRacer(racer);
  });
}
