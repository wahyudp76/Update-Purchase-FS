/************************************************************************
 *  Code.gs — Backend Google Apps Script untuk "Monitor Order PR & PO"
 *  Menerima aksi ADD / EDIT / DELETE / MIGRATE dari dashboard (GitHub Pages)
 *  lalu menuliskannya ke Google Spreadsheet yang sama.
 *
 *  VERSION: 3.1 (pindah ke spreadsheet baru "Data Reservasi PR dan PO")
 *
 *  PERUBAHAN v3.1 (7 Nov 2026):
 *  - Spreadsheet baru: 1VW8t_bphHBQ7HxFpiv3S5plFgpkoBIO5xc4yaBi6gI0 (tab "Response")
 *    Tanpa kolom Timestamp (13 kolom). Penulisan tetap BY NAMA HEADER — aman.
 *
 *  PERUBAHAN v3.0 (revisi alur — 3 tipe order: PR MANUAL / MO / CAPEX):
 *  - Kolom baru "Nomor Reservasi" (otomatis disisipkan sebelum "Nomor PR"):
 *      PR MANUAL & MO : Input -> No RESERVASI -> No PR -> Approval 1 & 2 -> Penawaran -> No PO
 *      CAPEX          : Budgeting -> No CAPEX -> Approval 1 & 2 -> No PR -> Penawaran -> No PO
 *  - Penulisan kini BY NAMA HEADER (bukan posisi) — aman bila urutan kolom
 *    di sheet berubah / ada kolom disisipkan.
 *  - Action "migrate": sisip kolom "Nomor Reservasi" + ubah Tipe Order
 *    "OHC" menjadi "MO" (sesuai revisi). Jalankan SEKALI setelah deploy v3.
 *
 *  CARA DEPLOY (pakai deployment yang SAMA agar URL web app tidak berubah):
 *  1. Buka https://script.google.com -> buka project ini.
 *  2. Ganti SELURUH isi file Code.gs dengan file ini.
 *  3. Klik Deploy -> Manage deployments -> klik icon ✏️ (edit) pada
 *     deployment yang ada -> Version: "New version" -> Deploy.
 *  4. Verifikasi: buka URL web app di browser (GET) -> harus tampil
 *     {"ok":true,...,"version":"3.1","headers":[...13 kolom...]}.
 *  5. Jalankan migrasi (dashboard/agent akan memanggil action "migrate").
 ************************************************************************/

var VERSION = '3.1';
var SECRET = ''; // kosongkan = tanpa kunci; isi string rahasia untuk proteksi sederhana
var SHEET_ID_FALLBACK = '1VW8t_bphHBQ7HxFpiv3S5plFgpkoBIO5xc4yaBi6gI0'; /* spreadsheet baru "Data Reservasi PR dan PO" */
var SHEET_NAME_FALLBACK = 'Response';

/* urutan kolom referensi (13 kolom — spreadsheet baru tanpa "Timestamp").
 * Hanya untuk info/echo — penulisan v3 memakai NAMA HEADER aktual di sheet. */
var HEADERS = [
  'Tanggal Input Reservasi',
  'Divisi',
  'Jenis Order',
  'Nomor Reservasi',
  'Nomor PR',
  'Nomor PO',
  'Approval 1',
  'Approval 2',
  'Keterangan',
  'Keperluan Order',
  'Status Kedatangan',
  'Tipe Order',
  'NO CAPEX'
];

/* ---------- akses GET (cek koneksi + versi yang sedang live) ---------- */
function doGet(e) {
  return json({
    ok: true,
    service: 'Monitor Order PR/PO backend',
    version: VERSION,
    headers: HEADERS,
    ts: nowStamp()
  });
}

