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
      redirectTo: `${SITE_BASE}index.html`,
      queryParams: {
        prompt: 'select_account'
      }
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

async function ensureUserProfile(user) {
  let profile = await getUserProfile(user);
  if (profile || !user?.email) return profile;

  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
  const { data, error } = await window.supabaseClient
    .from('users')
    .insert({
      email: user.email,
      name: displayName,
      role: 'employee',
      active: true
    })
    .select('id,email,name,role,department,active')
    .single();

  if (error) {
    console.error('Could not create user profile:', error);
    return await getUserProfile(user);
  }

  return data;
}

function applyRoleNavigation(role) {
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
  const profile = await ensureUserProfile(user);
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
window.ensureUserProfile = ensureUserProfile;
window.requireAuth = requireAuth;
window.redirectIfLoggedIn = redirectIfLoggedIn;
