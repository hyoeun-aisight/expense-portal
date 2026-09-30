const adminRowsEl = document.getElementById('adminRows');
const adminStatsEl = document.getElementById('adminStats');
const typeFilter = document.getElementById('adminTypeFilter');
const statusFilter = document.getElementById('adminStatusFilter');
const dateFrom = document.getElementById('adminDateFrom');
const dateTo = document.getElementById('adminDateTo');
const clearFilters = document.getElementById('adminClearFilters');
const exportCsvButton = document.getElementById('exportCsv');

let adminAuth = null;
let allRows = [];

const STATUS_LABELS = {
  pending_approval: 'Pending Approval',
  submitted: 'Submitted',
  under_review: 'Under Review',
  need_more_info: 'Additional Info Required',
  approved: 'Approved',
  rejected: 'Rejected',
  purchasing: 'Purchasing',
  paid: 'Paid',
  completed: 'Completed',
  pending: 'Pending',
  waiting: 'Waiting'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function prettyStatus(value) {
  return STATUS_LABELS[value] || (value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function badgeClass(value) {
  if (['approved', 'paid', 'completed'].includes(value)) return 'approved';
  if (value === 'rejected') return 'rejected';
  if (value === 'need_more_info') return 'attention';
  if (value === 'under_review') return 'review';
  return 'pending';
}

function statusBadge(value) {
  return `<span class="badge ${badgeClass(value)}">${escapeHtml(prettyStatus(value))}</span>`;
}

function formatAmount(value, currency = 'KRW') {
  const amount = Number(value || 0);
  const maximumFractionDigits = currency === 'USD' ? 2 : Number.isInteger(amount) ? 0 : 2;
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(amount)} ${escapeHtml(currency || 'KRW')}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ko-KR');
}

function dateMatches(value) {
  if (!value) return true;
  const date = new Date(value);
  if (dateFrom.value && date < new Date(`${dateFrom.value}T00:00:00`)) return false;
  if (dateTo.value && date > new Date(`${dateTo.value}T23:59:59.999`)) return false;
  return true;
}

function filteredRows() {
  return allRows
    .filter(row => typeFilter.value === 'all' || row.type === typeFilter.value)
    .filter(row => statusFilter.value === 'all' || row.status === statusFilter.value)
    .filter(row => dateMatches(row.created_at))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function rebuildStatusFilter() {
  const previous = statusFilter.value;
  const statuses = [...new Set(allRows.map(row => row.status).filter(Boolean))].sort();
  statusFilter.innerHTML = '<option value="all">All statuses</option>' + statuses
    .map(status => `<option value="${escapeHtml(status)}">${escapeHtml(prettyStatus(status))}</option>`)
    .join('');
  if (statuses.includes(previous)) statusFilter.value = previous;
}

function renderStats() {
  const total = allRows.length;
  const pending = allRows.filter(row => ['pending_approval', 'submitted', 'under_review', 'need_more_info'].includes(row.status)).length;
  const approved = allRows.filter(row => row.status === 'approved').length;
  const completed = allRows.filter(row => ['paid', 'completed'].includes(row.status)).length;

  adminStatsEl.innerHTML = `
    <div class="stat-card"><span>Total</span><strong>${total}</strong></div>
    <div class="stat-card"><span>In progress</span><strong>${pending}</strong></div>
    <div class="stat-card"><span>Approved</span><strong>${approved}</strong></div>
    <div class="stat-card"><span>Paid / Completed</span><strong>${completed}</strong></div>
  `;
}

function renderRows() {
  const rows = filteredRows();

  adminRowsEl.innerHTML = rows.map(row => `
    <tr>
      <td>
        <strong>${escapeHtml(row.requester_name || '-')}</strong>
        ${row.requester_email ? `<div class="muted" style="font-size:12px;margin-top:3px">${escapeHtml(row.requester_email)}</div>` : ''}
      </td>
      <td>${escapeHtml(row.department || '-')}</td>
      <td>${escapeHtml(row.type)}</td>
      <td>${escapeHtml(row.title || '-')}</td>
      <td>${formatAmount(row.amount, row.currency)}</td>
      <td>${statusBadge(row.status)}</td>
      <td>${formatDate(row.created_at)}</td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="muted">No matching requests.</td></tr>';
}

async function loadAdminData() {
  adminAuth = await requireAuth(['admin']);
  if (!adminAuth) return;

  adminRowsEl.innerHTML = '<tr><td colspan="7" class="muted">Loading...</td></tr>';

  const [purchaseResult, reimbursementResult, usersResult] = await Promise.all([
    window.supabaseClient
      .from('purchase_requests')
      .select('id,requester_id,department,item_name,category,amount,status,created_at'),
    window.supabaseClient
      .from('reimbursements')
      .select('id,requester_id,requester_name,department,category,amount,currency,status,created_at'),
    window.supabaseClient
      .from('users')
      .select('id,email,name,department')
  ]);

  if (purchaseResult.error) {
    console.error(purchaseResult.error);
    adminRowsEl.innerHTML = `<tr><td colspan="7" class="muted">Could not load purchase requests: ${escapeHtml(purchaseResult.error.message)}</td></tr>`;
    return;
  }
  if (reimbursementResult.error) {
    console.error(reimbursementResult.error);
    adminRowsEl.innerHTML = `<tr><td colspan="7" class="muted">Could not load reimbursements: ${escapeHtml(reimbursementResult.error.message)}</td></tr>`;
    return;
  }
  if (usersResult.error) {
    console.error(usersResult.error);
    adminRowsEl.innerHTML = `<tr><td colspan="7" class="muted">Could not load user profiles: ${escapeHtml(usersResult.error.message)}</td></tr>`;
    return;
  }

  const userMap = new Map((usersResult.data || []).map(user => [user.id, user]));

  const purchases = (purchaseResult.data || []).map(row => {
    const user = userMap.get(row.requester_id);
    return {
      id: row.id,
      requester_name: user?.name || user?.email || 'Unknown user',
      requester_email: user?.email || '',
      department: row.department || user?.department || null,
      type: 'Purchase',
      title: row.item_name,
      amount: row.amount,
      currency: 'KRW',
      status: row.status,
      created_at: row.created_at
    };
  });

  const reimbursements = (reimbursementResult.data || []).map(row => {
    const user = userMap.get(row.requester_id);
    return {
      id: row.id,
      requester_name: row.requester_name || user?.name || user?.email || 'Unknown user',
      requester_email: user?.email || '',
      department: row.department || user?.department || null,
      type: 'Reimbursement',
      title: `${row.category || 'Expense'} reimbursement`,
      amount: row.amount,
      currency: row.currency || 'KRW',
      status: row.status,
      created_at: row.created_at
    };
  });

  allRows = [...purchases, ...reimbursements];
  rebuildStatusFilter();
  renderStats();
  renderRows();
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportCsv() {
  const rows = filteredRows();
  const header = ['Requester', 'Email', 'Department', 'Type', 'Title', 'Amount', 'Currency', 'Status', 'Created'];
  const body = rows.map(row => [
    row.requester_name,
    row.requester_email,
    row.department,
    row.type,
    row.title,
    row.amount,
    row.currency,
    prettyStatus(row.status),
    row.created_at
  ]);

  const csv = [header, ...body].map(row => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `expense-portal-admin-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

[typeFilter, statusFilter, dateFrom, dateTo].forEach(element => {
  element.addEventListener('change', renderRows);
});

clearFilters.addEventListener('click', () => {
  typeFilter.value = 'all';
  statusFilter.value = 'all';
  dateFrom.value = '';
  dateTo.value = '';
  renderRows();
});

exportCsvButton.addEventListener('click', exportCsv);

loadAdminData();
