/************************************************************************
 *  Code.gs — Backend Google Apps Script untuk "Monitor Order PR & PO"
 *  Menerima aksi ADD / EDIT / DELETE dari dashboard (GitHub Pages)
 *  lalu menuliskannya ke Google Spreadsheet yang sama.
 *
 *  VERSION: 2.2 (13 kolom — termasuk "Status Kedatangan", "Tipe Order", "NO CAPEX")
 *
 *  CARA DEPLOY (sekali saja, atau update):
 *  1. Buka https://script.google.com -> buka project ini.
 *  2. Ganti SELURUH isi file Code.gs dengan file ini.
 *  3. Klik Deploy -> Manage deployments -> klik icon ✏️ (edit) pada
 *     deployment yang ada -> Version: "New version" -> Deploy.
 *     (Gunakan deployment YANG SAMA agar URL web app tidak berubah.)
 *  4. Verifikasi: buka URL web app di browser (GET) -> harus tampil
 *     {"ok":true,...,"version":"2.0","headers":[...11 kolom...]}
 ************************************************************************/

var VERSION = '2.2';
var SECRET = ''; // kosongkan = tanpa kunci; isi string rahasia untuk proteksi sederhana
var SHEET_ID_FALLBACK = '1F9BpVC2wrV2VIc5cJ5M5EmwlptXnnf6eafo0nMY7KFc';
var SHEET_NAME_FALLBACK = 'Response';

/* urutan kolom pada sheet "Response" (A..M) — 13 kolom
 * (kolom baru "Tipe Order" & "NO CAPEX" berada di AKHIR sheet,
 *  bukan mengikuti urutan pertanyaan di Google Form) */
var HEADERS = [
  'Timestamp',
  'Tanggal Input Reservasi',
  'Divisi',
  'Jenis Order',
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
  /* ref = identitas baris sebelum diedit (PR/Tanggal/Divisi) utk verifikasi
     bahwa rowId masih menunjuk baris yang sama (antisipasi baris bergeser) */
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

  throw new Error('Aksi "' + action + '" tidak dikenal (pakai add/edit/delete)');
}

/* ---------- posisi & pemetaan ---------- */
function colIndex(sheet, headerName) {
  var h = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  for (var i = 0; i < h.length; i++) {
    if (String(h[i]).trim().toLowerCase() === String(headerName).trim().toLowerCase()) return i;
  }
  /* fallback: cocokkan dgn urutan HEADERS */
  return HEADERS.indexOf(headerName);
}

function pick(values, headerName) {
  var v = values[headerName];
  return (v == null) ? null : String(v);
}

function setRowValues(sheet, row, values, preserve) {
  /* preserve: array nilai lama (utk edit) agar kolom yg tak dikirim tidak terhapus */
  var out = [];
  for (var i = 0; i < HEADERS.length; i++) {
    var name = HEADERS[i];
    var v = pick(values, name);
    if (v == null) {
      if (preserve && row > 1) {
        v = sheet.getRange(row, i + 1).getValue();
      } else if (name === 'Timestamp') {
        v = nowStamp();
      } else {
        v = '';
      }
    }
    out.push(v);
  }
  sheet.getRange(row, 1, 1, HEADERS.length).setValues([out]);
}

function nowStamp() {
  var d = new Date();
  function p(n) { return String(n).padStart(2, '0'); }
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() +
         ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function rowMatchesRef(sheet, row, ref) {
  /* cocokkan identitas baris dgn referensi dari dashboard (PR > Tanggal+Divisi) */
  if (!ref) return true;
  var pr = String(ref['Nomor PR'] || '').trim();
  if (pr) {
    var prIdx = colIndex(sheet, 'Nomor PR');
    return String(sheet.getRange(row, prIdx + 1).getValue()).trim() === pr;
  }
  var tgl = String(ref['Tanggal Input Reservasi'] || '').trim();
  var div = String(ref['Divisi'] || '').trim();
  if (tgl) {
    var tIdx = colIndex(sheet, 'Tanggal Input Reservasi');
    if (String(sheet.getRange(row, tIdx + 1).getDisplayValue()).trim() !== tgl) return false;
  }
  if (div) {
    var dIdx = colIndex(sheet, 'Divisi');
    if (String(sheet.getRange(row, dIdx + 1).getValue()).trim() !== div) return false;
  }
  return true;
}

function locateRow(sheet, rowId, values, ref) {
  if (rowId && rowId > 1) {
    if (rowMatchesRef(sheet, rowId, ref)) return rowId;
    /* baris bergeser (ada penghapusan/penambahan di sheet) — cari ulang via identitas */
    if (ref) {
      var refPr = String(ref['Nomor PR'] || '').trim();
      if (refPr) {
        var prIdx2 = colIndex(sheet, 'Nomor PR');
        var last2 = sheet.getLastRow();
        for (var r2 = 2; r2 <= last2; r2++) {
          if (String(sheet.getRange(r2, prIdx2 + 1).getValue()).trim() === refPr) return r2;
        }
      }
    }
    throw new Error('Baris tujuan sudah bergeser/diubah di spreadsheet — klik Sync lalu ulangi');
  }
  var pr = String(values['Nomor PR'] || '').trim();
  if (pr) {
    var prIdx = colIndex(sheet, 'Nomor PR');
    var last = sheet.getLastRow();
    for (var r = 2; r <= last; r++) {
      if (String(sheet.getRange(r, prIdx + 1).getValue()).trim() === pr) return r;
    }
  }
  throw new Error('Baris tidak ditemukan (rowId tidak valid & Nomor PR tidak cocok)');
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
