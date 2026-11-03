import pg from "pg"
const { Client } = pg
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function run() {
  await client.connect()
  console.log("Updating RLS policy on user_roles...")
  await client.query(`
    DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
    CREATE POLICY "Users can read roles" ON public.user_roles FOR SELECT USING (true);
  `)
  console.log("Policy updated!")
  await client.end()

  // Test with anon/publishable key
  const supabase = createSupabaseClient('https://atmzsbbrycxtducxrelo.supabase.co', 'sb_publishable__v6OmiglRJXtsj0yvalm3A_5qXsR4Di')
  const { data, error } = await supabase.from('user_roles').select('*').eq('user_id', '4a21b6af-c6e6-4bb0-bc0a-a2bf2f8b5f94')
  console.log("Supabase anon query result now:", { data, error })
}

run().catch(console.error)
