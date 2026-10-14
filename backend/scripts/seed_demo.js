require("dotenv").config();
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const { getDbConfig, getMasterDbName } = require("../utils/db");

const DB = process.argv[2] || "db_demo";
const TRAFO_ID = 1;

function rand(min, max, dec = 2) {
  const v = min + Math.random() * (max - min);
  return Number(v.toFixed(dec));
}

function makeReading(ts) {
  const van = rand(225, 235),
    vbn = rand(225, 235),
    vcn = rand(225, 235);
  const ia = rand(60, 90),
    ib = rand(60, 90),
    ic = rand(60, 90);
  const pf = rand(0.85, 0.99);
  const sa = van * ia,
    sb = vbn * ib,
    sc = vcn * ic;
  const pa = sa * pf,
    pb = sb * pf,
    pc = sc * pf;
  const qa = Math.sqrt(sa * sa - pa * pa),
    qb = Math.sqrt(sb * sb - pb * pb),
    qc = Math.sqrt(sc * sc - pc * pc);
  return {
    trafoId: TRAFO_ID,
    timestamp: ts,
    Van: van,
    Vbn: vbn,
    Vcn: vcn,
    Vab: rand(395, 405),
    Vbc: rand(395, 405),
    Vca: rand(395, 405),
    Ia: ia,
    Ib: ib,
    Ic: ic,
    Iavg: Number(((ia + ib + ic) / 3).toFixed(2)),
    Ineutral: rand(0, 5),
    THDV1: rand(1, 4),
    THDV2: rand(1, 4),
    THDV3: rand(1, 4),
    THDI1: rand(3, 9),
    THDI2: rand(3, 9),
    THDI3: rand(3, 9),
    Pa: pa,
    Pb: pb,
    Pc: pc,
    Psig: pa + pb + pc,
    Qa: qa,
    Qb: -qb,
    Qc: qc,
    Qsig: qa - qb + qc,
    Sa: sa,
    Sb: sb,
    Sc: sc,
    Ssig: sa + sb + sc,
    PFa: pf,
    PFb: pf,
    PFc: pf,
    PFsig: pf,
    Freq: rand(49.9, 50.1, 3),
    kWh: 12345 + (Math.floor(ts.getTime() / 3600000) % 1000),
    kVARh: 2345,
    BusTemp1: rand(40, 50),
    BusTemp2: rand(40, 50),
    BusTemp3: rand(40, 50),
    OilTemp: rand(50, 60),
    WTITemp1: rand(55, 65),
    WTITemp2: rand(55, 65),
    WTITemp3: rand(55, 65),
    Press: rand(0.38, 0.45),
    Level: 1,
    KRateda: 4,
    deRatinga: rand(88, 96),
    KRatedb: 4,
    deRatingb: rand(88, 96),
    KRatedc: 4,
    deRatingc: rand(88, 96),
    H2ppm: Math.floor(rand(5, 20, 0)),
    Moistureppm: Math.floor(rand(5, 15, 0)),
    UnbalanceUV: rand(0, 2),
    UnbalanceVW: rand(0, 2),
    UnbalanceUW: rand(0, 2),
  };
}

async function insertRows(conn, table, rows) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const values = rows.map((r) => cols.map((c) => r[c]));
  await conn.query(
    `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(",")}) VALUES ?`,
    [values],
  );
}

