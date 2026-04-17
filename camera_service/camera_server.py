from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
from pyzbar.pyzbar import decode
import numpy as np
import base64
from PIL import Image
import io
import os
import sys

app = Flask(__name__)

# ✅ تكوين CORS بشكل صحيح
CORS(app, 
     origins=[
         'https://livocare-fronend.onrender.com',
         'https://livocare.onrender.com',
         'http://localhost:3000',
         'http://localhost:5173',
         'http://localhost:5000'
     ],
     methods=['GET', 'POST', 'OPTIONS', 'DELETE', 'PUT'],
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
     supports_credentials=True)

# ✅ معالجة CORS لجميع المسارات
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'https://livocare-fronend.onrender.com')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/', methods=['GET', 'OPTIONS'])
def index():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({
        'service': 'Camera Service',
        'status': 'running',
        'version': '1.0.0',
        'endpoints': ['/health', '/scan-barcode'],
        'libraries': {
            'opencv': cv2.__version__,
            'pyzbar': 'installed',
            'pillow': Image.__version__,
            'numpy': np.__version__
        }
    })

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({
        'status': 'ok',
        'service': 'camera-service',
        'timestamp': __import__('datetime').datetime.now().isoformat()
    })

@app.route('/scan-barcode', methods=['POST', 'OPTIONS'])
def scan_barcode():
    # ✅ معالجة preflight request
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # الحصول على البيانات
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': 'No JSON data provided'}), 400
        
        image_data = data.get('image', '')
        if not image_data:
            return jsonify({'success': False, 'message': 'No image data provided'}), 400
        
        # تنظيف بيانات base64
        if 'base64,' in image_data:
            image_data = image_data.split('base64,')[1]
        
        # تحويل base64 إلى صورة
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # تحويل PIL Image إلى numpy array (لـ OpenCV)
        frame = np.array(image)
        
        # تحويل RGB إلى BGR (لأن OpenCV يستخدم BGR)
        if len(frame.shape) == 3 and frame.shape[2] == 3:
            frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        
        # معالجة الصورة لتحسين اكتشاف الباركود
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # تطبيق تحسينات على الصورة
        _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
        
        # محاولة فك الباركود من الصورة الأصلية والصورة المحسنة
        results = []
        
        # مسح الصورة الأصلية
        decoded_objects = decode(frame)
        for obj in decoded_objects:
            results.append({
                'type': obj.type,
                'data': obj.data.decode('utf-8')
            })
        
        # إذا لم يتم العثور على باركود، جرب الصورة الرمادية
        if not results:
            decoded_objects = decode(gray)
            for obj in decoded_objects:
                results.append({
                    'type': obj.type,
                    'data': obj.data.decode('utf-8')
                })
        
        # إذا لم يتم العثور، جرب الصورة المحسنة
        if not results:
            decoded_objects = decode(thresh)
            for obj in decoded_objects:
                results.append({
                    'type': obj.type,
                    'data': obj.data.decode('utf-8')
                })
        
        if results:
            print(f"✅ Found {len(results)} barcode(s): {[r['data'] for r in results]}")
            return jsonify({
                'success': True,
                'results': results,
                'count': len(results)
            })
        else:
            return jsonify({
                'success': False,
                'message': 'No barcode found in image',
                'hint': 'Make sure the barcode is clearly visible and well-lit'
            }), 404
            
    except Exception as e:
        print(f"❌ Error in scan_barcode: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Internal server error'
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found',
        'available_endpoints': ['/', '/health', '/scan-barcode']
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    print(f"🚀 Starting Camera Service on port {port}")
    print(f"📍 Health check: http://0.0.0.0:{port}/health")
    print(f"📍 Scan endpoint: http://0.0.0.0:{port}/scan-barcode")
    app.run(host='0.0.0.0', port=port, debug=False)