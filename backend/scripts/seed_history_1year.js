require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mysql = require("mysql2/promise");
const { getDbConfig } = require("../utils/db");

const DB = process.argv[2] || "base_tmu_company_table_v2";
const TRAFO_ID = parseInt(process.argv[3] || "1", 10);

function rand(min, max, dec = 2) {
  const v = min + Math.random() * (max - min);
  return Number(v.toFixed(dec));
}

function makeHourlyReading(ts, hourIndex, prevKwh, prevKvarh) {
  const hour = ts.getHours();
  // Realistic circadian load factor: peak between 08:00 - 18:00
  const isPeak = hour >= 8 && hour <= 18;
  const loadFactor = isPeak ? rand(1.15, 1.45) : rand(0.85, 1.05);

  // Phase to Neutral voltages: nominal 230V with natural variation
  const van = rand(224, 233);
  const vbn = rand(223, 232);
  const vcn = rand(225, 234);

  // Phase to Phase voltages
  const vab = rand(392, 403);
  const vbc = rand(390, 401);
  const vca = rand(393, 404);

  // Currents (Base ~60A * loadFactor)
  const ia = Number((rand(52, 65) * loadFactor).toFixed(2));
  const ib = Number((rand(50, 63) * loadFactor).toFixed(2));
  const ic = Number((rand(51, 64) * loadFactor).toFixed(2));
  const iavg = Number(((ia + ib + ic) / 3).toFixed(2));
  const ineutral = Number(Math.abs(ia - ib + ic * 0.1).toFixed(2));

  // Power factors
  const pfa = rand(0.91, 0.97);
  const pfb = rand(0.90, 0.96);
  const pfc = rand(0.92, 0.98);
  const pfsig = Number(((pfa + pfb + pfc) / 3).toFixed(2));

  // Powers in Watts (DB stores Watts, readingModel divides by 1000 for kW)
  const sa = Math.round(van * ia);
  const sb = Math.round(vbn * ib);
  const sc = Math.round(vcn * ic);
  const ssig = sa + sb + sc;

  const pa = Math.round(sa * pfa);
  const pb = Math.round(sb * pfb);
  const pc = Math.round(sc * pfc);
  const psig = pa + pb + pc;

  const qa = Math.round(Math.sqrt(Math.max(0, sa * sa - pa * pa)));
  const qb = Math.round(-Math.sqrt(Math.max(0, sb * sb - pb * pb)));
  const qc = Math.round(Math.sqrt(Math.max(0, sc * sc - pc * pc)));
  const qsig = qa + qb + qc;

  // Cumulative energy meters
  const deltaKwh = Math.round(psig / 1000);
  const deltaKvarh = Math.round(Math.abs(qsig) / 1000);
  const currentKwh = prevKwh + Math.max(25, deltaKwh);
  const currentKvarh = prevKvarh + Math.max(8, deltaKvarh);

  // Harmonics
  const thdv1 = rand(1.2, 3.4);
  const thdv2 = rand(1.1, 3.2);
  const thdv3 = rand(1.3, 3.5);
  const thdi1 = rand(2.8, 6.8);
  const thdi2 = rand(2.5, 6.5);
  const thdi3 = rand(3.0, 7.2);

  // Temperatures (warmer during peak daytime and higher load)
  const tempOffset = isPeak ? rand(6, 12) : rand(0, 4);
  const oilTemp = Number((rand(48, 54) + tempOffset).toFixed(1));
  const busTemp1 = Number((rand(43, 49) + tempOffset * 0.8).toFixed(1));
  const busTemp2 = Number((rand(44, 50) + tempOffset * 0.8).toFixed(1));
  const busTemp3 = Number((rand(43, 49) + tempOffset * 0.8).toFixed(1));
  const wti1 = Number((oilTemp + rand(6, 11)).toFixed(1));
  const wti2 = Number((oilTemp + rand(5, 10)).toFixed(1));
  const wti3 = Number((oilTemp + rand(6, 12)).toFixed(1));

  // Physical
  const press = Number((rand(0.38, 0.44) + (isPeak ? 0.03 : 0)).toFixed(2));
  const level = 1;

  // K-Factor & Derating
  const krateda = 4.0;
  const kratedb = 4.0;
  const kratedc = 4.0;
  const deratinga = rand(92.0, 96.5);
  const deratingb = rand(91.5, 96.0);
  const deratingc = rand(92.5, 97.0);

  // Frequency
  const freq = rand(49.92, 50.08, 3);

  // DGA & Unbalance
  const h2ppm = Math.floor(rand(8, 22, 0));
  const moistureppm = Math.floor(rand(7, 16, 0));
  const unbalanceuv = rand(0.2, 1.2);
  const unbalancevw = rand(0.2, 1.1);
  const unbalanceuw = rand(0.3, 1.3);

  return {
    point: {
      trafoId: TRAFO_ID,
      timestamp: ts,
      Van: van,
      Vbn: vbn,
      Vcn: vcn,
      Vab: vab,
      Vbc: vbc,
      Vca: vca,
      Ia: ia,
      Ib: ib,
      Ic: ic,
      Iavg: iavg,
      Ineutral: ineutral,
      THDV1: thdv1,
      THDV2: thdv2,
      THDV3: thdv3,
      THDI1: thdi1,
      THDI2: thdi2,
      THDI3: thdi3,
      Pa: pa,
      Pb: pb,
      Pc: pc,
      Psig: psig,
      Qa: qa,
      Qb: qb,
      Qc: qc,
      Qsig: qsig,
      Sa: sa,
      Sb: sb,
      Sc: sc,
      Ssig: ssig,
      PFa: pfa,
      PFb: pfb,
      PFc: pfc,
      PFsig: pfsig,
      Freq: freq,
      kWh: currentKwh,
      kVARh: currentKvarh,
      BusTemp1: busTemp1,
      BusTemp2: busTemp2,
      BusTemp3: busTemp3,
      OilTemp: oilTemp,
      WTITemp1: wti1,
      WTITemp2: wti2,
      WTITemp3: wti3,
      Press: press,
      Level: level,
      KRateda: krateda,
      deRatinga: deratinga,
      KRatedb: kratedb,
      deRatingb: deratingb,
      KRatedc: kratedc,
      deRatingc: deratingc,
      H2ppm: h2ppm,
      Moistureppm: moistureppm,
      UnbalanceUV: unbalanceuv,
      UnbalanceVW: unbalancevw,
      UnbalanceUW: unbalanceuw
    },
    nextKwh: currentKwh,
    nextKvarh: currentKvarh
  };
}

