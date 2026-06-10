/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Warga, RW, Iuran, TransaksiIuran, User } from "../types";
import { addTransaction } from "../dataStore";
import { Plus, ToggleLeft, ToggleRight, DollarSign, ArrowUpCircle, ArrowDownCircle, Landmark, Calendar, Search, Filter, FileSpreadsheet, Eye } from "lucide-react";
import * as XLSX from "xlsx";

interface IuranPanelProps {
  warga: Warga[];
  rws: RW[];
  iuran: Iuran[];
  transaksi: TransaksiIuran[];
  currentUser: User;
  onUpdateDatabase: (updatedIuran: Iuran[], updatedTransactions: TransaksiIuran[]) => void;
}

export default function IuranPanel({
  warga,
  rws,
  iuran,
  transaksi,
  currentUser,
  onUpdateDatabase
}: IuranPanelProps) {
  // Filters
  const [filterRwId, setFilterRwId] = useState<string>(currentUser.role === "User" ? currentUser.rwId || "RW 01" : "Semua");
  const [filterMonth, setFilterMonth] = useState<string>("2026-06"); // Set default as current month in metadata
  const [filterStatus, setFilterStatus] = useState<string>("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Form states
  const [selectedWarga, setSelectedWarga] = useState<Warga | null>(null);
  const [selectedIuran, setSelectedIuran] = useState<Iuran | null>(null);
  const [payAmount, setPayAmount] = useState<number>(50000); // Standard dues
  const [payKeterangan, setPayKeterangan] = useState("");

  const [expenseAmount, setExpenseAmount] = useState<number>(100000);
  const [expenseKeterangan, setExpenseKeterangan] = useState("");
  const [formError, setFormError] = useState("");

  // Format currency helpers rupiah
  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(num);
  };

  // Set selected dues details modal state
  const [viewingIuranDetails, setViewingIuranDetails] = useState<Iuran | null>(null);

  // Filter citizens list that should pay dues
  const duesPayingWarga = warga.filter(w => {
    // Only head of households or adults should normally pay dues, let's target all Kepala Keluarga
    const isHeadOfFamily = w.hubungan === "Kepala Keluarga" && w.status === "Aktif";
    const matchesRw = filterRwId === "Semua" || w.rwId === filterRwId;
    const lowerQuery = (searchQuery || "").trim().toLowerCase();
    let matchesSearch = true;
    if (lowerQuery) {
      const nameStr = w.nama ? String(w.nama).toLowerCase() : "";
      const nikStr = w.nik ? String(w.nik).toLowerCase() : "";
      matchesSearch = nameStr.includes(lowerQuery) || nikStr.includes(lowerQuery);
    }
    return isHeadOfFamily && matchesRw && matchesSearch;
  });

  // Filtered list of transactions for cash ledger and totals
  const filteredTransactions = transaksi.filter(t => {
    let txRwId = "Semua";
    if (t.wargaId > 0) {
      const txWarga = warga.find(w => w.id === t.wargaId);
      if (txWarga) txRwId = txWarga.rwId;
    } else {
      const match = t.keterangan.match(/\[RW (\d+)\]/i);
      if (match) {
        txRwId = `RW ${match[1]}`;
      } else if (t.keterangan.includes("[RW")) {
        const idx = t.keterangan.indexOf("[RW");
        const rwStr = t.keterangan.substring(idx + 1, 6);
        txRwId = rwStr;
      }
    }
    
    if (currentUser.role === "User") {
      return txRwId === (currentUser.rwId || "RW 01");
    } else {
      return filterRwId === "Semua" || txRwId === filterRwId;
    }
  });

  // Calculate totals based on filters
  const totalInflow = filteredTransactions
    .filter(t => t.jenis === "Masuk")
    .reduce((acc, curr) => acc + curr.jumlah, 0);

  const totalOutflow = filteredTransactions
    .filter(t => t.jenis === "Keluar")
    .reduce((acc, curr) => acc + curr.jumlah, 0);

  const netBalance = totalInflow - totalOutflow;

  // Track target vs collected for the selected month & RW
  const monthlyInflow = filteredTransactions
    .filter(t => {
      if (t.jenis !== "Masuk") return false;
      const tMonth = t.tanggal.split(" ")[0].slice(0, 7); // YYYY-MM
      return tMonth === filterMonth;
    })
    .reduce((acc, curr) => acc + curr.jumlah, 0);

  // Get or initialize monthly target for a resident
  const getWargaIuranRecord = (wId: number, month: string): Iuran => {
    const existing = iuran.find(i => i.wargaId === wId && i.bulanTahun === month);
    if (existing) return existing;
    
    // Fallback Mock representation if target not loaded yet
    return {
      id: -wId, // negative identifier tags it as dynamic temp
      wargaId: wId,
      bulanTahun: month,
      jumlah: 50000, // target
      totalDibayar: 0,
      statusBayar: "Belum Bayar"
    };
  };

  // Open Payment modal
  const openPayModal = (w: Warga, record: Iuran) => {
    setSelectedWarga(w);
    setSelectedIuran(record);
    const needed = record.id < 0 ? 50000 : Math.max(0, record.jumlah - record.totalDibayar);
    setPayAmount(needed > 0 ? needed : 50000);
    setPayKeterangan(`Pembayaran Iuran ${monthNameIndo(filterMonth)} - ${w.nama}`);
    setFormError("");
    setIsPayModalOpen(true);
  };

  // Open Outgoing Expense modal
  const openExpenseModal = () => {
    setExpenseAmount(50000);
    setExpenseKeterangan("");
    setFormError("");
    setIsExpenseModalOpen(true);
  };

  // Handle Recording Payment
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarga || !selectedIuran) return;
    if (payAmount <= 0) {
      setFormError("Nominal pembayaran harus lebih besar dari 0.");
      return;
    }

    let targetIuranId = selectedIuran.id;
    let updatedIurans = [...iuran];

    // If iuran doesn't exist yet, we create it first in the master table
    if (targetIuranId < 0) {
      const nextId = iuran.length > 0 ? Math.max(...iuran.map(i => i.id)) + 1 : 1;
      const newIuranRecord: Iuran = {
        id: nextId,
        wargaId: selectedWarga.id,
        bulanTahun: filterMonth,
        jumlah: 50000,
        totalDibayar: 0,
        statusBayar: "Belum Bayar"
      };
      targetIuranId = nextId;
      updatedIurans = [...iuran, newIuranRecord];
    }

    // Prepare tx payload
    const txTime = new Date().toISOString().replace("T", " ").substring(0, 19);
    const txPayload = {
      iuranId: targetIuranId,
      wargaId: selectedWarga.id,
      tanggal: txTime,
      jenis: "Masuk" as const,
      jumlah: payAmount,
      keterangan: payKeterangan
    };

    // Use our database helper to process transaction and update payment statuses
    const dummyDb = { warga, rws, iuran: updatedIurans, transaksi, pengajuan: [], laporan: [], mutasi: [] };
    const updatedDb = addTransaction(dummyDb, txPayload);

    onUpdateDatabase(updatedDb.iuran, updatedDb.transaksi);
    setIsPayModalOpen(false);
  };

  // Handle Recording Outflow Expense
  const handleRecordExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0) {
      setFormError("Nominal pengeluaran harus lebih besar dari 0.");
      return;
    }
    if (!expenseKeterangan) {
      setFormError("Keterangan wajib diisi.");
      return;
    }

    const txTime = new Date().toISOString().replace("T", " ").substring(0, 19);
    const txPayload = {
      iuranId: 0, // 0 denotes general non-warga transaction
      wargaId: 0,
      tanggal: txTime,
      jenis: "Keluar" as const,
      jumlah: expenseAmount,
      keterangan: `[RW ${filterRwId !== "Semua" ? filterRwId.substring(3) : "Dusun"}] ${expenseKeterangan}`
    };

    const dummyDb = { warga, rws, iuran, transaksi, pengajuan: [], laporan: [], mutasi: [] };
    const updatedDb = addTransaction(dummyDb, txPayload);

    onUpdateDatabase(updatedDb.iuran, updatedDb.transaksi);
    setIsExpenseModalOpen(false);
  };

  // Month names Indonesian converter helper
  const monthNameIndo = (monthYearStr: string) => {
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const parts = monthYearStr.split("-");
    if (parts.length < 2) return monthYearStr;
    const index = parseInt(parts[1]) - 1;
    return `${months[index]} ${parts[0]}`;
  };

  // Excel (.xlsx) Report Exporter utilizing SheetJS
  const exportFinanceToExcel = () => {
    // 1. Prepare transactions ledger workbook sheet
    const ledgerData = transaksi.map((t, idx) => {
      let donor = "-";
      if (t.wargaId > 0) {
        donor = warga.find(w => w.id === t.wargaId)?.nama || "-";
      }
      return {
        "No.": idx + 1,
        "Tanggal Transaksi": t.tanggal,
        "Jenis": t.jenis === "Masuk" ? "Penerimaan (Masuk)" : "Pengeluaran (Keluar)",
        "Nominal": t.jumlah,
        "Nama Warga / Keterangan": t.wargaId > 0 ? `Iuran: ${donor}` : t.keterangan,
        "Deskripsi Tambahan": t.wargaId > 0 ? t.keterangan : "Pengeluaran Umum RW"
      };
    });

    // 2. Prepare Outstanding Dues workbook sheet (for filterMonth)
    const outstandingData = duesPayingWarga.map((w, idx) => {
      const rec = getWargaIuranRecord(w.id, filterMonth);
      return {
        "No.": idx + 1,
        "Nama Kepala Keluarga": w.nama,
        "Nomor KK": w.kk,
        "Wilayah": w.rwId,
        "Status Pembayaran": rec.statusBayar,
        "Target Kewajiban": rec.jumlah,
        "Pernah Dibayar": rec.totalDibayar,
        "Tunggakan / Kurang": Math.max(0, rec.jumlah - rec.totalDibayar)
      };
    });

    const wb = XLSX.utils.book_new();
    const wsLedger = XLSX.utils.json_to_sheet(ledgerData);
    const wsDues = XLSX.utils.json_to_sheet(outstandingData);

    const wscolsLedger = [
      { wch: 5 }, { wch: 22 }, { wch: 22 }, { wch: 15 }, { wch: 30 }, { wch: 35 }
    ];
    wsLedger["!cols"] = wscolsLedger;

    XLSX.utils.book_append_sheet(wb, wsLedger, "Buku Arus Kas Keuangan");
    XLSX.utils.book_append_sheet(wb, wsDues, `Rekap Iuran Bulan ${filterMonth}`);

    XLSX.writeFile(wb, `Laporan_Keuangan_Kependudukan_${filterMonth}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Title Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 font-display">Sistem Manajemen Kas & Iuran Warga</h2>
          <p className="text-sm text-slate-500 mt-1">
            Pengelolaan iuran bulanan wajib, pencatatan transaksi kas masuk/keluar, pelacakan tunggakan (piutang), dan export Excel laporan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={openExpenseModal}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Catat Pengeluaran
          </button>
          
          <button
            onClick={exportFinanceToExcel}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Laporan Bulanan (.xlsx)
          </button>
        </div>
      </div>

      {/* Finance Ledger Cards (Saldo & Arus Kas) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Total Collected */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-2xs relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400 font-medium">Total Penerimaan Kas</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-800 font-mono block mt-4">{formatRupiah(totalInflow)}</span>
          <span className="text-xs text-slate-400 mt-2 block">Iuran bulanan masuk terakumulasi</span>
        </div>

        {/* Total Expended */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-2xs relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400 font-medium">Total Pengeluaran Kas</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-800 font-mono block mt-4">{formatRupiah(totalOutflow)}</span>
          <span className="text-xs text-slate-400 mt-2 block">Pengeluaran kas operasional dusun</span>
        </div>

        {/* Net Cash Balance */}
        <div className="bg-emerald-900 p-6 rounded-xl shadow-2xs relative overflow-hidden text-emerald-100">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-emerald-200">Saldo Akhir Tabungan RW</span>
            <div className="p-2 bg-white/10 text-emerald-300 rounded-lg">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-bold text-white font-mono block mt-4">{formatRupiah(netBalance)}</span>
          <span className="text-xs text-emerald-300/80 mt-2 block">Kas bersih sisa siap pakai</span>
        </div>
      </div>

      {/* Structured Filters Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Pilih Bulan & Tahun</label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Wilayah RW</label>
            <select
              value={filterRwId}
              onChange={(e) => setFilterRwId(e.target.value)}
              disabled={currentUser.role === "User"}
              className="w-full bg-slate-50 text-slate-800 text-sm px-3 py-2.5 rounded-lg border border-slate-200"
            >
              {currentUser.role === "Admin" && <option value="Semua">Semua RW</option>}
              {rws.map((rw) => (
                <option key={rw.id} value={rw.id}>{rw.id} ({rw.namaKetua})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Status Bayar</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-sm px-3 py-2.5 rounded-lg border border-slate-200"
            >
              <option value="Semua">Semua Status</option>
              <option value="Lunas">Lunas</option>
              <option value="Kurang">Kurang (Cicilan)</option>
              <option value="Belum Bayar">Belum Membayar</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Cari Kepala Keluarga</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Cari kepala keluarga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 text-slate-800 text-sm pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main ledger list view */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Part: 2 cols - Dues outstanding payments */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 font-display flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Kontrol Iuran {monthNameIndo(filterMonth)}
            </h3>
            <span className="text-xs bg-slate-100 font-mono px-2 py-1 rounded font-semibold text-slate-500 uppercase">Target KK</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-display font-medium text-xs uppercase border-b border-slate-100">
                  <th className="px-5 py-3">Kepala Keluarga</th>
                  <th className="px-5 py-3 text-center">RW</th>
                  <th className="px-5 py-3">Wajib</th>
                  <th className="px-5 py-3">Dibayar</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                {duesPayingWarga.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      Tidak ditemukan Kepala Keluarga aktif di filter ini.
                    </td>
                  </tr>
                ) : (
                  duesPayingWarga
                    .map(w => {
                      const rec = getWargaIuranRecord(w.id, filterMonth);
                      return { w, rec };
                    })
                    .filter(item => {
                      if (filterStatus === "Semua") return true;
                      return item.rec.statusBayar === filterStatus;
                    })
                    .map(({ w, rec }) => {
                      const arrears = Math.max(0, rec.jumlah - rec.totalDibayar);
                      return (
                        <tr key={w.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-4">
                            <span className="block font-semibold text-slate-800">{w.nama}</span>
                            <span className="text-xs text-slate-400 font-mono mt-0.5 block">KK: {w.kk}</span>
                          </td>

                          <td className="px-5 py-4 text-center font-medium">
                            {w.rwId}
                          </td>

                          <td className="px-5 py-4 text-xs font-mono font-semibold">
                            {formatRupiah(rec.jumlah)}
                          </td>

                          <td className="px-5 py-4 text-xs font-mono font-semibold text-emerald-600">
                            {formatRupiah(rec.totalDibayar)}
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-2xs font-semibold uppercase ${
                              rec.statusBayar === "Lunas" ? "bg-emerald-100 text-emerald-800" :
                              rec.statusBayar === "Kurang" ? "bg-amber-100 text-amber-800" :
                              "bg-rose-100 text-rose-800"
                            }`}>
                              {rec.statusBayar}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => openPayModal(w, rec)}
                              className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors"
                            >
                              Bayar Dues
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Part: 1 col - Recent transactions ledger list */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 font-display">Mutasi Kas Aliran Masuk/Keluar</h3>
          </div>

          <div className="p-4 space-y-4 max-h-[450px] overflow-y-auto">
            {filteredTransactions.slice().reverse().map((t) => {
              const contributorName = t.wargaId > 0 ? warga.find(w => w.id === t.wargaId)?.nama : null;
              return (
                <div key={t.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-2xs font-semibold uppercase px-1.5 py-0.5 rounded ${
                      t.jenis === "Masuk" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {t.jenis === "Masuk" ? "Arus Masuk (Bayar)" : "Kas Keluar (Belanja)"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{t.tanggal.split(" ")[0]}</span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs font-semibold text-slate-800 block truncate max-w-[150px]">
                      {contributorName ? `Iuran ${contributorName}` : t.keterangan}
                    </span>
                    <span className={`text-xs font-mono font-bold ${
                      t.jenis === "Masuk" ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {t.jenis === "Masuk" ? "+" : "-"}{formatRupiah(t.jumlah)}
                    </span>
                  </div>

                  {contributorName && (
                    <span className="text-[10px] text-slate-400 block pt-0.5 truncate">{t.keterangan}</span>
                  )}
                </div>
              );
            })}

            {filteredTransactions.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-8">Belum ada mutasi keuangan kas tercatat.</p>
            )}
          </div>
        </div>
      </div>

      {/* Record payment dues input modal box */}
      {isPayModalOpen && selectedWarga && selectedIuran && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="bg-emerald-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-base font-display">Sumbangan / Pembayaran Iuran</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="text-white hover:text-white/80 text-lg font-bold cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-150 text-rose-700 text-xs rounded-lg">{formError}</div>
              )}

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400">Pembayar Warga</label>
                <div className="bg-slate-50 p-2.5 rounded-lg border font-medium text-slate-700 text-sm mt-1">
                  {selectedWarga.nama} <span className="font-mono text-slate-400 font-normal text-xs">&bull; NIK {selectedWarga.nik}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400">Tenggat Periode</label>
                  <div className="bg-slate-50 p-2.5 rounded-lg border text-slate-700 text-sm mt-1 font-semibold text-center">
                    {monthNameIndo(filterMonth)}
                  </div>
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400">Status Saat Ini</label>
                  <div className="bg-slate-50 p-2.5 rounded-lg border text-sm mt-1 text-center font-semibold">
                    <span className={`px-2 py-0.5 rounded text-2xs ${
                      selectedIuran.statusBayar === "Lunas" ? "bg-emerald-100 text-emerald-800" :
                      selectedIuran.statusBayar === "Kurang" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {selectedIuran.statusBayar} ({formatRupiah(selectedIuran.totalDibayar)})
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400">Jumlah Bayar (Rupiah) *</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 text-slate-850 font-mono text-sm px-3.5 py-2.5 rounded-lg border mt-1 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400">Keterangan Catatan</label>
                <input
                  type="text"
                  value={payKeterangan}
                  onChange={(e) => setPayKeterangan(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 text-sm px-3.5 py-2.5 rounded-lg border mt-1 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 border text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg cursor-pointer"
                >
                  Simpan Pembayaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Catat Pengeluaran (Expense) Modal box */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="bg-rose-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-base font-display">Perekaman Transaksi Kas Keluar</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-white hover:text-white/80 text-lg font-bold cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleRecordExpense} className="p-5 space-y-4">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-150 text-rose-700 text-xs rounded-lg">{formError}</div>
              )}

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400">Wilayah / Target Pembebanan</label>
                <div className="bg-slate-50 p-2.5 rounded-lg border font-medium text-slate-700 text-sm mt-1">
                  {filterRwId !== "Semua" ? `Kas Operasional ${filterRwId}` : "Kas Umum Wilayah RW"}
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400">Jumlah Pengeluaran (Rupiah) *</label>
                <input
                  type="number"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 text-slate-850 font-mono text-sm px-3.5 py-2.5 rounded-lg border mt-1 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400">Keterangan Pengeluaran (Belanja) *</label>
                <input
                  type="text"
                  required
                  placeholder="Mis. Pembelian semen gotong royong, perbaikan tenda duka"
                  value={expenseKeterangan}
                  onChange={(e) => setExpenseKeterangan(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 text-sm px-3.5 py-2.5 rounded-lg border mt-1 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 border-t flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 border text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg cursor-pointer"
                >
                  Simpan Transaksi Keluar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
