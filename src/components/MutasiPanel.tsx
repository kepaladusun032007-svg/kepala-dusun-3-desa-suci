/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { MutasiLog, RW, User, Warga } from "../types";
import { PRESET_PHOTOS } from "../dataStore";
import { Baby, Church, ArrowDownRight, ArrowUpRight, Clock, MapPin, ClipboardList, TrendingUp } from "lucide-react";

interface MutasiPanelProps {
  mutasiLogs: MutasiLog[];
  rws: RW[];
  warga: Warga[];
  currentUser: User;
  onUpdateMutasi: (logs: MutasiLog[]) => void;
}

export default function MutasiPanel({
  mutasiLogs,
  rws,
  warga,
  currentUser,
  onUpdateMutasi
}: MutasiPanelProps) {
  // Filters
  const [filterType, setFilterType] = useState<string>("Semua");

  // Filter state for logs based on active user role/RW
  const authLogs = mutasiLogs.filter(log => {
    if (currentUser.role === "User") {
      const citizen = warga.find(w => w.id === log.wargaId);
      if (citizen) {
        return citizen.rwId === (currentUser.rwId || "RW 01");
      }
      return log.keterangan.includes(currentUser.rwId || "RW 01");
    }
    return true;
  });

  // Filter state for logs
  const filteredLogs = authLogs.filter(log => {
    return filterType === "Semua" || log.jenis === filterType;
  });

  // Calculate demographics stats dynamically
  const lahirCount = authLogs.filter(m => m.jenis === "Lahir").length;
  const meninggalCount = authLogs.filter(m => m.jenis === "Meninggal").length;
  const pindahMasukCount = authLogs.filter(m => m.jenis === "Pindah Masuk").length;
  const pindahKeluarCount = authLogs.filter(m => m.jenis === "Pindah Keluar").length;
  const sementaraCount = warga.filter(w => {
    if (currentUser.role === "User") {
      return w.status === "Sementara" && w.rwId === (currentUser.rwId || "RW 01");
    }
    return w.status === "Sementara";
  }).length;

  const totalMutasi = authLogs.length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <h2 className="text-xl font-semibold text-slate-800 font-display">Buku Administrasi Mutasi (LAMPID)</h2>
        <p className="text-sm text-slate-500 mt-1">
          Pencatatan Peristiwa Demografis meliputi Lahir, Mati, Pindah Datang, Pindah Keluar, dan Penduduk Sementara sesuai dengan Permendagri No. 47/2016.
        </p>
      </div>

      {/* Structured LAMPID Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {/* LAHIR */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-100 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Baby className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs text-slate-400 font-medium font-sans uppercase tracking-wider">Lahir (L)</span>
            <span className="text-xl font-bold text-slate-800 font-display mt-0.5 block">{lahirCount}</span>
          </div>
        </div>

        {/* MATI */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-100 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <Church className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs text-slate-400 font-medium font-sans uppercase tracking-wider">Mati (M)</span>
            <span className="text-xl font-bold text-slate-800 font-display mt-0.5 block">{meninggalCount}</span>
          </div>
        </div>

        {/* PINDAH MASUK */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-100 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <ArrowDownRight className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs text-slate-400 font-medium font-sans uppercase tracking-wider">Masuk (P)</span>
            <span className="text-xl font-bold text-slate-800 font-display mt-0.5 block">{pindahMasukCount}</span>
          </div>
        </div>

        {/* PINDAH KELUAR */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-100 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs text-slate-400 font-medium font-sans uppercase tracking-wider">Keluar (I)</span>
            <span className="text-xl font-bold text-slate-800 font-display mt-0.5 block">{pindahKeluarCount}</span>
          </div>
        </div>

        {/* PENDUDUK SEMENTARA */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-100 shadow-2xs col-span-2 sm:col-span-1 flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-xs text-slate-400 font-medium font-sans uppercase tracking-wider">Sementara (D)</span>
            <span className="text-xl font-bold text-slate-800 font-display mt-0.5 block">{sementaraCount}</span>
          </div>
        </div>
      </div>

      {/* Info Warning Banner on Auto-Logging */}
      <div className="bg-slate-800 text-slate-200 text-sm p-4 rounded-xl shadow-xs border border-slate-700 flex items-start gap-3">
        <Clock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block font-display">Sistem Auto-Logging Kependudukan Aktif</strong>
          Setiap pendaftaran warga baru, pecohan kartu keluarga (Pecah KK), perubahan status almarhum, atau perpindahan pemukiman di tab <span className="font-semibold text-emerald-400 font-display">Data Penduduk</span> akan otomatis didokumentasikan ke dalam jurnal mutasi ini beserta timestamp audit log yang tidak dapat diubah (immutable).
        </div>
      </div>

      {/* Log Output Filter Tab */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="font-semibold text-slate-800 font-display flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-emerald-600" />
            Riwayat Log Mutasi Penduduk (Buku Mutasi)
          </h3>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filter Peristiwa:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-50 text-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
            >
              <option value="Semua">Semua Peristiwa</option>
              <option value="Lahir">Kelahiran (Lahir)</option>
              <option value="Meninggal">Kematian (Meninggal)</option>
              <option value="Pindah Masuk">Penduduk Masuk</option>
              <option value="Pindah Keluar">Penduduk Keluar</option>
              <option value="Penduduk Sementara">Penduduk Sementara</option>
            </select>
          </div>
        </div>

        {/* Timeline Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-display font-medium text-xs uppercase border-b border-slate-100">
                <th className="px-5 py-3">Event / Stempel Waktu</th>
                <th className="px-5 py-3">Warga Bersangkutan</th>
                <th className="px-5 py-3">Identitas (NIK/KK)</th>
                <th className="px-5 py-3">Keterangan Mutasi</th>
                <th className="px-5 py-3">Operator Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 font-sans">
                    Belum terdapat peristiwa mutasi terdaftar di kategori ini.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-md ${
                            log.jenis === "Lahir" ? "bg-emerald-100 text-emerald-800" :
                            log.jenis === "Meninggal" ? "bg-rose-100 text-rose-800" :
                            log.jenis === "Pindah Masuk" ? "bg-blue-100 text-blue-800" :
                            log.jenis === "Pindah Keluar" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"
                          }`}>
                            {log.jenis === "Lahir" ? <Baby className="w-4 h-4" /> :
                             log.jenis === "Meninggal" ? <Church className="w-4 h-4" /> :
                             log.jenis === "Pindah Masuk" || log.jenis === "Penduduk Sementara" ? <ArrowDownRight className="w-4 h-4" /> :
                             <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="font-semibold block text-slate-800 leading-tight">{log.jenis}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{new Date(log.timestamp).toLocaleString("id-ID")}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {log.namaWarga}
                      </td>

                      <td className="px-5 py-4 text-xs font-mono">
                        <div>NIK: {log.nik}</div>
                        <div className="text-slate-400 mt-0.5">KK: {log.kk}</div>
                      </td>

                      <td className="px-5 py-4 text-slate-500 max-w-xs truncate" title={log.keterangan}>
                        {log.keterangan}
                      </td>

                      <td className="px-5 py-4 text-slate-500 font-medium">
                        {log.petugasName ? log.petugasName : "Sistem Automatis"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
