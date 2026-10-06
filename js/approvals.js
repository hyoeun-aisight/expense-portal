const cards = document.getElementById('approvalCards');
const purchaseTab = document.getElementById('purchaseTab');
const reimbursementTab = document.getElementById('reimbursementTab');
const statusFilter = document.getElementById('approvalStatusFilter');
const dateFrom = document.getElementById('approvalDateFrom');
const dateTo = document.getElementById('approvalDateTo');
const clearFilters = document.getElementById('approvalClearFilters');

let authContext = null;
let approvalRows = [];
let reimbursementRows = [];
let currentView = 'purchase';


/* --------------------------------------------------
   Status
-------------------------------------------------- */

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
  return (
    STATUS_LABELS[value] ||
    (value || '')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  );
}


function badgeClass(value) {
  if (
    ['approved', 'paid', 'completed']
      .includes(value)
  ) {
    return 'approved';
  }

  if (value === 'rejected') {
    return 'rejected';
  }

  if (value === 'need_more_info') {
    return 'attention';
  }

  if (value === 'under_review') {
    return 'review';
  }

  return 'pending';
}


function statusBadge(value) {
  return `
    <span class="badge ${badgeClass(value)}">
      ${escapeHtml(prettyStatus(value))}
    </span>
  `;
}


/* --------------------------------------------------
   Formatting
-------------------------------------------------- */

function formatAmount(
  value,
  currency = 'KRW'
) {
  const amount = Number(value || 0);

  const maximumFractionDigits =
    currency === 'KRW'
      ? 0
      : 2;

  return `
    ${new Intl.NumberFormat(
      'en-US',
      { maximumFractionDigits }
    ).format(amount)}
    ${escapeHtml(currency)}
  `.trim();
}


function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Date(value)
    .toLocaleDateString('ko-KR');
}


function dateMatches(value) {
  if (!value) {
    return true;
  }

  const d = new Date(value);

  if (
    dateFrom.value &&
    d < new Date(
      `${dateFrom.value}T00:00:00`
    )
  ) {
    return false;
  }

  if (
    dateTo.value &&
    d > new Date(
      `${dateTo.value}T23:59:59.999`
    )
  ) {
    return false;
  }

  return true;
}


function statusPriority(status) {
  const order = {
    pending: 0,
    submitted: 0,
    under_review: 1,
    need_more_info: 2,
    waiting: 3,
    approved: 4,
    paid: 5,
    completed: 6,
    rejected: 7
  };

  return order[status] ?? 50;
}


/* --------------------------------------------------
   Tabs / Filters
-------------------------------------------------- */

function setActiveTab() {
  purchaseTab.classList.toggle(
    'active',
    currentView === 'purchase'
  );

  reimbursementTab.classList.toggle(
    'active',
    currentView === 'reimbursement'
  );

  const exportButton =
    document.getElementById(
      'exportReimbursements'
    );

  if (exportButton) {
    exportButton.hidden =
      currentView !== 'reimbursement';
  }
}


function buildStatusFilter(statuses) {
  const previous =
    statusFilter.value;

  const unique =
    [...new Set(statuses)];

  statusFilter.innerHTML =
    '<option value="all">All statuses</option>' +
    unique
      .sort(
        (a, b) =>
          statusPriority(a) -
          statusPriority(b)
      )
      .map(
        status => `
          <option value="${escapeHtml(status)}">
            ${escapeHtml(
              prettyStatus(status)
            )}
          </option>
        `
      )
      .join('');

  if (
    unique.includes(previous)
  ) {
    statusFilter.value =
      previous;
  }
}


/* ==================================================
   PURCHASE APPROVALS
================================================== */


/* --------------------------------------------------
   Purchase filtering
-------------------------------------------------- */

