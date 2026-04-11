import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Lock, Mail, AlertCircle, User as UserIcon, Sparkles, ChevronRight, KeyRound, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [otp,      setOtp]      = useState('');
  const [showOtp,  setShowOtp]  = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  const { login, userLogin, requestOtpLogin, verifyOtp, googleLogin } = useAuth();
  const navigate  = useNavigate();
  const cursorRef = useRef(null);

  // Trigger entrance animation on mount and init custom cursor
  useEffect(() => {
    setIsVisible(true);
    
    let requestRef;
    const moveCursor = (e) => {
      if (requestRef) cancelAnimationFrame(requestRef);
      requestRef = requestAnimationFrame(() => {
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        }
      });
    };
    window.addEventListener('mousemove', moveCursor, { passive: true });
    return () => {
      window.removeEventListener('mousemove', moveCursor);
      if (requestRef) cancelAnimationFrame(requestRef);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid, fully formatted email address.');
      return;
    }

    setLoading(true);
    try {
      if (isAdminMode) {
        await login(email, password);
        navigate('/admin');
      } else {
        const res = await userLogin(email, password);
        if (res?.requires_otp) {
          setShowOtp(true);
          setError('');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(email, otp);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setError('');
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address first to use email login.');
      return;
    }
    setLoading(true);
    try {
      await requestOtpLogin(email);
      setShowOtp(true);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4 overflow-hidden font-sans">
      
      {/* Custom Trailing Cursor */}
      <div 
        ref={cursorRef} 
        className="fixed top-0 left-0 pointer-events-none z-[100] w-10 h-10 -ml-5 -mt-5 rounded-full border border-indigo-500/40 opacity-70 transition-transform duration-75 ease-out flex items-center justify-center mix-blend-screen hidden md:flex"
        style={{ transform: 'translate3d(-100px, -100px, 0)', willChange: 'transform' }}
      >
        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-[0_0_15px_rgba(99,102,241,1)]"></div>
      </div>
      
      {/* Scope-contained custom animations */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 8s infinite ease-in-out; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        
        .glass-card {
          background: rgba(17, 20, 28, 0.7);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-entrance {
          animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Animated Background Orbs */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none flex justify-center items-center">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/30 rounded-full mix-blend-screen filter blur-[80px] animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full mix-blend-screen filter blur-[80px] animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000"></div>
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNHYtbmgtdi1oMjZ2MnEyNiB6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDIiLz48L2c+PC9zdmc+')] opacity-20"></div>
      </div>

      {/* Main Login Container */}
      <div 
        className={`relative z-10 w-full max-w-[420px] transition-all duration-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        
        {/* Header Ribbon */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-lg">
            <Sparkles size={16} className="text-indigo-400 animate-pulse" />
            <span className="text-sm font-medium tracking-wide text-gray-300">FaceFind Intelligence</span>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-8 sm:p-10 transition-all duration-500 hover:shadow-indigo-500/10">
          
          {/* Animated Toggle Control */}
          {!showOtp && (
            <div className="relative flex bg-black/40 rounded-xl p-1.5 mb-10 border border-white/5 shadow-inner">
              <div 
                className={`absolute top-1.5 left-1.5 bottom-1.5 w-[calc(50%-6px)] bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg shadow-lg transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
                  isAdminMode ? 'translate-x-full' : 'translate-x-0'
                }`}
              />
              <button
                onClick={() => setIsAdminMode(false)}
                className={`relative z-10 flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors duration-300 ${
                  !isAdminMode ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                User Login
              </button>
              <button
                onClick={() => setIsAdminMode(true)}
                className={`relative z-10 flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors duration-300 ${
                  isAdminMode ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Admin Access
              </button>
            </div>
          )}

          <div className="text-center mb-8">
            <div className={`relative w-20 h-20 mx-auto mb-5 transition-transform duration-700 ${isAdminMode ? 'rotate-y-180' : ''}`}>
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl shadow-[0_0_30px_rgba(79,70,229,0.4)] rotate-3 opacity-70 group-hover:rotate-6 transition-transform blur-sm"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center border border-white/20 shadow-xl overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(wrap,rgba(255,255,255,0.2)_0%,transparent_50%)]"></div>
                {isAdminMode ? (
                  <Lock size={36} className="text-white drop-shadow-md" />
                ) : (
                  <UserIcon size={36} className="text-white drop-shadow-md" />
                )}
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
              {isAdminMode ? 'Admin Portal' : (showOtp ? 'Verify Email' : 'Welcome Back')}
            </h1>
            <p className="text-gray-400 text-sm">
              {isAdminMode ? 'Authenticate to manage database' : (showOtp ? 'Enter the 6-digit code sent to your email' : 'Sign in to discover your photos')}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 mb-6 text-red-200 animate-entrance">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" /> 
              <span className="text-sm font-medium leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={showOtp ? handleOtpSubmit : handleSubmit} className="space-y-5">
            {!showOtp ? (
              <>
                <div className="space-y-1.5 group">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest pl-1 group-focus-within:text-indigo-400 transition-colors">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail size={18} className="text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                    </div>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-black/30 border border-gray-700/50 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium hover:border-gray-600 shadow-inner"
                      placeholder={isAdminMode ? "admin@example.com" : "name@domain.com"} 
                      required 
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="transition-all duration-500 overflow-hidden max-h-24 opacity-100 mt-5">
                  <div className="space-y-1.5 group">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest pl-1 group-focus-within:text-indigo-400 transition-colors">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock size={18} className="text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                      </div>
                      <input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-black/30 border border-gray-700/50 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium hover:border-gray-600 shadow-inner"
                        placeholder="••••••••" 
                        required 
                      />
                    </div>
                  </div>
                </div>

                {!isAdminMode && (
                  <div className="flex justify-end mt-2 animate-entrance" style={{ animationDelay: '0.05s' }}>
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Login with Email OTP instead
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-1.5 group animate-entrance">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest pl-1 group-focus-within:text-indigo-400 transition-colors">
                  Verification Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound size={18} className="text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <input 
                    type="text" 
                    value={otp} 
                    onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    maxLength={6}
                    className="w-full bg-black/30 border border-gray-700/50 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium hover:border-gray-600 shadow-inner text-center tracking-[0.5em] text-lg font-mono"
                    placeholder="000000" 
                    required 
                  />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || (!showOtp ? (!email || !password) : (!otp || otp.length !== 6))}
              className="group relative w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:opacity-70 text-white py-3.5 rounded-xl font-bold transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] active:scale-[0.98] mt-6 overflow-hidden flex items-center justify-center"
            >
              {/* Button inner shine effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {showOtp ? 'Verify & Continue' : (isAdminMode ? 'Secure Sign In' : 'Continue into Portal')}
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
            {!showOtp && !isAdminMode && (
              <div className="animate-entrance" style={{ animationDelay: '0.1s' }}>
                <div className="relative flex py-3 items-center">
                  <div className="flex-grow border-t border-gray-700/50"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">Or</span>
                  <div className="flex-grow border-t border-gray-700/50"></div>
                </div>
                <div className="w-full flex justify-center [&>div]:w-full [&>div>div]:!w-full mt-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
                  <GoogleLogin
                    onSuccess={async (credentialResponse) => {
                      setLoading(true);
                      try {
                        await googleLogin(credentialResponse.credential);
                        navigate('/dashboard');
                      } catch (err) {
                        setError(err.response?.data?.message || 'Google authentication failed.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    onError={() => {
                      setError('Google authentication failed.');
                    }}
                    useOneTap
                    type="standard"
                    theme="outline"
                    size="large"
                    text="continue_with"
                    shape="pill"
                  />
                </div>
              </div>
            )}
            {showOtp && (
              <button
                type="button"
                onClick={() => setShowOtp(false)}
                className="w-full mt-4 py-2 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors animate-entrance"
              >
                <ArrowLeft size={16} />
                Back to Login
              </button>
            )}
          </form>
          
        </div>
        
        {/* Footer info */}
        <p className="text-center text-gray-500 text-xs mt-8">
          Protected by AES-256 encryption & advanced biometric security
        </p>
      </div>

    </div>
  );
}