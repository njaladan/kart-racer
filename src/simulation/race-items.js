import { TRACK, WORLD_PER_UNIT, laneWidth, poseAt, activeTrack } from "../track/track.js";
import {
  createShell,
  advanceShell,
  sweptDistanceSquared,
  consumeItem,
  chooseItem,
} from "./items.js";

export const ITEM_ROLL_DURATION = 1.6;
const ROLL_ITEMS = ["mushroom", "green", "red", "banana", "star"];

/** Own inventory, pickup respawns, and active item lifetimes. View operations are injected. */
export function createRaceItems({
  racers,
  boxes,
  createEffect,
  removeEffect,
  onHit,
  onInventory = () => {},
  onCollect = () => {},
  onRoll = () => {},
  onSelect = () => {},
  onUse = () => {},
  onImpact = () => {},
  onShellTrail = () => {},
}) {
  const projectiles = [],
    bananas = [];
  const rolls = new Map();
  function nearestDelta(a, b) {
    let delta = (((a - b) % TRACK) + TRACK) % TRACK;
    if (delta > TRACK / 2) delta -= TRACK;
    return delta;
  }
  function setItem(who, type) {
    rolls.delete(who);
    who.itemRoulette = 0;
    who.itemPreview = null;
    who.item = type;
    who.itemCount = type === "mushroom" ? 3 : type ? 1 : 0;
    onInventory(who);
  }
  function collect(box, who) {
    if (who.finished) return;
    box.active = false;

    box.respawn = 10 + Math.random() * 4;
    const awarded = !who.item && !rolls.has(who);
    onCollect(who, awarded);
    if (awarded) {
      who.itemRoulette = ITEM_ROLL_DURATION;
      who.itemPreview = ROLL_ITEMS[Math.floor(Math.random() * ROLL_ITEMS.length)];
      rolls.set(who, { nextTick: 0.12, tick: 0 });
      onInventory(who);
    }
  }
  function rollTick(who, roll) {
    const choices = ROLL_ITEMS.filter((type) => type !== who.itemPreview);
    who.itemPreview = choices[Math.floor(Math.random() * choices.length)];
    onInventory(who);
    onRoll(who, roll.tick++);
    // The slot slows down as it approaches the final selection.
    roll.nextTick += 0.065 + (1 - who.itemRoulette / ITEM_ROLL_DURATION) ** 2 * 0.16;
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
      const s = from - 14;
      const branch = activeTrack.branches[who.routeChoice - 1];
      bananas.push({
        s,
        x: lane,
        routeChoice: who.routeChoice || 0,
        fixedPosition: true,
        worldPos: branch
          ? branch.poseAt(
              (activeTrack.trackT(s) - branch.start) / (branch.end - branch.start),
              laneWidth(lane),
              0.25,
            ).p
          : poseAt(s, laneWidth(lane), 0.25).p,
        mesh: createEffect("banana"),
        life: 18,
        owner: who,
        grace: 0.6,
      });
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
    for (const [who, roll] of rolls) {
      if (who.finished) {
        setItem(who, null);
        continue;
      }
      who.itemRoulette = Math.max(0, who.itemRoulette - dt);
      if (who.itemRoulette === 0) {
        setItem(who, chooseItem(who, racers));
        onSelect(who);
      } else {
        roll.nextTick -= dt;
        while (roll.nextTick <= 0) rollTick(who, roll);
      }
    }
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
            racer.worldPos.distanceTo(poseAt(box.s, laneWidth(box.x), 0.065).p) < 3.3 &&
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
          racer.worldPos.distanceTo(
            banana.worldPos || poseAt(banana.s, laneWidth(banana.x), 0.25).p,
          ) < 1.6 &&
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
    rolls.clear();
    for (const racer of racers) {
      racer.itemRoulette = 0;
      racer.itemPreview = null;
    }
    for (const box of boxes) {
      box.active = true;
      box.respawn = 0;
    }
    for (const list of [projectiles, bananas]) {
      for (const effect of list) removeEffect(effect.mesh);
      list.length = 0;
    }
  }
  return { boxes, projectiles, bananas, setItem, fire: fireItem, step, reset };
}
