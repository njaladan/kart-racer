import { createSunGlare } from "./sun-glare.js";
import { racerProjection } from "../track/route-branches.js";
import { createBoostMotion } from "./boost-motion.js";
import * as THREE from "../../vendor/three/three.module.js";
import { lapNumber } from "../simulation/race.js";
import { FIXED_DT, MAX_SPEED, clamp, wrapAngle } from "../simulation/physics.js";
import {
  TRACK,
  activeTrack,
  frameAt,
  laneWidth,
  poseAt,
  sectionAt,
  trackT,
} from "../track/track.js";
import { updateDriftReadiness } from "./drift-readiness.js";
import { advanceSurfaceDetails } from "./surface-detail.js";
import { waterImmersion } from "./water-medium.js";
import { renderRaceHud } from "../ui/race-hud.js";

/** Own interpolated kart presentation, HUD refresh, camera motion, and drawing. */
export function createGameRenderer({
  scene,
  camera,
  renderer,
  followShadow,
  ambientLight,
  sky,
  weather,
  displayFinish,
  lighting,
  postprocessing,
  graphicsQuality,
  theme = {},
  player,
  bots,
  playerKart,
  pads,
  boxes,
  bananas,
  projectiles,
  particles,
  ui,
  audio,
  updateRadar,
  place,
  getFrameState,
  getLandscape,
  totalLaps = 3,
}) {
  const sunGlare = createSunGlare(scene, theme);
  const cameraLook = new THREE.Vector3();
  const kartUp = new THREE.Vector3(0, 1, 0);
  const kartForward = new THREE.Vector3();
  const kartRight = new THREE.Vector3();
  const kartBasis = new THREE.Matrix4();
  const shadowTilt = new THREE.Quaternion();
  const trackForward = new THREE.Vector3();
  let motionEnabled = true;
  let driftCamera = 0;
  let cameraBank = 0;
  const boostMotion = createBoostMotion();
  let boostStrength = 0;
  let boostKick = 0;
  let hudClock = 0;
  let radarClock = 0;

  function updateVehicle(state, kart, dt) {
    const frameState = getFrameState();
    const surface = racerProjection(activeTrack, state);
    const frame = surface.frame;
    const blend = dt ? frameState.accumulator / FIXED_DT : 1;
    const previousYaw = state.renderYawFrom ?? state.yaw;
    const yaw =
      previousYaw + wrapAngle(state.yaw - previousYaw) * blend + (state.visualYawOffset || 0);
    kart.root.position.copy(state.renderFrom || state.worldPos).lerp(state.worldPos, blend);
    if (state.visualOffset) kart.root.position.add(state.visualOffset);
    kartUp.copy(state.grounded && !(state.traversalIndex >= 0) ? frame.up : WORLD_UP);
    const scaleBlend = dt ? 1 - Math.exp(-10 * dt) : 1;
    kart.renderScale =
      (kart.renderScale ?? 1) + ((state.scale || 1) - (kart.renderScale ?? 1)) * scaleBlend;
    kart.root.scale.setScalar(kart.renderScale);
    kartForward.set(Math.sin(yaw), 0, Math.cos(yaw));
    kartForward.addScaledVector(kartUp, -kartForward.dot(kartUp)).normalize();
    kartRight.crossVectors(kartUp, kartForward).normalize();
    kartBasis.makeBasis(kartRight, kartUp, kartForward);
    kart.root.quaternion.setFromRotationMatrix(kartBasis);
    const flight = activeTrack.course.traversals?.[state.traversalIndex];
    if (flight?.kind === "cannon") {
      // Presentation follows the arc; gameplay continues to use the shared traversal clock.
      const q = state.traversalProgress || 0;
      kart.root.rotateX(
        Math.cos(q * Math.PI) *
          -0.32 *
          Math.sin((Math.min(1, q * 12) * Math.PI) / 2) *
          Math.sin((Math.min(1, (1 - q) * 12) * Math.PI) / 2),
      );
    }
    kart.root.position.y += state.hitLift || 0;
    if (state.spin > 0 && state.hitFlipDuration > 0) {
      const progress = clamp(state.hitFlipElapsed / state.hitFlipDuration, 0, 1);
      const flip = clamp(progress / 0.72, 0, 1);
      const easedFlip = 1 - (1 - flip) ** 3;
      const angle = easedFlip * Math.PI * 2 * (state.hitFlipDirection || 1);
      if (state.hitFlipAxis === "z") kart.root.rotateZ(angle);
      else kart.root.rotateX(angle);
    }

    if (state.trickActive) {
      const bigAir = state.jumpKind === "quarterpipe";
      const q = Math.min(1, (state.trickAge || 0) / (bigAir ? 0.7 : 0.4));
      const spin = q * q * (3 - 2 * q) * Math.PI * (bigAir ? 4 : 2);
      if (state.trickVariant === 0) kart.root.rotateY(spin);
      else if (state.trickVariant === 1) kart.root.rotateZ(spin);
      else kart.root.rotateX(-spin);
      kart.root.position.y += Math.sin(q * Math.PI) * 0.25;
    }
    const trickPose = state.trickActive ? Math.sin(Math.min(1, state.airTime / 0.42) * Math.PI) : 0;
    const bodyLean = state.grounded
      ? ((state.steering * state.speed) / MAX_SPEED) * 0.15
      : trickPose * 0.65;
    const poseBlend = dt ? 1 - Math.exp(-18 * dt) : 1;
    const hitJolt = state.spin > 0 ? Math.min(1, state.spin) : 0;
    const hitVibration =
      hitJolt *
      (0.045 * Math.sin(frameState.elapsed * 79) + 0.022 * Math.sin(frameState.elapsed * 131));
    kart.bodyGroup.rotation.z +=
      (bodyLean + hitVibration * 0.42 - kart.bodyGroup.rotation.z) * poseBlend;
    const acceleration =
      kart.previousSpeed == null || dt === 0
        ? 0
        : (state.speed - kart.previousSpeed) / Math.max(0.016, dt);
    kart.previousSpeed = state.speed;
    const pitch = THREE.MathUtils.clamp(-acceleration * 0.002, -0.09, 0.14);
    kart.bodyGroup.rotation.x +=
      (pitch - trickPose * 0.2 + hitVibration * 0.22 - kart.bodyGroup.rotation.x) * poseBlend;
    kart.bodyGroup.position.x = hitVibration;
    const suspension = kart.suspension;
    if (suspension) {
      if (!suspension.previousGrounded && state.grounded) suspension.velocity = -0.7;
      suspension.previousGrounded = state.grounded;
      const surface = sectionAt(trackT(state.s)).material;
      const rough = ["gravel", "sand", "snow", "stone", "needles"].includes(surface);
      const target = state.grounded
        ? Math.sin(frameState.elapsed * (rough ? 19 : 24)) *
          Math.min(rough ? 0.045 : 0.015, state.speed * 0.0006)
        : 0.035;
      suspension.velocity +=
        ((target - suspension.compression) * 110 - suspension.velocity * 13) * Math.min(dt, 0.033);
      suspension.compression = THREE.MathUtils.clamp(
        suspension.compression + suspension.velocity * dt,
        -0.11,
        0.06,
      );
      kart.bodyGroup.position.y = suspension.compression + Math.abs(hitVibration) * 0.3;
      for (const driver of kart.driverParts || []) {
        driver.object.rotation.z = driver.rotation.z - bodyLean * 1.2;
        driver.object.rotation.x =
          driver.rotation.x -
          pitch * 1.3 +
          Math.sin(frameState.elapsed * 8) * Math.min(0.025, state.speed * 0.0003);
        driver.object.position.y = driver.position.y - suspension.compression * 0.24;
      }
    } else {
      kart.bodyGroup.position.y =
        Math.sin(frameState.elapsed * 22) * Math.min(0.025, state.speed * 0.0003) +
        Math.abs(hitVibration) * 0.3;
    }

    for (const wheel of kart.wheels) {
      wheel.spin.rotation.x += (state.longitudinalSpeed * dt) / wheel.radius;
      wheel.pivot.rotation.y = wheel.front ? -state.steering * 0.32 : 0;
    }
    if (kart.driftReadiness) updateDriftReadiness(kart.driftReadiness, state, frameState.elapsed);
    kart.flame.visible = state.boost > 0 || state.star > 0;
    if (kart.boostGlow) {
      kart.boostGlow.visible = kart.flame.visible;
      const blueTurbo = state.driftBoost > 0 && state.driftBoostTier === 1;
      const boostColor = blueTurbo ? "#75efff" : "#ffcf68";
      kart.flame.material.color.set(boostColor);
      kart.boostGlow.material.color.set(boostColor);
      kart.boostGlow.material.opacity = 0.46 + Math.sin(frameState.elapsed * 31) * 0.05;
    }
    kart.flame.scale.set(
      1,
      0.85 + Math.sin(frameState.elapsed * 31) * 0.12,
      0.9 + Math.sin(frameState.elapsed * 43) * 0.22,
    );
    kart.aura.visible = state.star > 0;
    if (state.star > 0) {
      kart.aura.rotation.y += dt * 3;
      for (const star of kart.aura.children.slice(1)) {
        star.position.set(
          Math.cos(star.userData.a + frameState.elapsed * 2) * star.userData.r,
          0.2 + Math.sin(frameState.elapsed * 4 + star.userData.a) * 0.2,
          Math.sin(star.userData.a + frameState.elapsed * 2) * star.userData.r,
        );
        star.rotation.x += dt * 3;
      }
    }
    kart.shadow.position.set(state.worldPos.x, surface.height + 0.015, state.worldPos.z);
    kart.shadow.quaternion
      .copy(kart.root.quaternion)
      .premultiply(shadowTilt.setFromUnitVectors(kartUp, frame.up))
      .multiply(SHADOW_PLANE_ROTATION);
    const altitude = Math.max(0, state.worldPos.y - kart.shadow.position.y);
    kart.shadow.material.opacity = 0.38 / (1 + altitude * 0.25);
    kart.shadow.scale.setScalar((kart.renderScale || 1) * (1 + altitude * 0.08));
  }

  function render(dt) {
    const frameState = getFrameState();
    renderer.info?.reset();
    activeTrack.setTime(frameState.raceTime);
    if (!frameState.paused) {
      getLandscape()?.update(frameState.raceTime, {
        playerLap: player.lap,
        racers: [player, ...bots],
        playerT: trackT(player.s),
        running: frameState.running && !frameState.finished,
        motionEnabled,
      });
      for (const pad of pads) {
        const pulse = 0.5 + 0.5 * Math.sin(frameState.elapsed * 5 + pad.phase);
        pad.g.children.forEach((mesh, index) => {
          if (index > 0 && mesh.material?.emissive)
            mesh.material.emissiveIntensity = 1.2 + pulse * 2;
        });
      }
      for (const box of boxes) {
        box.group.visible = frameState.started && box.active;
        if (!box.active) continue;
        const pose = poseAt(
          box.s,
          laneWidth(box.x),
          2.3 + Math.sin(frameState.elapsed * 2.4 + box.phase) * 0.24,
        );
        box.group.position.copy(pose.p);
        box.group.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(pose.right, pose.up, pose.tangent.clone().negate()),
        );
        box.group.rotateY(frameState.elapsed * 0.6 + box.phase);
      }
      for (const banana of bananas) {
        banana.mesh.position.copy(
          (banana.fixedPosition || banana.anchor) && banana.worldPos
            ? banana.worldPos
            : poseAt(banana.s, laneWidth(banana.x), 0.25).p,
        );
        banana.mesh.rotation.y += dt * 1.5;
      }
      for (const projectile of projectiles) {
        projectile.mesh.position.copy(projectile.worldPos);
        projectile.mesh.rotation.set(0, projectile.yaw, 0);
      }
      updateVehicle(player, playerKart, dt);
      bots.forEach((bot) => updateVehicle(bot, bot.kart, dt));
    }

    hudClock += dt;
    radarClock += dt;
    if (radarClock > 0.08) {
      updateRadar();
      radarClock = 0;
    }
    if (hudClock > 0.05) {
      hudClock = 0;
      renderRaceHud(ui, {
        rank: place(),
        lap: lapNumber(player.s, TRACK, totalLaps),
        totalLaps,
        progress: player.finished ? 1 : trackProgress(player.s),
        drift: player.drift,
        speed: player.speed,
        time: frameState.raceTime,
      });
      audio.updateEngine(player.speed, frameState.running && !frameState.finished, {
        ...player,
        surfaceMaterial: racerProjection(activeTrack, player).material,
        surfaceLoose: ["sand", "snow", "gravel", "earth", "needles", "grass", "paper"].includes(
          activeTrack.surfaceAt(trackT(player.s), player.x * 6.25).material,
        ),
      });
      audio.updateWorld?.(
        activeTrack,
        player,
        frameState.raceTime,
        frameState.running && !frameState.finished,
        bots,
      );
    }

    if (!frameState.paused) updateCamera(dt, frameState);
    const waterLevel = scene.userData.waterLevel;
    const immersion = Number.isFinite(waterLevel)
      ? waterImmersion(camera.position.y, waterLevel)
      : Number(player.underwater);
    const section = sectionAt(trackT(player.s));
    const forest = ["forest", "pines"].includes(section.id);
    const enclosed =
      section.enclosed || forest || ["warehouse", "temple", "canyon"].includes(section.id);
    const atmosphereBlend = 1 - Math.exp(-1.5 * dt);
    const dryFogFar =
      theme.fogFar ??
      (forest ? 330 : theme.terrain === "concrete" ? 520 : theme.terrain === "sand" ? 670 : 720);
    const fogFar = THREE.MathUtils.lerp(dryFogFar, 200, immersion);
    scene.fog.far += (fogFar - scene.fog.far) * atmosphereBlend;
    scene.fog.near +=
      (THREE.MathUtils.lerp(enclosed ? 95 : 180, 18, immersion) - scene.fog.near) * atmosphereBlend;
    const fogColor = new THREE.Color(theme.fog || "#ffffff").lerp(
      new THREE.Color("#489da8"),
      immersion,
    );
    if (forest)
      fogColor.lerp(new THREE.Color(theme.terrain === "snow" ? "#b0cbdc" : "#91b5ac"), 0.3);
    if (section.id === "temple") fogColor.lerp(new THREE.Color("#b5a7a0"), 0.22);
    scene.fog.color.lerp(fogColor, atmosphereBlend);
    if (ambientLight)
      ambientLight.intensity +=
        ((theme.ambientIntensity ?? 1.55) * (enclosed ? 0.85 : 1) - ambientLight.intensity) *
        atmosphereBlend;
    lighting?.update(dt, player.worldPos, section, [player, ...bots]);
    advanceSurfaceDetails(scene, frameState.raceTime);
    getLandscape()?.updateCamera?.(camera.position, graphicsQuality?.getTier() ?? 3);
    sky?.update(frameState.raceTime, motionEnabled);
    sunGlare.update(frameState.raceTime, camera, immersion > 0.5, graphicsQuality?.getTier() ?? 3);
    weather?.update(frameState.raceTime, camera.position, forest);
    displayFinish?.update(
      frameState.raceTime,
      motionEnabled && frameState.running && !frameState.finished ? player.speed : 0,
      boostStrength,
      camera.aspect,
    );
    postprocessing?.setBoostMotion(boostStrength, boostKick);
    postprocessing?.setWaterMedium?.(
      Number.isFinite(waterLevel) ? immersion : 0,
      motionEnabled ? frameState.raceTime : 0,
    );
    followShadow(player.worldPos);
    if (scene.userData.wetRoadReflections && graphicsQuality?.getTier() === 3) {
      const t = trackT(player.s);
      const frame = frameAt(t);
      const ahead = frameAt(t + 20 / activeTrack.COURSE_LENGTH);
      const behind = frameAt(t - 20 / activeTrack.COURSE_LENGTH);
      scene.userData.wetReflectionSurface = {
        height: frame.p.y + 0.045,
        frozen: frameState.paused || frameState.finished,
        eligible:
          ["promenade", "downtown", "market", "cargo", "boulevard"].includes(section.id) &&
          Math.abs(frame.up.x) + Math.abs(frame.up.z) < 0.035 &&
          Math.abs(ahead.p.y - frame.p.y) < 0.25 &&
          Math.abs(behind.p.y - frame.p.y) < 0.25,
      };
    }
    particles.sync();
    renderer.shadowMap.autoUpdate = !frameState.paused && !frameState.finished;
    if (postprocessing) postprocessing.render(scene, camera);
    else renderer.render(scene, camera);
  }

  function updateCamera(dt, frameState) {
    const boost = boostMotion.update(
      player,
      motionEnabled && frameState.running && !frameState.finished,
      dt,
    );
    boostStrength = boost.strength;
    boostKick = boost.kick;
    const previousYaw = player.renderYawFrom ?? player.yaw;
    const yaw =
      previousYaw +
      wrapAngle(player.yaw - previousYaw) * (dt ? frameState.accumulator / FIXED_DT : 1);
    // Follow travel direction through a slide so the road stays visible while
    // the kart points into the corner. Keep the kart-facing view in reverse.
    const velocityYaw = Math.atan2(-player.vx, -player.vz);
    const movingForward = player.speed > 8 && player.longitudinalSpeed > 0;
    const travelBlend = player.driftDirection ? 0.75 : 0.35;
    const cameraYaw = movingForward ? yaw + wrapAngle(velocityYaw - yaw) * travelBlend : yaw;
    const forward =
      player.spin > 0
        ? trackForward
            .copy(frameAt(trackT(player.s)).tangent)
            .setY(0)
            .normalize()
        : new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const position = playerKart.root.position.clone();
    position.y -= player.hitLift || 0;
    const driftCameraTarget =
      motionEnabled &&
      frameState.running &&
      player.driftBoost > 0 &&
      player.boost > 0 &&
      player.spin <= 0
        ? player.driftBoostTier === 2
          ? 1
          : 0.75
        : 0;
    driftCamera += (driftCameraTarget - driftCamera) * (1 - Math.exp(-8 * dt));
    const panoramic = camera.aspect > 1.8;
    const viewScale = Math.max(0.55, playerKart.renderScale || 1);
    const look = position.clone().addScaledVector(forward, panoramic ? 4.5 : 6);
    look.y += 1.15;
    const desired = position
      .clone()
      .addScaledVector(
        forward,
        -(panoramic ? 10.5 : 8.7) * viewScale -
          player.speed * 0.017 -
          boostStrength * 2.8 -
          boostKick * 1.2 -
          driftCamera * 0.4,
      );
    desired.y += 4.7 * viewScale - boostStrength * 0.35;
    const flight = activeTrack.course.traversals?.[player.traversalIndex];
    if (flight?.kind === "cannon" && flight.straight) {
      const reveal = Math.sin((player.traversalProgress || 0) * Math.PI);
      desired.addScaledVector(forward, -12 * reveal);
      desired.y += 18 * reveal;
      look.y -= 32 * reveal;
    }
    camera.position.lerp(desired, 1 - Math.exp(-(9 - boostStrength * 4) * dt));
    cameraLook.lerp(look, 1 - Math.exp(-(12 - boostStrength * 3) * dt));
    const cameraTrack = racerProjection(activeTrack, player, camera.position);
    camera.position.y = Math.max(camera.position.y, cameraTrack.height + 2.1);
    camera.fov +=
      ((panoramic ? 68 : 63) +
        Math.min(7, player.speed * 0.045) +
        boostStrength * 13 +
        boostKick * 4 +
        driftCamera * 3.5 -
        camera.fov) *
      (1 - Math.exp(-(boostStrength > 0.1 ? 12 : 5) * dt));
    camera.updateProjectionMatrix();
    camera.lookAt(cameraLook);
    const bankTarget =
      motionEnabled && player.grounded && player.spin <= 0
        ? -player.steering * Math.min(0.021, player.speed * 0.0003)
        : 0;
    cameraBank += (bankTarget - cameraBank) * (1 - Math.exp(-5 * dt));
    camera.rotation.z += cameraBank;
    // Bounded vibration: the chase rig strains under acceleration, while the
    // road and kart stay readable. Race time keeps pause/resume deterministic.
    const vibration = boostStrength * 0.0025 + boostKick * 0.005;
    camera.rotation.x += Math.sin(frameState.raceTime * 67) * vibration;
    camera.rotation.y += Math.sin(frameState.raceTime * 53) * vibration * 0.7;
    camera.rotation.z += Math.sin(frameState.raceTime * 43) * vibration;
    if (motionEnabled && frameState.shake) {
      camera.rotation.z += (Math.random() - 0.5) * frameState.shake * 0.05;
    }
  }

  return {
    render,
    setOptions: (preferences) => {
      motionEnabled = preferences.motion;
    },
    updateVehicle,
    cameraLook,
    getDriftCamera: () => driftCamera,
    reset: () => {
      driftCamera = 0;
      cameraBank = 0;
      boostMotion.reset();
      boostStrength = boostKick = 0;
      camera.fov = camera.aspect > 1.8 ? 68 : 63;
      camera.updateProjectionMatrix();
    },
  };
}

function trackProgress(distance) {
  return (((distance % TRACK) + TRACK) % TRACK) / TRACK;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const SHADOW_PLANE_ROTATION = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2,
);
