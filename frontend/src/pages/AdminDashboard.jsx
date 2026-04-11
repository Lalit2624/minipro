import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../context/AuthContext';
import { Upload, Image as ImageIcon, Video, CheckCircle, AlertCircle, RefreshCw, Users, Trash2, Shield, Database } from 'lucide-react';

export default function AdminDashboard() {
  const { API } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState(null);
  const [media, setMedia] = useState([]);
  const [stats, setStats] = useState({ total: 0, faces: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const cursorRef = useRef(null);

  const fetchMedia = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoadingMedia(true);
      const { data } = await API.get(`/admin/media?page=${pageNum}&limit=20`);

      if (append) {
        setMedia(prev => {
          // Filter duplicates on strict mode
          const newMedia = data.media.filter(m => !prev.some(p => p._id === m._id));
          return [...prev, ...newMedia];
        });
      } else {
        setMedia(data.media);
        if (pageNum === 1) setSelectedMedia([]);
      }

      setStats({ total: data.totalMedia, faces: data.totalFaces });
      setHasMore(pageNum < data.totalPages);
      setPage(pageNum);
    } catch { } finally {
      if (pageNum === 1) setLoadingMedia(false);
    }
  }, [API]);

  useEffect(() => {
    setIsVisible(true);
    fetchMedia(1, false);

    // Smooth Custom Cursor logic
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
  }, [fetchMedia]);

  const onDrop = useCallback(accepted => {
    setFiles(prev => {
      const initialLength = prev.length;
      const augmented = accepted.map((f, i) => {
        // Prevent memory crashes by only buffering 24 items in RAM
        if (initialLength + i < 24) return Object.assign(f, { preview: URL.createObjectURL(f) });
        return f;
      });
      return [...prev, ...augmented];
    });
    setMessage(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'video/*': [] },
    multiple: true,
  });

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setMessage(null);
    setUploadProgress(1); // 1% bootstrap

    const BATCH_SIZE = 50; 
    const totalFiles = files.length;
    let successCount = 0;
    
    try {
      for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const formData = new FormData();
        batch.forEach(f => formData.append('files', f));
        
        await API.post('/admin/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        successCount += batch.length;
        setUploadProgress(Math.floor((successCount / totalFiles) * 100));
      }
      
      setMessage({ type: 'success', text: `Successfully transmitted ${successCount} assets.` });
      setFiles([]);
      setTimeout(() => fetchMedia(1, false), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || `Bulk upload interrupted after ${successCount} files.` });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this media?')) return;
    try {
      const { data } = await API.delete('/admin/media/' + id);
      setMessage({ type: 'success', text: data.message });
      fetchMedia(1, false);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Delete failed' });
    }
  };

  const toggleSelection = (id) => {
    setSelectedMedia(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedMedia.length === media.length) setSelectedMedia([]);
    else setSelectedMedia(media.map(m => m._id));
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedMedia.length} selected media items permanently?`)) return;
    try {
      const { data } = await API.post('/admin/mass-delete', { mediaIds: selectedMedia });
      setMessage({ type: 'success', text: data.message });
      setSelectedMedia([]);
      fetchMedia(1, false);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Bulk delete failed' });
    }
  };


  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-white p-6 pb-24 overflow-x-hidden font-sans">

      {/* Custom Trailing Cursor */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[100] w-10 h-10 -ml-5 -mt-5 rounded-full border border-indigo-500/40 opacity-70 transition-transform duration-75 ease-out flex items-center justify-center mix-blend-screen hidden md:flex"
        style={{ transform: 'translate3d(-100px, -100px, 0)', willChange: 'transform' }}
      >
        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-[0_0_15px_rgba(99,102,241,1)]"></div>
      </div>

      {/* Background Scope & Animations */}
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
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        
        .glass-stat {
          background: linear-gradient(145deg, rgba(30,35,45,0.85) 0%, rgba(20,25,35,0.7) 100%);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
        }
      `}</style>

      {/* Animated Background Orbs */}
      <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 -left-10 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.15)_0,transparent_60%)] animate-blob"></div>
        <div className="absolute top-1/2 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.1)_0,transparent_60%)] animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.15)_0,transparent_60%)] animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNHYtbmgtdi1oMjZ2MnEyNiB6IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDIiLz48L2c+PC9zdmc+')] opacity-20"></div>
      </div>

      <div className={`relative z-10 max-w-6xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

        {/* Header Ribbon */}
        <div className="flex items-center gap-3 mb-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Shield size={20} className="text-white" />
          </div>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent tracking-tight">
            Central Command
          </h1>
        </div>
        <p className="text-gray-400 mb-8 ml-1 font-medium tracking-wide">Manage media processing, encodings, and network assets</p>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div className="glass-stat rounded-2xl p-6 hover:-translate-y-1 hover:shadow-indigo-500/10 transition-all duration-300 group">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
                <ImageIcon size={28} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-4xl font-black text-white">{stats.total}</p>
                <p className="text-gray-400 text-sm font-semibold tracking-wider uppercase mt-1">Files Indexed</p>
              </div>
            </div>
          </div>
          <div className="glass-stat rounded-2xl p-6 hover:-translate-y-1 hover:shadow-green-500/10 transition-all duration-300 group">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20 group-hover:scale-110 transition-transform duration-300">
                <Users size={28} className="text-green-400" />
              </div>
              <div>
                <p className="text-4xl font-black text-white">{stats.faces}</p>
                <p className="text-gray-400 text-sm font-semibold tracking-wider uppercase mt-1">Faces Encoded</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Terminal */}
        <div className="glass-panel rounded-3xl p-8 mb-8 transition-shadow hover:shadow-indigo-500/5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Database size={20} className="text-indigo-400" /> Media Intake
            </h2>
          </div>

          <div {...getRootProps()}
            className={`relative overflow-hidden border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-300 group ${isDragActive ? 'border-indigo-400 bg-indigo-900/20 scale-[1.01] shadow-2xl shadow-indigo-500/20' : 'border-gray-700 bg-black/20 hover:border-indigo-500/50 hover:bg-black/40'
              }`}>
            <input {...getInputProps()} />
            <div className={`transition-transform duration-500 ${isDragActive ? '-translate-y-2' : 'group-hover:-translate-y-1'}`}>
              <Upload size={48} className={`mx-auto mb-4 transition-colors duration-300 ${isDragActive ? 'text-indigo-400 animate-bounce' : 'text-gray-500 group-hover:text-indigo-400'}`} />
              <p className="text-xl font-semibold text-gray-200">
                {isDragActive ? 'Release to begin upload...' : 'Deploy media assets here'}
              </p>
              <p className="text-gray-500 text-sm mt-2 font-medium">Support for high-res JPG, PNG, MP4, MOV</p>
            </div>

            {/* Animated dashed border glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          </div>

          {/* Staging preview */}
          {files.length > 0 && (
            <div className="mt-6 border-t border-gray-800 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Database size={14} className="text-gray-500" /> Staging Queue ({files.length})
                </h3>
              </div>

              {uploading && uploadProgress > 0 && (
                <div className="mb-6 animate-entrance">
                  <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden border border-gray-700 relative shadow-inner">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-500 h-full transition-all duration-300 ease-out absolute left-0 top-0 shadow-[0_0_10px_rgba(79,70,229,0.8)]" style={{ width: `${uploadProgress}%` }}>
                        <div className="w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:15px_15px] animate-[shimmer_1s_infinite_linear]"></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs mt-2 px-1">
                    <span className="text-gray-400 flex items-center gap-1"><RefreshCw size={12} className="animate-spin text-indigo-400" /> Encrypting & Trasmitting...</span>
                    <span className="text-indigo-300 font-bold tracking-wider">{uploadProgress}% <span className="text-gray-500 ml-1">({Math.floor((uploadProgress/100)*files.length)} / {files.length})</span></span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {files.slice(0, 24).map((f, i) => (
                  <div key={i} className="relative aspect-square bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700 group/item transition-all hover:border-indigo-500/50">
                    {f.preview && f.type.startsWith('image/') ? (
                      <img src={f.preview} alt="preview" className="w-full h-full object-cover opacity-80 group-hover/item:opacity-100 transition-opacity" />
                    ) : f.preview && f.type.startsWith('video/') ? (
                      <div className="relative w-full h-full bg-black">
                        <video src={f.preview} className="w-full h-full object-cover opacity-60" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Video size={24} className="text-white/80 drop-shadow-lg" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center opacity-70 bg-gray-900 border border-gray-800">
                        <ImageIcon size={20} className="text-gray-500 mb-1" />
                        <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider truncate w-3/4 text-center">{f.name.slice(-4)}</span>
                      </div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, j) => j !== i)); }}
                      className="absolute top-1 right-1 bg-red-600/90 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:bg-red-500 transition-all shadow-lg transform scale-90 hover:scale-100">×</button>
                  </div>
                ))}
                
                {files.length > 24 && (
                  <div className="relative aspect-square bg-gradient-to-br from-indigo-900/30 to-purple-900/20 rounded-xl overflow-hidden border border-indigo-500/30 flex items-center justify-center group cursor-default">
                    <div className="absolute inset-0 bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors"></div>
                    <span className="text-2xl font-black text-indigo-300 drop-shadow-md">+{files.length - 24}</span>
                    <span className="absolute bottom-2 text-[10px] uppercase font-bold text-indigo-400 tracking-widest text-center w-full">Queued</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {message && (
            <div className={`mt-5 p-4 rounded-xl flex items-center gap-3 backdrop-blur-md border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}>
              {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span className="font-medium text-sm">{message.text}</span>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button onClick={handleUpload} disabled={!files.length || uploading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-gray-500 disabled:border overflow-hidden disabled:border-indigo-900/50 text-white px-8 py-3 rounded-xl font-bold transition-all duration-300 flex items-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] active:scale-95 disabled:hover:transform-none disabled:shadow-none group relative">
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent hidden group-enabled:block"></div>
              {uploading ? <><RefreshCw size={18} className="animate-spin" /> Transmitting…</> : <><Upload size={18} /> Push to Server</>}
            </button>
          </div>
        </div>

        {/* Vault Library */}
        <div className="glass-panel rounded-3xl p-8 shadow-xl shadow-black/50 relative">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              Asset Vault <span className="bg-white/10 text-xs px-3 py-1 rounded-full text-indigo-300 font-semibold">{stats.total} Items</span>
            </h2>
            <div className="flex items-center gap-3">
              {media.length > 0 && (
                <button onClick={selectAll} className="text-sm text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-colors border border-white/5">
                  {selectedMedia.length === media.length ? 'Deselect All' : 'Select Visible'}
                </button>
              )}
              {selectedMedia.length > 0 && (
                <button onClick={handleBulkDelete} className="flex items-center gap-2 text-sm text-white bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg transition-colors shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                  <Trash2 size={16} /> Delete ({selectedMedia.length})
                </button>
              )}
              <button onClick={() => fetchMedia(1, false)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-colors border border-white/5">
                <RefreshCw size={16} /> Sync
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {media.map((item, index) => (
              <div key={item._id} className="relative group bg-black/40 rounded-2xl overflow-hidden border border-gray-800 hover:border-indigo-500/50 hover:-translate-y-2 hover:shadow-[0_15px_30px_-5px_rgba(79,70,229,0.3)] transition duration-500" style={{ animation: `slideUpFade ${0.4 + (Math.min(index, 20) * 0.04)}s ease-out forwards` }}>

                <div className="aspect-[4/5] relative overflow-hidden bg-gray-900/50">
                  {item.resourceType === 'image' ? (
                    <img src={item.secureUrl} loading="lazy" decoding="async" alt="" className="w-full h-full object-cover transition duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100" />
                  ) : (
                    <div className="relative w-full h-full">
                      <video src={`${item.secureUrl}#t=0.1`} preload="metadata" muted playsInline className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition duration-500 group-hover:bg-black/20">
                        <div className="bg-white/20 p-3 rounded-full border border-white/20 transform transition duration-500 group-hover:scale-110">
                          <Video size={24} className="text-white" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top Overlay Badge & Checkbox */}
                  <div className="absolute top-3 left-3 flex gap-2 z-10">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg ${item.processed ? 'bg-green-600 text-white' : 'bg-yellow-500 text-black'
                      }`}>
                      {item.processed ? `${item.faceCount} FACES` : 'ANALYZING'}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 z-10">
                    <div
                      onClick={() => toggleSelection(item._id)}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors shadow-lg ${selectedMedia.includes(item._id) ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black/60 border-white/50 text-transparent hover:border-white'
                        }`}
                    >
                      <CheckCircle size={14} className={selectedMedia.includes(item._id) ? "opacity-100" : "opacity-0"} strokeWidth={3} />
                    </div>
                  </div>

                  {/* Hover Delete Action */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                    <button onClick={() => handleDelete(item._id)} className="translate-y-4 group-hover:translate-y-0 bg-red-600 hover:bg-red-500 text-white p-2.5 rounded-full shadow-lg transition duration-300 active:scale-95">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {item.processingError && (
                  <div className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-xs p-2 font-medium truncate border-t border-red-500">
                    ⚠ {item.processingError}
                  </div>
                )}
              </div>
            ))}

            {media.length === 0 && !loadingMedia && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-500 bg-white/5 rounded-2xl border border-dashed border-gray-700">
                <Database size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium text-gray-400">Vault is Empty</p>
                <p className="text-sm">Deploy media assets above to populate the database.</p>
              </div>
            )}

            {hasMore && (
              <div className="col-span-full mt-8 flex justify-center pb-4">
                <button
                  onClick={() => fetchMedia(page + 1, true)}
                  className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 px-8 py-3 rounded-full font-semibold transition-all border border-indigo-500/30 flex items-center gap-2 shadow-lg"
                >
                  <RefreshCw size={18} /> Load More Assets
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}