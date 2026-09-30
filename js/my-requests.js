const tbody = document.getElementById('requestRows');
const typeFilter = document.getElementById('typeFilter');
const statusFilter = document.getElementById('statusFilter');
let rows = [];

function prettyStatus(value) {
  return (value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function statusBadge(value) {
  const cls = ['approved', 'completed', 'paid'].includes(value) ? 'approved' : value === 'rejected' ? 'rejected' : 'pending';
  return `<span class="badge ${cls}">${prettyStatus(value)}</span>`;
}

function renderRows() {
  let filtered = [...rows];
  if (typeFilter.value !== 'all') filtered = filtered.filter(r => r.type === typeFilter.value);
  if (statusFilter.value !== 'all') filtered = filtered.filter(r => r.status === statusFilter.value);

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>${r.type}</td>
      <td>${r.title}</td>
      <td>${money(r.amount)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${r.route}</td>
      <td>${new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="muted">No matching requests.</td></tr>';
}

async function initMyRequests() {
  const auth = await requireAuth();
  if (!auth?.profile?.id) return;

  const [purchaseResult, reimbursementResult] = await Promise.all([
    window.supabaseClient.from('purchase_requests').select('id,item_name,amount,status,created_at').eq('requester_id', auth.profile.id),
    window.supabaseClient.from('reimbursements').select('id,category,amount,status,created_at').eq('requester_id', auth.profile.id)
  ]);

  if (purchaseResult.error) console.error(purchaseResult.error);
  if (reimbursementResult.error) console.error(reimbursementResult.error);

  const purchases = (purchaseResult.data || []).map(r => ({
    type: 'Purchase', title: r.item_name, amount: r.amount, status: r.status, created_at: r.created_at, route: Number(r.amount) > 500000 ? 'Office Admin → Team Leader' : 'Office Admin'
  }));

  const reimbursements = (reimbursementResult.data || []).map(r => ({
    type: 'Reimbursement', title: `${r.category} reimbursement`, amount: r.amount, status: r.status, created_at: r.created_at, route: 'Accountant Review'
  }));

  rows = [...purchases, ...reimbursements].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  renderRows();
}

typeFilter.addEventListener('change', renderRows);
statusFilter.addEventListener('change', renderRows);
initMyRequests();
