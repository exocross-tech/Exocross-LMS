const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { Pool } = require("pg");

const supabaseUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:ExocrossPass2026@db.aubiybxrmejgoyczlxrc.supabase.co:5432/postgres";

// =====================================================
// SUPABASE POSTGRESQL POOL INITIALIZATION
// =====================================================
let pgPool = null;
let connectingPromise = null;

const createPool = () => {
  return new Pool({
    connectionString: supabaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
};

// =====================================================
// QUERY TRANSLATOR (T-SQL to PostgreSQL Dialect)
// =====================================================
const translateQuery = (sqlText, inputs = {}) => {
  if (!sqlText || typeof sqlText !== "string") {
    return { query: "", values: [] };
  }

  let translated = sqlText;

  // 1. Strip MSSQL locking hints
  translated = translated.replace(/WITH\s*\(\s*(NOLOCK|ROWLOCK|UPDLOCK)\s*\)/gi, "");

  // 2. Translate subquery (SELECT TOP (\d+) ...) to (SELECT ... LIMIT n)
  translated = translated.replace(/\(\s*SELECT\s+TOP\s+(\d+)\s+([\s\S]*?)\)/gi, (m, limit, body) => {
    let clean = body.trim().replace(/;+$/, "");
    if (!/LIMIT\s+\d+/i.test(clean)) {
      clean += ` LIMIT ${limit}`;
    }
    return `(SELECT ${clean})`;
  });

  // Translate top-level SELECT TOP (\d+) ...
  let topLimit = null;
  const topMatch = translated.match(/^\s*SELECT\s+TOP\s+(\d+)\s+/i);
  if (topMatch) {
    topLimit = topMatch[1];
    translated = translated.replace(/^\s*SELECT\s+TOP\s+\d+\s+/i, "SELECT ");
  }

  // 3. Replace common date & null functions
  translated = translated.replace(/GETDATE\(\)/gi, "CURRENT_TIMESTAMP");
  translated = translated.replace(/SYSDATETIME\(\)/gi, "CURRENT_TIMESTAMP");
  translated = translated.replace(/ISNULL\(/gi, "COALESCE(");
  translated = translated.replace(/TRY_CONVERT\s*\(\s*INT\s*,\s*([^)]+)\)/gi, "CAST($1 AS INT)");

  // Automatically quote datepart argument in DATEADD and DATEDIFF (e.g. DATEADD(day, -> DATEADD('day',)
  translated = translated.replace(/\bDATEADD\s*\(\s*(second|minute|hour|day|month|year|week)\s*,/gi, "DATEADD('$1',");
  translated = translated.replace(/\bDATEDIFF\s*\(\s*(second|minute|hour|day|month|year|week)\s*,/gi, "DATEDIFF('$1',");

  // CONVERT(VARCHAR(5), ..., 108) -> TO_CHAR(..., 'HH24:MI')
  translated = translated.replace(/CONVERT\s*\(\s*VARCHAR\s*\(\s*5\s*\)\s*,\s*([^,]+?)\s*,\s*108\s*\)/gi, "TO_CHAR($1, 'HH24:MI')");
  translated = translated.replace(/CONVERT\s*\(\s*VARCHAR\s*\(\s*\d+\s*\)\s*,\s*([^,]+?)\s*,\s*108\s*\)/gi, "TO_CHAR($1, 'HH24:MI:SS')");
  translated = translated.replace(/CONVERT\s*\(\s*VARCHAR\s*\(\s*\d+\s*\)\s*,\s*([^)]+?)\s*\)/gi, "CAST($1 AS VARCHAR)");

  // Date/Time arithmetic translation for class schedules (MSSQL DATETIME cast to PG date+time)
  translated = translated.replace(
    /CAST\s*\(\s*CAST\s*\(\s*([a-z0-9_.]*CLASS_DATE)\s+AS\s+DATETIME\s*\)\s*\+\s*CAST\s*\(\s*([a-z0-9_.]*CLASS_TIME)\s+AS\s+DATETIME\s*\)\s*AS\s+DATETIME\s*\)/gi,
    "($1 + $2)"
  );

  // 4. Translate parameter bindings (@PARAM -> $1, $2, ...)
  const values = [];
  let paramIndex = 1;
  const paramMap = {};

  // Sort parameter keys by length descending to prevent partial replacements (e.g. @ID vs @ID_NUM)
  const sortedKeys = Object.keys(inputs).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const val = inputs[key];
    const regex = new RegExp("@" + key + "\\b", "gi");
    if (regex.test(translated)) {
      if (!paramMap[key]) {
        paramMap[key] = paramIndex++;
        values.push(val);
      }
      translated = translated.replace(regex, "$" + paramMap[key]);
    }
  }

  // If top-level TOP was stripped and no LIMIT is present, strip trailing semicolon and append LIMIT
  if (topLimit && !/LIMIT\s+\d+\s*$/i.test(translated.trim().replace(/;+$/, ""))) {
    translated = translated.trim().replace(/;+$/, "") + ` LIMIT ${topLimit}`;
  }

  return { query: translated, values };
};

// Normalize output record keys to UPPERCASE for 100% controller compatibility
const normalizeRecords = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const normalized = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k.toUpperCase()] = v;
    }
    return normalized;
  });
};

// =====================================================
// MSSQL REQUEST EMULATOR OVER POSTGRESQL
// =====================================================
class SupabaseRequest {
  constructor(clientOrPool) {
    this.client = clientOrPool;
    this.parameters = {};
  }

  input(name, typeOrVal, val) {
    const actualVal = val !== undefined ? val : typeOrVal;
    this.parameters[name] = actualVal;
    return this;
  }

