# Google Sheets Sync — Setup

The app syncs change-events to the `copy testing` tab via `/api/sync`.

## One-time setup
1. Google Cloud Console → create a **Service Account** → create a JSON key, download it.
2. Enable the **Google Sheets API** for that project.
3. Open the Sheet `APP JL Project Status for app` → Share → add the service account email
   (looks like `name@project.iam.gserviceaccount.com`) with **Editor** access.
4. Set env vars (local `.env.local` + Vercel → Settings → Environment Variables):
   - `SYNC_SHEET_ID` = `1rzZn9J2p6Plz7Xxy9-JwgdijFkqGg7WC2rFpNnxUreY`
   - `GOOGLE_SERVICE_ACCOUNT_KEY` = the full JSON of the service account (one line).
5. Redeploy on Vercel.

## Notes
- These are server-only (no `VITE_` prefix) — never exposed to the browser.
- The old n8n workflow (`N8N_SETUP.md`, `n8n-workflow-app-to-sheet.json`) is obsolete.
