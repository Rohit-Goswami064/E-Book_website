import pg from "pg"
const { Client } = pg

const client = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
})

async function main() {
  await client.connect()
  console.log("=== ALL ORDERS IN DATABASE ===")
  const orders = await client.query(`
    SELECT o.id, o.order_number, o.user_id, o.status, o.total_cents, o.customer_email, o.customer_name, o.customer_phone, o.created_at,
           json_agg(json_build_object('book_id', oi.book_id, 'price', oi.price_cents)) as items
    FROM public.orders o
    LEFT JOIN public.order_items oi ON oi.order_id = o.id
    GROUP BY o.id, o.order_number, o.user_id, o.status, o.total_cents, o.customer_email, o.customer_name, o.customer_phone, o.created_at
    ORDER BY o.created_at DESC
  `)
  console.table(orders.rows.map(o => ({
    id: o.id.slice(0, 8),
    number: o.order_number,
    user: o.user_id.slice(0, 8),
    status: o.status,
    total: o.total_cents,
    email: o.customer_email,
    created: o.created_at?.toISOString()
  })))

  console.log("\n=== ALL PAYMENTS IN DATABASE ===")
  const payments = await client.query(`
    SELECT id, order_id, user_id, amount_cents, status, razorpay_order_id, razorpay_payment_id, created_at
    FROM public.payments
    ORDER BY created_at DESC
  `)
  console.table(payments.rows.map(p => ({
    id: p.id.slice(0, 8),
    order: p.order_id.slice(0, 8),
    user: p.user_id.slice(0, 8),
    amount: p.amount_cents,
    status: p.status,
    rzp_order: p.razorpay_order_id,
    rzp_pay: p.razorpay_payment_id,
    created: p.created_at?.toISOString()
  })))

  console.log("\n=== ALL ENTITLEMENTS IN DATABASE ===")
  const entitlements = await client.query(`
    SELECT be.id, be.user_id, be.book_id, be.order_id, be.is_revoked, b.title, p.email
    FROM public.book_entitlements be
    JOIN public.books b ON b.id = be.book_id
    JOIN public.profiles p ON p.id = be.user_id
  `)
  console.table(entitlements.rows.map(e => ({
    user: e.email,
    book: e.title.slice(0, 25),
    order: e.order_id?.slice(0, 8),
    revoked: e.is_revoked
  })))

  await client.end()
}
main()
