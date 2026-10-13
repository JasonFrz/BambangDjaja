const test = require("node:test");
const assert = require("node:assert/strict");
const { makeFakeDb } = require("./helpers/fakeDb");
const mm = require("../utils/masterModel");

test("formatUser memetakan baris user+company ke field yang dibaca frontend", () => {
  const u = mm.formatUser({
    user_id: 7,
    username: "budi",
    status: 2,
    company_id: 92,
    email: "b@x.id",
    phone: "+628111",
    company_name: "PT Demo",
    database_name: "db_demo",
  });
  assert.deepEqual(u, {
    id: 7,
    username: "budi",
    role: "user",
    company_id: 92,
    db_name: "db_demo",
    company_name: "PT Demo",
    nama_db: "db_demo",
    nama_perusahaan: "PT Demo",
    nomor_telpon: "+628111",
    email: "b@x.id",
    created_at: null,
  });
});

test('formatUser memberi "-" untuk user tanpa perusahaan', () => {
  const u = mm.formatUser({ user_id: 1, username: "root", status: 1, company_id: 0 });
  assert.equal(u.role, "admin");
  assert.equal(u.db_name, "-");
  assert.equal(u.company_name, "-");
  assert.equal(u.nomor_telpon, "");
});

test("getCompanyByDb mengembalikan baris company atau null", async () => {
  const db = makeFakeDb((sql, params) =>
    params[0] === "db_demo" ? [{ company_id: 92, database_name: "db_demo" }] : [],
  );
  assert.equal((await mm.getCompanyByDb(db, "db_demo")).company_id, 92);
  assert.equal(await mm.getCompanyByDb(db, "db_lain"), null);
  assert.match(db.calls[0].sql, /FROM company WHERE database_name = \?/);
});

test("listUsersByCompany memakai company_id dan bisa mengecualikan admin", async () => {
  const db = makeFakeDb(() => [
    { user_id: 3, username: "ani", status: 9, company_id: 92, company_name: "PT Demo", database_name: "db_demo" },
  ]);
  const users = await mm.listUsersByCompany(db, 92, { excludeAdmin: true });
  assert.equal(users[0].role, "superuser");
  assert.match(db.calls[0].sql, /WHERE u\.company_id = \? AND u\.status != 1/);
  assert.deepEqual(db.calls[0].params, [92]);
});
