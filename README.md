# Monitor Order PR & PO — Purchase Dashboard

Dashboard untuk memonitor order bahan & spareparts berdasarkan data Google Sheets (sheet **"Response"**).

- **Auto-sync**: data di-fetch langsung & otomatis dari Google Sheets setiap 5 menit (bisa dimatikan via toggle).
- **Klik kategori → detail order (drill-down)**: semua box KPI, bar chart, legenda donut, dan step pipeline bisa diklik — muncul modal berisi daftar order dalam kategori tersebut (lengkap dengan tombol edit/hapus). Tutup dengan ×, tombol Esc, atau klik area gelap.
- **Fitur**:
  - **Filter global (Overview)** — dropdown Divisi, Status Kedatangan, Keperluan, Tipe Order, dan Periode (30/90/180 hari / tahun ini) di bagian atas tab Overview; seluruh KPI, chart, tabel di **semua tab** otomatis mengikuti filter aktif. Tombol **✕ Reset** mengembalikan semua.
  - **Overview** — total order, PO dibuat, belum ada PO, approval belum lengkap, selesai, warning aging, tren bulanan, order per divisi, status, item terpopuler, **distribusi Tipe Order, rentang umur order yang belum datang, kelengkapan proses (% PO / approval / datang), dan 5 order terlama yang belum datang**.
  - **Jenis Order** — rincian per item/barang, kategori keperluan, top item & total kuantitas.
  - **Tipe Order** — KPI per tipe (PR MANUAL/CAPEX/OHC/MO/WBS) + jumlah yang belum diisi, donut komposisi, matriks **Tipe × Divisi** (klik untuk drill-down gabungan), daftar **CAPEX tanpa No CAPEX**, tabel CAPEX & No CAPEX, serta tabel semua baris yang memiliki No CAPEX.
  - **Per Divisi** — kartu per divisi (klik untuk filter di Tabel Detail); mengikuti filter global.
  - **Status & Approval** — pipeline PR→PO→Approval 1→Approval 2 + daftar order yang approval-nya belum lengkap.
  - **Aging Order** — barang lama jadi *warning* (default ≥7 hari) / *kritis* (default ≥14 hari); ambang bisa **diketik angkanya** (hari) dan **tersimpan otomatis di perangkat** — tidak kembali ke default saat refresh. Tersedia filter divisi lokal + mengikuti filter global.
  - **Tabel Detail** — filter (divisi, status, tipe order), pencarian (termasuk no CAPEX), sort kolom (termasuk Tipe Order), dan export CSV (13 kolom, termasuk Tipe Order & No CAPEX).
  - **Kualitas Data** — deteksi otomatis kesalahan input di semua kolom (field wajib kosong, format tanggal salah, tahun mencurigakan, nilai di luar opsi form, typo keperluan/divisi dengan saran perbaikan, PR duplikat, item tanpa nama, umur ekstrem, **Tipe Order kosong/di luar opsi, CAPEX tanpa No CAPEX, No CAPEX terisi padahal tipe bukan CAPEX**). Notifikasi pill di header + toast saat sync, detail lokasi (baris sheet, kolom, nilai) + tombol edit langsung.

## Sumber data

Sheet ID spreadsheet: `1F9BpVC2wrV2VIc5cJ5M5EmwlptXnnf6eafo0nMY7KFc` (sheet **"Response"**).

### Syarat agar auto-sync berjalan
1. Spreadsheet harus di-*share*: **Share → General access → Anyone with the link → Viewer** (minimal Viewer agar endpoint publik bisa diakses).
2. Data dibaca real-time dari endpoint:
   `https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:json&sheet=Response`

> Catatan: jika spreadsheet diubah menjadi private lagi, dashboard otomatis jatuh ke **snapshot offline** yang tertanam di file (data terakhir yang disimpan manual).

## Cara deploy ke GitHub Pages

1. Push file `index.html` ini ke repo `wahyudp76/Update-Purchase-FS` (branch default).
2. Di repo: **Settings → Pages → Source: Deploy from a branch → branch `main` / root**.
3. Dashboard dapat diakses di `https://wahyudp76.github.io/Update-Purchase-FS/`.

### Giru lokal / preview
Cukup buka file `index.html` di browser. Jika di environment preview tanpa jaringan, dashboard menampilkan snapshot offline.

## PWA (Progressive Web App)

Dashboard sudah dilengkapi PWA lengkap — bisa dipasang (install) di HP/desktop seperti aplikasi native:

- `manifest.webmanifest` — metadata + ikon + **App Shortcuts** (Aging Order, Status & Approval).
- `icons/` — set ikon lengkap: `android-chrome-192/512`, `icon-512` + `icon-512-maskable` (maskable utk Android), `apple-touch-icon` (iOS), `favicon.ico` + PNG, `icon.svg`, `mstile-150x150` (Windows tile).
- `browserconfig.xml` — konfigurasi tile Windows.
- `sw.js` — service worker (cache app shell *stale-while-revalidate*; data spreadsheet selalu diambil live, tidak di-cache).

> Saat dibuka via GitHub Pages (HTTPS), tombol **"Install App"** muncul otomatis di header (atau menu browser → Add to Home Screen).

## Tambah / Edit / Hapus order (tulis balik ke spreadsheet via Google Apps Script)

Dashboard bisa menulis balik ke spreadsheet:

