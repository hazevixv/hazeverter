# Requirements Document — Hazeverter Features (Convert PDF)

## Introduction

Hazeverter adalah platform utilitas dokumen berbasis *client-side* yang sudah memiliki 10 fitur (Smart Scan A4 + OCR No BA, Merge PDF, Split PDF, Compress PDF, PDF→JPG, JPG→PDF, Protect PDF, Watermark, PDF→Word, PDF→Excel). Dokumen requirements ini menjelaskan penambahan **kategori Convert PDF** yang lengkap ke dalam halaman `index.html` yang sudah ada, dengan tetap mempertahankan dan meningkatkan fitur Smart Scan A4 + OCR No BA detection.

Kategori Convert PDF baru akan berisi **10 tool** dengan pendekatan hybrid:
- **Server-side (Adobe PDF Services SDK via Node.js proxy `localhost:3000`)** untuk 8 tool: PDF→Word, PDF→PowerPoint, PDF→Excel, Word→PDF, PowerPoint→PDF, Excel→PDF, HTML→PDF, PDF→PDF/A.
- **Client-side (pdf.js / jsPDF / JSZip)** untuk 2 tool: PDF→JPG dan JPG→PDF.

Pengguna akan menelusuri tool melalui **tab navigasi kategori** (All, Workflows, Organize PDF, Optimize PDF, Convert PDF, Edit PDF, PDF Security, PDF Intelligence), melakukan upload (drag-drop atau file picker), melihat progress (processing view dengan laser scanner), dan mengunduh hasil (download view dengan confetti).

Tujuan utama:
1. Memperluas kapabilitas konversi dokumen secara profesional (Office formats, PDF/A archival, HTML rendering).
2. Mempertahankan fitur unggulan Smart Scan A4 + OCR No BA detection dengan stabilitas dan akurasi lebih baik.
3. Memberikan UX modern dengan tab kategori, progress real-time, dan validasi error Adobe API.

---

## Requirements

### Requirement 1 — Tab Navigasi Kategori

**User Story:** Sebagai pengguna, saya ingin melihat tool dikelompokkan dalam tab kategori (All, Workflows, Organize PDF, Optimize PDF, Convert PDF, Edit PDF, PDF Security, PDF Intelligence), sehingga saya dapat menemukan tool dengan cepat tanpa scroll panjang.

#### Acceptance Criteria

1. WHEN pengguna membuka halaman Beranda Fitur THEN sistem SHALL menampilkan **8 tab kategori** dalam bentuk pill/button horizontal di atas grid kartu tool.
2. WHEN tab "All" dipilih THEN sistem SHALL menampilkan **semua tool** dari semua kategori dalam satu grid.
3. WHEN tab kategori tertentu dipilih (mis. "Convert PDF") THEN sistem SHALL menyembunyikan tool dari kategori lain dan hanya menampilkan tool dalam kategori tersebut.
4. WHEN tab "Convert PDF" dipilih THEN sistem SHALL menampilkan **tepat 10 tool** konversi dalam grid 4 kolom (responsive: 2 kolom di tablet, 1 kolom di mobile).
5. IF tab aktif THEN sistem SHALL memberikan indikator visual aktif (background brand color, bold text, underline) yang konsisten dengan design system Hazeverter.
6. WHEN pengguna berpindah tab THEN sistem SHALL mempertahankan state filter aktif sampai halaman di-reload.
7. WHERE terdapat lebih dari 8 tab THEN sistem SHALL menyembunyikan tab berlebih di belakang tombol "More" dropdown pada layar ≤ 640px (mobile).
8. WHEN status tab berubah THEN sistem SHALL update URL hash (mis. `#tab=convert-pdf`) untuk mendukung deep-linking dan back/forward browser.

---

### Requirement 2 — PDF ke Word (.docx) [Server-side Adobe API]

**User Story:** Sebagai pengguna, saya ingin mengonversi file PDF menjadi Microsoft Word (.docx) yang dapat diedit dengan format dan layout yang akurat, sehingga saya dapat memodifikasi konten dokumen tanpa mengetik ulang.

#### Acceptance Criteria

