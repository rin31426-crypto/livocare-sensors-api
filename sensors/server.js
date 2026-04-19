const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// تخزين القراءات (خارج scope الطلب)
let readings = [];

// استقبال البيانات من ESP32
app.post('/api/readings', (req, res) => {
  console.log('📥 Received body:', req.body);
  
  const bpm = req.body.bpm;
  const spo2 = req.body.spo2;
  
  console.log(`📊 Extracted - BPM: ${bpm}, SpO2: ${spo2}`);
  
  if (!bpm || !spo2) {
    console.log('❌ Missing bpm or spo2');
    return res.status(400).json({ 
      status: 'error', 
      message: 'Missing bpm or spo2',
      received: req.body
    });
  }

  const newReading = {
    id: readings.length + 1,
    bpm: parseInt(bpm),
    spo2: parseInt(spo2),
    timestamp: new Date().toISOString()
  };

  readings.push(newReading);
  
  console.log(`✅ Saved: BPM: ${bpm}, SpO2: ${spo2}%`);
  console.log(`📦 Total readings: ${readings.length}`);

  // إرسال رد واضح
  res.status(200).json({ 
    status: 'success', 
    data: newReading 
  });
});

// آخر قراءة
app.get('/api/readings/latest', (req, res) => {
  console.log('📖 GET /api/readings/latest');
  if (readings.length === 0) {
    return res.json({ status: 'success', data: null });
  }
  res.json({ status: 'success', data: readings[readings.length - 1] });
});

// جميع القراءات
app.get('/api/readings/all', (req, res) => {
  console.log('📖 GET /api/readings/all');
  res.json({ status: 'success', count: readings.length, data: readings });
});

// صحة الخدمة
app.get('/health', (req, res) => {
  res.json({ status: 'ok', totalReadings: readings.length });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});