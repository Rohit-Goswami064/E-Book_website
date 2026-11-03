import pg from 'pg'
const { Pool } = pg

const connectionString =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function reconcile(dryRun = true) {
  console.log(`\n======================================================`)
  console.log(` HIDDENBOOKS HISTORICAL DATA RECONCILIATION`)
  console.log(` Mode: ${dryRun ? 'DRY-RUN (Simulated)' : 'LIVE-EXECUTION (Applying Changes)'}`)
  console.log(`======================================================\n`)

  const report = {
    capturedPaymentsChecked: 0,
    ordersReconciled: [],
    entitlementsCreated: [],
    salesCounterAdjustments: [],
    anomalies: [],
  }

  // 1. Audit all captured payments and verify order status
  const paymentsRes = await pool.query(`
    SELECT p.id, p.order_id, p.user_id, p.razorpay_order_id, p.razorpay_payment_id, p.amount_cents,
           o.order_number, o.status as order_status, o.customer_email
    FROM public.payments p
    LEFT JOIN public.orders o ON o.id = p.order_id
    WHERE p.status = 'captured';
  `)
  report.capturedPaymentsChecked = paymentsRes.rows.length

  for (const p of paymentsRes.rows) {
    if (!p.order_id) {
      report.anomalies.push(`Payment ${p.razorpay_payment_id || p.id} has no linked order_id!`)
      continue
    }

    if (p.order_status !== 'paid') {
      report.ordersReconciled.push({
        orderId: p.order_id,
        orderNumber: p.order_number,
        customerEmail: p.customer_email,
        paymentId: p.razorpay_payment_id,
        previousStatus: p.order_status,
        newStatus: 'paid',
      })

      if (!dryRun) {
        await pool.query(
          `UPDATE public.orders SET status = 'paid', updated_at = NOW() WHERE id = $1;`,
          [p.order_id]
        )
      }
    }

    // 2. Audit entitlement for each order item
    const itemsRes = await pool.query(
      `SELECT oi.id, oi.book_id, oi.book_title FROM public.order_items oi WHERE oi.order_id = $1;`,
      [p.order_id]
    )

    for (const item of itemsRes.rows) {
      const entRes = await pool.query(
        `SELECT id, is_revoked FROM public.book_entitlements WHERE user_id = $1 AND book_id = $2;`,
        [p.user_id, item.book_id]
      )

      if (entRes.rows.length === 0) {
        report.entitlementsCreated.push({
          userId: p.user_id,
          bookId: item.book_id,
          bookTitle: item.book_title,
          orderId: p.order_id,
          action: 'create_entitlement',
        })

        if (!dryRun) {
          await pool.query(
            `
            INSERT INTO public.book_entitlements (user_id, book_id, order_id, entitlement_type, is_revoked, granted_at)
            VALUES ($1, $2, $3, 'purchase', false, NOW())
            ON CONFLICT (user_id, book_id) DO UPDATE SET is_revoked = false, order_id = $3;
            `,
            [p.user_id, item.book_id, p.order_id]
          )
        }
      } else if (entRes.rows[0].is_revoked) {
        report.entitlementsCreated.push({
          userId: p.user_id,
          bookId: item.book_id,
          bookTitle: item.book_title,
          orderId: p.order_id,
          action: 'reinstate_revoked_entitlement',
        })

        if (!dryRun) {
          await pool.query(
            `UPDATE public.book_entitlements SET is_revoked = false, order_id = $3 WHERE user_id = $1 AND book_id = $2;`,
            [p.user_id, item.book_id, p.order_id]
          )
        }
      }
    }
  }

  // 3. Reconcile book sales counters with actual paid orders
  const booksRes = await pool.query(`
    SELECT
      b.id,
      b.title,
      b.sales_count as current_counter,
      COUNT(DISTINCT CASE WHEN o.status = 'paid' THEN oi.id END)::int as verified_sales
    FROM public.books b
    LEFT JOIN public.order_items oi ON oi.book_id = b.id
    LEFT JOIN public.orders o ON o.id = oi.order_id
    GROUP BY b.id, b.title, b.sales_count;
  `)

  for (const b of booksRes.rows) {
    if (b.current_counter !== b.verified_sales) {
      report.salesCounterAdjustments.push({
        bookId: b.id,
        title: b.title,
        previousCounter: b.current_counter,
        correctedSales: b.verified_sales,
      })

      if (!dryRun) {
        await pool.query(
          `UPDATE public.books SET sales_count = $1, updated_at = NOW() WHERE id = $2;`,
          [b.verified_sales, b.id]
        )
      }
    }
  }

  console.log(`[Summary]: Checked ${report.capturedPaymentsChecked} captured payments.`)
  console.log(`- Orders needing status reconciliation: ${report.ordersReconciled.length}`)
  console.log(`- Missing entitlements to grant: ${report.entitlementsCreated.length}`)
  console.log(`- Books needing sales counter reconciliation: ${report.salesCounterAdjustments.length}`)
  console.log(`- Anomalies found: ${report.anomalies.length}`)

  console.log('\nDetailed Report:', JSON.stringify(report, null, 2))

  await pool.end()
  return report
}

const isLive = process.argv.includes('--execute')
reconcile(!isLive).catch((err) => {
  console.error('[Reconciliation Error]:', err)
  process.exit(1)
})
