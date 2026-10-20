const STATUS_LABELS = { new: 'Новая', in_progress: 'В работе', done: 'Выполнена', rejected: 'Отклонена' };
const ROLE_LABELS = { student: 'Студент', employee: 'Сотрудник', specialist: 'Специалист', manager: 'Заведующий' };

const state = { user: null, unread: 0, view: 'dashboard' };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

function toast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), 3000);
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return isNaN(d) ? s : d.toLocaleString('ru-RU');
}

const openModal = () => document.getElementById('modal').classList.remove('hidden');
const closeModal = () => document.getElementById('modal').classList.add('hidden');

async function refreshNotifications() {
  try {
    const { unread } = await API.get('/notifications');
    state.unread = unread;
    const badge = document.getElementById('notif-count');
    if (unread > 0) { badge.textContent = unread; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  } catch { /* ignore */ }
}

async function showNotificationsModal() {
  const { notifications } = await API.get('/notifications');
  const body = document.getElementById('modal-body');
  body.innerHTML = '';
  body.append(el('h2', {}, 'Уведомления'));
  if (!notifications.length) {
    body.append(el('p', { class: 'muted' }, 'Пока нет уведомлений'));
  } else {
    const list = el('div', { class: 'notif-list' });
    notifications.forEach((n) => {
      list.append(el('div', { class: 'notif' + (n.is_read ? '' : ' unread') },
        el('div', { class: 'notif-title' }, n.title),
        el('div', { class: 'notif-msg' }, n.message),
        el('div', { class: 'notif-date muted' }, fmtDate(n.created_at)),
      ));
    });
    body.append(list);
    await API.post('/notifications/read-all');
    refreshNotifications();
  }
  openModal();
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  const items = [];
  const r = state.user.role;

  if (r === 'student' || r === 'employee') {
    items.push({ id: 'dashboard', label: 'Мои заявки' });
    items.push({ id: 'new', label: 'Новая заявка' });
  } else if (r === 'specialist') {
    items.push({ id: 'dashboard', label: 'Все заявки' });
    items.push({ id: 'reports', label: 'Сводка' });
  } else if (r === 'manager') {
    items.push({ id: 'reports', label: 'Сводка' });
    items.push({ id: 'dashboard', label: 'Все заявки' });
  }
  items.push({ id: 'profile', label: 'Профиль' });

  items.forEach((it) => {
    const b = el('button', { class: 'nav-btn' + (state.view === it.id ? ' active' : '') }, it.label);
    b.addEventListener('click', () => { state.view = it.id; render(); });
    nav.append(b);
  });
}

async function render() {
  renderNav();
  document.getElementById('user-name').textContent = state.user.full_name;
  document.getElementById('user-role').textContent = ROLE_LABELS[state.user.role] || state.user.role;

  const main = document.getElementById('main');
  main.innerHTML = '';
  main.append(el('h1', {}, ''));

  if (state.view === 'new')     return renderNewRequest(main);
  if (state.view === 'reports') return renderReports(main);
  if (state.view === 'profile') return renderProfile(main);
  return renderDashboard(main);
}

/* ---------- Новая заявка ---------- */
function renderNewRequest(main) {
  main.innerHTML = '';
  main.append(el('h1', {}, 'Новая заявка'));

  const form = el('form', { class: 'card form', id: 'new-request-form' });
  form.innerHTML = `
    <label>Комната <input name="room" required maxlength="20" placeholder="Например, 305" /></label>
    <label>Тема <input name="subject" required minlength="3" maxlength="120" placeholder="Протекает кран" /></label>
    <label>Описание
      <textarea name="description" required minlength="5" maxlength="2000" rows="5"
                placeholder="Опишите проблему подробнее..."></textarea>
    </label>
    <button class="btn primary" type="submit">Отправить заявку</button>
    <div class="form-error" id="new-request-error"></div>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = form.querySelector('#new-request-error');
    errEl.textContent = '';
    const fd = new FormData(form);
    const body = {
      room: String(fd.get('room')).trim(),
      subject: String(fd.get('subject')).trim(),
      description: String(fd.get('description')).trim(),
    };
    if (!body.room) { errEl.textContent = 'Укажите комнату'; return; }
    if (body.subject.length < 3) { errEl.textContent = 'Тема слишком короткая'; return; }
    if (body.description.length < 5) { errEl.textContent = 'Описание слишком короткое'; return; }

    try {
      const res = await API.post('/requests', body);
      toast(`Заявка #${res.request.id} принята`, 'success');
      state.view = 'dashboard';
      render();
    } catch (err) { errEl.textContent = err.message; }
  });
  main.append(form);
}

