const { roleFromStatus } = require("./userAuth");

const USER_SELECT = `SELECT u.user_id, u.username, u.status, u.company_id, u.email, u.phone, u.salt,
    c.company_name, c.database_name, c.tmu_version
    FROM user u LEFT JOIN company c ON u.company_id = c.company_id`;

async function getCompanyByDb(masterDb, dbName) {
  const [rows] = await masterDb.execute(
    "SELECT * FROM company WHERE database_name = ? LIMIT 1",
    [dbName],
  );
  return rows[0] || null;
}

async function findUserByUsername(masterDb, username) {
  const [rows] = await masterDb.execute(
    `${USER_SELECT} WHERE u.username = ? LIMIT 1`,
    [username],
  );
  return rows[0] || null;
}

async function listUsersByCompany(
  masterDb,
  companyId,
  { excludeAdmin = false } = {},
) {
  const extra = excludeAdmin ? " AND u.status != 1" : "";
  const [rows] = await masterDb.execute(
    `${USER_SELECT} WHERE u.company_id = ?${extra} ORDER BY u.user_id DESC`,
    [companyId],
  );
  return rows.map(formatUser);
}

function formatUser(row) {
  const db = row.database_name || "-";
  const company =
    row.company_name || (row.database_name ? row.database_name : "-");
  return {
    id: row.user_id,
    username: row.username,
    role: roleFromStatus(row.status),
    company_id: row.company_id || 0,
    db_name: db,
    company_name: company,
    nama_db: db,
    nama_perusahaan: company,
    nomor_telpon: row.phone || "",
    email: row.email || "",
    created_at: null,
  };
}

module.exports = {
  USER_SELECT,
  getCompanyByDb,
  findUserByUsername,
  listUsersByCompany,
  formatUser,
};
