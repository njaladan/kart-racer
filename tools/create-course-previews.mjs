import { mkdirSync, writeFileSync } from "node:fs";
import { COURSES } from "../src/courses/registry.js";
mkdirSync("assets/previews", { recursive: true });
const worlds = {
  "windmill-wilds": ["#6baf90", "#213e59", "#dfb767", "mill"],
  "neon-harbor": ["#53659e", "#162939", "#71ede2", "city"],
  "sunstone-ruins": ["#f3c983", "#af796c", "#ffe9b3", "temple"],
  "frostpeak-festival": ["#98c6ed", "#454e86", "#e8fbff", "mountain"],
  "clockwork-citadel": ["#a7a4d7", "#39375b", "#e6b55c", "clock"],
  "pocket-pantry": ["#f4baac", "#825f74", "#fff0bc", "kitchen"],
  "railstorm-express": ["#829caf", "#263d53", "#f9bc70", "train"],
  "paper-revel": ["#f7b3c5", "#7974bd", "#ffee9b", "paper"],
  "tempest-causeway": ["#638ba2", "#1b3044", "#afebe8", "bridge"],
  "metronome-hall": ["#d9b582", "#45335e", "#ffcf8c", "clock"],
  "pelagic-glasshouse": ["#7ed3c5", "#17495d", "#cff7dd", "glass"],
  "emberwing-observatory": ["#c98e93", "#3d315b", "#ffcb79", "volcano"],
};
for (const course of COURSES) {
  const [sky, base, accent, motif] = worlds[course.id];
  let art = "";
  const tower = (x, y, w, h) =>
    `<path d="M${x - w / 2} 390V${y}h${w}v${h}h-${w}z" fill="${base}"/><path d="M${x - w / 2 - 8} ${y}l${w / 2 + 8} -25 ${w / 2 + 8} 25z" fill="${accent}"/>`;
  if (motif === "temple") {
    for (let i = 0; i < 5; i++)
      art += `<path d="M${650 + i * 22} ${365 - i * 32}h${380 - i * 44}v32H${650 + i * 22}z" fill="${i % 2 ? accent : base}"/>`;
    art += `<circle cx="840" cy="165" r="47" fill="none" stroke="${accent}" stroke-width="9"/>`;
  }
  if (["clock", "city", "mill"].includes(motif)) {
    for (let i = 0; i < 7; i++) art += tower(650 + i * 70, 170 + (i % 3) * 35, 45, 230);
    if (motif === "clock")
      art += `<circle cx="860" cy="240" r="52" fill="${accent}"/><path d="M860 210v30l27 15" stroke="${base}" stroke-width="7" fill="none"/>`;
    if (motif === "mill")
      art += `<path d="M720 230l-80 -70m80 70 80 70m-80 -70 70 -80m-70 80 -70 80" stroke="${accent}" stroke-width="17"/>`;
  }
  if (["bridge", "train"].includes(motif)) {
    art += `<path d="M500 285L1180 220v28L500 313z" fill="${accent}"/>`;
    for (let i = 0; i < 7; i++)
      art += `<path d="M${590 + i * 87} 290v140" stroke="${base}" stroke-width="18"/>`;
    if (motif === "train")
      for (let i = 0; i < 5; i++)
        art += `<rect x="${680 + i * 72}" y="205" width="66" height="42" rx="7" fill="${base}"/><rect x="${690 + i * 72}" y="211" width="44" height="12" rx="2" fill="${accent}"/>`;
  }
  if (["paper", "mountain", "volcano"].includes(motif)) {
    for (let i = 0; i < 5; i++)
      art += `<path d="M${530 + i * 125} 400l120 -${180 + (i % 3) * 35} 120 ${180 + (i % 3) * 35}z" fill="${i % 2 ? accent : base}" opacity=".85"/>`;
    if (motif === "paper")
      for (let i = 0; i < 12; i++)
        art += `<path d="M${620 + i * 47} ${90 + (i % 3) * 22}l18 30 -25 -10 7 -20z" fill="${accent}"/>`;
  }
  if (motif === "glass") {
    for (let i = 0; i < 4; i++)
      art += `<path d="M${650 + i * 112} 370v-80a58 80 0 0 1 116 0v80z" fill="${accent}" opacity=".45" stroke="${base}" stroke-width="5"/>`;
  }
  if (motif === "kitchen") {
    for (let i = 0; i < 4; i++)
      art += `<rect x="${640 + i * 116}" y="${190 - (i % 2) * 50}" width="90" height="200" rx="24" fill="${i % 2 ? base : accent}"/><rect x="${636 + i * 116}" y="${180 - (i % 2) * 50}" width="98" height="25" rx="8" fill="${base}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 430"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${base}"/></linearGradient><linearGradient id="r" x2="0" y2="1"><stop stop-color="${accent}"/><stop offset="1" stop-color="${base}"/></linearGradient></defs><rect width="1200" height="430" fill="url(#s)"/><circle cx="970" cy="107" r="70" fill="${accent}" opacity=".5"/><path d="M0 275Q240 180 470 275T1200 265V430H0z" fill="${base}" opacity=".24"/>${art}<path d="M0 430Q260 310 540 360T1200 370V430z" fill="${base}"/><path d="M370 430Q530 320 780 340T1060 280" fill="none" stroke="${base}" stroke-width="75"/><path d="M370 430Q530 320 780 340T1060 280" fill="none" stroke="url(#r)" stroke-width="55"/><path d="M370 430Q530 320 780 340T1060 280" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="15 20" opacity=".8"/></svg>`;
  writeFileSync(`assets/previews/${course.id}.svg`, svg);
}
