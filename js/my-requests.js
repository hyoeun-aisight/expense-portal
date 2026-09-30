const tbody = document.getElementById('requestRows');
const purchaseTab = document.getElementById('purchaseTab');
const reimbursementTab = document.getElementById('reimbursementTab');
const statusFilter = document.getElementById('statusFilter');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');
const clearFilters = document.getElementById('clearFilters');

let currentType = 'Purchase';
let rows = [];

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
  return STATUS_LABELS[value] || (value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
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
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(amount)} ${escapeHtml(currency)}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ko-KR');
}

function withinDateRange(row) {
  const created = new Date(row.created_at);
  if (dateFrom.value) {
    const from = new Date(`${dateFrom.value}T00:00:00`);
    if (created < from) return false;
  }
  if (dateTo.value) {
    const to = new Date(`${dateTo.value}T23:59:59.999`);
    if (created > to) return false;
  }
  return true;
}

function setTabs() {
  purchaseTab.classList.toggle('active', currentType === 'Purchase');
  reimbursementTab.classList.toggle('active', currentType === 'Reimbursement');
}

function rebuildStatusOptions() {
  const statuses = [...new Set(rows.filter(r => r.type === currentType).map(r => r.status))];
  const previous = statusFilter.value;
  statusFilter.innerHTML = '<option value="all">All statuses</option>' + statuses
    .sort((a, b) => prettyStatus(a).localeCompare(prettyStatus(b)))
    .map(status => `<option value="${escapeHtml(status)}">${escapeHtml(prettyStatus(status))}</option>`)
    .join('');
  if (statuses.includes(previous)) statusFilter.value = previous;
}

function detailHtml(r) {
  if (r.type === 'Purchase') {
    const note = r.review_comment
      ? `<div class="v6-callout ${r.status === 'rejected' ? 'danger' : ''}"><strong>Review note</strong><p>${escapeHtml(r.review_comment)}</p></div>`
      : '';
    return `
      <div class="v6-detail-grid">
        <div><span>Department</span><strong>${escapeHtml(r.department || '-')}</strong></div>
        <div><span>Category</span><strong>${escapeHtml(r.category || '-')}</strong></div>
        <div><span>Quantity</span><strong>${escapeHtml(r.quantity ?? 1)}</strong></div>
        <div><span>Vendor</span><strong>${escapeHtml(r.vendor || '-')}</strong></div>
      </div>
      ${r.business_purpose ? `<div class="v6-detail-block"><span>Business purpose</span><p>${escapeHtml(r.business_purpose)}</p></div>` : ''}
      ${r.purchase_link ? `<div class="v6-detail-block"><a class="text-link" href="${escapeHtml(r.purchase_link)}" target="_blank" rel="noopener">Open purchase link</a></div>` : ''}
      ${note}`;
  }

  const vehicle = [r.departure, r.destination, r.distance, r.parking_toll].some(v => v !== null && v !== '' && v !== undefined)
    ? `<div class="v6-detail-grid">
        <div><span>Departure</span><strong>${escapeHtml(r.departure || '-')}</strong></div>
        <div><span>Destination</span><strong>${escapeHtml(r.destination || '-')}</strong></div>
        <div><span>Distance</span><strong>${r.distance ?? '-'} km</strong></div>
        <div><span>Parking / toll</span><strong>${r.parking_toll ? formatAmount(r.parking_toll, 'KRW') : '-'}</strong></div>
      </div>` : '';
  const note = r.accountant_comment
    ? `<div class="v6-callout ${r.status === 'rejected' ? 'danger' : r.status === 'need_more_info' ? 'warning' : ''}"><strong>${r.status === 'need_more_info' ? 'Additional information requested' : 'Accountant comment'}</strong><p>${escapeHtml(r.accountant_comment)}</p></div>`
    : '';
  const attachment = r.attachment_url
    ? `<a class="text-link" href="${r.attachment_url}" target="_blank" rel="noopener">View ${escapeHtml(r.attachment_name || 'attachment')}</a>`
    : '<span class="muted">No attachment</span>';

  return `
    <div class="v6-detail-grid">
      <div><span>Expense date</span><strong>${escapeHtml(r.expense_date || '-')}</strong></div>
      <div><span>Category</span><strong>${escapeHtml(r.category || '-')}</strong></div>
      <div><span>Department</span><strong>${escapeHtml(r.department || '-')}</strong></div>
      <div><span>Attachment</span><strong>${attachment}</strong></div>
    </div>
    ${r.business_purpose ? `<div class="v6-detail-block"><span>Business purpose</span><p>${escapeHtml(r.business_purpose)}</p></div>` : ''}
    ${vehicle}
    ${note}`;
}

