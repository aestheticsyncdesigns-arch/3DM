import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseClient } from '../packages/shared/src/supabase'

config({ path: resolve(process.cwd(), '.env.local') })

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
const supabase = createSupabaseClient(url, key)

const tables = [
  'restaurants', 'menus', 'categories', 'dishes', 'tables',
  'orders', 'order_items', 'staff', 'loyalty_points', 'analytics_events',
]

async function main() {
  let allOk = true
  for (const t of tables) {
    const { error } = await supabase.from(t as never).select('count')
    const status = error ? `FAIL — ${error.message}` : 'OK'
    console.log(`  ${t.padEnd(20)} ${status}`)
    if (error) allOk = false
  }
  console.log()
  console.log(allOk ? 'All 10 tables verified.' : 'Some tables are missing — run 002_schema_v2.sql in Supabase SQL Editor.')
  if (!allOk) process.exit(1)
}

main()
