// Authentication Service
import { getSupabaseClient } from './client';

export class AuthService {
  async getUser() {
    try {
      const supabase = await getSupabaseClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      // If there's an error or no user, also check session to ensure it's valid
      if (error || !user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          return null;
        }
      }
      return user;
    } catch (err) {
      console.error('[AuthService] Error getting user:', err);
      return null;
    }
  }

  async signIn(email: string, password?: string) {
    const supabase = await getSupabaseClient();
    if (password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { data, error };
    } else {
      // Magic link login
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      return { data, error };
    }
  }

  async signUp(email: string, password?: string) {
    const supabase = await getSupabaseClient();
    if (password) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      return { data, error };
    } else {
      // Magic link can also be used for signup
      return this.signIn(email);
    }
  }

  async signOut() {
    const supabase = await getSupabaseClient();
    return await supabase.auth.signOut();
  }
}

export const authService = new AuthService();
