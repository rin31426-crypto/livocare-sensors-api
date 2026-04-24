// مثال: الاشتراك مع تحديد اللغة
const subscribe = async (userId, subscription, isArabic) => {
    const response = await fetch('https://notification-service.onrender.com/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            userId, 
            subscription, 
            lang: isArabic ? 'ar' : 'en' 
        })
    });
    return response.json();
};

// مثال: إرسال إشعار مع تحديد اللغة
const sendNotification = async (userId, title, body, isArabic) => {
    const response = await fetch(`https://notification-service.onrender.com/notify/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            title, 
            body, 
            lang: isArabic ? 'ar' : 'en' 
        })
    });
    return response.json();
};