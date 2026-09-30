const reimbursementForm = document.getElementById('reimbursementForm');
const categoryInput = document.getElementById('reimCategory');
const vehicleFields = document.getElementById('vehicleFields');
const attachmentInput = document.getElementById('reimAttachment');
const businessPurposeGroup = document.getElementById('businessPurposeGroup');
const businessPurposeInput = document.getElementById('businessPurpose');

let reimbursementAuth = null;

function updateVehicleFields() {
  const show = ['Fuel', 'Parking', 'Transportation', 'Business Travel'].includes(categoryInput.value);
  vehicleFields.classList.toggle('hidden', !show);
}
function updateBusinessPurpose() {
  const show = categoryInput.value === 'Other';

  businessPurposeGroup.classList.toggle('hidden', !show);
  businessPurposeInput.required = show;

  if (!show) {
    businessPurposeInput.value = '';
  }
}

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function initReimbursementPage() {
  reimbursementAuth = await requireAuth();
  if (!reimbursementAuth) return;

  reimbursementForm.elements.requester.value = 
    reimbursementAuth.profile?.name || 
    reimbursementAuth.user.user_metadata?.full_name || 
    reimbursementAuth.user.email;
  
  reimbursementForm.elements.requester.readOnly = true;

  if (reimbursementAuth.profile?.department) {
    reimbursementForm.elements.department.value = 
      reimbursementAuth.profile.department;
  }

  updateVehicleFields();
  updateBusinessPurpose();
}

categoryInput.addEventListener('change', () => {
  updateVehicleFields();
  updateBusinessPurpose();
});

reimbursementForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!reimbursementAuth?.profile?.id) return;

  const button = reimbursementForm.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(reimbursementForm).entries());
  const file = attachmentInput.files?.[0] || null;

  if (file && file.size > 10 * 1024 * 1024) {
    alert('Attachment must be 10 MB or smaller.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Submitting...';

  let attachmentPath = null;
  let attachmentName = null;

  if (file) {
    attachmentName = file.name;
    attachmentPath = `${reimbursementAuth.user.id}/${Date.now()}-${safeFileName(file.name)}`;

    const { error: uploadError } = await window.supabaseClient.storage
      .from('reimbursement-files')
      .upload(attachmentPath, file, { upsert: false });

    if (uploadError) {
      console.error(uploadError);
      alert(`Could not upload attachment: ${uploadError.message}`);
      button.disabled = false;
      button.textContent = 'Submit reimbursement';
      return;
    }
  }

  const { error } = await window.supabaseClient
    .from('reimbursements')
    .insert({
      requester_id: reimbursementAuth.profile.id,
      requester_name: reimbursementAuth.profile?.name || reimbursementAuth.user.email,
      department: data.department || null,
      expense_date: data.expenseDate,
      category: data.category,
      amount: Number(data.amount),
      business_purpose: data.purpose,
      departure: data.departure || null,
      destination: data.destination || null,
      distance: data.distance ? Number(data.distance) : null,
      parking_toll: data.parkingToll ? Number(data.parkingToll) : null,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      status: 'submitted'
    });

  if (error) {
    console.error(error);
    alert(`Could not submit reimbursement: ${error.message}`);
    button.disabled = false;
    button.textContent = 'Submit reimbursement';
    return;
  }

  alert('Reimbursement submitted.');
  window.location.href = 'my-requests.html';
});

initReimbursementPage();

