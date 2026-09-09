require('dotenv').config(); // Membaca variabel dari file .env

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const {
  PDFServices,
  ServicePrincipalCredentials,
  ExportPDFJob,
  ExportPDFParams,
  ExportPDFTargetFormat,
  ExportPDFResult
} = require('@adobe/pdfservices-node-sdk');

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });

// Kredensial dibaca dari file .env secara otomatis
const ADOBE_CLIENT_ID = process.env.ADOBE_CLIENT_ID;
const ADOBE_CLIENT_SECRET = process.env.ADOBE_CLIENT_SECRET;

const credentials = new ServicePrincipalCredentials({
  clientId: ADOBE_CLIENT_ID,
  clientSecret: ADOBE_CLIENT_SECRET
});

const pdfServices = new PDFServices({ credentials });

app.post('/api/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file PDF yang diunggah.' });
    }

    const targetType = req.body.targetType;
    const inputFilePath = req.file.path;

    const readStream = fs.createReadStream(inputFilePath);
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: 'application/pdf'
    });

    const targetFormat = targetType === 'xlsx' 
      ? ExportPDFTargetFormat.XLSX 
      : ExportPDFTargetFormat.DOCX;

    const params = new ExportPDFParams({ targetFormat });
    const job = new ExportPDFJob({ inputAsset, params });

    const pollingURL = await pdfServices.submit({ job });
    
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: ExportPDFResult
    });

    const resultAsset = pdfServicesResponse.result.asset;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    const contentType = targetType === 'xlsx' 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="converted.${targetType}"`);

    streamAsset.readStream.pipe(res);

    streamAsset.readStream.on('end', () => {
      if (fs.existsSync(inputFilePath)) {
        fs.unlinkSync(inputFilePath);
      }
    });

  } catch (err) {
    console.error("Conversion Error:", err);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: "Gagal memproses konversi dokumen PDF via Adobe SDK." });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Hazeverter Adobe Proxy running on http://localhost:${PORT}`);
  console.log(`====================================================`);
});