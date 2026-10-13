# Official bare-act PDF imports

Place government-hosted, text-selectable Act PDFs in this directory. The expected filenames and official source URLs are prefilled in `sources.json`; edit a source entry if you use a different official edition. For other Acts, add a filename entry with:

```json
{
  "bns-2023.pdf": {
    "id": "bns-2023",
    "title": "Bharatiya Nyaya Sanhita, 2023",
    "source_url": "https://www.indiacode.nic.in/...",
    "aliases": ["BNS"]
  }
}
```

Only HTTPS URLs on government `gov.in` / `nic.in` domains are accepted. From `artifacts/litigaforge-ai`, run:

```sh
python scripts/import_official_pdfs.py --act
```

The importer rejects production, validates the PDF, extracts selectable text, records the source URL, page count, and SHA-256, then upserts into `official_act_texts`. BNS, BNSS, and BSA are not claimed loaded until their PDFs are imported.

The Constitution PDF and three BPR&D crosswalk PDFs currently in this folder are official source materials. To re-parse their explicit correspondence rows, run:

```sh
python scripts/import_official_pdfs.py --crosswalks
```
