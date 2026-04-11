import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api' });
API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      API.get('/auth/me')
        .then(r => setUser(r.data.user))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const userLogin = async (email, password) => {
    const { data } = await API.post('/auth/user-login', { email, password });
    if (data.requires_otp) {
      return data;
    }
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const requestOtpLogin = async (email) => {
    const { data } = await API.post('/auth/request-otp', { email });
    return data;
  };

  const verifyOtp = async (email, otp) => {
    const { data } = await API.post('/auth/verify-otp', { email, otp });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const googleLogin = async (token) => {
    const { data } = await API.post('/auth/google-login', { token });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, userLogin, requestOtpLogin, verifyOtp, googleLogin, logout, API }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}