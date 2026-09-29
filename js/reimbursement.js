const form=document.getElementById('reimbursementForm');
const cat=document.getElementById('reimCategory');const vehicle=document.getElementById('vehicleFields');
cat.addEventListener('change',()=>vehicle.classList.toggle('hidden',!['Business Travel','Fuel','Parking'].includes(cat.value)));
form.addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form).entries());createRequest({type:'Reimbursement',requester:data.requester,department:data.department,category:data.category,amount:Number(data.amount),purpose:data.purpose,expenseDate:data.expenseDate,departure:data.departure||'',destination:data.destination||'',distance:data.distance||'',parkingToll:data.parkingToll||''});alert('Reimbursement submitted.');location.href='my-requests.html';});
