const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let readings = [];

app.post('/api/readings', (req, res) => {
  console.log('📥 Received:', req.body);
  
  const { bpm, spo2 } = req.body;
  
  if (!bpm || !spo2) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Missing bpm or spo2' 
    });
  }

  const newReading = {
    id: readings.length + 1,
    bpm: parseInt(bpm),
    spo2: parseInt(spo2),
    timestamp: new Date().toISOString()
  };

  readings.push(newReading);
  
  console.log(`📊 BPM: ${bpm}, SpO2: ${spo2}%`);
  console.log(`📦 Total: ${readings.length}`);

  res.status(200).json({ 
    status: 'success', 
    data: newReading 
  });
});

app.get('/api/readings/latest', (req, res) => {
  if (readings.length === 0) {
    return res.json({ status: 'success', data: null });
  }
  res.json({ status: 'success', data: readings[readings.length - 1] });
});

app.get('/api/readings/all', (req, res) => {
  res.json({ status: 'success', count: readings.length, data: readings });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', totalReadings: readings.length });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});