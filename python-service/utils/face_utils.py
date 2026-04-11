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
    img = ImageOps.exif_transpose(img) # Correct rotation from EXIF data
    img = img.convert('RGB')
    
    # Rapidly resize to prevent memory and CPU spikes on high-res camera photos
    if max(img.size) > max_size:
        # thumbnail preserves aspect ratio and modifies in-place
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
    return np.array(img)


def extract_faces_from_image(image_array: np.ndarray) -> list:
    """Extract face encodings from a single image."""
    # Detect face locations with default upsample 1
    face_locations = face_recognition.face_locations(image_array, model='hog')
        
    # If no faces found, fallback to aggressive upsampling for distant/small faces
    if not face_locations:
        face_locations = face_recognition.face_locations(image_array, number_of_times_to_upsample=2, model='hog')

    if not face_locations:
        return []

    # Get 128-dimensional encodings, use num_jitters=5 for optimal accuracy/performance balance
    face_encodings = face_recognition.face_encodings(image_array, face_locations, num_jitters=5)

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

    all_encodings  = []
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
                faces     = extract_faces_from_image(rgb_frame)
                all_encodings.extend([f['encoding'] for f in faces])

            frame_count += 1

        cap.release()

        # Deduplicate: keep only encodings that are sufficiently different
        for enc in all_encodings:
            enc_array = np.array(enc)
            is_duplicate = any(
                face_recognition.face_distance([np.array(u)], enc_array)[0] < 0.4
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
    tolerance: float = 0.50 # Decreased tolerance for stricter accuracy
) -> list:
    """
    Compare selfie against all stored encodings.
    Returns list of {id, mediaId, distance} for matches.
    """
    selfie_image = download_image(selfie_url, max_size=800) # Selfies don't need high res
    
    selfie_locs  = face_recognition.face_locations(selfie_image, model='hog')

    if not selfie_locs:
        raise ValueError('No face detected in the uploaded selfie.')

    # Use num_jitters=10 for fast highly accurate selfie baseline mapping
    selfie_encodings = face_recognition.face_encodings(selfie_image, selfie_locs, num_jitters=10)
    if not selfie_encodings:
        raise ValueError('Could not encode the face in the selfie.')

    matched = []

    for stored in stored_encodings:
        stored_enc = np.array(stored['encoding'])
        best_distance = float('inf')
        is_match = False

        for selfie_enc in selfie_encodings:
            distance = face_recognition.face_distance([stored_enc], selfie_enc)[0]
            match = face_recognition.compare_faces([stored_enc], selfie_enc, tolerance=tolerance)[0]
            
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
                # Map Euclidean distance linearly respecting the dynamic tolerance threshold: 0.0 -> 100%, tolerance -> 50%
                'confidence': max(0.0, min(100.0, round(((tolerance - float(best_distance)) / tolerance) * 50.0 + 50.0, 1))),
            })

    # Sort by confidence (highest first)
    matched.sort(key=lambda x: x['distance'])
    return matched