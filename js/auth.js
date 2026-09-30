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

async function getUserProfile(user) {
  if (!user?.email) return null;

  const { data, error } = await window.supabaseClient
    .from('users')
    .select('id,email,name,role,department,active')
    .ilike('email', user.email)
    .maybeSingle();

  if (error) {
    console.error('Could not load user profile:', error);
    return null;
  }

  return data || null;
}

function applyRoleNavigation(role) {
  // Restricted links stay hidden unless the signed-in user's role allows them.
  document.querySelectorAll('[data-role-link="approvals"]').forEach((el) => {
    el.hidden = !['admin', 'approver'].includes(role);
  });

  document.querySelectorAll('[data-role-link="admin"]').forEach((el) => {
    el.hidden = role !== 'admin';
  });
}

async function requireAuth(allowedRoles = null) {
  const { data: { session } } = await window.supabaseClient.auth.getSession();

  if (!session) {
    window.location.replace(`${SITE_BASE}login.html`);
    return null;
  }

  const user = session.user;
  const profile = await getUserProfile(user);

  // Users not yet registered in public.users are treated as employees for UI purposes.
  // RLS remains the actual security boundary for protected Supabase data.
  const role = profile?.role || 'employee';
  const active = profile?.active !== false;

  if (!active) {
    await window.supabaseClient.auth.signOut();
    window.location.replace(`${SITE_BASE}login.html?inactive=1`);
    return null;
  }

  applyRoleNavigation(role);

  const name = profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email;

  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = name;
  });
  document.querySelectorAll('[data-user-email]').forEach((el) => {
    el.textContent = user.email || '';
  });
  document.querySelectorAll('[data-user-role]').forEach((el) => {
    el.textContent = role;
  });

  if (Array.isArray(allowedRoles) && !allowedRoles.includes(role)) {
    window.location.replace(`${SITE_BASE}index.html?access=denied`);
    return null;
  }

  return { user, profile, role };
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
window.getUserProfile = getUserProfile;
window.requireAuth = requireAuth;
window.redirectIfLoggedIn = redirectIfLoggedIn;
