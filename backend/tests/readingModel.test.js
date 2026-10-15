const test = require("node:test");
const assert = require("node:assert/strict");
const { makeFakeDb } = require("./helpers/fakeDb");
const rm = require("../utils/readingModel");

const TD = {
  ratedPower: 100,
  ratedCurrentLowVoltage: 144,
  noLoadLoss: 150,
  fullLoadLoss: 1200,
};

test("mapRow memetakan kolom base_tmu ke key frontend dan membagi daya 1000", () => {
  const p = rm.mapRow({
    timestamp: "2026-10-13T01:02:03.000Z",
    trafoId: 1,
    Van: 230.1,
    Vab: 398.5,
    Ia: 10,
    Ineutral: 0.5,
    Iavg: 10,
    Pa: 2300,
    Psig: 6900,
    Qsig: -500,
    Ssig: 7000,
    PFsig: 0.98,
    Freq: 50,
    kWh: 123.4,
    OilTemp: 55,
    Press: 0.41,
    WTITemp1: 60,
    BusTemp2: 45,
    THDV1: 2.5,
    THDI3: 4.1,
    H2ppm: 12,
    Moistureppm: 8,
    deRatinga: 95,
    KRateda: 4,
    UnbalanceUV: 1.2,
    Level: 1,
  });
  assert.equal(p.timestamp, "2026-10-13T01:02:03.000Z");
  assert.match(p.time, /^08.02.03$/);
  assert.equal(p.trafoId, 1);
  assert.equal(p.phaseA, 230.1);
  assert.equal(p.lineAB, 398.5);
  assert.equal(p.currentA, 10);
  assert.equal(p.currentN, 0.5);
  assert.equal(p.avgCurrent, 10);
  assert.equal(p.powerActiveA, 2.3);
  assert.equal(p.powerActiveTotal, 6.9);
  assert.equal(p.powerReactiveTotal, -0.5);
  assert.equal(p.powerApparentTotal, 7);
  assert.equal(p.pfTotal, 0.98);
  assert.equal(p.frequency, 50);
  assert.equal(p.energyActiveTotal, 123.4);
  assert.equal(p.oil_temperature, 55);
  assert.equal(p.oil_pressure, 0.41);
  assert.equal(p.wtiA, 60);
  assert.equal(p.busTempB, 45);
  assert.equal(p.thdVA, 2.5);
  assert.equal(p.thdIC, 4.1);
  assert.equal(p.h2ppm, 12);
  assert.equal(p.moisturePpm, 8);
  assert.equal(p.deRatingA, 95);
  assert.equal(p.kRatedA, 4);
  assert.equal(p.unbalanceUV, 1.2);
  assert.equal(p.oilLevelRaw, 1);
});

test("mapRow mengubah string angka dari MySQL menjadi number", () => {
  const p = rm.mapRow({ timestamp: new Date(), Van: "229.90", Psig: "1500" });
  assert.equal(p.phaseA, 229.9);
  assert.equal(p.powerActiveTotal, 1.5);
});

test("mapRow mengisi 0 untuk NULL dan kolom yang tidak ada", () => {
  const p = rm.mapRow({ timestamp: new Date(), Van: null });
  assert.equal(p.phaseA, 0);
  assert.equal(p.phaseB, 0);
  assert.equal(p.h2ppm, 0);
});

test("buildSelect membuat daftar kolom, dengan AVG saat agregasi", () => {
  assert.equal(
    rm.buildSelect(["phaseA", "oil_temperature"]),
    "`Van`, `OilTemp`",
  );
  assert.equal(
    rm.buildSelect(["phaseA"], { aggregate: true }),
    "ROUND(AVG(`Van`),2) AS `Van`",
  );
  assert.throws(() => rm.buildSelect(["tidakAda"]), /Tidak ada metric valid/);
});

