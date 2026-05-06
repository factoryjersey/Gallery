#!/usr/bin/env python3
"""
Extract contributor information from Gallery magazine PDF issues.
Handles two formats:
  Modern (post ~163): CONTRIBUTORS page with NAME (all-caps) + bio paragraph
  Legacy (pre ~163):  Masthead with EDITORIAL / PHOTOGRAPHERS credit lists

Usage:
  python3 scripts/extract_contributors.py           # process all issues
  python3 scripts/extract_contributors.py 189        # process single issue
"""

import sys, os, re, json, subprocess, tempfile
import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL', '')

def get_db():
    return psycopg2.connect(DATABASE_URL)

def download_pdf(url, path):
    result = subprocess.run(
        ['curl', '-s', '-L', '-A',
         'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
         '--max-time', '60', '-o', path, url],
        capture_output=True, timeout=90
    )
    return result.returncode == 0 and os.path.exists(path) and os.path.getsize(path) > 10000

SKIP_WORDS = {
    'EDITORIAL', 'PHOTOGRAPHY', 'ILLUSTRATION', 'GRAPHIC', 'FEATURE',
    'GALLERY', 'LIFE', 'STYLE', 'JERSEY', 'NUMBERS', 'INSTAGRAM',
    'FACEBOOK', 'TWITTER', 'CONTENTS', 'SECTIONS', 'AUDIO', 'NOTES',
    'WE PROFILE', 'ISLANDERS', 'FEATURE WE', 'FEATURE WE PROFILE',
    'CONTRIBUTE', 'ADVERTISE', 'SUBSCRIBE',
}

def parse_modern_contributors(text):
    """Modern format: CONTRIBUTORS heading + NAME (all-caps) + bio paragraph."""
    upper = text.upper()
    contrib_idx = upper.find('CONTRIBUTORS')
    if contrib_idx < 0 or contrib_idx > 500:
        return None

    # Reject masthead pages (emails appear before the heading)
    pre_text = text[:contrib_idx]
    if '@' in pre_text and pre_text.count('@') > 1:
        return None

    lines = [l.strip() for l in text.split('\n') if l.strip()]
    results = []

    # Find the CONTRIBUTORS line and start after it
    start_idx = 0
    for i, line in enumerate(lines):
        if 'CONTRIBUTORS' in line.upper() and len(line) < 50:
            start_idx = i + 1
            break

    # Skip "#NNN CONTRIBUTORS" sub-header
    if start_idx < len(lines) and re.match(r'^#\d+', lines[start_idx]):
        start_idx += 1

    working_lines = lines[start_idx:]
    i = 0

    while i < len(working_lines):
        line = working_lines[i]

        # All-caps contributor name: 2-5 words, no digits
        if (re.match(r'^[A-Z][A-ZÁÉÍÓÚ\s\-\.\']{3,40}$', line) and
                2 <= len(line.split()) <= 5 and
                not any(line.startswith(kw) or line == kw for kw in SKIP_WORDS) and
                not re.search(r'\d', line) and '@' not in line):

            name = line.strip()
            bio_lines, page_ref = [], None
            j = i + 1

            while j < len(working_lines) and len(bio_lines) < 8:
                nxt = working_lines[j]
                if (re.match(r'^[A-Z][A-Z\s\-\.]{3,40}$', nxt) and
                        len(nxt.split()) >= 2 and '@' not in nxt):
                    break
                if any(nxt.upper().startswith(kw) for kw in
                       ('EDITORIAL CONTRIBUTORS', 'PHOTOGRAPHY', 'ILLUSTRATION',
                        'CAN YOU CREATE', 'CONTRIBUTE@', 'THE RUNDOWN', 'FEATURE WE')):
                    break
                pg = re.search(r'Pg\.?\s*(\d+)', nxt, re.IGNORECASE)
                if pg:
                    page_ref = f"Pg. {pg.group(1)}"
                bio_lines.append(nxt)
                j += 1

            bio = ' '.join(bio_lines).strip() if bio_lines else None
            if bio or page_ref:
                results.append({'name': name, 'bio': bio, 'page_ref': page_ref, 'role': 'contributor'})
            i = j
            continue

        # EDITORIAL CONTRIBUTORS credit list
        if 'EDITORIAL CONTRIBUTORS' in line.upper():
            j = i + 1
            while j < len(working_lines) and j < i + 12:
                nxt = working_lines[j]
                if re.match(r'^[A-Z][a-z]+ [A-Z][a-z]+', nxt) and len(nxt.split()) <= 4:
                    results.append({'name': nxt, 'bio': None, 'page_ref': None, 'role': 'editorial'})
                elif re.match(r'^[A-Z]{4,}', nxt):
                    break
                j += 1
            i = j
            continue

        # PHOTOGRAPHY / ILLUSTRATION credit list
        if re.match(r'^PHOTOGRAPHY|^ILLUSTRATION', line.upper()) and i > 0:
            j = i + 1
            while j < len(working_lines) and j < i + 12:
                nxt = working_lines[j]
                if re.match(r'^[A-Z][a-z]+ [A-Z][a-z]+', nxt) and len(nxt.split()) <= 4:
                    results.append({'name': nxt, 'bio': None, 'page_ref': None, 'role': 'photography'})
                elif re.match(r'^[A-Z]{4,}', nxt):
                    break
                j += 1
            i = j
            continue

        i += 1

    return results if results else None