1. WHEN pengguna memilih tool "PDF ke Word" dan mengunggah minimal 1 file PDF THEN sistem SHALL mengirim file ke endpoint `POST http://localhost:3000/api/convert` dengan `targetType=docx`.
2. WHEN request diterima server THEN sistem SHALL memproses konversi menggunakan Adobe PDF Services `ExportPDFJob` dengan `ExportPDFTargetFormat.DOCX`.
3. WHEN konversi Adobe API berhasil THEN sistem SHALL mengembalikan file `.docx` dengan Content-Type `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
4. WHEN hasil diterima klien THEN sistem SHALL mengunduh otomatis dengan nama `<nama-asli>.docx` dan memicu confetti animation.
5. IF file PDF dipassword-protected THEN sistem SHALL menampilkan pesan error "PDF terproteksi kata sandi. Buka proteksi terlebih dahulu." dan tidak melanjutkan request.
6. IF ukuran file > 100 MB THEN sistem SHALL menampilkan pesan "Ukuran file melebihi batas 100 MB. Silakan kompres terlebih dahulu." sebelum upload.
7. WHEN konversi gagal di server THEN sistem SHALL menampilkan pesan error spesifik dari Adobe (mis. "Adobe API rate limit tercapai, coba lagi dalam 60 detik").
8. WHERE mode pemrosesan aktif THEN sistem SHALL menampilkan progress bar dengan status: "Mengunggah ke Adobe...", "Memproses konversi...", "Mengunduh hasil...".

---

### Requirement 3 — PDF ke PowerPoint (.pptx) [Server-side Adobe API]

**User Story:** Sebagai pengguna, saya ingin mengubah PDF presentasi menjadi slide PowerPoint (.pptx) yang dapat diedit, sehingga saya dapat memperbarui materi presentasi tanpa membuat ulang dari nol.

#### Acceptance Criteria

1. WHEN pengguna memilih tool "PDF ke PowerPoint" dan mengunggah file PDF THEN sistem SHALL mengirim request ke Adobe API untuk konversi ke `.pptx`.
2. WHEN server memproses THEN sistem SHALL menggunakan Adobe SDK `ExportPDFJob` dengan `ExportPDFTargetFormat.PPTX`.
3. WHEN konversi berhasil THEN sistem SHALL mengembalikan file dengan Content-Type `application/vnd.openxmlformats-officedocument.presentationml.presentation`.
4. WHEN hasil diterima klien THEN sistem SHALL memicu download otomatis dengan nama `<nama-asli>.pptx`.
5. IF Adobe SDK tidak memiliki konstanta `ExportPDFTargetFormat.PPTX` THEN sistem SHALL menggunakan fallback `Job.getJobResult` dengan `targetFormat: 'pptx'` string atau menolak dengan pesan "Format PowerPoint belum didukung oleh konfigurasi SDK saat ini".
6. WHEN konversi gagal THEN sistem SHALL menampilkan error dan tombol "Coba Lagi" tanpa mengulang upload file.
7. WHERE file multi-halaman THEN sistem SHALL mempertahankan urutan halaman PDF sebagai urutan slide PPT.

---

### Requirement 4 — PDF ke Excel (.xlsx) [Server-side Adobe API]

**User Story:** Sebagai pengguna, saya ingin mengekstrak tabel dari PDF menjadi lembar kerja Excel (.xlsx) yang terstruktur, sehingga saya dapat menganalisis data tanpa menyalin manual.

#### Acceptance Criteria

1. WHEN pengguna memilih tool "PDF ke Excel" dan mengunggah file PDF THEN sistem SHALL mengirim request `POST /api/convert` dengan `targetType=xlsx`.
2. WHEN server menerima request THEN sistem SHALL menggunakan `ExportPDFJob` dengan `ExportPDFTargetFormat.XLSX`.
3. WHEN konversi berhasil THEN sistem SHALL mengembalikan file dengan Content-Type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
4. WHEN hasil diterima klien THEN sistem SHALL memicu download dengan nama `<nama-asli>.xlsx`.
5. WHEN konversi gagal THEN sistem SHALL menampilkan error message dengan kode error Adobe (jika tersedia).
6. IF file PDF tidak mengandung tabel THEN sistem SHALL tetap menghasilkan file XLSX kosong (perilaku Adobe default) dan menambahkan catatan "PDF ini tidak terdeteksi memiliki tabel".
7. WHERE Adobe response timeout > 30 detik THEN sistem SHALL membatalkan request dan menampilkan "Konversi超时, silakan coba lagi dengan file lebih kecil".

---

### Requirement 5 — Word ke PDF (.docx → .pdf) [Server-side Adobe API]

**User Story:** Sebagai pengguna, saya ingin mengonversi dokumen Microsoft Word (.docx) menjadi PDF dengan format rapi, sehingga saya dapat berbagi dokumen yang tidak dapat diedit oleh penerima.

#### Acceptance Criteria

1. WHEN pengguna memilih tool "Word ke PDF" dan mengunggah file `.docx` THEN sistem SHALL mengirim request ke endpoint Adobe proxy dengan endpoint type `word-to-pdf`.
2. WHEN server memproses THEN sistem SHALL menggunakan Adobe SDK `ImportPDFJob` dengan input format `DOCX` untuk membuat PDF baru.
3. WHEN konversi berhasil THEN sistem SHALL mengembalikan file PDF dengan Content-Type `application/pdf`.
4. WHEN hasil diterima klien THEN sistem SHALL memicu download dengan nama `<nama-asli>.pdf`.
5. IF file bukan `.docx` (mis. `.doc` legacy) THEN sistem SHALL menolak dengan pesan "Hanya file .docx yang didukung. Silakan konversi .doc ke .docx terlebih dahulu."
6. WHEN konversi gagal THEN sistem SHALL menampilkan error dan mempertahankan file di antrean untuk retry.
7. WHERE file Word mengandung font custom THEN sistem SHALL menyertakan fallback font substitution untuk menjaga konsistensi visual.

---

### Requirement 6 — PowerPoint ke PDF (.pptx → .pdf) [Server-side Adobe API]

**User Story:** Sebagai pengguna, saya ingin mengonversi presentasi PowerPoint (.pptx) menjadi PDF, sehingga saya dapat mendistribusikan materi tanpa khawatir format berubah di komputer penerima.

#### Acceptance Criteria

1. WHEN pengguna memilih tool "PowerPoint ke PDF" dan mengunggah file `.pptx` THEN sistem SHALL mengirim request dengan parameter `targetType=pptx-to-pdf`.
2. WHEN server memproses THEN sistem SHALL menggunakan Adobe SDK `ImportPDFJob` dengan input `PPTX`.
3. WHEN konversi berhasil THEN sistem SHALL mengembalikan PDF dengan satu halaman per slide.
4. WHEN hasil diterima klien THEN sistem SHALL memicu download dengan nama `<nama-asli>.pdf`.
5. IF file bukan `.pptx` THEN sistem SHALL menampilkan error "Format tidak valid. Pilih file presentasi PowerPoint (.pptx)."
6. WHEN konversi gagal THEN sistem SHALL menampilkan error Adobe spesifik dan tombol retry.
7. WHERE ukuran file > 50 MB THEN sistem SHALL menampilkan peringatan "File besar, proses mungkin memakan waktu 1-2 menit".

---

### Requirement 7 — Excel ke PDF (.xlsx → .pdf) [Server-side Adobe API]

**User Story:** Sebagai pengguna, saya ingin mengonversi lembar kerja Excel (.xlsx) menjadi PDF untuk pencetakan atau distribusi, sehingga data dapat dilihat konsisten tanpa software Excel.

#### Acceptance Criteria

1. WHEN pengguna memilih tool "Excel ke PDF" dan mengunggah file `.xlsx` THEN sistem SHALL mengirim request dengan parameter `targetType=xlsx-to-pdf`.
2. WHEN server memproses THEN sistem SHALL menggunakan Adobe SDK `ImportPDFJob` dengan input `XLSX`.
3. WHEN konversi berhasil THEN sistem SHALL mengembalikan PDF dengan sheet aktif sebagai halaman utama.
4. WHEN hasil diterima klien THEN sistem SHALL memicu download dengan nama `<nama-asli>.pdf`.
5. IF file bukan `.xlsx` THEN sistem SHALL menampilkan error validasi format.
6. WHEN file Excel memiliki multiple sheets THEN sistem SHALL menyertakan semua sheet sebagai halaman PDF (urut sesuai tab sheet).
7. WHERE ada area print yang sudah didefinisikan THEN sistem SHALL menggunakan area print Excel sebagai halaman PDF.

---

### Requirement 8 — PDF ke JPG (image extraction) [Client-side pdf.js]

**User Story:** Sebagai pengguna, saya ingin mengekstrak halaman PDF menjadi gambar JPG berkualitas tinggi, sehingga saya dapat menggunakan halaman PDF sebagai gambar di presentasi atau dokumen lain.

#### Acceptance Criteria

1. WHEN pengguna memilih tool "PDF ke JPG" dan mengunggah file PDF THEN sistem SHALL memproses **sepenuhnya di client-side** menggunakan `pdf.js` tanpa mengirim file ke server.
2. WHEN klien memproses THEN sistem SHALL merender setiap halaman PDF ke `<canvas>` dengan scale minimal 2.0x untuk kualitas retina.
3. WHEN halaman selesai di-render THEN sistem SHALL mengkonversi canvas ke Blob JPG dengan quality 0.92.
4. WHEN multi-page PDF (lebih dari 1 halaman) THEN sistem SHALL membungkus semua JPG dalam file **ZIP** menggunakan JSZip dengan nama `<nama-asli>_pages.zip`.
5. WHEN single-page PDF THEN sistem SHALL langsung memicu download JPG individual dengan nama `<nama-asli>_page-1.jpg`.
6. IF halaman PDF > 50 THEN sistem SHALL menampilkan konfirmasi "PDF ini memiliki 50+ halaman, proses mungkin lambat. Lanjutkan?" sebelum memulai.
7. WHEN proses render THEN sistem SHALL menampilkan progress bar per halaman ("Memproses halaman 3 dari 12...").
8. WHERE ukuran file PDF > 200 MB THEN sistem SHALL tetap memproses di client-side dengan warning "File besar, pastikan browser tidak menutup halaman".

---

### Requirement 9 — JPG ke PDF (image-to-PDF) [Client-side jsPDF]

**User Story:** Sebagai pengguna, saya ingin menggabungkan beberapa gambar JPG/PNG/WEBP menjadi satu file PDF yang rapi, sehingga saya dapat mengirim koleksi foto sebagai satu dokumen.

#### Acceptance Criteria

1. WHEN pengguna memilih tool "JPG ke PDF" dan mengunggah minimal 1 file gambar THEN sistem SHALL memproses **sepenuhnya di client-side** menggunakan `jsPDF`.
2. WHEN klien memproses THEN sistem SHALL menstandarkan setiap gambar ke ukuran **A4 portrait (210 × 297 mm)** dengan centering & aspect ratio preservation (contain fit).
3. WHEN multiple gambar diunggah THEN sistem SHALL membuat satu halaman PDF per gambar dengan urutan sesuai urutan upload.
4. WHEN proses selesai THEN sistem SHALL memicu download file `<nama-pertama-gambar>_combined.pdf`.
5. IF format gambar adalah HEIC THEN sistem SHALL mengonversi ke JPG via `heic2any` library terlebih dahulu sebelum membuat PDF.
6. WHEN gambar beresolusi sangat kecil (< 300×400 px) THEN sistem SHALL menampilkan peringatan "Resolusi rendah, hasil mungkin buram".
7. WHERE pengguna menyeret file campur (PDF + JPG) THEN sistem SHALL menerima semua dan hanya memproses gambar; file PDF diabaikan dengan notifikasi.
8. WHEN konversi selesai THEN sistem SHALL menampilkan statistik: "Berhasil membuat 5 halaman A4 dari 5 gambar (2.4 MB)".

---

### Requirement 10 — HTML ke PDF [Server-side Adobe API via CreatePDFJob]

**User Story:** Sebagai pengguna, saya ingin mengonversi file HTML (atau URL halaman web) menjadi PDF dengan rendering yang akurat, sehingga saya dapat mengarsipkan tampilan web sebagai dokumen portabel.

#### Acceptance Criteria

1. WHEN pengguna memilih tool "HTML ke PDF" THEN sistem SHALL menampilkan opsi input: **Upload file HTML/HTM** atau **Tempel URL halaman web**.
2. WHEN file HTML diunggah THEN sistem SHALL mengirim file `.html` atau `.htm` ke endpoint `POST /api/convert` dengan `targetType=html-to-pdf`.
3. WHEN URL diberikan THEN sistem SHALL mengirim request dengan `targetType=url-to-pdf` dan field `url` di FormData.
4. WHEN server memproses THEN sistem SHALL menggunakan Adobe SDK `CreatePDFJob` dengan input MIME `text/html` (untuk file) atau `CreatePDFFromURL` (untuk URL).
5. WHEN konversi berhasil THEN sistem SHALL mengembalikan PDF dengan Content-Type `application/pdf`.
6. WHEN hasil diterima klien THEN sistem SHALL memicu download dengan nama `<judul-halaman>.pdf` atau `webpage.pdf`.
7. IF URL tidak dapat diakses (404/timeout) THEN sistem SHALL menampilkan error "Halaman web tidak dapat diakses. Periksa URL dan koneksi internet."
8. WHERE halaman web mengandung external resources (CSS/JS/images) THEN sistem SHALL menunggu Adobe merender dengan timeout 60 detik.

---

### Requirement 11 — PDF ke PDF/A (archival format) [Server-side Adobe API]

**User Story:** Sebagai pengguna, saya ingin mengonversi PDF standar menjadi format PDF/A (PDF for Archival) yang sesuai standar ISO untuk pengarsipan jangka panjang, sehingga dokumen saya dapat dibuka konsisten di masa depan.

#### Acceptance Criteria

1. WHEN pengguna memilih tool "PDF ke PDF/A" dan mengunggah file PDF THEN sistem SHALL mengirim request `POST /api/convert` dengan `targetType=pdfa`.
2. WHEN server memproses THEN sistem SHALL menggunakan Adobe SDK `ExportPDFJob` dengan `ExportPDFParams` yang menyertakan `pdfaConformanceLevel: 'LEVEL_2_B'` (PDF/A-2B).
3. WHEN konversi berhasil THEN sistem SHALL mengembalikan file PDF/A-compliant dengan Content-Type `application/pdf`.
4. WHEN hasil diterima klien THEN sistem SHALL memicu download dengan nama `<nama-asli>_PDFA.pdf`.
5. WHEN proses selesai THEN sistem SHALL menampilkan badge "PDF/A-2B Compliant" pada download view.
6. IF file PDF mengandung elemen non-archival (JavaScript, encryption, external references) THEN sistem SHALL menampilkan peringatan sebelum upload: "File ini mungkin tidak kompatibel dengan PDF/A. Proses mungkin menghilangkan beberapa elemen."
7. WHERE file gagal konversi PDF/A THEN sistem SHALL menampilkan laporan validasi Adobe yang merinci elemen penyebab kegagalan.
8. WHEN konversi gagal THEN sistem SHALL mempertahankan file di state workspace dan memungkinkan retry.

---

### Requirement 12 — Preserve & Improve: Smart Scan A4 dengan Crop Bebas

**User Story:** Sebagai pengguna, saya ingin fitur Smart Scan A4 yang sudah ada tetap berfungsi dengan stabilitas dan UX yang lebih baik, sehingga saya dapat mengubah foto dokumen fisik menjadi PDF A4 presisi.

#### Acceptance Criteria

1. WHEN pengguna memilih tab "Convert PDF" atau "All" dan memilih "Smart Scan & Free Crop A4" THEN sistem SHALL membuka workspace view dengan antrean berkas dan opsi scan.
2. WHEN foto/gambar diunggah THEN sistem SHALL menerima format: JPG, JPEG, PNG, WEBP, HEIC, HEIF.
3. WHEN file HEIC dari iPhone diunggah THEN sistem SHALL mengonversi ke JPG menggunakan `heic2any` sebelum diproses.
4. WHEN pengguna mengklik tombol "Potong Area" pada kartu foto THEN sistem SHALL membuka modal crop dengan `Cropper.js` (free aspect ratio).
5. WHEN modal crop aktif THEN sistem SHALL menyediakan tombol "Simulasi Sinar Laser" yang mengaktifkan animasi scanner laser 3 detik untuk preview efek scan.
6. WHEN crop disimpan THEN sistem SHALL menstandarkan hasil crop ke canvas A4 presisi (2480×3508 px, rasio 1:√2) dengan centering.
7. WHEN mode "Scan Hitam Putih" aktif THEN sistem SHALL menerapkan filter `grayscale(100%) contrast(160%) brightness(105%)` ke canvas A4 dan ke preview thumbnail real-time.
8. WHEN mode "Warna Asli" aktif THEN sistem SHALL mempertahankan warna asli gambar tanpa filter.
9. WHEN urutan halaman diubah (arrow left/right pada kartu) THEN sistem SHALL mempertahankan OCR cache dan state pilihan file.
10. IF file bukan gambar THEN sistem SHALL menolak dan menampilkan "Hanya file gambar (JPG/PNG/WEBP/HEIC) yang didukung untuk Smart Scan".
11. WHERE ada lebih dari 1 gambar THEN sistem SHALL membuat PDF multi-halaman dengan `<nama-terdeteksi>.pdf` (lihat Requirement 14).

---

### Requirement 13 — Preserve & Improve: OCR Engine (Tesseract.js)

**User Story:** Sebagai pengguna, saya ingin hasil OCR yang lebih akurat dan cepat pada foto dokumen, sehingga saya dapat mengekstrak teks dari foto tanpa mengetik ulang.

#### Acceptance Criteria

1. WHEN foto dipilih di antrean berkas Smart Scan THEN sistem SHALL otomatis menjalankan OCR via `tesseract.js` dengan bahasa English (`'eng'`).
2. WHEN OCR berjalan THEN sistem SHALL menampilkan status "Pemindaian OCR Aktif" dengan spinner animasi.
3. WHEN tab "Hasil Deteksi Teks BA" dipilih THEN sistem SHALL menampilkan teks hasil OCR dalam monospace box dengan scrollable area.
4. WHEN pengguna mengklik tombol "Scan Ulang" THEN sistem SHALL menghapus cache OCR dan menjalankan ulang engine untuk file yang dipilih.
5. WHILE OCR berjalan THEN sistem SHALL menampilkan progress percentage real-time ("Sedang mengekstrak teks halaman 1... (45%)").
6. WHEN OCR gagal THEN sistem SHALL menampilkan pesan "Gagal memproses OCR pada file ini" dan memungkinkan retry.
7. WHERE file bukan gambar THEN sistem SHALL menampilkan pesan "Berkas ini bukan gambar yang dapat di-scan OCR" di tab OCR.
8. WHEN file hasil crop baru disimpan THEN sistem SHALL menghapus cache OCR dan otomatis menjalankan ulang OCR.

---

### Requirement 14 — Preserve & Improve: Deteksi Otomatis Nomor BA

**User Story:** Sebagai pengguna, saya ingin sistem secara otomatis mendeteksi nomor BA (Berita Acara) dari hasil OCR dengan format `BA.SMD.TAHUN.BULAN.NOMOR_BA`, sehingga nama file PDF terisi otomatis dan saya tidak perlu mengetik manual.

#### Acceptance Criteria

1. WHEN hasil OCR diterima THEN sistem SHALL menjalankan regex pattern `/BA[.\/\s]SMD[.\/\s]\d{4}[.\/\s]\d{2}[.\/\s]\d{3,5}/i` untuk mencocokkan nomor BA.
2. WHEN regex match ditemukan THEN sistem SHALL menormalisasi separator ke titik (`.`) dan mengkonversi ke uppercase: `BA.SMD.YYYY.MM.NNN`.
3. WHEN nomor BA terdeteksi THEN sistem SHALL otomatis mengisi input field `opt-ba-filename` dengan nilai `<nomor-ba>.pdf`.
4. WHEN nomor BA terdeteksi THEN sistem SHALL menampilkan badge "BA Terdeteksi!" berwarna hijau di samping label "Nama Berkas Terdeteksi".
5. WHEN nomor BA terdeteksi THEN sistem SHALL menyimpan nilai di state `app.detectedBaNumber` untuk referensi.
6. IF regex tidak menemukan match THEN sistem SHALL mempertahankan default filename `BA.SMD.2026.09.015.pdf` (placeholder) dan tidak menampilkan badge.
7. WHEN pengguna mengedit input filename secara manual THEN sistem SHALL menerima input baru dan mengupdate filename untuk proses Smart Scan PDF.
8. WHERE hasil crop baru memicu OCR ulang THEN sistem SHALL memperbarui deteksi nomor BA dengan hasil terbaru.
9. WHEN proses Smart Scan PDF dimulai THEN sistem SHALL menggunakan nilai dari `opt-ba-filename` input (bukan default) sebagai nama file output, dengan fallback default jika kosong.
10. IF filename tidak diakhiri `.pdf` THEN sistem SHALL menambahkan ekstensi `.pdf` secara otomatis.

---

### Requirement 15 — Workflow Upload + Proses + Download (3 Views)

**User Story:** Sebagai pengguna, saya ingin alur kerja yang konsisten dari upload → proses → download dengan indikator visual yang jelas, sehingga saya tahu status proses setiap saat.

#### Acceptance Criteria

1. WHEN tool dipilih dan file belum diunggah THEN sistem SHALL menampilkan **Workspace View** dengan dropzone prominent di tengah.
2. WHEN file di-drop atau dipilih THEN sistem SHALL transisi dari dropzone ke **Preview Container** dengan antrean berkas dan panel opsi.
3. WHEN tombol proses diklik THEN sistem SHALL berpindah ke **Processing View** dengan layar hitam, laser scanner animation, dan progress bar.
4. WHILE proses berjalan THEN sistem SHALL menampilkan status text dinamis (mis. "Mengirim ke Adobe...", "Merender halaman...").
5. WHEN proses selesai THEN sistem SHALL berpindah ke **Download View** dengan tombol download prominent dan confetti animation.
6. WHEN download view aktif THEN sistem SHALL memicu `confetti()` dari library `canvas-confetti` dengan particleCount 100 dan spread 70.
7. IF proses gagal THEN sistem SHALL kembali ke **Workspace View** dengan alert error dan state file tetap utuh untuk retry.
8. WHEN tombol "Kembali ke Berkas Utama" ditekan di Download View THEN sistem SHALL me-reset state dan kembali ke Beranda Fitur.
9. WHERE pengguna mengklik logo Hazeverter di header THEN sistem SHALL kembali ke Beranda Fitur dari view apapun.
10. WHEN view berpindah THEN sistem SHALL menggunakan transisi CSS smooth (fade/slide) dengan durasi ≤ 300ms.

---

### Requirement 16 — Error Handling untuk Adobe API

**User Story:** Sebagai pengguna, saya ingin pesan error yang jelas dan dapat ditindaklanjuti ketika konversi Adobe API gagal, sehingga saya tahu apa yang salah dan bagaimana memperbaikinya.

#### Acceptance Criteria

1. IF Adobe credentials (CLIENT_ID / CLIENT_SECRET) tidak valid atau missing THEN server SHALL mengembalikan HTTP 500 dengan message "Kredensial Adobe tidak valid. Periksa file .env" dan log error detail di console server.
2. WHEN Adobe API mengembalikan rate limit (HTTP 429) THEN server SHALL mengembalikan HTTP 429 ke klien dengan message "Batas permintaan Adobe tercapai. Coba lagi dalam N detik."
3. WHEN Adobe API mengembalikan timeout (> 60 detik) THEN server SHALL membatalkan job dan mengembalikan HTTP 504 dengan message "Adobe API timeout. Silakan coba lagi."
4. WHEN file yang diunggah bukan PDF (untuk tool export) THEN server SHALL mengembalikan HTTP 400 dengan message "File harus berformat PDF".
5. WHEN ukuran file > 100 MB THEN server SHALL mengembalikan HTTP 413 dengan message "File terlalu besar. Maksimal 100 MB." (di luar itu, tolak sebelum upload).
6. WHEN format target tidak dikenali THEN server SHALL mengembalikan HTTP 400 dengan message "Format target tidak didukung: {targetType}".
7. IF Adobe SDK melempar exception tidak dikenal THEN server SHALL log stack trace dan mengembalikan HTTP 500 dengan generic message + correlation ID untuk debugging.
8. WHEN error terjadi THEN klien SHALL menampilkan toast/banner merah dengan pesan error dan tombol "Coba Lagi" yang mempertahankan file di antrean.
9. WHERE server tidak dapat diakses (network error) THEN klien SHALL menampilkan "Server proxy Adobe tidak berjalan. Jalankan `node server.js` di terminal."
10. WHEN file input Adobe gagal validasi THEN server SHALL membersihkan file temporary dari folder `uploads/` untuk mencegah disk leak.

---

### Requirement 17 — UX Requirements: Progress Bar, Confetti, Mobile Responsive

**User Story:** Sebagai pengguna, saya ingin antarmuka yang responsif, modern, dan memuaskan secara visual dengan progress feedback yang jelas, sehingga pengalaman menggunakan Hazeverter menyenangkan di semua perangkat.

#### Acceptance Criteria

1. WHEN proses apapun berjalan THEN sistem SHALL menampilkan progress bar dengan lebar yang ter-update smooth (CSS transition 300ms).
2. WHEN proses selesai THEN sistem SHALL memanggil `confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })`.
3. WHEN layar ≤ 640px (mobile) THEN sistem SHALL mengubah grid tool dari 4 kolom menjadi 1 kolom.
4. WHEN layar 641-1024px (tablet) THEN sistem SHALL mengubah grid tool menjadi 2 kolom.
5. WHEN layar > 1024px (desktop) THEN sistem SHALL menampilkan grid 4 kolom sesuai design original.
6. WHEN layar ≤ 640px THEN sistem SHALL menyembunyikan tab kategori di belakang hamburger menu atau scrollable horizontal container.
7. WHEN drag-drop file di area manapun pada Workspace View THEN sistem SHALL memberikan highlight visual (border brand, background brand-50).
8. WHEN tombol CTA ditekan THEN sistem SHALL memberikan feedback `active:scale-95` untuk tactile response.
9. WHEN hasil download diberikan THEN sistem SHALL menampilkan tombol download prominent dengan icon `fa-download` dan ukuran file.
10. WHERE ada error THEN sistem SHALL menampilkan toast notification dengan auto-dismiss 5 detik atau tombol close manual.
11. WHEN halaman di-load THEN sistem SHALL pre-load library eksternal (Tailwind, FontAwesome, pdf.js, jspdf, tesseract.js, jszip) untuk menghindari delay saat tool dipilih.
12. WHERE koneksi lambat THEN sistem SHALL menampilkan skeleton loader / shimmer effect pada area yang menunggu data (mis. hasil OCR).

---

### Requirement 18 — Tab Filter Behavior & State Management

**User Story:** Sebagai pengguna, saya ingin state filter tab tetap stabil saat saya berpindah-pindah tool dalam kategori yang sama, sehingga saya tidak perlu mengklik tab berulang kali.

#### Acceptance Criteria

1. WHEN tab kategori dipilih THEN sistem SHALL menyimpan state `activeTab` di `app.activeCategory`.
2. WHEN pengguna mengklik kartu tool THEN sistem SHALL navigasi ke workspace view tool tersebut dengan benar.
3. WHEN tool dipilih dan proses selesai (kembali ke home) THEN sistem SHALL mempertahankan tab kategori terakhir yang dipilih.
4. IF `localStorage` tersedia THEN sistem SHALL menyimpan tab kategori terakhir ke `localStorage.hazeverter.lastTab` untuk persistensi antar session.
5. WHEN pengguna me-reload halaman THEN sistem SHALL restore tab terakhir dari localStorage (jika ada), default ke "All".
6. WHERE ada deep-link URL `#tab=convert-pdf` THEN sistem SHALL parse hash dan membuka tab yang sesuai.
7. WHEN tab "Convert PDF" dipilih THEN jumlah tool yang ditampilkan SHALL tepat 10 (tidak lebih, tidak kurang).
8. WHEN tab "All" dipilih THEN sistem SHALL menampilkan semua tool termasuk Smart Scan A4, Merge, Split, Compress, Protect, Watermark, Convert PDF (10), dan tool tambahan lainnya.

