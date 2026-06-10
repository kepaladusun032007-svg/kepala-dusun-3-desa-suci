/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AppDatabase } from "../dataStore";
import { 
  FileSpreadsheet, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Clipboard, 
  CheckCircle2, 
  ExternalLink, 
  Play, 
  AlertCircle, 
  CloudLightning,
  Settings,
  HelpCircle,
  TrendingUp,
  Download,
  Upload
} from "lucide-react";

interface GasPanelProps {
  db: AppDatabase;
  setDb: (updater: AppDatabase | ((prev: AppDatabase) => AppDatabase)) => void;
  triggerNotification: (msg: string) => void;
}

export default function GasPanel({ db, setDb, triggerNotification }: GasPanelProps) {
  const [gasUrl, setGasUrl] = useState(() => localStorage.getItem("GAS_WEB_APP_URL") || "");
  const [isAutoSync, setIsAutoSync] = useState(() => localStorage.getItem("GAS_AUTO_SYNC") === "true");
  const [activeTab, setActiveTab] = useState<"config" | "code">("config");
  const [testStatus, setTestStatus] = useState<"disconnected" | "testing" | "connected" | "error">("disconnected");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [syncDirection, setSyncDirection] = useState<"idle" | "pulling" | "pushing">("idle");

  // Save config changes
  useEffect(() => {
    localStorage.setItem("GAS_WEB_APP_URL", gasUrl);
  }, [gasUrl]);

  useEffect(() => {
    localStorage.setItem("GAS_AUTO_SYNC", String(isAutoSync));
  }, [isAutoSync]);

  // Handle GAS URL status checks
  const handleTestConnection = async (urlToCheck = gasUrl) => {
    if (!urlToCheck) {
      setTestStatus("disconnected");
      setErrorMessage("Masukkan URL Web App dari Google Apps Script terlebih dahulu.");
      return;
    }
    setTestStatus("testing");
    setErrorMessage("");
    try {
      let isSuccess = false;
      let usedMethod = "GET";

      // 1. Coba koneksi via GET request biasa
      try {
        const res = await fetch(urlToCheck, {
          method: "GET",
          mode: "cors"
        });
        const data = await res.json();
        if (data && data.status === "success") {
          isSuccess = true;
          usedMethod = "GET";
        }
      } catch (getErr) {
        console.warn("Uji koneksi GET gagal, mencoba fallback POST...", getErr);
      }

      // 2. Fallback ke POST request jika GET diblokir atau gagal
      if (!isSuccess) {
        const resPost = await fetch(urlToCheck, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain"
          },
          body: JSON.stringify({
            action: "pull"
          })
        });
        const dataPost = await resPost.json();
        if (dataPost && dataPost.status === "success") {
          isSuccess = true;
          usedMethod = "POST";
        } else {
          throw new Error(dataPost.message || "Respon dari server Apps Script tidak valid.");
        }
      }

      if (isSuccess) {
        setTestStatus("connected");
        triggerNotification(`Koneksi ke Google Sheets (via ${usedMethod}) berhasil diverifikasi!`);
      } else {
        throw new Error("Respon dari Apps Script tidak mengindikasikan sukses.");
      }
    } catch (err: any) {
      setTestStatus("error");
      setErrorMessage(
        "Gagal terhubung baik menggunakan GET maupun POST.\n" +
        "1. Pastikan Web App Anda telah dideploy dengan akses 'Siapa saja (Anyone / Anyone, even anonymous)' di menu setelan Apps Script.\n" +
        "2. Pastikan Anda menyalin kode Apps Script terbaru yang mendukung penarikan data via POST.\n\n" +
        "Detail Error: " + err.message
      );
    }
  };

  // Pull database from Google Sheets
  const handlePullData = async () => {
    if (!gasUrl) {
      alert("Konfigurasikan dan simpan URL Web App Apps Script terlebih dahulu.");
      return;
    }
    setSyncDirection("pulling");
    setErrorMessage("");
    try {
      let json: any = null;
      let usedMethod = "GET";

      // 1. Coba metode GET terlebih dahulu
      try {
        const res = await fetch(gasUrl, {
          method: "GET",
          mode: "cors"
        });
        json = await res.json();
        usedMethod = "GET";
      } catch (getErr) {
        console.warn("Penarikan GET gagal, mencoba fallback POST...", getErr);
      }

      // 2. Jika GET gagal, coba POST fallback
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
        
        // Merge pulling spreadsheet data. If sheets are empty, fallback to present mock
        setDb(prev => ({
          warga: (sheetsData.warga && sheetsData.warga.length > 0) ? sheetsData.warga : prev.warga,
          rws: (sheetsData.rws && sheetsData.rws.length > 0) ? sheetsData.rws : prev.rws,
          iuran: (sheetsData.iuran && sheetsData.iuran.length > 0) ? sheetsData.iuran : prev.iuran,
          transaksi: (sheetsData.transaksi && sheetsData.transaksi.length > 0) ? sheetsData.transaksi : prev.transaksi,
          pengajuan: (sheetsData.pengajuan && sheetsData.pengajuan.length > 0) ? sheetsData.pengajuan : prev.pengajuan,
          laporan: (sheetsData.laporan && sheetsData.laporan.length > 0) ? sheetsData.laporan : prev.laporan,
          mutasi: (sheetsData.mutasi && sheetsData.mutasi.length > 0) ? sheetsData.mutasi : prev.mutasi,
        }));
        
        setTestStatus("connected");
        triggerNotification(`Data sukses diunduh dari Google Spreadsheet (via ${usedMethod})!`);
      } else {
        throw new Error(json ? json.message : "Format data tidak valid.");
      }
    } catch (err: any) {
      setTestStatus("error");
      setErrorMessage(
        "Gagal mengunduh data dari Google Sheets.\n" +
        "Tip: Jika kegagalan karena masalah CORS/Redirect, pastikan Anda telah memperbarui kode Google Apps Script ke versi terbaru dan memublikasikan ulang (Penerapan Baru).\n\n" +
        "Detail: " + err.message
      );
    } finally {
      setSyncDirection("idle");
    }
  };

  // Push local React data to Google Sheets
  const handlePushData = async () => {
    if (!gasUrl) {
      alert("Konfigurasikan dan simpan URL Web App Apps Script terlebih dahulu.");
      return;
    }
    
    const confirmPush = window.confirm(
      "Apakah Anda yakin ingin menimpa data di Google Spreadsheet Anda dengan seluruh data administrasi lokal dari aplikasi ini saat ini?"
    );
    if (!confirmPush) return;

    setSyncDirection("pushing");
    setErrorMessage("");
    try {
      // Bypassing CORS Preflight OPTIONS check in Google Apps Script inside Chrome/Firefox:
      // We send body as text/plain, so browser doesn't send OPTIONS preflight under 'application/json' content type.
      // GAS doPost still receives this perfectly in e.postData.contents and can parse it through JSON.parse().
      const res = await fetch(gasUrl, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/plain"
        },
        body: JSON.stringify({
          action: "sync",
          db: db
        })
      });
      const json = await res.json();
      if (json && json.status === "success") {
        setTestStatus("connected");
        triggerNotification("Data sukses diunggah & disinkronisasikan ke Google Spreadsheet!");
      } else {
        throw new Error(json.message || "Sinkronisasi gagal.");
      }
    } catch (err: any) {
      setTestStatus("error");
      setErrorMessage("Gagal mengunggah data ke Google Sheets: " + err.message);
    } finally {
      setSyncDirection("idle");
    }
  };

  // Apps script code source
  const appsScriptCode = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT WEB APP BACKEND - SYSTEM PORTAL DUSUN SUKAMAJU
 * =========================================================================
 * Github / AI Studio Integration
 * 
 * CARA SETUP:
 * 1. Buka Google Spreadsheet buatan Anda.
 * 2. Klik Ekstensi -> Apps Script.
 * 3. Hapus kode default, lalu paste kode di bawah ini seutuhnya.
 * 4. Simpan proyek dengan menekan ikon Disket / shortcut Ctrl+S.
 * 5. Klik tombol "Terapkan (Deploy)" -> "Penerapan Baru (New Deployment)".
 * 6. Pilih jenis penerapan: "Aplikasi Web (Web App)".
 * 7. Setel konfigurasi:
 *    - Jalankan sebagai (Execute as): "Saya (Me / Email Anda)"
 *    - Siapa yang memiliki akses (Who has access): "Siapa saja (Anyone)" -> !! PENTING AGAR API DAPAT DIAKSES !!
 * 8. Klik Deploy, setujui izin verifikasi Google keamanan.
 * 9. Salin URL Aplikasi Web yang diberikan, lalu paste ke panel setelan aplikasi ini.
 */

