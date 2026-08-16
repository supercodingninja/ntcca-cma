// ==========================================================================
// NTCCA Notation Converter — the front door for score files.
// POST /convert  (multipart, field "file")
//   .mscz / .musicxml / .xml / .mxl  -> converted with headless MuseScore
//   ?format=pdf (default) | png
//   .sib -> 422 with an honest message (proprietary format; export MusicXML
//           from Sibelius first — one menu tap: File > Export > MusicXML)
// GET  /health -> "ok"
// ==========================================================================
import express from 'express';
import multer from 'multer';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import liveRouter from './live.js';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 25) * 1024 * 1024 },
});

// Permissive CORS — the app calls this from the browser.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type,X-Seq,X-Dur,X-Viewer');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => res.type('text').send('ok'));

// The praises.team LIVE platform — our own pipe (see live.js).
app.use(liveRouter);

const MSCORE = process.env.MSCORE_BIN || 'mscore3';
const DIRECT = new Set(['.mscz', '.musicxml', '.xml', '.mxl']);

app.post('/convert', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach the score as form field "file".' });
  const ext = path.extname(req.file.originalname || '').toLowerCase();
  const format = (req.query.format === 'png') ? 'png' : 'pdf';

  if (ext === '.sib') {
    return res.status(422).json({
      error: 'Sibelius .sib is a proprietary format. In Sibelius: File → Export → MusicXML, then upload that file here.',
    });
  }
  if (!DIRECT.has(ext)) {
    return res.status(415).json({ error: `Unsupported type "${ext}". Send .mscz, .musicxml, .xml, or .mxl.` });
  }

  const work = mkdtempSync(path.join(tmpdir(), 'ntcc-conv-'));
  const input = path.join(work, `score${ext}`);
  const output = path.join(work, `score.${format}`);
  try {
    // .mxl is zip-compressed MusicXML — MuseScore reads it directly.
    writeFileSync(input, req.file.buffer);
    execFile(MSCORE, ['-o', output, input], { timeout: 120000 }, (err) => {
      try {
        if (err || !existsSync(output)) {
          return res.status(500).json({ error: 'MuseScore could not read this file. Check that it is valid notation XML.' });
        }
        const buf = readFileSync(output);
        res.set('Content-Type', format === 'pdf' ? 'application/pdf' : 'image/png');
        res.set('Content-Disposition', `inline; filename="${(req.file.originalname || 'score').replace(/\.[^.]+$/, '')}.${format}"`);
        res.send(buf);
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    });
  } catch (e) {
    rmSync(work, { recursive: true, force: true });
    res.status(500).json({ error: String(e) });
  }
});

const port = Number(process.env.PORT) || 10000;
app.listen(port, () => console.log(`ntcca-notation-converter listening on :${port}`));
