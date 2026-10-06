const purchaseForm =
  document.getElementById('purchaseForm');

const purchaseItemsContainer =
  document.getElementById('purchaseItems');

const addItemButton =
  document.getElementById('addItemButton');

const purchaseCurrency =
  document.getElementById('purchaseCurrency');

const purchaseTotal =
  document.getElementById('purchaseTotal');

const approvalRoutePreview =
  document.getElementById('approvalRoutePreview');


let purchaseAuth = null;
let itemSequence = 0;


/* --------------------------------------------------
   Helpers
-------------------------------------------------- */

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


function normalizeUrl(url) {
  if (!url) {
    return null;
  }

  const trimmed =
    url.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}


function formatAmount(
  value,
  currency = 'KRW'
) {
  const amount =
    Number(value || 0);

  const maximumFractionDigits =
    currency === 'KRW'
      ? 0
      : 2;

  return (
    new Intl.NumberFormat(
      'en-US',
      {
        maximumFractionDigits
      }
    ).format(amount) +
    ` ${currency}`
  );
}


/* --------------------------------------------------
   Item row
-------------------------------------------------- */

function itemRowTemplate(id) {
  return `
    <div
      class="purchase-item-row"
      data-item-row="${id}"
    >

      <label>
        Item name

        <input
          type="text"
          class="item-name"
          placeholder="e.g. Raspberry Pi 5"
          required
        >
      </label>


      <label>
        Category

        <select
          class="item-category"
          required
        >
          <option value="">
            Select
          </option>

          <option value="Engineering & R&D Hardware">
            Engineering & R&D Hardware
          </option>

          <option value="Office & IT Equipment">
            Office & IT Equipment
          </option>

          <option value="Office Supplies">
            Office Supplies
          </option>

          <option value="Software / Subscription">
            Software / Subscription
          </option>

          <option value="Other">
            Other
          </option>
        </select>
      </label>


      <label>
        Unit price

        <input
          type="number"
          class="item-unit-price"
          min="0"
          step="0.01"
          inputmode="decimal"
          placeholder="0"
          required
        >
      </label>


      <label>
        Qty

        <input
          type="number"
          class="item-quantity"
          min="1"
          step="1"
          value="1"
          inputmode="numeric"
          required
        >
      </label>


      <label>
        Subtotal

        <div class="item-subtotal">
          0 ${escapeHtml(
            purchaseCurrency.value || 'KRW'
          )}
        </div>
      </label>


      <button
        type="button"
        class="btn danger remove-item-btn"
        title="Remove item"
      >
        ×
      </button>

    </div>
  `;
}


function addItemRow() {
  itemSequence += 1;

  purchaseItemsContainer.insertAdjacentHTML(
    'beforeend',
    itemRowTemplate(itemSequence)
  );

  const row =
    purchaseItemsContainer.querySelector(
      `[data-item-row="${itemSequence}"]`
    );

  bindItemRow(row);

  calculateTotals();
}


function bindItemRow(row) {
  const unitPriceInput =
    row.querySelector(
      '.item-unit-price'
    );

  const quantityInput =
    row.querySelector(
      '.item-quantity'
    );

  const removeButton =
    row.querySelector(
      '.remove-item-btn'
    );


  unitPriceInput.addEventListener(
    'keydown',
    blockInvalidNumberKeys
  );


  quantityInput.addEventListener(
    'keydown',
    blockInvalidIntegerKeys
  );


  unitPriceInput.addEventListener(
    'input',
    calculateTotals
  );


  quantityInput.addEventListener(
    'input',
    calculateTotals
  );


  removeButton.addEventListener(
    'click',
    () => {
      const rows =
        purchaseItemsContainer.querySelectorAll(
          '.purchase-item-row'
        );

      if (rows.length <= 1) {
        alert(
          'At least one item is required.'
        );

        return;
      }

      row.remove();

      calculateTotals();
    }
  );
}


function blockInvalidNumberKeys(event) {
  if (
    [
      'e',
      'E',
      '+',
      '-'
    ].includes(event.key)
  ) {
    event.preventDefault();
  }
}


