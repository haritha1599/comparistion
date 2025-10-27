from flask import Flask, request, render_template, jsonify, send_from_directory
from PIL import Image
import io, os, base64
import numpy as np
import cv2
import imagehash
from skimage.color import rgb2gray

app = Flask(__name__, template_folder='templates', static_folder='static')

# in-memory store for results (simple demo)
STORE = {}

def read_image(file_storage):
    img = Image.open(file_storage.stream).convert('RGB')
    return np.array(img)

def mean_rgb(arr):
    return list(np.mean(arr.reshape(-1,3), axis=0))

def colorfulness(img):
    # Hasler & Suesstrunk
    R = img[:,:,0].astype('float')
    G = img[:,:,1].astype('float')
    B = img[:,:,2].astype('float')
    rg = np.abs(R-G)
    yb = np.abs(0.5*(R+G)-B)
    stdRoot = np.sqrt(np.std(rg)**2 + np.std(yb)**2)
    meanRoot = np.sqrt(np.mean(rg)**2 + np.mean(yb)**2)
    return stdRoot + 0.3*meanRoot

def grayscale_hist(img, bins=16):
    g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    h, _ = np.histogram(g, bins=bins, range=(0,256))
    h = h.astype('float')
    if h.sum()>0: h /= h.sum()
    return list(np.round(h,3))

def orb_keypoints_count(img):
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    orb = cv2.ORB_create()
    kps = orb.detect(gray, None)
    return len(kps)

def phash_str(img_pil):
    return str(imagehash.phash(img_pil))

def phash_similarity(h1, h2):
    # normalized similarity 0..1 where 1 is identical
    # h1,h2 are imagehash.ImageHash or hex strings
    try:
        hd = imagehash.hex_to_hash(h1) - imagehash.hex_to_hash(h2)
    except Exception:
        hd = 64
    maxd = 64
    return 1.0 - (hd / maxd)

def compute_features(file_storage):
    img_arr = read_image(file_storage)
    img_pil = Image.open(file_storage.stream)
    # Note: file_storage.stream has been read; reopen from bytes
    file_storage.stream.seek(0)
    img_pil = Image.open(file_storage.stream).convert('RGB')

    feats = {}
    feats['mean_rgb'] = mean_rgb(img_arr)
    feats['colorfulness'] = float(colorfulness(img_arr))
    feats['hist'] = grayscale_hist(img_arr, bins=16)
    feats['orb_count'] = orb_keypoints_count(img_arr)
    feats['phash'] = phash_str(img_pil)
    return feats, img_pil

def image_to_base64(img_pil):
    buf = io.BytesIO()
    img_pil.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('ascii')

def compute_similarity(fa, fb):
    # Weighted: phash 0.5, histogram corr 0.3, ORB ratio 0.2
    ph = phash_similarity(fa['phash'], fb['phash'])
    # histogram correlation using numpy corrcoef
    h1 = np.array(fa['hist']); h2 = np.array(fb['hist'])
    if h1.std()==0 or h2.std()==0:
        hist_corr = 0.0
    else:
        hist_corr = float(np.corrcoef(h1,h2)[0,1])
        hist_corr = max(0.0, min(1.0, (hist_corr+1)/2))

    # ORB: compare counts ratio
    orb_ratio = min(fa['orb_count'], fb['orb_count']) / max(1, max(fa['orb_count'], fb['orb_count']))

    score = 0.5*ph + 0.3*hist_corr + 0.2*orb_ratio
    return float(score)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/compare', methods=['POST'])
def compare():
    if 'imageA' not in request.files or 'imageB' not in request.files:
        return jsonify({'error':'missing images'}), 400

    a = request.files['imageA']
    b = request.files['imageB']

    featsA, pilA = compute_features(a)
    # reset stream pointer then compute for B
    a.stream.seek(0)
    featsB, pilB = compute_features(b)

    score = compute_similarity(featsA, featsB)
    label = 1 if score >= 0.6 else 0

    rid = base64.urlsafe_b64encode(os.urandom(6)).decode('ascii')
    STORE[rid] = {
        'featuresA': featsA,
        'featuresB': featsB,
        'score': score,
        'label': label,
        'imageA': image_to_base64(pilA),
        'imageB': image_to_base64(pilB)
    }

    return jsonify({'id': rid})

@app.route('/results', methods=['GET'])
def results():
    rid = request.args.get('id')
    if not rid or rid not in STORE:
        return jsonify({'error':'unknown id'}), 404
    # return JSON for the frontend
    return jsonify(STORE[rid])

if __name__=='__main__':
    app.run(debug=True)