function purchaseVisibleRows() {
  return approvalRows
    .filter(
      row =>
        statusFilter.value === 'all' ||
        row.status === statusFilter.value
    )
    .filter(
      row =>
        dateMatches(
          row.request?.created_at ||
          row.created_at
        )
    )
    .sort((a, b) => {

      const aActive =
        a.status === 'pending' &&
        a.request?.status ===
          'pending_approval' &&
        a.request?.current_step ===
          a.step_number;

      const bActive =
        b.status === 'pending' &&
        b.request?.status ===
          'pending_approval' &&
        b.request?.current_step ===
          b.step_number;

      if (aActive !== bActive) {
        return aActive ? -1 : 1;
      }

      const priority =
        statusPriority(a.status) -
        statusPriority(b.status);

      if (priority !== 0) {
        return priority;
      }

      return (
        new Date(
          b.request?.created_at ||
          b.created_at
        ) -
        new Date(
          a.request?.created_at ||
          a.created_at
        )
      );
    });
}


/* --------------------------------------------------
   Purchase item table
-------------------------------------------------- */

function renderPurchaseItems(
  items,
  currency
) {
  if (
    !items ||
    !items.length
  ) {
    return `
      <p class="muted">
        No item details available.
      </p>
    `;
  }

  const rows =
    items.map(
      (item, index) => `
        <tr>
          <td>
            ${index + 1}
          </td>

          <td>
            ${escapeHtml(
              item.item_name ||
              '-'
            )}
          </td>

          <td>
            ${escapeHtml(
              item.category ||
              '-'
            )}
          </td>

          <td style="text-align:right;">
            ${formatAmount(
              item.unit_price,
              currency
            )}
          </td>

          <td style="text-align:right;">
            ${escapeHtml(
              item.quantity ?? 1
            )}
          </td>

          <td style="text-align:right;">
            <strong>
              ${formatAmount(
                item.subtotal,
                currency
              )}
            </strong>
          </td>
        </tr>
      `
    ).join('');

  return `
    <div
      style="
        overflow-x:auto;
        margin-top:18px;
        margin-bottom:18px;
      "
    >

      <table
        style="
          width:100%;
          border-collapse:collapse;
          font-size:14px;
        "
      >

        <thead>
          <tr>
            <th
              style="
                text-align:left;
                padding:10px;
                border-bottom:1px solid #e5e7eb;
              "
            >
              #
            </th>

            <th
              style="
                text-align:left;
                padding:10px;
                border-bottom:1px solid #e5e7eb;
              "
            >
              Item
            </th>

            <th
              style="
                text-align:left;
                padding:10px;
                border-bottom:1px solid #e5e7eb;
              "
            >
              Category
            </th>

            <th
              style="
                text-align:right;
                padding:10px;
                border-bottom:1px solid #e5e7eb;
              "
            >
              Unit Price
            </th>

            <th
              style="
                text-align:right;
                padding:10px;
                border-bottom:1px solid #e5e7eb;
              "
            >
              Qty
            </th>

            <th
              style="
                text-align:right;
                padding:10px;
                border-bottom:1px solid #e5e7eb;
              "
            >
              Subtotal
            </th>

          </tr>
        </thead>


        <tbody>
          ${rows}
        </tbody>

      </table>

    </div>
  `;
}


/* --------------------------------------------------
   Render Purchase approvals
-------------------------------------------------- */

