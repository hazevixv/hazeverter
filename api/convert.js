const { 
  PDFServices, 
  Credentials, 
  ExportPDFJob, 
  ExportPDFParams, 
  ExportPDFTargetFormat 
} = require('@adobe/pdfservices-node-sdk');
const formidable = require('formidable');
const fs = require('fs');

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({
    uploadDir: '/tmp',
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Formidable Error:', err);
      return res.status(500).json({ error: 'Gagal membaca file upload' });
    }

    try {
      const clientId = process.env.ADOBE_CLIENT_ID;
      const clientSecret = process.env.ADOBE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'API Key Adobe belum diatur di Vercel.' });
      }

      // Kredensial Adobe SDK v4
      const credentials = Credentials.servicePrincipalCredentialsBuilder()
        .withClientId(clientId)
        .withClientSecret(clientSecret)
        .build();

      const pdfServices = new PDFServices({ credentials });

      // Ambil file yang diupload
      const fileItem = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!fileItem || !fileItem.filepath) {
        return res.status(400).json({ error: 'File PDF tidak terdeteksi.' });
      }

      const fileStream = fs.createReadStream(fileItem.filepath);
      const inputAsset = await pdfServices.upload({ 
        stream: fileStream, 
        mimeType: 'application/pdf' 
      });

      // Tentukan format target
      const rawTarget = Array.isArray(fields.targetType) ? fields.targetType[0] : fields.targetType;
      let targetFormat = ExportPDFTargetFormat.DOCX;
      if (rawTarget === 'pptx') targetFormat = ExportPDFTargetFormat.PPTX;
      if (rawTarget === 'xlsx') targetFormat = ExportPDFTargetFormat.XLSX;

      const params = new ExportPDFParams({ targetFormat });
      const job = new ExportPDFJob({ inputAsset, params });

      // Submit & Polling
      const pollingURL = await pdfServices.submit({ job });
      const pdfServicesResponse = await pdfServices.getJobResult({ 
        pollingURL, 
        resultType: ExportPDFJob 
      });

      const resultAsset = pdfServicesResponse.result?.asset;
      if (!resultAsset) {
        throw new Error('Adobe Cloud tidak mengembalikan hasil file.');
      }

      // Ambil Asset Content untuk SDK v4
      const streamAsset = await pdfServices.getContent({ asset: resultAsset });

      // Penyesuaian Content-Type
      if (rawTarget === 'pptx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      } else if (rawTarget === 'xlsx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }

      // PERBAIKAN UTAMA: SDK v4 menyediakan readStream langsung dari streamAsset
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