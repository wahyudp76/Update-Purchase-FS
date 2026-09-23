# Monitor Order PR & PO — Purchase Dashboard

Dashboard untuk memonitor order bahan & spareparts berdasarkan data Google Sheets (sheet **"Response"**).

- **Auto-sync**: data di-fetch langsung & otomatis dari Google Sheets setiap 5 menit (bisa dimatikan via toggle).
- **Fitur**:
  - **Overview** — total order, PO dibuat, menunggu approval, selesai, warning aging, tren bulanan, order per divisi, status, item terpopuler.
  - **Jenis Order** — rincian per item/barang, kategori keperluan, top item & total kuantitas.
  - **Per Divisi** — kartu per divisi (klik untuk filter di Tabel Detail).
  - **Status & Approval** — pipeline PR→PO→Approval 1→Approval 2 + daftar order yang approval-nya belum lengkap.
  - **Aging Order** — barang lama jadi *warning* (default ≥7 hari) / *kritis* (default ≥14 hari), bisa diatur slider-nya.
  - **Tabel Detail** — filter (divisi, status), pencarian, sort kolom, dan export CSV.

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

## Logika status otomatis

- **Belum PO** → Nomor PO kosong.
- **Menunggu Approval** → PO ada tapi Approval 1 / 2 belum lengkap.
- **Selesai** → PO ada + Approval 1 & 2 lengkap.
- **Warning aging** → umur order ≥ 7 hari (default), **Kritis** → ≥ 14 hari.
