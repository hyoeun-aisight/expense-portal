const form = document.getElementById('purchaseForm');
const amount = document.getElementById('purchaseAmount');
const preview = document.getElementById('approvalPreview');
let authContext = null;

function renderRoute() {
  const v = Number(amount.value || 0);
  const route = v > 500000 ? ['Office Admin', 'Team Leader'] : ['Office Admin'];
  preview.innerHTML = `<strong>Approval route</strong><div class="route">${route.map((x, i) => `<span class="route-step">${i + 1}. ${x}</span>`).join('<span>→</span>')}</div>`;
}

function normalizeUrl(url) {
  if (!url) return null;

  const trimmed = url.trim();

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

async function initPurchasePage() {
  authContext = await requireAuth();
  if (!authContext) return;

  const requesterInput = form.elements.requester;
  const departmentInput = form.elements.department;
  requesterInput.value = authContext.profile?.name || authContext.user.user_metadata?.full_name || authContext.user.email;
  requesterInput.readOnly = true;

  if (authContext.profile?.department) {
    departmentInput.value = authContext.profile.department;
  }

  renderRoute();
}

amount.addEventListener('input', renderRoute);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!authContext) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form).entries());

  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';

  const { error } = await window.supabaseClient
    .from('purchase_requests')
    .insert({
      requester_id: authContext.profile.id,
      department: data.department || null,
      item_name: data.itemName,
      category: data.category,
      quantity: Number(data.quantity),
      amount: Number(data.amount),
      vendor: data.vendor || null,
      purchase_link: normalizeUrl(data.purchaseLink),      
      business_purpose: data.purpose,
      status: 'pending_approval',
      current_step: 1,
      currency: data.currency,
    });

  if (error) {
    console.error(error);
    alert(`Could not submit purchase request: ${error.message}`);
    submitButton.disabled = false;
    submitButton.textContent = 'Submit purchase request';
    return;
  }

  alert('Purchase request submitted.');
  window.location.href = 'my-requests.html';
});

initPurchasePage();
