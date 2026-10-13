require("dotenv").config();
const mysql = require("mysql2/promise");
const { getDbConfig, getMasterDbName } = require("../utils/db");

(async () => {
  const c = await mysql.createConnection(getDbConfig());
  const [u] = await c.query(`SHOW COLUMNS FROM \`${getMasterDbName()}\`.user`);
  console.log("user:", u.map((x) => x.Field).join(", "));
  const [t] = await c.query(
    'SHOW COLUMNS FROM db_demo.temp_reading_data_realtime LIKE "trafoId"',
  );
  console.log("temp trafoId:", t.length);
  const [i] = await c.query(
    'SHOW INDEX FROM db_demo.reading_data WHERE Key_name = "uq_reading_trafo_ts"',
  );
  console.log("uq index cols:", i.length);
  await c.end();
})();