function renderPurchaseApprovals() {
  const visible =
    purchaseVisibleRows();

  if (!visible.length) {
    cards.innerHTML =
      `
        <p class="muted">
          No matching purchase requests.
        </p>
      `;

    return;
  }


  cards.innerHTML =
    visible
      .map(row => {

        const r =
          row.request;

        const items =
          r.items || [];

        const currency =
          r.currency ||
          'KRW';

        const totalAmount =
          r.total_amount ??
          r.amount ??
          0;

        const active =
          row.status === 'pending' &&
          r.status ===
            'pending_approval' &&
          r.current_step ===
            row.step_number;

        const note =
          row.comment ||
          r.review_comment;


        let title =
          r.item_name ||
          'Purchase Request';

        if (items.length === 1) {
          title =
            items[0].item_name;
        }

        if (items.length > 1) {
          title =
            `${items[0].item_name} + ${items.length - 1} more`;
        }


        let actions = '';

        if (active) {
          actions = `
            <div class="approval-actions">

              <button
                class="btn primary"
                onclick="
                  actApproval(
                    '${row.id}',
                    'approved'
                  )
                "
              >
                Approve
              </button>

              <button
                class="btn danger"
                onclick="
                  actApproval(
                    '${row.id}',
                    'rejected'
                  )
                "
              >
                Reject
              </button>

            </div>
          `;
        }


        return `
          <article
            class="
              approval-card
              v6-approval-card
              ${
                active
                  ? 'is-pending'
                  : ''
              }
            "
          >

            <div class="card-top">

              <div>

                <div class="v6-card-meta">

                  ${statusBadge(
                    active
                      ? 'pending'
                      : row.status
                  )}

                  <span>
                    Step
                    ${row.step_number}
                  </span>

                </div>


                <h3>
                  ${escapeHtml(title)}
                </h3>


                <div class="muted">
                  ${escapeHtml(
                    r.department ||
                    '-'
                  )}
                  ·
                  ${formatDate(
                    r.created_at
                  )}
                </div>

              </div>


              <strong class="v6-amount">
                ${formatAmount(
                  totalAmount,
                  currency
                )}
              </strong>

            </div>


            <div
              class="
                v6-detail-grid
                compact-view
              "
            >

              <div>
                <span>
                  Number of items
                </span>

                <strong>
                  ${
                    items.length ||
                    1
                  }
                </strong>
              </div>


              <div>
                <span>
                  Vendor
                </span>

                <strong>
                  ${escapeHtml(
                    r.vendor ||
                    '-'
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Currency
                </span>

                <strong>
                  ${escapeHtml(currency)}
                </strong>
              </div>


              <div>
                <span>
                  Request status
                </span>

                <strong>
                  ${escapeHtml(
                    prettyStatus(
                      r.status
                    )
                  )}
                </strong>
              </div>

            </div>


            <div class="v6-detail-block">

              <span>
                Items
              </span>

              ${renderPurchaseItems(
                items,
                currency
              )}

            </div>


            ${
              r.business_purpose
                ? `
                  <div class="v6-detail-block">

                    <span>
                      Business purpose
                    </span>

                    <p>
                      ${escapeHtml(
                        r.business_purpose
                      )}
                    </p>

                  </div>
                `
                : ''
            }


            ${
              r.purchase_link
                ? `
                  <a
                    class="text-link"
                    href="${escapeHtml(
                      r.purchase_link
                    )}"
                    target="_blank"
                    rel="noopener"
                  >
                    Open purchase link
                  </a>
                `
                : ''
            }


            ${
              note
                ? `
                  <div
                    class="
                      v6-callout
                      ${
                        r.status ===
                        'rejected'
                          ? 'danger'
                          : ''
                      }
                    "
                  >

                    <strong>
                      Review note
                    </strong>

                    <p>
                      ${escapeHtml(note)}
                    </p>

                  </div>
                `
                : ''
            }


            ${actions}

          </article>
        `;
      })
      .join('');
}


/* --------------------------------------------------
   Load Purchase approvals
-------------------------------------------------- */

