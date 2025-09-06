require('dotenv').config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { OpenAI } = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Carpetas temporales
const uploadDir = path.join(__dirname, "tmp/uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// Multer
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB max
});

app.use(express.static("public"));

app.post("/transcribe", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).send("No se subió ningún archivo.");

  const inputPath = req.file.path;
  const outputPath = inputPath + ".wav";

  try {
    // Convertir MP4 a WAV usando FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat("wav")
        .on("end", resolve)
        .on("error", reject)
        .save(outputPath);
    });

    // Transcribir usando OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(outputPath),
      model: "whisper-1"
    });

    res.json({ text: transcription.text });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error al transcribir el archivo.");
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;
