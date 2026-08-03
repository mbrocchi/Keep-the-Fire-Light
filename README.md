# Keep The Fire Light

A daily ritual for family and friends. Everyone in a **campsite** shares one virtual
campfire. Solve the day's five-letter word and you stoke it; leave a note in the
logbook while you're there. Nobody plays, and the fire burns down to cold ashes
over 24 hours.

Built mobile-first, and designed to be played from phones on your home Wi-Fi.

---

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:3000>.

### Playing from phones on the same Wi-Fi

```bash
npm run lan
```

That prints the addresses your machine is reachable on, e.g. `http://192.168.1.42:3000`.
Type one into a phone's browser and it just works — the dev server already binds to
all interfaces.

If a phone can't connect, Windows Firewall is blocking the port. In an **administrator**
PowerShell:

```bash
netsh advfirewall firewall add rule name="KeepTheFireLight" dir=in action=allow protocol=TCP localport=3000
```

### Demo camp

```bash
npm run seed -- --fresh
```

Creates **The Whitmore Fire** (code `CAMP77`) with four members — `jo`, `marcus`,
`priya`, `sam`, all with password `camp`. Two have already solved today, so the
fire starts partway up and the logbook isn't empty. Safe to run while `npm run dev`
is up — the server notices the file changing and reloads it.

```bash
npm test
```

---

## The artwork

Your three images in `Mockup/` are the source of truth. `npm run dev` copies them into
`public/art/` first (`scripts/sync-art.mjs`), so replacing a PNG and restarting picks
it up — nothing is baked in.

| File | Used as |
| --- | --- |
| `Mockup/Background.png` | the camp screen, and dimmed behind the sign-in screens |
| `Mockup/title.png` | the title screen |
| `Mockup/logo.png` | the patch badge in the HUD and above every form |

Both backgrounds are 768×1376. The app renders them at that exact aspect ratio and
**never crops them** — leftover height becomes a cream matte matching the paper border
painted into the images, so it reads as a framed poster. Everything overlaid is
positioned as a percentage of the picture, which is why the simulated fire lands on
the painted stone ring identically on a 375px phone and a desktop browser.

`Stage` takes a `reserveBottom`, which the camp screen uses to keep the action bar's
height free. The picture shrinks to fit above it rather than being overlapped, so no
viewport — however short — can push a control onto the fire pit.

---

## The campfire

Three layers inside the artwork frame, all driven by one shared intensity value.

**`components/campfire/Campfire.tsx`** — a WebGL2 canvas over the fire pit doing three
things in two passes:

- *Heat distortion.* `background.png` is uploaded as a texture, so the shader samples
  the actual painting and displaces it with rising noise. The alpha fades out with the
  displacement, which is why the plume leaves no seam against the CSS layer behind it.
  The tent, trees and lantern genuinely shimmer through the heat.
- *Flames.* Three noise-eroded teardrops at different scales, speeds and offsets, shaded
  through a black-body ramp from white-hot core to dull red, drawn additively. Below a
  faint heat threshold there are no flames at all, only coals.
- *Sparks.* Up to ~420 embers as additive point sprites. They rise, lose buoyancy as they
  cool, wander sideways in the draught, and fade orange → red → gone. Spawn rate scales
  steeply with intensity.

**`components/campfire/GlowLayer.tsx`** — the light the fire throws, in pure CSS: a tight
`screen` core on the stones, a wide `soft-light` wash across the scene, and a `multiply`
vignette that closes in as the fire dies.

**`components/campfire/ShootingStars.tsx`** — meteors across the painted sky every 5–15
seconds, occasionally in pairs.

Every frame the renderer publishes `--fire-intensity`, `--fire-flicker` and `--fire-glow`
onto the document root. The HUD panels, buttons, logbook cards and headings all read those
variables for their rim-light and text glow, so the whole interface breathes with the flame
without React re-rendering anything.

Intensity is smoothed toward the server value by a slightly under-damped spring, so a stoke
*swells* past its mark and settles rather than snapping. Transitions between tiers are
continuous by construction — nothing is hand-authored per level.

The fire pauses when off-screen or in a background tab, falls back to a 2D-canvas renderer
without WebGL2, and drops to a low-motion mode under `prefers-reduced-motion`.

**Tuning:** every position lives in `src/lib/anchor.ts` — `PIT` (where the painted fire
ring is, as a fraction of the image) and `FIRE_RECT` (the canvas around it). Flame shape
lives in `src/components/campfire/glsl.ts`.

---

## Rules

- One puzzle a day, the same word for everyone, chosen from the UTC date. Six guesses,
  five letters, standard green/yellow/grey.
- **Any five letters are accepted** — there's no dictionary, so a player who's sure their
  word is real is never blocked.
- Guesses are graded on the server, so the answer never reaches the browser mid-game and
  your board follows you between devices.
- Solving stokes the shared fire by **34**. Three members in a day gets it roaring.
- The fire decays **100 points per 24 hours**, computed lazily from a timestamp — so it
  stays correct across restarts with no background job. Constants are at the top of
  `src/lib/fire.ts`.
- Notes are capped at 140 characters, one per person per day, editable until midnight UTC.
  Today's notes live on their own screen, reached through the ⚙ menu — they used to peek
  from the bottom of the camp screen, but on a phone that stole the space the fire needed
  and pushed the main button over the fire pit.

### Testing without waiting a day

Settings (⚙ in the HUD) has **time travel**: `+1h`, `+6h`, `+24h`, and reset. It shifts the
whole camp forward, so you can watch the fire drop through its tiers and the puzzle roll
over to a new word with a clean board. An amber banner shows in the HUD whenever it's
active so you don't mistake it for a bug.

Every time-dependent read in the codebase goes through `now()` in `src/lib/time.ts`. That's
the one rule worth knowing: a raw `Date.now()` anywhere else silently breaks time travel.

---

## Layout

```
Mockup/                  your artwork (source of truth)
data/db.json             the whole database, plain JSON
scripts/                 sync-art, lan, seed
src/lib/                 db, time, auth, fire, words, wordle, anchor, state
src/components/
  Stage.tsx              the framed-poster primitive everything positions against
  campfire/              Campfire, glsl, engine, GlowLayer, ShootingStars
  wordle/                Board, Keyboard, PuzzleSheet
  camp/                  Hud, LogbookScreen, SettingsModal
src/app/                 title, /auth, /camp/setup, /camp, /api/*
```

Storage is a single JSON file written through a mutex, temp-file-and-rename so a crash
can't truncate it. Passwords are scrypt-hashed; sessions are HMAC-signed httpOnly cookies.
The cookie is deliberately **not** `Secure`, because plain-HTTP LAN access from a phone
would otherwise never send it back.

Stack: Next.js 15 (App Router), React 19, Tailwind v4, TypeScript. No database, no ORM,
no auth library.
