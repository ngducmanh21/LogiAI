# 05 — Legal Data Pipeline

> Quy trình thu thập, xử lý, và index dữ liệu biểu thuế, chú giải HS, và văn bản pháp luật

---

## 1. Tổng quan Data Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA SOURCES                                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Biểu thuế XNK│  │ Chú giải HS  │  │ Thông tư / Nghị định │ │
│  │ (Excel)       │  │ 2022 (PDF)   │  │ (PDF)                 │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
└─────────┼──────────────────┼─────────────────────┼─────────────┘
          │                  │                     │
          ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INGESTION LAYER                                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Excel Parser │  │ PDF Parser   │  │ PDF Parser            │ │
│  │ (openpyxl)   │  │ (pdfplumber  │  │ + Structure Extractor │ │
│  │              │  │  + OCR)      │  │                        │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
└─────────┼──────────────────┼─────────────────────┼─────────────┘
          │                  │                     │
          ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PROCESSING LAYER                               │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Clean &      │  │ Section      │  │ Article               │ │
│  │ Normalize    │  │ Chunking     │  │ Chunking              │ │
│  │ HS rows      │  │ (hierarchy)  │  │ (Điều/Khoản/Mục)     │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
└─────────┼──────────────────┼─────────────────────┼─────────────┘
          │                  │                     │
          ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE LAYER                                 │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ PostgreSQL   │  │ Qdrant       │  │ Elasticsearch         │ │
│  │ (structured) │  │ (vectors)    │  │ (full-text)           │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Pipeline 1: Biểu thuế XNK (Excel → PostgreSQL + Qdrant)

### 2.1 Nguồn dữ liệu

**File:** `data/BieuthueXNK/BIEU THUE XNK 2026.04.05.xlsx`

**Cấu trúc dự kiến của Excel:**
| Cột | Nội dung | Ví dụ |
|---|---|---|
| A | Mã HS (8-10 số) | 5407.52.00 |
| B | Mô tả hàng hóa (tiếng Việt) | Vải dệt thoi, nhuộm, từ sợi filament polyester... |
| C | Mô tả (tiếng Anh) | Woven fabrics, dyed... |
| D | Đơn vị tính | m (mét) |
| E | Thuế NK MFN (%) | 12 |
| F | Thuế NK ưu đãi đặc biệt | CPTPP: 0%, EVFTA: 0%... |
| G | Thuế VAT (%) | 10 |
| H | Thuế TTĐB (%) | - |

### 2.2 Parsing Logic

```python
import openpyxl
import pandas as pd

class BieuThueParser:
    """Parse file biểu thuế XNK Excel → structured records"""
    
    def parse(self, file_path: str) -> List[HSCodeRecord]:
        wb = openpyxl.load_workbook(file_path)
        records = []
        
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            chapter = self._extract_chapter(sheet_name)
            
            for row in ws.iter_rows(min_row=2, values_only=False):
                record = self._parse_row(row, chapter)
                if record and record.hs_code:
                    records.append(record)
        
        return records

    def _parse_row(self, row, chapter) -> HSCodeRecord:
        """Parse một dòng Excel → HSCodeRecord"""
        return HSCodeRecord(
            hs_code=self._normalize_hs_code(row[0].value),
            section_code=self._get_section(chapter),
            chapter_code=chapter,
            heading_code=self._get_heading(row[0].value),
            description_vi=str(row[1].value or "").strip(),
            description_en=str(row[2].value or "").strip(),
            unit=str(row[3].value or "").strip(),
            mfn_rate=self._parse_rate(row[4].value),
            vat_rate=self._parse_rate(row[6].value),
            special_consumption_rate=self._parse_rate(row[7].value),
            preferential_rates=self._parse_preferential(row[5].value),
        )

    def _normalize_hs_code(self, raw: str) -> str:
        """Chuẩn hóa mã HS: bỏ dấu chấm, pad zeros"""
        if not raw:
            return None
        code = re.sub(r'[^0-9]', '', str(raw))
        return code.ljust(10, '0')[:10]  # Pad to 10 digits

    def _parse_preferential(self, raw: str) -> dict:
        """Parse thuế ưu đãi: 'CPTPP:0%, EVFTA:0%' → dict"""
        if not raw:
            return {}
        result = {}
        for item in str(raw).split(','):
            parts = item.strip().split(':')
            if len(parts) == 2:
                fta = parts[0].strip()
                rate = parts[1].strip()
                result[fta] = rate
        return result
```

