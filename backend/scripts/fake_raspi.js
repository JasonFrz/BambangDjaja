// Simulator klien Raspberry Pi.
// node scripts/fake_raspi.js [companyKey] [serial] [wsUrl]
// Tanpa companyKey: dibaca dari master DB untuk perusahaan db_demo.
require('dotenv').config();
const WebSocket = require('ws');

const SERIAL = process.argv[3] || 'FAKE-RASPI-001';
const URL = process.argv[4] || `ws://localhost:${process.env.SERVER_PORT || 5000}/bd-iot-socket`;
const TZ = '+07:00';

const rand = (min, max, dec = 2) => Number((min + Math.random() * (max - min)).toFixed(dec));
// Format 'YYYY-MM-DD HH:mm:ss' dalam WIB, seperti view shrink_data_temp di Raspi.
function localString(d) {
  const t = new Date(d.getTime() + 7 * 3600e3);
  return t.toISOString().slice(0, 19).replace('T', ' ');
}

function reading(ts) {
  const van = rand(225, 235), vbn = rand(225, 235), vcn = rand(225, 235);
  const ia = rand(60, 90), ib = rand(60, 90), ic = rand(60, 90), pf = rand(0.85, 0.99);
  const sa = van * ia, sb = vbn * ib, sc = vcn * ic, pa = sa * pf, pb = sb * pf, pc = sc * pf;
  const q = (s, p) => Math.sqrt(s * s - p * p);
  return {
    data_id: Math.floor(ts.getTime() / 1000), timestamp: ts, Van: van, Vbn: vbn, Vcn: vcn, Vab: rand(395, 405), Vbc: rand(395, 405), Vca: rand(395, 405),
    Ia: ia, Ib: ib, Ic: ic, Iavg: (ia + ib + ic) / 3, Ineutral: rand(0, 5), THDV1: rand(1, 4), THDV2: rand(1, 4), THDV3: rand(1, 4),
    THDI1: rand(3, 9), THDI2: rand(3, 9), THDI3: rand(3, 9), Pa: pa, Pb: pb, Pc: pc, Psig: pa + pb + pc, Qa: q(sa, pa), Qb: -q(sb, pb), Qc: q(sc, pc),
    Qsig: q(sa, pa) - q(sb, pb) + q(sc, pc), Sa: sa, Sb: sb, Sc: sc, Ssig: sa + sb + sc, PFa: pf, PFb: pf, PFc: pf, PFsig: pf, Freq: rand(49.9, 50.1),
    kWh: 13000 + ts.getTime() / 3.6e6, kVARh: 4000 + ts.getTime() / 7.2e6, BusTemp1: rand(40, 55), BusTemp2: rand(40, 55), BusTemp3: rand(40, 55),
    OilTemp: rand(50, 60), WTITemp1: rand(55, 65), WTITemp2: rand(55, 65), WTITemp3: rand(55, 65), Press: rand(0.3, 0.45), Level: 1,
    KRateda: 4, deRatinga: rand(88, 96), KRatedb: 4, deRatingb: rand(88, 96), KRatedc: 4, deRatingc: rand(88, 96), H2ppm: rand(10, 25, 0), Moistureppm: rand(5, 15, 0),
    UnbalanceUV: rand(0, 1.5), UnbalanceVW: rand(0, 1.5), UnbalanceUW: rand(0, 1.5),
  };
}
const harmonicRow = (Phase) => { const r = { Phase, Row1st: 100 }; for (const o of ['3rd', '5th', '7th', '9th', '11th', '13th', '15th', '17th', '19th', '21th', '23th', '25th', '27th', '29th', '31th']) r[`Row${o}`] = rand(0.2, 6); return r; };

const STATUS_COLS = ['Vab', 'Vbc', 'Vca', 'Current1', 'Current2', 'Current3', 'Ineutral', 'THDVoltage1', 'THDVoltage2', 'THDVoltage3', 'THDCurrent1', 'THDCurrent2', 'THDCurrent3', 'PF', 'Freq', 'BusTemp1', 'BusTemp2', 'BusTemp3', 'OilTemp', 'WTITemp1', 'WTITemp2', 'WTITemp3', 'Pressure', 'OilLevel', 'H2ppm', 'Moistureppm', 'Uab', 'Ubc', 'Uca'];
const status = Object.fromEntries(STATUS_COLS.map((c) => [c, 3]));
const tripStatus = Object.fromEntries(STATUS_COLS.map((c) => [c, 0]));
let statusRequests = 0;

