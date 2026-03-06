import io
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from deepface import DeepFace

app = FastAPI(title="Media Club AI Service")

# Initialize DeepFace model. We use "Facenet" which is highly accurate and good for embeddings.
# Other options: VGG-Face, OpenFace, DeepFace, DeepID, ArcFace, Dlib
MODEL_NAME = "Facenet512" 

@app.get("/")
def read_root():
    return {"message": "AI Face Recognition Service is running."}

@app.post("/extract")
async def extract_faces(file: UploadFile = File(...)):
    """
    Accepts an image file, detects all faces, and returns their embeddings.
    """
    try:
        # Read image to memory
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file format")

        # DeepFace extract_faces might throw ValueError if no face is found
        try:
            # We use extract_faces to get multiple faces and embeddings
            # Setting enforce_detection=False allows it to gracefully handle no-face images
            # Deepface represent returns embeddings.
            
            # represent returns a list of dictionaries per face found
            face_objs = DeepFace.represent(img_path=img, model_name=MODEL_NAME, enforce_detection=True)
            
            embeddings = []
            for face in face_objs:
                embed = face['embedding']
                box = face['facial_area'] # {x, y, w, h}
                embeddings.append({
                    "embedding": embed,
                    "box": box
                })
            
            return {"faces": embeddings, "count": len(embeddings)}

        except ValueError as ve:
            # Typically "Face could not be detected"
            return {"faces": [], "count": 0, "message": str(ve)}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
import os

class VideoRequest(BaseModel):
    video_path: str
    output_dir: str
    fps_rate: int = 1 # process 1 frame every second
    is_url: bool = False

class HighlightRequest(BaseModel):
    video_paths: list[str]
    output_path: str
    target_duration: int = 30
    is_url: bool = False

@app.post("/extract_video")
async def extract_video_faces(req: VideoRequest):
    """
    Reads a video file. If it's a URL, downloads it first.
    Extracts 1 frame every `fps_rate` seconds.
    Runs deepface.
    Saves cropped thumbnail.
    """
    try:
        import uuid
        import tempfile
        import requests
        
        video_source = req.video_path
        temp_video_path = None
        
        if req.is_url:
            print("Downloading remote video for processing:", video_source)
            ret = requests.get(video_source, stream=True)
            if ret.status_code == 200:
                fd, temp_video_path = tempfile.mkstemp(suffix=".mp4")
                with os.fdopen(fd, 'wb') as f:
                    for chunk in ret.iter_content(chunk_size=8192):
                        f.write(chunk)
                video_source = temp_video_path
            else:
                raise HTTPException(status_code=400, detail="Failed to download remote video")
        
        cap = cv2.VideoCapture(video_source)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Cannot open video file")

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps == 0 or np.isnan(fps):
            fps = 30.0

        frame_interval = int(fps * req.fps_rate) # e.g. 30 frames for 1 second
        
        frame_count = 0
        timestamp = 0.0
        
        faces_found = []

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process only 1 frame per interval
            if frame_count % frame_interval == 0:
                timestamp = frame_count / fps
                
                # Check for faces
                try:
                    # Enforce False so it doesn't throw if no face found
                    face_objs = DeepFace.represent(img_path=frame, model_name=MODEL_NAME, enforce_detection=False)
                    
                    for face in face_objs:
                        # Sometimes deepface returns a blank face array even if enforce_detection=False if none found. Let's check face confidence
                        if face.get('face_confidence', 0) > 0.8:
                            embed = face['embedding']
                            box = face['facial_area'] # {x, y, w, h}
                            
                            # Save a thumbnail 
                            # we can expand the box a bit for context
                            x, y, w, h = box['x'], box['y'], box['w'], box['h']
                            
                            # pad
                            pad_y = int(h * 0.4)
                            pad_x = int(w * 0.4)
                            
                            y1 = max(0, y - pad_y)
                            y2 = min(frame.shape[0], y + h + pad_y)
                            x1 = max(0, x - pad_x)
                            x2 = min(frame.shape[1], x + w + pad_x)
                            
                            thumb = frame[y1:y2, x1:x2]
                            
                            thumb_filename = f"thumb_{uuid.uuid4().hex[:8]}_{int(timestamp)}.jpg"
                            thumb_path = os.path.join(req.output_dir, thumb_filename)
                            
                            cv2.imwrite(thumb_path, thumb)
                            
                            faces_found.append({
                                "embedding": embed,
                                "box": box,
                                "timestamp": float(timestamp),
                                "thumbnail": f"/uploads/{thumb_filename}"
                            })
                            
                except ValueError:
                    pass
                except Exception as ex:
                    print("Frame extract err", ex)
            
            frame_count += 1
            
        cap.release()

        if temp_video_path and os.path.exists(temp_video_path):
            os.remove(temp_video_path)
            
        return {"faces": faces_found, "count": len(faces_found)}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/match")
async def match_face(request_data: dict):
    """
    Expects a source embedding and a list of target embeddings.
    Returns the similarities (Cosine Distance).
    """
    # This might be faster to implement in JS directly if we fetch all embeddings from MongoDB, 
    # but we will provide an endpoint here just in case.
    source = np.array(request_data.get("source_embedding"))
    targets = request_data.get("target_embeddings", []) # List of ID -> embedding
    
    threshold = 0.30 # For Facenet512 cosine distance, < 0.3 usually means same person

    matches = []
    
    for target in targets:
        t_emb = np.array(target["embedding"])
        
        # Calculate Cosine Distance
        a = source
        b = t_emb
        distance = 1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
        
        if distance < threshold:
            matches.append({
                "media_id": target["media_id"],
                "distance": float(distance)
            })

    # Sort matches by distance (lowest is best match)
    matches = sorted(matches, key=lambda x: x["distance"])

    return {"matches": matches}

