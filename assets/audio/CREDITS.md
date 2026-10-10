# Course music and recorded effects

Music and water effects are existing online recordings, bundled locally without
remixing or re-encoding. Countdown tones are original synthesized effects.
Music loops indefinitely through Web Audio, preserving
the intro/loop start from the original `.music` metadata where supplied.
Only the current course's music is downloaded by the browser.

## Soundtrack

Source: [SuperTuxKart music](https://github.com/Nomagno/stk-assets/tree/master/music).
Original project: [SuperTuxKart](https://supertuxkart.net).
Full upstream copyright notices are preserved in [licenses/stk-music.txt](licenses/stk-music.txt).
The recordings remain under their individual licenses; those licenses apply to
the audio assets, separately from the game's code. All music below is
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

| Course | Recording | Composer / attribution | Choice |
| --- | --- | --- | --- |
| Windmill Wilds | `farm.ogg` — Golden Fields | Krobonil & OzoneOne | A pastoral country race through orchards, woodland and a working mill. |
| Neon Harbor | `jumping_to_the_stars_remake.ogg` — Jumping to the Stars | GeekPenguinBR; remake by Heuchi1 (2016, 2022) | Bright electronic momentum for the neon streets and rooftop routes. |
| Sunstone Ruins | `hacienda.ogg` — Hacienda | Claude Werner (bollen) | Warm, earthy adventure for sandstone, sunlit ruins and torchlit chambers. |
| Frostpeak Festival | `celtic.ogg` — Scottish Bagpipes | OzoneOne & Krobonil | Festive folk energy for the mountain village and open ski descent. |
| Clockwork Citadel | `ravenbridge_mansion.ogg` — Ravenbridge Mansion | Krobonil & OzoneOne (2017) | Old-world atmosphere for towers, intricate machinery and a watch movement. |
| Paper Revel | `Penguin_Party.ogg` — Penguin Party | Magne Djupvik | Playful party music for colorful origami and a changing festival route. |
| Tempest Causeway | `SkyVibe-HighFrequency.ogg` — Sky Vibe: High Frequency | Speedsound; modified by Constantin Pelikan | Driving electronic tension for the exposed storm crossing. |
| Pocket Pantry | `garden.ogg` — Secret Garden | DJ Helium | A lighter, whimsical backing for the miniature kitchen adventure. |
| Railstorm Express | `West.ogg` — West | Chris Leutwyler (Krobonil) | A western rail journey through cliffs and moving freight cars. |
| Metronome Hall | `kart_grand_prix.ogg` — Kart Grand Prix | Weirwood | A strongly paced race theme for timed mechanisms and drum jumps. |
| Pelagic Glasshouse | `subsea.ogg` — Subsea | Claude Werner (bollen) | An aquatic theme for glass domes, reefs and the lantern-eel grotto. |
| Emberwing Observatory | `landing_in_gran_paradiso.ogg` — Landing in Gran Paradiso | OzoneOne & Krobonil | A sunny island adventure for the seaside village, gardens and harbor. |

`Penguin_Party.ogg` is listed as `penguin_party.ogg` in the upstream license
file; the original recording is distributed with the capitalized filename.
Its upstream license permits CC BY-SA 3.0 or later; this distribution uses 3.0.

## Effects

| Local file | Original recording | Creator | License |
| --- | --- | --- | --- |
| `sfx/countdown-beep.ogg`, `countdown-start.ogg` | Original arcade starting-light tones: three 880 Hz beeps, followed by a longer 1760 Hz start tone | Turbo Trail contributors | Same license as the game code |
| `sfx/bubble.wav` | `inventory/bubble3.wav` from [RPG Sound Pack](https://opengameart.org/content/rpg-sound-pack) | artisticdude | CC0 1.0 |
| `sfx/splash.ogg` | [SuperTuxKart splash](https://github.com/Nomagno/stk-assets/blob/master/sfx/splash.ogg) | The Audio Monkey (2017); minor edits by OzoneOne (2017) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

The bubble recording was retrieved through the
[public sound-effects mirror](https://github.com/Mcamento8/open-game-sfx-index),
whose [source list](https://github.com/Mcamento8/open-game-sfx-index/blob/main/SOURCES.md)
identifies the original packs. Splash attribution is preserved in
[licenses/stk-sfx.txt](licenses/stk-sfx.txt), with its original source:
[The Audio Monkey sound pack](https://forum.freegamedev.net/viewtopic.php?f=18&t=7425).

The runtime applies volume changes and a temporary underwater low-pass filter;
the bundled upstream recordings are unmodified. File hashes, synthesis details
and repository revisions are recorded in [manifest.json](manifest.json).
