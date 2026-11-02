const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const sql = require("mssql");

const serverHost = (process.env.MSSQL_SERVER || "127.0.0.1").trim();
const serverPort =
  parseInt((process.env.MSSQL_PORT || "1433").trim(), 10) || 1433;
const databaseName = (process.env.MSSQL_DATABASE || "ASA_LMS").trim();
const dbUser = (process.env.MSSQL_USER || "").trim();
const dbPassword = (process.env.MSSQL_PASSWORD || "").trim();

const config = {
  user: dbUser,
  password: dbPassword,
  server: serverHost,
  port: serverPort,
  database: databaseName,
  connectionTimeout: 30000,
  requestTimeout: 30000,
  pool: {
    max: 20,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
    cancelTimeout: 5000,
    useUTC: false,
    ...(process.env.MSSQL_INSTANCE
      ? { instanceName: process.env.MSSQL_INSTANCE.trim() }
      : {}),
  },
};

let pool = null;
let connectingPromise = null;

const connectDB = async () => {
  if (pool && pool.connected) {
    return pool;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    let attempt = 0;

    while (true) {
      attempt++;
      try {
        if (pool) {
          try {
            await pool.close();
          } catch (_) {}
          pool = null;
        }

        const portStr = config.port ? `:${config.port}` : "";
        console.log(
          `🔄 Connecting MSSQL ${config.server}${portStr}/${config.database}...`
        );

        const newPool = new sql.ConnectionPool(config);

        newPool.on("error", (err) => {
          console.error("❌ MSSQL Pool Error:", err.message);
        });

        await newPool.connect();
        pool = newPool;

        console.log("✅ MSSQL connected successfully");
        console.log(
          `📊 Pool: max=${config.pool.max}, min=${config.pool.min}`
        );

        // Ensure database schema columns for Project Kit Evaluation
        // Ensure database settings and schema columns
        try {
          await pool.query(`
            ALTER DATABASE CURRENT SET AUTO_CLOSE OFF;

            IF OBJECT_ID('ASSESMENT_EXAM', 'U') IS NOT NULL
            BEGIN
              IF COL_LENGTH('ASSESMENT_EXAM', 'PROJECT_KIT_MARK') IS NULL
                ALTER TABLE ASSESMENT_EXAM ADD PROJECT_KIT_MARK DECIMAL(5,2) NULL;

              IF COL_LENGTH('ASSESMENT_EXAM', 'PROJECT_KIT_COMMENT') IS NULL
                ALTER TABLE ASSESMENT_EXAM ADD PROJECT_KIT_COMMENT NVARCHAR(MAX) NULL;

              IF COL_LENGTH('ASSESMENT_EXAM', 'PROJECT_KIT_EVALUATED_BY') IS NULL
                ALTER TABLE ASSESMENT_EXAM ADD PROJECT_KIT_EVALUATED_BY INT NULL;

              IF COL_LENGTH('ASSESMENT_EXAM', 'PROJECT_KIT_REVIEWED_DATE') IS NULL
                ALTER TABLE ASSESMENT_EXAM ADD PROJECT_KIT_REVIEWED_DATE DATETIME NULL;

              IF COL_LENGTH('ASSESMENT_EXAM', 'IS_PROJECT_KIT_EVALUATED') IS NULL
                ALTER TABLE ASSESMENT_EXAM ADD IS_PROJECT_KIT_EVALUATED BIT NOT NULL DEFAULT 0;
            END

            IF OBJECT_ID('USERS', 'U') IS NOT NULL
            BEGIN
              IF COL_LENGTH('USERS', 'IS_CERTIFICATE') IS NULL
                ALTER TABLE USERS ADD IS_CERTIFICATE INT NOT NULL DEFAULT 0;

              IF COL_LENGTH('USERS', 'IS_PASSWORD_CHANGED') IS NULL
                ALTER TABLE USERS ADD IS_PASSWORD_CHANGED BIT NOT NULL DEFAULT 0;

              IF COL_LENGTH('USERS', 'ROLL_NO') IS NULL
                ALTER TABLE USERS ADD ROLL_NO NVARCHAR(50) NULL;
            END

            IF OBJECT_ID('QUESTION_TEMPLATES', 'U') IS NOT NULL
            BEGIN
              IF COL_LENGTH('QUESTION_TEMPLATES', 'SET_TYPE') IS NULL
                ALTER TABLE QUESTION_TEMPLATES ADD SET_TYPE NVARCHAR(50) NOT NULL DEFAULT 'ASSESSMENT';

              IF COL_LENGTH('QUESTION_TEMPLATES', 'DIFFICULTY_LEVEL') IS NULL
                ALTER TABLE QUESTION_TEMPLATES ADD DIFFICULTY_LEVEL NVARCHAR(50) NULL;
            END

            IF OBJECT_ID('ASSIGNMENT_ALERTS', 'U') IS NOT NULL
            BEGIN
              IF COL_LENGTH('ASSIGNMENT_ALERTS', 'PROJECT_KIT_ID') IS NULL
                ALTER TABLE ASSIGNMENT_ALERTS ADD PROJECT_KIT_ID INT NULL;

              IF COL_LENGTH('ASSIGNMENT_ALERTS', 'ASSESSMENT_TYPE') IS NULL
                ALTER TABLE ASSIGNMENT_ALERTS ADD ASSESSMENT_TYPE NVARCHAR(50) NULL;
            END

            IF OBJECT_ID('STUDENT_ASSESSMENT_SUBMISSIONS', 'U') IS NULL
            BEGIN
              CREATE TABLE STUDENT_ASSESSMENT_SUBMISSIONS (
                ID INT IDENTITY(1,1) PRIMARY KEY,
                ASSESSMENT_ID INT NOT NULL,
                STUDENT_ID INT NOT NULL,
                IMAGE_1 NVARCHAR(500) NULL,
                VIDEO_1 NVARCHAR(500) NULL,
                CREATED_AT DATETIME2 NULL DEFAULT SYSDATETIME(),
                CREATED_BY INT NULL,
                UPDATED_AT DATETIME2 NULL,
                UPDATED_BY INT NULL,
                GIVEN_MARKS DECIMAL(5,2) NULL,
                COMMENT NVARCHAR(MAX) NULL,
                GIVEN_BY INT NULL,
                REVIEWED_DATE DATETIME2 NULL
              );
            END

            IF OBJECT_ID('SESSION_REVIEWS', 'U') IS NULL
            BEGIN
              CREATE TABLE SESSION_REVIEWS (
                ID INT IDENTITY(1,1) PRIMARY KEY,
                TUTOR_ID INT NOT NULL,
                BATCH_ID INT NOT NULL,
                STUDENT_ID INT NOT NULL,
                FEEDBACK NVARCHAR(MAX) NOT NULL,
                CREATED_DATE DATETIME2 NOT NULL DEFAULT GETDATE(),
                CONSTRAINT UQ_SESSION_REVIEWS_STUDENT_TUTOR_BATCH UNIQUE (STUDENT_ID, TUTOR_ID, BATCH_ID)
              );
            END
          `);
        } catch (schemaErr) {
          console.warn("⚠️ Schema sync warning:", schemaErr.message);
        }

        return pool;
      } catch (error) {
        pool = null;
        console.warn(
          `⚠️ SQL Server is not reachable (Attempt ${attempt}: ${error.message}). Waiting and retrying in 2000ms...`
        );
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
  })().finally(() => {
    connectingPromise = null;
  });

  return connectingPromise;
};

const getPool = () => {
  if (pool && pool.connected) {
    return pool;
  }

  if (connectingPromise) {
    if (pool) return pool;
    return connectingPromise;
  }

  connectDB().catch((err) => {
    console.error("MSSQL auto-reconnect error:", err.message);
  });

  if (pool) {
    return pool;
  }

  return connectingPromise || Promise.resolve(pool);
};

const closeDB = async () => {
  try {
    if (pool) {
      await pool.close();
      pool = null;
    }
  } catch (_) {}
};

module.exports = { connectDB, getPool, closeDB, sql };