  async query(sqlText) {
    const { query, values } = translateQuery(sqlText, this.parameters);
    try {
      const res = await this.client.query(query, values);
      const upperRecords = normalizeRecords(res.rows);
      return {
        recordset: upperRecords,
        recordsets: [upperRecords],
        rowsAffected: [res.rowCount || 0],
        output: {},
      };
    } catch (err) {
      console.error("❌ Supabase Query Error:", err.message);
      console.error("   Query:", query);
      console.error("   Values:", values);
      throw err;
    }
  }

  async execute(procedureName) {
    throw new Error(`Stored procedures (${procedureName}) not supported in PostgreSQL mode.`);
  }
}

// =====================================================
// MSSQL TRANSACTION EMULATOR OVER POSTGRESQL
// =====================================================
class SupabaseTransaction {
  constructor(pool) {
    this.pool = pool;
    this.client = null;
  }

  async begin() {
    this.client = await this.pool.connect();
    await this.client.query("BEGIN");
  }

  request() {
    if (!this.client) {
      throw new Error("Transaction not started. Call transaction.begin() first.");
    }
    return new SupabaseRequest(this.client);
  }

  async commit() {
    if (this.client) {
      try {
        await this.client.query("COMMIT");
      } finally {
        this.client.release();
        this.client = null;
      }
    }
  }

  async rollback() {
    if (this.client) {
      try {
        await this.client.query("ROLLBACK");
      } finally {
        this.client.release();
        this.client = null;
      }
    }
  }
}

// =====================================================
// SUPABASE POOL WRAPPER
// =====================================================
class SupabasePoolWrapper {
  constructor(pool) {
    this.pool = pool;
    this.connected = true;
  }

  request() {
    return new SupabaseRequest(this.pool);
  }

  transaction() {
    return new SupabaseTransaction(this.pool);
  }

  async query(sqlText, params = []) {
    const { query, values } = translateQuery(sqlText, {});
    const res = await this.pool.query(query, params.length ? params : values);
    const upperRecords = normalizeRecords(res.rows);
    return {
      recordset: upperRecords,
      recordsets: [upperRecords],
      rowsAffected: [res.rowCount || 0],
    };
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
    }
  }
}

// =====================================================
// CONNECTION MANAGER
// =====================================================
let poolWrapper = null;

const connectDB = async () => {
  if (poolWrapper && poolWrapper.connected) {
    return poolWrapper;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        if (pgPool) {
          try {
            await pgPool.end();
          } catch (_) {}
          pgPool = null;
        }

        console.log(`🔄 Connecting exclusively to Supabase Live Database...`);
        pgPool = createPool();

        // Verify connection
        const client = await pgPool.connect();
        const res = await client.query("SELECT current_database(), current_user, version()");
        client.release();

        poolWrapper = new SupabasePoolWrapper(pgPool);

        console.log("✅ Supabase PostgreSQL connected successfully!");
        console.log(`📊 Connected to DB: ${res.rows[0].current_database} as ${res.rows[0].current_user}`);
        console.log("⚡ MSSQL bypassed. Operating 100% on Supabase cloud.");

        return poolWrapper;
      } catch (error) {
        console.warn(
          `⚠️ Supabase connection failed (Attempt ${attempt}: ${error.message}). Retrying in 2500ms...`
        );
        await new Promise((res) => setTimeout(res, 2500));
      }
    }
  })().finally(() => {
    connectingPromise = null;
  });

  return connectingPromise;
};

const getPool = () => {
  if (poolWrapper && poolWrapper.connected) {
    return poolWrapper;
  }

  if (connectingPromise) {
    return poolWrapper || connectingPromise;
  }

  connectDB().catch((err) => {
    console.error("Supabase auto-reconnect error:", err.message);
  });

  return poolWrapper;
};

const closeDB = async () => {
  if (poolWrapper) {
    await poolWrapper.close();
    poolWrapper = null;
    pgPool = null;
  }
};

// =====================================================
// SQL TYPE STUBS (For 100% MSSQL Type Compatibility)
// =====================================================
const createTypeStub = (name) => {
  const fn = () => name;
  fn.type = name;
  return fn;
};

const sql = {
  Int: createTypeStub("Int"),
  BigInt: createTypeStub("BigInt"),
  SmallInt: createTypeStub("SmallInt"),
  TinyInt: createTypeStub("TinyInt"),
  Bit: createTypeStub("Bit"),
  Decimal: createTypeStub("Decimal"),
  Numeric: createTypeStub("Numeric"),
  Float: createTypeStub("Float"),
  Real: createTypeStub("Real"),
  Money: createTypeStub("Money"),
  SmallMoney: createTypeStub("SmallMoney"),
  VarChar: createTypeStub("VarChar"),
  NVarChar: createTypeStub("NVarChar"),
  Text: createTypeStub("Text"),
  NText: createTypeStub("NText"),
  Date: createTypeStub("Date"),
  Time: createTypeStub("Time"),
  DateTime: createTypeStub("DateTime"),
  DateTime2: createTypeStub("DateTime2"),
  UniqueIdentifier: createTypeStub("UniqueIdentifier"),
  MAX: "MAX",

  query: async function (strings, ...values) {
    const pool = getPool();
    let queryStr = "";
    if (Array.isArray(strings)) {
      queryStr = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? values[i] : ""), "");
    } else {
      queryStr = strings;
    }
    return pool.query(queryStr);
  },

  Request: SupabaseRequest,
  Transaction: SupabaseTransaction,
};

module.exports = {
  connectDB,
  getPool,
  closeDB,
  sql,
};