/* ---------- entry point POST dari dashboard ---------- */
function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      return json(handlePost(e));
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function handlePost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) {
    throw new Error('Body harus JSON valid');
  }
  /* ref = identitas baris sebelum diedit (PR > Reservasi > Tanggal+Divisi)
     utk verifikasi bahwa rowId masih menunjuk baris yang sama */
  var ref = body.ref || null;

  if (SECRET && body.secret !== SECRET) throw new Error('Kunci akses (SECRET) tidak cocok');

  var sheetId = body.sheetId || SHEET_ID_FALLBACK;
  var sheetName = body.sheetName || SHEET_NAME_FALLBACK;
  var action = body.action;
  var rowId = body.rowId ? parseInt(body.rowId, 10) : null; // nomor baris sheet (1-based)
  var values = body.values || {};

  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
  if (!sheet) throw new Error('Sheet "' + sheetName + '" tidak ditemukan');

  if (action === 'add') return addRow(sheet, values);
  if (action === 'edit') return editRow(sheet, rowId, values, ref);
  if (action === 'delete') return deleteRow(sheet, rowId, values, ref);
  if (action === 'migrate') return migrateSheet(sheet);

  throw new Error('Aksi "' + action + '" tidak dikenal (pakai add/edit/delete/migrate)');
}

/* ---------- header dinamis: baca by NAMA, bukan posisi ---------- */
function headerRow(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) {
    return String(x).trim();
  });
}

function colIndex(sheet, headerName) {
  var h = headerRow(sheet);
  var want = String(headerName).trim().toLowerCase();
  for (var i = 0; i < h.length; i++) {
    if (h[i].toLowerCase() === want) return i;
  }
  return -1;
}

/* Pastikan kolom "Nomor Reservasi" ada — sisipkan SEBELUM "Nomor PR".
 * Mengembalikan daftar header aktual (setelah penyesuaian). */
function ensureColumns(sheet) {
  var h = headerRow(sheet);
  if (h.indexOf('Nomor Reservasi') < 0) {
    var prPos = h.indexOf('Nomor PR');                 // 0-based
    var at = (prPos >= 0 ? prPos : h.length) + 1;      // 1-based, sebelum kolom PR
    sheet.insertColumnBefore(at);
    sheet.getRange(1, at).setValue('Nomor Reservasi');
    h = headerRow(sheet);
  }
  return h;
}

function pick(values, headerName) {
  var v = values[headerName];
  return (v == null) ? null : String(v);
}

/* Tulis satu baris PENUH by nama header aktual.
 * preserve=true (edit): kolom yang tidak dikirim dipertahankan nilainya. */
function setRowValues(sheet, row, values, preserve) {
  var h = ensureColumns(sheet);
  var width = Math.max(h.length, 1);
  var old = (preserve && row > 1) ? sheet.getRange(row, 1, 1, width).getValues()[0] : null;
  var out = [];
  for (var i = 0; i < width; i++) {
    var name = h[i];
    if (!name) {                       /* kolom tanpa header: jangan disentuh */
      out.push(old ? old[i] : '');
      continue;
    }
    var v = pick(values, name);
    if (v == null) {
      if (old) v = old[i];
      else if (name === 'Timestamp') v = nowStamp();
      else v = '';
    }
    out.push(v);
  }
  sheet.getRange(row, 1, 1, width).setValues([out]);
}

