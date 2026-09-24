/************************************************************************
 *  Code.gs — Backend Google Apps Script untuk "Monitor Order PR & PO"
 *  Tujuan : menerima aksi ADD / EDIT / DELETE dari dashboard web (GitHub Pages)
 *           lalu menuliskannya ke Google Spreadsheet yang sama.
 *
 *  CARA DEPLOY (sekali saja):
 *  1. Buka https://script.google.com  -> New project.
 *  2. Tempel seluruh isi file ini ke editor (ganti nama project bebas).
 *  3. (Opsional) isi SECRET di bawah bila ingin kunci akses sederhana.
 *  4. Klik Deploy -> New deployment -> type: Web app
 *       - Execute as : Me (akun pemilik spreadsheet)
 *       - Who has access : Anyone
 *  5. Salin URL "Web app" (…/macros/s/XXXX/exec) -> tempel ke variabel
 *     SCRIPT_URL di index.html ATAU buka dashboard dengan param:
 *     ?scriptUrl=https://script.google.com/macros/s/XXXX/exec
 *  6. Pastikan akun pemilik script adalah EDITOR spreadsheet target.
 *
 *  CATATAN KEAMANAN: siapa pun yang tahu URL web app dapat menulis.
 *  Untuk keperluan internal, simpan URL hanya di index.html milik Anda.
 ************************************************************************/

var SECRET = ''; // kosongkan = tanpa kunci; isi string rahasia untuk proteksi sederhana
var SHEET_ID_FALLBACK = '1F9BpVC2wrV2VIc5cJ5M5EmwlptXnnf6eafo0nMY7KFc';
var SHEET_NAME_FALLBACK = 'Response';

/* urutan kolom pada sheet "Response" (A..J) */
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
  'Keperluan Order'
];

/* ---------- entry point utama (POST dari dashboard) ---------- */
function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var result = handlePost(e);
      return json(result);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ---------- akses GET (cek koneksi) ---------- */
function doGet(e) {
  return json({ ok: true, service: 'Monitor Order PR/PO backend', ts: nowStamp() });
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

  if (SECRET && body.secret !== SECRET) throw new Error('Kunci akses (SECRET) tidak cocok');

  var sheetId = body.sheetId || SHEET_ID_FALLBACK;
  var sheetName = body.sheetName || SHEET_NAME_FALLBACK;
  var action = body.action;
  var rowId = body.rowId ? parseInt(body.rowId, 10) : null; // nomor baris sheet (1-based)
  var values = body.values || {};

  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
  if (!sheet) throw new Error('Sheet "' + sheetName + '" tidak ditemukan');

  if (action === 'add') {
    return addRow(sheet, values);
  } else if (action === 'edit') {
    return editRow(sheet, rowId, values);
  } else if (action === 'delete') {
    return deleteRow(sheet, rowId, values);
  }
  throw new Error('Aksi "' + action + '" tidak dikenal (pakai add/edit/delete)');
}

/* ---------- posisi & pemetaan ---------- */
function headerRow(sheet) {
  var first = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  return first;
}

function colIndex(sheet, headerName) {
  var h = headerRow(sheet);
  for (var i = 0; i < h.length; i++) {
    if (String(h[i]).trim().toLowerCase() === String(headerName).trim().toLowerCase()) return i;
  }
  return -1;
}

/* cari baris data: pakai rowId bila diberikan, fallback cocokkan Nomor PR */
function locateRow(sheet, rowId, values) {
  var lastRow = sheet.getLastRow();
  if (rowId && rowId > 1) {
    return rowId; // rowId sudah 1-based nomor baris sheet
  }
  var pr = String(values['Nomor PR'] || values['nomor pr'] || '').trim();
  if (pr) {
    var prIdx = colIndex(sheet, 'Nomor PR');
    if (prIdx >= 0) {
      for (var r = 2; r <= lastRow; r++) {
        var cell = sheet.getRange(r, prIdx + 1).getValue();
        if (String(cell).trim() === pr) return r;
      }
    }
  }
  throw new Error('Baris tidak ditemukan (rowId tidak valid & Nomor PR tidak cocok)');
}

/* ---------- nilai dalam urutan kolom ---------- */
function pick(values, headerName) {
  return (values[headerName] != null) ? String(values[headerName]) : '';
}

function buildRowValues(sheet, values, isNew) {
  var out = [];
  for (var i = 0; i < HEADERS.length; i++) {
    var name = HEADERS[i];
    if (name === 'Timestamp') {
      out.push(pick(values, name) || (isNew ? nowStamp() : ''));
    } else {
      out.push(pick(values, name));
    }
  }
  return out;
}

function nowStamp() {
  var d = new Date();
  function p(n) { return String(n).padStart(2, '0'); }
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() +
         ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

/* ---------- AKSI ---------- */
function addRow(sheet, values) {
  var last = sheet.getLastRow();
  var row = last + 1;
  var out = buildRowValues(sheet, values, true);
  sheet.getRange(row, 1, 1, HEADERS.length).setValues([out]);
  return { ok: true, action: 'add', row: row };
}

function editRow(sheet, rowId, values) {
  var row = locateRow(sheet, rowId, values);
  var out = buildRowValues(sheet, values, false);
  sheet.getRange(row, 1, 1, HEADERS.length).setValues([out]);
  return { ok: true, action: 'edit', row: row };
}

function deleteRow(sheet, rowId, values) {
  var row = locateRow(sheet, rowId, values);
  sheet.deleteRow(row);
  return { ok: true, action: 'delete', row: row };
}
