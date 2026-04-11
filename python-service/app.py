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
        media_type = data.get('mediaType', 'image')  # 'image' or 'video'
        media_id   = data.get('mediaId')

        if not media_url:
            return jsonify({'success': False, 'message': 'mediaUrl required'}), 400

        encodings = extract_faces_from_url(media_url, media_type)

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
        # Hardcode strict tolerance to 0.50 to completely eliminate false positives from similar-looking people.
        # This overrides the stale 0.60 sent by Node if the user hasn't restarted the backend.
        tolerance        = 0.50

        if not selfie_url:
            return jsonify({'success': False, 'message': 'selfieUrl required'}), 400

        matched_ids = compare_faces_against_encodings(
            selfie_url, stored_encodings, tolerance
        )

        return jsonify({
            'success':    True,
            'matchedIds': matched_ids,
            'matchCount': len(matched_ids),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)