---

### Requirement 19 — Backend Server Extension untuk 10 Tool

**User Story:** Sebagai developer/maintainer, saya ingin endpoint backend Express yang robust untuk menangani 10 tool konversi, dengan error handling dan logging yang baik.

#### Acceptance Criteria

1. WHEN server boot THEN sistem SHALL memvalidasi bahwa `ADOBE_CLIENT_ID` dan `ADOBE_CLIENT_SECRET` ada di environment variables.
2. IF credentials missing THEN server SHALL log warning "WARNING: Adobe credentials missing. Conversion endpoints will fail." tapi tetap start server.
3. WHEN endpoint `POST /api/convert` menerima `targetType` THEN server SHALL routing ke handler yang sesuai (docx, xlsx, pptx, word-to-pdf, pptx-to-pdf, xlsx-to-pdf, html-to-pdf, pdfa).
4. WHEN endpoint menerima file THEN server SHALL menyimpannya temporary di folder `uploads/` via multer dengan validasi tipe MIME.
5. WHEN proses selesai THEN server SHALL menghapus file temporary baik sukses maupun gagal (untuk mencegah disk leak).
6. WHEN Adobe response diterima THEN server SHALL pipe stream langsung ke response klien tanpa buffering seluruh file di memory.
7. WHEN error THEN server SHALL log dengan timestamp, error message, dan stack trace ke console.
8. WHERE ada request bersamaan (concurrent) THEN server SHALL handle dengan queue atau worker pool untuk menghindari rate limit Adobe.
9. WHEN port 3000 sudah digunakan THEN server SHALL exit dengan pesan "Port 3000 sudah digunakan. Hentikan proses lain atau ubah PORT di .env".
10. IF Adobe SDK version tidak mendukung format tertentu (mis. PPTX) THEN server SHALL mengembalikan HTTP 501 "Not Implemented" dengan pesan spesifik.

