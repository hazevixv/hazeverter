const { 
  PDFServices, 
  Credentials, 
  ExportPDFJob, 
  ExportPDFParams, 
  ExportPDFTargetFormat,
  CreatePDFJob
} = require('@adobe/pdfservices-node-sdk');
const formidable = require('formidable');
const fs = require('fs');

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

// Pemetaan MIME Type untuk dokumen Office
const MIME_TYPES = {
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const form = formidable({ uploadDir: '/tmp', keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Gagal membaca file upload' });

    try {
      const clientId = process.env.ADOBE_CLIENT_ID;
      const clientSecret = process.env.ADOBE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'API Key Adobe belum diatur di Vercel.' });
      }

      const credentials = Credentials.servicePrincipalCredentialsBuilder()
        .withClientId(clientId)
        .withClientSecret(clientSecret)
        .build();

      const pdfServices = new PDFServices({ credentials });

      const fileItem = Array.isArray(files.file) ? files.file[0] : files.file;
      const conversionType = Array.isArray(fields.conversionType) ? fields.conversionType[0] : fields.conversionType;

      if (!fileItem || !fileItem.filepath) {
        return res.status(400).json({ error: 'File tidak terdeteksi.' });
      }

      const fileStream = fs.createReadStream(fileItem.filepath);
      let job, contentTypeOutput, outputFilename;

      // ===================================================
      // A. OPERASI KONVERSI: PDF TO (WORD / PPT / EXCEL)
      // ===================================================
      if (['pdf-to-word', 'pdf-to-ppt', 'pdf-to-excel'].includes(conversionType)) {
        const inputAsset = await pdfServices.upload({ stream: fileStream, mimeType: 'application/pdf' });

        let targetFormat = ExportPDFTargetFormat.DOCX;
        if (conversionType === 'pdf-to-ppt') targetFormat = ExportPDFTargetFormat.PPTX;
        if (conversionType === 'pdf-to-excel') targetFormat = ExportPDFTargetFormat.XLSX;

        const params = new ExportPDFParams({ targetFormat });
        job = new ExportPDFJob({ inputAsset, params });

        if (conversionType === 'pdf-to-word') {
          contentTypeOutput = MIME_TYPES.docx;
          outputFilename = 'converted.docx';
        } else if (conversionType === 'pdf-to-ppt') {
          contentTypeOutput = MIME_TYPES.pptx;
          outputFilename = 'converted.pptx';
        } else {
          contentTypeOutput = MIME_TYPES.xlsx;
          outputFilename = 'converted.xlsx';
        }
      } 
      
      // ===================================================
      // B. OPERASI KONVERSI: (WORD / PPT / EXCEL) TO PDF
      // ===================================================
      else if (['word-to-pdf', 'ppt-to-pdf', 'excel-to-pdf'].includes(conversionType)) {
        const ext = fileItem.originalFilename ? fileItem.originalFilename.split('.').pop().toLowerCase() : '';
        const mimeTypeInput = MIME_TYPES[ext] || 'application/octet-stream';

        const inputAsset = await pdfServices.upload({ stream: fileStream, mimeType: mimeTypeInput });
        job = new CreatePDFJob({ inputAsset });

        contentTypeOutput = 'application/pdf';
        outputFilename = 'converted.pdf';
      } else {
        return res.status(400).json({ error: 'Jenis konversi tidak valid.' });
      }

      // Submit & Polling ke Adobe Cloud
      const pollingURL = await pdfServices.submit({ job });
      const jobClass = ['word-to-pdf', 'ppt-to-pdf', 'excel-to-pdf'].includes(conversionType) ? CreatePDFJob : ExportPDFJob;
      
      const pdfServicesResponse = await pdfServices.getJobResult({ 
        pollingURL, 
        resultType: jobClass 
      });

      const resultAsset = pdfServicesResponse.result?.asset;
      if (!resultAsset) throw new Error('Adobe Cloud tidak mengembalikan hasil file.');

      const streamAsset = await pdfServices.getContent({ asset: resultAsset });

      res.setHeader('Content-Type', contentTypeOutput);
      res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);

      const readStream = streamAsset.readStream || streamAsset.stream;
      readStream.pipe(res);

      readStream.on('end', () => {
        try { fs.unlinkSync(fileItem.filepath); } catch (e) {}
      });

    } catch (error) {
      console.error('Adobe Serverless Error:', error);
      res.status(500).json({ error: error.message || 'Terjadi kesalahan saat mengonversi dokumen.' });
    }
  });
};