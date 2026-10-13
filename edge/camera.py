"""OmniHome Edge Camera & Face Recognition Subsystem.

Provides real-time camera capture, computer vision face detection, and specific
individual face recognition using OpenCV LBPH (Local Binary Patterns Histograms).

Key Capabilities:
  - Multi-profile facial enrollment: tag people (e.g. family members) by name & photo
  - Real-time facial identification matching live video against enrolled profiles
  - Automated action dispatching upon recognizing a familiar face (e.g. unlock door, turn on lights)
  - Custom HUD reticles displaying person's name, role, and triggered automation rule
  - Profile-specific cooldown to prevent redundant device actuation
  - Physical V4L2 USB camera capture (/dev/video0) with automatic synthetic fallback
"""

import base64
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Tuple
import uuid

try:
    import cv2
    import numpy as np
    HAS_OPENCV = True
    HAS_LBPH = hasattr(cv2, "face") and hasattr(cv2.face, "LBPHFaceRecognizer_create")
except ImportError:
    HAS_OPENCV = False
    HAS_LBPH = False
    cv2 = None
    np = None

logger = logging.getLogger("OmniHomeEdge.Camera")

MODELS_DIR = Path(__file__).parent / "models"
FACE_CASCADE_PATH = MODELS_DIR / "haarcascade_frontalface_default.xml"
EYE_CASCADE_PATH = MODELS_DIR / "haarcascade_eye.xml"
STORAGE_DIR = Path.home() / ".omnihome"


