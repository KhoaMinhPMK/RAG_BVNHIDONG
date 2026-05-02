#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Download RAG knowledge documents for VinDr PCXR pediatric chest X-ray system.
Uses requests library for better HTTP handling.

Usage:
    conda activate basenew
    pip install requests
    python knowledge_base/scripts/download_knowledge.py

Output:
    knowledge_base/downloads/
"""

import sys
import os
import time
import json
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: requests library not installed. Run: pip install requests")
    sys.exit(1)

# Force UTF-8 encoding for Windows console
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ─── Config ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent / "downloads"
BASE_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/pdf,*/*",
}

# ─── Document List ───────────────────────────────────────────────────────────
DOCUMENTS = [
    {
        "id": "01",
        "title": "WHO Pocket Book - Hospital Care for Children 2023",
        "note": "WHO guidelines for childhood pneumonia diagnosis",
        "auto_download": False,
        "manual_url": "https://www.who.int/publications/i/item/9789241549585",
        "tags": ["pediatric", "pneumonia", "guideline", "who"],
    },
    {
        "id": "02",
        "title": "BTS Paediatric Pneumonia Guidelines",
        "note": "British Thoracic Society guidelines",
        "auto_download": False,
        "manual_url": "https://www.brit-thoracic.org.uk/document-library/guidelines/paediatric-pneumonia/",
        "tags": ["pediatric", "pneumonia", "guideline", "bts"],
    },
    {
        "id": "03",
        "title": "PERCH Study - WHO Chest X-ray Interpretation (Chen et al 2021)",
        "note": "Deep learning classification of pediatric CXR by WHO methodology. PLOS ONE paper.",
        "auto_download": True,
        "download_url": "https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0253239&type=printable",
        "filename": "03_PERCH_study_deep_learning_pediatric_CXR_Chen_2021.pdf",
        "tags": ["pediatric", "pneumonia", "perch", "deep-learning", "classification"],
    },
    {
        "id": "04",
        "title": "VinDr PCXR Dataset Paper (Nguyen et al)",
        "note": "Original dataset paper for VinDr PCXR - Nature Scientific Data",
        "auto_download": False,
        "manual_url": "https://www.nature.com/articles/s41597-023-02143-w",
        "tags": ["pediatric", "vindr", "pcxr", "dataset"],
    },
    {
        "id": "05",
        "title": "Radiographic Findings in Pediatric Pneumonia Review",
        "note": "Systematic review of radiographic findings in children",
        "auto_download": False,
        "manual_url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7111673/",
        "tags": ["pediatric", "pneumonia", "systematic-review", "radiographic-findings"],
    },
    {
        "id": "06",
        "title": "BTS Pleural Effusion Guidelines",
        "note": "Pleural effusion in children guidelines",
        "auto_download": False,
        "manual_url": "https://www.brit-thoracic.org.uk/document-library/guidelines/pleural-disease/bts-pleural-disease-guideline-2023/",
        "tags": ["pediatric", "pleural-effusion", "bts", "guideline"],
    },
    {
        "id": "07",
        "title": "Fleischner Society Chest CT Glossary",
        "note": "Standardized terminology for chest imaging findings",
        "auto_download": False,
        "manual_url": "https://pubs.rsna.org/doi/full/10.1148/rg.317115023",
        "tags": ["fleischner", "glossary", "terminology", "chest-imaging"],
    },
    {
        "id": "08",
        "title": "Cardiomegaly in Children - Radiopaedia Review",
        "note": "Comprehensive review of pediatric cardiomegaly",
        "auto_download": False,
        "manual_url": "https://radiopaedia.org/articles/cardiomegaly-1",
        "tags": ["pediatric", "cardiomegaly", "radiology"],
    },
    {
        "id": "09",
        "title": "Bronchial Thickening in Pediatric Pneumonia",
        "note": "Review of bronchial wall thickening as pneumonia sign",
        "auto_download": False,
        "manual_url": "https://radiopaedia.org/articles/bronchial-wall-thickening",
        "tags": ["pediatric", "bronchial-thickening", "pneumonia"],
    },
    {
        "id": "10",
        "title": "Reticulonodular Pattern in Pediatric Chest X-ray",
        "note": "Radiographic patterns in childhood pneumonia",
        "auto_download": False,
        "manual_url": "https://radiopaedia.org/articles/reticulonodular-pattern-chest",
        "tags": ["pediatric", "reticulonodular", "chest-xray"],
    },
]


def download_file(doc: dict) -> bool:
    """Download a single document with requests library."""
    if not doc["auto_download"]:
        print(f"  [SKIP] (manual download): {doc['title']}")
        print(f"         URL: {doc['manual_url']}")
        return False

    filename = doc.get("filename", f"{doc['id']}_{doc['title'][:50].replace(' ', '_').replace('/', '_')}.pdf")
    filepath = BASE_DIR / filename

    if filepath.exists():
        print(f"  [OK] ALREADY EXISTS: {filename}")
        return True

    url = doc.get("download_url", doc.get("manual_url", ""))
    if not url:
        print(f"  [ERROR] No download URL for: {doc['title']}")
        return False

    print(f"  [DL] Downloading: {doc['title']}")
    print(f"       URL: {url}")

    try:
        response = requests.get(url, headers=HEADERS, timeout=120, allow_redirects=True)
        response.raise_for_status()

        # Check content type
        content_type = response.headers.get("Content-Type", "")
        if "html" in content_type and "pdf" not in content_type:
            print(f"  [WARN] Server returned HTML instead of PDF. May need manual download.")
            # Still save it but warn
            filename = filename.replace(".pdf", ".html")
            filepath = BASE_DIR / filename

        with open(filepath, "wb") as f:
            f.write(response.content)

        actual_size = filepath.stat().st_size / 1024
        print(f"  [OK] DOWNLOADED: {filename} ({actual_size:.0f} KB)")
        return True

    except requests.exceptions.RequestException as e:
        print(f"  [ERROR] {e}")
        print(f"          Need manual download from: {doc.get('manual_url', url)}")
        return False
    except Exception as e:
        print(f"  [ERROR] Unexpected: {e}")
        return False


def generate_metadata():
    """Generate metadata.json for RAG ingestion."""
    metadata = []

    for doc in DOCUMENTS:
        filename = doc.get(
            "filename",
            f"{doc['id']}_{doc['title'][:50].replace(' ', '_').replace('/', '_')}.pdf"
        )
        filepath = BASE_DIR / filename

        entry = {
            "document_id": f"rag-doc-{doc['id']}",
            "title": doc["title"],
            "note": doc["note"],
            "filename": filename,
            "downloaded": filepath.exists(),
            "file_size_kb": round(filepath.stat().st_size / 1024, 1) if filepath.exists() else None,
            "manual_url": doc.get("manual_url", ""),
            "download_url": doc.get("download_url", ""),
            "tags": doc["tags"],
        }
        metadata.append(entry)

    output_path = BASE_DIR / "metadata.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f"\n[METADATA] Generated: {output_path}")
    return metadata


def print_manual_instructions():
    """Print instructions for manual downloads."""
    print("\n" + "=" * 70)
    print("[MANUAL DOWNLOAD INSTRUCTIONS - COPY THESE LINKS TO BROWSER]")
    print("=" * 70)

    for doc in DOCUMENTS:
        if not doc["auto_download"]:
            print(f"\n[{doc['id']}] {doc['title']}")
            print(f"     URL: {doc['manual_url']}")
            print(f"     Note: {doc['note']}")
            print(f"     Action: Open link in browser, download PDF")
            print(f"     Rename: {doc['id']}_{doc['title'][:40].replace(' ', '_')}.pdf")
            print(f"     Save to: knowledge_base/downloads/")


def main():
    """Main function."""
    # Write output to file for debugging
    log_file = BASE_DIR / "run_log.txt"

    output_lines = []
    def log(msg):
        output_lines.append(msg)
        # Also print but in ASCII-safe way
        print(msg, flush=True)

    log("=" * 70)
    log("[DOWNLOADING RAG KNOWLEDGE DOCUMENTS FOR VinDr PCXR]")
    log("=" * 70)
    log(f"Output directory: {BASE_DIR}")
    log("")

    # Download all documents
    stats = {"total": len(DOCUMENTS), "downloaded": 0, "skipped": 0, "failed": 0}

    for i, doc in enumerate(DOCUMENTS, 1):
        log(f"[{i}/{stats['total']}] Processing: {doc['title']}")

        if doc["auto_download"]:
            try:
                success = download_file(doc)
                if success:
                    stats["downloaded"] += 1
                else:
                    stats["failed"] += 1
                time.sleep(2)  # Rate limiting
            except Exception as e:
                log(f"  [ERROR] Exception: {e}")
                stats["failed"] += 1
        else:
            log(f"  [SKIP] manual download required")
            stats["skipped"] += 1

        log("")

    # Generate metadata
    metadata = generate_metadata()

    # Print summary
    log("\n" + "=" * 70)
    log("[DOWNLOAD SUMMARY]")
    log("=" * 70)
    log(f"Total documents: {stats['total']}")
    log(f"[OK] Auto-downloaded: {stats['downloaded']}")
    log(f"[SKIP] Manual required: {stats['skipped']}")
    log(f"[ERROR] Failed: {stats['failed']}")

    # Print manual instructions
    if stats["skipped"] > 0 or stats["failed"] > 0:
        print_manual_instructions()

    # Print next steps
    log("\n" + "=" * 70)
    log("[NEXT STEPS]")
    log("=" * 70)
    log("1. Manual download cac file con thieu theo huong dan tren")
    log("2. Luu vao: knowledge_base/downloads/")
    log("3. Rename theo format: {id}_{title}.pdf")
    log("4. Chay RAG ingestion script de tao vector embeddings")
    log("5. Test voi: curl -X POST http://localhost:3001/api/query")
    log("")

    # Write log to file
    with open(log_file, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines))
    log(f"Log written to: {log_file}")


if __name__ == "__main__":
    main()
