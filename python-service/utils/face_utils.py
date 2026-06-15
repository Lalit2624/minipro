import face_recognition
import numpy as np
import requests
import tempfile
import os
import cv2
from PIL import Image, ImageOps
from io import BytesIO


def download_image(url: str, max_size: int = 1600) -> np.ndarray:
    """Download image from URL, resize if too large, correct EXIF orientation, and return as numpy array."""
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    img = Image.open(BytesIO(response.content))
    img = ImageOps.exif_transpose(img)
    img = img.convert('RGB')

    if max(img.size) > max_size:
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    img_array = np.array(img)

    # ✅ NEW: Normalize contrast using CLAHE on luminance channel
    # Improves encoding consistency under poor/varied lighting conditions
    lab = cv2.cvtColor(img_array, cv2.COLOR_RGB2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])
    img_array = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

    return img_array


def extract_faces_from_image(image_array: np.ndarray) -> list:
    """Extract face encodings from a single image."""
    # ✅ CHANGED: Use 'cnn' model — far superior detection for angled/partial/small faces
    face_locations = face_recognition.face_locations(image_array, model='cnn')

    # Fallback: HOG with upsampling if CNN finds nothing (edge case: very small faces)
    if not face_locations:
        face_locations = face_recognition.face_locations(
            image_array, number_of_times_to_upsample=2, model='hog'
        )

    if not face_locations:
        return []

    # ✅ CHANGED: num_jitters=15 — maximum practical accuracy for stored/reference faces
    # Each jitter randomly perturbs the face slightly before encoding,
    # producing a more robust averaged 128-d vector
    face_encodings = face_recognition.face_encodings(
        image_array, face_locations, num_jitters=15
    )

    results = []
    for encoding, location in zip(face_encodings, face_locations):
        top, right, bottom, left = location
        results.append({
            'encoding':     encoding.tolist(),
            'bounding_box': {'top': top, 'right': right, 'bottom': bottom, 'left': left},
        })
    return results


def extract_faces_from_video(video_url: str, sample_every_n_frames: int = 30) -> list:
    """Extract unique face encodings from a video by sampling frames."""
    response = requests.get(video_url, timeout=60, stream=True)
    response.raise_for_status()

    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
        for chunk in response.iter_content(chunk_size=8192):
            tmp.write(chunk)
        tmp_path = tmp.name

    all_encodings    = []
    unique_encodings = []

    try:
        cap = cv2.VideoCapture(tmp_path)
        frame_count = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_count % sample_every_n_frames == 0:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                # ✅ NEW: Apply CLAHE per video frame for lighting consistency
                lab = cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2LAB)
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                lab[:, :, 0] = clahe.apply(lab[:, :, 0])
                rgb_frame = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

                faces = extract_faces_from_image(rgb_frame)
                all_encodings.extend([f['encoding'] for f in faces])

            frame_count += 1

        cap.release()

        # ✅ CHANGED: Tighter dedup threshold (0.35 vs 0.4) — avoids treating
        # slightly different angles of the same face as unique identities
        for enc in all_encodings:
            enc_array = np.array(enc)
            is_duplicate = any(
                face_recognition.face_distance([np.array(u)], enc_array)[0] < 0.35
                for u in unique_encodings
            )
            if not is_duplicate:
                unique_encodings.append(enc)

    finally:
        os.unlink(tmp_path)

    return [{'encoding': enc, 'bounding_box': None} for enc in unique_encodings]


def extract_faces_from_url(media_url: str, media_type: str = 'image') -> list:
    """Main entry point to extract face encodings from a media URL."""
    if media_type == 'video':
        return extract_faces_from_video(media_url)
    else:
        image_array = download_image(media_url)
        return extract_faces_from_image(image_array)


def compare_faces_against_encodings(
    selfie_url: str,
    stored_encodings: list,
    tolerance: float = 0.50
) -> list:
    """
    Compare selfie against all stored encodings.
    Returns list of {id, mediaId, distance} for matches.
    """
    selfie_image = download_image(selfie_url, max_size=800)

    # ✅ CHANGED: Use 'cnn' for selfie detection — more robust for frontal close-ups
    selfie_locs = face_recognition.face_locations(selfie_image, model='cnn')

    # Fallback to HOG if CNN returns nothing
    if not selfie_locs:
        selfie_locs = face_recognition.face_locations(selfie_image, model='hog')

    if not selfie_locs:
        raise ValueError('No face detected in the uploaded selfie.')

    # ✅ CHANGED: num_jitters=20 for selfie — highest accuracy baseline
    # Selfies are compared against potentially hundreds of stored faces,
    # so a maximally accurate selfie encoding reduces false positives/negatives
    selfie_encodings = face_recognition.face_encodings(
        selfie_image, selfie_locs, num_jitters=20
    )
    if not selfie_encodings:
        raise ValueError('Could not encode the face in the selfie.')

    matched = []

    for stored in stored_encodings:
        stored_enc   = np.array(stored['encoding'])
        best_distance = float('inf')
        is_match      = False

        for selfie_enc in selfie_encodings:
            distance = face_recognition.face_distance([stored_enc], selfie_enc)[0]
            match    = face_recognition.compare_faces(
                [stored_enc], selfie_enc, tolerance=tolerance
            )[0]

            if match:
                is_match = True
                if distance < best_distance:
                    best_distance = distance

        if is_match:
            matched.append({
                'id':         stored['id'],
                'mediaId':    stored['mediaId'],
                'mediaUrl':   stored['mediaUrl'],
                'distance':   float(best_distance),
                'confidence': max(0.0, min(100.0, round(
                    ((tolerance - float(best_distance)) / tolerance) * 50.0 + 50.0, 1
                ))),
            })

    matched.sort(key=lambda x: x['distance'])
    return matched