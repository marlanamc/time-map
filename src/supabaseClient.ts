
import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    __GARDEN_FENCE_ENV?: {
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
    };
  }
}

const PROJECT_URL = window.__GARDEN_FENCE_ENV?.SUPABASE_URL || '';
const SUPABASE_KEY = window.__GARDEN_FENCE_ENV?.SUPABASE_ANON_KEY || '';

if (!PROJECT_URL || !SUPABASE_KEY) {
  console.warn(
    'Supabase env missing. Set SUPABASE_URL and SUPABASE_ANON_KEY in `.env.local` (local) or Vercel env vars.'
  );
}

export const supabase = createClient(PROJECT_URL, SUPABASE_KEY);
