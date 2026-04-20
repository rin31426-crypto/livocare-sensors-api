// services/notification-service.js
const express = require('express');
const cors = require('cors');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3003;

// VAPID Keys
const vapidKeys = {
    publicKey: 'BHlznz8R_5JWZ7C-JtA-kV60tNuqOU4vdW55C9p8iIhU6hJIHiJSH3SpkvYT_0HB81yj_P2Wv0IT5mG_YNmjf4E',
    privateKey: '_QIay_MCjUoCV8S_WPD6uSUuB9F-AMLpkNc445jDTxA'
};

webpush.setVapidDetails(
    'mailto:rin31426@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// ✅ CORS متقدم
app.use(cors({
    origin: ['https://livocare-fronend.onrender.com', 'https://livocare.onrender.com', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// تخزين الاشتراكات
let subscriptions = {};

// ✅ مسار رئيسي
app.get('/', (req, res) => {
    res.json({
        service: 'Notification Service',
        status: 'running',
        version: '2.0.0',
        endpoints: ['/subscribe', '/unsubscribe', '/notify/:userId', '/notify/all', '/stats', '/health']
    });
});

// ✅ مسار الصحة
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        subscriptions_count: Object.keys(subscriptions).length
    });
});

// ✅ حفظ اشتراك مستخدم (مع تحسين معالجة الأخطاء)
app.post('/subscribe', async (req, res) => {
    try {
        const { userId, subscription } = req.body;
        
        console.log('📨 Subscribe request:', { userId, hasSubscription: !!subscription });
        
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }
        
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Invalid subscription data' });
        }
        
        if (!subscriptions[userId]) {
            subscriptions[userId] = [];
        }
        
        // تجنب التكرار
        const exists = subscriptions[userId].some(s => s.endpoint === subscription.endpoint);
        if (!exists) {
            subscriptions[userId].push(subscription);
        }
        
        console.log(`✅ Subscription saved for user ${userId}, total: ${subscriptions[userId].length}`);
        res.json({ success: true, total: subscriptions[userId].length });
        
    } catch (error) {
        console.error('❌ Subscribe error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// ✅ إزالة اشتراك
app.post('/unsubscribe', (req, res) => {
    try {
        const { userId, endpoint } = req.body;
        
        if (subscriptions[userId]) {
            subscriptions[userId] = subscriptions[userId].filter(s => s.endpoint !== endpoint);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ إرسال إشعار لمستخدم محدد
app.post('/notify/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { title, body, icon, url } = req.body;
        
        const userSubs = subscriptions[userId] || [];
        
        if (userSubs.length === 0) {
            return res.json({ success: true, message: 'No subscriptions', sent: 0 });
        }
        
        const payload = JSON.stringify({
            title: title || 'LivoCare',
            body: body || 'لديك إشعار جديد',
            icon: icon || 'https://livocare-fronend.onrender.com/logo192.png',
            url: url || '/dashboard'
        });
        
        const results = await Promise.allSettled(
            userSubs.map(sub => webpush.sendNotification(sub, payload))
        );
        
        const sent = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        res.json({ success: true, sent, failed, total: userSubs.length });
        
    } catch (error) {
        console.error('❌ Notify error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ إرسال إشعار للجميع
app.post('/notify/all', async (req, res) => {
    try {
        const { title, body, icon, url } = req.body;
        const userIds = Object.keys(subscriptions);
        let totalSent = 0;
        
        const payload = JSON.stringify({
            title: title || 'LivoCare',
            body: body || 'لديك إشعار جديد',
            icon: icon || 'https://livocare-fronend.onrender.com/logo192.png',
            url: url || '/dashboard'
        });
        
        for (const userId of userIds) {
            const userSubs = subscriptions[userId] || [];
            for (const sub of userSubs) {
                try {
                    await webpush.sendNotification(sub, payload);
                    totalSent++;
                } catch (e) {
                    if (e.statusCode === 410) {
                        subscriptions[userId] = subscriptions[userId].filter(s => s.endpoint !== sub.endpoint);
                    }
                }
            }
        }
        
        res.json({ success: true, sent: totalSent, users: userIds.length });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ إحصائيات
app.get('/stats', (req, res) => {
    const stats = {};
    for (const [userId, subs] of Object.entries(subscriptions)) {
        stats[userId] = subs.length;
    }
    
    res.json({
        totalUsers: Object.keys(subscriptions).length,
        totalSubscriptions: Object.values(subscriptions).reduce((a, b) => a + b.length, 0),
        details: stats
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Notification Service running on port ${PORT}`);
    console.log(`📱 VAPID Public Key: ${vapidKeys.publicKey.substring(0, 30)}...`);
});