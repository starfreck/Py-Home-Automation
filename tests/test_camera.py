"""Unit tests for OmniHome Edge Camera & Face Detection subsystem."""

import os
from pathlib import Path
import unittest

from edge.camera import EdgeCamera, HAS_OPENCV, FACE_CASCADE_PATH
from edge import config


class TestEdgeCamera(unittest.TestCase):
    """Test suite for EdgeCamera capture, detection, and configuration."""

    def setUp(self):
        self.cam = EdgeCamera(source=0, width=320, height=240, face_detection=True)

    def tearDown(self):
        self.cam.release()

    def test_camera_initialization(self):
        self.assertEqual(self.cam.width, 320)
        self.assertEqual(self.cam.height, 240)
        self.assertTrue(self.cam.face_detection_enabled)
        self.assertEqual(self.cam.cooldown_seconds, 5.0)

    def test_source_parsing(self):
        self.assertEqual(self.cam._parse_source("0"), 0)
        self.assertEqual(self.cam._parse_source(1), 1)
        self.assertEqual(self.cam._parse_source("/dev/video2"), 2)
        self.assertEqual(self.cam._parse_source("http://192.168.1.100/shot.jpg"), "http://192.168.1.100/shot.jpg")

    def test_model_files_exist(self):
        self.assertTrue(FACE_CASCADE_PATH.exists(), f"Cascade file missing at {FACE_CASCADE_PATH}")

    def test_capture_snapshot_structure(self):
        snap = self.cam.capture_snapshot(annotate=True, detect_faces=True)
        self.assertIn("id", snap)
        self.assertIn("timestamp", snap)
        self.assertIn("data_url", snap)
        self.assertIn("source", snap)
        self.assertIn("width", snap)
        self.assertIn("height", snap)
        self.assertIn("faces_count", snap)
        self.assertIn("face_detected", snap)
        self.assertTrue(snap["data_url"].startswith("data:image/jpeg;base64,"))

    def test_synthetic_fallback(self):
        self.cam.is_synthetic = True
        snap = self.cam.capture_snapshot()
        self.assertTrue(snap.get("is_synthetic"))
        self.assertEqual(snap["width"], 320)
        self.assertEqual(snap["height"], 240)

    def test_biometric_scan_structure(self):
        res = self.cam.scan_biometric(subject_name="Unit Tester")
        self.assertIn("success", res)
        self.assertIn("subject", res)
        self.assertIn("confidence", res)
        self.assertIn("threshold", res)
        self.assertIn("timestamp", res)

    def test_camera_config_storage(self):
        initial = config.get_camera_config()
        self.assertIn("source", initial)
        self.assertIn("face_detection", initial)

        config.update_camera_config({"source": "/dev/video1", "face_detection": False})
        updated = config.get_camera_config()
        self.assertEqual(updated["source"], "/dev/video1")
        self.assertFalse(updated["face_detection"])

        # Revert back
        config.update_camera_config({"source": "0", "face_detection": True})


if __name__ == "__main__":
    unittest.main()