function nowStamp() {
  var d = new Date();
  function p(n) { return String(n).padStart(2, '0'); }
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() +
         ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function rowMatchesRef(sheet, row, ref) {
  /* cocokkan identitas baris dgn referensi dari dashboard
     (Nomor PR > Nomor Reservasi > Tanggal+Divisi) */
  if (!ref) return true;
  var h = headerRow(sheet);
  function cell(name) {
    var i = h.indexOf(name);
    if (i < 0) return '';
    return String(sheet.getRange(row, i + 1).getDisplayValue()).trim();
  }
  var pr = String(ref['Nomor PR'] || '').trim();
  if (pr) return cell('Nomor PR') === pr;
  var resv = String(ref['Nomor Reservasi'] || '').trim();
  if (resv) return cell('Nomor Reservasi') === resv;
  var tgl = String(ref['Tanggal Input Reservasi'] || '').trim();
  var div = String(ref['Divisi'] || '').trim();
  if (tgl && cell('Tanggal Input Reservasi') !== tgl) return false;
  if (div && cell('Divisi') !== div) return false;
  return true;
}

function locateRow(sheet, rowId, values, ref) {
  if (rowId && rowId > 1) {
    if (rowMatchesRef(sheet, rowId, ref)) return rowId;
    /* baris bergeser (ada penghapusan/penambahan di sheet) — cari ulang via identitas */
    if (ref) {
      var prIdx = colIndex(sheet, 'Nomor PR');
      var resvIdx = colIndex(sheet, 'Nomor Reservasi');
      var last = sheet.getLastRow();
      var refPr = String(ref['Nomor PR'] || '').trim();
      var refResv = String(ref['Nomor Reservasi'] || '').trim();
      for (var r = 2; r <= last; r++) {
        if (refPr && prIdx >= 0 &&
            String(sheet.getRange(r, prIdx + 1).getValue()).trim() === refPr) return r;
        if (!refPr && refResv && resvIdx >= 0 &&
            String(sheet.getRange(r, resvIdx + 1).getValue()).trim() === refResv) return r;
      }
    }
    throw new Error('Baris tujuan sudah bergeser/diubah di spreadsheet — klik Sync lalu ulangi');
  }
  var pr = String(values['Nomor PR'] || '').trim();
  var resv2 = String(values['Nomor Reservasi'] || '').trim();
  var prIdx2 = colIndex(sheet, 'Nomor PR');
  var resvIdx2 = colIndex(sheet, 'Nomor Reservasi');
  var last2 = sheet.getLastRow();
  for (var r2 = 2; r2 <= last2; r2++) {
    if (pr && prIdx2 >= 0 &&
        String(sheet.getRange(r2, prIdx2 + 1).getValue()).trim() === pr) return r2;
    if (!pr && resv2 && resvIdx2 >= 0 &&
        String(sheet.getRange(r2, resvIdx2 + 1).getValue()).trim() === resv2) return r2;
  }
  throw new Error('Baris tidak ditemukan (rowId tidak valid & identitas tidak cocok)');
}

/* ---------- AKSI ---------- */
function addRow(sheet, values) {
  var row = sheet.getLastRow() + 1;
  setRowValues(sheet, row, values, false);
  return { ok: true, action: 'add', row: row, version: VERSION };
}

function editRow(sheet, rowId, values, ref) {
  var row = locateRow(sheet, rowId, values, ref);
  setRowValues(sheet, row, values, true); /* preserve kolom yang tak dikirim */
  return { ok: true, action: 'edit', row: row, version: VERSION };
}

function deleteRow(sheet, rowId, values, ref) {
  var row = locateRow(sheet, rowId, values, ref);
  sheet.deleteRow(row);
  return { ok: true, action: 'delete', row: row, version: VERSION };
}

/* ---------- MIGRASI (sekali, setelah deploy v3) ----------
 * 1. Sisipkan kolom "Nomor Reservasi" sebelum "Nomor PR" (bila belum ada).
 *    Data lama: Nomor PR 13xxx TETAP sebagai Nomor PR; Reservasi dibiarkan
 *    kosong (diisi mundur bila nomor reservasinya ditemukan).
 * 2. Ubah Tipe Order "OHC" menjadi "MO" (gabungan tipe). */
function migrateSheet(sheet) {
  var before = headerRow(sheet);
  var inserted = before.indexOf('Nomor Reservasi') < 0;
  var h = ensureColumns(sheet); /* sisip kolom bila perlu */

  var ti = h.indexOf('Tipe Order');
  var ohcToMo = 0;
  var last = sheet.getLastRow();
  if (ti >= 0 && last > 1) {
    var vals = sheet.getRange(2, ti + 1, last - 1, 1).getValues();
    var dirty = false;
    for (var r = 0; r < vals.length; r++) {
      if (String(vals[r][0]).trim().toUpperCase() === 'OHC') {
        vals[r][0] = 'MO';
        ohcToMo++;
        dirty = true;
      }
    }
    if (dirty) sheet.getRange(2, ti + 1, last - 1, 1).setValues(vals);
  }

  return {
    ok: true,
    action: 'migrate',
    version: VERSION,
    insertedColumn: inserted,
    columnInserted: inserted ? 'Nomor Reservasi (sebelum Nomor PR)' : null,
    ohcToMo: ohcToMo,
    rowsTotal: Math.max(last - 1, 0),
    headers: headerRow(sheet)
  };
}
