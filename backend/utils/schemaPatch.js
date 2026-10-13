const { getDbConnection, getMasterDb } = require("./db");

async function hasTable(db, table) {
  const [rows] = await db.query("SHOW TABLES LIKE ?", [table]);
  return rows.length > 0;
}

async function hasColumn(db, table, column) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [
    column,
  ]);
  return rows.length > 0;
}

async function hasIndex(db, table, indexName) {
  const [rows] = await db.query(
    `SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`,
    [indexName],
  );
  return rows.length > 0;
}

async function ensureColumn(db, table, column, definition) {
  if (await hasColumn(db, table, column)) return false;
  await db.query(
    `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
  );
  console.log(`[SchemaPatch] ${table}.${column} ditambahkan`);
  return true;
}

async function ensureIndex(db, table, indexName, definition) {
  if (await hasIndex(db, table, indexName)) return false;
  await db.query(`ALTER TABLE \`${table}\` ADD ${definition}`);
  console.log(`[SchemaPatch] index ${indexName} di ${table} ditambahkan`);
  return true;
}

async function patchMasterDb(db) {
  await ensureColumn(db, "user", "email", "VARCHAR(150) DEFAULT NULL");
  await ensureColumn(db, "user", "phone", "VARCHAR(20) DEFAULT NULL");

  if (!(await hasTable(db, "user_layouts"))) {
    await db.query(`CREATE TABLE user_layouts (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        user_id INT NOT NULL,
        layout_name VARCHAR(100) DEFAULT NULL,
        layout_data JSON DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 0,
        trafo_id VARCHAR(50) DEFAULT NULL,
        KEY idx_user_layouts_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log("[SchemaPatch] tabel user_layouts dibuat");
  }
}

const TEMP_TABLES = [
  "temp_reading_data_realtime",
  "temp_voltage_harmonic",
  "temp_current_harmonic",
];

async function patchCompanyDb(db) {
  for (const table of TEMP_TABLES) {
    if (await hasTable(db, table)) {
      await ensureColumn(db, table, "trafoId", "INT NOT NULL DEFAULT 1");
    }
  }
  if (await hasTable(db, "temp_reading_data_realtime")) {
    await ensureIndex(
      db,
      "temp_reading_data_realtime",
      "idx_temp_trafo_ts",
      "INDEX idx_temp_trafo_ts (trafoId, timestamp)",
    );
  }
  if (await hasTable(db, "reading_data")) {
    await ensureIndex(
      db,
      "reading_data",
      "uq_reading_trafo_ts",
      "UNIQUE INDEX uq_reading_trafo_ts (trafoId, timestamp)",
    );
  }
  if (await hasTable(db, "failure_log")) {
    await ensureIndex(
      db,
      "failure_log",
      "uq_failure_trafo_id",
      "UNIQUE INDEX uq_failure_trafo_id (trafoId, failure_id)",
    );
  }
}

async function patchAllCompanies(dbNames, openDb = getDbConnection) {
  const hasil = { ok: [], gagal: [] };
  for (const name of dbNames) {
    try {
      const db = await openDb(name);
      await patchCompanyDb(db);
      hasil.ok.push(name);
    } catch (err) {
      console.warn(`[SchemaPatch] lewati ${name}: ${err.message}`);
      hasil.gagal.push(name);
    }
  }
  return hasil;
}

async function runSchemaPatch() {
  try {
    const master = await getMasterDb();
    await patchMasterDb(master);
    const [rows] = await master.execute(
      "SELECT database_name FROM company WHERE status = 1",
    );
    const hasil = await patchAllCompanies(rows.map((r) => r.database_name));
    console.log(
      `[SchemaPatch] selesai. ok=${hasil.ok.length} gagal=${hasil.gagal.length}`,
    );
  } catch (err) {
    console.error("[SchemaPatch] gagal:", err.message);
  }
}

module.exports = {
  patchMasterDb,
  patchCompanyDb,
  patchAllCompanies,
  runSchemaPatch,
};
