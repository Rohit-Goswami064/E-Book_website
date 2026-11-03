import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://atmzsbbrycxtducxrelo.supabase.co"
const supabaseAnonKey = "sb_publishable__v6OmiglRJXtsj0yvalm3A_5qXsR4Di"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log("Testing Supabase REST and Auth endpoints...")
  try {
    // Test auth health
    const { data: authData, error: authError } = await supabase.auth.getSession()
    console.log("Auth endpoint responded successfully. Session:", authData?.session ? "Active" : "None")
    
    // Test public tables
    const { data: books, error: booksError } = await supabase.from("books").select("id, title").limit(1)
    if (booksError) {
      console.log("Query 'books' returned error:", booksError.message, "(Code:", booksError.code, ")")
    } else {
      console.log("Query 'books' succeeded! Found rows:", books?.length)
    }

    const { data: categories, error: catError } = await supabase.from("categories").select("id, name").limit(1)
    if (catError) {
      console.log("Query 'categories' returned error:", catError.message, "(Code:", catError.code, ")")
    } else {
      console.log("Query 'categories' succeeded! Found rows:", categories?.length)
    }
  } catch (err) {
    console.error("Supabase API error:", err.message)
  }
}

test()
