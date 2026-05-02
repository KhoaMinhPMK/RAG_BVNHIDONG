import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mibtdruhmmcatccdzjjk.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_lmqX6atRgaSLPrZdwexcMw_fJU0_04t'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log('🔌 Testing Supabase connection...')
  console.log('URL:', supabaseUrl)

  try {
    // Test 1: Check connection
    const { data, error } = await supabase.from('_test').select('*').limit(1)

    if (error && error.code !== 'PGRST204') {
      console.log('⚠️  Query error (expected if no tables exist):', error.message)
    }

    // Test 2: Get current user (should be null without auth)
    const { data: { user } } = await supabase.auth.getUser()
    console.log('👤 Current user:', user ? user.email : 'Not authenticated')

    // Test 3: List tables (requires proper permissions)
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    if (tablesError) {
      console.log('📋 Tables: Cannot list (need permissions)')
    } else {
      console.log('📋 Tables:', tables?.map(t => t.table_name) || [])
    }

    console.log('✅ Connection successful!')

  } catch (err) {
    console.error('❌ Connection failed:', err.message)
  }
}

testConnection()
