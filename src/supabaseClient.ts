
import { createClient } from '@supabase/supabase-js';

const PROJECT_URL = 'https://dpsqbagzxqpxgmpahusx.supabase.co';
// TODO: Replace with your actual Anon Key from Supabase Dashboard > Project Settings > API
const SUPABASE_KEY = 'sb_publishable_gvhYuyd6fV5jBghqkpn7cA_FSRGuNg9';

export const supabase = createClient(PROJECT_URL, SUPABASE_KEY);