function renderRows() {
  const filtered = rows
    .filter(r => r.type === currentType)
    .filter(r => statusFilter.value === 'all' || r.status === statusFilter.value)
    .filter(withinDateRange)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  tbody.innerHTML = filtered.map(r => `
    <tr class="v6-main-row">
      <td><strong>${escapeHtml(r.title)}</strong><div class="muted">${escapeHtml(r.subtitle || '')}</div></td>
      <td>${formatAmount(r.amount, r.currency)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${escapeHtml(r.route)}</td>
      <td>${formatDate(r.created_at)}</td>
      <td><button class="btn small" type="button" onclick="toggleRequestDetail('${r.key}')">Details</button></td>
    </tr>
    <tr id="detail-${r.key}" class="v6-detail-row" hidden>
      <td colspan="6"><div class="v6-detail-card">${detailHtml(r)}</div></td>
    </tr>`).join('') || '<tr><td colspan="6" class="muted">No matching requests.</td></tr>';
}

function toggleRequestDetail(key) {
  const row = document.getElementById(`detail-${key}`);
  if (row) row.hidden = !row.hidden;
}

async function signedAttachmentUrl(path) {
  if (!path) return null;
  const { data, error } = await window.supabaseClient.storage.from('reimbursement-files').createSignedUrl(path, 300);
  if (error) return null;
  return data?.signedUrl || null;
}

async function initMyRequests() {
  const auth = await requireAuth();
  if (!auth?.profile?.id) return;

  const [purchaseResult, reimbursementResult] = await Promise.all([
    window.supabaseClient
      .from('purchase_requests')
      .select('id,item_name,department,category,quantity,amount,vendor,purchase_link,business_purpose,status,review_comment,created_at')
      .eq('requester_id', auth.profile.id),
    window.supabaseClient
      .from('reimbursements')
      .select('id,department,expense_date,category,amount,currency,business_purpose,departure,destination,distance,parking_toll,attachment_path,attachment_name,status,accountant_comment,created_at')
      .eq('requester_id', auth.profile.id)
  ]);

  if (purchaseResult.error) console.error(purchaseResult.error);
  if (reimbursementResult.error) console.error(reimbursementResult.error);

  const purchases = (purchaseResult.data || []).map(r => ({
    ...r,
    key: `p-${r.id}`,
    type: 'Purchase',
    title: r.item_name,
    subtitle: r.category || 'Purchase request',
    currency: 'KRW',
    route: Number(r.amount) > 500000 ? 'Office Admin → Team Leader' : 'Office Admin'
  }));

  const reimbursements = [];
  for (const r of (reimbursementResult.data || [])) {
    reimbursements.push({
      ...r,
      key: `r-${r.id}`,
      type: 'Reimbursement',
      title: `${r.category} reimbursement`,
      subtitle: r.expense_date || '',
      currency: r.currency || 'KRW',
      route: 'Accountant Review',
      attachment_url: await signedAttachmentUrl(r.attachment_path)
    });
  }

  rows = [...purchases, ...reimbursements];
  rebuildStatusOptions();
  renderRows();
}

purchaseTab.addEventListener('click', () => {
  currentType = 'Purchase';
  statusFilter.value = 'all';
  setTabs();
  rebuildStatusOptions();
  renderRows();
});

reimbursementTab.addEventListener('click', () => {
  currentType = 'Reimbursement';
  statusFilter.value = 'all';
  setTabs();
  rebuildStatusOptions();
  renderRows();
});

statusFilter.addEventListener('change', renderRows);
dateFrom.addEventListener('change', renderRows);
dateTo.addEventListener('change', renderRows);
clearFilters.addEventListener('click', () => {
  statusFilter.value = 'all';
  dateFrom.value = '';
  dateTo.value = '';
  renderRows();
});

window.toggleRequestDetail = toggleRequestDetail;
setTabs();
initMyRequests();
