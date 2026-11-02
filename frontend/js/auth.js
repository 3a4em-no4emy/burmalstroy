document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: fd.get('login'), password: fd.get('password') })
  });
  const data = await res.json();
  if (res.ok) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    location.href = 'app.html';
  } else {
    document.getElementById('error').textContent = data.error;
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: fd.get('login'), password: fd.get('password'),
      role: fd.get('role'), full_name: fd.get('full_name')
    })
  });
  const data = await res.json();
  if (res.ok) alert('Успешно! Теперь войдите.');
  else document.getElementById('error').textContent = data.error;
});