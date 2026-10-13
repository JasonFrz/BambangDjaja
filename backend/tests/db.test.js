const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../utils/db");

test("getMasterDbName pakai MASTER_DB dari env", () => {
  process.env.MASTER_DB = "master_uji";
  assert.equal(db.getMasterDbName(), "master_uji");
});

test("getMasterDbName default master_tmu_app kalau env kosong", () => {
  delete process.env.MASTER_DB;
  assert.equal(db.getMasterDbName(), "master_tmu_app");
});

test("getDbConfig di export dan kasih database bila diterima", () => {
  const cfg = db.getDbConfig("db_x");
  assert.equal(cfg.database, "db_x");
  assert.equal(typeof cfg.host, "string");
});
