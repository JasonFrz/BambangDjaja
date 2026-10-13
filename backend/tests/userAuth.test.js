const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const ua = require("../utils/userAuth");

test("hashPassword sha256(password + salt) cocok dengan seed demo", () => {
  const h = ua.hashPassword("demo123", "ab12c");
  assert.match(h, /^[a-f0-9]{64}$/);
  assert.equal(
    h,
    require("crypto").createHash("sha256").update("demo123ab12c").digest("hex"),
  );
});

test("makeSalt 5 karakter heksadesimal, berbeda tiap panggilan", () => {
  const a = ua.makeSalt(),
    b = ua.makeSalt();
  assert.match(a, /^[a-f0-9]{5}$/);
  assert.notEqual(a, b);
});

test("verifyPassword menerima sha256+salt dan bcrypt, menolak yang salah", async () => {
  const salt = "ab12c";
  assert.equal(await ua.verifyPassword("demo123", ua.hashPassword("demo123", salt), salt), true);
  assert.equal(await ua.verifyPassword("salah", ua.hashPassword("demo123", salt), salt), false);
  const bc = await bcrypt.hash("rahasia", 4);
  assert.equal(await ua.verifyPassword("rahasia", bc, null), true);
  assert.equal(await ua.verifyPassword("rahasia", bc, "salt-apa-saja"), true);
  assert.equal(await ua.verifyPassword("x", "plaintext", null), false);
  assert.equal(await ua.verifyPassword("x", null, null), false);
});

test("roleFromStatus dan statusFromRole saling kebalikan", () => {
  assert.equal(ua.roleFromStatus(9), "superuser");
  assert.equal(ua.roleFromStatus(1), "admin");
  assert.equal(ua.roleFromStatus(2), "user");
  assert.equal(ua.roleFromStatus("9"), "superuser");
  assert.equal(ua.roleFromStatus(null), "user");
  assert.equal(ua.statusFromRole("superuser"), 9);
  assert.equal(ua.statusFromRole("Admin"), 1);
  assert.equal(ua.statusFromRole("apa"), 2);
});
