import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseClient } from './supabase'

config({ path: resolve(process.cwd(), '.env.local') })

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''

const supabase = createSupabaseClient(url, key)

async function main() {
  const { error } = await supabase.from('restaurants').select('count')

  if (error) {
    console.error('Connection failed:', error.message)
    process.exit(1)
  }

  console.log('Supabase connection successful')
}

main()
