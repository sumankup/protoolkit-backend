// server.js - The Backend "Kitchen"

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
// Render provides its own port, so we use process.env.PORT
const PORT = process.env.PORT || 3000;

app.use(cors());

// Use /tmp for temporary storage on services like Render
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.send('ProToolkit Backend is running!');
});

app.post('/api/process-file', upload.single('files'), async (req, res) => {
    if (!req.file) { return res.status(400).send('No file uploaded.'); }
    const tool = req.body.tool;
    const inputFile = req.file.path;
    const outputFileName = `${Date.now()}_${req.file.originalname.replace(/\.[^/.]+$/, "")}`;
    let outputFilePath = '';
    try {
        console.log(`Processing with tool: ${tool}`);
        switch (tool) {
            case 'image-processor':
                const format = req.body.format;
                const quality = parseInt(req.body.quality);
                outputFilePath = path.join(outputDir, `${outputFileName}.${format}`);
                let imageProcessor = sharp(inputFile);
                if (format === 'jpeg') await imageProcessor.jpeg({ quality: quality }).toFile(outputFilePath);
                else if (format === 'png') await imageProcessor.png().toFile(outputFilePath);
                else if (format === 'webp') await imageProcessor.webp({ quality: quality }).toFile(outputFilePath);
                else throw new Error('Unsupported image format');
                break;
            case 'pdf-converter':
                const conversionType = req.body.conversionType;
                if (conversionType === 'pdf-to-word') { outputFilePath = await convertPdfToDocx(inputFile, outputDir); }
                else { throw new Error('This PDF conversion is not yet supported.'); }
                break;
            default:
                throw new Error('Invalid tool specified.');
        }
        res.download(outputFilePath, path.basename(outputFilePath), (err) => {
            if (err) console.error("Error sending file:", err);
            fs.unlinkSync(inputFile);
            fs.unlinkSync(outputFilePath);
        });
    } catch (error) {
        console.error("Processing error:", error);
        res.status(500).send(`An error occurred: ${error.message}`);
        fs.unlinkSync(inputFile);
    }
});

function convertPdfToDocx(filePath, outDir) {
    return new Promise((resolve, reject) => {
        // This command assumes LibreOffice is installed in the Render environment.
        // This is advanced and might fail on the free tier.
        const command = `soffice --headless --convert-to docx --outdir "${outDir}" "${filePath}"`;
        exec(command, (error) => {
            if (error) { return reject(new Error('PDF conversion failed on the server.')); }
            const originalFileName = path.basename(filePath, path.extname(filePath));
            resolve(path.join(outDir, `${originalFileName}.docx`));
        });
    });
}

app.listen(PORT, () => {
    console.log(`✅ ProToolkit Backend Server is running on port ${PORT}`);
});