#!/usr/bin/env node
// build-railway-data.mjs
//
// Regenerates railway-data.json and railway-stations.json from:
//   - seed/railway-data.json / seed/railway-stations.json
//     (curated BR-official snapshot with fares — kept verbatim, never written to)
//   - extracted/*.json (open extracted dataset: trains, schedules, stations)
//
// Edit the seed files or extracted/ and re-run; the root files are build output.
//
// Station identity rules:
//   1. Extracted station name-matches a curated station -> curated code wins.
//   2. Else extracted code is free -> keep it.
//   3. Else (collision or missing code) -> synthesize a unique code from the name.
//
// Run: node scripts/build-railway-data.mjs [--check]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CHECK_ONLY = process.argv.includes("--check");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, data) => fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);

const curatedData = readJson(path.join(ROOT, "seed", "railway-data.json"));
const curatedStations = readJson(path.join(ROOT, "seed", "railway-stations.json"));
const exStations = readJson(path.join(ROOT, "extracted", "stations.json"));
const exTrains = readJson(path.join(ROOT, "extracted", "trains_by_id.json"));
const exSchedules = readJson(path.join(ROOT, "extracted", "train_schedules.json"));

const stats = {
    trainsCuratedKept: 0,
    trainsAdded: 0,
    stationsCuratedKept: 0,
    stationsAdded: 0,
    matchedByName: 0,
    keptExtractedCode: 0,
    synthesized: 0,
    zoneByNearest: 0,
    imagesLinked: 0,
};

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// ─── Name normalization ────────────────────────────────────────────────────────

function normalizeName(name) {
    return String(name ?? "")
        .replace(/\([^)]*\)/g, " ") // "Dhaka (Kamalapur)" -> "Dhaka"
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/[^a-z0-9 ]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

const SUFFIXES = [" junction", " jn", " bazar", " road", " halt", " gate", " colony"];
function baseName(name) {
    let n = normalizeName(name);
    let changed = true;
    while (changed) {
        changed = false;
        for (const suffix of SUFFIXES) {
            if (n.length > suffix.length && n.endsWith(suffix)) {
                n = n.slice(0, -suffix.length).trim();
                changed = true;
            }
        }
    }
    return n;
}

// ─── Curated indexes ───────────────────────────────────────────────────────────

const curatedByNorm = new Map();
const curatedByBase = new Map();
for (const st of curatedStations) {
    const norm = normalizeName(st.name?.en);
    const base = baseName(st.name?.en);
    if (norm && !curatedByNorm.has(norm)) curatedByNorm.set(norm, st);
    if (base && !curatedByBase.has(base)) curatedByBase.set(base, st);
}
const curatedCoords = curatedStations.filter((s) => typeof s.lat === "number" && typeof s.lng === "number");

const codeKey = (code) => String(code ?? "").trim().toUpperCase();

// Codes actively assigned to a station in the output.
const usedCodeKeys = new Set();
// Codes owned by an extracted station. Synthesis may never use these, so a
// code-less station can't steal the code that belongs to a different station
// (that other station may be name-matched onto a curated code instead).
const extractedOwnedKeys = new Set();

function isCodeFree(code) {
    const key = codeKey(code);
    return key.length > 0 && !usedCodeKeys.has(key) && !extractedOwnedKeys.has(key);
}
function canKeepOwnCode(code) {
    const key = codeKey(code);
    return key.length > 0 && !usedCodeKeys.has(key);
}
for (const st of curatedStations) usedCodeKeys.add(codeKey(st.code));
for (const st of exStations) if (st.code) extractedOwnedKeys.add(codeKey(st.code));

// ─── Station code assignment (extracted id -> final code) ─────────────────────

