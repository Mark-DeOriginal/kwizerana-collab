const { createRequire } = require("module");
const require2 = createRequire(process.cwd() + "/package.json");
const fs = require("fs");
const { neon } = require2("@neondatabase/serverless");

const env = fs.readFileSync(".env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const url = m[1].trim();
const sql = neon(url);
const run = async (q, p) => (await sql.query(q, p)).rows;

(async () => {
  const users = await run("SELECT id, email FROM users WHERE email ILIKE '%davidmark%' OR id LIKE 'd3%' ORDER BY email LIMIT 10");
  console.log(JSON.stringify(users, null, 2));
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });