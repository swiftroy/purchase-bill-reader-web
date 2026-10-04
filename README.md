# Purchase bill reader (web app)

Upload purchase bill photos or PDFs, Gemini reads them, the app checks them, you fix the red rows and download an Excel sheet. Built with Next.js for Vercel.

## Run it locally first (2 minutes, no Gemini key needed)

    npm install
    cp .env.example .env.local        (Windows: copy .env.example .env.local)

Edit `.env.local`:

    APP_PASSWORD=pick-a-long-passcode
    DEMO_MODE=1

Then `npm run dev` and open http://localhost:3000. Upload any 3 images. Demo mode returns three sample bills (one clean, one with problems, one duplicate) so you can see the review table and the Excel export.

For real reading, remove `DEMO_MODE`, add `GEMINI_API_KEY`, restart.

## Deploy to Vercel

1. Push this folder to a GitHub repo (private).
2. In Vercel: Add New > Project > import the repo. Framework is detected as Next.js. No build settings to change.
3. Before deploying, add Environment Variables (Production):
   - `GEMINI_API_KEY` from https://aistudio.google.com/apikey
   - `APP_PASSWORD` a long passcode. Anyone with the link and the passcode can use the app and spend your Gemini quota.
   - optional `GEMINI_MODEL` (default `gemini-3.8-flash`; use a cheaper Flash-Lite model if you prefer)
4. Deploy. Open the URL, sign in with the passcode.

Command-line alternative: `npx vercel` then `npx vercel env add GEMINI_API_KEY`, `npx vercel env add APP_PASSWORD`, `npx vercel --prod`.

## Things to know

- Per-file limit is about 4 MB, because Vercel rejects larger request bodies. Photos are shrunk in the browser before upload, so phone photos are fine. A PDF over 4 MB is refused with a clear message.
- Each file is read in its own request (60 second cap). Two files are processed at a time.
- Bills are sent to the Gemini API. This app stores nothing: no database, no file storage. Rows exist only in the open browser tab, so download the Excel before closing it.
- Privacy of the Gemini key tier: Google has treated free-tier API content differently from paid-tier content for product improvement. For a client's invoices, use a key from a billing-enabled project and check Google's current terms.
- The passcode is one shared secret with a short delay on wrong guesses. It is fine for a small private tool, not for a public service. Keep the URL private.
- HEIC photos (iPhone default) may not open in some browsers. Set the camera to "Most Compatible" or share as JPEG.

## What it checks (same rules as the Python script)

GSTIN format and checksum, missing invoice number/date/GSTIN/HSN, tax math against the bill total and line items, IGST vs CGST/SGST against the supplier's state and your state (enter your GSTIN at the top), buyer GSTIN mismatch, duplicate invoices. Edit any cell and the checks re-run immediately. Fields the model flagged as unclear stay flagged until you edit them.

## Files

- `app/page.tsx` the whole UI
- `app/api/extract/route.ts` upload to Gemini
- `app/api/export/route.ts` builds the Excel file (re-validates on the server)
- `app/api/login/route.ts` passcode cookie
- `lib/gemini.ts` prompt and Gemini call (plain REST, no SDK)
- `lib/validate.ts`, `lib/normalize.ts`, `lib/excel.ts` checks, cleanup, workbook
- `scripts/selftest.ts` run with `npm run selftest`

## Not built yet

Import into Tally. The Excel sheet is the handoff for now.
