import { config } from 'dotenv'
import { createSupabaseClient } from '../packages/shared/src/index'

config({ path: '.env.local' })

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createSupabaseClient(url, key)

async function main() {
  console.log('Testing Supabase connection...')
  console.log('Project URL:', url)

  const { error } = await supabase.auth.getSession()

  if (error) {
    console.error('Connection failed:', error.message)
    process.exit(1)
  }

  console.log('Supabase connection successful.')
}

main()
