require('dotenv').config(); // Membaca variabel dari file .env

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  PDFServices,
  ServicePrincipalCredentials,
  ExportPDFJob,
  ExportPDFParams,
  ExportPDFTargetFormat,
  ExportPDFResult
} = require('@adobe/pdfservices-node-sdk');

const app = express();

// === Task 1.2: Validasi env + warning saat boot ===
const ADOBE_CLIENT_ID = process.env.ADOBE_CLIENT_ID;
const ADOBE_CLIENT_SECRET = process.env.ADOBE_CLIENT_SECRET;

if (!ADOBE_CLIENT_ID || !ADOBE_CLIENT_SECRET) {
  console.warn('====================================================');
  console.warn(' WARNING: Kredensial Adobe tidak ditemukan di .env.');
  console.warn(' Endpoint /api/convert akan gagal.');
  console.warn(' Tambahkan ADOBE_CLIENT_ID & ADOBE_CLIENT_SECRET');
  console.warn('====================================================');
}

// === Task 1.8: Auto-mkdir folder uploads/ ===
const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// === Task 1.3: Helmet dengan CSP longgar untuk CDN libs ===
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "http://localhost:3000", "http://127.0.0.1:3000", "https://pdf-services.adobe.io"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// === Task 1.4: CORS whitelist untuk localhost:* & 127.0.0.1:* ===
app.use(cors({
  origin: [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Correlation-Id', 'X-Requested-With'],
  exposedHeaders: ['X-Correlation-Id']
}));

// === Task 1.5: Correlation ID middleware ===
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  res.setHeader('X-Correlation-Id', req.correlationId);
  next();
});

// === Task 1.6: Endpoint /api/health ===
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    adobeCredentialsValid: !!(ADOBE_CLIENT_ID && ADOBE_CLIENT_SECRET),
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// === Rate limiter (hanya untuk /api/convert) ===
const convertLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 10, // maks 10 request per menit per IP
  message: {
    error: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// === Task 1.8: Multer dengan size limit ===
const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
    files: 1
  }
});

// === Task 1.7: Helper safeUnlink (cleanup 3-jalur) ===
function safeUnlink(filePath, correlationId) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[${correlationId || 'no-corr'}] [cleanup] gagal hapus ${filePath}:`, err.message);
  }
}

// === Inisialisasi Adobe PDF Services ===
let pdfServices = null;
if (ADOBE_CLIENT_ID && ADOBE_CLIENT_SECRET) {
  try {
    const credentials = new ServicePrincipalCredentials({
      clientId: ADOBE_CLIENT_ID,
      clientSecret: ADOBE_CLIENT_SECRET
    });
    pdfServices = new PDFServices({ credentials });
  } catch (err) {
    console.error('Gagal inisialisasi Adobe PDF Services:', err.message);
    pdfServices = null;
  }
}

// === Mapping targetType ke handler ===
const HANDLER_REGISTRY = {};

// Helper: Adobe Export PDF (PDF -> docx/xlsx/pptx/pdfa)
async function runAdobeExport(inputFilePath, targetFormat, outputExt, correlationId) {
  if (!pdfServices) throw new Error('Adobe services belum terinisialisasi');

  const readStream = fs.createReadStream(inputFilePath);
  const inputAsset = await pdfServices.upload({
    readStream,
    mimeType: 'application/pdf'
  });

  const params = new ExportPDFParams({ targetFormat });
  const job = new ExportPDFJob({ inputAsset, params });
  const pollingURL = await pdfServices.submit({ job });

  const pdfServicesResponse = await pdfServices.getJobResult({
    pollingURL,
    resultType: ExportPDFResult
  });

  const resultAsset = pdfServicesResponse.result.asset;
  return await pdfServices.getContent({ asset: resultAsset });
}

// === Endpoint /api/convert dengan dispatcher ===
app.post('/api/convert', convertLimiter, upload.single('file'), async (req, res) => {
  const correlationId = req.correlationId;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah.', correlationId });
    }

    const targetType = req.body.targetType;
    const inputFilePath = req.file.path;

    const handler = HANDLER_REGISTRY[targetType];
    if (!handler) {
      safeUnlink(inputFilePath, correlationId);
      return res.status(400).json({
        error: `Format target tidak didukung: ${targetType}. Didukung: ${Object.keys(HANDLER_REGISTRY).join(', ')}`,
        correlationId
      });
    }

    const result = await handler(inputFilePath, req, correlationId);

    // Set headers & pipe stream
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

    result.stream.pipe(res);

    result.stream.on('end', () => {
      safeUnlink(inputFilePath, correlationId);
    });

    result.stream.on('error', (streamErr) => {
      console.error(`[${correlationId}] Stream error:`, streamErr);
      safeUnlink(inputFilePath, correlationId);
    });

  } catch (err) {
    console.error(`[${correlationId}] Conversion Error:`, err);

    if (req.file) {
      safeUnlink(req.file.path, correlationId);
    }

    // Pesan error berdasarkan jenis error
    let statusCode = 500;
    let errorMsg = 'Gagal memproses konversi dokumen via Adobe SDK.';

    if (err.message && err.message.includes('credentials')) {
      statusCode = 500;
      errorMsg = 'Kredensial Adobe tidak valid. Periksa file .env';
    } else if (err.message && err.message.includes('rate limit')) {
      statusCode = 429;
      errorMsg = 'Batas permintaan Adobe tercapai. Coba lagi nanti.';
    } else if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
      statusCode = 504;
      errorMsg = 'Adobe API timeout. Silakan coba lagi.';
    }

    res.status(statusCode).json({ error: errorMsg, correlationId });
  }
});

// === Registrasi handler untuk PDF -> DOCX (sudah ada di server lama) ===
HANDLER_REGISTRY['docx'] = async (inputFilePath, req, correlationId) => {
  const originalName = (req.file?.originalname || 'converted').replace(/\.[^/.]+$/, '');
  const streamAsset = await runAdobeExport(inputFilePath, ExportPDFTargetFormat.DOCX, 'docx', correlationId);
  return {
    stream: streamAsset.readStream,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    filename: `${originalName}.docx`
  };
};

// === Registrasi handler untuk PDF -> XLSX ===
HANDLER_REGISTRY['xlsx'] = async (inputFilePath, req, correlationId) => {
  const originalName = (req.file?.originalname || 'converted').replace(/\.[^/.]+$/, '');
  const streamAsset = await runAdobeExport(inputFilePath, ExportPDFTargetFormat.XLSX, 'xlsx', correlationId);
  return {
    stream: streamAsset.readStream,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `${originalName}.xlsx`
  };
};

// === Server boot ===
const PORT = process.env.PORT || 3000;

// === Task 1.9: Handle port already in use ===
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Hazeverter Adobe Proxy running on http://localhost:${PORT}`);
  console.log(` Endpoint: POST /api/convert`);
  console.log(` Endpoint: GET  /api/health`);
  console.log(` Adobe credentials: ${ADOBE_CLIENT_ID ? 'OK' : 'MISSING'}`);
  console.log(`====================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} sudah digunakan. Hentikan proses lain atau ubah PORT di .env`);
    process.exit(1);
  }
  console.error('Server error:', err);
  process.exit(1);
});

// Export untuk testing (jika dibutuhkan)
module.exports = { app, HANDLER_REGISTRY };