async function seedCompany(conn) {
  await conn.query(
    `INSERT INTO transformer_data(trafoId, raspiSerialNo, trafoSerialNo, ratedPower, ratedHighVoltage, ratedLowVoltage, ratedCurrentHighVoltage, ratedCurrentLowVoltage,frequency, vectorGroup, phase, tapType, impedance, noLoadLoss, fullLoadLoss, status, SuddenPressure, latitude,longitude, version, productionStatus) VALUES (?, 'DEMO-RASPI-001', 'TRF-DEMO-001', 100, 20, 400, 2.89, 144, 50, 'Dyn5', 3, 'OCTC', 4, 150, 1200, 1, 0, -7.2575, 112.7521, 2, 1) ON DUPLICATE KEY UPDATE raspiSerialNo = VALUES(raspiSerialNo), ratedPower = VALUES(ratedPower)`,
    [TRAFO_ID],
  );

  await conn.query(
    `INSERT INTO transformer_settings(trafoId, voltageLowTripTreshold, voltageLowTripValue, voltageLowAlarmTreshold, voltageLowAlarmValue, voltageHighTripTreshold, voltageHighTripValue, voltageHighAlarmTreshold, voltageHighAlarmValue, voltageUnbalanceHighAlarmTreshold, voltageUnbalanceHighTripTreshold, frequencyLowTripTreshold, frequencyLowAlarmTreshold, frequencyHighTripTreshold, frequencyHighAlarmTreshold, topOilHighAlarmTreshold, topOilHighTripTreshold, windTempHighAlarmTreshold, windTempHighTripTreshold, powerFactorLowAlarmTreshold, powerFactorLowTripTreshold, currentHighAlarmTreshold, currentHighTripTreshold, tankPressureHighTripTreshold, tankPressureHighAlarmTreshold, busTempHighAlarmTreshold, busTempHighTripTreshold, thdCurrentAlarmTreshold, thdCurrentTripTreshold, thdVoltageAlarmTreshold, thdVoltageTripTreshold, IneutralHighAlarmTreshold, IneutralHighTripTreshold, H2ppmHighAlarmTreshold, H2ppmHighTripTreshold, MoistureppmHighAlarmTreshold, MoistureppmHighTripTreshold) VALUES (?, 10, 360, 5, 380, 10, 440, 5, 420, 3, 5, 5, 2, 5, 2, 70, 85, 80, 95, 0.85, 0.8, 100, 120, 0.6, 0.5, 70, 85, 10, 15, 5, 8, 20, 30, 50, 100, 20, 30) ON DUPLICATE KEY UPDATE trafoId = trafoId`,
    [TRAFO_ID],
  );

  await conn.query(
    `INSERT INTO trip_settings (trafoId, voltage, voltageUnbalance, frequency, topOilTemp, busTemp, powerFactor, current, pressure, oilLevel, WTITemp, THDCurrent, THDVoltage, Ineutral, H2ppm, Moistureppm) VALUES (?, 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1) ON DUPLICATE KEY UPDATE trafoId = trafoId`,
    [TRAFO_ID],
  );

  const statusCols = [
    "Vab",
    "Vbc",
    "Vca",
    "Current1",
    "Current2",
    "Current3",
    "Ineutral",
    "THDVoltage1",
    "THDVoltage2",
    "THDVoltage3",
    "THDCurrent1",
    "THDCurrent2",
    "THDCurrent3",
    "PF",
    "Freq",
    "BusTemp1",
    "BusTemp2",
    "BusTemp3",
    "OilTemp",
    "WTITemp1",
    "WTITemp2",
    "WTITemp3",
    "Pressure",
    "OilLevel",
    "H2ppm",
    "Moistureppm",
    "Uab",
    "Ubc",
    "Uca",
  ];
  const colList = statusCols.map((c) => `\`${c}\``).join(",");
  await conn.query(
    `INSERT INTO transformer_status(trafoId, ${colList}) VALUES (?, ${statusCols.map(() => "0").join(",")}) ON DUPLICATE KEY UPDATE trafoId = trafoId`,
    [TRAFO_ID],
  );
  await conn.query("DELETE FROM temp_reading_data_realtime WHERE trafoId = ?", [
    TRAFO_ID,
  ]);
  await conn.query("DELETE FROM reading_data WHERE trafoId = ?", [TRAFO_ID]);
  const now = Date.now();
  const temp = [];
  for (let i = 59; i >= 0; i--)
    temp.push(makeReading(new Date(now - i * 1000)));
  await insertRows(conn, "temp_reading_data_realtime", temp);

  const hist = [];
  for (let i = 1440; i >= 1; i--)
    hist.push(makeReading(new Date(now - i * 60000)));
  for (let i = 0; i < hist.length; i += 200)
    await insertRows(conn, "reading_data", hist.slice(i, i + 200));
  const harmonics = [1, 2, 3].map((phase) => {
    const row = { trafoId: TRAFO_ID, Phase: phase, "1st": 100 };
    for (const o of [
      "3rd",
      "5th",
      "7th",
      "9th",
      "11th",
      "13th",
      "15th",
      "17th",
      "19th",
      "21th",
      "23th",
      "25th",
      "27th",
      "29th",
      "31th",
    ])
      row[o] = rand(0.2, 6);
    return row;
  });
  await conn.query("DELETE FROM temp_voltage_harmonic WHERE trafoId = ?", [
    TRAFO_ID,
  ]);
  await conn.query("DELETE FROM temp_current_harmonic WHERE trafoId = ?", [
    TRAFO_ID,
  ]);
  await insertRows(conn, "temp_voltage_harmonic", harmonics);
  await insertRows(conn, "temp_current_harmonic", harmonics);
  await conn.query(
    `INSERT INTO failure_log (trafoId, failure_id, time_start, duration, failure_type, parameter,parameterValue) VALUES (?, 1001, DATE_SUB(NOW(), INTERVAL 3 DAY), 120, 'Gas Fault', 'OilLevel', '2'), (?, 1002, DATE_SUB(NOW(), INTERVAL 1 DAY), 30, 'High Alarm', 'OilTemp', '72.5') ON DUPLICATE KEY UPDATE failure_id = failure_id`,
    [TRAFO_ID, TRAFO_ID],
  );
}

