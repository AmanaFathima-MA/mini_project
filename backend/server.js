const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 5000;
const PYTHON_AI_URL = 'http://127.0.0.1:8000';

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------
// 1. Initialize SQLite Database
// -------------------------------------------------------------
const dbPath = path.resolve(__dirname, 'fir_records.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to SQLite Database: fir_records.db');
    }
});

// Create tables
db.run(`
    CREATE TABLE IF NOT EXISTS fir_cases (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        input_type TEXT NOT NULL,
        raw_text TEXT,
        summary TEXT NOT NULL,
        bns_section TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        evidence_json TEXT NOT NULL
    )
`);

const upload = multer({ storage: multer.memoryStorage() });

// -------------------------------------------------------------
// 2. API Routes
// -------------------------------------------------------------

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', message: 'Backend and Database Operational' });
});

// Analyze Text
app.post('/api/fir/analyze-text', async (req, res) => {
    try {
        const { text, num_sentences } = req.body;
        if (!text || text.trim().length < 20) {
            return res.status(400).json({ error: 'Input text must contain at least 20 characters.' });
        }

        const response = await axios.post(`${PYTHON_AI_URL}/analyze`, {
            text: text,
            num_sentences: num_sentences || 2
        });

        const caseId = `FIR-${Date.now().toString().slice(-6)}`;
        const timestamp = new Date().toISOString();
        const { summary, predicted_bns_section, confidence_score, key_incident_details } = response.data;
        const evidenceStr = JSON.stringify(key_incident_details);

        // Insert into SQLite
        db.run(
            `INSERT INTO fir_cases (id, created_at, input_type, raw_text, summary, bns_section, confidence_score, evidence_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [caseId, timestamp, 'Digital Text', text, summary, predicted_bns_section, confidence_score, evidenceStr],
            (err) => {
                if (err) console.error('DB Insert Error:', err.message);
            }
        );

        res.json({
            id: caseId,
            timestamp,
            input_type: 'Digital Text',
            ...response.data
        });
    } catch (error) {
        console.error('Processing error:', error.message);
        res.status(500).json({ error: 'AI processing failed. Ensure Python microservice is active on port 8000.' });
    }
});

// Analyze Image (OCR)
app.post('/api/fir/analyze-image', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded.' });
        }

        const formData = new FormData();
        formData.append('file', req.file.buffer, { filename: req.file.originalname });
        formData.append('num_sentences', req.body.num_sentences || 2);

        const response = await axios.post(`${PYTHON_AI_URL}/analyze-image`, formData, {
            headers: formData.getHeaders()
        });

        const caseId = `FIR-${Date.now().toString().slice(-6)}`;
        const timestamp = new Date().toISOString();
        const { summary, predicted_bns_section, confidence_score, key_incident_details, extracted_ocr_text } = response.data;
        const evidenceStr = JSON.stringify(key_incident_details);

        db.run(
            `INSERT INTO fir_cases (id, created_at, input_type, raw_text, summary, bns_section, confidence_score, evidence_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [caseId, timestamp, `OCR Scan (${req.file.originalname})`, extracted_ocr_text || '', summary, predicted_bns_section, confidence_score, evidenceStr],
            (err) => {
                if (err) console.error('DB Insert Error:', err.message);
            }
        );

        res.json({
            id: caseId,
            timestamp,
            input_type: `OCR Scan (${req.file.originalname})`,
            ...response.data
        });
    } catch (error) {
        console.error('OCR processing error:', error.message);
        res.status(500).json({ error: 'OCR processing failed. Ensure Python microservice is active.' });
    }
});

// Fetch Case History
app.get('/api/fir/history', (req, res) => {
    db.all(`SELECT * FROM fir_cases ORDER BY created_at DESC LIMIT 20`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to retrieve case history.' });
        }
        const formatted = rows.map(r => ({
            ...r,
            key_incident_details: JSON.parse(r.evidence_json || '{}')
        }));
        res.json(formatted);
    });
});

// Download Formal Investigation Dossier (.txt)
app.get('/api/fir/download/:id', (req, res) => {
    const caseId = req.params.id;
    db.get(`SELECT * FROM fir_cases WHERE id = ?`, [caseId], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ error: 'Case record not found.' });
        }

        const evidence = JSON.parse(row.evidence_json || '{}');
        const reportContent = `================================================================================
FIRST INFORMATION REPORT (FIR) - PRELIMINARY INVESTIGATION DOSSIER
STATE POLICE DEPARTMENT • CRIMINAL INVESTIGATION SUPPORT SYSTEM
================================================================================

RECORD IDENTIFIER : ${row.id}
REGISTRATION DATE : ${row.created_at}
INGESTION SOURCE  : ${row.input_type}

--------------------------------------------------------------------------------
1. STATUTORY PROVISION RECOMMENDATION (BHARATIYA NYAYA SANHITA)
--------------------------------------------------------------------------------
CLASSIFIED OFFENCE : ${row.bns_section}
PREDICTION ACCURACY: ${row.confidence_score}%
ALGORITHMIC BASIS  : Multiclass Random Forest Classification on TF-IDF Vectors

--------------------------------------------------------------------------------
2. EXECUTIVE INCIDENT SUMMARY (BERT EXTRACTIVE EXTRACTION)
--------------------------------------------------------------------------------
"${row.summary}"

--------------------------------------------------------------------------------
3. EXTRACTED EVIDENTIARY ARTIFACTS
--------------------------------------------------------------------------------
• INCIDENT DATES   : ${(evidence.dates_mentioned || []).join(', ') || 'N/A'}
• TIME SPECIFIERS  : ${(evidence.times_mentioned || []).join(', ') || 'N/A'}
• MONETARY LOSSES  : ${(evidence.monetary_loss || []).join(', ') || 'N/A'}
• WEAPONS NOTED    : ${(evidence.weapons_detected || []).join(', ') || 'None reported'}
• VEHICLES NOTED   : ${(evidence.vehicles_involved || []).join(', ') || 'None reported'}

--------------------------------------------------------------------------------
4. ORIGINAL INGESTED NARRATIVE TRANSCRIPT
--------------------------------------------------------------------------------
${row.raw_text || '[Scanned Document Ingestion]'}

================================================================================
END OF DOSSIER • GENERATED FOR OFFICIAL POLICE INVESTIGATION RECORD
================================================================================`;

        res.setHeader('Content-disposition', `attachment; filename=${row.id}_Investigation_Dossier.txt`);
        res.setHeader('Content-type', 'text/plain');
        res.send(reportContent);
    });
});

app.listen(PORT, () => {
    console.log(`Backend Server listening on port ${PORT}`);
});