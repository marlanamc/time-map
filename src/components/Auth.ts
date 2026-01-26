
import { SupabaseService } from '../services/supabase';

const AUTH_MODAL_DONT_SHOW_KEY = 'gardenFence.authModal.dontShow';

export class AuthComponent {
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'auth-modal';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.85);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: var(--space-4, 16px);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    `;
    document.body.appendChild(this.container);
  }

  render() {
    // Use Vite's import.meta.env instead of window.__GARDEN_FENCE_ENV
    // @ts-expect-error Vite injects import.meta.env at build time; suppressed for test builds
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    // @ts-expect-error Vite injects import.meta.env at build time; suppressed for test builds
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const isConfigured = Boolean(supabaseUrl && supabaseKey);

    if (!isConfigured) {
      this.container.innerHTML = `
        <div style="position: relative; background: var(--bg-surface, var(--glass-bg, rgba(255, 255, 255, 0.9))); padding: var(--space-6, 24px); border-radius: var(--radius-xl, 16px); max-width: 520px; width: 100%; text-align: left; border: 1px solid var(--glass-border, rgba(107, 168, 169, 0.22)); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12); margin: auto;">
          <button id="auth-modal-close" type="button" class="auth-modal-close" aria-label="Close">×</button>
          <h2 style="color: var(--text-primary, #1A2B2F); margin-bottom: var(--space-3, 12px); font-size: var(--text-2xl, 1.5rem); font-weight: 700;">Setup needed</h2>
          <p style="color: var(--text-secondary, #455C61); margin-bottom: var(--space-4, 16px); font-size: var(--text-base, 1rem); line-height: 1.5;">
            This deployment is missing Supabase credentials, so the login screen can’t load.
          </p>
          <div style="background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.06); border-radius: var(--radius-lg, 12px); padding: var(--space-4, 16px); margin-bottom: var(--space-4, 16px);">
            <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-primary, #1A2B2F);">Fix on Vercel</div>
            <ol style="margin: 0; padding-left: 18px; color: var(--text-secondary, #455C61); line-height: 1.6;">
              <li>Go to <b>Project Settings → Environment Variables</b></li>
              <li>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code></li>
              <li>Redeploy</li>
            </ol>
          </div>
          <button id="auth-close" type="button"
            style="padding: var(--space-3, 12px) var(--space-4, 16px); border-radius: var(--radius-md, 8px); background: var(--accent, var(--teal, #4A9099)); color: white; border: none; font-size: var(--text-base, 1rem); cursor: pointer; font-weight: 600; min-height: 48px; transition: all 0.2s ease;">
            Continue in offline mode
          </button>
          <div style="margin-top: 10px; color: var(--text-tertiary, #6B7D82); font-size: var(--text-sm, 0.875rem);">
            (You can still use local-only features, but cloud sync/auth will be disabled.)
          </div>
        </div>
      `;

      this.container
        .querySelector("#auth-close")
        ?.addEventListener("click", () => this.hide());

      this.container
        .querySelector("#auth-modal-close")
        ?.addEventListener("click", () => this.hide());

      return;
    }

    let isSignUp = false;

    const updateUI = () => {
      const title = this.container.querySelector('h2');
      const btn = this.container.querySelector('button[type="submit"]');
      const toggleBtn = this.container.querySelector('#toggle-auth-mode');
      //const passwordInput = this.container.querySelector('#auth-password'); // Always shown now

      if (title) title.textContent = isSignUp ? "Create Account" : "Welcome Back";
      if (btn) btn.textContent = isSignUp ? "Sign Up" : "Log In";
      if (toggleBtn) toggleBtn.textContent = isSignUp ? "Already have an account? Log In" : "Need an account? Sign Up";
    };

    this.container.innerHTML = `
      <div style="position: relative; background: var(--bg-surface, var(--glass-bg, rgba(255, 255, 255, 0.9))); padding: var(--space-6, 24px); border-radius: var(--radius-xl, 16px); max-width: 400px; width: 100%; text-align: center; border: 1px solid var(--glass-border, rgba(107, 168, 169, 0.22)); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12); margin: auto;">
        <button id="auth-modal-close" type="button" class="auth-modal-close" aria-label="Close">×</button>
        <h2 style="color: var(--text-primary, #1A2B2F); margin-bottom: var(--space-3, 12px); font-size: var(--text-2xl, 1.5rem); font-weight: 700;">Welcome Back</h2>
        <p style="color: var(--text-secondary, #455C61); margin-bottom: var(--space-5, 20px); font-size: var(--text-base, 1rem);">Sign in to save your progress across devices.</p>
        
        <form id="auth-form" style="display: flex; flex-direction: column; gap: var(--space-4, 16px);">
          <input type="email" id="auth-email" placeholder="Enter your email" required autocomplete="email"
            style="padding: var(--space-3, 12px) var(--space-4, 16px); border-radius: var(--radius-md, 8px); border: 1px solid var(--glass-border, rgba(107, 168, 169, 0.22)); background: var(--bg-surface, rgba(255, 255, 255, 0.9)); color: var(--text-primary, #1A2B2F); font-size: 16px; min-height: 44px; width: 100%; box-sizing: border-box;">
          
          <input type="password" id="auth-password" placeholder="Enter your password" required autocomplete="current-password"
            style="padding: var(--space-3, 12px) var(--space-4, 16px); border-radius: var(--radius-md, 8px); border: 1px solid var(--glass-border, rgba(107, 168, 169, 0.22)); background: var(--bg-surface, rgba(255, 255, 255, 0.9)); color: var(--text-primary, #1A2B2F); font-size: 16px; min-height: 44px; width: 100%; box-sizing: border-box;">

          <button type="submit" 
            style="padding: var(--space-3, 12px) var(--space-4, 16px); border-radius: var(--radius-md, 8px); background: var(--accent, var(--teal, #4A9099)); color: white; border: none; font-size: var(--text-base, 1rem); cursor: pointer; font-weight: 600; min-height: 48px; transition: all 0.2s ease;">
            Log In
          </button>
        </form>

        <button id="toggle-auth-mode" style="background: none; border: none; color: var(--text-secondary, #455C61); text-decoration: underline; margin-top: var(--space-4, 16px); cursor: pointer; font-size: var(--text-sm, 0.875rem); padding: var(--space-2, 8px); min-height: 44px;">
          Need an account? Sign Up
        </button>
        
        <div id="auth-status" style="margin-top: var(--space-4, 16px); color: var(--accent, var(--teal, #4A9099)); font-size: var(--text-sm, 0.875rem); min-height: 20px;"></div>

        <div class="auth-modal-secondary">
          <button id="auth-guest" type="button" class="auth-modal-secondary-btn">
            Continue as guest
          </button>
          <label class="auth-modal-dontshow">
            <input type="checkbox" id="auth-dont-show" />
            Don’t show again
          </label>
        </div>
      </div>
    `;

    const form = this.container.querySelector('#auth-form') as HTMLFormElement;
    const toggleBtn = this.container.querySelector('#toggle-auth-mode') as HTMLButtonElement;
    const closeBtn = this.container.querySelector('#auth-modal-close') as HTMLButtonElement | null;
    const guestBtn = this.container.querySelector('#auth-guest') as HTMLButtonElement | null;
    const dontShowEl = this.container.querySelector('#auth-dont-show') as HTMLInputElement | null;

    const dismiss = () => {
      try {
        if (dontShowEl?.checked) localStorage.setItem(AUTH_MODAL_DONT_SHOW_KEY, '1');
      } catch {
        // ignore storage errors
      }
      this.hide();
    };

    toggleBtn.addEventListener('click', () => {
      isSignUp = !isSignUp;
      updateUI();
    });

    closeBtn?.addEventListener('click', dismiss);
    guestBtn?.addEventListener('click', dismiss);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = this.container.querySelector('#auth-email') as HTMLInputElement;
      const passwordInput = this.container.querySelector('#auth-password') as HTMLInputElement;
      const status = this.container.querySelector('#auth-status') as HTMLElement;
      const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;

      const email = emailInput.value;
      const password = passwordInput.value;

      try {
        btn.disabled = true;
        btn.textContent = 'Processing...';

        let error;
        let data;

        if (isSignUp) {
          const res = await SupabaseService.signUp(email, password);
          error = res.error;
          data = res.data;
        } else {
          const res = await SupabaseService.signIn(email, password);
          error = res.error;
          data = res.data;
        }

        if (error) throw error;

        status.textContent = 'Success! Redirecting...';
        status.style.color = '#10b981'; // Success green

        // If sign up success but no session (email confirmation required)
        if (isSignUp && data?.user && !data?.session) {
          status.textContent = 'Account created! Please check your email to confirm.';
        } else {
          // Login success - reload to init app state
          setTimeout(() => window.location.reload(), 1000);
        }

      } catch (err: any) {
        status.textContent = err.message || 'Error authenticating';
        status.style.color = '#ef4444'; // Error red
        btn.disabled = false;
        updateUI(); // Reset button text
      }
    });
  }

  hide() {
    this.container.setAttribute('hidden', '');
    this.container.style.setProperty('display', 'none', 'important');
  }

  show() {
    this.container.removeAttribute('hidden');
    this.container.style.setProperty('display', 'flex', 'important');
  }
}