async function loadPurchaseApprovals() {
  cards.innerHTML =
    `
      <p class="muted">
        Loading purchase approvals...
      </p>
    `;


  const roleFilter =
    authContext.role === 'admin'
      ? 'admin'
      : 'approver';


  const {
    data: approvals,
    error: approvalsError
  } =
    await window.supabaseClient
      .from('approvals')
      .select(
        `
          id,
          request_id,
          step_number,
          approver_role,
          status,
          comment,
          approved_at,
          created_at
        `
      )
      .eq(
        'approver_role',
        roleFilter
      );


  if (approvalsError) {
    cards.innerHTML =
      `
        <p class="muted">
          Could not load approvals:
          ${escapeHtml(
            approvalsError.message
          )}
        </p>
      `;

    return;
  }


  if (!approvals?.length) {
    approvalRows = [];

    buildStatusFilter([]);

    cards.innerHTML =
      `
        <p class="muted">
          No purchase requests
          for this role.
        </p>
      `;

    return;
  }


  const requestIds =
    approvals.map(
      row =>
        row.request_id
    );


  const {
    data: requests,
    error: requestsError
  } =
    await window.supabaseClient
      .from(
        'purchase_requests'
      )
      .select(
        `
          id,
          requester_id,
          department,
          item_name,
          category,
          quantity,
          amount,
          total_amount,
          currency,
          vendor,
          purchase_link,
          business_purpose,
          status,
          current_step,
          review_comment,
          created_at
        `
      )
      .in(
        'id',
        requestIds
      );


  if (requestsError) {
    cards.innerHTML =
      `
        <p class="muted">
          Could not load purchase requests:
          ${escapeHtml(
            requestsError.message
          )}
        </p>
      `;

    return;
  }


  /*
    Load all individual items belonging
    to the Purchase Requests.
  */

  const {
    data: purchaseItems,
    error: itemsError
  } =
    await window.supabaseClient
      .from(
        'purchase_request_items'
      )
      .select(
        `
          id,
          request_id,
          item_name,
          category,
          unit_price,
          quantity,
          subtotal,
          created_at
        `
      )
      .in(
        'request_id',
        requestIds
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      );


  if (itemsError) {
    cards.innerHTML =
      `
        <p class="muted">
          Could not load purchase items:
          ${escapeHtml(
            itemsError.message
          )}
        </p>
      `;

    return;
  }


  const itemsByRequest =
    new Map();


  for (
    const item of
    purchaseItems || []
  ) {

    if (
      !itemsByRequest.has(
        item.request_id
      )
    ) {
      itemsByRequest.set(
        item.request_id,
        []
      );
    }


    itemsByRequest
      .get(
        item.request_id
      )
      .push(item);
  }


  const requestsById =
    new Map(
      (requests || [])
        .map(
          request => [
            request.id,
            {
              ...request,
              items:
                itemsByRequest.get(
                  request.id
                ) ||
                []
            }
          ]
        )
    );


  approvalRows =
    approvals
      .map(
        approval => ({
          ...approval,

          request:
            requestsById.get(
              approval.request_id
            )
        })
      )
      .filter(
        row =>
          row.request
      );


  buildStatusFilter(
    approvalRows.map(
      row =>
        row.status
    )
  );


  renderPurchaseApprovals();
}


/* --------------------------------------------------
   Purchase Approve / Reject
-------------------------------------------------- */

async function actApproval(
  approvalId,
  decision
) {

  const row =
    approvalRows.find(
      item =>
        item.id ===
        approvalId
    );


  if (!row) {
    return;
  }


  let comment =
    row.comment ||
    null;


  if (
    decision === 'rejected'
  ) {

    const entered =
      window.prompt(
        'Reason for rejection:',
        comment || ''
      );


    if (
      entered === null
    ) {
      return;
    }


    const trimmed =
      entered.trim();


    if (!trimmed) {
      alert(
        'Please enter a reason for rejection.'
      );

      return;
    }


    comment =
      trimmed;
  }


  const now =
    new Date()
      .toISOString();


  const {
    error: approvalError
  } =
    await window.supabaseClient
      .from('approvals')
      .update({
        status:
          decision,

        comment,

        approved_at:
          now
      })
      .eq(
        'id',
        approvalId
      );


  if (approvalError) {
    alert(
      `Could not update approval: ${approvalError.message}`
    );

    return;
  }


  /*
    Rejected
  */

  if (
    decision === 'rejected'
  ) {

    const {
      error
    } =
      await window.supabaseClient
        .from(
          'purchase_requests'
        )
        .update({
          status:
            'rejected',

          review_comment:
            comment,

          updated_at:
            now
        })
        .eq(
          'id',
          row.request_id
        );


    if (error) {
      alert(
        `Could not update request: ${error.message}`
      );
    }


    await loadPurchaseApprovals();

    return;
  }


  /*
    Find next approval step.
  */

  const {
    data: nextRows,
    error: nextError
  } =
    await window.supabaseClient
      .from('approvals')
      .select(
        'id,step_number'
      )
      .eq(
        'request_id',
        row.request_id
      )
      .gt(
        'step_number',
        row.step_number
      )
      .order(
        'step_number',
        {
          ascending: true
        }
      )
      .limit(1);


  if (nextError) {
    alert(
      `Could not find next approval step: ${nextError.message}`
    );

    return;
  }


  /*
    Next approval exists.
  */

  if (
    nextRows?.length
  ) {

    const next =
      nextRows[0];


    const {
      error:
        nextApprovalError
    } =
      await window.supabaseClient
        .from('approvals')
        .update({
          status:
            'pending'
        })
        .eq(
          'id',
          next.id
        );


    const {
      error:
        requestError
    } =
      await window.supabaseClient
        .from(
          'purchase_requests'
        )
        .update({
          current_step:
            next.step_number,

          updated_at:
            now
        })
        .eq(
          'id',
          row.request_id
        );


    if (
      nextApprovalError ||
      requestError
    ) {
      alert(
        `Could not advance approval flow: ${
          (
            nextApprovalError ||
            requestError
          ).message
        }`
      );
    }

  } else {

    /*
      Final approval.
    */

    const {
      error
    } =
      await window.supabaseClient
        .from(
          'purchase_requests'
        )
        .update({
          status:
            'approved',

          review_comment:
            null,

          updated_at:
            now
        })
        .eq(
          'id',
          row.request_id
        );


    if (error) {
      alert(
        `Could not finish approval: ${error.message}`
      );
    }
  }


  await loadPurchaseApprovals();
}


