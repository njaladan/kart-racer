const REQUIRED_THEME_COLORS = [
  "sky",
  "fog",
  "ground",
  "road",
  "shoulder",
  "hemisphere",
  "ambientGround",
  "sun",
];

function fail(course, path, expected) {
  throw new TypeError(
    `Course "${course?.id ?? "<unknown>"}" has invalid ${path}: expected ${expected}`,
  );
}

function finite(
  course,
  value,
  path,
  { min = -Infinity, max = Infinity, exclusiveMin = false } = {},
) {
  if (!Number.isFinite(value) || (exclusiveMin ? value <= min : value < min) || value > max) {
    fail(
      course,
      path,
      `a finite number${Number.isFinite(min) ? ` ${exclusiveMin ? ">" : ">="} ${min}` : ""}${Number.isFinite(max) ? ` and <= ${max}` : ""}`,
    );
  }
}

function sectionFraction(course, item, path) {
  if (
    !Number.isInteger(item?.section) ||
    item.section < 0 ||
    item.section >= course.sections.length
  ) {
    fail(course, `${path}.section`, `an integer from 0 to ${course.sections.length - 1}`);
  }
  finite(course, item.fraction, `${path}.fraction`, { min: 0, max: 1 });
}

/** Validate the authored data contract before track construction uses it. */
export function validateCourseDefinition(course) {
  if (!course || typeof course !== "object") fail(course, "descriptor", "an object");
  for (const field of ["id", "name", "description"]) {
    if (typeof course[field] !== "string" || !course[field].trim()) {
      fail(course, field, "a non-empty string");
    }
  }
  finite(course, course.targetLength, "targetLength", {
    min: 0,
    exclusiveMin: true,
  });

  if (!Array.isArray(course.controls) || course.controls.length < 6) {
    fail(course, "controls", "at least six world-space [x, y, z] points");
  }
  course.controls.forEach((point, index) => {
    if (
      !Array.isArray(point) ||
      point.length !== 3 ||
      point.some((value) => !Number.isFinite(value))
    ) {
      fail(course, `controls[${index}]`, "three finite world-space coordinates");
    }
  });

  if (!Array.isArray(course.sections) || course.sections.length < 6) {
    fail(course, "sections", "at least six section descriptors");
  }
  let previousControlIndex = -1;
  course.sections.forEach((section, index) => {
    for (const field of ["id", "name", "hint", "material", "color"]) {
      if (typeof section?.[field] !== "string" || !section[field].trim()) {
        fail(course, `sections[${index}].${field}`, "a non-empty string");
      }
    }
    if (
      !Number.isInteger(section.controlIndex) ||
      section.controlIndex <= previousControlIndex ||
      section.controlIndex >= course.controls.length
    ) {
      fail(
        course,
        `sections[${index}].controlIndex`,
        "an increasing control-point index within controls",
      );
    }
    previousControlIndex = section.controlIndex;
    finite(course, section.halfWidth, `sections[${index}].halfWidth`, {
      min: 0,
      exclusiveMin: true,
    });
    if (section.grip != null)
      finite(course, section.grip, `sections[${index}].grip`, {
        min: 0,
        exclusiveMin: true,
      });
  });
  if (course.sections[0].controlIndex !== 0)
    fail(course, "sections[0].controlIndex", "0 so sections cover the full loop");

  for (const [index, ramp] of (course.ramps || []).entries()) {
    sectionFraction(course, ramp, `ramps[${index}]`);
    finite(course, ramp.halfLength, `ramps[${index}].halfLength`, {
      min: 0,
      exclusiveMin: true,
    });
    finite(course, ramp.height, `ramps[${index}].height`, {
      min: 0,
      exclusiveMin: true,
    });
    if (ramp.offset != null) finite(course, ramp.offset, `ramps[${index}].offset`);
    if (ramp.width != null)
      finite(course, ramp.width, `ramps[${index}].width`, { min: 0, exclusiveMin: true });
    if (ramp.halfWidth != null)
      finite(course, ramp.halfWidth, `ramps[${index}].halfWidth`, { min: 0, exclusiveMin: true });
  }
  for (const [index, pad] of (course.pads || []).entries()) {
    sectionFraction(course, pad, `pads[${index}]`);
    finite(course, pad.offset, `pads[${index}].offset`);
    finite(course, pad.duration, `pads[${index}].duration`, {
      min: 0,
      exclusiveMin: true,
    });
  }
  if (!Array.isArray(course.itemRows) || course.itemRows.length === 0) {
    fail(course, "itemRows", "at least one pickup row");
  }
  course.itemRows.forEach((row, index) => {
    sectionFraction(course, row, `itemRows[${index}]`);
    if (row.offsets != null) {
      if (!Array.isArray(row.offsets) || row.offsets.length === 0)
        fail(course, `itemRows[${index}].offsets`, "a non-empty list of lateral offsets");
      row.offsets.forEach((offset, lane) =>
        finite(course, offset, `itemRows[${index}].offsets[${lane}]`),
      );
    }
  });

  const shortcut = course.shortcut;
  sectionFraction(
    course,
    { section: shortcut?.section, fraction: shortcut?.startFraction },
    "shortcut.startFraction",
  );
  finite(course, shortcut.endFraction, "shortcut.endFraction", {
    min: 0,
    max: 1,
  });
  if (shortcut.endFraction <= shortcut.startFraction)
    fail(course, "shortcut", "an endFraction after startFraction");
  finite(course, shortcut.extraWidth, "shortcut.extraWidth", {
    min: 0,
    exclusiveMin: true,
  });
  if (shortcut.drag != null)
    finite(course, shortcut.drag, "shortcut.drag", {
      min: 0,
      exclusiveMin: true,
    });

  sectionFraction(course, course.hazard, "hazard");
  for (const field of ["kind", "label"]) {
    if (typeof course.hazard[field] !== "string" || !course.hazard[field].trim()) {
      fail(course, `hazard.${field}`, "a non-empty string");
    }
  }
  for (const field of ["parkOffset", "minOffset", "safeLane"])
    finite(course, course.hazard[field], `hazard.${field}`);
  for (const field of ["halfWidth", "halfLength", "period"]) {
    finite(course, course.hazard[field], `hazard.${field}`, {
      min: 0,
      exclusiveMin: true,
    });
  }
  finite(course, course.hazard.activation, "hazard.activation", { min: 0 });
  finite(course, course.hazard.warningSeconds, "hazard.warningSeconds", {
    min: 0,
  });
  if (course.hazard.warningSeconds >= course.hazard.period) {
    fail(course, "hazard.warningSeconds", "a value shorter than hazard.period");
  }

  for (const [index, surface] of (course.surfaces || []).entries()) {
    sectionFraction(
      course,
      { section: surface.section, fraction: surface.startFraction },
      `surfaces[${index}].startFraction`,
    );
    finite(course, surface.endFraction, `surfaces[${index}].endFraction`, {
      min: 0,
      max: 1,
    });
    if (surface.endFraction <= surface.startFraction)
      fail(course, `surfaces[${index}]`, "an endFraction after startFraction");
    if (typeof surface.material !== "string" || !surface.material.trim())
      fail(course, `surfaces[${index}].material`, "a non-empty string");
    if (surface.grip != null)
      finite(course, surface.grip, `surfaces[${index}].grip`, {
        min: 0,
        exclusiveMin: true,
      });
  }
  for (const [index, range] of (course.elevated || []).entries()) {
    sectionFraction(
      course,
      { section: range.section, fraction: range.startFraction },
      `elevated[${index}].startFraction`,
    );
    finite(course, range.endFraction, `elevated[${index}].endFraction`, {
      min: 0,
      max: 1,
    });
    if (range.endFraction <= range.startFraction)
      fail(course, `elevated[${index}]`, "an endFraction after startFraction");
  }

  for (const [index, verge] of (course.verges || []).entries()) {
    sectionFraction(
      course,
      { section: verge.section, fraction: verge.startFraction },
      `verges[${index}].startFraction`,
    );
    finite(course, verge.endFraction, `verges[${index}].endFraction`, {
      min: 0,
      max: 1,
    });
    if (verge.endFraction <= verge.startFraction)
      fail(course, `verges[${index}]`, "an endFraction after startFraction");
    if (verge.side !== -1 && verge.side !== 1) fail(course, `verges[${index}].side`, "-1 or 1");
    finite(course, verge.extraWidth, `verges[${index}].extraWidth`, {
      min: 0,
      exclusiveMin: true,
    });
    if (typeof verge.material !== "string" || !verge.material.trim())
      fail(course, `verges[${index}].material`, "a non-empty string");
    if (verge.grip != null)
      finite(course, verge.grip, `verges[${index}].grip`, {
        min: 0,
        exclusiveMin: true,
      });
    if (verge.drag != null)
      finite(course, verge.drag, `verges[${index}].drag`, {
        min: 0,
        exclusiveMin: true,
      });
  }

  for (const [index, conveyor] of (
    course.conveyors || (course.conveyor ? [course.conveyor] : [])
  ).entries()) {
    sectionFraction(
      course,
      { section: conveyor.section, fraction: conveyor.startFraction },
      `conveyors[${index}].startFraction`,
    );
    finite(course, conveyor.endFraction, `conveyors[${index}].endFraction`, { min: 0, max: 1 });
    if (conveyor.endFraction <= conveyor.startFraction)
      fail(course, `conveyors[${index}]`, "an endFraction after startFraction");
    finite(course, conveyor.speed, `conveyors[${index}].speed`, { min: 0, exclusiveMin: true });
    finite(course, conveyor.blendDistance ?? 0, `conveyors[${index}].blendDistance`, { min: 0 });
  }

  for (const field of REQUIRED_THEME_COLORS) {
    if (typeof course.theme?.[field] !== "string" || !course.theme[field].trim()) {
      fail(course, `theme.${field}`, "a non-empty color string");
    }
  }
  for (const field of ["sunIntensity", "exposure"])
    finite(course, course.theme[field], `theme.${field}`);
  if (course.id !== "windmill-wilds" && typeof course.buildWorld !== "function") {
    fail(course, "buildWorld", "a scenery builder function for asset-backed courses");
  }
  if (course.buildWorld != null && typeof course.buildWorld !== "function") {
    fail(course, "buildWorld", "a scenery builder function when provided");
  }
  return course;
}