function blockInvalidIntegerKeys(event) {
  if (
    [
      'e',
      'E',
      '+',
      '-',
      '.'
    ].includes(event.key)
  ) {
    event.preventDefault();
  }
}


/* --------------------------------------------------
   Read item rows
-------------------------------------------------- */

function getItems() {
  const rows =
    [
      ...purchaseItemsContainer.querySelectorAll(
        '.purchase-item-row'
      )
    ];

  return rows.map(row => {
    const itemName =
      row
        .querySelector('.item-name')
        .value
        .trim();

    const category =
      row
        .querySelector('.item-category')
        .value;

    const unitPrice =
      Number(
        row
          .querySelector('.item-unit-price')
          .value ||
        0
      );

    const quantity =
      Number(
        row
          .querySelector('.item-quantity')
          .value ||
        0
      );

    const subtotal =
      unitPrice * quantity;

    return {
      item_name: itemName,
      category,
      unit_price: unitPrice,
      quantity,
      subtotal
    };
  });
}


/* --------------------------------------------------
   Total calculation
-------------------------------------------------- */

function calculateTotals() {
  const currency =
    purchaseCurrency.value ||
    'KRW';

  const rows =
    purchaseItemsContainer.querySelectorAll(
      '.purchase-item-row'
    );

  let total = 0;


  rows.forEach(row => {
    const unitPrice =
      Number(
        row
          .querySelector('.item-unit-price')
          .value ||
        0
      );

    const quantity =
      Number(
        row
          .querySelector('.item-quantity')
          .value ||
        0
      );

    const subtotal =
      unitPrice * quantity;

    total += subtotal;


    row
      .querySelector('.item-subtotal')
      .textContent =
        formatAmount(
          subtotal,
          currency
        );
  });


  purchaseTotal.textContent =
    formatAmount(
      total,
      currency
    );


  renderApprovalRoute(total);


  return total;
}


/* --------------------------------------------------
   Approval route
-------------------------------------------------- */

function renderApprovalRoute(
  total
) {
  /*
    Temporary rule:
    <= 500,000 : Office Admin
    > 500,000  : Office Admin -> Team Leader

    Currently this numeric threshold is treated
    as KRW-based provisional logic.
  */

  const route =
    total > 500000
      ? [
          'Office Admin',
          'Team Leader'
        ]
      : [
          'Office Admin'
        ];


  approvalRoutePreview.innerHTML =
    route
      .map(
        (step, index) =>
          `
            <span class="route-step">
              ${index + 1}. ${escapeHtml(step)}
            </span>
          `
      )
      .join(
        '<span>→</span>'
      );
}


/* --------------------------------------------------
   Validation
-------------------------------------------------- */

function validateItems(items) {
  if (!items.length) {
    alert(
      'Please add at least one item.'
    );

    return false;
  }


  for (
    let i = 0;
    i < items.length;
    i += 1
  ) {
    const item =
      items[i];


    if (!item.item_name) {
      alert(
        `Please enter the item name for item ${i + 1}.`
      );

      return false;
    }


    if (!item.category) {
      alert(
        `Please select a category for item ${i + 1}.`
      );

      return false;
    }


    if (
      !Number.isFinite(
        item.unit_price
      ) ||
      item.unit_price < 0
    ) {
      alert(
        `Please enter a valid unit price for item ${i + 1}.`
      );

      return false;
    }


    if (
      !Number.isInteger(
        item.quantity
      ) ||
      item.quantity < 1
    ) {
      alert(
        `Quantity for item ${i + 1} must be 1 or more.`
      );

      return false;
    }
  }


  return true;
}


/* --------------------------------------------------
   Page initialization
-------------------------------------------------- */

async function initPurchasePage() {
  purchaseAuth =
    await requireAuth();


  if (!purchaseAuth) {
    return;
  }


  purchaseForm.elements.requester.value =
    purchaseAuth.profile?.name ||
    purchaseAuth.user.user_metadata?.full_name ||
    purchaseAuth.user.email;


  purchaseForm.elements.requester.readOnly =
    true;


  if (
    purchaseAuth.profile?.department
  ) {
    purchaseForm.elements.department.value =
      purchaseAuth.profile.department;
  }


  addItemRow();

  calculateTotals();
}


