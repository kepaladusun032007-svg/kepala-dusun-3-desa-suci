/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Warga, RW, Pengajuan, User, PengajuanStatus, PengajuanJenis } from "../types";
import { PRESET_PHOTOS } from "../dataStore";
import { compressImage } from "../utils/imageCompressor";
import { Plus, CheckCircle2, XCircle, AlertCircle, FileText, Image as ImageIcon, Send, Trash2, Edit3, MessageSquare, Camera, Eye, X } from "lucide-react";

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
  const [editingProposalId, setEditingProposalId] = useState<number | null>(null);
  const [selectedApplicantWargaId, setSelectedApplicantWargaId] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [formJenis, setFormJenis] = useState<PengajuanJenis>("Rutilahu");
  const [formDeskripsi, setFormDeskripsi] = useState("");
  const [formFotoList, setFormFotoList] = useState<string[]>([]);
  const [formError, setFormError] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Detailed presentation states
  const [selectedDetailSubmission, setSelectedDetailSubmission] = useState<Pengajuan | null>(null);

  // Approval review states (Admin modal)
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

  const filteredWargaOptions = selectableWarga.filter(w => {
    const nameStr = w.nama ? String(w.nama).toLowerCase() : "";
    const nikStr = w.nik ? String(w.nik).toLowerCase() : "";
    const query = searchQuery ? String(searchQuery).toLowerCase() : "";
    return nameStr.includes(query) || nikStr.includes(query);
  });

  // Handle Photo input (compresses and converts image files to compact base64)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (formFotoList.length >= 3) {
        setFormError("Maksimal lampiran hanya diperbolehkan hingga 3 foto.");
        return;
      }
      try {
        setFormError("");
        const compressedBase64 = await compressImage(file);
        setFormFotoList([...formFotoList, compressedBase64]);
      } catch (err) {
        console.error("Gagal memproses gambar:", err);
        setFormError("Gagal memuat & mengompresi gambar. Coba file lain.");
      }
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
    const firstW = selectableWarga[0];
    setEditingProposalId(null);
    setSelectedApplicantWargaId(firstW.id);
    setSearchQuery(firstW.nama);
    setFormJenis("Rutilahu");
    setFormDeskripsi("");
    setFormFotoList([]);
    setFormError("");
    setIsSubmitModalOpen(true);
  };

  // Edit proposal
  const openEditProposalModal = (p: Pengajuan, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setEditingProposalId(p.id);
    setSelectedApplicantWargaId(p.wargaId);
    const applicant = warga.find(w => w.id === p.wargaId);
    setSearchQuery(applicant ? applicant.nama : "");
    setFormJenis(p.jenis);
    setFormDeskripsi(p.deskripsi);
    setFormFotoList(p.fotoList || []);
    setFormError("");
    setIsSubmitModalOpen(true);
  };

  // Save/Create submission handler
  const handleSaveSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplicantWargaId) {
      setFormError("Silakan pilih warga pemohon bantuan terlebih dahulu.");
      return;
    }
    if (!formDeskripsi) {
      setFormError("Deskripsi detail kebutuhan bantuan kependudukan wajib diisi.");
      return;
    }

    const applicant = warga.find(w => w.id === selectedApplicantWargaId);
    if (!applicant) {
      setFormError("Warga yang Anda pilih tidak valid atau berkasnya tidak ditemukan.");
      return;
    }

    if (editingProposalId !== null) {
      // Edit Mode
      const updated = pengajuan.map(p => {
        if (p.id === editingProposalId) {
          return {
            ...p,
            wargaId: selectedApplicantWargaId,
            rwId: applicant.rwId,
            jenis: formJenis,
            deskripsi: formDeskripsi,
            fotoList: formFotoList
          };
        }
        return p;
      });
      onUpdatePengajuan(updated);
      setEditingProposalId(null);
      setIsSubmitModalOpen(false);
      // Update details modal if it is active
      const updatedDetail = updated.find(p => p.id === editingProposalId);
      if (updatedDetail && selectedDetailSubmission?.id === editingProposalId) {
        setSelectedDetailSubmission(updatedDetail);
      }
    } else {
      // Create Mode
      const newId = pengajuan.length > 0 ? Math.max(...pengajuan.map(p => p.id)) + 1 : 1;
      const newProposal: Pengajuan = {
        id: newId,
        wargaId: selectedApplicantWargaId,
        rwId: applicant.rwId,
        jenis: formJenis,
        deskripsi: formDeskripsi,
        tanggal: new Date().toISOString().replace("T", " ").substring(0, 19),
        status: "Kirim",
        fotoList: formFotoList
      };
      onUpdatePengajuan([newProposal, ...pengajuan]);
      setIsSubmitModalOpen(false);
    }
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
    // Update currently viewed detail as well
    const updatedDetail = updated.find(p => p.id === id);
    if (updatedDetail && selectedDetailSubmission?.id === id) {
      setSelectedDetailSubmission(updatedDetail);
    }
  };

  // Delete helper
  const handleDeleteProposal = (id: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (confirm("Apakah Anda yakin ingin menghapus pengajuan bantuan sosial ini secara permanen?")) {
      const updated = pengajuan.filter(p => p.id !== id);
      onUpdatePengajuan(updated);
      if (selectedDetailSubmission?.id === id) {
        setSelectedDetailSubmission(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 font-display">Modul Pengajuan Bantuan Kependudukan & Sosial</h2>
          <p className="text-sm text-slate-500 mt-1">
            Daftar pengajuan bantuan sosial (Rutilahu, Pembangunan RW, Bansos Sembako) dengan pelampiran foto lapangan dan pelacakan status.
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
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1">
        {(["Semua", "Kirim", "Verifikasi", "Setuju", "Tolak"] as const).map((tab) => {
          const count = pengajuan.filter(p => {
            if (currentUser.role === "User" && p.rwId !== currentUser.rwId) return false;
            return tab === "Semua" || p.status === tab;
          }).length;
          
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
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

      {/* Main Grid Submission Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredSubmissions.length === 0 ? (
          <div className="bg-white col-span-2 p-14 text-center text-slate-450 rounded-xl border border-dashed border-slate-200">
            <AlertCircle className="w-9 h-9 mx-auto stroke-1 mb-2.5 text-slate-350" />
            <p className="font-medium text-slate-600">Belum ada berkas pengajuan bantuan sosial di kategori ini.</p>
            <p className="text-2xs text-slate-400 mt-1">Gunakan tombol 'Buat Pengajuan Baru' untuk menambahkan atau ubah filter status.</p>
          </div>
        ) : (
          filteredSubmissions.map((p) => {
            const applicantWarga = warga.find(w => w.id === p.wargaId);
            return (
              <div 
                key={p.id} 
                className="bg-white border border-slate-100 hover:border-emerald-200 rounded-xl shadow-xs hover:shadow-md p-5 flex flex-col justify-between transition-all cursor-pointer group"
                onClick={() => setSelectedDetailSubmission(p)}
              >
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
                      <h4 className="text-sm font-semibold text-slate-805 mt-2 group-hover:text-emerald-700 transition-colors">
                        Pemohon: {applicantWarga ? applicantWarga.nama : "Warga Dihapus"}
                      </h4>
                      <p className="text-3xs text-slate-450 font-mono mt-0.5">NIK: {applicantWarga?.nik} &bull; {p.rwId}</p>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-bold uppercase tracking-wider ${
                      p.status === "Kirim" ? "bg-blue-50 text-blue-700" :
                      p.status === "Verifikasi" ? "bg-amber-50 text-amber-700" :
                      p.status === "Setuju" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}>
                      {p.status === "Kirim" ? "Baru / Terkirim" :
                       p.status === "Verifikasi" ? "Verifikasi Lapangan" :
                       p.status === "Setuju" ? "Disetujui" : "Ditolak"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-3.5 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-100 line-clamp-3">
                    {p.deskripsi}
                  </p>

                  {/* Attachment photos preview */}
                  {p.fotoList && p.fotoList.length > 0 && (
                    <div className="mt-3.5 space-y-1">
                      <span className="block text-3xs font-semibold text-slate-400 uppercase tracking-wide">Lampiran Foto Lapangan:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {p.fotoList.map((foto, fIdx) => (
                          <div key={fIdx} className="relative h-11 w-16 rounded border overflow-hidden">
                            <img src={foto} className="w-full h-full object-cover" alt="Lampiran" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comment feedback */}
                  {p.komentar && (
                    <div className="mt-4 p-2.5 bg-indigo-50/40 rounded-lg border border-indigo-100 text-xs text-indigo-900 line-clamp-2">
                      <strong>Tanggapan:</strong> {p.komentar}
                    </div>
                  )}
                </div>

                {/* Card footer actions */}
                <div 
                  className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>Diajukan: {p.tanggal}</span>
                  
                  <div className="flex items-center gap-1.5">
                    {/* View Details Button */}
                    <button
                      onClick={() => setSelectedDetailSubmission(p)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                      title="Lihat Detail Form"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Edit Button is allowed for and restricted to creator/admin role check */}
                    {((currentUser.role === "User" && p.rwId === currentUser.rwId && p.status === "Kirim") || currentUser.role === "Admin") && (
                      <button
                        onClick={() => openEditProposalModal(p)}
                        className="p-1.5 text-slate-400 hover:text-indigo-650 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                        title="Edit Pengajuan"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete and Cancel */}
                    {((currentUser.role === "User" && p.rwId === currentUser.rwId && p.status === "Kirim") || currentUser.role === "Admin") && (
                      <button
                        onClick={() => handleDeleteProposal(p.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                        title="Hapus Pengajuan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {currentUser.role === "Admin" && p.status !== "Setuju" && p.status !== "Tolak" && (
                      <button
                        onClick={() => { setViewingSubmit(p); setAdminComment(p.komentar || ""); }}
                        className="bg-slate-800 hover:bg-slate-900 font-semibold text-white px-3 py-1.5 rounded text-[10px] transition-all cursor-pointer shadow-xs ml-1"
                      >
                        Validasi
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Creation & Editing Form Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col">
            <div className="bg-emerald-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-base font-display">
                {editingProposalId !== null ? "Ubah/Edit Formulir Pengajuan Bantuan" : "Buat Formulir Pengajuan Bantuan Baru"}
              </h3>
              <button 
                onClick={() => setIsSubmitModalOpen(false)} 
                className="text-white hover:text-white/80 p-1 rounded-full hover:bg-emerald-700 transition-colors text-lg font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmission} className="p-5 space-y-4 text-slate-700 overflow-y-auto flex-1">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-150 text-rose-700 text-xs rounded-lg">{formError}</div>
              )}

              <div ref={dropdownRef} className="relative z-35">
                <label className="block text-xs font-semibold text-slate-650">Pilih Warga Pemohon Bantuan *</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    placeholder="🔎 Ketik nama atau NIK warga..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full bg-slate-50 text-slate-805 text-sm px-3.5 py-2.5 pr-10 rounded-lg border focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-slate-700"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedApplicantWargaId(0);
                        setIsDropdownOpen(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg bg-white py-1 shadow-lg border border-slate-150 text-xs">
                    {filteredWargaOptions.length === 0 ? (
                      <div className="px-4 py-3 text-slate-400 italic text-center">
                        Tidak ada data warga ditemukan
                      </div>
                    ) : (
                      filteredWargaOptions.map((w) => {
                        const isSelected = w.id === selectedApplicantWargaId;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              setSelectedApplicantWargaId(w.id);
                              setSearchQuery(w.nama);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 transition-colors cursor-pointer border-b border-slate-50 last:border-0 flex flex-col ${
                              isSelected 
                                ? "bg-emerald-50 text-emerald-800 font-semibold" 
                                : "hover:bg-slate-50 text-slate-750"
                            }`}
                          >
                            <span className="text-xs font-medium">{w.nama}</span>
                            <span className="text-[10px] text-slate-450 mt-0.5">NIK: {w.nik} &bull; {w.rwId} &bull; Hubungan: {w.hubungan}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {selectedApplicantWargaId > 0 && (
                  (() => {
                    const activeP = selectableWarga.find(w => w.id === selectedApplicantWargaId);
                    if (!activeP) return null;
                    return (
                      <div className="mt-2.5 bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <p className="text-slate-800 font-semibold">{activeP.nama}</p>
                          <p className="text-[10px] text-slate-450 mt-0.5">NIK: {activeP.nik} &bull; {activeP.rwId} &bull; Hubungan: {activeP.hubungan}</p>
                        </div>
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded uppercase">Terpilih</span>
                      </div>
                    );
                  })()
                )}

                <span className="text-[10px] text-slate-400 mt-1 block">Hanya menampilkan warga aktif di wilayah kinerjamu.</span>
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
                  className="w-full bg-slate-50 text-slate-800 text-sm px-3.5 py-2 rounded-lg border mt-1 focus:outline-none focus:bg-white text-slate-700"
                />
              </div>

              {/* Foto Upload Attachment with dedicated CAMERA & GALLERY buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-650 mb-1.5">Lampiran Foto (Hingga 3 Foto)</label>
                
                <div className="grid grid-cols-3 gap-2 mb-3.5">
                  {formFotoList.map((foto, idx) => (
                    <div key={idx} className="relative h-16 bg-slate-100 rounded border overflow-hidden">
                      <img src={foto} className="w-full h-full object-cover" alt="Upload Preview" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => removeFotoFromList(idx)}
                        className="absolute top-1 right-1 bg-red-650 text-white rounded-full h-4.5 w-4.5 text-3xs font-bold leading-none cursor-pointer flex items-center justify-center shadow-xs"
                      >
                        &times;
                      </button>
                    </div>
                  ))}

                  {formFotoList.length < 3 && (
                    <div className="col-span-3">
                      <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-205">
                        {/* Direct camera upload button */}
                        <label className="flex flex-col items-center justify-center p-3.5 bg-white hover:bg-emerald-50/20 border border-slate-200 hover:border-emerald-500 rounded-lg cursor-pointer transition-all text-center">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                          <Camera className="w-5 h-5 text-emerald-600 mb-1" />
                          <span className="text-[11px] font-bold text-slate-700">Ambil Kamera HP</span>
                          <span className="text-[9px] text-slate-400 mt-0.5 font-sans">Potret Langsung</span>
                        </label>

                        {/* Traditional gallery picker */}
                        <label className="flex flex-col items-center justify-center p-3.5 bg-white hover:bg-blue-50/20 border border-slate-200 hover:border-blue-500 rounded-lg cursor-pointer transition-all text-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                          <ImageIcon className="w-5 h-5 text-blue-600 mb-1" />
                          <span className="text-[11px] font-bold text-slate-700">Buka Galeri Foto</span>
                          <span className="text-[9px] text-slate-400 mt-0.5 font-sans">Kompres Otomatis</span>
                        </label>
                      </div>
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
                  Simpaan Berkas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clicking card Detail overlay Modal */}
      {selectedDetailSubmission && (
        <div className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col text-slate-700 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-450" />
                <h3 className="font-semibold text-sm font-mono">DETAIL PENGAJUAN #{selectedDetailSubmission.id}</h3>
              </div>
              <button 
                onClick={() => setSelectedDetailSubmission(null)} 
                className="text-white hover:text-white/80 p-1 rounded-full hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Badge row and header info */}
              <div className="flex items-start justify-between gap-2.5">
                <div>
                  <span className={`inline-flex px-2 py-0.5 rounded text-3xs font-bold uppercase ${
                    selectedDetailSubmission.jenis === "Rutilahu" ? "bg-orange-150 text-orange-850 animate-pulse" :
                    selectedDetailSubmission.jenis === "Pembangunan" ? "bg-blue-105 text-blue-805" : "bg-purple-105 text-purple-805"
                  }`}>
                    {selectedDetailSubmission.jenis === "Rutilahu" ? "Rutilahu (Rehabilitasi Rumah)" :
                     selectedDetailSubmission.jenis === "Pembangunan" ? "Pembangunan Infrastruktur" : "Program Bansos Sembako"}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">Dibuat: {selectedDetailSubmission.tanggal}</p>
                </div>

                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-3xs font-black uppercase tracking-wider ${
                  selectedDetailSubmission.status === "Kirim" ? "bg-blue-100 text-blue-800" :
                  selectedDetailSubmission.status === "Verifikasi" ? "bg-amber-100 text-amber-800" :
                  selectedDetailSubmission.status === "Setuju" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}>
                  {selectedDetailSubmission.status === "Kirim" ? "Kirim (Baru)" :
                   selectedDetailSubmission.status === "Verifikasi" ? "Verifikasi Lapangan" :
                   selectedDetailSubmission.status === "Setuju" ? "Disetujui" : "Ditolak"}
                </span>
              </div>

              {/* Applicant Profile card */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">INFORMASI PEMOHON</span>
                {(() => {
                  const applicant = warga.find(w => w.id === selectedDetailSubmission.wargaId);
                  if (!applicant) return <p className="text-xs text-rose-500 italic">Data warga tidak ditemukan / Dihapus</p>;
                  return (
                    <div className="text-xs grid grid-cols-2 gap-y-2 gap-x-4">
                      <div>
                        <span className="text-slate-400">Nama Lengkap:</span>
                        <p className="font-semibold text-slate-800 text-sm mt-0.5">{applicant.nama}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">No. NIK:</span>
                        <p className="font-mono font-semibold text-slate-850 mt-0.5">{applicant.nik}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Asal Wilayah/Sub:</span>
                        <p className="font-semibold text-slate-800 mt-0.5">{applicant.rwId}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Hubungan Keluarga:</span>
                        <p className="font-semibold text-slate-800 mt-0.5">{applicant.hubungan}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Detail description */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">DESKRIPSI KONDISI & TUJUAN</span>
                <p className="text-xs text-slate-650 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-4 whitespace-pre-wrap italic">
                  "{selectedDetailSubmission.deskripsi}"
                </p>
              </div>

              {/* Field Images (clickable for fullscreen/new tab preview) */}
              {selectedDetailSubmission.fotoList && selectedDetailSubmission.fotoList.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">DOKUMENTASI FOTO LAPANGAN ({selectedDetailSubmission.fotoList.length})</span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {selectedDetailSubmission.fotoList.map((foto, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => window.open(foto)}
                        className="h-20 border rounded-lg overflow-hidden bg-slate-100 cursor-zoom-in hover:opacity-95 shadow-2xs group relative"
                        title="Klik untuk lihat ukuran penuh"
                      >
                        <img src={foto} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Lampiran" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-3xs font-semibold backdrop-blur-xs transition-opacity">Zoom</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remarks/Response comment */}
              {selectedDetailSubmission.komentar && (
                <div className="bg-indigo-50/55 p-4 rounded-xl border border-indigo-100 space-y-1 text-xs text-indigo-950">
                  <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider flex items-center gap-1.5 leading-none">
                    <MessageSquare className="w-3.5 h-3.5" />
                    CATATAN / TANGGAPAN KEPALA DUSUN
                  </span>
                  <p className="leading-relaxed mt-1">{selectedDetailSubmission.komentar}</p>
                </div>
              )}
            </div>

            {/* Actions Footer inside Detail Overlay */}
            <div className="p-4 bg-slate-50 border-t flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex gap-2">
                {/* Edit & Delete Action Row inside Detail Panel */}
                {((currentUser.role === "User" && selectedDetailSubmission.rwId === currentUser.rwId && selectedDetailSubmission.status === "Kirim") || currentUser.role === "Admin") && (
                  <button
                    onClick={() => { setSelectedDetailSubmission(null); openEditProposalModal(selectedDetailSubmission); }}
                    className="px-3.5 py-1.5 bg-slate-150 hover:bg-indigo-100 text-indigo-900 font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 text-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Berkas
                  </button>
                )}

                {((currentUser.role === "User" && selectedDetailSubmission.rwId === currentUser.rwId && selectedDetailSubmission.status === "Kirim") || currentUser.role === "Admin") && (
                  <button
                    onClick={() => handleDeleteProposal(selectedDetailSubmission.id)}
                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Berkas
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {currentUser.role === "Admin" && selectedDetailSubmission.status !== "Setuju" && selectedDetailSubmission.status !== "Tolak" && (
                  <button
                    onClick={() => { setSelectedDetailSubmission(null); setViewingSubmit(selectedDetailSubmission); setAdminComment(selectedDetailSubmission.komentar || ""); }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Tinjau Validasi
                  </button>
                )}

                <button
                  onClick={() => setSelectedDetailSubmission(null)}
                  className="px-4 py-1.5 bg-white border border-slate-205 hover:bg-slate-100 font-bold text-slate-700 text-xs rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal for Admin */}
      {viewingSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 text-slate-700">
            <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-base font-display">Tinjau Validasi Pengajuan Berkas</h3>
              <button onClick={() => setViewingSubmit(null)} className="text-white hover:text-white/80 text-lg font-bold cursor-pointer">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-lg border space-y-1 text-xs">
                <div><span className="text-slate-400 font-medium">Pemohon:</span> <strong className="text-slate-800">{warga.find(w => w.id === viewingSubmit.wargaId)?.nama}</strong></div>
                <div><span className="text-slate-400 font-medium">Asal RW:</span> <strong className="text-slate-800">{viewingSubmit.rwId}</strong></div>
                <div><span className="text-slate-400 font-medium font-sans">Kebutuhan:</span> <p className="text-slate-650 mt-1 leading-relaxed italic">"{viewingSubmit.deskripsi}"</p></div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400">Tanggapan / Catatan Keputusan Kepala Dusun</label>
                <textarea
                  placeholder="Tuliskan keterangan detail persetujuan atau alasan penolakan berkas..."
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 text-slate-805 text-sm px-3.5 py-2 rounded-lg border mt-1 focus:outline-none"
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
}
