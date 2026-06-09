import { useState, useEffect } from 'react';
import { Search, GraduationCap, Building, Loader2, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Send, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

export default function App() {
  const [participantCode, setParticipantCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Message State
  const [message, setMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [messageError, setMessageError] = useState('');

  const [publicMessages, setPublicMessages] = useState<any[]>([]);
  const [showMessages, setShowMessages] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch('/api/messages');
        const data = await res.json();
        if (data.success && data.data) {
          setPublicMessages(data.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantCode.trim()) {
      setError('Silakan masukkan nomor formulir Anda.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setMessage('');
    setMessageSent(false);
    setMessageError('');

    try {
      // Add a slight artificial delay for the elegant loading animation
      const [response] = await Promise.all([
        fetch(`/api/check-status?nomor=${encodeURIComponent(participantCode.trim())}`),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);
      
      const data = await response.json();

      if (response.ok) {
        if (data.found) {
          setResult(data.data);
          const statusKey = Object.keys(data.data).find(k => {
            const lower = k.toLowerCase();
            return lower.includes('status') || lower.includes('keterangan') || lower.includes('kelulusan');
          });
          const statusValue = statusKey ? data.data[statusKey] : '';
          
          if (isLulus(statusValue) && !isTidakLulus(statusValue)) {
            triggerConfetti();
          }
        } else {
          setResult({ notFound: true });
        }
        setHasSearched(true);
      } else {
        setError(data.error || 'Gagal memuat data. Coba lagi.');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan. Periksa koneksi Anda.');
    } finally {
      setLoading(false);
    }
  };

  const isLulus = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('tidak lulus') || s.includes('gagal') || s.includes('ditolak')) return false;
    return s.includes('lulus') || s.includes('diterima') || s.includes('masuk') || s.includes('lusus');
  };

  const isTidakLulus = (status: string) => {
    const s = status?.toLowerCase() || '';
    return s.includes('tidak lulus') || s.includes('gagal') || s.includes('ditolak');
  };

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults, particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults, particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setMessageError('Pesan tidak boleh kosong.');
      return;
    }

    setSendingMessage(true);
    setMessageError('');

    try {
      const namaKey = result ? Object.keys(result).find(k => k.toLowerCase().includes('nama')) : null;
      const nama = namaKey ? result[namaKey] : 'Anonim';
      
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomor: participantCode,
          nama: nama,
          pesan: message
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessageSent(true);
        setMessage('');
      } else {
        setMessageError(data.error || 'Gagal mengirim pesan.');
      }
    } catch (err) {
      setMessageError('Terjadi kesalahan jaringan.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleReset = () => {
    setHasSearched(false);
    setResult(null);
    setParticipantCode('');
    setMessage('');
    setMessageSent(false);
    setMessageError('');
  };

  const renderMessageForm = () => {
    return (
      <div className="mt-6 border-t border-gray-100 pt-6">
        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Tinggalkan Pesan (Opsional)</h4>
        
        {messageSent ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-2xl border border-green-100 mb-6"
          >
            <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
            <p className="text-green-800 font-medium text-sm">Terima kasih, pesan Anda berhasil dikirim!</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSendMessage} className="space-y-3 mb-6">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tulis pesan (kesan, pertanyaan, atau tanggapan) Anda di sini..."
              className="w-full p-4 bg-gray-50/50 border border-gray-200 rounded-2xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none min-h-[100px]"
            />
            {messageError && (
              <p className="text-xs text-red-500 font-medium">{messageError}</p>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sendingMessage || !message.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl text-sm transition-all shadow-sm"
              >
                {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Kirim Pesan
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  const renderResultData = () => {
    if (!result || result.notFound) return null;

    const displayData = Object.entries(result).filter(([key, value]) => {
      const lowerKey = key.toLowerCase();
      return key.trim() !== '' && value && !lowerKey.includes('status') && !lowerKey.includes('keterangan') && !lowerKey.includes('kelulusan');
    });
    
    // Find status value flexibly
    const statusKey = Object.keys(result).find(k => {
      const lower = k.toLowerCase();
      return lower.includes('status') || lower.includes('keterangan') || lower.includes('kelulusan');
    });
    const statusValue = statusKey ? String(result[statusKey]) : 'Tidak Diketahui';

    if (isLulus(statusValue)) {
      // SUCCESS STATE - MERIAH
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="bg-white rounded-[2rem] shadow-2xl p-6 md:p-8 relative overflow-hidden text-center ring-4 ring-green-100 ring-offset-4 ring-offset-green-50"
        >
          {/* Festive Background Layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-emerald-100/50 to-teal-50 opacity-80"></div>
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-40">
             <div className="absolute top-[-10%] left-[-10%] w-32 h-32 bg-green-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-32 h-32 bg-teal-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
          
          <div className="relative z-10 flex flex-col items-center">
            <motion.div 
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", damping: 12, delay: 0.1 }}
              className="relative w-20 h-20 mb-4"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full shadow-lg shadow-green-300/50 animate-pulse"></div>
              <div className="absolute inset-2 bg-gradient-to-br from-green-300 to-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-white drop-shadow-md" strokeWidth={2.5} />
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 mb-2 tracking-tight drop-shadow-sm">
                SELAMAT!
              </h2>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-100 text-green-700 font-bold text-xs md:text-sm tracking-widest uppercase mb-4 shadow-sm border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Anda Dinyatakan Lulus
              </div>
            </motion.div>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-gray-600 mb-5 font-medium text-base leading-relaxed max-w-md"
            >
              Selamat bergabung di keluarga besar <br className="hidden sm:block"/>
              <strong className="text-gray-800">SMA Negeri 1 Wamena</strong>!
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="w-full bg-white/90 backdrop-blur-md border-2 border-green-100/60 rounded-3xl p-5 md:p-6 text-left shadow-lg shadow-green-900/5 mb-5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-green-100 to-transparent opacity-50 rounded-bl-full pointer-events-none"></div>
              
              <div className="relative z-10 space-y-3">
                {displayData.map(([key, value]) => (
                  <div key={key} className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-gray-100/50 last:border-0 last:pb-0">
                    <span className="text-xs font-bold text-emerald-600/80 uppercase tracking-widest mb-1 sm:mb-0 flex items-center">
                      {key}
                    </span>
                    <span className="text-base font-bold text-gray-800 sm:text-right">
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
              
              {renderMessageForm()}
            </motion.div>

            <motion.button 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 font-bold rounded-xl transition-all shadow-xl shadow-green-200 hover:shadow-green-300 hover:-translate-y-0.5"
            >
              <ArrowLeft className="w-5 h-5" />
              Kembali ke Pencarian
            </motion.button>
          </div>
        </motion.div>
      );
    } 

    if (isTidakLulus(statusValue)) {
      // FAILURE STATE - TETAP SEMANGAT
      return (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2rem] shadow-xl p-6 md:p-8 relative overflow-hidden border border-rose-100 text-center ring-4 ring-rose-50 ring-offset-4 ring-offset-white"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-rose-50/80 via-orange-50/50 to-pink-50/80 opacity-90"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="relative w-20 h-20 mb-4"
            >
               <div className="absolute inset-0 bg-rose-200 rounded-full animate-pulse opacity-50"></div>
               <div className="absolute inset-2 bg-rose-100 rounded-full flex items-center justify-center shadow-inner">
                  <XCircle className="w-8 h-8 text-rose-500" />
               </div>
            </motion.div>
            
            <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-orange-500 mb-2 tracking-tight">
              TETAP SEMANGAT!
            </h2>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 text-rose-700 font-bold text-xs md:text-sm tracking-wide mb-4 shadow-sm border border-rose-100">
               <span className="w-2 h-2 rounded-full bg-rose-500"></span>
               Status: Tidak Lulus
            </div>

            <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.3 }}
               className="max-w-md mx-auto aspect-auto bg-white/70 backdrop-blur p-4 rounded-2xl border border-rose-100/50 mb-5 shadow-sm relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-rose-400 to-orange-400"></div>
              <p className="text-gray-600 leading-relaxed font-medium text-sm">
                "Jangan berkecil hati. Kegagalan di satu pintu berarti ada pintu lain yang lebih baik sedang menunggumu. Perjalananmu masih sangat panjang, teruslah belajar dan pantang menyerah!"
              </p>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.4 }}
               className="w-full bg-white/90 backdrop-blur-md border border-gray-100/80 rounded-2xl p-5 md:p-6 text-left shadow-sm mb-5 space-y-3"
            >
              {displayData.map(([key, value]) => (
                <div key={key} className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-gray-50 last:border-0 last:pb-0">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{key}</span>
                  <span className="text-sm md:text-[15px] font-semibold text-gray-800">{String(value)}</span>
                </div>
              ))}
            </motion.div>

            <motion.button 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-gray-700 hover:text-rose-600 font-semibold rounded-xl border border-gray-200 hover:border-rose-200 transition-all shadow-sm hover:shadow-md"
            >
              <ArrowLeft className="w-5 h-5" />
              Kembali ke Pencarian
            </motion.button>
          </div>
        </motion.div>
      );
    }

    // OTHER STATE 
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 bg-white p-8 rounded-2xl shadow-xl shadow-blue-900/5 border border-blue-100 relative overflow-hidden"
      >
        <div className="text-center mb-8">
          <AlertTriangle className="w-16 h-16 mx-auto text-blue-500 mb-4" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">STATUS PENERIMAAN</h3>
          <div className={`inline-flex px-6 py-2 rounded-full font-bold text-lg border bg-blue-50 text-blue-700 border-blue-200`}>
            {statusValue}
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-gray-100 mb-8">
          {displayData.map(([key, value]) => (
            <div key={key} className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm font-medium text-gray-500 capitalize">{key}:</span>
              <span className="text-sm font-semibold text-gray-900 sm:text-right">{String(value)}</span>
            </div>
          ))}
        </div>
        
        {renderMessageForm()}
        
        <div className="text-center">
          <button onClick={handleReset} className="text-blue-600 font-medium hover:underline">
            ← Cek Nomor Lain
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 relative flex flex-col font-sans overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-violet-400/20 to-fuchsia-400/20 blur-[120px] mix-blend-multiply"></div>
        <div className="absolute top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-bl from-cyan-400/20 to-blue-400/20 blur-[120px] mix-blend-multiply"></div>
        <div className="absolute -bottom-[20%] left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-pink-400/20 to-rose-400/20 blur-[120px] mix-blend-multiply"></div>
      </div>

      <nav className="w-full bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 select-none">
            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 overflow-hidden shrink-0">
              <img src="https://www.dbl.id/uploads/school/30893/560-SMAN_1_WAMENA.png" alt="Logo SMAN 1 Wamena" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-baseline">
                <h1 className="text-base sm:text-[22px] font-medium text-gray-700 tracking-tight leading-none">
                  SMA Negeri 1 Wamena
                </h1>
                <span className="hidden sm:inline-block ml-1.5 text-sm sm:text-lg font-normal text-gray-500 leading-none">
                  SPMB 2026
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-6 relative z-0">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {!hasSearched && !loading && (
              <motion.div 
                key="search"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
                className="w-full"
              >
                <div className="text-center mb-8 sm:mb-10">
                  <motion.div 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="inline-flex justify-center items-center w-20 h-20 sm:w-28 sm:h-28 bg-white/80 backdrop-blur-md rounded-full mb-4 sm:mb-6 shadow-xl border border-white p-3 sm:p-4"
                  >
                    <img src="https://www.dbl.id/uploads/school/30893/560-SMAN_1_WAMENA.png" alt="Logo SMAN 1 Wamena" className="w-full h-full object-contain drop-shadow-sm" referrerPolicy="no-referrer" />
                  </motion.div>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-3 sm:mb-4 tracking-tight drop-shadow-sm px-2">
                    Sistem Pengumuman<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                      Penerimaan Murid Baru
                    </span>
                  </h2>
                  <p className="text-sm sm:text-base md:text-lg text-gray-600 max-w-lg mx-auto font-medium px-4">
                    Masukkan nomor pendaftaran Anda untuk mengecek status kelulusan SPMB Tahun Ajaran 2026.
                  </p>
                </div>

                <form onSubmit={handleSearch} className="mb-4">
                  <div className="relative group mx-4 sm:mx-0">
                    <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={participantCode}
                      onChange={(e) => setParticipantCode(e.target.value)}
                      className="block w-full pl-12 sm:pl-14 pr-28 sm:pr-36 py-4 sm:py-5 bg-white/90 backdrop-blur-sm border-2 border-white rounded-2xl sm:rounded-3xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base sm:text-lg shadow-xl font-medium"
                      placeholder="Contoh: 2026001"
                    />
                    <div className="absolute inset-y-1.5 sm:inset-y-2 right-1.5 sm:right-2">
                      <button
                        type="submit"
                        className="h-full px-4 sm:px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl sm:rounded-2xl font-bold transition-transform hover:scale-[1.02] active:scale-95 flex items-center justify-center shadow-md shadow-blue-600/20 text-sm sm:text-base shrink-0 whitespace-nowrap"
                      >
                        Cek Status
                      </button>
                    </div>
                  </div>
                  {error && (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 text-center text-sm text-red-600 bg-red-50/80 backdrop-blur-sm py-2 rounded-xl font-medium border border-red-100"
                    >
                      {error}
                    </motion.p>
                  )}
                </form>

                {publicMessages.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-12 w-full mx-auto"
                  >
                    <div className="flex justify-center mb-4">
                      <button 
                        onClick={(e) => { e.preventDefault(); setShowMessages(!showMessages); }}
                        className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 text-blue-700 font-bold text-xs uppercase tracking-widest rounded-full transition-all border border-blue-200 shadow-sm"
                      >
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                        </span>
                        Live: Pesan Masuk
                        <svg className={`w-4 h-4 text-blue-500 transition-transform ${showMessages ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    
                    <AnimatePresence>
                      {showMessages && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="relative overflow-hidden h-[160px] w-full max-w-lg mx-auto rounded-2xl bg-white/40 backdrop-blur-sm border border-white/60 p-4 shadow-sm"
                        >
                          <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-white/40 to-transparent z-10 pointer-events-none"></div>
                          <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-white/40 to-transparent z-10 pointer-events-none"></div>
                          
                          <div className="flex flex-col gap-3 overflow-y-auto h-full scrollbar-hide pr-2">
                            <AnimatePresence>
                              {publicMessages.slice(0, 3).map((msg, i) => (
                                <motion.div
                                  key={i}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white/80 p-3 rounded-xl shadow-sm border border-gray-100 flex gap-3 items-start"
                            >
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0 text-white font-bold shadow-sm">
                                {msg.nama?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex justify-between items-baseline mb-0.5">
                                  <h5 className="font-bold text-gray-800 text-xs truncate mr-2">{msg.nama}</h5>
                                  <span className="text-[10px] text-gray-400 font-medium shrink-0">#{msg.nomor}</span>
                                </div>
                                <p className="text-gray-600 text-xs font-medium leading-relaxed break-words">{msg.pesan}</p>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        )}

            {loading && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                className="w-full flex flex-col items-center justify-center p-12 bg-white/40 backdrop-blur-md rounded-3xl border border-white/50 shadow-2xl"
              >
                <div className="relative w-24 h-24 mb-6">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-indigo-500 border-b-purple-500 border-l-pink-500 opacity-80"
                  />
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute inset-2 rounded-full border-4 border-transparent border-t-pink-400 border-l-cyan-400 opacity-60"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Search className="w-8 h-8 text-indigo-600 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-800 tracking-tight">Menyinkronkan Data...</h3>
                <p className="text-gray-500 mt-2 font-medium">Mencari nomor peserta {participantCode} dengan kecepatan tinggi</p>
              </motion.div>
            )}

            {hasSearched && !loading && (
              <motion.div
                key="result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full"
              >
                {result?.notFound ? (
                  <motion.div 
                    initial={{ y: 20 }} animate={{ y: 0 }}
                    className="mt-6 bg-white p-8 rounded-3xl border border-amber-100 shadow-2xl text-center"
                  >
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertTriangle className="w-10 h-10 text-amber-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Data Tidak Ditemukan</h3>
                    <p className="text-gray-500 mb-8 font-medium">
                      Nomor peserta <strong className="text-gray-900 bg-gray-100 px-2 py-1 rounded">{participantCode}</strong> tidak ditemukan dalam database pengumuman. 
                      Pastikan nomor yang Anda masukkan sudah sesuai dengan kartu ujian.
                    </p>
                    <button 
                      onClick={handleReset}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-50 text-gray-700 hover:bg-gray-100 font-semibold rounded-xl border border-gray-200 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      Coba Nomor Lain
                    </button>
                  </motion.div>
                ) : (
                  renderResultData()
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="relative z-10 w-full py-6 text-center text-gray-400/80 text-sm font-medium">
        &copy; 2026 SMA Negeri 1 Wamena. Hak Cipta Dilindungi.
      </footer>
    </div>
  );
}
