// node scripts/smoke_api.js [baseUrl]  -> login demo lalu panggil setiap GET, cetak status.
const BASE = process.argv[2] || 'http://localhost:5000';

async function main() {
  const login = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'demo', password: 'demo123' }) });
  const auth = await login.json();
  if (!auth.token) throw new Error('Login gagal: ' + JSON.stringify(auth));
  const H = { Authorization: `Bearer ${auth.token}`, 'X-DB-Name': auth.db_name, 'X-Trafo-Id': '1' };
  const end = new Date().toISOString(), start = new Date(Date.now() - 3600e3).toISOString();
  const urls = [
    '/api/profile', '/api/superuser-users', '/api/layouts', '/api/trafo', '/api/trafo/company-info', '/api/trafo/1', '/api/trafo/1/data',
    '/api/trafo/1/status', '/api/trafo/1/physical', '/api/trafo/1/oil-quality', '/api/trafo/1/harmonics?type=voltage', '/api/trafo/1/harmonics?type=current',
    '/api/settings/thresholds?trafo_id=1', '/api/settings/limits?trafo_id=1',
    '/api/trends/meter?trafo_id=1', `/api/trends?trafo_id=1&start=${start}&end=${end}&interval=300`, '/api/trends/oil?trafo_id=1',
    `/api/trends/export-count?trafo_id=1&start=${start}&end=${end}`, '/api/trends/report?trafo_id=1', '/api/trends/thi?trafo_id=1',
    '/api/trends/events?trafo_id=1', '/api/trends/news?trafo_id=1', '/api/analytics/metrics', `/api/analytics/query?trafo_id=1&metrics=phaseA,oil_temperature&start=${start}&end=${end}&interval=300`,
  ];
  let fail = 0;
  for (const u of urls) {
    const r = await fetch(BASE + u, { headers: H });
    const text = await r.text();
    const ok = r.status < 400;
    if (!ok) fail++;
    console.log(`${ok ? 'OK ' : 'ERR'} ${r.status} ${u}  ${text.slice(0, 90).replace(/\s+/g, ' ')}`);
  }
  console.log(fail === 0 ? 'Semua endpoint OK' : `${fail} endpoint gagal`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => { console.error('Smoke gagal:', err.message); process.exit(1); });
