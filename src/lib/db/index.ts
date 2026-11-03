import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg"
import { parse as parseConnectionString } from "pg-connection-string"
import crypto from "crypto"

// Global pool cache for Next.js hot-reloading in development
declare global {
  // eslint-disable-next-line no-var
  var __hiddenbooks_pg_pool: Pool | undefined
  // eslint-disable-next-line no-var
  var __hiddenbooks_pg_config_hash: string | undefined
}

export interface DatabasePoolConfig {
  user: string
  password?: string
  host: string
  port: number
  database: string
  ssl: { rejectUnauthorized: boolean }
  max: number
  idleTimeoutMillis: number
  connectionTimeoutMillis: number
}

/**
 * Derives robust, discrete PostgreSQL connection options from environment variables.
 * Recovers from dotenv-expand / @next/env variable interpolation edge-cases.
 */
export function getAuthoritativePoolConfig(): DatabasePoolConfig {
  const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error("CRITICAL: DIRECT_URL or DATABASE_URL environment variable is missing.");
  }

  let parsed: any = {};
  try {
    parsed = parseConnectionString(rawUrl);
  } catch (err: any) {
    console.error("[Database Config Parse Warning]:", err?.message);
    throw new Error("Invalid database connection string.");
  }

  return {
    user: parsed.user,
    password: parsed.password,
    host: parsed.host,
    port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    database: parsed.database || "postgres",
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

/**
 * Returns the singleton PostgreSQL connection pool.
 * Automatically invalidates and recreates the pool if configuration changes.
 */
export function getDbPool(): Pool {
  const config = getAuthoritativePoolConfig()
  const configHash = crypto
    .createHash("md5")
    .update(`${config.user}@${config.host}:${config.port}/${config.database}`)
    .digest("hex")

  if (!global.__hiddenbooks_pg_pool || global.__hiddenbooks_pg_config_hash !== configHash) {
    if (global.__hiddenbooks_pg_pool) {
      try {
        global.__hiddenbooks_pg_pool.end()
      } catch {}
    }

    global.__hiddenbooks_pg_pool = new Pool(config)
    global.__hiddenbooks_pg_config_hash = configHash

    global.__hiddenbooks_pg_pool.on("error", (err: any) => {
      console.error("[Database Pool Background Error]:", err?.message || err)
      // Reset pool on fatal auth error so subsequent queries can re-initialize cleanly
      if (err?.code === "28P01") {
        global.__hiddenbooks_pg_pool = undefined
      }
    })
  }

  return global.__hiddenbooks_pg_pool
}

/**
 * Executes a parameterized query using the connection pool.
 * Masks query errors to prevent credential leakage.
 */
export async function dbQuery<T extends QueryResultRow = any>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  const pool = getDbPool()
  const start = Date.now()
  try {
    const res = await pool.query<T>(text, params)
    const duration = Date.now() - start
    if (process.env.NODE_ENV === "development" && duration > 1000) {
      console.warn(`[Slow Query] (${duration}ms): ${text.slice(0, 100)}...`)
    }
    return res
  } catch (err: any) {
    // If fatal authentication error, reset cached pool
    if (err?.code === "28P01") {
      global.__hiddenbooks_pg_pool = undefined
    }
    console.error(`[Database Query Error] SQL: ${text.slice(0, 120)} | Error: ${err?.message}`)
    throw err
  }
}

/**
 * Executes a block of queries inside a database transaction.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDbPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await callback(client)
    await client.query("COMMIT")
    return result
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

/**
 * RLS-aware database transaction wrapper.
 * Injects Supabase JWT claims (auth.uid() = userId, role = 'authenticated')
 * into the PostgreSQL session for this transaction.
 */
export async function withUserTransaction<T>(
  userId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDbPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT set_config('role', 'authenticated', true);")
    const jwtClaims = JSON.stringify({ sub: userId, role: "authenticated" })
    await client.query("SELECT set_config('request.jwt.claims', $1, true);", [jwtClaims])
    const result = await callback(client)
    await client.query("COMMIT")
    return result
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

/**
 * Health check verification query: Confirms live connectivity without exposing credentials.
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean
  latencyMs: number
  correlationId: string
}> {
  const correlationId = crypto.randomUUID()
  const start = Date.now()
  try {
    await dbQuery("SELECT 1 AS database_connected;")
    return {
      connected: true,
      latencyMs: Date.now() - start,
      correlationId,
    }
  } catch {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      correlationId,
    }
  }
}
