const API = {
  get: (url) => fetch('/api' + url, { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } }).then(r => r.json()),
  post: (url, body) => fetch('/api' + url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
    body: JSON.stringify(body)
  }).then(r => r.json()),
  patch: (url, body) => fetch('/api' + url, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
    body: JSON.stringify(body)
  }).then(r => r.json())
};

const user = JSON.parse(localStorage.getItem('user') || '{}');
document.getElementById('user-info').textContent = `${user.full_name} (${user.role})`;
const main = document.getElementById('main');

const STATUS_LABELS = { new: 'Новая', in_progress: 'В работе', done: 'Выполнена' };

function logout() {
  localStorage.clear();
  location.href = 'index.html';
}

// ========== СТУДЕНТ: Подача заявки и список ==========
function renderStudentView() {
  main.innerHTML = `
    <div class="card">
      <h2>Новая заявка</h2>
      <form id="req-form" class="form">
        <label>ФИО <input name="applicant_name" value="${user.full_name}" required></label>
        <label>Дата подачи <input type="date" name="submission_date" required></label>
        <label>Комната <input name="room" required placeholder="Например, 305"></label>
        <label>Описание проблемы <textarea name="description" required rows="3"></textarea></label>
        <button type="submit" class="btn primary">Отправить</button>
        <div id="form-error" class="form-error"></div>
      </form>
    </div>
    <div class="card">
      <h2>Мои заявки</h2>
      <div id="my-requests"></div>
    </div>
  `;

  document.getElementById('req-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    
    // Клиентская валидация (ТЗ 5.3.1)
    if (!body.applicant_name || !body.submission_date || !body.room || !body.description) {
      return document.getElementById('form-error').textContent = 'Заполните все поля!';
    }

    const res = await API.post('/requests', body);
    if (res.error) {
      document.getElementById('form-error').textContent = res.error;
    } else {
      loadMyRequests();
      e.target.reset();
      document.getElementById('form-error').textContent = '';
    }
  });

  loadMyRequests();
}

async function loadMyRequests() {
  const data = await API.get('/requests');
  const container = document.getElementById('my-requests');
  if (!data.requests || data.requests.length === 0) return container.innerHTML = '<p class="muted">Нет заявок</p>';
  
  container.innerHTML = data.requests.map(r => `
    <div class="request-card">
      <div class="row space">
        <b>#${r.id} ${r.room}</b>
        <span class="status ${r.status}">${STATUS_LABELS[r.status]}</span>
      </div>
      <div>${r.description}</div>
      <div class="muted small">Создано: ${new Date(r.created_at).toLocaleString()}</div>
    </div>
  `).join('');
}

// ========== СПЕЦИАЛИСТ: Управление статусами ==========
function renderSpecialistView() {
  main.innerHTML = `
    <div class="card">
      <h2>Все заявки (Специалист)</h2>
      <div id="all-requests"></div>
    </div>
  `;
  loadAllRequests();
}

async function loadAllRequests() {
  const data = await API.get('/requests');
  const container = document.getElementById('all-requests');
  if (!data.requests || data.requests.length === 0) return container.innerHTML = '<p class="muted">Нет заявок</p>';

  container.innerHTML = data.requests.map(r => `
    <div class="request-card">
      <div class="row space">
        <b>#${r.id} от ${r.applicant_name} (Ком. ${r.room})</b>
        <span class="status ${r.status}">${STATUS_LABELS[r.status]}</span>
      </div>
      <div>${r.description}</div>
      <div class="row gap" style="margin-top: 10px;">
        <select id="status-${r.id}">
          ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${k === r.status ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <button class="btn small primary" onclick="updateStatus(${r.id})">Сменить статус</button>
        <button class="btn small ghost" onclick="viewHistory(${r.id})">Журнал</button>
      </div>
      <div id="history-${r.id}" class="history-box"></div>
    </div>
  `).join('');
}

async function updateStatus(id) {
  const status = document.getElementById(`status-${id}`).value;
  const res = await API.patch(`/requests/${id}/status`, { status });
  if (res.error) alert(res.error);
  else loadAllRequests();
}

async function viewHistory(id) {
  const data = await API.get(`/requests/${id}/history`);
  const box = document.getElementById(`history-${id}`);
  if (data.history) {
    box.innerHTML = data.history.map(h => `
      <div class="history-item">
        ${h.old_status ? STATUS_LABELS[h.old_status] : '—'} → <b>${STATUS_LABELS[h.new_status]}</b> 
        (${h.changed_by_name}, ${new Date(h.changed_at).toLocaleString()})
      </div>
    `).join('');
  }
}

// ========== ЗАВЕДУЮЩИЙ: Сводка ==========
function renderManagerView() {
  main.innerHTML = `
    <div class="card">
      <h2>Сводка за период</h2>
      <div class="filters">
        <label>С <input type="date" id="date-from"></label>
        <label>По <input type="date" id="date-to"></label>
        <button class="btn primary" onclick="loadSummary()">Показать</button>
      </div>
      <div id="summary-result" style="margin-top: 20px;"></div>
    </div>
  `;
  
  // Установка дат по умолчанию (неделя)
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  document.getElementById('date-from').value = weekAgo;
  document.getElementById('date-to').value = today;
  
  loadSummary();
}

async function loadSummary() {
  const from = document.getElementById('date-from').value;
  const to = document.getElementById('date-to').value;
  const data = await API.get(`/reports/summary?from=${from}&to=${to}`);
  
  const container = document.getElementById('summary-result');
  if (data.error) return container.innerHTML = `<p class="error">${data.error}</p>`;

  const total = data.stats.reduce((acc, s) => acc + s.count, 0);
  
  if (total === 0) {
    container.innerHTML = '<p class="muted">За выбранный период заявок нет.</p>';
    return;
  }

  // Визуализация (ТЗ 5.3.4)
  container.innerHTML = `
    <h3>Всего заявок: ${total}</h3>
    <div class="chart-container">
      ${data.stats.map(s => {
        const pct = Math.round((s.count / total) * 100);
        return `
          <div class="bar-row">
            <div class="bar-label">${STATUS_LABELS[s.status]}</div>
            <div class="bar"><div class="bar-fill ${s.status}" style="width: ${pct}%"></div></div>
            <div class="bar-value">${s.count} (${pct}%)</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Инициализация
if (user.role === 'student') renderStudentView();
else if (user.role === 'specialist') renderSpecialistView();
else if (user.role === 'manager') renderManagerView();