// SPREADSHEET_ID (OPSIONAL):
// Jika Anda membuat Apps Script ini secara standalone (bukan dari menu Ekstensi -> Apps Script),
// salin ID spreadsheet Anda dari URL spreadsheet (antara "/d/" dan "/edit") lalu paste di sini:
var SPREADSHEET_ID = "";

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } catch (err) {
      // Log error atau abaikan untuk terus mencoba getActiveSpreadsheet()
    }
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    return null;
  }
}

function doGet(e) {
  var ss = getSpreadsheet();
  if (!ss) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: "Spreadsheet tidak terdeteksi. Silakan buka editor Apps Script dari dalam Spreadsheet Anda (Ekstensi -> Apps Script) ATAU isi SPREADSHEET_ID di baris paling atas kode Apps Script." 
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var db = {};
  
  // Daftar tabel / sheet yang disinkronisasikan
  var sheets = ["warga", "rws", "iuran", "transaksi", "pengajuan", "laporan", "mutasi"];
  
  sheets.forEach(function(sheetName) {
    db[sheetName] = readSheetToJson(ss, sheetName);
  });
  
  return ContentService.createTextOutput(JSON.stringify({ status: "success", data: db }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var ss = getSpreadsheet();
    
    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "Spreadsheet tidak terdeteksi. Silakan buka editor Apps Script dari dalam Spreadsheet Anda (Ekstensi -> Apps Script) ATAU isi SPREADSHEET_ID di baris paling atas kode Apps Script." 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "sync") {
      var db = payload.db;
      
      for (var sheetName in db) {
        if (db.hasOwnProperty(sheetName)) {
          writeJsonToSheet(ss, sheetName, db[sheetName]);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Data berhasil ditulis ulang & disinkronisasikan ke Google Spreadsheet!" 
      }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "pull") {
      var db = {};
      var sheets = ["warga", "rws", "iuran", "transaksi", "pengajuan", "laporan", "mutasi"];
      sheets.forEach(function(sheetName) {
        db[sheetName] = readSheetToJson(ss, sheetName);
      });
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Data sukses dibaca!", 
        data: db 
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Aksi tidak dikenali." }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// BACA DATA SHEET KE ARRAY OF OBJECTS
function readSheetToJson(ss, sheetName) {
  try {
    if (!ss) {
      ss = getSpreadsheet();
    }
    if (!ss) return [];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    
    var headers = data[0];
    var result = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var val = row[j];
        var colName = headers[j];
        if (!colName) continue;
        
        // Mengurai string JSON array/object (misalnya fotoList)
        if (typeof val === "string" && (val.indexOf("[") === 0 || val.indexOf("{") === 0)) {
          try {
            val = JSON.parse(val);
          } catch(err) {}
        }
        obj[colName] = val;
      }
      result.push(obj);
    }
    return result;
  } catch (err) {
    Logger.log("Error reading sheet " + sheetName + ": " + err.toString());
    return [];
  }
}

// TULIS KEMBALI ARRAY OF OBJECTS KE SHEET (OVERWRITE)
function writeJsonToSheet(ss, sheetName, arr) {
  if (!ss) {
    ss = getSpreadsheet();
  }
  if (!ss) {
    Logger.log("Error: Spreadsheet tidak ditemukan.");
    return;
  }
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }
  
  if (!arr || arr.length === 0) return;
  
  // Dapatkan seluruh header unik dari properti object
  var headers = [];
  arr.forEach(function(item) {
    Object.keys(item).forEach(function(key) {
      if (headers.indexOf(key) === -1) {
        headers.push(key);
      }
    });
  });
  
  sheet.appendRow(headers);
  
  var rows = [];
  arr.forEach(function(item) {
    var row = [];
    headers.forEach(function(header) {
      var val = item[header];
      if (val === undefined || val === null) {
        val = "";
      } else if (typeof val === "object") {
        val = JSON.stringify(val);
      }
      row.push(val);
    });
    rows.push(row);
  });
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    triggerNotification("Kode Apps Script berhasil disalin ke clipboard.");
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-105 shadow-xs">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 font-display flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            Integrasi Pengolah Data Google Sheets + Google Apps Script (GAS)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Gunakan Google Spreadsheet pribadi Anda sebagai database cloud serverless yang aman, transparan, dan dapat diedit manual kapan saja.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab("config")}
          className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === "config"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-400 hover:text-slate-650"
          }`}
        >
          <Settings className="w-4 h-4 inline-block mr-1.5 align-text-bottom" />
          Koneksi & Sinkronisasi
        </button>
        <button
          onClick={() => setActiveTab("code")}
          className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === "code"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-400 hover:text-slate-650"
          }`}
        >
          <HelpCircle className="w-4 h-4 inline-block mr-1.5 align-text-bottom" />
          Panduan Setup GAS
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "config" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Settings form */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 space-y-4 md:col-span-2">
            <h3 className="font-semibold text-slate-800 font-display text-sm uppercase tracking-wider">Parameter Web App</h3>
            
            <div className="space-y-4 text-slate-700">
              <div>
                <label className="block text-xs font-semibold text-slate-650 mb-1">URL Deployment Web App GAS *</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={gasUrl}
                    onChange={(e) => {
                      setGasUrl(e.target.value);
                      if (testStatus === "connected") setTestStatus("disconnected");
                    }}
                    className="flex-1 bg-slate-50 text-slate-800 text-sm px-3.5 py-2 rounded-lg border focus:bg-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                  <button
                    onClick={() => handleTestConnection()}
                    className={`px-4 py-2 font-semibold text-xs rounded-lg cursor-pointer flex items-center gap-1 transition-all ${
                      testStatus === "testing" 
                        ? "bg-slate-100 text-slate-400" 
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                    disabled={testStatus === "testing"}
                  >
                    {testStatus === "testing" ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Uji Koneksi"
                    )}
                  </button>
                </div>
                <span className="text-[10px] text-slate-450 mt-1 block">
                  Anda wajib melakukan deployment Apps Script sebagai Web App terlebih dahulu untuk mendapatkan URL ini.
                </span>
              </div>

              {/* Status information panel */}
              <div className="p-4 rounded-lg border text-xs leading-relaxed flex items-start gap-3">
                <div className="mt-0.5">
                  {testStatus === "connected" && <Wifi className="w-5 h-5 text-emerald-600" />}
                  {testStatus === "disconnected" && <WifiOff className="w-5 h-5 text-slate-400" />}
                  {testStatus === "testing" && <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" />}
                  {testStatus === "error" && <AlertCircle className="w-5 h-5 text-rose-500" />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">
                    Status Konektivitas:{" "}
                    <span className={`uppercase text-3xs font-black tracking-widest px-2 py-0.5 rounded ml-2 ${
                      testStatus === "connected" ? "bg-emerald-100 text-emerald-800" :
                      testStatus === "testing" ? "bg-amber-100 text-amber-805" :
                      testStatus === "error" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"
                    }`}>
                      {testStatus === "connected" ? "Terhubung" :
                       testStatus === "testing" ? "Menguji..." :
                       testStatus === "error" ? "Gagal Koneksi" : "Belum Dihubungkan"}
                    </span>
                  </h4>
                  {testStatus === "connected" && (
                    <p className="text-slate-500 mt-1">
                      Aplikasi Anda sekarang terhubung langsung ke Google Sheets! Data dapat disimpan dan ditarik secara real-time.
                    </p>
                  )}
                  {testStatus === "disconnected" && (
                    <p className="text-slate-450 mt-1">
                      Saat ini data tersimpan di LocalStorage browser lokal Anda. Konfigurasikan URL Apps Script untuk mengaktifkan sinkronisasi database cloud Google Sheets.
                    </p>
                  )}
                  {errorMessage && (
                    <p className="text-rose-600 mt-1 font-mono text-[10px] whitespace-pre-line bg-rose-50 p-2 rounded border border-rose-150">
                      {errorMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border">
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">Autosinkronisasi Data</span>
                  <span className="text-2xs text-slate-400">Seluruh pembaruan di aplikasi otomatis disimpan langsung ke Google Sheets.</span>
                </div>
                <input
                  type="checkbox"
                  checked={isAutoSync}
                  onChange={(e) => {
                    setIsAutoSync(e.target.checked);
                    if (e.target.checked && !gasUrl) {
                      alert("Silakan masukkan URL Web App GAS terlebih dahulu.");
                      setIsAutoSync(false);
                    }
                  }}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
                />
              </div>

              {/* Synchronize actions */}
              <div className="pt-4 border-t flex flex-wrap gap-3">
                <button
                  onClick={handlePullData}
                  disabled={syncDirection !== "idle" || !gasUrl}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                >
                  <Download className={`w-4 h-4 ${syncDirection === "pulling" ? "animate-bounce" : ""}`} />
                  {syncDirection === "pulling" ? "Mengunduh..." : "Tarik Data Dari Sheets (Pull)"}
                </button>

                <button
                  onClick={handlePushData}
                  disabled={syncDirection !== "idle" || !gasUrl}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all font-sans"
                >
                  <Upload className={`w-4 h-4 ${syncDirection === "pushing" ? "animate-bounce" : ""}`} />
                  {syncDirection === "pushing" ? "Mengunggah..." : "Kirim Data Lokal ke Sheets (Push)"}
                </button>
              </div>

            </div>
          </div>

          {/* Quick specs list */}
          <div className="bg-slate-900 text-slate-400 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-white font-display text-xs uppercase tracking-wider flex items-center gap-1.5">
              <CloudLightning className="w-4 h-4 text-emerald-400" />
              Skema Sinkronisasi
            </h3>
            
            <p className="text-xs leading-relaxed text-slate-350">
              Apps Script akan secara otomatis mendeteksi dan membuat tab sheet untuk masing-masing kriteria di bawah ini:
            </p>

            <div className="space-y-3 font-mono text-[11px]">
              <div className="p-2.5 bg-slate-850 rounded border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-white font-bold block">1. warga</span>
                  <p className="text-3xs text-slate-500 mt-0.5">Buku induk kependudukan</p>
                </div>
                <span className="text-3xs bg-emerald-950 font-bold px-1.5 py-0.5 rounded text-emerald-400 uppercase">Sheets</span>
              </div>

              <div className="p-2.5 bg-slate-850 rounded border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-white font-bold block">2. rws</span>
                  <p className="text-3xs text-slate-500 mt-0.5">Index ketua & daerah RW</p>
                </div>
                <span className="text-3xs bg-emerald-950 font-bold px-1.5 py-0.5 rounded text-emerald-400 uppercase">Sheets</span>
              </div>

              <div className="p-2.5 bg-slate-850 rounded border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-white font-bold block">3. iuran</span>
                  <p className="text-3xs text-slate-500 mt-0.5">Target & Status Pembayaran</p>
                </div>
                <span className="text-3xs bg-emerald-950 font-bold px-1.5 py-0.5 rounded text-emerald-400 uppercase">Sheets</span>
              </div>

              <div className="p-2.5 bg-slate-850 rounded border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-white font-bold block">4. transaksi</span>
                  <p className="text-3xs text-slate-500 mt-0.5">Kas Bendahara Masuk/Keluar</p>
                </div>
                <span className="text-3xs bg-emerald-950 font-bold px-1.5 py-0.5 rounded text-emerald-400 uppercase">Sheets</span>
              </div>

              <div className="p-2.5 bg-slate-850 rounded border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-white font-bold block">5. pengajuan</span>
                  <p className="text-3xs text-slate-500 mt-0.5">Proposal Bansos & Rutilahu</p>
                </div>
                <span className="text-3xs bg-emerald-950 font-bold px-1.5 py-0.5 rounded text-emerald-400 uppercase">Sheets</span>
              </div>

              <div className="p-2.5 bg-slate-850 rounded border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-white font-bold block">6. laporan</span>
                  <p className="text-3xs text-slate-500 mt-0.5">Aspirasi, Insiden, & Kegiatan</p>
                </div>
                <span className="text-3xs bg-emerald-950 font-bold px-1.5 py-0.5 rounded text-emerald-400 uppercase">Sheets</span>
              </div>

              <div className="p-2.5 bg-slate-850 rounded border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-white font-bold block">7. mutasi</span>
                  <p className="text-3xs text-slate-500 mt-0.5">Silsilah Peristiwa LAMPID</p>
                </div>
                <span className="text-3xs bg-emerald-950 font-bold px-1.5 py-0.5 rounded text-emerald-400 uppercase">Sheets</span>
              </div>
            </div>

            <div className="bg-emerald-950/40 p-3.5 border border-emerald-900 rounded-lg text-2xs text-emerald-300">
              <span className="font-bold uppercase tracking-wider block mb-1">💡 Tips Fleksibilitas:</span>
              Menghubungkan ke Google Sheets mempermudah integrasi dengan software visualisasi seperti Google Looker Studio atau pembuatan laporan PDF cetak otomatis.
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-white border border-slate-150 rounded-xl p-6 space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-800 font-display text-base">Panduan Penyalinan & Deployment Apps Script</h3>
            <p className="text-sm text-slate-500">
              Ikuti 5 langkah mudah berikut ini untuk mengaktifkan database spreadsheet online Anda kurang dari 3 menit:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="p-4 bg-slate-50 border rounded-lg space-y-2">
              <span className="h-6 w-6 font-bold font-sans bg-slate-200 text-slate-800 rounded-full flex items-center justify-center text-xs">1</span>
              <strong className="text-xs text-slate-800 block">Buat Spreadsheet</strong>
              <p className="text-3xs text-slate-500">Buka <a href="https://sheets.new" target="_blank" className="text-emerald-600 underline font-semibold">sheets.new</a> untuk membuat Google Spreadsheet baru.</p>
            </div>

            <div className="p-4 bg-slate-50 border rounded-lg space-y-2">
              <span className="h-6 w-6 font-bold font-sans bg-slate-200 text-slate-800 rounded-full flex items-center justify-center text-xs">2</span>
              <strong className="text-xs text-slate-800 block">Buka Apps Script</strong>
              <p className="text-3xs text-slate-500">Pilih menu <strong>Ekstensi</strong> di bilah atas, lalu klik <strong>Apps Script</strong>.</p>
            </div>

            <div className="p-4 bg-slate-50 border rounded-lg space-y-2">
              <span className="h-6 w-6 font-bold font-sans bg-slate-200 text-slate-800 rounded-full flex items-center justify-center text-xs">3</span>
              <strong className="text-xs text-slate-800 block">Tempel Kode</strong>
              <p className="text-3xs text-slate-500">Salin kode lengkap di bawah ini seutuhnya dan tempel ke dalam editor Apps Script.</p>
            </div>

            <div className="p-4 bg-slate-50 border rounded-lg space-y-2">
              <span className="h-6 w-6 font-bold font-sans bg-slate-200 text-slate-800 rounded-full flex items-center justify-center text-xs">4</span>
              <strong className="text-xs text-slate-800 block">Deploy Web App</strong>
              <p className="text-3xs text-slate-500">Klik <strong>Terapkan (Deploy)</strong> -&gt; <strong>Penerapan Baru</strong>. Pilih jenis: <strong>Aplikasi Web</strong>.</p>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-lg space-y-2">
              <span className="h-6 w-6 font-bold font-sans bg-emerald-200 text-emerald-800 rounded-full flex items-center justify-center text-xs">5</span>
              <strong className="text-xs text-emerald-850 block">Setel Otorisasi *</strong>
              <p className="text-3xs text-emerald-700">Pastikan <strong>Jalankan sebagai: 'Saya (Me)'</strong> dan <strong>Akses: 'Siapa saja (Anyone)'</strong>.</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Salin Kode Apps Script (.gs) di Bawah Ini:</span>
              <button
                onClick={copyToClipboard}
                className="bg-slate-800 hover:bg-slate-900 border text-slate-100 px-3 py-1.5 rounded-md text-2xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                {isCopied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Kode Berhasil Disalin!
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3.5 h-3.5" />
                    Salin Kode Apps Script
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 bg-slate-900 text-slate-300 rounded-xl font-mono text-[11px] overflow-x-auto border max-h-[400px]">
              {appsScriptCode}
            </pre>
          </div>
        </div>
      )}

    </div>
  );
}
