import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('sf_token'));
  const [loading, setLoading] = useState(true);

  const authHeaders = useCallback(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  useEffect(() => {
    if (token) {
      axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => { setUser(res.data); setLoading(false); })
        .catch(() => { localStorage.removeItem('sf_token'); setToken(null); setUser(null); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem('sf_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (name, email, password, role) => {
    const res = await axios.post(`${API}/auth/register`, { name, email, password, role });
    localStorage.setItem('sf_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('sf_token');
    setToken(null);
    setUser(null);
  };

  const api = useCallback((method, path, data) => {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    if (method === 'get') return axios.get(`${API}${path}`, config);
    if (method === 'post') return axios.post(`${API}${path}`, data, config);
    if (method === 'patch') return axios.patch(`${API}${path}`, data, config);
    if (method === 'delete') return axios.delete(`${API}${path}`, config);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, api, authHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
