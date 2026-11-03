import pg from "pg"

const connectionString = "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

async function run() {
  const client = new pg.Client({ connectionString })
  await client.connect()

  // 1. Seed default blog categories
  await client.query(`
    INSERT INTO public.blog_categories (name, slug, description)
    VALUES 
      ('Literary Essays', 'literary-essays', 'In-depth essays on classic literature, critical thinking, and philosophical traditions.'),
      ('Book Summaries & Insights', 'book-summaries', 'High-density summaries, architectural book breakdowns, and actionable takeaways.'),
      ('Publishing & Craft', 'publishing-and-craft', 'The modern mechanics of independent publishing, book design, and digital distribution.'),
      ('Philosophy & Culture', 'philosophy-and-culture', 'Explorations in moral philosophy, epistemological inquiry, and human culture.'),
      ('Deep Reading', 'deep-reading', 'Cognitive focus, intentional study habits, and long-form attention retention.')
    ON CONFLICT (slug) DO NOTHING;
  `)

  // 2. Seed default blog tags
  await client.query(`
    INSERT INTO public.blog_tags (name, slug)
    VALUES
      ('Deep Work', 'deep-work'),
      ('Literature', 'literature'),
      ('Philosophy', 'philosophy'),
      ('Book Analysis', 'book-analysis'),
      ('Digital Publishing', 'digital-publishing'),
      ('Focus & Clarity', 'focus-and-clarity'),
      ('Curated Reads', 'curated-reads')
    ON CONFLICT (slug) DO NOTHING;
  `)

  // 3. Seed default author if authors table is empty
  await client.query(`
    INSERT INTO public.authors (name, slug, bio)
    VALUES ('HiddenBooks Editorial', 'hiddenbooks-editorial', 'The official curatorial team and lead editors behind HiddenBooks publishing.')
    ON CONFLICT (slug) DO NOTHING;
  `)

  console.log("Seeding completed successfully!")
  await client.end()
}

run().catch(console.error)
