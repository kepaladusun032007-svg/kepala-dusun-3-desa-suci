/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Warga, RW, Pengajuan, User, PengajuanStatus, PengajuanJenis } from "../types";
import { PRESET_PHOTOS } from "../dataStore";
import { Plus, CheckCircle2, XCircle, AlertCircle, FileText, Image as ImageIcon, Send, Trash2, Edit3, MessageSquare } from "lucide-react";

interface PengajuanPanelProps {
  warga: Warga[];
  rws: RW[];
  pengajuan: Pengajuan[];
  currentUser: User;
  onUpdatePengajuan: (updatedPengajuan: Pengajuan[]) => void;
}

export default function PengajuanPanel({
  warga,
  rws,
  pengajuan,
  currentUser,
  onUpdatePengajuan
}: PengajuanPanelProps) {
  // Tabs for statuses
  const [activeTab, setActiveTab] = useState<"Semua" | "Kirim" | "Verifikasi" | "Setuju" | "Tolak">("Semua");

  // Form states
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedApplicantWargaId, setSelectedApplicantWargaId] = useState<number>(0);
  const [formJenis, setFormJenis] = useState<PengajuanJenis>("Rutilahu");
  const [formDeskripsi, setFormDeskripsi] = useState("");
  const [formFotoList, setFormFotoList] = useState<string[]>([]);
  const [formError, setFormError] = useState("");

  // Approval review states
  const [viewingSubmit, setViewingSubmit] = useState<Pengajuan | null>(null);
  const [adminComment, setAdminComment] = useState("");

  // Filter pengajuan based on role restraints
  const filteredSubmissions = pengajuan.filter(p => {
    // 1. RBAC Check: Ketua RW only sees bids from their own RW
    if (currentUser.role === "User" && p.rwId !== currentUser.rwId) {
      return false;
    }
    // 2. Tab Filter
    if (activeTab === "Semua") return true;
    return p.status === activeTab;
  });

  // Eligible applicants options: Head of families or active citizens in the relevant RW
  const selectableWarga = warga.filter(w => {
    if (w.status !== "Aktif") return false;
    if (currentUser.role === "User" && w.rwId !== currentUser.rwId) {
      return false;
    }
    return true;
  });

  // Handle Photo input (converts image files to base64, up to 3)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (formFotoList.length >= 3) {
        setFormError("Maksimal lampiran hanya diperbolehkan hingga 3 foto.");
        return;
      }
      if (file.size > 1024 * 1024) {
        setFormError("File foto terlalu besar. Maksimal berukuran 1MB.");
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

  // Pre-load preset helper to let users choose pre-uploaded photos instantly
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

  // Open proposal form
  const openProposalModal = () => {
    if (selectableWarga.length === 0) {
      alert("Belum ada data warga terdaftar untuk didaftarkan sebagai pemohon bantuan.");
      return;
    }
    setSelectedApplicantWargaId(selectableWarga[0].id);
    setFormJenis("Rutilahu");
    setFormDeskripsi("");
    setFormFotoList([]);
    setFormError("");
    setIsSubmitModalOpen(true);
  };

  // Create submission
  const handleCreateSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDeskripsi) {
      setFormError("Deskripsi detail kebutuhan bantuan kependudukan wajib diisi.");
      return;
    }

    const applicant = warga.find(w => w.id === selectedApplicantWargaId);
    if (!applicant) return;

    const newId = pengajuan.length > 0 ? Math.max(...pengajuan.map(p => p.id)) + 1 : 1;
    const newProposal: Pengajuan = {
      id: newId,
      wargaId: selectedApplicantWargaId,
      rwId: applicant.rwId,
      jenis: formJenis,
      deskripsi: formDeskripsi,
      tanggal: new Date().toISOString().replace("T", " ").substring(0, 19),
      status: "Kirim", // Direct send to Admin
      fotoList: formFotoList
    };

    onUpdatePengajuan([newProposal, ...pengajuan]);
    setIsSubmitModalOpen(false);
  };

  // Action status updates (Admin-only approved/rejected or verified)
  const handleUpdateStatus = (id: number, targetStatus: PengajuanStatus) => {
    if (currentUser.role !== "Admin") {
      alert("Hanya Kepala Dusun (Admin) yang dapat memverifikasi atau merestui program bantuan.");
      return;
    }

    const updated = pengajuan.map(p => {
      if (p.id === id) {
        return {
          ...p,
          status: targetStatus,
          komentar: adminComment || p.komentar
        };
      }
      return p;
    });

    onUpdatePengajuan(updated);
    setViewingSubmit(null);
    setAdminComment("");
  };

  // Delete draft helper
  const handleDeleteProposal = (id: number) => {
    if (confirm("Apakah Anda yakin ingin membatalkan pengajuan bantuan sosial ini?")) {
      const updated = pengajuan.filter(p => p.id !== id);
      onUpdatePengajuan(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 font-display">Modul Pengajuan Bantuan Kependudukan & Sosial</h2>
          <p className="text-sm text-slate-500 mt-1">
            Mengajukan program bantuan sosial (Rutilahu, Pembangunan Infrastruktur RW, Program Sembako, dll.) dengan dokumentasi lapangan.
          </p>
        </div>

        {currentUser.role === "User" && (
          <button
            onClick={openProposalModal}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg transition-colors cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            Buat Pengajuan Baru
          </button>
        )}
      </div>

      {/* Structured tabs for Status Tracking */}
      <div className="flex border-b border-slate-200 gap-2">
        {(["Semua", "Kirim", "Verifikasi", "Setuju", "Tolak"] as const).map((tab) => {
          const count = pengajuan.filter(p => {
            if (currentUser.role === "User" && p.rwId !== currentUser.rwId) return false;
            return tab === "Semua" || p.status === tab;
          }).length;
          
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
                activeTab === tab
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab === "Semua" ? "Semua Pengajuan" :
               tab === "Kirim" ? "Terkirim / Baru" :
               tab === "Verifikasi" ? "Verifikasi Lapangan" :
               tab === "Setuju" ? "Disetujui" : "Ditolak"}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-3xs font-bold leading-none ${
                activeTab === tab ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main card representation cards of list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredSubmissions.length === 0 ? (
          <div className="bg-white col-span-2 p-10 text-center text-slate-400 rounded-xl border border-dashed border-slate-200">
            <AlertCircle className="w-8 h-8 mx-auto stroke-1 mb-2 text-slate-300" />
            Belum ada berkas pengajuan bantuan sosial di kategori ini.
          </div>
        ) : (
          filteredSubmissions.map((p) => {
            const applicantWarga = warga.find(w => w.id === p.wargaId);
            return (
              <div key={p.id} className="bg-white border border-slate-100 rounded-xl shadow-xs p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-3xs font-semibold uppercase ${
                        p.jenis === "Rutilahu" ? "bg-orange-100 text-orange-850" :
                        p.jenis === "Pembangunan" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                      }`}>
                        {p.jenis === "Rutilahu" ? "Rutilahu (Rehabilitasi Rumah)" :
                         p.jenis === "Pembangunan" ? "Pembangunan Infrastruktur" : "Bansos Sembako / Lainnya"}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-800 mt-2">
                        Pemohon: {applicantWarga ? applicantWarga.nama : "Warga Dihapus"}
                      </h4>
                      <p className="text-3xs text-slate-400 font-mono mt-0.5">NIK: {applicantWarga?.nik} &bull; {p.rwId}</p>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-bold uppercase uppercase tracking-wider ${
                      p.status === "Kirim" ? "bg-blue-50 text-blue-700" :
                      p.status === "Verifikasi" ? "bg-amber-50 text-amber-700" :
                      p.status === "Setuju" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}>
                      {p.status === "Kirim" ? "Baru / Terkirim" :
                       p.status === "Verifikasi" ? "Verifikasi Lapangan" :
                       p.status === "Setuju" ? "Disetujui" : "Ditolak"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-3.5 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {p.deskripsi}
                  </p>

                  {/* Attachment photos thumbnails list */}
                  {p.fotoList && p.fotoList.length > 0 && (
                    <div className="mt-3.5 space-y-1.5">
                      <span className="block text-3xs font-semibold text-slate-400 uppercase tracking-wide">Lampiran Foto Lapangan:</span>
                      <div className="flex flex-wrap gap-2">
                        {p.fotoList.map((foto, fIdx) => (
                          <div key={fIdx} className="relative h-14 w-20 rounded-md border overflow-hidden cursor-pointer hover:opacity-95" onClick={() => window.open(foto)}>
                            <img src={foto} className="w-full h-full object-cover" alt="Lampiran" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comment feedback if exists */}
                  {p.komentar && (
                    <div className="mt-4 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-start gap-2 text-xs text-indigo-950">
                      <MessageSquare className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">Tanggapan Kepala Dusun:</strong>
                        {p.komentar}
                      </div>
                    </div>
                  )}
                </div>

                {/* Foot actionable values */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-400">
                  <span>Diajukan: {p.tanggal}</span>
                  
                  <div className="flex items-center gap-2">
                    {currentUser.role === "Admin" && p.status !== "Setuju" && p.status !== "Tolak" && (
                      <button
                        onClick={() => { setViewingSubmit(p); setAdminComment(p.komentar || ""); }}
                        className="bg-slate-800 hover:bg-slate-900 font-semibold text-white px-3 py-1.5 rounded transition-all cursor-pointer"
                      >
                        Tinjau & Validasi
                      </button>
                    )}
                    {currentUser.role === "User" && p.status === "Kirim" && (
                      <button
                        onClick={() => handleDeleteProposal(p.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        title="Batalkan Pengajuan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Creation Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="bg-emerald-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-base font-display">Pembuatan Formulir Pengajuan Bantuan Sosial</h3>
              <button onClick={() => setIsSubmitModalOpen(false)} className="text-white hover:text-white/80 text-lg font-bold cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleCreateSubmission} className="p-5 space-y-4 text-slate-700">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-150 text-rose-700 text-xs rounded-lg">{formError}</div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-650">Pilih Warga Pemohon Bantuan *</label>
                <select
                  value={selectedApplicantWargaId}
                  onChange={(e) => setSelectedApplicantWargaId(parseInt(e.target.value))}
                  className="w-full bg-slate-50 text-slate-800 text-sm px-3 py-2.5 rounded-lg border mt-1"
                >
                  {selectableWarga.map((w) => (
                    <option key={w.id} value={w.id}>{w.nama} (NIK {w.nik} - {w.rwId})</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">Hanya menampilkan warga berstatus aktif di wilayah kinerjamu.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-650">Jenis Pengajuan *</label>
                <select
                  value={formJenis}
                  onChange={(e) => setFormJenis(e.target.value as PengajuanJenis)}
                  className="w-full bg-slate-50 text-slate-800 text-sm px-3 py-2.5 rounded-lg border mt-1"
                >
                  <option value="Rutilahu">Rutilahu (Rehab Rumah Tidak Layak Huni)</option>
                  <option value="Pembangunan">Pembangunan Infrastruktur Lingkungan RW</option>
                  <option value="Bansos">Bansos Lainnya (Sembako, Beras Sejahtera, PKH)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-650">Deskripsi Detail Kebutuhan & Kondisi di Lapangan *</label>
                <textarea
                  required
                  placeholder="Deskripsikan sedetail mungkin mengapa warga bersangkutan sangat membutuhkan bansos ini..."
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 text-slate-800 text-sm px-3.5 py-2 rounded-lg border mt-1 focus:outline-none focus:bg-white"
                />
              </div>

              {/* Photo Upload Attachment and quick preset indicators */}
              <div>
                <label className="block text-xs font-semibold text-slate-650 mb-1.5">Lampiran Foto (Hingga 3 Foto)</label>
                
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {formFotoList.map((foto, idx) => (
                    <div key={idx} className="relative h-16 bg-slate-100 rounded border overflow-hidden">
                      <img src={foto} className="w-full h-full object-cover" alt="Upload Preview" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => removeFotoFromList(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full h-4.5 w-4.5 text-3xs font-bold leading-none cursor-pointer flex items-center justify-center shadow-xs"
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
                        onChange={handlePhotoChangeUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        title="Upload file"
                      />
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                      <span className="text-[9px] mt-0.5">Unggah</span>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border text-[11px] text-slate-500">
                  <span className="font-semibold block text-slate-600 mb-1">Opsi Generator Foto Cepat (Simulasi Gambar):</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => injectPresetPhoto("rutilahu1")} className="bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded text-2xs cursor-pointer">Foto Rumah Lapuk</button>
                    <button type="button" onClick={() => injectPresetPhoto("rutilahu2")} className="bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded text-2xs cursor-pointer">Foto Dinding Retak</button>
                    <button type="button" onClick={() => injectPresetPhoto("posyandu")} className="bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded text-2xs cursor-pointer">Foto Posyandu</button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 border text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal for Admin */}
      {viewingSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-base font-display">Tinjau Validasi Pengajuan Berkas</h3>
              <button onClick={() => setViewingSubmit(null)} className="text-white hover:text-white/80 text-lg font-bold cursor-pointer">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-lg border space-y-1 text-xs">
                <div><span className="text-slate-400 font-medium">Pemohon:</span> <strong className="text-slate-800">{warga.find(w => w.id === viewingSubmit.wargaId)?.nama}</strong></div>
                <div><span className="text-slate-400 font-medium">Asal RW:</span> <strong className="text-slate-800">{viewingSubmit.rwId}</strong></div>
                <div><span className="text-slate-400 font-medium font-sans">Kebutuhan:</span> <p className="text-slate-600 mt-1 leading-relaxed italic">"{viewingSubmit.deskripsi}"</p></div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400">Tanggapan / Catatan Keputusan Kepala Dusun</label>
                <textarea
                  placeholder="Tuliskan keterangan detail persetujuan atau alasan penolakan berkas..."
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 text-slate-800 text-sm px-3.5 py-2 rounded-lg border mt-1 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t flex flex-wrap justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(viewingSubmit.id, "Verifikasi")}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Minta Verifikasi Lapangan
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(viewingSubmit.id, "Tolak")}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Tolak
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(viewingSubmit.id, "Setuju")}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Setujui
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  // Separate dummy uploader trigger helper
  function handlePhotoChangeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    handlePhotoUpload(e);
  }
}