function synthesizeCode(name, id) {
    const clean = String(name ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const candidates = [];
    if (clean) {
        for (const len of [3, 4, 2, 5]) {
            if (clean.length >= len) candidates.push(clean.slice(0, len));
        }
        if (clean.length >= 2 && clean.length <= 6) candidates.push(clean);
        const base3 = clean.slice(0, 3) || clean;
        for (let n = 2; n <= 99; n++) candidates.push(`${base3}${n}`);
    }
    candidates.push(`S${id}`);
    for (const candidate of candidates) {
        if (isCodeFree(candidate)) return candidate;
    }
    return `X${id}`;
}

const referencedIds = new Set();
for (const s of exSchedules) referencedIds.add(s.station_id);
for (const t of Object.values(exTrains)) {
    referencedIds.add(t.origin.id);
    referencedIds.add(t.destination.id);
}
const referencedStations = [...exStations]
    .filter((s) => referencedIds.has(s.id))
    .sort((a, b) => a.id - b.id);

const stationFinalCode = new Map(); // extracted id -> final code
const finalStations = new Map(); // final code -> station record (curated shape)

for (const st of curatedStations) {
    finalStations.set(codeKey(st.code), st);
    stats.stationsCuratedKept++;
}

// Pass A: name match against the curated (BR-official) station list.
for (const st of referencedStations) {
    const nameEn = st.name_en || st.name_bn || `Station ${st.id}`;
    const match = curatedByNorm.get(normalizeName(nameEn)) || curatedByBase.get(baseName(nameEn));
    if (match) {
        stationFinalCode.set(st.id, match.code);
        stats.matchedByName++;
    }
}

// Pass B: keep the extracted code when nothing else has claimed it.
for (const st of referencedStations) {
    if (stationFinalCode.has(st.id) || !st.code) continue;
    if (canKeepOwnCode(st.code)) {
        stationFinalCode.set(st.id, st.code);
        usedCodeKeys.add(codeKey(st.code));
        stats.keptExtractedCode++;
    }
}

// Pass C: everything else gets a synthesized code (missing or colliding code).
const synthesizedList = [];
for (const st of referencedStations) {
    if (stationFinalCode.has(st.id)) continue;
    const nameEn = st.name_en || st.name_bn || `Station ${st.id}`;
    const code = synthesizeCode(nameEn, st.id);
    stationFinalCode.set(st.id, code);
    usedCodeKeys.add(codeKey(code));
    stats.synthesized++;
    synthesizedList.push({
        id: st.id,
        name: nameEn,
        from: st.code || "(none)",
        code,
        reason: st.code ? "code collision" : "no code",
    });
}

// Materialize records for codes that don't belong to a curated station.
for (const st of referencedStations) {
    const code = stationFinalCode.get(st.id);
    if (finalStations.has(codeKey(code))) continue;
    finalStations.set(codeKey(code), makeStationRecord(st, code));
    stats.stationsAdded++;
}

function makeStationRecord(st, code) {
    const division = st.division || "";
    const clean = (s) => String(s ?? "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();
    return {
        code,
        name: { en: clean(st.name_en), bn: clean(st.name_bn) || clean(st.name_en) },
        district: { en: "", bn: "" },
        division: { en: division, bn: division },
        lat: st.lat,
        lng: st.lng,
        zone: zoneFor(st),
    };
}

function zoneFor(st) {
    // Nearest curated station inherits its zone; falls back to the Jamuna longitude split.
    let best = null;
    let bestD = Infinity;
    for (const c of curatedCoords) {
        const d = (c.lat - st.lat) ** 2 + (c.lng - st.lng) ** 2;
        if (d < bestD) {
            bestD = d;
            best = c;
        }
    }
    if (best && bestD < 0.35) {
        stats.zoneByNearest++;
        return best.zone;
    }
    return st.lng < 89.85 ? "West" : "East";
}

// ─── Schedule index ────────────────────────────────────────────────────────────

const schedulesByTrain = new Map();
for (const s of exSchedules) {
    if (!schedulesByTrain.has(s.train_id)) schedulesByTrain.set(s.train_id, []);
    schedulesByTrain.get(s.train_id).push(s);
}
for (const stops of schedulesByTrain.values()) stops.sort((a, b) => a.stop_order - b.stop_order);

// ─── Train field mapping ───────────────────────────────────────────────────────

const DAY_NAMES = {
    0: { en: "Sunday", bn: "রবিবার" },
    1: { en: "Monday", bn: "সোমবার" },
    2: { en: "Tuesday", bn: "মঙ্গলবার" },
    3: { en: "Wednesday", bn: "বুধবার" },
    4: { en: "Thursday", bn: "বৃহস্পতিবার" },
    5: { en: "Friday", bn: "শুক্রবার" },
    6: { en: "Saturday", bn: "শনিবার" },
};

const DAILY = { en: "Daily", bn: "প্রতিদিন" };

const TYPE_MAP = {
    intercity: "intercity",
    commuter: "commuter",
    mail: "mail_express",
    mail_express: "mail_express",
    express: "mail_express",
    local: "commuter",
    special: "commuter",
};

const CLASS_MAP = {
    "AC B": "ac_berth",
    "AC S": "ac_seat",
    Snigdha: "snigdha",
    "S Chair": "shovon_chair",
    Shovon: "shovon",
    Shovan: "shovon",
    Shulov: "shulov",
    First: "first_class",
    F_Seat: "first_class",
};

const fmtTime = (t) => (t ? String(t).slice(0, 5) : null);
const toMinutes = (hhmm) => {
    const [h = 0, m = 0] = String(hhmm).split(":").map(Number);
    return h * 60 + m;
};

function resolveStation(stationId) {
    const code = stationFinalCode.get(stationId);
    if (!code) {
        fail(`unresolved station id ${stationId}`);
        return null;
    }
    const record = finalStations.get(codeKey(code));
    if (!record) {
        fail(`station code ${code} missing from output stations`);
        return null;
    }
    return record;
}

const stationRef = (record) => ({
    code: record.code,
    name: { en: record.name.en, bn: record.name.bn },
});

const DESCRIPTION = {
    en: "Schedule and stoppages sourced from latest Bangladesh Railway data.",
    bn: "সময়সূচী এবং বিরতি বাংলাদেশ রেলওয়ের সর্বশেষ ডেটা থেকে সংগৃহীত।",
};

function buildStoppages(train) {
    const stops = schedulesByTrain.get(train.id) || [];
    if (stops.length < 2) fail(`train ${train.number} has ${stops.length} stoppages`);

    let previousKm = 0;
    return stops.map((stop, index) => {
        const record = resolveStation(stop.station_id);
        if (!record) return null;

        let arrival = fmtTime(stop.arrival_time);
        let departure = fmtTime(stop.departure_time);
        if (!arrival) arrival = departure;
        if (!departure) departure = arrival;
        if (!arrival) fail(`train ${train.number} stop ${index + 1} has no time`);

        let halt = null;
        if (typeof stop.halt_minutes === "number" && stop.halt_minutes >= 0 && stop.halt_minutes <= 60) {
            halt = stop.halt_minutes;
        } else if (arrival && departure) {
            // Raw halt is missing or implausible (source has a few 1438/25900 outliers).
            halt = toMinutes(departure) - toMinutes(arrival);
            if (halt < 0) halt += 24 * 60;
            if (halt > 120) halt = 0;
        } else {
            halt = 0;
        }

        const distance = stop.km_from_origin ?? 0;
        if (distance < previousKm) fail(`train ${train.number} distances not monotonic at stop ${index + 1}`);
        previousKm = distance;

        return {
            stationCode: record.code,
            stationName: { en: record.name.en, bn: record.name.bn },
            arrivalTime: arrival,
            departureTime: departure,
            haltMinutes: halt,
            distanceKm: distance,
        };
    });
}

function buildTrain(train) {
    const origin = resolveStation(train.origin.id);
    const destination = resolveStation(train.destination.id);
    if (!origin || !destination) return null;

    const stoppages = buildStoppages(train);
    if (stoppages.some((s) => s === null)) return null;

    const departureTime = fmtTime(train.scheduled_departure);
    const arrivalTime = fmtTime(train.scheduled_arrival);
    if (!departureTime || !arrivalTime) fail(`train ${train.number} missing scheduled times`);

    const offDay = train.off_days?.length ? DAY_NAMES[train.off_days[0]] ?? DAILY : DAILY;

    const classes = [];
    for (const sc of train.seat_classes ?? []) {
        const mapped = CLASS_MAP[sc.seat_class] ?? String(sc.seat_class).toLowerCase().replace(/[^a-z0-9]+/g, "_");
        if (!classes.includes(mapped)) classes.push(mapped);
    }

    let imagePath = null;
    if (train.image_path) {
        const file = path.join(ROOT, "extracted", train.image_path);
        if (fs.existsSync(file)) {
            imagePath = `/images/trains/${path.basename(train.image_path)}`;
            stats.imagesLinked++;
        }
    }

    const type = TYPE_MAP[train.train_type] ?? "commuter";
    if (!TYPE_MAP[train.train_type]) warn(`train ${train.number}: unmapped type ${train.train_type}`);

    return {
        code: train.number,
        name: { en: train.name_en, bn: train.name_bn },
        type,
        origin: stationRef(origin),
        destination: stationRef(destination),
        departureTime,
        arrivalTime,
        durationHours: computeDuration(departureTime, arrivalTime, train.crosses_midnight),
        offDay,
        classes,
        stoppages,
        fares: {},
        description: DESCRIPTION,
        imagePath,
        imageUrl: train.image_url ?? null,
        imageSource: train.image_source ?? null,
        imageCredit: train.image_credit ?? null,
        popularityScore: train.popularity_score ?? null,
        totalCoaches: train.default_total_coaches ?? null,
        crossesMidnight: train.crosses_midnight ?? false,
        isActive: train.is_active !== false,
    };
}

function computeDuration(departure, arrival, crossesMidnight) {
    let diff = toMinutes(arrival) - toMinutes(departure);
    if (diff < 0 || crossesMidnight) diff += 24 * 60;
    return Math.round((diff / 60) * 100) / 100;
}

// ─── Build trains ──────────────────────────────────────────────────────────────

const curatedTrains = curatedData.trains;
const curatedNumbers = new Set(curatedTrains.map((t) => t.code));
stats.trainsCuratedKept = curatedTrains.length;

const newTrains = [];
const sortedExtracted = Object.values(exTrains).sort(
    (a, b) => Number(a.number) - Number(b.number) || String(a.number).localeCompare(String(b.number)),
);

for (const train of sortedExtracted) {
    if (curatedNumbers.has(train.number)) continue;
    const built = buildTrain(train);
    if (built) {
        newTrains.push(built);
        stats.trainsAdded++;
    }
}

const trains = [...curatedTrains, ...newTrains].sort(
    (a, b) => Number(a.code) - Number(b.code) || a.code.localeCompare(b.code),
);
const stations = [...finalStations.values()];

// ─── Validation ────────────────────────────────────────────────────────────────

const TIME_RE = /^\d{2}:\d{2}$/;
const seenTrainCodes = new Set();

if (trains.length !== Object.keys(exTrains).length) {
    fail(`expected ${Object.keys(exTrains).length} trains, built ${trains.length}`);
}

for (const train of trains) {
    if (seenTrainCodes.has(train.code)) fail(`duplicate train code ${train.code}`);
    seenTrainCodes.add(train.code);
    if (!TIME_RE.test(train.departureTime)) fail(`train ${train.code}: bad departureTime ${train.departureTime}`);
    if (!TIME_RE.test(train.arrivalTime)) fail(`train ${train.code}: bad arrivalTime ${train.arrivalTime}`);
    if (!curatedNumbers.has(train.code) && !Object.hasOwn(TYPE_MAP, train.type)) {
        fail(`train ${train.code}: bad type ${train.type}`);
    }
    for (const ref of [
        { role: "origin", ...train.origin },
        { role: "destination", ...train.destination },
    ]) {
        if (!finalStations.has(codeKey(ref.code))) fail(`train ${train.code}: ${ref.role} ${ref.code} not in stations`);
    }
    for (const stop of train.stoppages) {
        if (!finalStations.has(codeKey(stop.stationCode))) {
            fail(`train ${train.code}: stop ${stop.stationCode} not in stations`);
        }
        if (!TIME_RE.test(stop.arrivalTime)) fail(`train ${train.code}: stop ${stop.stationCode} bad arrival`);
        if (!TIME_RE.test(stop.departureTime)) fail(`train ${train.code}: stop ${stop.stationCode} bad departure`);
        if (typeof stop.distanceKm !== "number") fail(`train ${train.code}: stop ${stop.stationCode} no distance`);
    }
    const stopCodes = train.stoppages.map((s) => codeKey(s.stationCode));
    if (!stopCodes.includes(codeKey(train.origin.code))) {
        warn(`train ${train.code}: origin ${train.origin.code} not among its stoppages`);
    }
    if (!stopCodes.includes(codeKey(train.destination.code))) {
        warn(`train ${train.code}: destination ${train.destination.code} not among its stoppages`);
    }
    if (!curatedNumbers.has(train.code)) {
        if (train.stoppages.length < 2) fail(`train ${train.code}: too few stoppages`);
        if (typeof train.durationHours !== "number" || train.durationHours <= 0) {
            fail(`train ${train.code}: bad durationHours`);
        }
    }
}

const seenStationKeys = new Set();
for (const st of stations) {
    const key = codeKey(st.code);
    if (!key) fail(`station with empty code: ${JSON.stringify(st.name)}`);
    if (seenStationKeys.has(key)) fail(`duplicate station code ${st.code}`);
    seenStationKeys.add(key);
    if (typeof st.lat !== "number" || typeof st.lng !== "number") {
        fail(`station ${st.code}: missing coordinates`);
    }
    if (st.zone !== "East" && st.zone !== "West") fail(`station ${st.code}: bad zone ${st.zone}`);
}

for (const t of curatedTrains) {
    const original = curatedData.trains.find((x) => x.code === t.code);
    if (JSON.stringify(original) !== JSON.stringify(t)) fail(`curated train ${t.code} was modified`);
}

// ─── Report ────────────────────────────────────────────────────────────────────

const byType = {};
for (const t of trains) byType[t.type] = (byType[t.type] ?? 0) + 1;

console.log("── build-railway-data ──────────────────────────────────");
console.log(`trains      : ${trains.length} (curated kept ${stats.trainsCuratedKept}, added ${stats.trainsAdded})`);
console.log(`  by type   : ${JSON.stringify(byType)}`);
console.log(`stations    : ${stations.length} (curated kept ${stats.stationsCuratedKept}, added ${stats.stationsAdded})`);
console.log(`  name match: ${stats.matchedByName}, extracted code kept ${stats.keptExtractedCode}, synthesized ${stats.synthesized}`);
console.log(`  zone      : inherited from nearest curated station for ${stats.zoneByNearest} extracted stations`);
console.log(`images      : ${stats.imagesLinked} trains linked to an existing image file`);
if (synthesizedList.length) {
    console.log(`synthesized codes (${synthesizedList.length}):`);
    for (const s of synthesizedList) console.log(`  ${s.code.padEnd(6)} ${s.name} (was ${s.from}, ${s.reason})`);
}
for (const w of warnings) console.log(`⚠ ${w}`);
if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`);
    console.error(`\n${errors.length} error(s) — nothing written.`);
    process.exit(1);
}

if (CHECK_ONLY) {
    console.log("check only — no files written.");
} else {
    writeJson(path.join(ROOT, "railway-data.json"), {
        meta: {
            version: "3.0.0",
            lastUpdated: new Date().toISOString().slice(0, 10),
            dataSource:
                "Bangladesh Railway (BR) Official Timetable & E-Ticketing 2026 (curated fares/schedules) + extracted open dataset (all trains)",
            authority: "Bangladesh Railway, Ministry of Railways",
        },
        trains,
    });
    writeJson(path.join(ROOT, "railway-stations.json"), stations);
    console.log("wrote railway-data.json and railway-stations.json");
}