async function insertRowsBatch(conn, table, rows) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const values = rows.map(r => cols.map(c => r[c]));
  await conn.query(
    `INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(",")}) VALUES ?`,
    [values]
  );
}

async function run() {
  console.log(`=== Seeding 2 Years Sensor Data (Hourly Interval) ===`);
  console.log(`Database: ${DB} | TrafoId: ${TRAFO_ID}`);

  const conn = await mysql.createConnection({
    ...getDbConfig(),
    database: DB
  });

  try {
    // 1. Calculate Time Range: 2 Years (730 Days) Backwards ending NOW
    const now = new Date();
    now.setMinutes(0, 0, 0); // Align to current hour

    const TOTAL_HOURS = 2 * 365 * 24; // 17,520 data points (2 full years)
    console.log(`Generating ${TOTAL_HOURS} hours of data ending at: ${now.toISOString()} (2 tahun ke belakang, bukan ke depan)`);

    // Clean old reading data for this trafo
    await conn.query("DELETE FROM reading_data WHERE trafoId = ?", [TRAFO_ID]);
    console.log(`Cleared existing reading_data for trafoId ${TRAFO_ID}`);

    let currentKwh = 100000;
    let currentKvarh = 20000;
    const allRows = [];

    // Loop backwards from 8760 hours ago to NOW (i = 0)
    for (let i = TOTAL_HOURS; i >= 0; i--) {
      const ts = new Date(now.getTime() - i * 3600 * 1000);
      const res = makeHourlyReading(ts, i, currentKwh, currentKvarh);
      currentKwh = res.nextKwh;
      currentKvarh = res.nextKvarh;
      allRows.push(res.point);
    }

    console.log(`Generated ${allRows.length} data rows. Inserting in batches of 500...`);
    const BATCH_SIZE = 500;
    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
      const batch = allRows.slice(i, i + BATCH_SIZE);
      await insertRowsBatch(conn, "reading_data", batch);
      process.stdout.write(`Inserted ${Math.min(i + BATCH_SIZE, allRows.length)} / ${allRows.length}\r`);
    }
    console.log(`\nSuccessfully inserted ${allRows.length} rows into reading_data!`);

    // 2. Also populate temp_reading_data_realtime with latest 60 points (last 60 minutes)
    await conn.query("DELETE FROM temp_reading_data_realtime WHERE trafoId = ?", [TRAFO_ID]);
    const realtimeRows = [];
    const realtimeNow = new Date();
    for (let i = 59; i >= 0; i--) {
      const ts = new Date(realtimeNow.getTime() - i * 60 * 1000);
      const res = makeHourlyReading(ts, i, currentKwh, currentKvarh);
      realtimeRows.push(res.point);
    }
    await insertRowsBatch(conn, "temp_reading_data_realtime", realtimeRows);
    console.log(`Successfully updated temp_reading_data_realtime with ${realtimeRows.length} recent points!`);

    // 3. Ensure temp_voltage_harmonic and temp_current_harmonic have valid rows for Phase 1, 2, 3
    const harmonicCols = [
      "1st", "3rd", "5th", "7th", "9th", "11th", "13th", "15th",
      "17th", "19th", "21th", "23th", "25th", "27th", "29th", "31th"
    ];
    const vHarmonics = [1, 2, 3].map(phase => {
      const r = { trafoId: TRAFO_ID, Phase: phase, "1st": 100 };
      for (const o of harmonicCols.slice(1)) {
        r[o] = rand(0.3, 4.5);
      }
      return r;
    });
    const iHarmonics = [1, 2, 3].map(phase => {
      const r = { trafoId: TRAFO_ID, Phase: phase, "1st": 100 };
      for (const o of harmonicCols.slice(1)) {
        r[o] = rand(0.5, 7.5);
      }
      return r;
    });

    await conn.query("DELETE FROM temp_voltage_harmonic WHERE trafoId = ?", [TRAFO_ID]);
    await conn.query("DELETE FROM temp_current_harmonic WHERE trafoId = ?", [TRAFO_ID]);
    await insertRowsBatch(conn, "temp_voltage_harmonic", vHarmonics);
    await insertRowsBatch(conn, "temp_current_harmonic", iHarmonics);
    console.log(`Successfully updated harmonic spectrum tables for Phase R, S, T!`);

    // 4. Update transformer_status to all normal (0)
    await conn.query(
      `UPDATE transformer_status SET 
        Vab = 0, Vbc = 0, Vca = 0, Current1 = 0, Current2 = 0, Current3 = 0,
        Ineutral = 0, THDVoltage1 = 0, THDVoltage2 = 0, THDVoltage3 = 0,
        THDCurrent1 = 0, THDCurrent2 = 0, THDCurrent3 = 0, PF = 0, Freq = 0,
        BusTemp1 = 0, BusTemp2 = 0, BusTemp3 = 0, OilTemp = 0,
        WTITemp1 = 0, WTITemp2 = 0, WTITemp3 = 0, Pressure = 0, OilLevel = 0
       WHERE trafoId = ?`,
      [TRAFO_ID]
    );
    console.log(`Successfully synced transformer_status with normal status!`);

    // Verification
    const [[{ total }]] = await conn.query("SELECT COUNT(*) as total FROM reading_data WHERE trafoId = ?", [TRAFO_ID]);
    const [range] = await conn.query("SELECT MIN(timestamp) as min_ts, MAX(timestamp) as max_ts FROM reading_data WHERE trafoId = ?", [TRAFO_ID]);
    console.log(`\n=== Verification ===`);
    console.log(`Total rows in reading_data: ${total}`);
    console.log(`Min Timestamp (1 year ago): ${range[0].min_ts}`);
    console.log(`Max Timestamp (Now): ${range[0].max_ts}`);

  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    await conn.end();
  }
}

run();