### 2.3 Load vào PostgreSQL

```python
class HSCodeLoader:
    def load(self, records: List[HSCodeRecord], db_session):
        """Bulk insert/update HS codes vào PostgreSQL"""
        for record in records:
            db_session.merge(HSCode(
                hs_code=record.hs_code,
                section_code=record.section_code,
                chapter_code=record.chapter_code,
                heading_code=record.heading_code,
                description_vi=record.description_vi,
                description_en=record.description_en,
                unit=record.unit,
                mfn_rate=record.mfn_rate,
                vat_rate=record.vat_rate,
                special_consumption_rate=record.special_consumption_rate,
                effective_date=record.effective_date,
            ))
            # Load preferential rates
            for fta, rate in record.preferential_rates.items():
                db_session.merge(PreferentialRate(
                    hs_code=record.hs_code,
                    fta_code=fta,
                    rate=rate,
                ))
        db_session.commit()
```

### 2.4 Embedding & Index vào Qdrant

```python
class HSCodeEmbedder:
    def __init__(self, model_name="intfloat/multilingual-e5-large"):
        self.model = SentenceTransformer(model_name)
        self.client = QdrantClient(host="localhost", port=6333)
    
    def embed_and_store(self, records: List[HSCodeRecord]):
        """Tạo embeddings cho mỗi HS code và store vào Qdrant"""
        
        # Tạo collection
        self.client.create_collection(
            collection_name="hs_codes",
            vectors_config=VectorParams(
                size=1024,  # multilingual-e5-large dimensions
                distance=Distance.COSINE,
            )
        )
        
        # Batch embed
        texts = []
        for r in records:
            # Combine description cho embedding phong phú hơn
            text = f"HS {r.hs_code}: {r.description_vi}. {r.description_en}"
            texts.append(text)
        
        embeddings = self.model.encode(
            texts,
            batch_size=64,
            show_progress_bar=True,
            normalize_embeddings=True,
        )
        
        # Upsert vào Qdrant
        points = [
            PointStruct(
                id=idx,
                vector=embedding.tolist(),
                payload={
                    "hs_code": r.hs_code,
                    "description_vi": r.description_vi,
                    "description_en": r.description_en,
                    "chapter": r.chapter_code,
                    "section": r.section_code,
                    "heading": r.heading_code,
                    "unit": r.unit,
                    "mfn_rate": str(r.mfn_rate),
                    "vat_rate": str(r.vat_rate),
                }
            )
            for idx, (r, embedding) in enumerate(zip(records, embeddings))
        ]
        
        self.client.upsert(
            collection_name="hs_codes",
            points=points,
            batch_size=100,
        )
```

---

## 3. Pipeline 2: Chú giải HS 2022 (PDF → Qdrant)

### 3.1 Nguồn dữ liệu

**File:** `data/BieuthueXNK/Chu giai HS 2022 Toan tap (HQKV8).pdf`

**Cấu trúc:**
```
Phần I: Động vật sống và sản phẩm từ động vật
  Chương 01: Động vật sống
    Chú giải Chương 01
    Nhóm 01.01: Ngựa, lừa, la sống
      Giải thích chi tiết...
    Nhóm 01.02: Trâu, bò sống
      ...
  Chương 02: Thịt và các bộ phận...
    ...
Phần II: Sản phẩm thực vật
  ...
```

### 3.2 PDF Extraction Strategy

