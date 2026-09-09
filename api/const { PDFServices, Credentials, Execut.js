import { 
  PDFServices, 
  Credentials, 
  ExportPDFJob, 
  ExportPDFParams, 
  ExportPDFTargetFormat 
} from '@adobe/pdf-services-sdk';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false, // Wajib matikan bodyParser Vercel
  },
};

export default async function handler(req, res) {
  // Setup Header CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Wajib arahkan uploadDir ke /tmp (direktori sementara Vercel)
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
        return res.status(500).json({ error: 'API Key Adobe belum dipasang di Environment Variables Vercel.' });
      }

      // Inisialisasi Kredensial Adobe
      const credentials = Credentials.servicePrincipalCredentialsBuilder()
        .withClientId(clientId)
        .withClientSecret(clientSecret)
        .build();

      const pdfServices = new PDFServices({ credentials });

      // Ambil file yang di-upload
      const fileItem = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!fileItem || !fileItem.filepath) {
        return res.status(400).json({ error: 'File PDF tidak terdeteksi.' });
      }

      const fileStream = fs.createReadStream(fileItem.filepath);
      const inputAsset = await pdfServices.upload({ stream: fileStream, mimeType: 'application/pdf' });

      // Cek target format
      const rawTarget = Array.isArray(fields.targetType) ? fields.targetType[0] : fields.targetType;
      let targetFormat = ExportPDFTargetFormat.DOCX;
      if (rawTarget === 'pptx') targetFormat = ExportPDFTargetFormat.PPTX;
      if (rawTarget === 'xlsx') targetFormat = ExportPDFTargetFormat.XLSX;

      const params = new ExportPDFParams({ targetFormat });
      const job = new ExportPDFJob({ inputAsset, params });

      // Submit ke Adobe Cloud
      const pollingURL = await pdfServices.submit({ job });
      const pdfServicesResponse = await pdfServices.getJobResult({ 
        pollingURL, 
        resultType: ExportPDFJob 
      });

      const resultAsset = pdfServicesResponse.result?.asset;
      if (!resultAsset) {
        throw new Error('Adobe tidak mengembalikan hasil file.');
      }

      const streamAsset = await pdfServices.getContent({ asset: resultAsset });

      // Set header balasan file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      // Pipe stream ke response
      streamAsset.stream.pipe(res);

      // Hapus file sementara di /tmp setelah selesai
      streamAsset.stream.on('end', () => {
        try { fs.unlinkSync(fileItem.filepath); } catch (e) {}
      });

    } catch (error) {
      console.error('Adobe Serverless Error:', error);
      res.status(500).json({ error: error.message || 'Terjadi kesalahan saat mengonversi dokumen.' });
    }
  });
}