/* ==================================================
   REIMBURSEMENTS
================================================== */


/* --------------------------------------------------
   Attachment
-------------------------------------------------- */

async function signedAttachmentUrl(
  path
) {
  if (!path) {
    return null;
  }


  const {
    data,
    error
  } =
    await window.supabaseClient
      .storage
      .from(
        'reimbursement-files'
      )
      .createSignedUrl(
        path,
        300
      );


  if (error) {
    return null;
  }


  return (
    data?.signedUrl ||
    null
  );
}


/* --------------------------------------------------
   Reimbursement filtering
-------------------------------------------------- */

function reimbursementVisibleRows() {
  return reimbursementRows
    .filter(
      row =>
        statusFilter.value === 'all' ||
        row.status ===
          statusFilter.value
    )
    .filter(
      row =>
        dateMatches(
          row.created_at
        )
    )
    .sort((a, b) => {

      const priority =
        statusPriority(a.status) -
        statusPriority(b.status);

      if (
        priority !== 0
      ) {
        return priority;
      }

      return (
        new Date(
          b.created_at
        ) -
        new Date(
          a.created_at
        )
      );
    });
}


/* --------------------------------------------------
   Render reimbursements
-------------------------------------------------- */

function renderReimbursements() {
  const visible =
    reimbursementVisibleRows();


  if (!visible.length) {
    cards.innerHTML =
      `
        <p class="muted">
          No matching reimbursements.
        </p>
      `;

    return;
  }


  cards.innerHTML =
    visible
      .map(r => {

        const attachment =
          r.attachment_url
            ? `
              <a
                class="text-link"
                href="${r.attachment_url}"
                target="_blank"
                rel="noopener"
              >
                View
                ${escapeHtml(
                  r.attachment_name ||
                  'attachment'
                )}
              </a>
            `
            : `
              <span class="muted">
                No attachment
              </span>
            `;


        const hasVehicle =
          [
            r.departure,
            r.destination,
            r.distance,
            r.parking_toll
          ].some(
            value =>
              value !== null &&
              value !== '' &&
              value !== undefined
          );


        const vehicle =
          hasVehicle
            ? `
              <div
                class="
                  v6-detail-grid
                  compact-view
                "
              >

                <div>
                  <span>
                    Route
                  </span>

                  <strong>
                    ${escapeHtml(
                      r.departure ||
                      '-'
                    )}
                    →
                    ${escapeHtml(
                      r.destination ||
                      '-'
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Distance
                  </span>

                  <strong>
                    ${
                      r.distance ??
                      '-'
                    }
                    km
                  </strong>
                </div>


                <div>
                  <span>
                    Parking / toll
                  </span>

                  <strong>
                    ${
                      r.parking_toll
                        ? formatAmount(
                            r.parking_toll,
                            'KRW'
                          )
                        : '-'
                    }
                  </strong>
                </div>


                <div>
                  <span>
                    Attachment
                  </span>

                  <strong>
                    ${attachment}
                  </strong>
                </div>

              </div>
            `
            : `
              <div
                class="
                  v6-detail-grid
                  compact-view
                "
              >

                <div>
                  <span>
                    Expense date
                  </span>

                  <strong>
                    ${escapeHtml(
                      r.expense_date ||
                      '-'
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Attachment
                  </span>

                  <strong>
                    ${attachment}
                  </strong>
                </div>

              </div>
            `;


        let actions = '';


        if (
          [
            'admin',
            'accountant'
          ].includes(
            authContext.role
          )
        ) {

          if (
            [
              'submitted',
              'need_more_info'
            ].includes(
              r.status
            )
          ) {
            actions += `
              <button
                class="btn"
                onclick="
                  reviewReimbursement(
                    '${r.id}',
                    'under_review'
                  )
                "
              >
                Start review
              </button>
            `;
          }


          if (
            ![
              'rejected',
              'completed'
            ].includes(
              r.status
            )
          ) {
            actions += `
              <button
                class="btn"
                onclick="
                  reviewReimbursement(
                    '${r.id}',
                    'need_more_info'
                  )
                "
              >
                Need more info
              </button>
            `;
          }


          if (
            ![
              'approved',
              'paid',
              'completed',
              'rejected'
            ].includes(
              r.status
            )
          ) {
            actions += `
              <button
                class="btn primary"
                onclick="
                  reviewReimbursement(
                    '${r.id}',
                    'approved'
                  )
                "
              >
                Approve
              </button>
            `;
          }


          if (
            ![
              'rejected',
              'completed'
            ].includes(
              r.status
            )
          ) {
            actions += `
              <button
                class="btn danger"
                onclick="
                  reviewReimbursement(
                    '${r.id}',
                    'rejected'
                  )
                "
              >
                Reject
              </button>
            `;
          }


          /*
            Reopen rejected reimbursement
          */

          if (
            r.status ===
            'rejected'
          ) {
            actions += `
              <button
                class="btn"
                onclick="
                  reviewReimbursement(
                    '${r.id}',
                    'under_review'
                  )
                "
              >
                Reopen
              </button>
            `;
          }


          if (
            r.status ===
            'approved'
          ) {
            actions += `
              <button
                class="btn primary"
                onclick="
                  reviewReimbursement(
                    '${r.id}',
                    'paid'
                  )
                "
              >
                Mark paid
              </button>
            `;
          }


          if (
            r.status ===
            'paid'
          ) {
            actions += `
              <button
                class="btn primary"
                onclick="
                  reviewReimbursement(
                    '${r.id}',
                    'completed'
                  )
                "
              >
                Complete
              </button>
            `;
          }
        }


        return `
          <article
            class="
              approval-card
              v6-approval-card
              ${
                [
                  'submitted',
                  'under_review'
                ].includes(
                  r.status
                )
                  ? 'is-pending'
                  : ''
              }
            "
          >

            <div class="card-top">

              <div>

                <div class="v6-card-meta">

                  ${statusBadge(
                    r.status
                  )}

                  <span>
                    ${escapeHtml(
                      r.expense_date ||
                      ''
                    )}
                  </span>

                </div>


                <h3>
                  ${escapeHtml(
                    r.category
                  )}
                  reimbursement
                </h3>


                <div class="muted">
                  ${escapeHtml(
                    r.requester_name ||
                    'Employee'
                  )}
                  ·
                  ${escapeHtml(
                    r.department ||
                    '-'
                  )}
                </div>

              </div>


              <strong class="v6-amount">
                ${formatAmount(
                  r.amount,
                  r.currency ||
                  'KRW'
                )}
              </strong>

            </div>


            ${
              r.business_purpose
                ? `
                  <div class="v6-detail-block">

                    <span>
                      Business purpose
                    </span>

                    <p>
                      ${escapeHtml(
                        r.business_purpose
                      )}
                    </p>

                  </div>
                `
                : ''
            }


            ${vehicle}


            ${
              r.review_comment
                ? `
                  <div
                    class="
                      v6-callout
                      ${
                        r.status ===
                        'rejected'
                          ? 'danger'
                          :
                        r.status ===
                        'need_more_info'
                          ? 'warning'
                          : ''
                      }
                    "
                  >

                    <strong>
                      ${
                        r.status ===
                        'need_more_info'
                          ?
                          'Additional information requested'
                          :
                        r.status ===
                        'rejected'
                          ?
                          'Reason for rejection'
                          :
                          'Reviewer comment'
                      }
                    </strong>

                    <p>
                      ${escapeHtml(
                        r.review_comment
                      )}
                    </p>

                  </div>
                `
                : ''
            }


            <div class="approval-actions">
              ${actions}
            </div>

          </article>
        `;
      })
      .join('');
}