async function seedMaster(conn) {
  await conn.query(
    `INSERT INTO company(company_name, database_name, company_key, status, tmu_version) VALUES ('PT Demo', ?, 'demo-company-key-0001', 1, 2) ON DUPLICATE KEY UPDATE company_name = VALUES(company_name)`,
    [DB],
  );
  const [[company]] = await conn.query(
    "SELECT company_id FROM company WHERE database_name = ?",
    [DB],
  );
  const salt = "ab12c";
  const password = crypto
    .createHash("sha256")
    .update("demo123" + salt)
    .digest("hex");
  const [exists] = await conn.query(
    "SELECT user_id FROM user WHERE username = ?",
    ["demo"],
  );
  if (exists.length === 0) {
    await conn.query(
      "INSERT INTO user (username, password, role, salt, company_id, status, email, phone) VALUES (?, ?, 1, ?, ?, 9, NULL, NULL)",
      ["demo", password, salt, company.company_id],
    );
  }

  const recs = [
    ["OilTemp", "Periksa sistem pendingin dan kipas radiator."],
    ["OilTemp", "Kurangi beban trafo sementara."],
    ["WTITemp", "Periksa beban per fase, kemungkinan beban tidak seimbang."],
    ["BusTemp", "Periksa kekencangan sambungan busbar."],
    ["Vab", "Periksa tegangan sisi sumber dan posisi tap changer."],
    ["Current", "Periksa beban berlebih pada fase terkait."],
    ["PF", "Periksa kapasitor bank dan beban induktif."],
    ["Freq", "Periksa kestabilan sumber atau genset."],
    ["Pressure", "Periksa relief valve dan kemungkinan gas internal."],
    ["OilLevel", "Periksa kebocoran dan tambah minyak bila perlu."],
    ["H2ppm", "Lakukan DGA, indikasi partial discharge atau overheating."],
    ["Moistureppm", "Lakukan filtrasi minyak atau penggantian silica gel."],
    [
      "THDCurrent",
      "Periksa beban non-linear dan pertimbangkan filter harmonik.",
    ],
    ["THDVoltage", "Periksa kualitas tegangan sumber."],
    ["Ineutral", "Periksa keseimbangan beban satu fasa."],
  ];
  const [cnt] = await conn.query(
    "SELECT COUNT(*) AS n FROM parameter_failure_recommendation",
  );
  if (cnt[0].n === 0) {
    await conn.query(
      "INSERT INTO parameter_failure_recommendation (parameter, recommendation) VALUES ?",
      [recs],
    );
  }
}

async function main() {
  const master = await mysql.createConnection(getDbConfig(getMasterDbName()));
  const company = await mysql.createConnection(getDbConfig(DB));
  // Sesi UTC, sama seperti pool aplikasi (utils/db.js), supaya NOW() dan JS Date sejalan.
  await master.query("SET time_zone = '+00:00'");
  await company.query("SET time_zone = '+00:00'");
  try {
    await seedMaster(master);
    await seedCompany(company);
    console.log(
      `Seed selesai: ${getMasterDbName()} + ${DB}. Login: demo / demo123`,
    );
  } finally {
    await master.end();
    await company.end();
  }
}

main().catch((err) => {
  console.error("Seed gagal:", err.code || err.message || err);
  process.exit(1);
});
