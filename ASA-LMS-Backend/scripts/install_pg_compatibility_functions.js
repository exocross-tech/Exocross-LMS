const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const supabaseUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:ExocrossPass2026@db.aubiybxrmejgoyczlxrc.supabase.co:5432/postgres";

const pool = new Pool({
  connectionString: supabaseUrl,
  ssl: { rejectUnauthorized: false },
});

const functionsSql = `
-- Create DATETIME domain if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'datetime') THEN
    CREATE DOMAIN DATETIME AS timestamp without time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nvarchar') THEN
    CREATE DOMAIN NVARCHAR AS text;
  END IF;
END $$;

-- 1. GETDATE() compatibility function
CREATE OR REPLACE FUNCTION GETDATE()
RETURNS timestamp without time zone AS $$
BEGIN
  RETURN clock_timestamp();
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. DATEADD functions
CREATE OR REPLACE FUNCTION DATEADD(datepart text, num integer, dt timestamp with time zone)
RETURNS timestamp with time zone AS $$
BEGIN
  CASE lower(datepart)
    WHEN 'second' THEN RETURN dt + (num || ' seconds')::interval;
    WHEN 'minute' THEN RETURN dt + (num || ' minutes')::interval;
    WHEN 'hour' THEN RETURN dt + (num || ' hours')::interval;
    WHEN 'day' THEN RETURN dt + (num || ' days')::interval;
    WHEN 'month' THEN RETURN dt + (num || ' months')::interval;
    WHEN 'year' THEN RETURN dt + (num || ' years')::interval;
    ELSE RETURN dt + (num || ' days')::interval;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION DATEADD(datepart text, num integer, dt timestamp without time zone)
RETURNS timestamp without time zone AS $$
BEGIN
  CASE lower(datepart)
    WHEN 'second' THEN RETURN dt + (num || ' seconds')::interval;
    WHEN 'minute' THEN RETURN dt + (num || ' minutes')::interval;
    WHEN 'hour' THEN RETURN dt + (num || ' hours')::interval;
    WHEN 'day' THEN RETURN dt + (num || ' days')::interval;
    WHEN 'month' THEN RETURN dt + (num || ' months')::interval;
    WHEN 'year' THEN RETURN dt + (num || ' years')::interval;
    ELSE RETURN dt + (num || ' days')::interval;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION DATEADD(datepart text, num integer, dt date)
RETURNS timestamp without time zone AS $$
BEGIN
  RETURN DATEADD(datepart, num, dt::timestamp);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION DATEADD(datepart text, num integer, base_num integer)
RETURNS timestamp without time zone AS $$
BEGIN
  RETURN DATEADD(datepart, num, '1900-01-01 00:00:00'::timestamp);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. DATEDIFF functions
CREATE OR REPLACE FUNCTION DATEDIFF(datepart text, startdate timestamp with time zone, enddate timestamp with time zone)
RETURNS integer AS $$
BEGIN
  CASE lower(datepart)
    WHEN 'second' THEN RETURN EXTRACT(EPOCH FROM (enddate - startdate))::integer;
    WHEN 'minute' THEN RETURN (EXTRACT(EPOCH FROM (enddate - startdate)) / 60)::integer;
    WHEN 'hour' THEN RETURN (EXTRACT(EPOCH FROM (enddate - startdate)) / 3600)::integer;
    WHEN 'day' THEN RETURN (EXTRACT(EPOCH FROM (enddate - startdate)) / 86400)::integer;
    WHEN 'month' THEN RETURN ((EXTRACT(YEAR FROM enddate) - EXTRACT(YEAR FROM startdate)) * 12 + EXTRACT(MONTH FROM enddate) - EXTRACT(MONTH FROM startdate))::integer;
    WHEN 'year' THEN RETURN (EXTRACT(YEAR FROM enddate) - EXTRACT(YEAR FROM startdate))::integer;
    ELSE RETURN (EXTRACT(EPOCH FROM (enddate - startdate)) / 86400)::integer;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION DATEDIFF(datepart text, startdate timestamp without time zone, enddate timestamp without time zone)
RETURNS integer AS $$
BEGIN
  CASE lower(datepart)
    WHEN 'second' THEN RETURN EXTRACT(EPOCH FROM (enddate - startdate))::integer;
    WHEN 'minute' THEN RETURN (EXTRACT(EPOCH FROM (enddate - startdate)) / 60)::integer;
    WHEN 'hour' THEN RETURN (EXTRACT(EPOCH FROM (enddate - startdate)) / 3600)::integer;
    WHEN 'day' THEN RETURN (EXTRACT(EPOCH FROM (enddate - startdate)) / 86400)::integer;
    WHEN 'month' THEN RETURN ((EXTRACT(YEAR FROM enddate) - EXTRACT(YEAR FROM startdate)) * 12 + EXTRACT(MONTH FROM enddate) - EXTRACT(MONTH FROM startdate))::integer;
    WHEN 'year' THEN RETURN (EXTRACT(YEAR FROM enddate) - EXTRACT(YEAR FROM startdate))::integer;
    ELSE RETURN (EXTRACT(EPOCH FROM (enddate - startdate)) / 86400)::integer;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION DATEDIFF(datepart text, start_int integer, enddate timestamp without time zone)
RETURNS integer AS $$
BEGIN
  RETURN DATEDIFF(datepart, '1900-01-01 00:00:00'::timestamp, enddate);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION DATEDIFF(datepart text, start_int integer, enddate timestamp with time zone)
RETURNS integer AS $$
BEGIN
  RETURN DATEDIFF(datepart, '1900-01-01 00:00:00+00'::timestamptz, enddate);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. ISJSON functions
CREATE OR REPLACE FUNCTION ISJSON(txt text)
RETURNS integer AS $$
BEGIN
  IF txt IS NULL OR trim(txt) = '' THEN
    RETURN 0;
  END IF;
  BEGIN
    PERFORM txt::json;
    RETURN 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN 0;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION ISJSON(jb jsonb)
RETURNS integer AS $$
BEGIN
  RETURN (CASE WHEN jb IS NOT NULL THEN 1 ELSE 0 END);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION ISJSON(j json)
RETURNS integer AS $$
BEGIN
  RETURN (CASE WHEN j IS NOT NULL THEN 1 ELSE 0 END);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. FORMAT date function
CREATE OR REPLACE FUNCTION FORMAT(dt timestamp with time zone, fmt text)
RETURNS text AS $$
BEGIN
  IF lower(fmt) LIKE '%hh:mm%tt%' THEN
    RETURN to_char(dt, 'HH12:MI AM');
  ELSIF lower(fmt) LIKE '%yyyy-mm-dd%' THEN
    RETURN to_char(dt, 'YYYY-MM-DD');
  ELSE
    RETURN to_char(dt, 'YYYY-MM-DD HH12:MI:SS');
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. DATENAME function
CREATE OR REPLACE FUNCTION DATENAME(part text, dt timestamp with time zone)
RETURNS text AS $$
BEGIN
  RETURN trim(to_char(dt, 'Day'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION DATENAME(part text, dt timestamp without time zone)
RETURNS text AS $$
BEGIN
  RETURN trim(to_char(dt, 'Day'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION DATENAME(part text, dt date)
RETURNS text AS $$
BEGIN
  RETURN trim(to_char(dt, 'Day'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. STRING_SPLIT function
CREATE OR REPLACE FUNCTION STRING_SPLIT(str text, delim text)
RETURNS TABLE(value text) AS $$
BEGIN
  IF str IS NULL OR str = '' THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT unnest(string_to_array(str, delim));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. OPENJSON function
CREATE OR REPLACE FUNCTION OPENJSON(txt text)
RETURNS TABLE(key text, value text, type int) AS $$
BEGIN
  IF txt IS NULL OR txt = '' OR txt = '[]' OR txt = '{}' THEN
    RETURN;
  END IF;
  BEGIN
    IF jsonb_typeof(txt::jsonb) = 'array' THEN
      RETURN QUERY
      SELECT
        (ord - 1)::text AS key,
        elem::text AS value,
        CASE jsonb_typeof(elem)
          WHEN 'null' THEN 0
          WHEN 'string' THEN 1
          WHEN 'number' THEN 2
          WHEN 'boolean' THEN 3
          WHEN 'array' THEN 4
          WHEN 'object' THEN 5
          ELSE 1
        END AS type
      FROM jsonb_array_elements(txt::jsonb) WITH ORDINALITY arr(elem, ord);
    ELSIF jsonb_typeof(txt::jsonb) = 'object' THEN
      RETURN QUERY
      SELECT
        kv.key,
        kv.value::text,
        CASE jsonb_typeof(kv.value)
          WHEN 'null' THEN 0
          WHEN 'string' THEN 1
          WHEN 'number' THEN 2
          WHEN 'boolean' THEN 3
          WHEN 'array' THEN 4
          WHEN 'object' THEN 5
          ELSE 1
        END
      FROM jsonb_each(txt::jsonb) kv;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
`;

async function main() {
  console.log("Installing MSSQL compatibility functions in Supabase...");
  const client = await pool.connect();
  try {
    await client.query(functionsSql);
    console.log("✅ Compatibility functions installed successfully!");

    // Test functions
    const test1 = await client.query("SELECT DATENAME('dw', CURRENT_DATE) as day, DATEADD('day', -1, GETDATE()) as yest");
    console.log("Test Query Result:", test1.rows[0]);
  } catch (err) {
    if (err.position) {
      const pos = parseInt(err.position, 10);
      console.error("Error at position:", pos);
      console.error("Around position:", functionsSql.substring(Math.max(0, pos - 50), pos + 50));
    }
    console.error("❌ Failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
