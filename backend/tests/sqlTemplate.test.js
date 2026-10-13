const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeDump, assertValidDbName } = require("../utils/sqlTemplate");

test("sanitizeDump menghapus CREATE DATABASE dan USE (LF)", () => {
  const src = [
    "CREATE DATABASE /*!32312 IF NOT EXISTS*/`base_x` /*!40100 DEFAULT CHARACTER SET utf8mb4 */;",
    "",
    "USE `base_x`;",
    "CREATE TABLE a (id int);",
  ].join("\n");

  const out = sanitizeDump(src);
  assert.doesNotMatch(out, /CREATE DATABASE/);
  assert.doesNotMatch(out, /^USE /m);
  assert.match(out, /CREATE TABLE a/);
});

test("sanitizeDump juga bekerja dengan akhir baris CRLF", () => {
  const src =
    "CREATE DATABASE `b`;\r\nUSE `b`;\r\nCREATE TABLE t (id int);\r\n";
  const out = sanitizeDump(src);
  assert.doesNotMatch(out, /CREATE DATABASE/);
  assert.doesNotMatch(out, /USE `b`/);
  assert.match(out, /CREATE TABLE t/);
});

test("sanitizeDump mengganti collation MariaDB yang tidak dikenal MySQL 5.7", () => {
  const src =
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_slovenian_ci;";

  const out = sanitizeDump(src);
  assert.equal(
    out,
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;",
  );
});

test("assertValidDbName menolak nama berbahaya", () => {
  assert.throws(
    () => assertValidDbName("db; DROP DATABASE x"),
    /Nama database tidak valid/,
  );
  assert.throws(() => assertValidDbName(""), /Nama database tidak valid/);
  assert.doesNotThrow(() => assertValidDbName("db_demo"));
});
