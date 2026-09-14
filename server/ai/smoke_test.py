import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import cv2
import time
from datetime import datetime
from ai.real_providers import RealPlateDetector
from ai.config import PLATE_MODEL_PATH

def main():
    print("--- SMOKE TEST: YOLO26n License Plate Model ---")
    
    # 1. Initialize Model
    print(f"Loading model from: {PLATE_MODEL_PATH}...")
    start = time.time()
    detector = RealPlateDetector(model_path=PLATE_MODEL_PATH, device="cpu")
    print(f"Load time: {time.time() - start:.3f}s")
    
    if not detector.configured:
        print("ERROR: Model failed to load.")
        sys.exit(1)
        
    print("Classes mapping from Ultralytics:", detector.model.names if detector.model else "Unknown")
    
    # 2. Create Dummy Frame
    # To run a smoke test without a real image from datasets, we'll create a synthetic image that looks like a plate
    # or just use random noise to see if inference crashes. The prompt says "Use a suitable existing test image... if available."
    print("Running inference on dummy image...")
    dummy_image = cv2.imread("../datasets/sample.jpg") # try to load something
    if dummy_image is None:
        print("No test image found, using synthetic dummy frame.")
        dummy_image = (cv2.randn(np.zeros((640, 640, 3), dtype=np.uint8), 128, 64) if 'np' in globals() else None)
        if dummy_image is None:
             import numpy as np
             dummy_image = np.random.randint(0, 255, (640, 640, 3), dtype=np.uint8)

    # 3. Detect
    inf_start = time.time()
    result = detector.detect(dummy_image, "VEH-123", "CAM-1", datetime.now(), 1)
    inf_time = time.time() - inf_start
    
    print(f"Inference Time: {inf_time:.3f}s")
    if result:
        print(f"Detections: 1 (Class 0: license_plate)")
        print(f"Bbox: {result['bbox']}")
        print(f"Confidence: {result['plate_detection_confidence']:.4f}")
    else:
        print("Detections: 0 (Normal for random noise)")
        
if __name__ == "__main__":
    main()
