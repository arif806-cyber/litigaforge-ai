# Official bare-act PDF imports

Arif: upload these three text-selectable PDFs from India Code into this folder, using the exact filenames below:

- `bns-2023.pdf` — Bharatiya Nyaya Sanhita, 2023: https://www.indiacode.nic.in/bitstream/123456789/20062/1/a202345.pdf
- `bnss-2023.pdf` — Bharatiya Nagarik Suraksha Sanhita, 2023: https://www.indiacode.nic.in/bitstream/123456789/20099/1/A202346.pdf
- `bsa-2023.pdf` — Bharatiya Sakshya Adhiniyam, 2023: https://upload.indiacode.nic.in/view-casepdf?id=AC_CEN_5_23_00049_2023-47_1719292804654&type=act

Then, from `artifacts/litigaforge-ai`, run this one command:

```sh
python scripts/import_official_pdfs.py --act
```

The source manifest is prefilled in `sources.json`. For other Acts, add a filename entry with:

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

Only HTTPS URLs on government `gov.in` / `nic.in` domains are accepted.

The importer rejects production, validates the PDF, extracts selectable text, records the source URL, page count, and SHA-256, then upserts into `official_act_texts`. BNS, BNSS, and BSA are not claimed loaded until their PDFs are imported.

The Constitution PDF and three BPR&D crosswalk PDFs currently in this folder are official source materials. To re-parse their explicit correspondence rows, run:

```sh
python scripts/import_official_pdfs.py --crosswalks
```
