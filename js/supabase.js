const SUPABASE_URL = 'https://wckdibyhqbtlsqfzzfqz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YKCq_B2bKO8BbzPA6u_tJA_tszr1b8c';

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