const transformerData = { trafoSerialNo: 'TRF-FAKE-001', ratedPower: 100, ratedHighVoltage: 20, ratedLowVoltage: 400, ratedCurrentHighVoltage: 2.89, ratedCurrentLowVoltage: 144, frequency: 50, vectorGroup: 'Dyn5', phase: 3, tapType: 'OCTC', impedance: 4, noLoadLoss: 150, fullLoadLoss: 1200, tapPercentagePlus: 2.5, tapPercentageMinus: 2.5, tapNumberPlus: 2, tapNumberMinus: 2, topOilHv: 60, topOilLv: 60, gradientHv: 10, gradientLv: 10, windTempHv: 65, windTempLv: 65, losses: 1350, hotspotFactor: 1.1, ctRatio: 200, status: 1, coolingMode: 'ONAN', SuddenPressure: 0, latitude: -6.2, longitude: 106.8, intervalDelay: 1, krated: 4 };
const transformerSettings = { voltageLowTripTreshold: 10, voltageLowTripValue: 360, voltageLowAlarmTreshold: 5, voltageLowAlarmValue: 380, voltageHighTripTreshold: 10, voltageHighTripValue: 440, voltageHighAlarmTreshold: 5, voltageHighAlarmValue: 420, voltageUnbalanceHighAlarmTreshold: 2, voltageUnbalanceHighTripTreshold: 4, frequencyLowTripTreshold: 5, frequencyLowAlarmTreshold: 2, frequencyHighTripTreshold: 5, frequencyHighAlarmTreshold: 2, topOilHighAlarmTreshold: 70, topOilHighTripTreshold: 85, windTempHighAlarmTreshold: 80, windTempHighTripTreshold: 95, powerFactorLowAlarmTreshold: 0.85, powerFactorLowTripTreshold: 0.8, currentHighAlarmTreshold: 100, currentHighTripTreshold: 120, tankPressureHighTripTreshold: 0.6, tankPressureHighAlarmTreshold: 0.5, busTempHighAlarmTreshold: 70, busTempHighTripTreshold: 85, thdCurrentAlarmTreshold: 10, thdCurrentTripTreshold: 15, thdVoltageAlarmTreshold: 5, thdVoltageTripTreshold: 8, IneutralHighAlarmTreshold: 20, IneutralHighTripTreshold: 30, H2ppmHighAlarmTreshold: 50, H2ppmHighTripTreshold: 100, MoistureppmHighAlarmTreshold: 20, MoistureppmHighTripTreshold: 30 };
const tripSettings = { voltage: 1, voltageUnbalance: 0, frequency: 1, topOilTemp: 1, busTemp: 0, powerFactor: 0, current: 1, pressure: 1, oilLevel: 1, WTITemp: 1, THDCurrent: 0, THDVoltage: 0, Ineutral: 0, H2ppm: 0, Moistureppm: 0 };

async function resolveCompanyKey() {
  if (process.argv[2]) return process.argv[2];
  const mysql = require('mysql2/promise');
  const { getDbConfig, getMasterDbName } = require('../utils/db');
  const c = await mysql.createConnection(getDbConfig(getMasterDbName()));
  const [rows] = await c.query("SELECT company_key FROM company WHERE database_name = 'db_demo' LIMIT 1");
  await c.end();
  if (!rows[0]) throw new Error('company db_demo tidak ditemukan; jalankan seed_demo.js');
  return rows[0].company_key;
}