- Tombol **"Tambah"** (header) → form tambah order, ditulis langsung ke baris baru sheet.
- Tombol **✏️ / 🗑️** (kolom Aksi di Tabel Detail & Aging) → edit / hapus baris.
- **Form web mengikuti Google Form asli "Update PR & PO FS"** (urutan, tipe, opsi & field wajib):
  - Tanggal Input Reservasi (tanggal, wajib)
  - Divisi — dropdown: PG2, FM4, OP2 (wajib)
  - Keperluan Order — dropdown: Kantor, Spareparts Engine, Spareparts Irrigator, Spareparts Sumur Bor, Unit inventaris, Lain - lain (wajib)
  - Jenis Order (paragraf, wajib)
  - Nomor PR / Nomor PO (teks, opsional)
  - Approval 1 / Approval 2 — dropdown: Sudah, Belum
  - Status Kedatangan — dropdown: Sudah, Proses, Belum (wajib)
  - Keterangan (paragraf, opsional)
  - Saat **mengedit** baris lama yang nilainya di luar daftar (mis. "Proses", "Sparepart irigator"), opsi tersebut ditambahkan otomatis agar data lama tidak hilang.

**Cara kerja sinkronisasi tulis (tanpa OAuth):**

1. Backend adalah **Google Apps Script web app** (`Code.gs` di repo ini) yang dijalankan sebagai akun pemilik script.
2. Dashboard mengirim `POST` (Content-Type `text/plain` — agar lolos CORS tanpa preflight) ke URL web app, berisi `{ sheetId, sheetName, action, rowId, values }`.
3. Script menulis ke sheet tujuan (add/edit/delete) dan membalas JSON `{ ok: true, ... }`.

### Langkah deploy (sekali saja)

1. Buka [script.google.com](https://script.google.com) → **New project**, tempel seluruh isi `Code.gs`.
2. **Deploy → New deployment → Web app**:
   - *Execute as*: **Me** (akun yang jadi Editor spreadsheet)
   - *Who has access*: **Anyone**
3. Salin URL **Web app** (`https://script.google.com/macros/s/XXXX/exec`).
4. Set URL di dashboard — **sudah di-set default** di `index.html` (`DEFAULT_SCRIPT_URL`); bila ganti deployment/akun cukup override lewat param `?scriptUrl=...`.
5. Pastikan akun pemilik script adalah **Editor** spreadsheet target.

> Keamanan sederhana: isi konstanta `SECRET` di `Code.gs`, lalu kirim `secret` tambahan dari dashboard (`callScript`) bila perlu. Tanpa `SECRET`, siapa pun yang tahu URL web app bisa menulis — simpan URL hanya di `index.html` Anda.

## Mengubah ID sheet

Edit variabel `SHEET_ID` dan `SHEET_NAME` di bagian `CONFIG` pada `index.html`.

## Kolom yang dibaca (sheet "Response")

| Kolom | Keterangan |
|---|---|
| Timestamp | waktu submit |
| Tanggal Input Reservasi | tanggal order (dd/mm/yyyy) |
| Divisi | nama divisi |
| Jenis Order | daftar barang (bisa multi-baris) |
| Nomor PR | nomor PR |
| Nomor PO | nomor PO |
| Approval 1 / Approval 2 | status approval |
| Keterangan | catatan |
| Keperluan Order | kategori keperluan |
| Status Kedatangan | status barang sudah/proses/belum datang |
| Tipe Order | PR MANUAL / CAPEX / OHC / MO / WBS (opsi "RESERVASI" diubah menjadi "PR MANUAL" di Google Form) (kolom baru Okt 2026 — di ujung kanan sheet) |
| NO CAPEX | nomor CAPEX, wajib bila tipe = CAPEX (kolom baru Okt 2026) |

## Logika status otomatis

- **Status Kedatangan** dibaca langsung dari kolom "Status Kedatangan" di sheet: nilai "Sudah"/"Datang"/"Tiba" → hijau; "Belum"/"Proses"/"Menunggu" → kuning; lainnya biru/abu.
- **Alur proses (flow)** tetap dihitung otomatis untuk tab Status & Approval:
  - **Belum PO** → Nomor PO kosong.
  - **Menunggu Approval** → PO ada tapi Approval 1 / 2 belum lengkap.
  - **Selesai** → PO ada + Approval 1 & 2 lengkap.
- **Warning aging** → umur order ≥ 7 hari (default), **Kritis** → ≥ 14 hari.
- **Pengecualian aging**: order dengan Status Kedatangan **"Sudah"** tidak dihitung sebagai warning/kritis dan tidak muncul di daftar Aging Order (barangnya telah tiba). Tersedia checkbox "Tampilkan yang sudah datang" untuk tetap menampilkannya. Status "Sebagian" **tetap** dihitung karena sisanya masih perlu follow-up.

## Stabilitas & performa

- **Anti-race sync**: refresh manual, auto-sync, dan refresh setelah simpan tidak bisa berjalan bersamaan.
- **Timeout jaringan**: baca sheet 20 dtk, tulis Apps Script 30 dtk — koneksi menggantung tidak lagi mengunci tombol/pill sync.
- **Data tahan banting**: bila sync gagal setelah data pernah masuk, data terakhir tetap ditampilkan (tidak diganti snapshot lama); banner + tombol "Coba lagi" muncul.
- **Proteksi tulis**: sebelum edit/hapus, bila data >60 detik otomatis di-sync ulang dan baris diverifikasi — mencegah menulis ke baris yang salah.
- **Dedupe cerdas**: baris duplikat dibuang, tetapi baris yang hanya berbeda Status Kedatangan tetap dihitung.
- **Hemat baterai**: auto-sync dihentikan saat tab di-background; sync langsung saat tab kembali terlihat dan data sudah stale >5 menit.
- **Pencarian di-debounce** (160 ms) dan formatter angka di-cache.
- **Service worker tahan gagal**: satu aset gagal di-precache tidak menggagalkan update SW; cache key network-first diperbaiki.
