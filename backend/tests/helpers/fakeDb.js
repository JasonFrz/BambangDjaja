function makeFakeDb(responder = () => []) {
  const calls = [];
  const run = async (sql, params = []) => {
    calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    const rows = responder(sql, params);
    return [rows || [], []];
  };
  return { calls, execute: run, query: run };
}

module.exports = { makeFakeDb };