---

### Requirement 20 — Security & File Validation

**User Story:** Sebagai administrator sistem, saya ingin validasi file yang ketat dan sanitasi input, sehingga server aman dari malicious upload dan abuse.

#### Acceptance Criteria

1. WHEN file diunggah THEN server SHALL validasi MIME type yang sebenarnya (bukan hanya ekstensi) menggunakan signature bytes.
2. WHEN nama file mengandung karakter berbahaya (`../`, `<script>`, null bytes) THEN server SHALL sanitize nama file sebelum digunakan di `Content-Disposition` header.
3. WHEN ukuran file > 100 MB THEN server SHALL menolak sebelum upload ke Adobe (menghemat kuota).
4. WHERE ada banyak request dari IP sama THEN server SHALL implement rate limiting (mis. 10 request/menit per IP).
5. WHEN CORS request masuk THEN server SHALL hanya menerima origin `http://localhost:*` dan `http://127.0.0.1:*` untuk development.
6. WITH `.env` di `.gitignore` THEN sistem SHALL memastikan credentials tidak ter-commit ke version control.
7. WHEN error response THEN server SHALL tidak membocorkan stack trace internal ke klien (hanya generic message + correlation ID).
8. WHERE user agent adalah bot/crawler THEN server SHALL tetap menerima request (tidak ada blocking) karena tool ini client-driven.

