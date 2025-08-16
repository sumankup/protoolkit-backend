// server.js - SAFE VERSION FOR A SUCCESSFUL DEPLOYMENT

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// A simple root route to check if the server is alive
app.get('/', (req, res) => {
    res.send('ProToolkit Backend is running successfully!');
});

// Create temporary directories
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

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
            default:
                throw new Error(`The requested tool ('${tool}') is not enabled on this server.`);
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

app.listen(PORT, () => {
    console.log(`✅ ProToolkit Backend Server is running on port ${PORT}`);
});