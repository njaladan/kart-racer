/** Forest depth, lived-in houses and physical snow/wood boundaries. */
export function buildWinterValley({ THREE, scenery, track, festival }) {
  const { asset, sectorT, edgeOffset, safeGroup, chalet, pole } = festival;
  for (let section = 0; section < track.SECTIONS.length; section++) {
    const count = section === 1 ? 29 : section === 2 ? 12 : section === 6 ? 5 : 15;
    for (let i = 0; i < count; i++)
      for (const side of [-1, 1]) {
        if (section === track.course.downhill?.section || (section === 3 && side === 1)) continue;
        const t = sectorT(section, (i + 0.45) / count);
        const height = 10 + (i % 5) * 1.6;
        for (const depth of [0, 21]) {
          if (depth && i % 2) continue;
          const g = safeGroup(t, edgeOffset(t, side, 7 + height * 0.38 + depth), height * 0.39);
          if (!g) continue;
          g.rotation.y += i * 2.399;
          asset("frostpeak:pine-near", g, [0, 0, 0], [height * 0.76, height, height * 0.76]);
          if (i % 3 === 0) asset("frostpeak:snow-bush", g, [side * 3, -0.15, 1], [2.5, 1.7, 2.5]);
        }
      }
  }
  for (const section of [0, 6, 7])
    for (let i = 0; i < (section === 6 ? 13 : 6); i++)
      for (const side of [-1, 1])
        chalet(
          section,
          (i + 0.3) / (section === 6 ? 13 : 6),
          side,
          8.5 + (i % 3) * 1.8,
          section === 6 ? 5 : 12,
        );

  for (let section = 0; section < 8; section++) {
    const count = Math.ceil(
      ((track.SECTIONS[section].end - track.SECTIONS[section].start) * track.COURSE_LENGTH) / 7,
    );
    for (let i = 0; i < count; i++)
      for (const side of [-1, 1]) {
        const t = sectorT(section, (i + 0.5) / count);
        if (i % 5 === 0 && [0, 3, 6, 7].includes(section)) {
          const lamp = safeGroup(t, edgeOffset(t, side, 3.5), 1.2);
          if (lamp) pole(lamp, 0, 0, 0, 4.8);
        }
      }
  }
}
