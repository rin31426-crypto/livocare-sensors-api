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

// تخزين الاشتراكات مع اللغة
let subscriptions = {}; // { userId: [{ subscription, lang }] }

app.use(cors({
    origin: ['https://livocare-fronend.onrender.com', 'https://livocare.onrender.com', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ✅ مسار رئيسي
app.get('/', (req, res) => {
    res.json({
        service: 'Notification Service',
        status: 'running',
        version: '2.0.0',
        endpoints: ['/subscribe', '/unsubscribe', '/notify/:userId', '/notify/all', '/stats', '/health']
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ✅ حفظ اشتراك مستخدم مع اللغة
app.post('/subscribe', async (req, res) => {
    try {
        const { userId, subscription, lang } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }
        
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Invalid subscription data' });
        }
        
        if (!subscriptions[userId]) {
            subscriptions[userId] = [];
        }
        
        // تجنب التكرار (تحقق من endpoint)
        const exists = subscriptions[userId].some(s => s.subscription.endpoint === subscription.endpoint);
        if (!exists) {
            subscriptions[userId].push({
                subscription: subscription,
                lang: lang || 'ar'  // العربية افتراضياً
            });
        }
        
        console.log(`✅ Subscription saved for user ${userId} (lang: ${lang || 'ar'})`);
        res.json({ success: true, total: subscriptions[userId].length });
    } catch (error) {
        console.error('❌ Subscribe error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ✅ إزالة اشتراك
app.post('/unsubscribe', (req, res) => {
    try {
        const { userId, endpoint } = req.body;
        
        if (subscriptions[userId]) {
            subscriptions[userId] = subscriptions[userId].filter(s => s.subscription.endpoint !== endpoint);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ إرسال إشعار لمستخدم محدد (مع دعم اللغة)
app.post('/notify/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        let { title, body, icon, url, lang, title_ar, title_en, body_ar, body_en } = req.body;
        
        const userSubs = subscriptions[userId] || [];
        
        if (userSubs.length === 0) {
            return res.json({ success: true, message: 'No subscriptions', sent: 0 });
        }
        
        // إذا تم إرسال النصوص بلغتين محددتين
        const titleAr = title_ar || title;
        const titleEn = title_en || title;
        const bodyAr = body_ar || body;
        const bodyEn = body_en || body;
        
        // نصوص افتراضية بلغتين
        const defaultMessages = {
            ar: {
                title: '🔔 إشعار جديد',
                body: 'لديك إشعار جديد من LivoCare'
            },
            en: {
                title: '🔔 New Notification',
                body: 'You have a new notification from LivoCare'
            }
        };
        
        const results = [];
        
        // إرسال لكل اشتراك حسب لغته
        for (const userSub of userSubs) {
            const userLang = userSub.lang || 'ar';
            
            let finalTitle, finalBody;
            
            // اختيار اللغة المناسبة
            if (userLang === 'ar') {
                finalTitle = titleAr || defaultMessages.ar.title;
                finalBody = bodyAr || defaultMessages.ar.body;
            } else {
                finalTitle = titleEn || defaultMessages.en.title;
                finalBody = bodyEn || defaultMessages.en.body;
            }
            
            const payload = JSON.stringify({
                title: finalTitle,
                body: finalBody,
                icon: icon || 'https://livocare-fronend.onrender.com/logo192.png',
                url: url || '/dashboard'
            });
            
            try {
                await webpush.sendNotification(userSub.subscription, payload);
                results.push({ success: true, lang: userLang });
            } catch (e) {
                results.push({ success: false, lang: userLang, error: e.message });
                if (e.statusCode === 410) {
                    subscriptions[userId] = subscriptions[userId].filter(s => s.subscription.endpoint !== userSub.subscription.endpoint);
                }
            }
        }
        
        const sent = results.filter(r => r.success).length;
        res.json({ success: true, sent, total: userSubs.length, results });
    } catch (error) {
        console.error('❌ Notify error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ إرسال إشعار للجميع (مع دعم اللغة)
app.post('/notify/all', async (req, res) => {
    try {
        let { title_ar, title_en, body_ar, body_en, icon, url } = req.body;
        
        const userIds = Object.keys(subscriptions);
        let totalSent = 0;
        
        for (const userId of userIds) {
            const userSubs = subscriptions[userId] || [];
            
            for (const userSub of userSubs) {
                const userLang = userSub.lang || 'ar';
                
                let finalTitle, finalBody;
                
                if (userLang === 'ar') {
                    finalTitle = title_ar || '🔔 إشعار عام';
                    finalBody = body_ar || 'لديك إشعار جديد من LivoCare';
                } else {
                    finalTitle = title_en || '🔔 General Notification';
                    finalBody = body_en || 'You have a new notification from LivoCare';
                }
                
                const payload = JSON.stringify({
                    title: finalTitle,
                    body: finalBody,
                    icon: icon || 'https://livocare-fronend.onrender.com/logo192.png',
                    url: url || '/dashboard'
                });
                
                try {
                    await webpush.sendNotification(userSub.subscription, payload);
                    totalSent++;
                } catch (e) {
                    if (e.statusCode === 410) {
                        subscriptions[userId] = subscriptions[userId].filter(s => s.subscription.endpoint !== userSub.subscription.endpoint);
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
        stats[userId] = subs.map(s => ({ count: 1, lang: s.lang }));
    }
    
    res.json({
        totalUsers: Object.keys(subscriptions).length,
        totalSubscriptions: Object.values(subscriptions).reduce((a, b) => a + b.length, 0),
        details: stats
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Notification Service running on port ${PORT}`);
});