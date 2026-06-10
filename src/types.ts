/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "Admin" | "User";

export interface User {
  id: string;
  username: string;
  nama: string;
  role: UserRole;
  rwId?: string; // Defined if role is "User" (Ketua RW)
  password?: string;
}

export type Gender = "L" | "P";

export type WargaStatus = "Aktif" | "Meninggal" | "Pindah" | "Sementara";

export interface Warga {
  id: number;
  nik: string;
  kk: string;
  nama: string;
  tempatLahir: string;
  tanggalLahir: string; // YYYY-MM-DD
  jk: Gender;
  agama: string;
  pendidikan: string;
  pekerjaan: string;
  hubungan: string; // "Kepala Keluarga", "Suami", "Istri", "Anak", "Orang Tua", "Mertua", "Lainnya"
  alamat: string;
  kontak: string;
  rwId: string; // "RW 01" to "RW 05"
  status: WargaStatus;
  foto?: string; // Base64 or image URL placeholder
  catatan?: string;
  tanggalInput: string;
}

export interface RW {
  id: string; // "RW 01" - "RW 05"
  namaKetua: string;
  wilayah: string;
  kontak: string;
}

export interface Iuran {
  id: number;
  wargaId: number;
  bulanTahun: string; // e.g., "2026-06"
  jumlah: number; // Target dues (e.g. 50000)
  totalDibayar: number;
  statusBayar: "Lunas" | "Kurang" | "Belum Bayar";
}

export interface TransaksiIuran {
  id: number;
  iuranId: number;
  wargaId: number;
  tanggal: string; // YYYY-MM-DD HH:mm:ss
  jenis: "Masuk" | "Keluar";
  jumlah: number;
  keterangan: string;
}

export type PengajuanJenis = "Rutilahu" | "Pembangunan" | "Bansos";

export type PengajuanStatus = "Draft" | "Kirim" | "Verifikasi" | "Setuju" | "Tolak";

export interface Pengajuan {
  id: number;
  wargaId: number;
  rwId: string;
  jenis: PengajuanJenis;
  deskripsi: string;
  tanggal: string;
  status: PengajuanStatus;
  fotoList: string[]; // up to 3 image strings (base64/URLs)
  komentar?: string;
}

export type LaporanKategori = "Kegiatan" | "Kejadian" | "Pengaduan";

export interface Laporan {
  id: number;
  rwId: string;
  wargaId?: number; // Pelapor (optional)
  kategori: LaporanKategori;
  deskripsi: string;
  tanggal: string;
  fotoList: string[]; // up to 3 image strings
  status: "Diproses" | "Selesai" | "Arsip";
  komentarAdmin?: string;
}

export type MutasiJenis = "Lahir" | "Meninggal" | "Pindah Masuk" | "Pindah Keluar" | "Penduduk Sementara";

export interface MutasiLog {
  id: number;
  wargaId: number; // reference to citizen (could be newly added or modified)
  namaWarga: string;
  nik: string;
  kk: string;
  jenis: MutasiJenis;
  tanggalPeristiwa: string; // YYYY-MM-DD
  keterangan: string;
  petugasName: string; // who recorded
  timestamp: string; // system time
}