async function main() {
  const companyKey = await resolveCompanyKey();
  const ws = new WebSocket(URL);
  const sendMsg = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  ws.on('open', () => {
    console.log(`terhubung ke ${URL} sebagai ${SERIAL} (companyKey ${companyKey.slice(0, 6)}...)`);
    sendMsg({ type: 'createConnection', companyKey, raspiSerialNo: SERIAL, version: 2, transformerData: [transformerData], transformerSettings: [transformerSettings], transformerStatus: [status], tripSettings: [tripSettings], tripStatus: [tripStatus] });
    setInterval(() => sendMsg({ type: 'ping_ws', raspiSerialNo: SERIAL }), 60000);
  });
  ws.on('message', (raw) => {
    const json = JSON.parse(raw.toString());
    const now = new Date();
    switch (json.type) {
      case 'pong_server': break;
      case 'requestReadingDataRealTime': {
        const readingData = []; for (let i = 0; i < 100; i++) readingData.push(reading(new Date(now.getTime() - i * 1000)));
        sendMsg({ type: 'getReadingDataRealTimeReceived', version: 2, companyKey, readingData }); break;
      }
      case 'requestCurrentHarmonicRealTime': sendMsg({ companyKey, type: 'receivedRequestCurrentHarmonicRealTime', data: [1, 2, 3].map(harmonicRow) }); break;
      case 'requestVoltageHarmonicRealTime': sendMsg({ companyKey, type: 'receivedRequestVoltageHarmonicRealTime', data: [1, 2, 3].map(harmonicRow) }); break;
      case 'requestSyncUpdateStatusTransformer':
        statusRequests++;
        status.OilTemp = statusRequests % 3 === 2 ? 4 : 3; // tiap permintaan ke-2 dari 3: High Alarm, lalu kembali normal
        console.log(`status diminta (#${statusRequests}), OilTemp=${status.OilTemp}`);
        sendMsg({ type: 'receivedSyncUpdateStatusTransformer', raspiSerialNo: SERIAL, transformerStatus: [{ ...status }], tripStatus: [{ ...tripStatus }], companyKey }); break;
      case 'requestTapPositionRealTime': sendMsg({ type: 'getTapPositionRealTimeReceived', raspiSerialNo: SERIAL, companyKey, transformerData: [transformerData] }); break;
      case 'requestSyncDataReading': {
        const have = new Set((json.timestampRange || []).map((e) => localString(new Date(e.timestamp))));
        const data = [];
        for (let i = 120; i >= 1; i--) {
          const ts = new Date(Math.floor(now.getTime() / 60000) * 60000 - i * 60000);
          const s = localString(ts);
          if (have.has(s)) continue;
          const r = reading(ts); delete r.timestamp; delete r.data_id;
          data.push({ timestamp_string: s, TIMESTAMP: s, ...r });
        }
        console.log(`sync reading: server punya ${have.size}, kirim ${data.length}`);
        sendMsg({ type: 'receivedSyncDataReading', version: 2, companyKey, raspiSerialNo: SERIAL, data }); break;
      }
      case 'requestSyncDataFailureLog': {
        const known = new Set((json.failureLogRange || []).map((e) => Number(e.failure_id)));
        const data = known.has(9001) ? [] : [{ failure_id: 9001, time_start: new Date(now.getTime() - 3600e3), timestamp_string: localString(new Date(now.getTime() - 3600e3)), duration: 45, failure_type: 'High Alarm', parameter: 'OilTemp', parameterValue: '71.2' }];
        sendMsg({ type: 'receivedSyncDataFailureLog', companyKey, raspiSerialNo: SERIAL, data }); break;
      }
      case 'successSyncDataReading': console.log('server konfirmasi sync reading'); break;
      case 'updateSyncTransformerSettingsFromServer': console.log('settings dari server:', Object.keys(json.data || {}).length, 'kolom'); break;
      case 'updateSyncTransformerDataFromServer': console.log('transformer data dari server'); break;
      case 'updateSyncTripSettingsFromServer': console.log('trip settings dari server'); break;
      case 'terminateConnection': console.log('server menutup koneksi'); process.exit(1); break;
      default: console.log('pesan tidak dikenal:', json.type);
    }
  });
  ws.on('close', () => { console.log('koneksi ditutup'); process.exit(0); });
  ws.on('error', (e) => { console.error('error:', e.message); process.exit(1); });
}

main().catch((e) => { console.error(e.message); process.exit(1); });