---

### Requirement 21 — Dokumentasi & Help Tooltips

**User Story:** Sebagai pengguna baru, saya ingin tooltip atau help singkat untuk tool Convert PDF, sehingga saya memahami apa yang dilakukan setiap tool tanpa harus menebak.

#### Acceptance Criteria

1. WHEN kursor hover pada kartu tool Convert PDF THEN sistem SHALL menampilkan tooltip dengan deskripsi 1 kalimat singkat.
2. WHEN tab kategori "Convert PDF" aktif THEN sistem SHALL menampilkan banner info kecil di atas grid: "10 tool konversi dokumen, 8 via Adobe API (butuh server) dan 2 client-side (offline)."
3. IF server Adobe proxy tidak berjalan THEN sistem SHALL menampilkan banner peringatan kuning "Mode terbatas: Server Adobe offline. Hanya tool client-side (PDF→JPG, JPG→PDF) yang berfungsi."
4. WHEN tool Adobe dipilih dan server offline THEN sistem SHALL menampilkan pesan "Server tidak merespons. Pastikan `node server.js` berjalan." sebelum upload.
5. WHERE format file tidak sesuai THEN sistem SHALL menampilkan hint "Format didukung: .pdf, .docx, .pptx, .xlsx, .html".

---

### Requirement 22 — Backward Compatibility & Migration

