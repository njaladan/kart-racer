/** Six distinct SuperTuxKart characters and their authored vehicles. */
export const RACERS = Object.freeze(
  [
    { id: "tux", name: "Tux", kind: "Penguin", color: "#e74736" },
    { id: "nolok", name: "Nolok", kind: "Reptile", color: "#c48d36" },
    { id: "pidgin", name: "Pidgin", kind: "Bird", color: "#9c68c8" },
    { id: "kiki", name: "Kiki", kind: "Robot", color: "#43bee9" },
    { id: "konqi", name: "Konqi", kind: "Dragon", color: "#5cba45" },
    { id: "wilber", name: "Wilber", kind: "Mascot", color: "#f19a35" },
  ].map(Object.freeze),
);

export function raceRoster(selectedId) {
  const selected = RACERS.find((racer) => racer.id === selectedId) ?? RACERS[0];
  return [selected, ...RACERS.filter((racer) => racer !== selected)];
}
