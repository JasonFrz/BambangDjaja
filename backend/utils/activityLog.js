// Menulis ke master.user_activity_log. Tidak pernah melempar: log gagal tidak boleh menggagalkan request.
const stringifyValue = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val;
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
};

async function logActivity(masterDb, info = {}) {
  const {
    userId,
    companyId,
    username,
    type,
    description,
    module,
    trafoId,
    trafoSerialNo,
    oldValue,
    newValue,
    ip,
    userAgent,
  } = info;
  try {
    await masterDb.execute(
      `INSERT INTO user_activity_log
        (user_id, company_id, username, activity_type, activity_description, module,
         trafo_id, trafo_serial_no, old_value, new_value, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || 0,
        companyId || 0,
        username || null,
        type || "UNKNOWN",
        description || null,
        module || null,
        trafoId != null ? String(trafoId) : null,
        trafoSerialNo || null,
        stringifyValue(oldValue),
        stringifyValue(newValue),
        ip || null,
        userAgent ? String(userAgent).slice(0, 500) : null,
      ],
    );
  } catch (err) {
    console.warn("[ActivityLog] gagal menulis log:", err.message);
  }
}

module.exports = { logActivity };