/* --------------------------------------------------
   Load reimbursements
-------------------------------------------------- */

async function loadReimbursements() {
  cards.innerHTML =
    `
      <p class="muted">
        Loading reimbursements...
      </p>
    `;


  const {
    data,
    error
  } =
    await window.supabaseClient
      .from(
        'reimbursements'
      )
      .select('*');


  if (error) {
    cards.innerHTML =
      `
        <p class="muted">
          Could not load reimbursements:
          ${escapeHtml(
            error.message
          )}
        </p>
      `;

    return;
  }


  reimbursementRows = [];


  for (
    const r of
    data || []
  ) {
    reimbursementRows.push({
      ...r,

      attachment_url:
        await signedAttachmentUrl(
          r.attachment_path
        )
    });
  }


  buildStatusFilter(
    reimbursementRows.map(
      r =>
        r.status
    )
  );


  renderReimbursements();
}


/* --------------------------------------------------
   Reimbursement actions
-------------------------------------------------- */

async function reviewReimbursement(
  id,
  status
) {

  const row =
    reimbursementRows.find(
      r =>
        r.id === id
    );


  if (!row) {
    return;
  }


  let comment =
    row.review_comment ||
    null;


  /*
    Need more info / Reject
    require a comment.
  */

  if (
    [
      'need_more_info',
      'rejected'
    ].includes(
      status
    )
  ) {

    const promptText =
      status ===
      'need_more_info'
        ?
        'What additional information is needed?'
        :
        'Reason for rejection:';


    const entered =
      window.prompt(
        promptText,
        comment || ''
      );


    if (
      entered === null
    ) {
      return;
    }


    const trimmed =
      entered.trim();


    if (!trimmed) {

      alert(
        status ===
        'need_more_info'
          ?
          'Please enter what additional information is required.'
          :
          'Please enter a reason for rejection.'
      );

      return;
    }


    comment =
      trimmed;
  }


  /*
    Keep rejection comment
    when Reopen -> under_review.

    Clear it after approval/payment.
  */

  if (
    [
      'approved',
      'paid',
      'completed'
    ].includes(
      status
    )
  ) {
    comment = null;
  }


  const now =
    new Date()
      .toISOString();


  const updatePayload = {
    status,

    review_comment:
      comment,

    reviewed_at:
      now,

    updated_at:
      now
  };


  if (
    authContext
      ?.profile
      ?.id
  ) {
    updatePayload.reviewed_by =
      authContext.profile.id;
  }


  const {
    error
  } =
    await window.supabaseClient
      .from(
        'reimbursements'
      )
      .update(
        updatePayload
      )
      .eq(
        'id',
        id
      );


  if (error) {
    alert(
      `Could not update reimbursement: ${error.message}`
    );

    return;
  }


  await loadReimbursements();
}


