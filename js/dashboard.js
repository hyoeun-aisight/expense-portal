const rows=loadRequests();
const stats=[['Pending',rows.filter(r=>r.status==='Pending Approval').length],['Approved',rows.filter(r=>r.status==='Approved').length],['Completed',rows.filter(r=>r.status==='Completed').length],['Total',rows.length]];
document.getElementById('statsGrid').innerHTML=stats.map(([k,v])=>`<div class="stat"><div class="muted">${k}</div><div class="value">${v}</div></div>`).join('');
document.getElementById('recentRequests').innerHTML=rows.slice(0,8).map(r=>`<tr><td>${r.id}</td><td>${r.type}</td><td>${titleOf(r)}</td><td>${money(r.amount)}</td><td>${badge(r.status)}</td><td>${new Date(r.createdAt).toLocaleDateString('ko-KR')}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">No requests yet.</td></tr>';
