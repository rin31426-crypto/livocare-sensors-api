const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== إعدادات أساسية ==========
app.use(cors());
app.use(express.json());
app.use(express.text()); // لدعم التنسيقات الأخرى

// ========== تخزين مؤقت للبيانات ==========
let readings = [];

// ========== استقبال بيانات من ESP32 ==========
app.post('/api/readings', (req, res) => {
  console.log('📥 Body received:', req.body);
  console.log('📥 Headers:', req.headers['content-type']);
  
  // محاولة قراءة البيانات من عدة مصادر
  let bpm, spo2;
  
  if (req.body && typeof req.body === 'object') {
    bpm = req.body.bpm;
    spo2 = req.body.spo2;
  }
  
  // إذا لم تنجح، جرب تحويل النص إلى JSON
  if ((!bpm || !spo2) && req.body && typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      bpm = parsed.bpm;
      spo2 = parsed.spo2;
    } catch(e) {}
  }
  
  if (!bpm || !spo2) {
    console.log('❌ فشل استخراج bpm/spo2');
    return res.status(400).json({ 
      status: 'error', 
      message: 'البيانات ناقصة!',
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
  
  if (readings.length > 1000) {
    readings = readings.slice(-1000);
  }

  console.log(`📊 [${newReading.timestamp}] BPM: ${bpm}, SpO2: ${spo2}%`);
  console.log(`📦 إجمالي القراءات: ${readings.length}`);

  res.status(200).json({ 
    status: 'success', 
    message: 'تم استلام البيانات بنجاح!',
    data: newReading
  });
});

// ========== استرجاع آخر القراءات ==========
app.get('/api/readings/latest', (req, res) => {
  if (readings.length === 0) {
    return res.status(200).json({ 
      status: 'success', 
      data: null,
      message: 'لا توجد قراءات بعد' 
    });
  }
  
  res.status(200).json({ 
    status: 'success', 
    data: readings[readings.length - 1] 
  });
});

// ========== استرجاع جميع القراءات ==========
app.get('/api/readings/all', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    count: readings.length,
    data: readings 
  });
});

// ========== نقطة صحية ==========
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'LivoCare API is running!',
    totalReadings: readings.length
  });
});

// ========== تشغيل الخادم ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ LivoCare API يعمل على المنفذ ${PORT}`);
  console.log(`📍 المسارات المتاحة:`);
  console.log(`   POST /api/readings - لإرسال بيانات جديدة`);
  console.log(`   GET  /api/readings/latest - لآخر قراءة`);
  console.log(`   GET  /api/readings/all - لجميع القراءات`);
  console.log(`   GET  /health - للتحقق من الحالة`);
});