/* --------------------------------------------------
   Reimbursement CSV
-------------------------------------------------- */

function exportReimbursementsCsv() {
  const rows =
    reimbursementVisibleRows();


  if (!rows.length) {
    alert(
      'No reimbursements to export.'
    );

    return;
  }


  const headers = [
    'Requester',
    'Department',
    'Expense Date',
    'Category',
    'Amount',
    'Currency',
    'Status',
    'Business Purpose',
    'Departure',
    'Destination',
    'Distance',
    'Parking / Toll',
    'Review Comment',
    'Created At'
  ];


  const dataRows =
    rows.map(
      r => [
        r.requester_name ||
          '',

        r.department ||
          '',

        r.expense_date ||
          '',

        r.category ||
          '',

        r.amount ||
          '',

        r.currency ||
          'KRW',

        prettyStatus(
          r.status
        ),

        r.business_purpose ||
          '',

        r.departure ||
          '',

        r.destination ||
          '',

        r.distance ||
          '',

        r.parking_toll ||
          '',

        r.review_comment ||
          '',

        r.created_at ||
          ''
      ]
    );


  const escapeCsv =
    value => {

      const text =
        String(
          value ?? ''
        )
          .replaceAll(
            '"',
            '""'
          );

      return `"${text}"`;
    };


  const csv =
    '\uFEFF' +
    [
      headers,
      ...dataRows
    ]
      .map(
        row =>
          row
            .map(
              escapeCsv
            )
            .join(',')
      )
      .join('\n');


  const blob =
    new Blob(
      [csv],
      {
        type:
          'text/csv;charset=utf-8;'
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      'a'
    );


  link.href =
    url;


  link.download =
    `reimbursements_${
      new Date()
        .toISOString()
        .slice(
          0,
          10
        )
    }.csv`;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  URL.revokeObjectURL(
    url
  );
}


/* ==================================================
   PAGE
================================================== */

async function switchView(
  view
) {
  currentView =
    view;


  statusFilter.value =
    'all';

  dateFrom.value =
    '';

  dateTo.value =
    '';


  setActiveTab();


  if (
    view ===
    'purchase'
  ) {
    return loadPurchaseApprovals();
  }


  return loadReimbursements();
}


async function initApprovalsPage() {
  authContext =
    await requireAuth([
      'admin',
      'approver',
      'accountant'
    ]);


  if (!authContext) {
    return;
  }


  purchaseTab.hidden =
    ![
      'admin',
      'approver'
    ].includes(
      authContext.role
    );


  reimbursementTab.hidden =
    ![
      'admin',
      'accountant'
    ].includes(
      authContext.role
    );


  currentView =
    authContext.role ===
    'accountant'
      ?
      'reimbursement'
      :
      'purchase';


  purchaseTab.addEventListener(
    'click',
    () =>
      switchView(
        'purchase'
      )
  );


  reimbursementTab.addEventListener(
    'click',
    () =>
      switchView(
        'reimbursement'
      )
  );


  statusFilter.addEventListener(
    'change',
    () =>
      currentView ===
      'purchase'
        ?
        renderPurchaseApprovals()
        :
        renderReimbursements()
  );


  dateFrom.addEventListener(
    'change',
    () =>
      currentView ===
      'purchase'
        ?
        renderPurchaseApprovals()
        :
        renderReimbursements()
  );


  dateTo.addEventListener(
    'change',
    () =>
      currentView ===
      'purchase'
        ?
        renderPurchaseApprovals()
        :
        renderReimbursements()
  );


  clearFilters.addEventListener(
    'click',
    () => {

      statusFilter.value =
        'all';

      dateFrom.value =
        '';

      dateTo.value =
        '';


      currentView ===
      'purchase'
        ?
        renderPurchaseApprovals()
        :
        renderReimbursements();
    }
  );


  const exportButton =
    document.getElementById(
      'exportReimbursements'
    );


  if (exportButton) {
    exportButton.addEventListener(
      'click',
      exportReimbursementsCsv
    );
  }


  await switchView(
    currentView
  );
}


/* --------------------------------------------------
   Global actions
-------------------------------------------------- */

window.actApproval =
  actApproval;

window.reviewReimbursement =
  reviewReimbursement;


/* --------------------------------------------------
   Start
-------------------------------------------------- */

initApprovalsPage();
