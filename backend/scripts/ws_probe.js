// node scripts/ws_probe.js  -> menunggu 1 event meter + 1 oil_sensor lalu keluar
const { io } = require('socket.io-client');
const s = io('http://localhost:5000', { transports: ['websocket'] });
let got = 0;
s.on('connect', () => { console.log('terhubung'); s.emit('subscribe_transformer', { trafoId: '1', dbName: 'db_demo' }); });
s.on('meter', (m) => { console.log('meter:', { phaseA: m.phaseA, kW: m.powerActiveTotal, eff: m.efficiency, derating: m.derating && m.derating.a }); if (++got >= 2) process.exit(0); });
s.on('oil_sensor', (o) => { console.log('oil_sensor:', o); if (++got >= 2) process.exit(0); });
setTimeout(() => { console.log('tidak ada event dalam 10 detik'); process.exit(1); }, 10000);