/* ---------- Список заявок ---------- */
async function renderDashboard(main) {
  main.innerHTML = '';
  const isStaff = ['specialist', 'manager'].includes(state.user.role);
  main.append(el('h1', {}, isStaff ? 'Все заявки' : 'Мои заявки'));

  const filterBar = el('div', { class: 'filters card' });
  let params = {};

  if (isStaff) {
    const statusSel = el('select');
    statusSel.innerHTML = `<option value="">Все статусы</option>` +
      Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    const roomInput = el('input', { placeholder: 'Комната' });
    const fromInput = el('input', { type: 'date' });
    const toInput = el('input', { type: 'date' });

    statusSel.addEventListener('change', () => { params.status = statusSel.value; load(); });
    roomInput.addEventListener('input', () => { params.room = roomInput.value; load(); });
    fromInput.addEventListener('change', () => { params.from = fromInput.value; load(); });
    toInput.addEventListener('change', () => { params.to = toInput.value; load(); });

    filterBar.append(
      el('label', {}, 'Статус', statusSel),
      el('label', {}, 'Комната', roomInput),
      el('label', {}, 'С', fromInput),
      el('label', {}, 'По', toInput),
    );
  }

  const list = el('div', { class: 'request-list' });
  const load = async () => {
    const url = isStaff ? '/requests?' + new URLSearchParams(params) : '/requests/my';
    try {
      const { requests } = await API.get(url);
      list.innerHTML = '';
      if (!requests.length) list.append(el('p', { class: 'muted' }, 'Заявок нет'));
      requests.forEach((r) => list.append(renderRequestCard(r, isStaff)));
    } catch (e) { toast(e.message, 'error'); }
  };

  main.append(filterBar);
  main.append(list);
  await load();
}

function renderRequestCard(r, isStaff) {
  const card = el('div', { class: 'request-card card' });
  card.append(
    el('div', { class: 'row space' },
      el('div', { class: 'request-title' }, `#${r.id} · ${r.subject}`),
      el('span', { class: 'status ' + r.status }, STATUS_LABELS[r.status]),
    ),
    el('div', { class: 'muted small' }, `Комната: ${r.room} · Автор: ${r.author_name || ''}`),
    el('div', {}, r.description),
    el('div', { class: 'muted small' }, `Создано: ${fmtDate(r.created_at)}`),
  );

  const actions = el('div', { class: 'row gap' });

  if (state.user.role === 'specialist') {
    const sel = el('select');
    sel.innerHTML = Object.entries(STATUS_LABELS).map(([k, v]) =>
      `<option value="${k}" ${k === r.status ? 'selected' : ''}>${v}</option>`).join('');
    const btn = el('button', { class: 'btn small primary' }, 'Сменить статус');
    btn.addEventListener('click', async () => {
      try {
        await API.patch(`/requests/${r.id}/status`, { status: sel.value });
        toast('Статус обновлён', 'success');
        render();
      } catch (e) { toast(e.message, 'error'); }
    });
    actions.append(sel, btn);
  }

  const detailBtn = el('button', { class: 'btn small ghost' }, 'История');
  detailBtn.addEventListener('click', async () => {
    try {
      const { request, history } = await API.get(`/requests/${r.id}`);
      const body = document.getElementById('modal-body');
      body.innerHTML = '';
      body.append(
        el('h2', {}, `Заявка #${request.id}`),
        el('p', { class: 'muted' }, `${request.subject} · комната ${request.room}`),
        el('p', {}, request.description),
      );
      const h = el('div', { class: 'history' });
      history.forEach((it) => h.append(el('div', { class: 'history-item' },
        el('b', {}, `${STATUS_LABELS[it.old_status] || '—'} → ${STATUS_LABELS[it.new_status]}`),
        el('div', { class: 'muted small' },
          `${fmtDate(it.changed_at)} · ${it.changed_by_name || 'система'}${it.comment ? ' · ' + it.comment : ''}`),
      )));
      body.append(el('h3', {}, 'История'), h);
      openModal();
    } catch (e) { toast(e.message, 'error'); }
  });
  actions.append(detailBtn);

  card.append(actions);
  return card;
}

/* ---------- Сводка ---------- */
async function renderReports(main) {
  main.innerHTML = '';
  main.append(el('h1', {}, 'Сводка'));

  const filters = el('div', { class: 'filters card' });
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 6 * 24 * 3600 * 1000);
  const fromInput = el('input', { type: 'date', value: weekAgo.toISOString().slice(0, 10) });
  const toInput = el('input', { type: 'date', value: today.toISOString().slice(0, 10) });
  const roomInput = el('input', { placeholder: 'Комната' });
  const statusSel = el('select');
  statusSel.innerHTML = `<option value="">Все статусы</option>` +
    Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  const applyBtn = el('button', { class: 'btn primary' }, 'Применить');

  filters.append(
    el('label', {}, 'С', fromInput),
    el('label', {}, 'По', toInput),
    el('label', {}, 'Комната', roomInput),
    el('label', {}, 'Статус', statusSel),
    applyBtn,
  );

  const result = el('div', { class: 'reports' });
  main.append(filters, result);

  const load = async () => {
    const q = new URLSearchParams();
    if (fromInput.value) q.set('from', fromInput.value);
    if (toInput.value) q.set('to', toInput.value);
    if (roomInput.value) q.set('room', roomInput.value);
    if (statusSel.value) q.set('status', statusSel.value);
    try {
      const data = await API.get('/reports/summary?' + q.toString());
      renderReportsResult(result, data);
    } catch (e) { toast(e.message, 'error'); }
  };
  applyBtn.addEventListener('click', load);
  await load();
}

