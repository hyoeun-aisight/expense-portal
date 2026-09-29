const STORE_KEY='expensePortalRequestsV1';
const RULES=[
  {max:500000,route:['Office Admin']},
  {max:2000000,route:['Office Admin','Finance Manager']},
  {max:Infinity,route:['Office Admin','Finance Manager','Director']}
];
function money(n){return new Intl.NumberFormat('ko-KR').format(Number(n||0))+'원'}
function getRoute(amount,type='Purchase'){
  if(type==='Reimbursement') return ['Office Admin','Accountant'];
  return RULES.find(r=>Number(amount)<=r.max).route;
}
function loadRequests(){try{return JSON.parse(localStorage.getItem(STORE_KEY))||[]}catch{return[]}}
function saveRequests(rows){localStorage.setItem(STORE_KEY,JSON.stringify(rows))}
function nextId(type){const prefix=type==='Purchase'?'PR':'RB';return prefix+'-'+String(Date.now()).slice(-7)}
function createRequest(payload){
  const rows=loadRequests();
  const route=getRoute(payload.amount,payload.type);
  const item={id:nextId(payload.type),...payload,status:'Pending Approval',route,stepIndex:0,approvalLog:[],createdAt:new Date().toISOString()};
  rows.unshift(item);saveRequests(rows);return item;
}
function badge(status){return `<span class="badge ${status.toLowerCase().replace(/\s+/g,'-')}">${status}</span>`}
function titleOf(r){return r.type==='Purchase'?r.itemName:(r.category+' reimbursement')}
