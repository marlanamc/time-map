
import { SupabaseService } from '../services/SupabaseService';

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
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(5px);
    `;
    document.body.appendChild(this.container);
  }

  render() {
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
      <div style="background: var(--bg-card, #1e1e1e); padding: 2rem; border-radius: 1rem; max-width: 400px; width: 90%; text-align: center; border: 1px solid var(--border-color, #333);">
        <h2 style="color: var(--text-primary, #fff); margin-bottom: 1rem;">Welcome Back</h2>
        <p style="color: var(--text-secondary, #aaa); margin-bottom: 2rem;">Sign in to save your progress across devices.</p>
        
        <form id="auth-form" style="display: flex; flex-direction: column; gap: 1rem;">
          <input type="email" id="auth-email" placeholder="Enter your email" required 
            style="padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border-color, #444); background: var(--bg-input, #2a2a2a); color: white; font-size: 1rem;">
          
          <input type="password" id="auth-password" placeholder="Enter your password" required 
            style="padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border-color, #444); background: var(--bg-input, #2a2a2a); color: white; font-size: 1rem;">

          <button type="submit" 
            style="padding: 0.75rem; border-radius: 0.5rem; background: var(--accent-color, #2a9d8f); color: white; border: none; font-size: 1rem; cursor: pointer; font-weight: 600;">
            Log In
          </button>
        </form>

        <button id="toggle-auth-mode" style="background: none; border: none; color: var(--text-secondary, #aaa); text-decoration: underline; margin-top: 1rem; cursor: pointer; font-size: 0.9rem;">
          Need an account? Sign Up
        </button>
        
        <div id="auth-status" style="margin-top: 1rem; color: var(--accent-color, #2a9d8f);"></div>
      </div>
    `;

    const form = this.container.querySelector('#auth-form') as HTMLFormElement;
    const toggleBtn = this.container.querySelector('#toggle-auth-mode') as HTMLButtonElement;

    toggleBtn.addEventListener('click', () => {
      isSignUp = !isSignUp;
      updateUI();
    });

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
    this.container.style.display = 'none';
  }

  show() {
    this.container.style.display = 'flex';
  }
}
