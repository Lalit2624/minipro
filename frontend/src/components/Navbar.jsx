import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Camera, Shield, LogOut } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between shadow-lg">
      <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 text-xl font-bold">
        <Camera size={24} className="text-indigo-400" />
        <span>FaceFind</span>
      </Link>
      <div className="flex items-center gap-4">
        {user?.role === 'admin' && (
          <Link to="/admin" className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
            <Shield size={16} /> Admin
          </Link>
        )}
        {user ? (
          <button onClick={logout}
            className="flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors">
            <LogOut size={16} /> Logout
          </button>
        ) : (
          location.pathname !== '/' && (
            <Link to="/" className="text-sm bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors">
              Sign In
            </Link>
          )
        )}
      </div>
    </nav>
  );
}