**User Story:** Sebagai pengguna existing Hazeverter, saya ingin fitur Smart Scan A4 + OCR No BA yang lama tetap berfungsi seperti sebelumnya, sehingga saya tidak kehilangan alur kerja yang sudah saya kenal.

#### Acceptance Criteria

1. IF pengguna mengakses tool via menu header (mis. "SMART SCAN & A4 CROPPER") THEN sistem SHALL tetap membuka tool `ocr-ba` dengan behavior identik dengan versi sebelumnya.
2. WHEN tool Smart Scan A4 dipilih THEN sistem SHALL mempertahankan semua behavior existing: OCR auto-trigger, regex BA detection, crop modal, scan mode toggle, filename auto-fill.
3. WHERE ada perubahan layout THEN sistem SHALL mempertahankan class name dan ID element penting (`app`, `view-home`, `view-workspace`, `view-processing`, `view-download`, `crop-modal`, `ocr-preview-tabs`) untuk backward compatibility.
4. WHEN file baru ditambahkan ke antrean via tombol "Tambah Berkas" THEN sistem SHALL mempertahankan behavior multi-file existing.
5. IF ada saved state di `localStorage` lama THEN sistem SHALL membersihkan gracefully tanpa error.

---

## Catatan Teknis (Non-Functional)

