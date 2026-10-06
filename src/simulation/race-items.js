import { TRACK, WORLD_PER_UNIT, laneWidth, poseAt } from "../track/track.js";
import {
  createShell,
  advanceShell,
  sweptDistanceSquared,
  consumeItem,
  chooseItem,
} from "./items.js";

/** Own inventory, pickup respawns, and active item lifetimes. View operations are injected. */
export function createRaceItems({
  racers,
  boxes,
  createEffect,
  removeEffect,
  onHit,
  onInventory = () => {},
  onCollect = () => {},
  onUse = () => {},
  onImpact = () => {},
  onShellTrail = () => {},
}) {
  const projectiles = [],
    bananas = [];
  function nearestDelta(a, b) {
    let delta = (((a - b) % TRACK) + TRACK) % TRACK;
    if (delta > TRACK / 2) delta -= TRACK;
    return delta;
  }
  function setItem(who, type) {
    who.item = type;
    who.itemCount = type === "mushroom" ? 3 : 1;
    onInventory(who);
  }
  function collect(box, who) {
    if (who.item || who.finished) return;
    box.active = false;

    box.respawn = 10 + Math.random() * 4;
    setItem(who, chooseItem(who, racers));
    onCollect(who);
  }
  function fireItem(who) {
    const type = consumeItem(who);
    if (!type) return;
    const from = who.s,
      lane = who.x;
    if (type === "star") {
      who.star = 6.2;
      who.boost = 3.3;
    } else if (type === "banana") {
      for (let n = 0; n < 3; n++) {
        bananas.push({
          s: from - 14 - n * 8,
          x: lane + (n - 1) * 0.08,
          mesh: createEffect("banana"),
          life: 18,
          owner: who,
          grace: 0.6,
        });
      }
    } else if (type === "green" || type === "red") {
      const target =
        type === "red"
          ? (racers
              .filter((racer) => racer !== who && !racer.finished && racer.s > who.s)
              .sort((a, b) => a.s - b.s)[0] ?? null)
          : null;
      projectiles.push({ ...createShell(who, type, target), mesh: createEffect(type) });
    }
    onUse(who, type);
    onInventory(who);
  }
  function step(dt, raceTime) {
    for (const box of boxes) {
      if (!box.active) {
        box.respawn -= dt;
        if (box.respawn <= 0) {
          box.active = true;
        }
      } else
        for (const racer of racers) {
          if (
            !racer.finished &&
            !racer.item &&
            Math.abs(racer.worldPos.y - poseAt(box.s, laneWidth(box.x), 0.065).p.y) < 2 &&
            Math.abs(nearestDelta(racer.s, box.s)) * WORLD_PER_UNIT < 3 &&
            Math.abs(racer.x - box.x) < 0.26
          ) {
            collect(box, racer);
            break;
          }
        }
    }
    for (const banana of bananas) {
      banana.life -= dt;
      banana.grace -= dt;
      for (const racer of racers) {
        if (
          banana.life <= 0 ||
          racer.finished ||
          !racer.grounded ||
          (racer === banana.owner && banana.grace > 0)
        )
          continue;
        if (
          Math.abs(nearestDelta(racer.s, banana.s)) * WORLD_PER_UNIT < 2 &&
          Math.abs(racer.x - banana.x) < 0.22 &&
          onHit(racer)
        ) {
          banana.life = 0;
          onImpact(racer, "BANANA PEEL!");
          break;
        }
      }
    }
    for (const p of projectiles) {
      advanceShell(p, dt, raceTime);
      p.trailTime = (p.trailTime || 0) + dt;
      if (p.trailTime >= 0.045) {
        p.trailTime %= 0.045;
        onShellTrail(p);
      }
      for (const target of racers) {
        if (target.finished || p.life <= 0 || (target === p.owner && p.grace > 0)) continue;
        const center = target.worldPos.clone();
        center.y += 0.6;
        if (
          sweptDistanceSquared(center, p.previous, p.worldPos) < 1.5 ** 2 &&
          onHit(target, 1.05, p)
        ) {
          p.life = 0;
          onImpact(target, "SHELL HIT!");
          break;
        }
      }
    }
    for (const list of [projectiles, bananas])
      for (let i = list.length - 1; i >= 0; i--)
        if (list[i].life <= 0) {
          removeEffect(list[i].mesh);
          list.splice(i, 1);
        }
  }
  function reset() {
    for (const box of boxes) {
      box.active = true;
      box.respawn = 0;
    }
    for (const list of [projectiles, bananas]) {
      for (const effect of list) removeEffect(effect.mesh);
      list.length = 0;
    }
  }
  return { projectiles, bananas, setItem, fire: fireItem, step, reset };
}