test("computeEfficiency rumus kuadrat dengan konstanta transformer_data", () => {
  // ratio 0.5 -> loadLoss 300 -> (1 - 450/100450)*100 = 99.55
  const eff = rm.computeEfficiency({ avgCurrent: 72 }, TD);
  assert.equal(eff, 99.55);
});

test("computeEfficiency memakai rata-rata tiga fase kalau avgCurrent tidak ada", () => {
  const eff = rm.computeEfficiency(
    { currentA: 72, currentB: 72, currentC: 72 },
    TD,
  );
  assert.equal(eff, 99.55);
});

test("leadLag dari tanda daya reaktif", () => {
  assert.equal(rm.leadLag(0.3), "leading");
  assert.equal(rm.leadLag(-0.3), "lagging");
  assert.equal(rm.leadLag(0), "unity");
});

test("computeDerating per fase dalam kVA", () => {
  const d = rm.computeDerating(
    { deRatingA: 90, powerApparentA: 15, kRatedA: 4 },
    { ratedPower: 100 },
  );
  assert.equal(d.a.full, 33.33);
  assert.equal(d.a.available, 30);
  assert.equal(d.a.lost, 3.33);
  assert.equal(d.a.used, 15);
  assert.equal(d.a.kRated, 4);
  assert.equal(rm.computeDerating({}, {}), null);
});

test("getLatest memakai temp_reading_data_realtime dan trafoId", async () => {
  const db = makeFakeDb(() => [{ timestamp: new Date(), Van: 1 }]);
  const p = await rm.getLatest(db, 7);
  assert.equal(p.phaseA, 1);
  assert.match(
    db.calls[0].sql,
    /FROM temp_reading_data_realtime WHERE trafoId = \? ORDER BY timestamp DESC/,
  );
  assert.deepEqual(db.calls[0].params, [7]);
});

test("getLatest null kalau kosong", async () => {
  const db = makeFakeDb(() => []);
  assert.equal(await rm.getLatest(db, 1), null);
});

test("getRealtimeSeries membatasi limit dan mengurutkan naik", async () => {
  const db = makeFakeDb(() => []);
  await rm.getRealtimeSeries(db, 1, 9999);
  assert.match(db.calls[0].sql, /LIMIT 500\) sub ORDER BY timestamp ASC/);
});

test("getHistory tanpa interval membaca reading_data mentah", async () => {
  const db = makeFakeDb(() => []);
  await rm.getHistory(db, 1, "2026-10-01", "2026-10-02", 0, ["phaseA"]);
  assert.match(
    db.calls[0].sql,
    /SELECT timestamp, `Van` FROM reading_data WHERE trafoId = \? AND timestamp >= \? AND timestamp <= \? ORDER BY timestamp ASC LIMIT 100000/,
  );
  assert.deepEqual(db.calls[0].params, [1, "2026-10-01", "2026-10-02"]);
});

test("getHistory dengan interval melakukan Deferred Join per interval", async () => {
  const db = makeFakeDb(() => []);
  await rm.getHistory(db, 1, "2026-10-01", "2026-10-02", 300, ["phaseA"]);
  assert.match(
    db.calls[0].sql,
    /SELECT t\.timestamp, t\.`Van` FROM reading_data t INNER JOIN/,
  );
  assert.match(db.calls[0].sql, /GROUP BY \(UNIX_TIMESTAMP\(timestamp\) DIV 300\)/);
});

test("computeDerived menggabungkan semuanya", () => {
  const p = rm.computeDerived(
    rm.mapRow({
      timestamp: new Date(),
      Iavg: 72,
      Qa: 100,
      Qb: -100,
      Qc: 0,
      Sa: 15000,
      deRatinga: 90,
      KRateda: 4,
    }),
    TD,
  );
  assert.equal(p.efficiency, 99.55);
  assert.deepEqual(p.leadLag, { a: "leading", b: "lagging", c: "unity" });
  assert.equal(p.derating.a.used, 15);
});