```python
import pdfplumber

class HSNotesParser:
    """Parse chú giải HS PDF → structured chunks"""
    
    # Regex patterns cho cấu trúc văn bản
    SECTION_PATTERN = r'^Phần\s+([IVXLCDM]+)\s*[:\-–]\s*(.+)'
    CHAPTER_PATTERN = r'^Chương\s+(\d{1,2})\s*[:\-–]\s*(.+)'
    HEADING_PATTERN = r'^(?:Nhóm\s+)?(\d{2}\.\d{2})\s*[:\-–]\s*(.+)'
    NOTE_PATTERN = r'^Chú giải\s+(Phần|Chương)\s+(.+)'
    
    def parse(self, pdf_path: str) -> List[HSNoteChunk]:
        chunks = []
        current_section = None
        current_chapter = None
        current_heading = None
        buffer = []
        
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text:
                    continue
                
                for line in text.split('\n'):
                    line = line.strip()
                    
                    # Detect section boundary
                    section_match = re.match(self.SECTION_PATTERN, line)
                    if section_match:
                        # Flush buffer
                        if buffer:
                            chunks.append(self._create_chunk(
                                buffer, current_section, current_chapter, current_heading
                            ))
                            buffer = []
                        current_section = {
                            "code": section_match.group(1),
                            "name": section_match.group(2)
                        }
                        continue
                    
                    # Detect chapter boundary
                    chapter_match = re.match(self.CHAPTER_PATTERN, line)
                    if chapter_match:
                        if buffer:
                            chunks.append(self._create_chunk(
                                buffer, current_section, current_chapter, current_heading
                            ))
                            buffer = []
                        current_chapter = {
                            "code": chapter_match.group(1),
                            "name": chapter_match.group(2)
                        }
                        current_heading = None
                        continue
                    
                    # Detect heading
                    heading_match = re.match(self.HEADING_PATTERN, line)
                    if heading_match:
                        if buffer:
                            chunks.append(self._create_chunk(
                                buffer, current_section, current_chapter, current_heading
                            ))
                            buffer = []
                        current_heading = {
                            "code": heading_match.group(1),
                            "name": heading_match.group(2)
                        }
                        continue
                    
                    buffer.append(line)
        
        # Flush remaining
        if buffer:
            chunks.append(self._create_chunk(
                buffer, current_section, current_chapter, current_heading
            ))
        
        return chunks
    
    def _create_chunk(self, lines, section, chapter, heading) -> HSNoteChunk:
        content = '\n'.join(lines)
        
        # Split large chunks (> 1000 tokens)
        if len(content.split()) > 800:
            return self._split_chunk(content, section, chapter, heading)
        
        return HSNoteChunk(
            content=content,
            note_type=self._determine_type(heading, chapter, section),
            section_code=section["code"] if section else None,
            section_name=section["name"] if section else None,
            chapter_code=chapter["code"] if chapter else None,
            chapter_name=chapter["name"] if chapter else None,
            heading_code=heading["code"] if heading else None,
            heading_name=heading["name"] if heading else None,
        )
```

### 3.3 Chunking & Embedding

```python
class HSNotesEmbedder:
    def embed_and_store(self, chunks: List[HSNoteChunk]):
        """Embed chú giải HS → Qdrant collection 'hs_notes'"""
        
        self.client.create_collection(
            collection_name="hs_notes",
            vectors_config=VectorParams(size=1024, distance=Distance.COSINE),
        )
        
        # Tạo enriched text cho embedding
        texts = []
        for chunk in chunks:
            # Kết hợp context hierarchy + content
            context = []
            if chunk.section_name:
                context.append(f"Phần {chunk.section_code}: {chunk.section_name}")
            if chunk.chapter_name:
                context.append(f"Chương {chunk.chapter_code}: {chunk.chapter_name}")
            if chunk.heading_name:
                context.append(f"Nhóm {chunk.heading_code}: {chunk.heading_name}")
            
            enriched = f"{' > '.join(context)}\n\n{chunk.content}"
            texts.append(enriched)
        
        embeddings = self.model.encode(texts, batch_size=32, normalize_embeddings=True)
        
        points = [
            PointStruct(
                id=idx,
                vector=emb.tolist(),
                payload={
                    "content": chunk.content,
                    "note_type": chunk.note_type,
                    "section_code": chunk.section_code,
                    "chapter_code": chunk.chapter_code,
                    "heading_code": chunk.heading_code,
                    "section_name": chunk.section_name,
                    "chapter_name": chunk.chapter_name,
                    "heading_name": chunk.heading_name,
                }
            )
            for idx, (chunk, emb) in enumerate(zip(chunks, embeddings))
        ]
        
        self.client.upsert(collection_name="hs_notes", points=points, batch_size=100)
```

