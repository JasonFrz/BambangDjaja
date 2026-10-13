const test = require("node:test");
const assert = require("node:assert/strict");
const { makeFakeDb } = require("./helpers/fakeDb");
const {
  patchMasterDb,
  patchCompanyDb,
  patchAllCompanies,
} = require("../utils/schemaPatch");

function alterCalls(db) {
  return db.calls
    .filter((c) => /^(ALTER|CREATE) /i.test(c.sql))
    .map((c) => c.sql);
}

test("patchMasterDb menambah email, phone, dan user_layouts kalau belum ada", async () => {
  const db = makeFakeDb(() => []);
  await patchMasterDb(db);
  const sqls = alterCalls(db);
  assert.ok(sqls.some((s) => /ALTER TABLE `user` ADD COLUMN `email`/.test(s)));
  assert.ok(sqls.some((s) => /ALTER TABLE `user` ADD COLUMN `phone`/.test(s)));
  assert.ok(sqls.some((s) => /CREATE TABLE user_layouts/.test(s)));
});

test("patchMasterDb tidak mengubah apa pun kalau sudah ada", async () => {
  const db = makeFakeDb(() => [{ ada: 1 }]); // semua SHOW mengembalikan 1 baris = sudah ada
  await patchMasterDb(db);
  assert.equal(alterCalls(db).length, 0);
});

test("patchCompanyDb menambah trafoId ke tabel temp dan index unik", async () => {
  const db = makeFakeDb((sql) => (/SHOW TABLES/i.test(sql) ? [{ t: 1 }] : []));
  await patchCompanyDb(db);
  const sqls = alterCalls(db);
  assert.ok(
    sqls.some((s) =>
      /ALTER TABLE `temp_reading_data_realtime` ADD COLUMN `trafoId`/.test(s),
    ),
  );
  assert.ok(
    sqls.some((s) =>
      /ALTER TABLE `temp_voltage_harmonic` ADD COLUMN `trafoId`/.test(s),
    ),
  );
  assert.ok(
    sqls.some((s) =>
      /ALTER TABLE `temp_current_harmonic` ADD COLUMN `trafoId`/.test(s),
    ),
  );
  assert.ok(
    sqls.some((s) =>
      /ALTER TABLE `reading_data` ADD UNIQUE INDEX uq_reading_trafo_ts/.test(s),
    ),
  );
  assert.ok(
    sqls.some((s) =>
      /ALTER TABLE `failure_log` ADD UNIQUE INDEX uq_failure_trafo_id/.test(s),
    ),
  );
});

test("patchCompanyDb melewati tabel yang tidak ada", async () => {
  const db = makeFakeDb(() => []);
  await patchCompanyDb(db);
  assert.equal(alterCalls(db).length, 0);
});

test("patchAllCompanies melanjutkan ke perusahaan lain kalau satu DB tidak ada", async () => {
  const dicoba = [];
  const openDb = async (name) => {
    dicoba.push(name);
    if (name === "db_hilang") {
      const e = new Error("Unknown database");
      e.code = "ER_BAD_DB_ERROR";
      throw e;
    }
    return makeFakeDb(() => []);
  };
  const hasil = await patchAllCompanies(["db_hilang", "db_ada"], openDb);
  assert.deepEqual(dicoba, ["db_hilang", "db_ada"]);
  assert.deepEqual(hasil, { ok: ["db_ada"], gagal: ["db_hilang"] });
});
