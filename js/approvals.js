const cards = document.getElementById('approvalCards');
const purchaseTab = document.getElementById('purchaseTab');
const reimbursementTab = document.getElementById('reimbursementTab');
let authContext = null;
let approvalRows = [];
let reimbursementRows = [];
let currentView = 'purchase';

function formatMoney(value) {
  return new Intl.NumberFormat('ko-KR').format(Number(value || 0)) + '원';
}

function prettyStatus(value) {
  return (value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setActiveTab() {
  purchaseTab.classList.toggle('primary', currentView === 'purchase');
  reimbursementTab.classList.toggle('primary', currentView === 'reimbursement');
}

async function loadPurchaseApprovals() {
  cards.innerHTML = '<p class="muted">Loading purchase approvals...</p>';
  const roleFilter = authContext.role === 'admin' ? 'admin' : 'approver';

  const { data: approvals, error: approvalsError } = await window.supabaseClient
    .from('approvals')
    .select('id,request_id,step_number,approver_role,status,comment,approved_at,created_at')
    .eq('approver_role', roleFilter)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (approvalsError) {
    cards.innerHTML = `<p class="muted">Could not load approvals: ${escapeHtml(approvalsError.message)}</p>`;
    return;
  }

  if (!approvals?.length) {
    approvalRows = [];
    cards.innerHTML = '<p class="muted">No purchase requests waiting for your approval.</p>';
    return;
  }

  const requestIds = approvals.map(row => row.request_id);
  const { data: requests, error: requestsError } = await window.supabaseClient
    .from('purchase_requests')
    .select('id,requester_id,department,item_name,category,quantity,amount,vendor,purchase_link,business_purpose,status,current_step,created_at')
    .in('id', requestIds);

  if (requestsError) {
    cards.innerHTML = `<p class="muted">Could not load purchase requests: ${escapeHtml(requestsError.message)}</p>`;
    return;
  }

  const requestsById = new Map((requests || []).map(r => [r.id, r]));
  approvalRows = approvals
    .map(a => ({ ...a, request: requestsById.get(a.request_id) }))
    .filter(row => row.request && row.request.status === 'pending_approval' && row.request.current_step === row.step_number);

  if (!approvalRows.length) {
    cards.innerHTML = '<p class="muted">No purchase requests waiting for your approval.</p>';
    return;
  }

  cards.innerHTML = approvalRows.map(row => {
    const r = row.request;
    return `
      <article class="approval-card">
        <div class="card-top"><div><h3>${escapeHtml(r.item_name)}</h3><div class="muted">${escapeHtml(r.department || '-')} · Step ${row.step_number}</div></div><strong>${formatMoney(r.amount)}</strong></div>
        <p>${escapeHtml(r.business_purpose || '')}</p>
        <div class="muted">Category: ${escapeHtml(r.category || '-')} · Quantity: ${r.quantity || 1}</div>
        <div class="approval-actions"><button class="btn primary" onclick="actApproval('${row.id}','approved')">Approve</button><button class="btn danger" onclick="actApproval('${row.id}','rejected')">Reject</button></div>
      </article>`;
  }).join('');
}

async function actApproval(approvalId, decision) {
  const row = approvalRows.find(x => x.id === approvalId);
  if (!row) return;

  const now = new Date().toISOString();
  const { error: approvalError } = await window.supabaseClient.from('approvals').update({ status: decision, approved_at: now }).eq('id', approvalId);
  if (approvalError) return alert(`Could not update approval: ${approvalError.message}`);

  if (decision === 'rejected') {
    const { error } = await window.supabaseClient.from('purchase_requests').update({ status: 'rejected', updated_at: now }).eq('id', row.request_id);
    if (error) alert(`Could not update request: ${error.message}`);
    return loadPurchaseApprovals();
  }

  const { data: nextRows, error: nextError } = await window.supabaseClient.from('approvals').select('id,step_number').eq('request_id', row.request_id).gt('step_number', row.step_number).order('step_number', { ascending: true }).limit(1);
  if (nextError) return alert(`Could not find next approval step: ${nextError.message}`);

  if (nextRows?.length) {
    const next = nextRows[0];
    const { error: nextApprovalError } = await window.supabaseClient.from('approvals').update({ status: 'pending' }).eq('id', next.id);
    const { error: requestError } = await window.supabaseClient.from('purchase_requests').update({ current_step: next.step_number, updated_at: now }).eq('id', row.request_id);
    if (nextApprovalError || requestError) alert(`Could not advance approval flow: ${(nextApprovalError || requestError).message}`);
  } else {
    const { error } = await window.supabaseClient.from('purchase_requests').update({ status: 'approved', updated_at: now }).eq('id', row.request_id);
    if (error) alert(`Could not finish approval: ${error.message}`);
  }

  await loadPurchaseApprovals();
}

async function signedAttachmentUrl(path) {
  if (!path) return null;
  const { data, error } = await window.supabaseClient.storage.from('reimbursement-files').createSignedUrl(path, 300);
  if (error) return null;
  return data?.signedUrl || null;
}

async function loadReimbursements() {
  cards.innerHTML = '<p class="muted">Loading reimbursements...</p>';

  const { data, error } = await window.supabaseClient
    .from('reimbursements')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    cards.innerHTML = `<p class="muted">Could not load reimbursements: ${escapeHtml(error.message)}</p>`;
    return;
  }

  reimbursementRows = data || [];
  if (!reimbursementRows.length) {
    cards.innerHTML = '<p class="muted">No reimbursement requests.</p>';
    return;
  }

  const blocks = [];
  for (const r of reimbursementRows) {
    const attachmentUrl = await signedAttachmentUrl(r.attachment_path);
    const attachment = attachmentUrl ? `<a class="text-link" href="${attachmentUrl}" target="_blank" rel="noopener">View ${escapeHtml(r.attachment_name || 'attachment')}</a>` : '<span class="muted">No attachment</span>';
    const comment = r.accountant_comment ? `<p class="note"><strong>Comment:</strong> ${escapeHtml(r.accountant_comment)}</p>` : '';
    const vehicle = [r.departure, r.destination, r.distance, r.parking_toll].some(v => v !== null && v !== '')
      ? `<div class="muted">Vehicle: ${escapeHtml(r.departure || '-')} → ${escapeHtml(r.destination || '-')} · ${r.distance ?? '-'} km · Parking/Toll ${formatMoney(r.parking_toll || 0)}</div>` : '';

    let actions = '';
    if (['admin', 'accountant'].includes(authContext.role)) {
      if (['submitted', 'need_more_info'].includes(r.status)) actions += `<button class="btn" onclick="reviewReimbursement('${r.id}','under_review')">Start review</button>`;
      if (!['rejected', 'completed'].includes(r.status)) actions += `<button class="btn" onclick="reviewReimbursement('${r.id}','need_more_info')">Need more info</button>`;
      if (!['approved', 'paid', 'completed', 'rejected'].includes(r.status)) actions += `<button class="btn primary" onclick="reviewReimbursement('${r.id}','approved')">Approve</button>`;
      if (!['rejected', 'completed'].includes(r.status)) actions += `<button class="btn danger" onclick="reviewReimbursement('${r.id}','rejected')">Reject</button>`;
      if (r.status === 'approved') actions += `<button class="btn primary" onclick="reviewReimbursement('${r.id}','paid')">Mark paid</button>`;
      if (r.status === 'paid') actions += `<button class="btn primary" onclick="reviewReimbursement('${r.id}','completed')">Complete</button>`;
    }

    blocks.push(`
      <article class="approval-card">
        <div class="card-top"><div><h3>${escapeHtml(r.category)} reimbursement</h3><div class="muted">${escapeHtml(r.requester_name || 'Employee')} · ${escapeHtml(r.department || '-')} · ${escapeHtml(r.expense_date)}</div></div><strong>${formatMoney(r.amount)}</strong></div>
        <p>${escapeHtml(r.business_purpose)}</p>
        <div class="muted">Status: ${escapeHtml(prettyStatus(r.status))}</div>
        ${vehicle}
        <div style="margin-top:10px">${attachment}</div>
        ${comment}
        <div class="approval-actions">${actions}</div>
      </article>`);
  }
  cards.innerHTML = blocks.join('');
}

async function reviewReimbursement(id, status) {
  const row = reimbursementRows.find(r => r.id === id);
  if (!row) return;

  let comment = row.accountant_comment || null;
  if (['need_more_info', 'rejected'].includes(status)) {
    const entered = window.prompt(status === 'need_more_info' ? 'What additional information is needed?' : 'Reason for rejection:', comment || '');
    if (entered === null) return;
    comment = entered.trim() || null;
  }

  const now = new Date().toISOString();
  const { error } = await window.supabaseClient
    .from('reimbursements')
    .update({ status, accountant_comment: comment, reviewed_at: now, updated_at: now })
    .eq('id', id);

  if (error) return alert(`Could not update reimbursement: ${error.message}`);
  await loadReimbursements();
}

async function switchView(view) {
  currentView = view;
  setActiveTab();
  if (view === 'purchase') return loadPurchaseApprovals();
  return loadReimbursements();
}

async function initApprovalsPage() {
  authContext = await requireAuth(['admin', 'approver', 'accountant']);
  if (!authContext) return;

  purchaseTab.hidden = !['admin', 'approver'].includes(authContext.role);
  reimbursementTab.hidden = !['admin', 'accountant'].includes(authContext.role);

  if (authContext.role === 'accountant') currentView = 'reimbursement';
  else currentView = 'purchase';

  purchaseTab.addEventListener('click', () => switchView('purchase'));
  reimbursementTab.addEventListener('click', () => switchView('reimbursement'));
  await switchView(currentView);
}

window.actApproval = actApproval;
window.reviewReimbursement = reviewReimbursement;
initApprovalsPage();
