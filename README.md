# Purchase Bill Reader

Open-source GST purchase-invoice extractor for Indian small businesses.

Upload purchase bill photos or PDFs. Gemini reads them, the app checks every field against GST rules, you fix the rows marked in red, and you download a clean Excel sheet ready for your accounting software.

Built with Next.js. Runs locally or on Vercel.

## Features

- **Reads photos and PDFs** of purchase bills, including phone photos (shrunk in the browser before upload)
- **Extracts** supplier name and GSTIN, buyer GSTIN, invoice number and date, line items with HSN/SAC, taxable value, CGST/SGST/IGST and totals
- **Validates** every bill:
  - GSTIN format and checksum
  - Missing invoice number, date, GSTIN or HSN
  - Tax math against line items and the bill total
  - IGST vs CGST/SGST based on supplier state and your state
  - Buyer GSTIN mismatch
  - Duplicate invoices
- **Review table** where you edit any cell and the checks re-run instantly. Fields the model marked as unclear stay flagged until you edit them.
- **Excel export**, re-validated on the server before download
- **Stores nothing.** No database and no file storage. Data exists only in your open browser tab.

## Quick start (2 minutes, no Gemini key needed)

```bash
npm install
cp .env.example .env.local        # Windows: copy .env.example .env.local
```

Edit `.env.local`:

```
APP_PASSWORD=pick-a-long-passcode
DEMO_MODE=1
```

Run `npm run dev` and open http://localhost:3000. Upload any 3 images. Demo mode returns three sample bills (one clean, one with problems, one duplicate) so you can try the review table and the Excel export.

To read real bills, remove `DEMO_MODE`, add `GEMINI_API_KEY`, and restart.

## Deploy to Vercel

1. Fork this repo, or clone it and push it to your own GitHub account.
2. In Vercel: Add New > Project > import your repo. Framework is detected as Next.js. No build settings to change.
3. Before deploying, add Environment Variables (Production):
   - `GEMINI_API_KEY` from https://aistudio.google.com/apikey
   - `APP_PASSWORD`, a long passcode. Anyone with the link and the passcode can use the app and spend your Gemini quota.
   - Optional: `GEMINI_MODEL` (default `gemini-3.8-flash`; use a cheaper Flash-Lite model if you prefer)
4. Deploy. Open the URL and sign in with the passcode.

Command-line alternative:

```bash
npx vercel
npx vercel env add GEMINI_API_KEY
npx vercel env add APP_PASSWORD
npx vercel --prod
```

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes (unless demo mode) | Google Gemini API key |
| `APP_PASSWORD` | Yes | Shared passcode for signing in |
| `GEMINI_MODEL` | No | Gemini model name. Default `gemini-3.8-flash` |
| `DEMO_MODE` | No | Set to `1` to return sample bills without calling Gemini |

## Limits and notes

- **File size:** about 4 MB per file, because Vercel rejects larger request bodies. PDFs over 4 MB are refused with a clear message.
- **Processing:** each file is read in its own request (60-second cap), two files at a time.
- **Data handling:** bills are sent to the Gemini API for reading. The app itself stores nothing, so download the Excel before closing the tab.
- **Gemini key tier:** Google has treated free-tier API content differently from paid-tier content for product improvement. For business invoices, use a key from a billing-enabled project and check Google's current terms.
- **Access control:** the passcode is one shared secret with a short delay on wrong guesses. It suits a small private deployment, not a public service. Keep your URL private.
- **iPhone photos:** HEIC images may not open in some browsers. Set the camera to "Most Compatible" or share as JPEG.

## Project structure

```
app/
  page.tsx               The whole UI
  api/extract/route.ts   Sends an uploaded file to Gemini
  api/export/route.ts    Builds the Excel file (re-validates on the server)
  api/login/route.ts     Passcode cookie
lib/
  gemini.ts              Prompt and Gemini call (plain REST, no SDK)
  validate.ts            GST checks
  normalize.ts           Cleans up model output (dates, numbers, GSTINs)
  excel.ts               Workbook builder
  demo.ts                Sample bills for demo mode and tests
  auth.ts                Passcode handling
  types.ts               Shared types
scripts/
  selftest.ts            Run with `npm run selftest`
```

## Testing

```bash
npm run selftest
```

Runs the validation rules against the built-in sample bills. All sample data is synthetic. Please don't commit real invoices to this repo.

## Roadmap

- [ ] **Tally import:** export vouchers as Tally XML for direct import into Tally Prime
- [ ] **GSTR-2B reconciliation:** match extracted purchases against the GSTR-2B JSON from the GST portal and flag missing or mismatched invoices
- [ ] **Google Drive import:** read bills directly from a Drive folder
- [ ] **Batch history:** save and reopen past batches locally in the browser
- [ ] **CLI:** process a folder of bills from the terminal
- [ ] **Synthetic test set:** generated invoice images and PDFs with expected outputs, plus an accuracy report
- [ ] **Better extraction:** multi-page invoices, handwritten bills, credit and debit notes
- [ ] **Docs:** setup guide for non-technical users and a contributor guide

## Contributing

Issues and pull requests are welcome. Please use only synthetic or anonymised invoices in issues, tests and screenshots.

## License

[MIT](LICENSE)
