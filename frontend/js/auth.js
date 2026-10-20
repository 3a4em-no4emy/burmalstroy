document.addEventListener('DOMContentLoaded', () => {
  if (API.getToken()) { location.href = 'app.html'; return; }

  const tabs = document.querySelectorAll('.tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.toggle('active', x === t));
    const name = t.dataset.tab;
    loginForm.classList.toggle('hidden', name !== 'login');
    registerForm.classList.toggle('hidden', name !== 'register');
  }));

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';
    const fd = new FormData(loginForm);
    try {
      const res = await API.post('/auth/login', {
        email: fd.get('email').trim(),
        password: fd.get('password'),
      });
      API.setToken(res.token);
      API.setUser(res.user);
      location.href = 'app.html';
    } catch (err) { errEl.textContent = err.message; }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('register-error');
    errEl.textContent = '';
    const fd = new FormData(registerForm);
    const body = {
      full_name: fd.get('full_name').trim(),
      email: fd.get('email').trim(),
      phone: fd.get('phone').trim(),
      role: fd.get('role'),
      password: fd.get('password'),
    };
    if (body.full_name.length < 3) { errEl.textContent = 'ФИО слишком короткое'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) { errEl.textContent = 'Некорректный email'; return; }
    if (body.password.length < 6) { errEl.textContent = 'Пароль минимум 6 символов'; return; }

    try {
      const res = await API.post('/auth/register', body);
      API.setToken(res.token);
      API.setUser(res.user);
      location.href = 'app.html';
    } catch (err) { errEl.textContent = err.message; }
  });
});