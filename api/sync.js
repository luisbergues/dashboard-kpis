// Vercel serverless function — writes app events into the 'copy testing' tab
// of the project Sheet, matched by SO#. Replaces the former n8n webhook.
// Secrets (GOOGLE_SERVICE_ACCOUNT_KEY, SYNC_SHEET_ID) stay server-side.
import { google } from 'googleapis';
import { mapEventToCells } from './lib/syncMapping.js';
import { requireAuth } from './lib/verifyAuth.js';

const TAB = 'copy testing';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return { auth: null, diag: 'missing' };
  let creds;
  try { creds = JSON.parse(raw); } catch (e) { return { auth: null, diag: 'parse_error: ' + e.message }; }
  if (!creds.client_email || !creds.private_key) return { auth: null, diag: 'missing client_email or private_key field' };
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return { auth, diag: 'ok:' + creds.client_email };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!(await requireAuth(req, res))) return;

  const spreadsheetId = process.env.SYNC_SHEET_ID;
  const { auth, diag } = getAuth();
  if (!spreadsheetId || !auth) {
    const payload = { error: 'Sheets sync not configured (SYNC_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_KEY)' };
    if (process.env.NODE_ENV !== 'production') {
      const nearMatches = Object.keys(process.env).filter(k => k.toUpperCase().includes('SYNC') || k.toUpperCase().includes('SHEET'));
      payload.diag_sheetId = spreadsheetId ? `present (len=${spreadsheetId.length})` : 'MISSING';
      payload.diag_auth = diag;
      payload.diag_nearMatchKeys = nearMatches;
    }
    res.status(500).json(payload);
    return;
  }

  const body = req.body || {};
  const so = body.so != null ? String(body.so).trim() : '';
  if (!so) { res.status(400).json({ error: 'Missing "so"' }); return; }

  const { writes, needsObsRead } = mapEventToCells(body);
  if (writes.length === 0) { res.status(200).json({ skipped: 'no mapped columns', eventType: body.eventType }); return; }

  try {
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Find the row number by SO# (column B), data starts at row 2.
    const colB = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${TAB}!B2:B`,
    });
    const rows = colB.data.values || [];
    let rowNumber = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] != null && String(rows[i][0]).trim() === so) { rowNumber = i + 2; break; }
    }
    if (rowNumber === -1) { res.status(200).json({ skipped: 'SO not found', so }); return; }

    // 2. OBS append: read current col O, prepend it with ' - '.
    let finalWrites = writes;
    if (needsObsRead) {
      const cur = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!O${rowNumber}` });
      const prev = (cur.data.values && cur.data.values[0] && cur.data.values[0][0]) ? String(cur.data.values[0][0]) : '';
      const note = writes[0].value;
      finalWrites = [{ col: 'O', value: prev ? `${prev} - ${note}` : note }];
    }

    // 3. Batch-write each cell to its exact range.
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: finalWrites.map(w => ({ range: `${TAB}!${w.col}${rowNumber}`, values: [[w.value]] })),
      },
    });

    res.status(200).json({ ok: true, so, eventType: body.eventType });
  } catch (err) {
    console.error('Sheet sync error:', err?.message || err);
    res.status(502).json({ error: 'Sheets write failed' });
  }
}