---

## 4. Pipeline 3: Văn bản pháp luật (PDF → PostgreSQL + Qdrant)

### 4.1 Nguồn dữ liệu

**Folder:** `data/Law/`

**Loại văn bản:**
- Nghị định (NĐ-CP): Biểu thuế, quy định XNK
- Thông tư (TT-BTC, TT-BCT): Hướng dẫn thuế, kiểm tra chuyên ngành
- Quyết định (QĐ-TTg): Danh mục hàng cấm, hạn chế

### 4.2 Extraction Structure

```python
class LegalDocParser:
    """Parse văn bản pháp luật PDF → structured articles"""
    
    ARTICLE_PATTERN = r'^Điều\s+(\d+)\.\s*(.+)'
    CLAUSE_PATTERN = r'^(\d+)\.\s+'
    POINT_PATTERN = r'^([a-zđ])\)\s+'
    
    def parse(self, pdf_path: str) -> LegalDocument:
        metadata = self._extract_metadata(pdf_path)
        articles = self._extract_articles(pdf_path)
        
        return LegalDocument(
            doc_type=metadata.doc_type,
            doc_number=metadata.doc_number,
            title=metadata.title,
            issued_date=metadata.issued_date,
            effective_date=metadata.effective_date,
            issuing_body=metadata.issuing_body,
            articles=articles,
        )
    
    def _extract_metadata(self, pdf_path: str) -> DocMetadata:
        """Trích xuất metadata từ trang đầu PDF"""
        with pdfplumber.open(pdf_path) as pdf:
            first_pages_text = '\n'.join(
                pdf.pages[i].extract_text() or "" for i in range(min(3, len(pdf.pages)))
            )
        
        # Dùng regex hoặc LLM để extract metadata
        return DocMetadata(
            doc_type=self._detect_doc_type(first_pages_text),
            doc_number=self._extract_doc_number(first_pages_text),
            title=self._extract_title(first_pages_text),
            issued_date=self._extract_date(first_pages_text, "ngày"),
            effective_date=self._extract_date(first_pages_text, "hiệu lực"),
            issuing_body=self._extract_issuer(first_pages_text),
        )
```

### 4.3 HS Code ↔ Legal Mapping

```python
class HSLegalMapper:
    """Tạo mapping giữa mã HS và văn bản pháp luật liên quan"""
    
    def create_mappings(self, legal_doc: LegalDocument, hs_codes: List[str]):
        """
        Scan nội dung văn bản để tìm mã HS được đề cập
        → Tạo bản ghi mapping trong hs_legal_mapping
        """
        mappings = []
        
        for article in legal_doc.articles:
            # Tìm mã HS trong nội dung điều khoản
            found_hs_codes = re.findall(
                r'\b(\d{4}(?:\.\d{2}){0,3})\b',
                article.content
            )
            
            for hs_code in found_hs_codes:
                normalized = self._normalize_hs(hs_code)
                if normalized in hs_codes:
                    mappings.append(HSLegalMapping(
                        hs_code=normalized,
                        legal_doc_id=legal_doc.id,
                        relevant_article=f"Điều {article.number}: {article.title}",
                    ))
        
        return mappings
```

---

## 5. Elasticsearch Indexing (Full-text Search)

