/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  getDatabase, 
  saveDatabase, 
  SIMULATED_USERS, 
  INITIAL_RWS,
  logDemographyEvent
} from "./dataStore";
import { Warga, RW, Iuran, TransaksiIuran, Pengajuan, Laporan, MutasiLog, User } from "./types";

// Import Panels
import WargaPanel from "./components/WargaPanel";
import MutasiPanel from "./components/MutasiPanel";
import IuranPanel from "./components/IuranPanel";
import PengajuanPanel from "./components/PengajuanPanel";
import LaporanPanel from "./components/LaporanPanel";
import ProfilRwPanel from "./components/ProfilRwPanel";
import GasPanel from "./components/GasPanel";

// Lucide Icons
import { 
  Home, 
  Users, 
  TrendingUp, 
  Coins, 
  FileText, 
  AlertTriangle, 
  Users2, 
  MapPin, 
  LogOut, 
  ChevronRight, 
  Menu, 
  X,
  Lock,
  User as UserIcon,
  HelpCircle,
  FileSpreadsheet,
  Database,
  RefreshCw,
  Wifi,
  CheckCircle2
} from "lucide-react";

export default function App() {
  // Database State
  const [db, setDb] = useState(() => getDatabase());

  // Current Active Simulated User Session
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUserId = localStorage.getItem("DUSUN_CURRENT_USER_ID");
    if (savedUserId) {
      const user = SIMULATED_USERS.find(u => u.id === savedUserId);
      if (user) return user;
    }
    return null;
  });

  // Login Form States
  const [loginUserId, setLoginUserId] = useState<string>("u0");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);

  // Switch User Protection states
  const [promptUserSwitch, setPromptUserSwitch] = useState<User | null>(null);
  const [switchPasswordInput, setSwitchPasswordInput] = useState<string>("");
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [showSwitchPassword, setShowSwitchPassword] = useState<boolean>(false);

  // System Navigation Tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "warga" | "mutasi" | "iuran" | "pengajuan" | "laporan" | "gas">("dashboard");

  // Mobile drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Status Notification Center simulated ticker
  const [notification, setNotification] = useState<string | null>(() => {
    const savedUserId = localStorage.getItem("DUSUN_CURRENT_USER_ID");
    if (savedUserId) {
      const user = SIMULATED_USERS.find(u => u.id === savedUserId);
      if (user) return "Selamat Datang kembali. Anda masuk sebagai: " + user.nama + " (" + user.role + ")";
    }
    return "Selamat Datang di Portal Administrasi Dusun 3 Ds.Suci. Silakan masuk untuk mengelola sistem.";
  });

  // --- GOOGLE SPREADSHEET AUTO CONNECTION INTEGRATION CONFIGURATION ---
  const [dashGasUrl, setDashGasUrl] = useState(() => localStorage.getItem("GAS_WEB_APP_URL") || "");
  const [isSyncingDash, setIsSyncingDash] = useState(false);
  const [dashSyncError, setDashSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem("GAS_LAST_SYNC_TIME") || null);

  // Sync databases locally & automatically push to Google Sheets directly and instantly
  useEffect(() => {
    saveDatabase(db);

    const gasUrl = localStorage.getItem("GAS_WEB_APP_URL");
    if (gasUrl && gasUrl.trim() !== "") {
      setIsSyncingDash(true);
      setDashSyncError(null);
      fetch(gasUrl, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/plain"
        },
        body: JSON.stringify({
          action: "sync",
          db: db
        })
      })
      .then(res => res.json())
      .then(json => {
        setIsSyncingDash(false);
        if (json && json.status === "success") {
          const nowStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          setLastSyncTime(nowStr);
          localStorage.setItem("GAS_LAST_SYNC_TIME", nowStr);
          localStorage.setItem("GAS_AUTO_SYNC", "true"); // keep compatible
          triggerNotification("Pembaruan data otomatis disimpan langsung ke Google Spreadsheet!");
          setDashSyncError(null);
        } else {
          console.warn("Auto-sync Google Sheets gagal:", json.message);
          setDashSyncError(json.message || "Gagal menyimpan ke Google Spreadsheet.");
        }
      })
      .catch(err => {
        setIsSyncingDash(false);
        console.error("Auto-sync Google Sheets bermasalah:", err);
        setDashSyncError("Gagal tersambung ke Google Sheets (periksa koneksi/Apps Script).");
      });
    }
  }, [db]);

  // Handle direct data pull from Google Sheets
  const handleDashPullData = async () => {
    const gasUrl = localStorage.getItem("GAS_WEB_APP_URL");
    if (!gasUrl || gasUrl.trim() === "") {
      setDashSyncError("Silakan masukkan URL Web App Google Apps Script terlebih dahulu.");
      return;
    }
    setIsSyncingDash(true);
    setDashSyncError(null);
    try {
      let json: any = null;
      let usedMethod = "GET";

      // 1. Try GET
      try {
        const res = await fetch(gasUrl, {
          method: "GET",
          mode: "cors"
        });
        json = await res.json();
        usedMethod = "GET";
      } catch (getErr) {
        console.warn("Dash Pull GET failed, attempting fallack POST...", getErr);
      }

      // 2. Try POST fallback if GET fails
      if (!json || json.status !== "success") {
        const resPost = await fetch(gasUrl, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain"
          },
          body: JSON.stringify({
            action: "pull"
          })
        });
        json = await resPost.json();
        usedMethod = "POST";
      }

      if (json && json.status === "success" && json.data) {
        const sheetsData = json.data;
        setDb(prev => ({
          warga: (sheetsData.warga && sheetsData.warga.length > 0) ? sheetsData.warga : prev.warga,
          rws: (sheetsData.rws && sheetsData.rws.length > 0) ? sheetsData.rws : prev.rws,
          iuran: (sheetsData.iuran && sheetsData.iuran.length > 0) ? sheetsData.iuran : prev.iuran,
          transaksi: (sheetsData.transaksi && sheetsData.transaksi.length > 0) ? sheetsData.transaksi : prev.transaksi,
          pengajuan: (sheetsData.pengajuan && sheetsData.pengajuan.length > 0) ? sheetsData.pengajuan : prev.pengajuan,
          laporan: (sheetsData.laporan && sheetsData.laporan.length > 0) ? sheetsData.laporan : prev.laporan,
          mutasi: (sheetsData.mutasi && sheetsData.mutasi.length > 0) ? sheetsData.mutasi : prev.mutasi,
        }));
        
        const nowStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLastSyncTime(nowStr);
        localStorage.setItem("GAS_LAST_SYNC_TIME", nowStr);
        triggerNotification(`Sukses menarik data dari database Google Spreadsheet!`);
      } else {
        throw new Error(json ? json.message : "Format data dari server Apps Script tidak valid.");
      }
    } catch (err: any) {
      setDashSyncError("Gagal mengambil data: " + err.message);
    } finally {
      setIsSyncingDash(false);
    }
  };

  // Pull latest Google Sheets database on startup
  useEffect(() => {
    const gasUrl = localStorage.getItem("GAS_WEB_APP_URL");
    if (gasUrl) {
      const startupSync = async () => {
        try {
          let json: any = null;
          try {
            const res = await fetch(gasUrl, {
              method: "GET",
              mode: "cors"
            });
            json = await res.json();
          } catch (getErr) {
            console.warn("Startup GET pull failed, trying POST fallback...", getErr);
          }

          if (!json || json.status !== "success") {
            const resPost = await fetch(gasUrl, {
              method: "POST",
              mode: "cors",
              headers: {
                "Content-Type": "text/plain"
              },
              body: JSON.stringify({
                action: "pull"
              })
            });
            json = await resPost.json();
          }

          if (json && json.status === "success" && json.data) {
            const sheetsData = json.data;
            setDb(prev => ({
              warga: (sheetsData.warga && sheetsData.warga.length > 0) ? sheetsData.warga : prev.warga,
              rws: (sheetsData.rws && sheetsData.rws.length > 0) ? sheetsData.rws : prev.rws,
              iuran: (sheetsData.iuran && sheetsData.iuran.length > 0) ? sheetsData.iuran : prev.iuran,
              transaksi: (sheetsData.transaksi && sheetsData.transaksi.length > 0) ? sheetsData.transaksi : prev.transaksi,
              pengajuan: (sheetsData.pengajuan && sheetsData.pengajuan.length > 0) ? sheetsData.pengajuan : prev.pengajuan,
              laporan: (sheetsData.laporan && sheetsData.laporan.length > 0) ? sheetsData.laporan : prev.laporan,
              mutasi: (sheetsData.mutasi && sheetsData.mutasi.length > 0) ? sheetsData.mutasi : prev.mutasi,
            }));
            const nowStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            setLastSyncTime(nowStr);
            localStorage.setItem("GAS_LAST_SYNC_TIME", nowStr);
            triggerNotification("Database sukses disinkronisasikan langsung dari Google Sheets!");
          }
        } catch (err) {
          console.warn("Koneksi Google Sheets offline saat startup:", err);
        }
      };

      startupSync();
    }
  }, []);

  // Redirect non-admin if they attempt to access Google Sheets integration tab
  useEffect(() => {
    if (activeTab === "gas" && currentUser && currentUser.role !== "Admin") {
      setActiveTab("dashboard");
    }
  }, [activeTab, currentUser]);

  // Handle updates across subpanels
  const handleUpdateWarga = (updatedWargaList: Warga[]) => {
    setDb(prev => ({
      ...prev,
      warga: updatedWargaList
    }));
    triggerNotification("Data Buku Induk Penduduk berhasil sinkron secara aman.");
  };

  const handleUpdateMutasi = (updatedLogs: MutasiLog[]) => {
    setDb(prev => ({
      ...prev,
      mutasi: updatedLogs
    }));
  };

  const handleUpdateIuran = (updatedIuran: Iuran[], updatedTransactions: TransaksiIuran[]) => {
    setDb(prev => ({
      ...prev,
      iuran: updatedIuran,
      transaksi: updatedTransactions
    }));
    triggerNotification("Transaksi kas bendahara berhasil divalidasi.");
  };

  const handleUpdatePengajuan = (updatedPengajuan: Pengajuan[]) => {
    setDb(prev => ({
      ...prev,
      pengajuan: updatedPengajuan
    }));
    triggerNotification("Status pengajuan jaminan bantuan sosial termutakhirkan.");
  };

  const handleUpdateLaporan = (updatedLaporan: Laporan[]) => {
    setDb(prev => ({
      ...prev,
      laporan: updatedLaporan
    }));
    triggerNotification("Jurnal kliping pelaporan/pengaduan berhasil diubah.");
  };

  const handleSystemLogMutation = (wargaId: number, jenis: any, keterangan: string) => {
    if (!currentUser) return;
    // Audit log mutator helper
    const logTime = new Date().toISOString().replace("T", " ").substring(0, 19);
    setDb(prev => {
      const updated = logDemographyEvent(prev, wargaId, jenis, keterangan, `${currentUser?.nama || ""} (${currentUser?.role === "Admin" ? "Kepala Dusun" : currentUser?.rwId || ""})`);
      return updated;
    });
  };

  // Switcher account callback (triggers password verification modal)
  const handleUserSwitch = (userId: string) => {
    const targetUser = SIMULATED_USERS.find(u => u.id === userId);
    if (targetUser) {
      setPromptUserSwitch(targetUser);
      setSwitchPasswordInput("");
      setSwitchError(null);
      setShowSwitchPassword(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = SIMULATED_USERS.find(u => u.id === loginUserId);
    if (targetUser) {
      if (targetUser.password === loginPassword) {
        localStorage.setItem("DUSUN_CURRENT_USER_ID", targetUser.id);
        setCurrentUser(targetUser);
        setLoginPassword("");
        setLoginError(null);
        triggerNotification(`Selamat Datang kembali, ${targetUser.nama}! Anda masuk sebagai ${targetUser.role === "Admin" ? "Kepala Dusun" : `Ketua ${targetUser.rwId}`}.`);
      } else {
        setLoginError("Kata sandi salah! Silakan periksa kembali kata sandi default di panduan.");
      }
    }
  };

  const confirmUserSwitch = () => {
    if (promptUserSwitch) {
      if (promptUserSwitch.password === switchPasswordInput) {
        localStorage.setItem("DUSUN_CURRENT_USER_ID", promptUserSwitch.id);
        setCurrentUser(promptUserSwitch);
        triggerNotification(`Berhasil berganti peran ke: ${promptUserSwitch.nama} (${promptUserSwitch.role === "Admin" ? "Kepala Dusun" : `${promptUserSwitch.rwId} (User)`})`);
        setPromptUserSwitch(null);
        setSwitchPasswordInput("");
        setSwitchError(null);
      } else {
        setSwitchError("Sandi tidak cocok! Silakan periksa kembali.");
      }
    }
  };

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // If there's no authenticated simulation session, render custom full-screen login scene
  if (!currentUser) {
    const currentSelectUser = SIMULATED_USERS.find(u => u.id === loginUserId) || SIMULATED_USERS[0];
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-slate-900">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative overflow-hidden">
          {/* Decorative glows */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -translate-x-12 -translate-y-12"></div>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl translate-x-12 translate-y-12"></div>

          {/* Logo & Identity */}
          <div className="text-center relative z-10 space-y-2">
            <div className="inline-flex h-12 w-12 bg-emerald-600/20 text-emerald-400 rounded-xl items-center justify-center border border-emerald-500/30 shadow-inner">
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight font-display">Portal Administrasi Dusun</h2>
            <p className="text-xs text-slate-400">Sistem Informasi, Mutasi LAMPID & Kas Iuran Dusun 3</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 relative z-10">
            {/* User Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pilih Pengguna / Peran</label>
              <div className="relative">
                <select
                  value={loginUserId}
                  onChange={(e) => {
                    setLoginUserId(e.target.value);
                    setLoginError(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-semibold outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none"
                >
                  {SIMULATED_USERS.map((u) => (
                    <option key={u.id} value={u.id} className="bg-slate-900 text-slate-100">
                      {u.nama} ({u.role === "Admin" ? "Kepala Dusun" : `Ketua ${u.rwId}`})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Password input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Kata Sandi</label>
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="text-[10px] text-emerald-400 hover:underline font-semibold"
                >
                  {showLoginPassword ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>
              <input
                type={showLoginPassword ? "text" : "password"}
                required
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  setLoginError(null);
                }}
                placeholder={`Masukkan sandi untuk ${currentSelectUser.nama}...`}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition-all"
              />
            </div>

            {/* Error badge */}
            {loginError && (
              <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-xl text-2xs text-rose-350 font-semibold text-center leading-relaxed">
                ⚠️ {loginError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-all text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Masuk Sekarang</span>
            </button>
          </form>

          {/* Guidelines / Helper Box */}
          <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3.5 space-y-2 text-2xs text-slate-400 leading-relaxed font-sans shadow-inner">
            <span className="font-bold text-slate-300 block">💡 Kata Sandi Default (Simulasi):</span>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-1.5 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-[9px] text-slate-500 block">User: kadus</span>
                <span className="text-emerald-400 font-bold">admin123</span>
              </div>
              <div className="p-1.5 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-[9px] text-slate-500 block">User: rw01</span>
                <span className="text-blue-400 font-bold">rw01</span>
              </div>
              <div className="p-1.5 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-[9px] text-slate-500 block">User: rw02</span>
                <span className="text-blue-400 font-bold">rw02</span>
              </div>
              <div className="p-1.5 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-[9px] text-slate-500 block">User: rw03</span>
                <span className="text-blue-400 font-bold">rw03</span>
              </div>
              <div className="p-1.5 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-[9px] text-slate-500 block">User: rw04</span>
                <span className="text-blue-400 font-bold">rw04</span>
              </div>
              <div className="p-1.5 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-[9px] text-slate-500 block">User: rw05</span>
                <span className="text-blue-400 font-bold">rw05</span>
              </div>
            </div>
            <p className="text-[9px] text-slate-500 mt-1">
              *Pilih salah satu peran di atas, masukkan kata sandi yang sesuai, lalu klik Masuk Sekarang.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Cumulative numbers for general stats
  const totalWargaCount = db.warga.filter(w => w.status === "Aktif").length;
  const totalKkCount = Array.from(new Set(db.warga.filter(w => w.status === "Aktif").map(w => w.kk))).length;
  const outstandingBansosCount = db.pengajuan.filter(p => p.status === "Kirim" || p.status === "Verifikasi").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased">
      
      {/* 1. Global Simulation Switcher & Alert Notification top bar */}
      <div className="bg-slate-900 text-white border-b border-slate-800 text-xs px-4 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 z-40">
        <div className="flex items-center gap-2">
          <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-500 font-bold text-slate-900 text-[10px]">DEVEL_MODE</span>
          <p className="text-slate-300">
            Gunakan selektor di samping untuk mensimulasikan peran otorisasi dwi-fungsi: <span className="font-semibold text-white">Kepala Dusun (Admin)</span> vs <span className="font-semibold text-white">Ketua RW 01-05 (User)</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Beralih Peran Simulasi:</span>
          <select
            value={currentUser.id}
            onChange={(e) => handleUserSwitch(e.target.value)}
            className="bg-slate-850 hover:bg-slate-800 text-slate-100 font-semibold px-2 py-1 rounded border border-slate-700 outline-none text-xs rounded-md"
          >
            {SIMULATED_USERS.map(u => (
              <option key={u.id} value={u.id}>
                {u.nama} ({u.role === "Admin" ? "Kepala Dusun" : `${u.rwId} User`})
              </option>
            ))}
          </select>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-800 text-emerald-100 px-4 py-2 text-2xs text-center font-medium font-sans border-b border-emerald-700 animate-pulse">
          SISTEM UPDATE: {notification}
        </div>
      )}

      {/* Main body wrapper layout */}
      <div className="flex flex-1 relative">
        
        {/* 2. Side navigation layout (collapsible responsive drawer) */}
        {/* Mobile menu toggle button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden fixed bottom-5 right-5 z-40 h-12 w-12 bg-emerald-600 hover:bg-emerald-700 shadow-xl text-white rounded-full flex items-center justify-center cursor-pointer"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Sidebar container */}
        <aside className={`
          fixed inset-y-0 left-0 transform md:relative md:translate-x-0 transition-transform duration-300 z-30
          w-64 bg-slate-900 text-slate-400 flex flex-col justify-between border-r border-slate-800 flex-shrink-0
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}>
          <div className="flex flex-col flex-1">
            
            {/* Header Identity of client */}
            <div className="px-6 py-5.5 border-b border-slate-800/80 flex items-center gap-3">
              <div className="h-9 w-9 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-sm italic shadow-xs">
                DS
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-wide text-white font-display">Dusun 3</h1>
                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Dashboard Administrasi</span>
              </div>
            </div>

            {/* Profile badge */}
            <div className="mx-4 mt-5 p-3.5 bg-slate-850/50 rounded-xl border border-slate-800/60 space-y-1.5 text-xs">
              <span className="text-[10px] font-semibold text-slate-550 uppercase">Peran Aktif</span>
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-350 text-2xs font-extrabold border border-slate-700/50">
                  {currentUser.nama.charAt(0)}
                </div>
                <div>
                  <span className="block font-semibold text-slate-250 leading-tight">{currentUser.nama}</span>
                  <span className="text-[10px] text-emerald-400 block mt-0.5">{currentUser.role === "Admin" ? "Kepala Dusun (Admin)" : `Ketua ${currentUser.rwId}`}</span>
                </div>
              </div>
            </div>

            {/* Main navigation listings */}
            <nav className="p-4 space-y-1 mt-4 flex-1">
              {/* Dashboard */}
              <button
                onClick={() => { setActiveTab("dashboard"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === "dashboard" 
                    ? "bg-slate-800 text-emerald-400 font-semibold" 
                    : "hover:bg-slate-850/40 hover:text-white"
                }`}
              >
                <Home className="w-4.5 h-4.5" />
                <span>Dashboard & Profil RW</span>
              </button>

              {/* Data Penduduk */}
              <button
                onClick={() => { setActiveTab("warga"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === "warga" 
                    ? "bg-slate-800 text-emerald-400 font-semibold" 
                    : "hover:bg-slate-850/40 hover:text-white"
                }`}
              >
                <Users className="w-4.5 h-4.5" />
                <span>Buku Induk Penduduk</span>
              </button>

              {/* Mutasi LAMPID */}
              <button
                onClick={() => { setActiveTab("mutasi"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === "mutasi" 
                    ? "bg-slate-800 text-emerald-400 font-semibold" 
                    : "hover:bg-slate-850/40 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4.5 h-4.5" />
                  <span>Mutasi LAMPID</span>
                </div>
                <span className="text-2xs bg-slate-800 px-1.5 py-0.5 rounded font-bold font-mono text-slate-400">{db.mutasi.length}</span>
              </button>

              {/* Dues / Iuran Kas */}
              <button
                onClick={() => { setActiveTab("iuran"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === "iuran" 
                    ? "bg-slate-800 text-emerald-400 font-semibold" 
                    : "hover:bg-slate-850/40 hover:text-white"
                }`}
              >
                <Coins className="w-4.5 h-4.5" />
                <span>Modul Iuran & Kas RW</span>
              </button>

              {/* Social Program assistance */}
              <button
                onClick={() => { setActiveTab("pengajuan"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === "pengajuan" 
                    ? "bg-slate-800 text-emerald-400 font-semibold" 
                    : "hover:bg-slate-850/40 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4.5 h-4.5" />
                  <span>Pengajuan Bansos</span>
                </div>
                {outstandingBansosCount > 0 && (
                  <span className="text-3xs bg-emerald-500 font-black px-1.5 py-0.5 rounded text-slate-900 leading-none">
                    {outstandingBansosCount}
                  </span>
                )}
              </button>

              {/* Reports  */}
              <button
                onClick={() => { setActiveTab("laporan"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === "laporan" 
                    ? "bg-slate-800 text-emerald-400 font-semibold" 
                    : "hover:bg-slate-850/40 hover:text-white"
                }`}
              >
                <AlertTriangle className="w-4.5 h-4.5" />
                <span>Kegiatan & Pengaduan</span>
              </button>

              {/* Google Sheets Integration */}
              {currentUser.role === "Admin" && (
                <button
                  onClick={() => { setActiveTab("gas"); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    activeTab === "gas" 
                      ? "bg-slate-800 text-emerald-400 font-semibold" 
                      : "hover:bg-slate-850/45 hover:text-white"
                  }`}
                >
                  <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-500" />
                  <span className="flex-1 text-left">Integrasi Google Sheets</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </button>
              )}

              {/* Logout button */}
              <button
                onClick={() => {
                  localStorage.removeItem("DUSUN_CURRENT_USER_ID");
                  setCurrentUser(null);
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer mt-4 border-t border-slate-800/80 pt-4 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <LogOut className="w-4.5 h-4.5" />
                <span>Keluar (Logout)</span>
              </button>
            </nav>

          </div>

          {/* Footer of Sidebar */}
          <div className="p-4 border-t border-slate-800 text-2xs text-slate-500 space-y-1 font-mono text-center">
            <span className="block text-slate-400 font-semibold">UU Pelindungan Data Pribadi</span>
            <span>No. 27/2022 Verified System</span>
          </div>
        </aside>

        {/* 3. Main content arena workspace */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
          
          {/* Dashboard Hub Header Card showing quick general numbers (only listed if dashboard tab is active) */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Google Sheets Database Instant Sync Card */}
              <div id="google-sheets-dashboard-card" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                      <Database className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-sm font-display">
                        Koneksi Database Google Spreadsheet
                      </h3>
                      <p className="text-2xs text-slate-500">
                        Sistem sinkronisasi data cloud real-time di latar belakang
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {dashGasUrl ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded-full border border-emerald-100">
                        <Wifi className="w-3 h-3" />
                        Terhubung
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-1 rounded-full border border-amber-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                        Offline (Lokal)
                      </span>
                    )}
                    
                    {lastSyncTime && (
                      <span className="text-[10px] bg-slate-100 text-slate-650 px-2 py-1 rounded-full font-mono">
                        Sinkron Akhir: {lastSyncTime}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-slate-650 leading-relaxed">
                    Setiap kali Anda menambah, mengedit, atau menghapus data (Buku Induk Warga, Mutasi, Iuran Bendahara, atau Bansos), data akan <strong>langsung tersimpan di Google Spreadsheet</strong> Anda secara instan di latar belakang tanpa tindakan tambahan.
                  </p>

                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        URL Web App Google Apps Script (Database)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={dashGasUrl}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDashGasUrl(value);
                            localStorage.setItem("GAS_WEB_APP_URL", value);
                            triggerNotification("URL Spreadsheet berhasil disimpan secara lokal!");
                          }}
                          placeholder="https://script.google.com/macros/s/.../exec"
                          className="w-full text-xs font-mono bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-lg px-3 py-2 pr-10 outline-hidden transition-all text-slate-700"
                        />
                        {dashGasUrl && (
                          <button
                            onClick={() => {
                              setDashGasUrl("");
                              localStorage.removeItem("GAS_WEB_APP_URL");
                              triggerNotification("Koneksi Google Spreadsheet diputuskan.");
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold font-mono px-1 hover:bg-slate-100 rounded"
                            title="Hapus Koneksi"
                          >
                            X
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 items-end">
                      <button
                        type="button"
                        onClick={handleDashPullData}
                        disabled={isSyncingDash}
                        className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-50 h-[34px]"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDash ? "animate-spin" : ""}`} />
                        <span>Tarik Data (Pull)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          // Force manual trigger sync
                          setDb(prev => ({ ...prev }));
                        }}
                        disabled={isSyncingDash || !dashGasUrl}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-50 h-[34px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Kirim Data (Push)</span>
                      </button>
                    </div>
                  </div>

                  {dashSyncError && (
                    <p className="text-[11px] text-rose-500 font-semibold bg-rose-50 p-2.5 rounded-lg border border-rose-150">
                      ⚠️ Terjadi Masalah: {dashSyncError}
                    </p>
                  )}
                  
                  {!dashGasUrl && (
                    <div className="p-3 bg-blue-50/70 text-blue-800 rounded-lg border border-blue-100 text-[11px] leading-relaxed">
                      💡 <strong>Cara Menghubungkan Spreadsheet Anda:</strong> Buka tab <strong>Integrasi Google Sheets</strong> dari menu samping satu kali saja untuk menyalin kode Apps Script bawaan, tempelkan ke Google Apps Script Spreadsheet Anda, deploy, dan masukkan tautan Web App yang Anda dapatkan ke dalam kotak input di atas. Data akan langsung terhubung secara otomatis!
                    </div>
                  )}
                </div>
              </div>

              {/* Profile sub-header panel */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-emerald-900 text-emerald-100 p-6 rounded-2xl shadow-sm border border-emerald-800">
                <div className="md:col-span-2 space-y-1">
                  <span className="text-[10px] font-bold tracking-widest text-emerald-300 uppercase block">DUSUN 3 ADMINISTRASI</span>
                  <h2 className="text-2xl font-bold text-white font-display">Selamat datang kembali, {currentUser.nama}!</h2>
                  <p className="text-sm text-emerald-200 mt-1 leading-relaxed">
                    Sistem audit kependudukan dan transparansi keuangan 5 wilayah RW. Pantau semua peristiwa LAMPID serta pengajuan bansos warga dalam satu antarmuka terenkripsi.
                  </p>
                </div>

                {/* Info block counts */}
                <div className="bg-white/10 p-4 rounded-xl border border-white/5 text-slate-205 flex flex-col justify-between">
                  <span className="text-2xs text-emerald-250 font-bold uppercase tracking-wide block">Buku Induk Penduduk</span>
                  <div className="mt-4">
                    <span className="text-3xl font-extrabold text-white font-display block leading-none">{totalWargaCount}</span>
                    <span className="text-[10px] text-emerald-300 block mt-1.5">Jiwa Terdaftar Aktif</span>
                  </div>
                </div>

                <div className="bg-white/10 p-4 rounded-xl border border-white/5 text-slate-205 flex flex-col justify-between">
                  <span className="text-2xs text-emerald-250 font-bold uppercase tracking-wide block">Kelompok Keluarga (KK)</span>
                  <div className="mt-4">
                    <span className="text-3xl font-extrabold text-white font-display block leading-none">{totalKkCount}</span>
                    <span className="text-[10px] text-emerald-300 block mt-1.5">Nomor KK Terdaftar Pasif</span>
                  </div>
                </div>
              </div>

              {/* Renders detailed Profile view block */}
              <ProfilRwPanel 
                warga={db.warga}
                rws={db.rws}
                iuran={db.iuran}
                currentUser={currentUser}
              />
            </div>
          )}

          {/* Data Penduduk Panel rendering */}
          {activeTab === "warga" && (
            <WargaPanel 
              warga={db.warga}
              rws={db.rws}
              currentUser={currentUser}
              onUpdateWarga={handleUpdateWarga}
              onLogMutation={handleSystemLogMutation}
            />
          )}

          {/* Mutasi Logs LAMPID Panel rendering */}
          {activeTab === "mutasi" && (
            <MutasiPanel 
              mutasiLogs={db.mutasi}
              rws={db.rws}
              warga={db.warga}
              currentUser={currentUser}
              onUpdateMutasi={handleUpdateMutasi}
            />
          )}

          {/* Iuran bendahara Kas Panel rendering */}
          {activeTab === "iuran" && (
            <IuranPanel 
              warga={db.warga}
              rws={db.rws}
              iuran={db.iuran}
              transaksi={db.transaksi}
              currentUser={currentUser}
              onUpdateDatabase={handleUpdateIuran}
            />
          )}

          {/* Social submissions Program bantuan */}
          {activeTab === "pengajuan" && (
            <PengajuanPanel 
              warga={db.warga}
              rws={db.rws}
              pengajuan={db.pengajuan}
              currentUser={currentUser}
              onUpdatePengajuan={handleUpdatePengajuan}
            />
          )}

          {/* Activities / Incident complaints reports */}
          {activeTab === "laporan" && (
            <LaporanPanel 
              warga={db.warga}
              rws={db.rws}
              laporan={db.laporan}
              currentUser={currentUser}
              onUpdateLaporan={handleUpdateLaporan}
            />
          )}

          {/* Google Sheets GAS Integration Panel */}
          {activeTab === "gas" && (
            <GasPanel 
              db={db}
              setDb={setDb}
              triggerNotification={triggerNotification}
            />
          )}

        </main>

      </div>

      {/* 4. Switch Account Password Verification Dialog Modal */}
      {promptUserSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-850 rounded-xl shadow-2xl p-5 md:p-6 space-y-4 relative">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-emerald-600/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Lock className="w-4.5 h-4.5" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Konfirmasi Hak Akses</h3>
                <p className="text-[10px] text-slate-400">Otorisasi simulasi berganti peran</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-lg space-y-1 text-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-bold text-[9px]">Target Peran</span>
              <p className="text-slate-200 font-semibold">
                {promptUserSwitch.nama} ({promptUserSwitch.role === "Admin" ? "Kepala Dusun / Admin" : `${promptUserSwitch.rwId} / Ketua RW`})
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Masukkan Kata Sandi</label>
                <button
                  type="button"
                  onClick={() => setShowSwitchPassword(!showSwitchPassword)}
                  className="text-[10px] text-emerald-400 hover:underline font-semibold"
                >
                  {showSwitchPassword ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>
              <input
                type={showSwitchPassword ? "text" : "password"}
                autoFocus
                placeholder={`Masukan Sandi !!...`}
                value={switchPasswordInput}
                onChange={(e) => {
                  setSwitchPasswordInput(e.target.value);
                  setSwitchError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    confirmUserSwitch();
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/40 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none"
              />
            </div>

            {switchError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-900/50 rounded-lg text-[11px] text-rose-300 font-semibold leading-relaxed">
                ⚠️ {switchError}
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPromptUserSwitch(null);
                  setSwitchPasswordInput("");
                  setSwitchError(null);
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold py-1.5 rounded-lg text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmUserSwitch}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-1.5 rounded-lg text-xs transition cursor-pointer"
                id="btn-confirm-switch"
              >
                Ganti Peran
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