def parse_legacy_contributors(text):
    """Legacy format: EDITORIAL / PHOTOGRAPHERS credit lists on masthead page."""
    upper = text.upper()

    # Must have EDITORIAL or PHOTOGRAPHERS in first 800 chars
    edit_idx = upper.find('EDITORIAL')
    photo_idx = max(upper.find('PHOTOGRAPHER'), upper.find('PHOTOGRAPHY'))

    if edit_idx < 0 and photo_idx < 0:
        return None
    if min(x for x in [edit_idx, photo_idx] if x >= 0) > 800:
        return None

    lines = [l.strip() for l in text.split('\n') if l.strip()]
    results = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # EDITORIAL section
        if line.upper() in ('EDITORIAL', 'EDITORIAL TEAM', 'EDITORIAL CONTRIBUTORS', 'CONTRIBUTORS'):
            j = i + 1
            while j < len(lines) and j < i + 15:
                nxt = lines[j]
                # Mixed case name: "First Last" or "First Middle Last"
                if (re.match(r'^[A-Z][a-z]+ [A-Z][a-z]', nxt) and
                        len(nxt.split()) <= 4 and '@' not in nxt):
                    results.append({'name': nxt, 'bio': None, 'page_ref': None, 'role': 'editorial'})
                elif re.match(r'^[A-Z]{4,}', nxt) or '@' in nxt:
                    break
                j += 1
            i = j
            continue

        # PHOTOGRAPHERS / PHOTOGRAPHY section
        if re.match(r'^PHOTOGRAPHER|^PHOTOGRAPHY', line.upper()):
            j = i + 1
            while j < len(lines) and j < i + 15:
                nxt = lines[j]
                if (re.match(r'^[A-Z][a-z]+ [A-Z][a-z]', nxt) and
                        len(nxt.split()) <= 4 and '@' not in nxt):
                    results.append({'name': nxt, 'bio': None, 'page_ref': None, 'role': 'photography'})
                elif re.match(r'^[A-Z]{4,}', nxt) or '@' in nxt:
                    break
                j += 1
            i = j
            continue

        i += 1

    return results if results else None


def extract_contributors(pdf_path):
    try:
        import fitz
    except ImportError:
        print("pymupdf not installed", file=sys.stderr)
        return [], None

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Cannot open PDF: {e}", file=sys.stderr)
        return [], None

    results = []
    found_page = None

    for page_num in range(min(35, doc.page_count)):
        page = doc[page_num]
        text = page.get_text('text').strip()
        if len(text) < 30:
            continue

        # Try modern format first
        r = parse_modern_contributors(text)
        if r:
            results = r
            found_page = page_num + 1
            break

        # Try legacy format on early pages only (masthead is usually pages 6-12)
        if 4 <= page_num <= 15:
            r = parse_legacy_contributors(text)
            if r and len(r) >= 2:
                results = r
                found_page = page_num + 1
                break

    doc.close()
    return results, found_page


def process_issue(conn, issue_number, pdf_url):
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
        tmp_path = f.name

    try:
        print(f"  Downloading issue #{issue_number}...", file=sys.stderr)
        if not download_pdf(pdf_url, tmp_path):
            return {'issue': issue_number, 'error': 'download failed', 'count': 0}

        contributors, found_page = extract_contributors(tmp_path)

        if not contributors:
            return {'issue': issue_number, 'error': 'no contributors found', 'count': 0, 'page': found_page}

        cur = conn.cursor()
        cur.execute("DELETE FROM issue_contributors WHERE issue_number = %s", (issue_number,))
        for c in contributors:
            cur.execute(
                "INSERT INTO issue_contributors (issue_number, name, bio, page_ref, role) VALUES (%s, %s, %s, %s, %s)",
                (issue_number, c['name'], c.get('bio'), c.get('page_ref'), c.get('role'))
            )
        conn.commit()
        cur.close()

        return {'issue': issue_number, 'count': len(contributors), 'page': found_page}

    finally:
        try:
            os.unlink(tmp_path)
        except:
            pass


def main():
    target_issue = int(sys.argv[1]) if len(sys.argv) > 1 else None

    conn = get_db()
    cur = conn.cursor()

    if target_issue:
        cur.execute(
            "SELECT number, pdf_url FROM issues WHERE number = %s AND pdf_url IS NOT NULL AND pdf_url != ''",
            (target_issue,)
        )
    else:
        cur.execute(
            "SELECT number, pdf_url FROM issues WHERE pdf_url IS NOT NULL AND pdf_url != '' ORDER BY number DESC"
        )

    rows = cur.fetchall()
    cur.close()

    results = []
    for number, pdf_url in rows:
        print(f"Processing issue #{number}...", file=sys.stderr)
        r = process_issue(conn, number, pdf_url)
        results.append(r)
        status = f"✓ {r['count']} contributors" if r.get('count', 0) > 0 else f"✗ {r.get('error', 'unknown')}"
        print(f"  Issue #{number}: {status}", file=sys.stderr)

    conn.close()
    print(json.dumps({'results': results, 'total': sum(r.get('count', 0) for r in results)}))


if __name__ == '__main__':
    main()