### Performance
- Proses client-side (PDF→JPG, JPG→PDF) SHALL selesai dalam ≤ 10 detik untuk file ≤ 20 MB.
- Proses Adobe API (8 tool server-side) SHALL selesai dalam ≤ 60 detik per file.
- Progress bar SHALL update minimal setiap 500ms untuk memberikan feedback real-time.

### Browser Support
- Chrome 100+, Firefox 100+, Safari 15+, Edge 100+ (memerlukan dukungan ES2020).
- Mobile: iOS Safari 15+, Chrome Android 100+.

### Dependencies
- Frontend: Tailwind CSS (CDN), FontAwesome 6.4, Cropper.js 1.5, pdf.js 2.16, jspdf 2.5, JSZip 3.10, FileSaver 2.0, tesseract.js 5, heic2any 0.0.4, canvas-confetti 1.6.
- Backend: `@adobe/pdfservices-node-sdk@^4.1.0`, `express@^5.2.1`, `multer@^2.3.0`, `cors@^2.8.6`, `dotenv@^17.4.2`.

### Environment Variables
- `ADOBE_CLIENT_ID`: kredensial Adobe.
- `ADOBE_CLIENT_SECRET`: kredensial Adobe.
- `PORT` (optional): port server, default 3000.

### File Output Defaults
- PDF to Word/Excel/PPT: `<nama-asli>.<ext>`
- * to PDF: `<nama-asli>.pdf`
- PDF ke JPG (multi-page): `<nama-asli>_pages.zip`
- PDF ke JPG (single-page): `<nama-asli>_page-1.jpg`
- PDF ke PDF/A: `<nama-asli>_PDFA.pdf`
- JPG/PNG to PDF: `<nama-pertama>_combined.pdf`
- HTML to PDF: `<judul-halaman>.pdf`
- Smart Scan A4: `<BA.SMD.YYYY.MM.NNN>.pdf` (jika terdeteksi), default `BA.SMD.2026.09.015.pdf`.

---

## Acceptance Summary

Dokumen ini mencakup **22 requirement** yang mencakup:
- 1 requirement arsitektur/kategori (Tab Navigation)
- 10 requirement fitur Convert PDF (tool individual)
- 3 requirement preserve & improve (Smart Scan A4, OCR, BA Detection)
- 1 requirement alur kerja (3 views)
- 1 requirement error handling Adobe API
- 1 requirement UX (responsive, progress, confetti)
- 1 requirement tab state management
- 1 requirement backend server extension
- 1 requirement security & validation
- 1 requirement dokumentasi/tooltips
- 1 requirement backward compatibility
- 1 requirement non-functional (performance, browser, dependencies)

Total: **22 requirement utama** dengan **±140 acceptance criteria** dalam format EARS.
