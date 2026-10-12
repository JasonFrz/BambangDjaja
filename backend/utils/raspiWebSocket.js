const { WebSocketServer } = require('ws');
const http = require('http');

// Menyimpan daftar koneksi aktif Raspberry Pi (berdasarkan raspiSerialNo)
const raspiClients = new Map();

function initRaspiWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade pada server HTTP utama (Port 5000 / reverse proxy / ngrok)
  server.on('upgrade', (request, socket, head) => {
    let pathname = '/';
    try {
      pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
    } catch (e) {
      pathname = request.url.split('?')[0];
    }

    if (pathname === '/bd-iot-socket') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  // Listener koneksi pada path /bd-iot-socket server utama
  wss.on('connection', (ws, req) => {
    handleRaspiConnection(ws, req);
  });

  // Opsional: Jalankan juga server standalone pada port 2083 jika dibutuhkan (sesuai .env tmu-app-client-deploy)
  const dedicatedPort = process.env.RASPI_WS_PORT || process.env.WEBSOCKET_PORT || 2083;
  try {
    const standaloneServer = http.createServer();
    const standaloneWss = new WebSocketServer({ server: standaloneServer, path: '/bd-iot-socket' });

    standaloneWss.on('connection', (ws, req) => {
      handleRaspiConnection(ws, req);
    });

    standaloneServer.listen(dedicatedPort, () => {
      console.log(`🔌 [Raspi WS] Standalone server aktif pada port ${dedicatedPort} (path: /bd-iot-socket)`);
    });

    standaloneServer.on('error', (err) => {
      console.warn(`ℹ️ [Raspi WS] Port ${dedicatedPort} tidak dapat digunakan standalone (${err.message}). Menggunakan path /bd-iot-socket pada port server utama.`);
    });
  } catch (err) {
    console.warn(`ℹ️ [Raspi WS] Standalone port setup skipped: ${err.message}`);
  }

  console.log('🔌 [Raspi WS] Handler WebSocket Raspi berhasil diaktifkan pada alamat: /bd-iot-socket');
  return { wss, raspiClients };
}

function handleRaspiConnection(ws, req) {
  let serialNo = 'unknown';
  let companyKey = '';

  const remoteIp = req.socket.remoteAddress;
  console.log(`📡 [Raspi WS] Koneksi masuk dari Raspi: ${remoteIp}`);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'createConnection':
          serialNo = message.raspiSerialNo || 'unknown';
          companyKey = message.companyKey || '';
          raspiClients.set(serialNo, ws);
          console.log(`✅ [Raspi WS] Raspi Terhubung & Terdaftar!`);
          console.log(`   - Serial No   : ${serialNo}`);
          console.log(`   - Company Key : ${companyKey}`);
          console.log(`   - Version     : ${message.version}`);
          break;

        case 'ping_ws':
          // Respon pong agar client Raspi mengetahui koneksi tetap hidup
          ws.send(JSON.stringify({ type: 'pong_server' }));
          break;

        case 'getReadingDataRealTimeReceived':
          console.log(`📥 [Raspi WS] Data Reading Real-Time diterima dari Raspi (${serialNo})`);
          // Siap disambungkan ke database ketika struktur database dikirimkan oleh user
          break;

        case 'receivedRequestReportInstantaneousDataRealTime':
          console.log(`📥 [Raspi WS] Data Instantaneous Report diterima dari Raspi (${serialNo})`);
          // Siap disambungkan ke database ketika struktur database dikirimkan oleh user
          break;

        case 'receivedSyncDataReading':
          console.log(`📥 [Raspi WS] Data Sync Reading diterima dari Raspi (${serialNo})`);
          break;

        default:
          console.log(`📩 [Raspi WS] Pesan diterima (${message.type}) dari ${serialNo}`);
          break;
      }
    } catch (err) {
      console.error('⚠️ [Raspi WS] Gagal membaca pesan JSON:', err.message);
    }
  });

  ws.on('close', () => {
    if (serialNo !== 'unknown') {
      raspiClients.delete(serialNo);
      console.log(`🔌 [Raspi WS] Koneksi Raspi Terputus: Serial ${serialNo}`);
    }
  });

  ws.on('error', (err) => {
    console.error(`⚠️ [Raspi WS] Error socket (${serialNo}):`, err.message);
  });
}

// Fungsi untuk mengirim instruksi dari Backend ke Raspi
function sendToRaspi(serialNo, payload) {
  const client = raspiClients.get(serialNo);
  if (client && client.readyState === 1) {
    client.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

module.exports = {
  initRaspiWebSocket,
  sendToRaspi,
  raspiClients
};