/* --------------------------------------------------
   Events
-------------------------------------------------- */

addItemButton.addEventListener(
  'click',
  addItemRow
);


purchaseCurrency.addEventListener(
  'change',
  calculateTotals
);


/* --------------------------------------------------
   Submit
-------------------------------------------------- */

purchaseForm.addEventListener(
  'submit',
  async event => {

    event.preventDefault();


    if (
      !purchaseAuth?.profile?.id
    ) {
      alert(
        'Could not identify the requester profile.'
      );

      return;
    }


    const submitButton =
      purchaseForm.querySelector(
        'button[type="submit"]'
      );


    const formData =
      new FormData(
        purchaseForm
      );


    const data =
      Object.fromEntries(
        formData.entries()
      );


    const items =
      getItems();


    if (
      !validateItems(items)
    ) {
      return;
    }


    const totalAmount =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.subtotal,
        0
      );


    if (
      totalAmount <= 0
    ) {
      alert(
        'Estimated total must be greater than 0.'
      );

      return;
    }


    const currency =
      data.currency ||
      'KRW';


    const firstItem =
      items[0];


    const totalQuantity =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.quantity,
        0
      );


    submitButton.disabled =
      true;

    submitButton.textContent =
      'Submitting...';


    /*
      1. Create parent purchase request.

      Legacy fields are also populated so that
      the existing Approvals / My Requests code
      keeps working until those screens are
      upgraded for multiple items.
    */

    const {
      data: request,
      error: requestError
    } =
      await window.supabaseClient
        .from(
          'purchase_requests'
        )
        .insert({
          requester_id:
            purchaseAuth.profile.id,

          department:
            data.department ||
            null,

          item_name:
            items.length === 1
              ? firstItem.item_name
              : `${firstItem.item_name} + ${items.length - 1} more`,

          category:
            firstItem.category,

          quantity:
            totalQuantity,

          amount:
            totalAmount,

          total_amount:
            totalAmount,

          currency,

          vendor:
            data.vendor ||
            null,

          purchase_link:
            normalizeUrl(
              data.purchaseLink
            ),

          business_purpose:
            data.purpose ||
            null,

          status:
            'pending_approval',

          current_step:
            1
        })
        .select(
          'id'
        )
        .single();


    if (
      requestError ||
      !request?.id
    ) {
      console.error(
        requestError
      );

      alert(
        `Could not submit purchase request: ${
          requestError?.message ||
          'Unknown error'
        }`
      );

      submitButton.disabled =
        false;

      submitButton.textContent =
        'Submit purchase request';

      return;
    }


    /*
      2. Save all individual items.
    */

    const itemRows =
      items.map(
        item => ({
          request_id:
            request.id,

          item_name:
            item.item_name,

          category:
            item.category,

          unit_price:
            item.unit_price,

          quantity:
            item.quantity,

          subtotal:
            item.subtotal
        })
      );


    const {
      error: itemsError
    } =
      await window.supabaseClient
        .from(
          'purchase_request_items'
        )
        .insert(
          itemRows
        );


    if (itemsError) {
      console.error(
        itemsError
      );


      /*
        Try to remove the parent request if
        item creation failed, so an incomplete
        request is not left behind.
      */

      const {
        error: cleanupError
      } =
        await window.supabaseClient
          .from(
            'purchase_requests'
          )
          .delete()
          .eq(
            'id',
            request.id
          );


      if (cleanupError) {
        console.error(
          'Cleanup failed:',
          cleanupError
        );
      }


      alert(
        `The purchase request could not be completed because the item list could not be saved: ${itemsError.message}`
      );


      submitButton.disabled =
        false;

      submitButton.textContent =
        'Submit purchase request';

      return;
    }


    alert(
      'Purchase request submitted.'
    );


    window.location.href =
      'my-requests.html';
  }
);


/* --------------------------------------------------
   Start
-------------------------------------------------- */

initPurchasePage();
