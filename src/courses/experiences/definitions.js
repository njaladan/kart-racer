const branch = (
  id,
  group,
  section,
  startFraction,
  endFraction,
  material,
  color,
  halfWidth,
  points,
  extra = {},
) => ({
  id,
  group,
  section,
  startFraction,
  endFraction,
  material,
  color,
  halfWidth,
  points,
  ...extra,
});

/** Course ideas own their topology. Values are authored in metres, not lanes. */
export function withCourseExperience(course) {
  switch (course.id) {
    case "windmill-wilds":
      course.description =
        "Explore the valley, or commit to a firefly-lit boardwalk through the deep grove before rejoining the windmills and willow maze.";
      course.branches = [
        branch(
          "firefly-grove",
          "rootwood-fork",
          1,
          0.08,
          0.95,
          "wood",
          "#82d7b3",
          5.5,
          [
            [0, 0],
            [0.08, -8],
            [0.24, -48, 3],
            [0.48, -70, 7],
            [0.7, -46, 4],
            [0.9, -10],
            [1, 0],
          ],
          { label: "FIREFLY GROVE", theme: "grove" },
        ),
      ];
      break;
    case "neon-harbor":
      course.description =
        "Port Lumen after dark: city streets, bridge traffic and optional container rooftops ending in a curved trick ramp above the cargo road.";
      course.sections[4].halfWidth = 14;
      course.branches = [
        branch(
          "container-rooftops",
          "cargo-roofs",
          4,
          0.06,
          0.94,
          "metal",
          "#e6a052",
          4.8,
          [
            [0, 0],
            [0.09, 7, 0.5],
            [0.23, 8, 5.8],
            [0.45, 7, 6],
            [0.7, 5, 6],
            [0.87, 3, 6],
            [0.95, 0, 2.5],
            [1, 0],
          ],
          {
            label: "CONTAINER ROOFTOPS",
            theme: "containers",
            dropToMain: true,
            ramp: { start: 0.77, lip: 0.88, height: 2.4 },
          },
        ),
      ];
      break;
    case "sunstone-ruins":
      course.description =
        "Race a desert expedition through the sun engine, choosing moving temple rings with different exits before the dune crescent.";
      course.branches = [
        branch(
          "sun-ring",
          "sun-engine-rings",
          4,
          0.12,
          0.9,
          "paving",
          "#e9bc6d",
          6,
          [
            [0, 0],
            [0.1, -12],
            [0.25, -38, 3],
            [0.43, -54, 5],
            [0.62, -38, 6],
            [0.82, -12, 4],
            [1, 0],
          ],
          {
            label: "SUN RING · HIGH EXIT",
            theme: "sun-ring",
            shape: "ring",
            side: -1,
            rise: 6,
            carrierSpeed: 4.5,
            bank: 0.08,
          },
        ),
        branch(
          "shadow-ring",
          "sun-engine-rings",
          4,
          0.12,
          0.72,
          "paving",
          "#b4a28c",
          6,
          [
            [0, 0],
            [0.1, 12],
            [0.3, 37, -3],
            [0.52, 45, -5],
            [0.72, 25, -3],
            [0.9, 8],
            [1, 0],
          ],
          {
            label: "SHADOW RING · EARLY EXIT",
            theme: "sun-ring",
            shape: "ring",
            side: 1,
            rise: -4,
            carrierSpeed: 3.4,
            bank: -0.08,
          },
        ),
      ];
      break;
    case "frostpeak-festival":
      course.description =
        "Climb through the winter festival, then carve an open downhill snow face via the ice chute, trick ridge or powder before returning past the cabins.";
      course.downhill = { section: 4, width: 55 };
      // A broad mountain face needs a flowing descent instead of a tightly
      // folded ribbon whose inside edge would turn over at this width.
      for (const [i, point] of [
        [24, [78, 46, 218]],
        [25, [45, 29, 223]],
        [26, [12, 17, 225]],
        [27, [-21, 10, 219]],
      ])
        course.controls[i] = point;
      course.branches = [
        branch(
          "glacier-chute",
          "dragonback-runs",
          4,
          0.04,
          0.97,
          "ice",
          "#9edfff",
          7,
          [
            [0, 0],
            [0.08, -11],
            [0.25, -31, -2],
            [0.48, -36, -3],
            [0.72, -27, -2],
            [0.9, -10],
            [1, 0],
          ],
          { label: "GLACIER CHUTE", theme: "snow", grip: 8, dropToMain: true },
        ),
        branch(
          "snow-jump-ridge",
          "dragonback-runs",
          4,
          0.04,
          0.97,
          "snow",
          "#f6bd91",
          7,
          [
            [0, 0],
            [0.08, 11],
            [0.28, 32, 2],
            [0.48, 39, 4],
            [0.7, 29, 2],
            [0.9, 11],
            [1, 0],
          ],
          {
            label: "JUMP RIDGE",
            theme: "snow",
            dropToMain: true,
            ramp: { start: 0.43, lip: 0.55, height: 2 },
          },
        ),
      ];
      break;
    case "clockwork-citadel":
      course.description =
        "Climb golden city terraces, follow either illuminated line through a flowing watch bowl, then race beneath airships and descend to the foundry streets.";
      course.branches = [
        branch(
          "watch-bowl-right",
          "watch-interior",
          2,
          0,
          1,
          "metal",
          "#d6b56b",
          7,
          [
            [0, 0],
            [1, 0],
          ],
          {
            label: "WATCH INTERIOR · RIGHT",
            theme: "watch",
            shape: "bowl",
            side: 1,
            wellRatio: 0.16,
            depthRatio: 0.36,
            maxSlope: Math.tan(Math.PI / 3) * 0.85,
          },
        ),
      ];
      course.branches.unshift(
        branch(
          "watch-bowl-left",
          "watch-interior",
          2,
          0,
          1,
          "metal",
          "#d6b56b",
          7,
          [
            [0, 0],
            [1, 0],
          ],
          {
            label: "WATCH INTERIOR · LEFT",
            theme: "watch",
            shape: "bowl",
            side: -1,
            wellRatio: 0.16,
            depthRatio: 0.36,
            maxSlope: Math.tan(Math.PI / 3) * 0.85,
            required: true,
          },
        ),
      );
      course.branches[1].required = true;
      course.watchBowl = { section: 2 };
      course.sections[2].name = "INSIDE THE WATCH";
      course.sections[2].enclosed = true;
      break;
    case "paper-revel":
      course.description =
        "A paper world changes every lap: a crease valley becomes an elevated folded bridge, then a sweeping banked paper surf.";
      course.verges = [];
      course.branches = [
        branch(
          "paper-valley",
          "paper-transform",
          3,
          0.02,
          0.98,
          "paper",
          "#f5b9d1",
          7,
          [
            [0, 0],
            [0.1, -10],
            [0.3, -28, -8],
            [0.5, -36, -12],
            [0.75, -22, -6],
            [0.92, -7],
            [1, 0],
          ],
          { label: "LAP 1 · CREASE VALLEY", theme: "paper", required: true, lap: 0 },
        ),
        branch(
          "paper-bridge",
          "paper-transform",
          3,
          0.02,
          0.98,
          "paper",
          "#ffe3a1",
          7,
          [
            [0, 0],
            [0.1, -10],
            [0.3, -35, 8],
            [0.5, -48, 15],
            [0.75, -30, 9],
            [0.92, -7],
            [1, 0],
          ],
          { label: "LAP 2 · FOLDED SKY BRIDGE", theme: "paper", required: true, lap: 1 },
        ),
        branch(
          "paper-bank",
          "paper-transform",
          3,
          0.02,
          0.98,
          "paper",
          "#a8d8ec",
          8,
          [
            [0, 0],
            [0.1, -10],
            [0.3, -45, 3],
            [0.5, -65, 6],
            [0.75, -39, 4],
            [0.92, -7],
            [1, 0],
          ],
          { label: "LAP 3 · PAPER SURF", theme: "paper", required: true, lap: 2, bank: 0.36 },
        ),
      ];
      break;
    case "tempest-causeway":
      course.description =
        "Cross wet coastal bridges in driving rain. Time a trick tap on the exposed bridge’s rising waves to launch above its heaving deck, amid lightning and rolling thunder.";
      course.storm = { period: 17, flashAt: 10.5, thunderDelay: 2.4, sway: 0.035 };
      course.bridgeSway = [1, 3, 5];
      break;
    case "railstorm-express":
      course.description =
        "Race a speeding express through colorful freight cars. Line up each launch ramp to clear the open couplings, then disembark into Ironvale.";
      course.trainRamps = { length: 10, height: 1.8, width: 8 };
      break;
    case "metronome-hall":
      course.description =
        "Race through a giant music box, bounce past playing mallet drums, pass a colossal self-bowing violin, time the brass clock pendulums, and steer against the bellows' sideways air puffs.";
      course.theme.groundHeight = -150;
      course.pendulums = course.pendulums.filter((d) => d.section !== 2);
      course.drumField = {
        section: 2,
        startFraction: 0.22,
        endFraction: 0.72,
        radius: 8.2,
        spacing: 22,
        bounce: 10.8,
      };
      course.sections[2].name = "SNARE DRUM GORGE";
      break;
    case "pelagic-glasshouse":
      course.theme.groundHeight = -86;
      course.description =
        "Explore the submerged glasshouse, or commit to a luminous lantern-eel grotto that dives away from the main reef and rejoins beyond it.";
      course.branches = [
        branch(
          "lantern-eel-grotto",
          "reef-fork",
          2,
          0.08,
          0.9,
          "glass",
          "#86ebd6",
          6,
          [
            [0, 0],
            [0.08, 9],
            [0.26, 42, -10],
            [0.5, 66, -17],
            [0.7, 44, -11],
            [0.9, 11],
            [1, 0],
          ],
          { label: "LANTERN EEL GROTTO", theme: "reef", grip: 11 },
        ),
      ];
      break;
    default:
      break;
  }
  return course;
}
