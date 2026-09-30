const cards = document.getElementById('approvalCards');
let authContext = null;
let approvalRows = [];

function formatMoney(value) {
  return new Intl.NumberFormat('ko-KR').format(Number(value || 0)) + '원';
}

function statusLabel(value) {
  return (value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function loadApprovals() {
  cards.innerHTML = '<p class="muted">Loading approvals...</p>';

  const roleFilter = authContext.role === 'admin' ? 'admin' : 'approver';

  const { data: approvals, error: approvalsError } = await window.supabaseClient
    .from('approvals')
    .select('id,request_id,step_number,approver_role,status,comment,approved_at,created_at')
    .eq('approver_role', roleFilter)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (approvalsError) {
    console.error(approvalsError);
    cards.innerHTML = `<p class="muted">Could not load approvals: ${approvalsError.message}</p>`;
    return;
  }

  if (!approvals?.length) {
    approvalRows = [];
    cards.innerHTML = '<p class="muted">No requests waiting for your approval.</p>';
    return;
  }

  const requestIds = approvals.map(row => row.request_id);
  const { data: requests, error: requestsError } = await window.supabaseClient
    .from('purchase_requests')
    .select('id,requester_id,department,item_name,category,quantity,amount,vendor,purchase_link,business_purpose,status,current_step,created_at')
    .in('id', requestIds);

  if (requestsError) {
    console.error(requestsError);
    cards.innerHTML = `<p class="muted">Could not load purchase requests: ${requestsError.message}</p>`;
    return;
  }

  const requesterIds = [...new Set((requests || []).map(r => r.requester_id).filter(Boolean))];
  let profiles = [];
  if (requesterIds.length) {
    const { data } = await window.supabaseClient
      .from('users')
      .select('id,name,email,department')
      .in('id', requesterIds);
    profiles = data || [];
  }

  const requestsById = new Map((requests || []).map(r => [r.id, r]));
  const profilesById = new Map(profiles.map(p => [p.id, p]));

  approvalRows = approvals
    .map(a => ({ ...a, request: requestsById.get(a.request_id) }))
    .filter(row => row.request && row.request.status === 'pending_approval' && row.request.current_step === row.step_number);

  if (!approvalRows.length) {
    cards.innerHTML = '<p class="muted">No requests waiting for your approval.</p>';
    return;
  }

  cards.innerHTML = approvalRows.map(row => {
    const r = row.request;
    const requester = profilesById.get(r.requester_id);
    return `
      <article class="approval-card">
        <div class="card-top">
          <div>
            <h3>${r.item_name}</h3>
            <div class="muted">${requester?.name || requester?.email || 'Employee'} · ${r.department || requester?.department || '-'}</div>
          </div>
          <strong>${formatMoney(r.amount)}</strong>
        </div>
        <p>${r.business_purpose || ''}</p>
        <div class="muted">Category: ${r.category || '-'} · Quantity: ${r.quantity || 1} · Step ${row.step_number}</div>
        <div class="approval-actions">
          <button class="btn primary" onclick="actApproval('${row.id}','approved')">Approve</button>
          <button class="btn danger" onclick="actApproval('${row.id}','rejected')">Reject</button>
        </div>
      </article>`;
  }).join('');
}

async function actApproval(approvalId, decision) {
  const row = approvalRows.find(x => x.id === approvalId);
  if (!row) return;

  const now = new Date().toISOString();
  const { error: approvalError } = await window.supabaseClient
    .from('approvals')
    .update({ status: decision, approved_at: now })
    .eq('id', approvalId);

  if (approvalError) {
    alert(`Could not update approval: ${approvalError.message}`);
    return;
  }

  if (decision === 'rejected') {
    const { error } = await window.supabaseClient
      .from('purchase_requests')
      .update({ status: 'rejected', updated_at: now })
      .eq('id', row.request_id);
    if (error) alert(`Could not update request: ${error.message}`);
    await loadApprovals();
    return;
  }

  const { data: nextRows, error: nextError } = await window.supabaseClient
    .from('approvals')
    .select('id,step_number')
    .eq('request_id', row.request_id)
    .gt('step_number', row.step_number)
    .order('step_number', { ascending: true })
    .limit(1);

  if (nextError) {
    alert(`Could not find next approval step: ${nextError.message}`);
    return;
  }

  if (nextRows?.length) {
    const next = nextRows[0];
    const { error: nextApprovalError } = await window.supabaseClient
      .from('approvals')
      .update({ status: 'pending' })
      .eq('id', next.id);

    const { error: requestError } = await window.supabaseClient
      .from('purchase_requests')
      .update({ current_step: next.step_number, updated_at: now })
      .eq('id', row.request_id);

    if (nextApprovalError || requestError) {
      alert(`Could not advance approval flow: ${(nextApprovalError || requestError).message}`);
    }
  } else {
    const { error } = await window.supabaseClient
      .from('purchase_requests')
      .update({ status: 'approved', updated_at: now })
      .eq('id', row.request_id);
    if (error) alert(`Could not finish approval: ${error.message}`);
  }

  await loadApprovals();
}

async function initApprovalsPage() {
  authContext = await requireAuth(['admin', 'approver']);
  if (!authContext) return;
  await loadApprovals();
}

window.actApproval = actApproval;
initApprovalsPage();
