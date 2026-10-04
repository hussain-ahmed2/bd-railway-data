# 🚂 Bangladesh Railway Open Data

[![Live Demo](https://img.shields.io/badge/Live_Demo-View_Data-10b981?style=for-the-badge)](https://hussain-ahmed2.github.io/bd-railway-data/)

A structured, machine-readable dataset of **Bangladesh Railway (BR)** train schedules, stoppages, fares, and station information — the curated BR official timetable merged with a full open extract of **224 trains**.

> **Last Updated:** 2026-10-04 · **Version:** 3.0.0 · **Authority:** Bangladesh Railway, Ministry of Railways

---

## 📁 Files

| File | Description | Size |
|---|---|---|
| [`railway-data.json`](./railway-data.json) | **Build output** — all 224 trains with stoppages, timings, off-days and fares | ~1.3 MB |
| [`railway-stations.json`](./railway-stations.json) | **Build output** — all 424 referenced stations | ~132 KB |
| [`seed/railway-data.json`](./seed/railway-data.json) | Curated BR official snapshot: 20 intercity trains **with fares** (kept verbatim) | ~49 KB |
| [`seed/railway-stations.json`](./seed/railway-stations.json) | Curated station list (108 stations, official codes) | ~33 KB |
| [`scripts/build-railway-data.mjs`](./scripts/build-railway-data.mjs) | Regenerates the two root files from `seed/` + `extracted/` | — |
| [`extracted/`](./extracted/) | Source extract: trains, schedules, stations, images, live-tracking snapshots | ~101 MB |

> The two root JSON files are **generated**. Edit `seed/` or `extracted/`, then re-run the build — don't hand-edit the output.

---

## 🖼️ Preview

<div style="gap: 8px; overflow-x: auto; width: 100%; padding: 10px 0; display: flex; flex-wrap: wrap; align-content: center; justify-content: center;">
  <img src="train-image/Sundarban Express.jpg" width="22%" height="150" style="object-fit: cover; border-radius: 4px;" alt="Sundarban Express" />
  <img src="train-image/Parabat Express.jpg" width="22%" height="150" style="object-fit: cover; border-radius: 4px;" alt="Parabat Express" />
  <img src="train-image/Chitra Express.jpg" width="22%" height="150" style="object-fit: cover; border-radius: 4px;" alt="Chitra Express" />
  <img src="train-image/Benapole Express.jpg" width="22%" height="150" style="object-fit: cover; border-radius: 4px;" alt="Benapole Express" />
  <img src="train-image/Kapotaksha Express.jpg" width="22%" height="150" style="object-fit: cover; border-radius: 4px;" alt="Kapotaksha Express" />
  <img src="train-image/Sagardari Express.jpg" width="22%" height="150" style="object-fit: cover; border-radius: 4px;" alt="Sagardari Express" />
  <img src="train-image/Rupsha Express.jpg" width="22%" height="150" style="object-fit: cover; border-radius: 4px;" alt="Rupsha Express" />
  <img src="train-image/Subarna Express.jpg" width="22%" height="150" style="object-fit: cover; border-radius: 4px;" alt="Subarna Express" />
</div>

---

## 📊 Dataset Overview

### `railway-data.json`

- **224 trains** across Bangladesh
- Each train entry includes:
  - `code` — Official BR train number (e.g. `"725"`)
  - `name` — Bilingual name (`en` / `bn`)
  - `type` — `"intercity"` | `"commuter"` | `"mail_express"`
  - `origin` / `destination` — Station code + bilingual name
  - `departureTime` / `arrivalTime` — 24-hour format (`"HH:MM"`)
  - `durationHours` — Journey length (derived for generated entries; absent on the 20 curated entries, which consumers compute from the times)
  - `offDay` — Weekly off day with bilingual label; `"Daily"` for the 106 trains that run all week
  - `classes` — Array of seat classes available on this train
  - `stoppages` — Ordered array of stops with:
    - `stationCode` — References a station in `railway-stations.json`
    - `stationName` — Bilingual name (generated entries; consumers can also resolve it via `stationCode`)
    - `arrivalTime` / `departureTime` — 24-hour format
    - `haltMinutes` — Dwell time in minutes (sanitised: the source's 3 implausible outliers are recomputed from the times)
    - `distanceKm` — Cumulative distance from origin
  - `fares` — Object mapping destination station codes to per-class fares (BDT). **Only the 20 curated trains carry fares**; the extracted dataset has none, so the other 204 have `fares: {}`
  - `imagePath` / `imageUrl` / `imageSource` — 37 trains link to an existing image file
  - `popularityScore`, `totalCoaches`, `crossesMidnight`, `isActive` — enrichment from the extract

**Trains by type:**

| Type | Count | Origin of the data |
|---|---|---|
| `intercity` | 120 | 20 curated BR official (with fares) + 100 extracted |
| `commuter` | 64 | extracted |
| `mail_express` (mail / express / mail_express) | 40 | extracted |
| **Total** | **224** | |

> `mail` and `express` source types are folded into `mail_express` so consumers only deal with three values.

**Seat classes:**

| Class ID | Description |
|---|---|
| `shovon` | Shovon (শোভন) — economy seat |
| `shovon_chair` | Shovon Chair (শোভন চেয়ার) — economy recliner |
| `snigdha` | Snigdha (স্নিগ্ধা) — AC chair |
| `ac_seat` | AC Seat — non-berth AC |
| `ac_berth` | AC Berth — sleeping AC |
| `first_class` | First Class (প্রথম শ্রেণি) — mail/express first class |

> **Note on fares:** Only the curated trains carry fares, and only for major stops — this mirrors actual BR ticketing practice where only select origin–destination pairs are published.

---

### `railway-stations.json`

- **424 stations** — the 108 curated BR stations plus **316** extracted stations referenced by at least one train
- Each station entry includes:
  - `code` — Short unique identifier (e.g. `"DA"`, `"KLN"`)
  - `name` — Bilingual (`en` / `bn`)
  - `district` / `division` — Administrative area (bilingual). `district` is empty on generated entries (the extract doesn't carry it)
  - `lat` / `lng` — GPS coordinates
  - `zone` — Railway zone (`"East"` or `"West"`)

**How station codes are assigned** (all three rules run in order, in `scripts/build-railway-data.mjs`):

1. **Name match** — an extracted station whose name matches a curated station (normalised: case, `_`, parentheses, and `Junction`/`Jn`/`Bazar`/`Road`/`Halt` suffixes) **takes the curated code**. 93 stations matched this way, which resolves code collisions where the extract used the same code for a different station (`JOY` = Joypurhat in the extract vs Joydebpur in BR data, `AKH`, `SHA`, `PRD`, `ISL`, `BNG`, `FEN`, …).
2. **Keep the extracted code** — 205 stations keep their own code when nothing else has claimed it.
3. **Synthesise** — 111 stations (107 with no code at all in the extract + 4 whose colliding code was taken) get a deterministic code derived from the station name (`Badiakhali` → `BADI`, `Akhanagar` → `AKHA`). Synthesis never reuses a code owned by *any* extracted station, so a code can't silently change meaning.

Zone is inherited from the nearest curated station (falling back to the Jamuna longitude split), so all 424 entries are zoned.

---

## 🔗 Data Schema (TypeScript)

```ts
type TrainType = "intercity" | "commuter" | "mail_express";

type TrainClass =
    | "shovon"
    | "shovon_chair"
    | "snigdha"
    | "ac_seat"
    | "ac_berth"
    | "first_class"
    | "shulov";

interface Train {
    code: string;
    name: { en: string; bn: string };
    type: TrainType;
    origin: { code: string; name: { en: string; bn: string } };
    destination: { code: string; name: { en: string; bn: string } };
    departureTime: string; // "HH:MM"
    arrivalTime: string; // "HH:MM"
    durationHours?: number; // derived for generated entries
    offDay: { en: string; bn: string }; // "Daily" when there is no weekly off day
    classes: TrainClass[];
    stoppages: Stoppage[];
    fares: Record<string, Partial<Record<TrainClass, number>>>; // {} on generated entries
    description?: { en: string; bn: string };
    imagePath?: string | null;
    imageUrl?: string | null;
    imageSource?: string | null;
    imageCredit?: string | null;
    popularityScore?: number | null;
    totalCoaches?: number | null;
    crossesMidnight?: boolean;
    isActive?: boolean;
}

interface Stoppage {
    stationCode: string;
    stationName?: { en: string; bn: string };
    arrivalTime: string; // "HH:MM"
    departureTime: string; // "HH:MM"
    haltMinutes: number;
    distanceKm: number; // cumulative from origin
}

interface Station {
    code: string;
    name: { en: string; bn: string };
    district: { en: string; bn: string };
    division: { en: string; bn: string };
    lat: number;
    lng: number;
    zone: "East" | "West";
    isMajorJunction?: boolean;
}
```

---

## 🛠️ Regenerating

```bash
node scripts/build-railway-data.mjs          # validate + write both root files
node scripts/build-railway-data.mjs --check  # validate only, write nothing
```

The build is deterministic (running it twice produces byte-identical output) and **exits non-zero** if any check fails:

- 224 trains, no duplicate train codes
- every `stationCode`, origin and destination resolves to a station in the output
- no duplicate station codes (compared case-insensitively)
- all times are `HH:MM`; distances non-decreasing within every train
- every station has coordinates and a valid zone
- the 20 curated trains and 108 curated stations come through byte-identical to `seed/`

---

## 📦 `extracted/` — the source extract

Everything the build reads besides `seed/`:

| File | Contents |
|---|---|
| `trains_by_id.json` | 224 trains: number, names, type, off days, schedule times, seat classes, images |
| `train_schedules.json` / `schedules_by_train.json` | 3,454 stops for all 224 trains (same data, flat vs grouped) |
| `stations.json` | 417 stations (305 with a code, 112 without) |
| `rail_lines.json` | 46 named rail lines |
| `train_images/` | 26 station/train photos referenced by `image_path` |
| `trains.json`, `tracking_details.json`, `updates_by_run.json` | **Live-tracking snapshots from Aug 2026** (runs, stop statuses, GPS pings) — *not* used by the build; they go stale |

Provenance: the extract mirrors a crowd-sourced tracking backend built on public BR schedule data. Treat the **seed** files as authoritative where the two disagree — they do differ on 13 of the 20 shared trains (the extract has e.g. Cox's Bazar Express swapped between its two directions).

---

## ✅ Data Validation

Programmatically verified by the build (and re-checkable any time with `--check`):

- ✅ **0 unresolved station references** — every `stationCode` in stoppages/fares resolves
- ✅ **0 duplicate train codes**, **0 duplicate station codes**
- ✅ **0 stations missing coordinates**
- ✅ **Distances non-decreasing** in all 224 trains
- ✅ **Times match the schedule** — every train's first/last stop equals its `departureTime`/`arrivalTime`
- ✅ **Curated data untouched** — seed trains and stations come through byte-identical
- ✅ **Deterministic output** — repeat builds hash the same
- ℹ️ **Partial fare coverage** — fares exist for the 20 curated trains only
- ℹ️ **316 generated stations have an empty `district`** — not present in the extract

---

## 📝 Usage Example

```js
const trains = require('./railway-data.json').trains;
const stations = require('./railway-stations.json');

// Build a lookup map
const stationMap = Object.fromEntries(stations.map(s => [s.code, s]));

// Find Dhaka → Khulna trains
const dhakaToKhulna = trains.filter(
  t => t.origin.code === 'DA' && t.destination.code === 'KLN'
);

dhakaToKhulna.forEach(t => {
  const fare = t.fares['KLN']?.shovon;
  console.log(`${t.name.en} (#${t.code}): departs ${t.departureTime}${fare ? `, Shovon fare: ৳${fare}` : ''}`);
});
```

---

## 📄 License

**MIT** — Free to use, modify, and redistribute with attribution.

Curated data sourced from publicly available Bangladesh Railway official timetables and the e-ticketing portal.
