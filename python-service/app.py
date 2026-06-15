from flask import Flask, request, jsonify
from flask_cors import CORS
from utils.face_utils import extract_faces_from_url, compare_faces_against_encodings
import traceback

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'OK', 'service': 'face-recognition'})


@app.route('/extract-faces', methods=['POST'])
def extract_faces():
    """Extract face encodings from an image or video URL."""
    try:
        data       = request.get_json()
        media_url  = data.get('mediaUrl')
        media_type = data.get('mediaType', 'image')
        media_id   = data.get('mediaId')

        if not media_url:
            return jsonify({'success': False, 'message': 'mediaUrl required'}), 400

        # ✅ NEW: Validate media_type to prevent silent bugs from bad payloads
        if media_type not in ('image', 'video'):
            return jsonify({'success': False, 'message': "mediaType must be 'image' or 'video'"}), 400

        encodings = extract_faces_from_url(media_url, media_type)

        # ✅ NEW: Explicit warning when no faces are found — helps debug bad media
        if not encodings:
            return jsonify({
                'success':  False,
                'mediaId':  media_id,
                'message':  'No faces detected in the provided media.',
                'encodings': [],
                'count':    0,
            }), 422

        return jsonify({
            'success':   True,
            'mediaId':   media_id,
            'encodings': encodings,
            'count':     len(encodings),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/compare-faces', methods=['POST'])
def compare_faces():
    """Compare a selfie against all stored face encodings."""
    try:
        data             = request.get_json()
        selfie_url       = data.get('selfieUrl')
        stored_encodings = data.get('storedEncodings', [])
        tolerance        = 0.50  # Strict — eliminates false positives from similar-looking people

        if not selfie_url:
            return jsonify({'success': False, 'message': 'selfieUrl required'}), 400

        # ✅ NEW: Guard against empty encoding list — no point running comparison
        if not stored_encodings:
            return jsonify({
                'success':    True,
                'matchedIds': [],
                'matchCount': 0,
                'message':    'No stored encodings provided to compare against.',
            })

        # ✅ NEW: Validate each stored encoding has required fields before processing
        # Prevents cryptic numpy crashes deep inside face_utils
        for i, enc in enumerate(stored_encodings):
            if 'encoding' not in enc or not isinstance(enc['encoding'], list):
                return jsonify({
                    'success': False,
                    'message': f'Invalid encoding at index {i}: missing or malformed "encoding" field.'
                }), 400
            if len(enc['encoding']) != 128:
                return jsonify({
                    'success': False,
                    'message': f'Invalid encoding at index {i}: expected 128 dimensions, got {len(enc["encoding"])}.'
                }), 400

        matched_ids = compare_faces_against_encodings(
            selfie_url, stored_encodings, tolerance
        )

        return jsonify({
            'success':    True,
            'matchedIds': matched_ids,
            'matchCount': len(matched_ids),
        })

    except ValueError as e:
        # ✅ NEW: ValueError is raised by face_utils for known user-facing issues
        # (e.g. "No face detected in selfie") — return 422 not 500
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 422

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)