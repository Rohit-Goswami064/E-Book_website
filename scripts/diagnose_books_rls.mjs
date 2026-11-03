import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function run() {
  await client.connect()

  // 1. Check policies on books
  const policies = await client.query(`
    SELECT pol.polname, pol.polcmd, pol.polpermissive,
           pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression
    FROM pg_policy pol
    JOIN pg_class pc ON pol.polrelid = pc.oid
    WHERE pc.relname = 'books';
  `)
  console.log("=== POLICIES ON books ===")
  console.log(policies.rows)

  // 2. Check policies on book_categories
  const bcPolicies = await client.query(`
    SELECT pol.polname, pol.polcmd, pol.polpermissive,
           pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression
    FROM pg_policy pol
    JOIN pg_class pc ON pol.polrelid = pc.oid
    WHERE pc.relname = 'book_categories';
  `)
  console.log("=== POLICIES ON book_categories ===")
  console.log(bcPolicies.rows)

  // 3. Check is_admin and is_super_admin functions
  const fnRes = await client.query(`
    SELECT proname, prosrc 
    FROM pg_proc 
    WHERE proname IN ('is_admin', 'is_super_admin');
  `)
  console.log("=== HELPER FUNCTIONS ===")
  console.log(fnRes.rows)

  // 4. Check policies on audit_logs
  const alPolicies = await client.query(`
    SELECT pol.polname, pol.polcmd, pol.polpermissive,
           pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression
    FROM pg_policy pol
    JOIN pg_class pc ON pol.polrelid = pc.oid
    WHERE pc.relname = 'audit_logs';
  `)
  console.log("=== POLICIES ON audit_logs ===")
  console.log(alPolicies.rows)

  // 5. Check user_roles for the current logged in user
  const userRoles = await client.query(`
    SELECT ur.*, p.email 
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id;
  `)
  console.log("=== USER ROLES IN DB ===")
  console.log(userRoles.rows)

  await client.end()
}

run().catch(console.error)
