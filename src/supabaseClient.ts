
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

export const isSupabaseConfigured = Boolean(PROJECT_URL && SUPABASE_KEY);

const missingEnvError = () =>
  new Error(
    'Supabase env missing. Set SUPABASE_URL and SUPABASE_ANON_KEY (Vercel Project Settings → Environment Variables).',
  );

if (!isSupabaseConfigured) {
  console.warn(missingEnvError().message);
}

// Important: createClient throws when url/key are empty.
// In production deploys (e.g. Vercel) this can result in a blank app with no login prompt.
// Provide a safe stub so the UI can render a helpful "missing config" message instead.
const supabaseStub = {
  auth: {
    async getUser() {
      return { data: { user: null }, error: missingEnvError() };
    },
    async getSession() {
      return { data: { session: null }, error: missingEnvError() };
    },
    async signInWithPassword() {
      return { data: null, error: missingEnvError() };
    },
    async signInWithOtp() {
      return { data: null, error: missingEnvError() };
    },
    async signUp() {
      return { data: null, error: missingEnvError() };
    },
    async signOut() {
      return { error: missingEnvError() };
    },
  },
  from() {
    throw missingEnvError();
  },
} as any;

export const supabase = (() => {
  try {
    if (!isSupabaseConfigured) return supabaseStub;
    return createClient(PROJECT_URL, SUPABASE_KEY);
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return supabaseStub;
  }
})();
