import { createRacerState } from "./racer-state.js";
import { resetMotion } from "./physics.js";
import { resetRaceProgress } from "./race.js";
import { TRACK, frameAt, trackT, laneWidth, poseAt, yawFor } from "../track/track.js";

// Roster order keeps the local player first; grid order puts them last.
function gridPosition(index, count) {
  const slot = index === 0 ? count - 1 : index - 1;
  return { s: -slot * 18, x: slot % 2 === 0 ? -0.34 : 0.34 };
}

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
      isBot: index > 0 && !entry.playerId,
      ...gridPosition(index, roster.length),
      skill: index === 0 ? 0.8 : [1, 0.98, 0.96, 0.94, 0.92][index - 1],
    }),
  );
  racers.forEach(placeRacer);
  return racers;
}

export function resetRaceGrid(racers) {
  racers.forEach((racer, index) => {
    const botIndex = index - 1;
    Object.assign(racer, {
      ...gridPosition(index, racers.length),
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
      recoveryCount: 0,
      cooldown: index === 0 ? 0 : 0.6 + botIndex * 0.15,
    });
    racer.prevS = racer.s;
    resetMotion(racer);
    racer.lastSafeS = racer.s;
    racer.visualOffset?.set(0, 0, 0);
    racer.visualYawOffset = 0;
    resetRaceProgress(racer, TRACK);
    placeRacer(racer);
  });
}
