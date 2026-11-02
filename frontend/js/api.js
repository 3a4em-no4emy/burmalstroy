const API = (() => {
  const TOKEN_KEY = 'bs_token';
  const USER_KEY = 'bs_user';

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
  const getUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } };
  const setUser = (u) => u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY);
  const logout = () => { setToken(null); setUser(null); location.href = 'index.html'; };

  async function request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch('/api' + url, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Ошибка ${res.status}`);
      err.status = res.status;
      err.fields = data && data.fields;
      throw err;
    }
    return data;
  }

  return {
    getToken, setToken, getUser, setUser, logout,
    get: (u) => request('GET', u),
    post: (u, b) => request('POST', u, b),
    patch: (u, b) => request('PATCH', u, b),
    del: (u) => request('DELETE', u),
  };
})();