function renderReportsResult(root, data) {
  root.innerHTML = '';
  root.append(el('div', { class: 'stat-grid' },
    el('div', { class: 'card stat' },
      el('div', { class: 'stat-value' }, data.total),
      el('div', { class: 'stat-label' }, 'Всего заявок за период')),
    el('div', { class: 'card stat' },
      el('div', { class: 'stat-value' }, data.avgCompletionHours != null ? data.avgCompletionHours + ' ч' : '—'),
      el('div', { class: 'stat-label' }, 'Среднее время выполнения')),
  ));

  const statusCard = el('div', { class: 'card' }, el('h3', {}, 'По статусам'));
  const total = data.total || 1;
  if (!data.byStatus.length) statusCard.append(el('p', { class: 'muted' }, 'Нет данных'));
  data.byStatus.forEach((s) => {
    const pct = Math.round((s.count / total) * 100);
    statusCard.append(el('div', { class: 'bar-row' },
      el('div', { class: 'bar-label' }, STATUS_LABELS[s.status] || s.status),
      el('div', { class: 'bar' }, el('div', { class: 'bar-fill ' + s.status, style: `width:${pct}%` })),
      el('div', { class: 'bar-value' }, `${s.count} (${pct}%)`),
    ));
  });
  root.append(statusCard);

  const dayCard = el('div', { class: 'card' }, el('h3', {}, 'По дням'));
  if (!data.byDay.length) dayCard.append(el('p', { class: 'muted' }, 'Нет данных'));
  const maxDay = Math.max(1, ...data.byDay.map(d => d.count));
  data.byDay.forEach((d) => {
    const pct = Math.round((d.count / maxDay) * 100);
    dayCard.append(el('div', { class: 'bar-row' },
      el('div', { class: 'bar-label' }, d.day),
      el('div', { class: 'bar' }, el('div', { class: 'bar-fill new', style: `width:${pct}%` })),
      el('div', { class: 'bar-value' }, `${d.count} (готово: ${d.done})`),
    ));
  });
  root.append(dayCard);

  const roomCard = el('div', { class: 'card' }, el('h3', {}, 'Топ комнат'));
  if (!data.byRoom.length) roomCard.append(el('p', { class: 'muted' }, 'Нет данных'));
  const maxRoom = Math.max(1, ...data.byRoom.map(r => r.count));
  data.byRoom.forEach((r) => {
    const pct = Math.round((r.count / maxRoom) * 100);
    roomCard.append(el('div', { class: 'bar-row' },
      el('div', { class: 'bar-label' }, r.room),
      el('div', { class: 'bar' }, el('div', { class: 'bar-fill in_progress', style: `width:${pct}%` })),
      el('div', { class: 'bar-value' }, r.count),
    ));
  });
  root.append(roomCard);
}

/* ---------- Профиль ---------- */
async function renderProfile(main) {
  main.innerHTML = '';
  const { user } = await API.get('/auth/me');
  state.user = user;
  API.setUser(user);

  main.append(el('h1', {}, 'Профиль'));
  const form = el('form', { class: 'card form' });
  form.innerHTML = `
    <label>ФИО <input name="full_name" value="${user.full_name}" /></label>
    <label>Email <input value="${user.email}" disabled /></label>
    <label>Телефон <input name="phone" value="${user.phone || ''}" /></label>
    <label class="checkbox">
      <input type="checkbox" name="notifications_enabled" ${user.notifications_enabled ? 'checked' : ''} />
      Получать уведомления по email
    </label>
    <button class="btn primary" type="submit">Сохранить</button>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const res = await API.patch('/auth/me', {
        full_name: fd.get('full_name'),
        phone: fd.get('phone'),
        notifications_enabled: fd.get('notifications_enabled') ? 1 : 0,
      });
      state.user = res.user;
      API.setUser(res.user);
      toast('Профиль сохранён', 'success');
      render();
    } catch (err) { toast(err.message, 'error'); }
  });
  main.append(form);
}

/* ---------- Bootstrap ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  if (!API.getToken()) { location.href = 'index.html'; return; }

  try {
    const { user } = await API.get('/auth/me');
    state.user = user;
    API.setUser(user);
  } catch { API.logout(); return; }

  document.getElementById('logout').addEventListener('click', () => API.logout());
  document.getElementById('notif-btn').addEventListener('click', showNotificationsModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });

  state.view = state.user.role === 'manager' ? 'reports' : 'dashboard';

  await refreshNotifications();
  setInterval(refreshNotifications, 30000);

  render();
});