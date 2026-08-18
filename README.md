# 🚂 Bangladesh Railway Open Data

[![Live Demo](https://img.shields.io/badge/Live_Demo-View_Data-10b981?style=for-the-badge)](https://hussain-ahmed2.github.io/bd-railway-data/)

A structured, machine-readable dataset of **Bangladesh Railway (BR)** intercity train schedules, stoppages, fares, and station information — sourced from the [BR Official Timetable & E-Ticketing 2026](https://eticket.railway.gov.bd/).

> **Last Updated:** 2026-08-07 · **Version:** 2.0.0 · **Authority:** Bangladesh Railway, Ministry of Railways

---

## 📁 Files

| File | Description | Size |
|---|---|---|
| [`railway-data.json`](./railway-data.json) | All intercity train routes with stoppages, timings, off-days, and fares | ~49 KB |
| [`railway-stations.json`](./railway-stations.json) | All railway station definitions with codes, names (EN/BN), coordinates, district, division, zone | ~33 KB |

---

## � Preview

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

## �📊 Dataset Overview

### `railway-data.json`

- **20 intercity trains** across Bangladesh
- Each train entry includes:
  - `code` — Official BR train number (e.g. `"725"`)
  - `name` — Bilingual name (`en` / `bn`)
  - `type` — Train type (currently `"Intercity"`)
  - `origin` / `destination` — Station code + bilingual name
  - `departureTime` / `arrivalTime` — 24-hour format (`"HH:MM"`)
  - `offDay` — Weekly off day with bilingual label
  - `classes` — Array of seat classes available on this train
  - `stoppages` — Ordered array of stops with:
    - `stationCode` — References a station in `railway-stations.json`
    - `arrivalTime` / `departureTime` — 24-hour format
    - `haltMinutes` — Dwell time in minutes
    - `distanceKm` — Cumulative distance from origin
  - `fares` — Object mapping destination station codes to per-class fares (BDT)

**Trains included:**

| Code | Name | Route |
|---|---|---|
| 725 | Sundarban Express | Khulna → Dhaka |
| 726 | Sundarban Express | Dhaka → Khulna |
| 763 | Chitra Express | Khulna → Dhaka |
| 764 | Chitra Express | Dhaka → Khulna |
| 795 | Benapole Express | Benapole → Dhaka |
| 796 | Benapole Express | Dhaka → Benapole |
| 715 | Kapotaksha Express | Khulna → Rajshahi |
| 716 | Kapotaksha Express | Rajshahi → Khulna |
| 761 | Sagardari Express | Khulna → Rajshahi |
| 762 | Sagardari Express | Rajshahi → Khulna |
| 727 | Rupsha Express | Khulna → Chilahati |
| 701 | Subarna Express | Chattogram → Dhaka |
| 702 | Subarna Express | Dhaka → Chattogram |
| 788 | Sonar Bangla Express | Dhaka → Chattogram |
| 813 | Cox's Bazar Express | Dhaka → Cox's Bazar |
| 814 | Cox's Bazar Express | Cox's Bazar → Dhaka |
| 709 | Parabat Express | Dhaka → Sylhet |
| 753 | Silkcity Express | Dhaka → Rajshahi |
| 791 | Banalata Express | Dhaka → Chapainawabganj |
| 793 | Panchagarh Express | Dhaka → Panchagarh |

**Seat classes:**

| Class ID | Description |
|---|---|
| `shovon` | Shovon (শোভন) — economy seat |
| `shovon_chair` | Shovon Chair (শোভন চেয়ার) — economy recliner |
| `snigdha` | Snigdha (স্নিগ্ধা) — AC chair |
| `ac_seat` | AC Seat — non-berth AC |
| `ac_berth` | AC Berth — sleeping AC |

> **Note on fares:** Only fares for major stops are included. Fares to intermediate minor stops may not be listed — this reflects actual BR ticketing practice where only select origin–destination pairs are published.

---

### `railway-stations.json`

- **108 stations** across Bangladesh
- Each station entry includes:
  - `code` — Short unique identifier (e.g. `"DA"`, `"KLN"`)
  - `name` — Bilingual (`en` / `bn`)
  - `district` / `division` — Administrative area (bilingual)
  - `lat` / `lng` — GPS coordinates
  - `zone` — Railway zone (`"East"` or `"West"`)
  - `isMajorJunction` *(optional)* — `true` if this is a major junction station

> **Coverage note:** 108 stations are defined in total, of which 57 are actively referenced by the 20 trains in `railway-data.json`. The remaining 51 stations are pre-included for future train data expansion.

---

## 🔗 Data Schema (TypeScript)

```ts
interface Train {
  code: string;
  name: { en: string; bn: string };
  type: "Intercity";
  origin: { code: string; name: { en: string; bn: string } };
  destination: { code: string; name: { en: string; bn: string } };
  departureTime: string; // "HH:MM"
  arrivalTime: string;   // "HH:MM"
  offDay: { en: string; bn: string };
  classes: Array<"shovon" | "shovon_chair" | "snigdha" | "ac_seat" | "ac_berth">;
  stoppages: Stoppage[];
  fares: Record<string, Record<string, number>>; // stationCode → class → BDT
}

interface Stoppage {
  stationCode: string;
  arrivalTime: string;   // "HH:MM"
  departureTime: string; // "HH:MM"
  haltMinutes: number;
  distanceKm: number;    // cumulative from origin
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

## ✅ Data Validation

This dataset has been programmatically verified:

- ✅ **0 undefined station references** — all `stationCode` values in stoppages/fares resolve to a defined station
- ✅ **0 duplicate train codes**
- ✅ **0 stations missing coordinates** — all 108 stations have valid `lat`/`lng`
- ✅ **Distances are non-decreasing** — all stoppage `distanceKm` values are in correct ascending order
- ℹ️ **51 stations pre-defined but unused** — included for future expansion (additional trains to be added)
- ℹ️ **Partial fare coverage** — only key major-stop fares are listed, mirroring official BR ticketing

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
  console.log(`${t.name.en} (#${t.code}): departs ${t.departureTime}, Shovon fare: ৳${fare}`);
});
```

---

## 📄 License

**MIT** — Free to use, modify, and redistribute with attribution.

Data sourced from publicly available Bangladesh Railway official timetables and e-ticketing portal.