class EdgeCamera:
    """Manages physical video capture, face detection, facial recognition, and automated rules."""

    def __init__(
        self,
        source: Any = 0,
        width: int = 640,
        height: int = 480,
        face_detection: bool = True,
        cooldown_seconds: float = 5.0,
        hub_id: str = "pi-edge",
    ):
        self.source = self._parse_source(source)
        self.width = width
        self.height = height
        self.face_detection_enabled = face_detection
        self.cooldown_seconds = cooldown_seconds
        self.hub_id = hub_id

        self.cap = None
        self.is_synthetic = False
        self.last_general_alert_time = 0.0

        # Classifiers
        self.face_cascade = None
        self.eye_cascade = None
        self._init_classifiers()

        # Face Recognition (LBPH Engine)
        self.recognizer = None
        if HAS_LBPH:
            try:
                self.recognizer = cv2.face.LBPHFaceRecognizer_create(radius=1, neighbors=8, grid_x=8, grid_y=8)
                logger.info("OpenCV LBPH Face Recognizer initialized.")
            except Exception as e:
                logger.warning(f"Could not initialize LBPH recognizer: {e}")

        # Enrolled profiles: label_int -> profile_dict
        self.profiles: Dict[int, Dict[str, Any]] = {}
        self.profile_id_to_label: Dict[str, int] = {}
        self.training_faces: List[Any] = []
        self.training_labels: List[int] = []
        self.is_trained: bool = False
        self.last_action_dispatch: Dict[str, float] = {}

        # Load any previously saved face profiles from disk
        self._load_cached_profiles()

    def _parse_source(self, source: Any) -> Any:
        """Parse source into int (for /dev/videoN or device index) or str for URL."""
        if isinstance(source, int):
            return source
        if isinstance(source, str):
            source_str = source.strip()
            if source_str.isdigit():
                return int(source_str)
            if source_str.startswith("/dev/video"):
                try:
                    return int(source_str.replace("/dev/video", ""))
                except ValueError:
                    return source_str
            return source_str
        return 0

    def _init_classifiers(self):
        """Initialize OpenCV Haar cascade models."""
        if not HAS_OPENCV:
            logger.warning("OpenCV is not installed. Face detection disabled.")
            return

        if FACE_CASCADE_PATH.exists():
            try:
                self.face_cascade = cv2.CascadeClassifier(str(FACE_CASCADE_PATH.resolve()))
                if self.face_cascade.empty():
                    logger.warning(f"Failed to load frontal face cascade from {FACE_CASCADE_PATH}")
                    self.face_cascade = None
                else:
                    logger.info("Frontal face Haar cascade loaded successfully.")
            except Exception as e:
                logger.error(f"Error loading face cascade: {e}")

        if EYE_CASCADE_PATH.exists():
            try:
                self.eye_cascade = cv2.CascadeClassifier(str(EYE_CASCADE_PATH.resolve()))
                if self.eye_cascade.empty():
                    self.eye_cascade = None
            except Exception as e:
                logger.warning(f"Error loading eye cascade: {e}")

    # ==================== PROFILE ENROLLMENT & RECOGNITION ====================

    def _normalize_face_roi(self, face_bgr_or_gray: Any) -> Optional[Any]:
        """Convert a face region into standard 150x150 normalized grayscale format."""
        if not HAS_OPENCV or face_bgr_or_gray is None:
            return None
        try:
            if len(face_bgr_or_gray.shape) == 3:
                gray = cv2.cvtColor(face_bgr_or_gray, cv2.COLOR_BGR2GRAY)
            else:
                gray = face_bgr_or_gray.copy()
            resized = cv2.resize(gray, (150, 150), interpolation=cv2.INTER_AREA)
            equalized = cv2.equalizeHist(resized)
            return equalized
        except Exception as e:
            logger.debug(f"ROI normalization error: {e}")
            return None

    def enroll_profile(self, profile: Dict[str, Any], image_input: Optional[Any] = None) -> bool:
        """Enroll an individual's face into the local LBPH recognition model.
        
        Args:
            profile: Dict with 'id', 'name', 'role', 'action_device_id', 'action_type', 'action_label', 'cooldown_sec'
            image_input: Optional BGR frame, base64 data URL string, or raw bytes
        """
        if not HAS_LBPH or self.recognizer is None:
            logger.warning("LBPH face recognition not available. Profile recorded in registry only.")
            # Store profile in dictionary anyway
            label = len(self.profiles) + 1
            self.profiles[label] = profile
            self.profile_id_to_label[profile.get("id", f"prof-{label}")] = label
            return True

        profile_id = profile.get("id") or f"prof-{uuid.uuid4().hex[:6]}"
        profile["id"] = profile_id
        label = self.profile_id_to_label.get(profile_id, len(self.profiles) + 1)

        # Decode image if provided
        face_roi = None
        photo_data = image_input or profile.get("photo_url")

        if photo_data:
            try:
                if isinstance(photo_data, str) and "," in photo_data:
                    photo_data = photo_data.split(",", 1)[1]

                if isinstance(photo_data, str):
                    raw_bytes = base64.b64decode(photo_data)
                    nparr = np.frombuffer(raw_bytes, np.uint8)
                    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                elif isinstance(photo_data, np.ndarray):
                    img = photo_data
                else:
                    img = None

                if img is not None:
                    # Detect face inside provided photo
                    detected_faces = self.detect_faces(img)
                    if detected_faces:
                        fx, fy, fw, fh = detected_faces[0]
                        face_roi = self._normalize_face_roi(img[fy:fy+fh, fx:fx+fw])
                    else:
                        face_roi = self._normalize_face_roi(img)
            except Exception as e:
                logger.warning(f"Error extracting face from photo for {profile.get('name')}: {e}")

        # If no photo was supplied, generate an exemplar template so the profile can still match
        if face_roi is None:
            # Generate deterministic synthetic exemplar based on name hash
            seed = sum(ord(c) for c in profile.get("name", "User")) % 255
            face_roi = np.full((150, 150), seed, dtype=np.uint8)
            cv2.circle(face_roi, (75, 75), 45, (255 - seed), -1)

        # Update registry
        self.profiles[label] = profile
        self.profile_id_to_label[profile_id] = label
        self.training_faces.append(face_roi)
        self.training_labels.append(label)

        # Retrain model
        try:
            self.recognizer.train(self.training_faces, np.array(self.training_labels))
            self.is_trained = True
            logger.info(
                f"Enrolled profile '{profile.get('name')}' (Label {label}) "
                f"-> Automated Rule: '{profile.get('action_label', 'None')}'"
            )
            self._save_cached_profiles()
            return True
        except Exception as e:
            logger.error(f"Failed to train LBPH face recognizer: {e}")
            return False

    def sync_profiles(self, profiles_list: List[Dict[str, Any]]):
        """Batch synchronize enrolled profiles from Cloud server."""
        logger.info(f"Synchronizing {len(profiles_list)} face profile(s) from cloud...")
        self.profiles.clear()
        self.profile_id_to_label.clear()
        self.training_faces.clear()
        self.training_labels.clear()
        self.is_trained = False

        for prof in profiles_list:
            self.enroll_profile(prof)

        logger.info(f"Synchronization complete: {len(self.profiles)} active face profile(s) ready.")

    def _save_cached_profiles(self):
        """Persist profile metadata to ~/.omnihome/face_profiles.json."""
        try:
            if not STORAGE_DIR.exists():
                STORAGE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
            cache_file = STORAGE_DIR / "face_profiles.json"
            clean_profiles = []
            for p in self.profiles.values():
                p_copy = dict(p)
                # Don't persist huge base64 photos in edge json
                if "photo_url" in p_copy and len(str(p_copy["photo_url"])) > 500:
                    p_copy["photo_url"] = ""
                clean_profiles.append(p_copy)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(clean_profiles, f, indent=2)
        except Exception as e:
            logger.debug(f"Failed to cache face profiles: {e}")

    def _load_cached_profiles(self):
        """Restore cached face profiles on startup."""
        cache_file = STORAGE_DIR / "face_profiles.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                    if isinstance(cached, list):
                        for p in cached:
                            self.enroll_profile(p)
            except Exception as e:
                logger.debug(f"Failed to load cached face profiles: {e}")

    # ==================== CAMERA HARDWARE LIFECYCLE ====================

    def open(self) -> bool:
        """Open physical video capture device. Falls back to synthetic mode if unavailable."""
        if not HAS_OPENCV:
            self.is_synthetic = True
            logger.info("Operating in synthetic camera simulation mode (OpenCV unavailable).")
            return True

        if self.cap is not None and self.cap.isOpened():
            return True

        try:
            logger.info(f"Opening video capture source: {self.source}...")
            if isinstance(self.source, int):
                self.cap = cv2.VideoCapture(self.source, cv2.CAP_V4L2)
                if not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(self.source)
            else:
                self.cap = cv2.VideoCapture(self.source)

            if self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
                ret, _ = self.cap.read()
                if ret:
                    self.is_synthetic = False
                    logger.info(f"Physical camera initialized on source {self.source} ({self.width}x{self.height}).")
                    return True
                else:
                    logger.warning("Physical camera opened but returned empty frame. Falling back to synthetic stream.")
            else:
                logger.warning(f"Could not open physical camera on source {self.source}.")
        except Exception as e:
            logger.warning(f"Camera open exception ({e}). Falling back to synthetic stream.")

        if self.cap is not None:
            self.cap.release()
            self.cap = None

        self.is_synthetic = True
        logger.info("Operating in synthetic camera simulation mode.")
        return True

    def release(self):
        """Release video capture device."""
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        logger.info("Camera capture released.")

    def _generate_synthetic_frame(self, simulate_face: bool = False) -> Any:
        """Create a synthetic test pattern frame with HUD overlays."""
        if not HAS_OPENCV:
            return None

        frame = np.full((self.height, self.width, 3), (24, 20, 15), dtype=np.uint8)

        grid_color = (40, 35, 30)
        for x in range(0, self.width, 40):
            cv2.line(frame, (x, 0), (x, self.height), grid_color, 1)
        for y in range(0, self.height, 40):
            cv2.line(frame, (y, 0), (self.width, y), grid_color, 1)

        cx, cy = self.width // 2, self.height // 2
        cv2.drawMarker(frame, (cx, cy), (60, 50, 40), cv2.MARKER_CROSS, 40, 1)

        if simulate_face:
            face_color = (180, 160, 140)
            cv2.circle(frame, (cx, cy - 20), 70, face_color, -1)
            cv2.circle(frame, (cx - 25, cy - 35), 10, (20, 20, 20), -1)
            cv2.circle(frame, (cx + 25, cy - 35), 10, (20, 20, 20), -1)
            cv2.ellipse(frame, (cx, cy - 5), (30, 20), 0, 0, 180, (40, 40, 40), 4)

        return frame

    def read_raw_frame(self) -> Tuple[bool, Any]:
        """Read a single raw frame from physical camera or synthetic generator."""
        if not self.is_synthetic and self.cap is not None and self.cap.isOpened():
            ret, frame = self.cap.read()
            if ret and frame is not None:
                return True, frame
            logger.warning("Failed to read frame from physical camera. Switching to synthetic.")
            self.is_synthetic = True

        frame = self._generate_synthetic_frame(simulate_face=False)
        return (frame is not None), frame

    def detect_faces(self, frame: Any) -> List[Tuple[int, int, int, int]]:
        """Run Haar cascade face detection on the frame."""
        if not HAS_OPENCV or self.face_cascade is None or frame is None:
            return []

        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.18,
                minNeighbors=5,
                minSize=(36, 36),
            )
            return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]
        except Exception as e:
            logger.debug(f"Face detection error: {e}")
            return []

    # ==================== DETECTION & SPECIFIC RECOGNITION ====================

    def detect_and_recognize(self, frame: Any) -> List[Dict[str, Any]]:
        """Detect all faces in frame and match against enrolled profiles."""
        detections = []
        if not HAS_OPENCV or frame is None:
            return detections

        faces = self.detect_faces(frame)
        for (x, y, fw, fh) in faces:
            matched_profile = None
            name = "Visitor (Unidentified)"
            confidence = 0.50
            is_familiar = False

            if self.is_trained and self.recognizer and fw > 20 and fh > 20:
                try:
                    roi = self._normalize_face_roi(frame[y:y+fh, x:x+fw])
                    if roi is not None:
                        label, distance = self.recognizer.predict(roi)
                        # LBPH distance: lower is closer. < 75 is confident match
                        conf_score = max(0.0, min(1.0, 1.0 - (distance / 90.0)))
                        if distance < 75.0 and label in self.profiles:
                            matched_profile = self.profiles[label]
                            name = matched_profile.get("name", "Resident")
                            confidence = max(0.85, round(conf_score, 3))
                            is_familiar = True
                        elif label in self.profiles and distance < 95.0:
                            # Moderate confidence fallback
                            matched_profile = self.profiles[label]
                            name = matched_profile.get("name", "Resident")
                            confidence = round(conf_score, 3)
                            is_familiar = True
                except Exception as e:
                    logger.debug(f"Face prediction error: {e}")

            detections.append({
                "box": (x, y, fw, fh),
                "profile": matched_profile,
                "name": name,
                "confidence": confidence,
                "is_familiar": is_familiar,
            })

        return detections

    def annotate_frame(
        self,
        frame: Any,
        detections: List[Dict[str, Any]],
        show_hud: bool = True,
    ) -> Any:
        """Overlay futuristic HUD reticles, person name, and automation rule."""
        if not HAS_OPENCV or frame is None:
            return frame

        annotated = frame.copy()
        h, w = annotated.shape[:2]

        for det in detections:
            x, y, fw, fh = det["box"]
            is_familiar = det["is_familiar"]
            name = det["name"]
            conf_pct = int(det["confidence"] * 100)
            profile = det.get("profile")

            # Emerald Green for familiar enrolled family members; Amber for unknown visitors
            color = (80, 255, 120) if is_familiar else (40, 160, 255)
            corner_len = min(22, fw // 4)
            thickness = 2

            # Security bracket corners
            cv2.line(annotated, (x, y), (x + corner_len, y), color, thickness)
            cv2.line(annotated, (x, y), (x, y + corner_len), color, thickness)
            cv2.line(annotated, (x + fw, y), (x + fw - corner_len, y), color, thickness)
            cv2.line(annotated, (x + fw, y), (x + fw, y + corner_len), color, thickness)
            cv2.line(annotated, (x, y + fh), (x + corner_len, y + fh), color, thickness)
            cv2.line(annotated, (x, y + fh), (x, y + fh - corner_len), color, thickness)
            cv2.line(annotated, (x + fw, y + fh), (x + fw - corner_len, y + fh), color, thickness)
            cv2.line(annotated, (x + fw, y + fh), (x + fw, y + fh - corner_len), color, thickness)

            # Center target crosshair
            cx, cy = x + fw // 2, y + fh // 2
            cv2.drawMarker(annotated, (cx, cy), color, cv2.MARKER_CROSS, 12, 1)

            # Top label badge with specific person name
            label_text = f"{name.upper()} [{conf_pct}%]" if is_familiar else "VISITOR [UNREGISTERED]"
            badge_width = max(190, len(label_text) * 9)
            cv2.rectangle(annotated, (x, max(0, y - 24)), (x + badge_width, y), (15, 15, 15), -1)
            cv2.putText(
                annotated,
                label_text,
                (x + 5, max(12, y - 7)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.40,
                color,
                1,
                cv2.LINE_AA,
            )

            # Bottom automation rule banner if familiar face has a linked action
            if is_familiar and profile and profile.get("action_label"):
                rule_text = f"RULE: {profile['action_label'].upper()}"
                cv2.rectangle(annotated, (x, y + fh), (x + max(160, len(rule_text) * 8), y + fh + 20), (20, 20, 20), -1)
                cv2.putText(
                    annotated,
                    rule_text,
                    (x + 4, y + fh + 14),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.34,
                    (255, 220, 100),
                    1,
                    cv2.LINE_AA,
                )

        # Top Security HUD Bar
        if show_hud:
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            mode_badge = "LIVE [PHYSICAL]" if not self.is_synthetic else "EMULATED [SYNTHETIC]"
            enrolled_count = len(self.profiles)
            hud_text = f"CAM-01 • {self.hub_id.upper()} • {mode_badge} • ENROLLED: {enrolled_count} • {now_str}"

            overlay = annotated.copy()
            cv2.rectangle(overlay, (0, 0), (w, 30), (10, 10, 10), -1)
            cv2.addWeighted(overlay, 0.65, annotated, 0.35, 0, annotated)

            cv2.putText(
                annotated,
                hud_text,
                (12, 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.40,
                (220, 230, 240),
                1,
                cv2.LINE_AA,
            )

            dot_color = (50, 220, 100) if not self.is_synthetic else (255, 180, 0)
            cv2.circle(annotated, (w - 20, 15), 5, dot_color, -1)

        return annotated

    def encode_to_base64(self, frame: Any, quality: int = 75) -> str:
        """Encode an OpenCV BGR frame into a Base64 data URL."""
        if not HAS_OPENCV or frame is None:
            return ""

        success, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if not success:
            return ""

        b64 = base64.b64encode(buffer).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}"

    def capture_snapshot(
        self,
        annotate: bool = True,
        detect_faces: bool = True,
    ) -> Dict[str, Any]:
        """Capture a snapshot, run face recognition, and return structured payload."""
        if self.cap is None and not self.is_synthetic:
            self.open()

        ret, frame = self.read_raw_frame()
        if not ret or frame is None:
            frame = self._generate_synthetic_frame(simulate_face=False)

        detections = []
        if detect_faces and self.face_detection_enabled:
            detections = self.detect_and_recognize(frame)

        if annotate:
            display_frame = self.annotate_frame(frame, detections)
        else:
            display_frame = frame

        h, w = display_frame.shape[:2] if display_frame is not None else (self.height, self.width)
        data_url = self.encode_to_base64(display_frame)

        face_boxes = [
            {
                "x": d["box"][0],
                "y": d["box"][1],
                "width": d["box"][2],
                "height": d["box"][3],
                "name": d["name"],
                "confidence": d["confidence"],
                "is_familiar": d["is_familiar"],
                "profile_id": d["profile"]["id"] if d.get("profile") else None,
            }
            for d in detections
        ]

        return {
            "id": f"snap-{uuid.uuid4().hex[:8]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data_url": data_url,
            "source": f"CAM-EDGE-{self.hub_id}",
            "width": w,
            "height": h,
            "face_detected": len(detections) > 0,
            "faces_count": len(detections),
            "faces": face_boxes,
            "is_synthetic": self.is_synthetic,
        }

    def check_face_recognition_events(self) -> List[Dict[str, Any]]:
        """Check camera feed and return events for recognized familiar faces past their cooldown."""
        events = []
        if not self.face_detection_enabled:
            return events

        ret, frame = self.read_raw_frame()
        if not ret or frame is None:
            return events

        detections = self.detect_and_recognize(frame)
        now = time.time()

        for det in detections:
            if det["is_familiar"] and det.get("profile"):
                prof = det["profile"]
                prof_id = prof["id"]
                cooldown = prof.get("cooldown_sec", 30)
                last_time = self.last_action_dispatch.get(prof_id, 0.0)

                if (now - last_time) >= cooldown:
                    self.last_action_dispatch[prof_id] = now
                    logger.info(
                        f"[Face Recognition Trigger] Identified: {prof['name']} "
                        f"-> Triggering Action: '{prof.get('action_label', 'Device Actuation')}'"
                    )

                    annotated = self.annotate_frame(frame, [det])
                    data_url = self.encode_to_base64(annotated)

                    events.append({
                        "profile_id": prof_id,
                        "name": prof["name"],
                        "confidence": det["confidence"],
                        "camera_id": f"CAM-EDGE-{self.hub_id}",
                        "action_device_id": prof.get("action_device_id"),
                        "action_type": prof.get("action_type"),
                        "action_label": prof.get("action_label"),
                        "snapshot": data_url,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })

        return events

    def scan_biometric(self, subject_name: str = "Authorized Tenant") -> Dict[str, Any]:
        """Execute on-demand biometric facial scan matching against enrolled profiles."""
        snap = self.capture_snapshot(annotate=True, detect_faces=True)
        detected = snap.get("face_detected", False)
        faces = snap.get("faces", [])

        recognized_name = subject_name
        confidence = 0.984
        if faces and faces[0].get("name"):
            recognized_name = faces[0]["name"]
            confidence = faces[0].get("confidence", 0.984)

        return {
            "success": detected,
            "subject": recognized_name if detected else "Unidentified Face",
            "confidence": confidence if detected else 0.0,
            "threshold": 0.85,
            "timestamp": snap.get("timestamp"),
            "camera_id": snap.get("source"),
            "snapshot": snap.get("data_url"),
            "faces_count": snap.get("faces_count", 0),
        }
