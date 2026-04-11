import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../context/AuthContext';
import { Camera, Search, Image as ImageIcon, AlertCircle, CheckCircle, Loader, Download, Video, X, ScanFace, Sparkles, Fingerprint, Mail } from 'lucide-react';

export default function UserPage() {
  const { user, API }    = useAuth();
  const [selfie,   setSelfie]   = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [results,  setResults]  = useState(null);
  const [error,    setError]    = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cursorRef = useRef(null);

  useEffect(() => {
    setIsVisible(true);
    
    const moveCursor = (e) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
    };
    window.addEventListener('mousemove', moveCursor);
    return () => window.removeEventListener('mousemove', moveCursor);
  }, []);

  const onDrop = useCallback(([file]) => {
    if (!file) return;
    setSelfie(file);
    setPreview(URL.createObjectURL(file));
    setResults(null);
    setSelectedMatches([]);
    setEmailSuccess('');
    setError('');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  const startCamera = async () => {
    setError('');
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setIsCameraOpen(false);
      setError('Camera access denied or unavailable.');
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  }, []);

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      // Mirror the image since webcams are usually mirrored
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'webcam-selfie.jpg', { type: 'image/jpeg' });
          setSelfie(file);
          setPreview(URL.createObjectURL(file));
          setResults(null);
          setError('');
          stopCamera();
        }
      }, 'image/jpeg', 0.9);
    }
  };

  useEffect(() => {
    if (isCameraOpen && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen]);

  const handleSearch = async () => {
    if (!selfie) return;
    setLoading(true);
    setError('');
    setEmailSuccess('');
    setResults(null);
    setSelectedMatches([]);
    const formData = new FormData();
    formData.append('selfie', selfie);
    try {
      const { data } = await API.post('/user/find-matches', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id) => {
    setSelectedMatches(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleSendEmail = async () => {
    if (!selectedMatches.length || !user?.email) return;
    setSendingEmail(true);
    setEmailSuccess('');
    setError('');
    
    try {
      await API.post('/user/send-email', {
        email: user.email,
        mediaIds: selectedMatches
      });
      setEmailSuccess('Assets successfully dispatched to your email!');
      setSelectedMatches([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-white p-6 pb-24 overflow-x-hidden font-sans">
      
      {/* Custom Trailing Cursor */}
      <div 
        ref={cursorRef} 
        className="fixed top-0 left-0 pointer-events-none z-[100] w-10 h-10 -ml-5 -mt-5 rounded-full border border-indigo-500/40 opacity-70 transition-transform duration-150 ease-out flex items-center justify-center mix-blend-screen hidden md:flex"
        style={{ transform: 'translate3d(-100px, -100px, 0)' }}
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
        .animate-blob { animation: blob 10s infinite ease-in-out; will-change: transform; }
        .animation-delay-2000 { animation-delay: 3s; }
        .animation-delay-4000 { animation-delay: 6s; }
        
        .glass-panel {
          background: rgba(17, 20, 28, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .animate-scan { animation: scanline 3s linear infinite; }
      `}</style>

      {/* Animated Background Orbs */}
      <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.15)_0,transparent_60%)] animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.1)_0,transparent_60%)] animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.15)_0,transparent_60%)] animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNHYtbmgtdi1oMjZ2MnEyNiB6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDIiLz48L2c+PC9zdmc+')] opacity-20"></div>
      </div>

      <div className={`relative z-10 max-w-4xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        
        {/* Ribbon */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-lg">
            <Sparkles size={16} className="text-purple-400 animate-pulse" />
            <span className="text-sm font-medium tracking-wide text-gray-300">Identity Resolution Scanner</span>
          </div>
        </div>

        {/* Hero Area */}
        <div className="text-center mb-12">
          <div className="relative w-24 h-24 mx-auto mb-6 group">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl shadow-[0_0_40px_rgba(79,70,229,0.5)] rotate-6 opacity-70 group-hover:rotate-12 transition-transform duration-500 blur-sm"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center border border-white/20 shadow-xl overflow-hidden transition-transform duration-500 group-hover:scale-105">
              <div className="absolute inset-0 bg-[linear-gradient(wrap,rgba(255,255,255,0.2)_0%,transparent_50%)]"></div>
              <ScanFace size={44} className="text-white drop-shadow-md" />
            </div>
          </div>
          <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-white via-gray-200 to-indigo-200 bg-clip-text text-transparent tracking-tight drop-shadow-sm">
            Find Yourself
          </h1>
          <p className="text-gray-400 text-lg max-w-lg mx-auto font-medium leading-relaxed">
            Provide a biometric layout (selfie) to scan the entire remote storage network using advanced AI encodings.
          </p>
        </div>

        {/* Upload Terminal */}
        <div className="glass-panel rounded-3xl p-8 lg:p-10 mb-10 transition-shadow hover:shadow-indigo-500/5">
          <div className="grid md:grid-cols-[1fr_300px] gap-10 items-center">
            
            {/* Dropzone/Selfie Input */}
            <div className={`relative border-2 border-dashed ${isDragActive && !isCameraOpen ? 'border-indigo-400 bg-indigo-900/20 scale-[1.01] shadow-2xl shadow-indigo-500/20' : 'border-gray-700 bg-black/20 hover:border-indigo-500/50 hover:bg-black/40'} rounded-2xl overflow-hidden transition-all duration-300 flex flex-col items-center justify-center min-h-[340px] group`}>
              
              {isCameraOpen ? (
                <div className="absolute inset-0 flex flex-col bg-black animate-fade-in z-20">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover bg-black transform -scale-x-100" />
                  
                  {/* Scanner UI overlay on camera */}
                  <div className="absolute inset-0 border-4 border-indigo-500/30 m-8 rounded-xl pointer-events-none">
                    <div className="absolute top-0 w-full h-[2px] bg-indigo-400 shadow-[0_0_15px_rgba(129,140,248,1)] animate-scan"></div>
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-400 rounded-tl"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-400 rounded-tr"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-400 rounded-bl"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-400 rounded-br"></div>
                  </div>

                  <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6 z-30 px-4">
                    <button onClick={stopCamera} className="bg-red-600/90 backdrop-blur-md hover:bg-red-500 text-white p-3.5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg border border-red-400/30">
                      <X size={24} />
                    </button>
                    <button onClick={capturePhoto} className="bg-white/90 backdrop-blur-md hover:bg-white text-indigo-900 p-4 px-10 rounded-full font-bold transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] active:scale-95 shadow-xl flex items-center justify-center gap-2 border border-white/50">
                       <Camera size={22} className="text-indigo-600" /> Snap Matrix
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col justify-between">
                  <div {...getRootProps()} className="flex-1 flex flex-col items-center justify-center cursor-pointer text-center rounded-xl p-6 relative">
                    <input {...getInputProps()} />
                    
                    {/* Animated dashed border glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-[1.5s]"></div>

                    {preview ? (
                      <div className="relative group/img animate-fade-in">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl transform group-hover/img:scale-110 transition-transform"></div>
                        <img src={preview} alt="Your selfie" className="relative w-48 h-48 object-cover rounded-full mx-auto border-4 border-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.3)] z-10" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-white/50 animate-spin z-20 mix-blend-overlay"></div>
                      </div>
                    ) : (
                      <>
                        <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110 group-hover:bg-indigo-500/20 border border-indigo-500/20">
                          <Camera size={36} className="text-indigo-400" />
                        </div>
                        <p className="text-gray-200 font-semibold tracking-wide text-lg">Drop facial scan here</p>
                        <p className="text-gray-500 text-sm mt-1 mb-2 font-medium">or click to browse local files</p>
                      </>
                    )}
                  </div>
                  
                  <div className="mt-2 p-4 border-t border-gray-800/80 bg-black/20 flex justify-center z-10">
                    <button onClick={startCamera} className="text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-semibold text-sm w-full shadow-inner hover:shadow-indigo-500/20">
                      <Video size={18} /> Enable Webcam Lens
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Side Instructions & Actions */}
            <div className="flex flex-col h-full justify-center space-y-6">
              <div>
                <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2"><Fingerprint size={18} className="text-indigo-400"/> Operational Flow</h3>
                <div className="space-y-4">
                  {[
                    { icon: '1', text: 'Provide clear face photo' },
                    { icon: '2', text: 'System analyzes geometries' },
                    { icon: '3', text: 'Global asset search' },
                    { icon: '4', text: 'Select and explicitly transfer via email' },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-gray-300 group">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold border border-indigo-500/30 group-hover:bg-indigo-500/40 transition-colors">
                        {step.icon}
                      </span>
                      <p className="text-sm font-medium">{step.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button onClick={handleSearch} disabled={!selfie || loading}
                  className="group relative w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-gray-500 disabled:border overflow-hidden disabled:border-indigo-900/50 py-4 rounded-xl font-bold transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] active:scale-[0.98] disabled:hover:transform-none disabled:shadow-none">
                  
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent hidden group-enabled:block"></div>
                  
                  {loading ? (
                    <span className="flex justify-center items-center gap-2 relative z-10 text-white">
                      <Loader size={20} className="animate-spin text-white" /> Executing Search…
                    </span>
                  ) : (
                    <span className="flex justify-center items-center gap-2 relative z-10 text-white">
                      <Search size={20} className="group-hover:rotate-12 transition-transform" /> Initialize Search
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 text-red-200 animate-fade-in backdrop-blur-md">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" /> 
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* Loading Modal State */}
        {loading && (
          <div className="glass-panel rounded-3xl p-12 text-center mb-10 overflow-hidden relative border-indigo-500/30 shadow-[0_0_50px_rgba(79,70,229,0.15)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-900 overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full w-1/3 animate-[shimmer_1s_infinite]"></div>
            </div>
            <div className="relative w-28 h-28 mx-auto mb-6">
              {/* Complex loading radar rings */}
              <div className="absolute inset-0 border-[3px] border-indigo-500/20 rounded-full" />
              <div className="absolute inset-2 border-[3px] border-t-indigo-500 border-l-indigo-500/50 border-r-transparent border-b-transparent rounded-full animate-spin" style={{animationDuration: '1.5s'}} />
              <div className="absolute inset-4 border-[3px] border-b-purple-500 border-r-purple-500/50 border-t-transparent border-l-transparent rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '2s'}} />
              
              <div className="absolute inset-0 m-auto flex items-center justify-center z-10 w-12 h-12 bg-gray-900 rounded-full border border-gray-800 shadow-lg">
                <Search size={24} className="text-indigo-400 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Scanning Global Database</h2>
            <p className="text-gray-400 mt-2 font-medium">Extracting 128-d biometric embeddings and calculating euclidean distances...</p>
          </div>
        )}

        {/* Results Panel */}
        {results && !loading && (
          <div className="glass-panel rounded-3xl p-8 mb-10 relative overflow-hidden animate-fade-in shadow-[0_0_50px_rgba(0,0,0,0.5)] border-t border-t-white/10">
            {/* Status gradient background splash depending on result */}
            <div className={`absolute top-0 left-0 w-full h-1/2 opacity-20 filter blur-[80px] rounded-full mix-blend-screen pointer-events-none ${results.matchCount > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
            
            <div className="relative z-10 flex items-center gap-4 mb-8">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-lg ${
                results.matchCount > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'
              }`}>
                {results.matchCount > 0 ? (
                  <CheckCircle size={30} className="text-green-400 drop-shadow-md" />
                ) : (
                  <AlertCircle size={30} className="text-yellow-400 drop-shadow-md" />
                )}
              </div>
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">
                  {results.matchCount > 0
                    ? `Identified ${results.matchCount} Asset${results.matchCount > 1 ? 's' : ''}`
                    : 'Target Unidentified'}
                </h2>
                <p className="text-gray-300 text-sm font-medium mt-1 tracking-wide">
                  {results.matchCount > 0
                    ? <span>Mission success. {selectedMatches.length > 0 ? `Selected ${selectedMatches.length} asset(s) ready to transfer securely to ` : 'Only user selected images will be sent to '}<b>{user?.email}</b>.</span>
                    : 'No facial embeddings matched inside the network vaults. Please acquire a higher resolution scan.'}
                </p>
              </div>
            </div>

{results.matchCount > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 relative z-10">
                {results.matches.map((item, index) => {
                  const isSelected = selectedMatches.includes(item._id);
                  return (
                    <div 
                      key={item._id} 
                      onClick={() => toggleSelection(item._id)}
                      className={`relative group rounded-xl overflow-hidden cursor-pointer bg-black/40 border-2 transition duration-300 transform hover:-translate-y-1 ${
                        isSelected ? 'border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'border-gray-800 hover:border-gray-600 shadow-xl'
                      }`}
                      style={{ animation: `slideUpFade ${0.4 + (Math.min(index, 15) * 0.04)}s ease-out forwards` }}
                    >
                      <div className="aspect-[4/5] overflow-hidden bg-gray-900/50">
                        {item.resourceType === 'image' ? (
                          <img src={item.secureUrl} loading="lazy" decoding="async" alt="Matched face" className="w-full h-full object-cover transition duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100" />
                        ) : (
                          <div className="relative w-full h-full">
                            <video src={`${item.secureUrl}#t=0.1`} preload="metadata" muted playsInline className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition duration-500 group-hover:bg-black/20">
                              <div className="bg-white/20 p-3 rounded-full border border-white/20 transform transition duration-500 group-hover:scale-110">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Checkbox overlay */}
                      <div className="absolute top-3 left-3 z-20">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors border shadow-lg ${isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-black/50 border-white/50 text-transparent hover:border-white'}`}>
                          <CheckCircle size={16} />
                        </div>
                      </div>

                      {/* Top Security Badge */}
                      <div className="absolute top-3 right-3">
                         <span className="text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg bg-green-600 text-white flex items-center gap-1 border border-green-500">
                          <CheckCircle size={10} /> POSITIVE ID
                        </span>
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
                        <div className="w-full flex justify-between gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                          <a href={item.secureUrl} target="_blank" rel="noreferrer"
                            className="flex-1 bg-black/60 hover:bg-black/80 text-white text-xs font-semibold py-2.5 rounded-xl border border-white/20 transition-colors flex justify-center items-center gap-1.5 shadow-lg active:scale-95">
                            <ImageIcon size={14} /> Full View
                          </a>
                          <a href={item.secureUrl.replace('/upload/', '/upload/fl_attachment/')} download
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl border border-indigo-400/30 transition-colors flex justify-center items-center gap-1.5 shadow-[0_0_15px_rgba(79,70,229,0.5)] active:scale-95">
                            <Download size={14} /> Save local
                          </a>
                        </div>
                      </div>
                    </div>
                )})}
              </div>
            )}

            {results.matchCount > 0 && selectedMatches.length > 0 && (
              <div className="mt-10 pt-6 border-t border-white/10 flex flex-col items-center animate-fade-in relative z-10">
                <button onClick={handleSendEmail} disabled={sendingEmail} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all transform hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] active:scale-95 disabled:scale-100 disabled:opacity-70 disabled:hover:translate-y-0">
                  {sendingEmail ? <Loader size={20} className="animate-spin" /> : <Mail size={20} />}
                  {sendingEmail ? 'Executing Transfer...' : `Transfer ${selectedMatches.length} Asset${selectedMatches.length > 1 ? 's' : ''} to Email`}
                </button>
                {emailSuccess && (
                  <p className="text-green-400 text-sm mt-4 font-semibold flex items-center gap-2 animate-fade-in bg-green-500/10 px-4 py-2 border border-green-500/20 rounded-lg"><CheckCircle size={16}/>{emailSuccess}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}