```python
class ElasticsearchIndexer:
    """Index HS codes và chú giải vào Elasticsearch cho BM25 search"""
    
    INDEX_SETTINGS = {
        "settings": {
            "analysis": {
                "analyzer": {
                    "vietnamese_analyzer": {
                        "type": "custom",
                        "tokenizer": "icu_tokenizer",
                        "filter": ["icu_folding", "lowercase"]
                    }
                }
            }
        },
        "mappings": {
            "properties": {
                "hs_code": {"type": "keyword"},
                "description_vi": {
                    "type": "text",
                    "analyzer": "vietnamese_analyzer"
                },
                "description_en": {
                    "type": "text",
                    "analyzer": "standard"
                },
                "chapter_code": {"type": "keyword"},
                "section_code": {"type": "keyword"},
                "hs_notes": {
                    "type": "text",
                    "analyzer": "vietnamese_analyzer"
                },
                "mfn_rate": {"type": "float"},
                "vat_rate": {"type": "float"},
            }
        }
    }
    
    def index_hs_codes(self, records: List[HSCodeRecord]):
        """Bulk index vào Elasticsearch"""
        actions = [
            {
                "_index": "hs_codes",
                "_id": r.hs_code,
                "_source": {
                    "hs_code": r.hs_code,
                    "description_vi": r.description_vi,
                    "description_en": r.description_en,
                    "chapter_code": r.chapter_code,
                    "section_code": r.section_code,
                    "mfn_rate": r.mfn_rate,
                    "vat_rate": r.vat_rate,
                }
            }
            for r in records
        ]
        helpers.bulk(self.es_client, actions)
```

---

## 6. Data Update & Versioning

### 6.1 Khi nào cần update?

| Sự kiện | Tần suất | Action |
|---|---|---|
| Biểu thuế XNK mới | 1-2 lần/năm | Full re-ingest Excel |
| Chú giải HS mới | Mỗi 5 năm (HS 2027) | Full re-ingest PDF |
| Thông tư/NĐ mới | Không định kỳ | Incremental ingest |
| Thuế ưu đãi FTA thay đổi | Hàng năm | Update preferential_rates |

### 6.2 Update Pipeline

```
Admin upload file mới
  → POST /data/ingest
  → Validate file format
  → Parse → Compare diff với DB hiện tại
  → Backup old data
  → Insert/Update new data
  → Re-embed affected chunks → Update Qdrant
  → Re-index Elasticsearch
  → Invalidate Redis cache
  → Log change history
  → Notify admin: "Updated X records, Y new, Z modified"
```

### 6.3 Data Versioning

```sql
CREATE TABLE data_versions (
    id SERIAL PRIMARY KEY,
    source_type VARCHAR(50),    -- bieu_thue, chu_giai, legal
    source_file VARCHAR(500),
    version_label VARCHAR(100), -- "2026-04-05"
    record_count INTEGER,
    checksum VARCHAR(64),       -- SHA-256 of source file
    ingested_at TIMESTAMP DEFAULT NOW(),
    ingested_by VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active'  -- active, superseded, failed
);
```

---

## 7. Data Quality Checks

```python
class DataQualityChecker:
    """Kiểm tra chất lượng dữ liệu sau khi ingest"""
    
    def check(self, records: List[HSCodeRecord]) -> QualityReport:
        issues = []
        
        # Check 1: HS code format
        for r in records:
            if not re.match(r'^\d{8,10}$', r.hs_code):
                issues.append(f"Invalid HS code format: {r.hs_code}")
        
        # Check 2: Missing descriptions
        missing_desc = [r for r in records if not r.description_vi]
        if missing_desc:
            issues.append(f"{len(missing_desc)} records missing Vietnamese description")
        
        # Check 3: Tax rate sanity
        invalid_rates = [r for r in records if r.mfn_rate and (r.mfn_rate < 0 or r.mfn_rate > 200)]
        if invalid_rates:
            issues.append(f"{len(invalid_rates)} records with suspicious MFN rates")
        
        # Check 4: Duplicate HS codes
        codes = [r.hs_code for r in records]
        duplicates = [c for c in codes if codes.count(c) > 1]
        if duplicates:
            issues.append(f"{len(set(duplicates))} duplicate HS codes")
        
        # Check 5: Chapter coverage (01-99)
        chapters = set(r.chapter_code for r in records if r.chapter_code)
        expected = set(str(i).zfill(2) for i in range(1, 100))
        missing_chapters = expected - chapters
        if missing_chapters:
            issues.append(f"Missing chapters: {sorted(missing_chapters)}")
        
        return QualityReport(
            total_records=len(records),
            issues=issues,
            passed=len(issues) == 0,
        )
```
