const SITE_BASE = 'https://hyoeun-aisight.github.io/expense-portal/';

async function signInWithGoogle() {
  const button = document.getElementById('googleLoginBtn');
  const errorBox = document.getElementById('loginError');

  if (button) {
    button.disabled = true;
    button.textContent = 'Connecting...';
  }
  if (errorBox) errorBox.textContent = '';

  const { error } = await window.supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${SITE_BASE}index.html`
    }
  });

  if (error) {
    if (errorBox) errorBox.textContent = error.message;
    if (button) {
      button.disabled = false;
      button.textContent = 'Continue with Google';
    }
  }
}

async function signOut() {
  await window.supabaseClient.auth.signOut();
  window.location.href = `${SITE_BASE}login.html`;
}

async function getCurrentUser() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  return user || null;
}

async function requireAuth() {
  const { data: { session } } = await window.supabaseClient.auth.getSession();

  if (!session) {
    window.location.replace(`${SITE_BASE}login.html`);
    return null;
  }

  const user = session.user;
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email;

  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = name;
  });
  document.querySelectorAll('[data-user-email]').forEach((el) => {
    el.textContent = user.email || '';
  });

  return user;
}

async function redirectIfLoggedIn() {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (session) {
    window.location.replace(`${SITE_BASE}index.html`);
  }
}

window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.getCurrentUser = getCurrentUser;
window.requireAuth = requireAuth;
window.redirectIfLoggedIn = redirectIfLoggedIn;
