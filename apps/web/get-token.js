const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getToken() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'clinician@bvnhidong.vn',
    password: 'Test1234!'
  });

  if (error) {
    console.error('Login failed:', error.message);
    process.exit(1);
  }

  console.log('JWT Token:');
  console.log(data.session.access_token);
}

getToken();