@app.post("/cluster")
async def cluster_faces(request_data: dict):
    """
    Expects a list of embeddings.
    Returns grouped clusters.
    """
    try:
        from sklearn.cluster import DBSCAN
        
        embeddings = request_data.get("embeddings", [])
        if not embeddings:
            return {"clusters": []}
            
        X = np.array([e["embedding"] for e in embeddings])
        ids = [e["id"] for e in embeddings]
        
        # Facenet512 threshold is ~0.3 for cosine distance.
        db = DBSCAN(eps=0.30, min_samples=1, metric='cosine').fit(X)
        labels = db.labels_
        
        clusters_map = {}
        for label, emb, eid in zip(labels, X, ids):
            # scikit-learn assigns -1 to noise. If min_samples=1, there shouldn't be noise, but just in case.
            idx = int(label)
            if idx not in clusters_map:
                clusters_map[idx] = {"representative": emb.tolist(), "items": []}
            clusters_map[idx]["items"].append(eid)
            
        result = []
        for k, v in clusters_map.items():
            result.append({
                "cluster_id": k,
                "representative_embedding": v["representative"],
                "items": v["items"]
            })
            
        return {"clusters": result}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate_highlight")
async def generate_highlight(req: HighlightRequest):
    """
    Creates an event highlight reel from a list of video paths using OpenCV and FFmpeg.
    Detects activity/scene changes and extracts best clips.
    """
    try:
        import tempfile
        import uuid
        import subprocess

        temp_dir = tempfile.gettempdir()
        clip_files = []
        import requests
        
        for vpath in req.video_paths:
            video_source = vpath
            temp_video_path = None
            
            if req.is_url:
                ret = requests.get(video_source, stream=True)
                if ret.status_code == 200:
                    fd, temp_video_path = tempfile.mkstemp(suffix=".mp4")
                    with os.fdopen(fd, 'wb') as f:
                        for chunk in ret.iter_content(chunk_size=8192):
                            f.write(chunk)
                    video_source = temp_video_path
                else:
                    continue
            else:
                if not os.path.exists(vpath):
                    continue
                
            cap = cv2.VideoCapture(video_source)
            fps = cap.get(cv2.CAP_PROP_FPS)
            if fps == 0 or np.isnan(fps): fps = 30.0
            
            # Simple motion/scene scoring using OpenCV
            # We will evaluate 1 frame per second to score chunks
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            frame_interval = int(fps)
            
            highest_score = 0
            best_start_time = 0.0
            
            prev_gray = None
            frame_count = 0
            
            chunk_scores = {}
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                    
                if frame_count % frame_interval == 0:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    if prev_gray is not None:
                        # Calculate diff
                        diff = cv2.absdiff(gray, prev_gray)
                        score = np.sum(diff) / 255.0  # simple motion score
                        
                        timestamp = frame_count / fps
                        chunk_index = int(timestamp / 3) * 3 # group by 3 sec chunks
                        
                        if chunk_index not in chunk_scores:
                            chunk_scores[chunk_index] = 0
                        chunk_scores[chunk_index] += score
                        
                    prev_gray = gray
                    
                frame_count += 1
            
            cap.release()
            
            # Find chunk with highest motion/activity score
            if chunk_scores:
                best_chunk_start = max(chunk_scores, key=chunk_scores.get)
            else:
                best_chunk_start = 0
            
            clip_path = os.path.join(temp_dir, f"clip_{uuid.uuid4().hex[:8]}.mp4")
            
            # Extract 3-second best clip using ffmpeg
            cmd = [
                "ffmpeg", "-y", "-ss", str(best_chunk_start), "-i", video_source, 
                "-t", "3", "-c:v", "libx264", "-c:a", "aac", "-strict", "experimental", "-b:v", "1000k", "-r", "30", "-vf", "scale=1280:720", clip_path
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            if os.path.exists(clip_path):
                clip_files.append(clip_path)
                
            if temp_video_path and os.path.exists(temp_video_path):
                os.remove(temp_video_path)
                
        if not clip_files:
            raise HTTPException(status_code=400, detail="No suitable clips generated")
            
        # Create output dir if needed
        os.makedirs(os.path.dirname(req.output_path), exist_ok=True)
            
        # Concat clips
        list_path = os.path.join(temp_dir, f"list_{uuid.uuid4().hex[:8]}.txt")
        with open(list_path, "w") as f:
            for c in clip_files:
                c_clean = c.replace('\\', '/')
                f.write(f"file '{c_clean}'\n")
                
        # To avoid issues with different resolutions/codecs, we already scaled to 720p 30fps above.
        concat_cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path,
            "-c", "copy", req.output_path
        ]
        
        process = subprocess.run(concat_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if process.returncode != 0:
            print("FFMPEG CONCAT ERROR:", process.stderr.decode('utf-8'))
        
        # Cleanup
        try:
            os.remove(list_path)
            for c in clip_files:
                os.remove(c)
        except Exception as clex:
            print("Cleanup error:", clex)
            
        return {"success": True, "output_url": "/uploads/" + os.path.basename(req.output_path), "clips_combined": len(clip_files)}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# To run: uvicorn main:app --reload --port 8000
