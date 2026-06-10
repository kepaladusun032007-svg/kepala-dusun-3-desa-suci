/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Warga, RW, Laporan, User, LaporanKategori } from "../types";
import { PRESET_PHOTOS } from "../dataStore";
import { Plus, Check, MapPin, Eye, FileSpreadsheet, Image as ImageIcon, Send, MessageSquare, Archive, ShieldQuestion } from "lucide-react";

interface LaporanPanelProps {
  warga: Warga[];
  rws: RW[];
  laporan: Laporan[];
  currentUser: User;
  onUpdateLaporan: (updatedLaporan: Laporan[]) => void;
}

export default function LaporanPanel({
  warga,
  rws,
  laporan,
  currentUser,
  onUpdateLaporan
}: LaporanPanelProps) {
  // Filters
  const [filterKategori, setFilterKategori] = useState<string>("Semua");
  const [filterRwId, setFilterRwId] = useState<string>(currentUser.role === "User" ? currentUser.rwId || "RW 01" : "Semua");

  // Form states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [formKategori, setFormKategori] = useState<LaporanKategori>("Kegiatan");
  const [formDeskripsi, setFormDeskripsi] = useState("");
  const [selectedWargaReporter, setSelectedWargaReporter] = useState<number>(0);
  const [formFotoList, setFormFotoList] = useState<string[]>([]);
  const [selectedRwReportLocation, setSelectedRwReportLocation] = useState<string>(currentUser.role === "User" ? currentUser.rwId || "RW 01" : "RW 01");
  const [formError, setFormError] = useState("");

  // Commentary states
  const [viewingReport, setViewingReport] = useState<Laporan | null>(null);
  const [commentText, setCommentText] = useState("");

  // Filtering
  const filteredReports = laporan.filter(l => {
    const matchesRw = filterRwId === "Semua" || l.rwId === filterRwId;
    const matchesKategori = filterKategori === "Semua" || l.kategori === filterKategori;
    return matchesRw && matchesKategori;
  });

  // Filter possible citizens who can be logged as "Pelapor" (Optional)
  const selectableWarga = warga.filter(w => {
    if (currentUser.role === "User" && w.rwId !== currentUser.rwId) return false;
    return w.status === "Aktif";
  });

  // Handle Foto selection files
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (formFotoList.length >= 3) {
        setFormError("Maksimal lampiran hanya diperbolehkan hingga 3 foto.");
        return;
      }
      if (file.size > 1024 * 1024) {
        setFormError("Ukuran file foto maksimal berukuran 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setFormFotoList([...formFotoList, reader.result]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Preset quick upload injects
  const injectPresetPhoto = (presetKey: keyof typeof PRESET_PHOTOS) => {
    if (formFotoList.length >= 3) {
      setFormError("Maksimal lampiran hanya diperbolehkan hingga 3 foto.");
      return;
    }
    setFormFotoList([...formFotoList, PRESET_PHOTOS[presetKey]]);
  };

  const removeFotoFromList = (idx: number) => {
    setFormFotoList(formFotoList.filter((_, i) => i !== idx));
  };

  // Submit Report
  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDeskripsi) {
      setFormError("Uraian keterangan laporan wajib ditulis.");
      return;
    }

    const newId = laporan.length > 0 ? Math.max(...laporan.map(l => l.id)) + 1 : 1;
    const newReport: Laporan = {
      id: newId,
      rwId: currentUser.role === "User" ? currentUser.rwId || "RW 01" : selectedRwReportLocation,
      wargaId: selectedWargaReporter > 0 ? selectedWargaReporter : undefined,
      kategori: formKategori,
      deskripsi: formDeskripsi,
      tanggal: new Date().toISOString().replace("T", " ").substring(0, 19),
      fotoList: formFotoList,
      status: "Diproses"
    };

    onUpdateLaporan([newReport, ...laporan]);
    setIsReportModalOpen(false);
  };

  // Submit Comment / Status update by Admin (Kepala Dusun)
  const handleUpdateReportState = (id: number, targetStatus: Laporan["status"]) => {
    const updated = laporan.map(l => {
      if (l.id === id) {
        return {
          ...l,
          status: targetStatus,
          komentarAdmin: commentText || l.komentarAdmin
        };
      }
      return l;
    });

    onUpdateLaporan(updated);
    setViewingReport(null);
    setCommentText("");
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 font-display">Laporan Kegiatan & Pengaduan Warga</h2>
          <p className="text-sm text-slate-500 mt-1">
            Portal pendataan kegiatan RW, pelaporan musibah darurat, serta penampungan pengaduan/aspirasi warga Dusun 3 Ds. Suci.
          </p>
        </div>

        <button
          onClick={() => {
            setFormDeskripsi("");
            setFormFotoList([]);
            setSelectedWargaReporter(0);
            setFormError("");
            setIsReportModalOpen(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg transition-colors cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Kirim Laporan Baru
        </button>
      </div>

      {/* Grid filters bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kategori Laporan:</span>
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="bg-slate-50 text-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-200"
          >
            <option value="Semua">Semua Kategori</option>
            <option value="Kegiatan">Kegiatan RW (Sosialisasi, Kerja Bakti)</option>
            <option value="Kejadian">Kejadian Luar Biasa (Darurat, Bencana)</option>
            <option value="Pengaduan">Pengaduan Warga (Fasilitas Rusak, Aspirasi)</option>
          </select>
        </div>

        {currentUser.role === "Admin" && (
          <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Asal RW:</span>
            <select
              value={filterRwId}
              onChange={(e) => setFilterRwId(e.target.value)}
              className="bg-slate-50 text-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-200"
            >
              <option value="Semua">Semua RW</option>
              {rws.map(rw => (
                <option key={rw.id} value={rw.id}>{rw.id} ({rw.namaKetua})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main card representation cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredReports.length === 0 ? (
          <div className="bg-white col-span-2 p-10 text-center text-slate-400 rounded-xl border border-dashed border-slate-200">
            <ShieldQuestion className="w-8 h-8 mx-auto stroke-1 mb-2 text-slate-300" />
            Belum ada laporan kegiatan atau pengaduan tercatat yang sesuai filter ini.
          </div>
        ) : (
          filteredReports.map((l) => {
            const reporter = l.wargaId ? warga.find(w => w.id === l.wargaId) : null;
            return (
              <div key={l.id} className="bg-white border border-slate-150 rounded-xl shadow-xs p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded text-3xs font-semibold uppercase ${
                        l.kategori === "Kegiatan" ? "bg-emerald-100 text-emerald-800" :
                        l.kategori === "Kejadian" ? "bg-rose-100 text-rose-800" : "bg-purple-100 text-purple-800"
                      }`}>
                        {l.kategori === "Kegiatan" ? "Kerja Bakti / Kegiatan RW" :
                         l.kategori === "Kejadian" ? "Kejadian Luar Biasa (Darurat)" : "Pengaduan / Aspirasi"}
                      </span>
                      <p className="text-3xs text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-350" />
                        Lokasi: {l.rwId} &bull; {l.tanggal}
                      </p>
                    </div>

                    <span className={`inline-block px-2 py-0.5 rounded text-3xs font-bold uppercase ${
                      l.status === "Selesai" ? "bg-emerald-50 text-emerald-700" :
                      l.status === "Arsip" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-800"
                    }`}>
                      {l.status === "Diproses" ? "Sedang Diproses" :
                       l.status === "Selesai" ? "Selesai Ditindak" : "Diarsip"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-3 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                    "{l.deskripsi}"
                  </p>

                  {/* Sub reporter mapping if available */}
                  {reporter && (
                    <span className="text-[10px] text-slate-450 block mt-2.5">
                      Pelapor / Pengadu Warga: <strong>{reporter.nama}</strong> (NIK {reporter.nik})
                    </span>
                  )}

                  {/* Photos list thumbnails */}
                  {l.fotoList && l.fotoList.length > 0 && (
                    <div className="mt-4 space-y-1">
                      <span className="text-[10px] font-semibold text-slate-405 uppercase tracking-wide">Lampiran Foto Dokumentasi ({l.fotoList.length}):</span>
                      <div className="flex gap-2.5">
                        {l.fotoList.map((foto, fIdx) => (
                          <div key={fIdx} className="h-12 w-16 bg-slate-100 border rounded overflow-hidden cursor-pointer hover:opacity-90" onClick={() => window.open(foto)}>
                            <img src={foto} className="w-full h-full object-cover" alt="Dokumentasi Laporan" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments from Administration Admin Dusun */}
                  {l.komentarAdmin && (
                    <div className="mt-4 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-start gap-2 text-xs text-indigo-950">
                      <MessageSquare className="w-4 h-4 text-indigo-505 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">Tindak Lanjut & Tanggapan Dusun:</strong>
                        {l.komentarAdmin}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                  {currentUser.role === "Admin" && l.status !== "Selesai" && (
                    <button
                      onClick={() => { setViewingReport(l); setCommentText(l.komentarAdmin || ""); }}
                      className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3.5 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Tanggapi Laporan
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Creation Modal form */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="bg-indigo-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-base font-display">Penyusunan Laporan & Pengaduan RT/RW</h3>
              <button onClick={() => setIsReportModalOpen(false)} className="text-white hover:text-white/85 text-lg font-bold cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleCreateReport} className="p-5 space-y-4 text-slate-700">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-150 text-rose-700 text-xs rounded-lg">{formError}</div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-650">Kategori Laporan *</label>
                  <select
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value as LaporanKategori)}
                    className="w-full bg-slate-50 text-slate-850 text-sm px-3.5 py-2.5 rounded-lg border mt-1"
                  >
                    <option value="Kegiatan">Kegiatan RW (Dinas, Kerja Bakti)</option>
                    <option value="Kejadian">Kejadian Darurat (Kebencanaan)</option>
                    <option value="Pengaduan">Pengaduan Umum (Infrastruktur Rusak)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-650">Lokasi / Wilayah RW *</label>
                  <select
                    value={selectedRwReportLocation}
                    onChange={(e) => setSelectedRwReportLocation(e.target.value)}
                    disabled={currentUser.role === "User"}
                    className="w-full bg-slate-50 text-slate-800 text-sm px-3.5 py-2.5 rounded-lg border mt-1"
                  >
                    {rws.map(rw => (
                      <option key={rw.id} value={rw.id}>{rw.id} ({rw.namaKetua})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-650">Warga Pelapor (Opsional)</label>
                <select
                  value={selectedWargaReporter}
                  onChange={(e) => setSelectedWargaReporter(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 text-slate-800 text-sm px-3.5 py-2.5 rounded-lg border mt-1"
                >
                  <option value={0}>-- Anonim / Diwakilkan Ketua RW --</option>
                  {selectableWarga.map((w) => (
                    <option key={w.id} value={w.id}>{w.nama} (NIK {w.nik})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-650">Uraian Detail Laporan *</label>
                <textarea
                  required
                  placeholder="Deskripsikan agenda kegiatan, kronologi kejadian luar biasa, atau keluhan infrastruktur sedetail mungkin..."
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 text-slate-800 text-sm px-3.5 py-2 rounded-lg border mt-1 focus:outline-none"
                />
              </div>

              {/* Photo upload / preset block */}
              <div>
                <label className="block text-xs font-semibold text-slate-650 mb-1.5">Unggah Foto Lampiran Laporan (Hingga 3 Foto)</label>
                
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {formFotoList.map((foto, idx) => (
                    <div key={idx} className="relative h-16 bg-slate-100 rounded border overflow-hidden">
                      <img src={foto} className="w-full h-full object-cover" alt="Upload Preview" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => removeFotoFromList(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full h-4.5 w-4.5 text-3xs font-bold leading-none flex items-center justify-center cursor-pointer shadow-xs"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  
                  {formFotoList.length < 3 && (
                    <div className="h-16 border-2 border-dashed border-slate-200 rounded flex flex-col items-center justify-center text-slate-400 bg-slate-50 relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        title="File image"
                      />
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                      <span className="text-[9px] mt-0.5">Unggah</span>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border text-[11px] text-slate-500">
                  <span className="font-semibold block text-slate-600 mb-1">Simulasi Generator Foto Cepat:</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => injectPresetPhoto("kerjaBakti")} className="bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded text-2xs cursor-pointer">Foto Kerja Bakti</button>
                    <button type="button" onClick={() => injectPresetPhoto("jalanRusak")} className="bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded text-2xs cursor-pointer">Foto Jalan Rusak</button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 border text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-900 hover:bg-indigo-955 text-white font-medium rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  Kirim Lapor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tanggapi / Comment Modal boxes */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-base font-display">Tindak Lanjut & Tanggapan Dusun</h3>
              <button onClick={() => setViewingReport(null)} className="text-white hover:text-white/80 text-lg font-bold cursor-pointer">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-lg border space-y-1 text-xs">
                <div><span className="text-slate-400 font-medium">Laporan:</span> <strong className="text-slate-800 italic">"{viewingReport.deskripsi}"</strong></div>
                <div><span className="text-slate-400 font-medium">Asal RW:</span> <strong className="text-slate-800">{viewingReport.rwId}</strong></div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400">Pemberian Respon & Arahan Tindak Lanjut</label>
                <textarea
                  placeholder="Mis. Tim lapangan desa akan mengunjungi lokasi minggu ini, atau instruksi kerja..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 text-slate-800 text-sm px-3.5 py-2.5 rounded-lg border mt-1 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="pt-2 border-t flex justify-between gap-2 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => handleUpdateReportState(viewingReport.id, "Arsip")}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Archive className="w-4 h-4" />
                  Arsipkan
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateReportState(viewingReport.id, "Selesai")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Tandai Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
