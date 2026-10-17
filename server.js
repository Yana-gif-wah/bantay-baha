require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();

// Enable CORS so the IoT simulator can POST to Render from external terminals/environments
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    return res.status(200).json({});
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store
let readings = [];

// Helper function to calculate analytics
function computeAnalytics() {
  if (readings.length === 0) {
    return { average: 0, min: 0, max: 0, statusCounts: { Normal: 0, Alert: 0, Danger: 0 }, trend: 'steady' };
  }

  const levels = readings.map(r => r.waterLevelCm);
  const sum = levels.reduce((a, b) => a + b, 0);
  const average = Number((sum / levels.length).toFixed(1));
  const min = Math.min(...levels);
  const max = Math.max(...levels);

  const statusCounts = { Normal: 0, Alert: 0, Danger: 0 };
  readings.forEach(r => {
    if (r.waterLevelCm < 100) statusCounts.Normal++;
    else if (r.waterLevelCm <= 149) statusCounts.Alert++;
    else statusCounts.Danger++;
  });

  // Calculate trend comparing last 5 vs previous 5
  let trend = 'steady';
  if (readings.length >= 10) {
    const recent5 = readings.slice(0, 5).reduce((a, b) => a + b.waterLevelCm, 0) / 5;
    const prev5 = readings.slice(5, 10).reduce((a, b) => a + b.waterLevelCm, 0) / 5;
    if (recent5 > prev5 + 1) trend = 'rising';
    else if (recent5 < prev5 - 1) trend = 'falling';
  }

  return { average, min, max, statusCounts, trend };
}

// POST /api/readings
app.post('/api/readings', (req, res) => {
  const { sensorId, waterLevelCm, timestamp } = req.body;

  if (!sensorId || waterLevelCm === undefined || typeof waterLevelCm !== 'number' || waterLevelCm < 0 || waterLevelCm > 500) {
    return res.status(400).json({ error: 'Invalid payload or water level out of bounds (0-500).' });
  }

  const newReading = { sensorId, waterLevelCm, timestamp: timestamp || new Date().toISOString() };
  readings.unshift(newReading); // Add to beginning (newest first)
  
  if (readings.length > 50) readings.pop();

  res.status(201).json(newReading);
});

// GET /api/readings
app.get('/api/readings', (req, res) => {
  res.json(readings.slice(0, 50));
});

// GET /api/summary
app.get('/api/summary', (req, res) => {
  res.json(computeAnalytics());
});

// POST /api/advisory (Generative AI & Fallback)
app.post('/api/advisory', async (req, res) => {
  const analytics = computeAnalytics();
  const latestLevel = readings.length > 0 ? readings[0].waterLevelCm : 0;

  const prompt = `Based ONLY on this flood data: Latest Water Level: ${latestLevel}cm, Average: ${analytics.average}cm, Trend: ${analytics.trend}, Statuses: Normal (${analytics.statusCounts.Normal}), Alert (${analytics.statusCounts.Alert}), Danger (${analytics.statusCounts.Danger}).
Write a short, clear public advisory in BOTH Filipino and English (max 3 sentences total) giving safety instructions to residents. Do not use outside facts.`;

  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("Missing API Key");
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ advisory: response.text });
  } catch (err) {
    // Rule-based fallback if AI fails
    let fallbackText = '';
    if (latestLevel >= 150) {
      fallbackText = "DANGER: High water level detected! Evacuate to higher ground immediately. / PANGANIB: Mataas ang tubig! Lumikas agad sa mas mataas na lugar.";
    } else if (latestLevel >= 100) {
      fallbackText = "ALERT: Water level is rising. Prepare emergency kits. / BABALA: Tumataas ang tubig. Ihanda ang emergency kit.";
    } else {
      fallbackText = "NORMAL: Creek water levels are safe. Stay vigilant. / LIGTAS: Normal ang antas ng tubig sa ilog. Manatiling alerto.";
    }
    res.json({ advisory: fallbackText, fallback: true });
  }
});

// Catch-all route to serve the front-end dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));