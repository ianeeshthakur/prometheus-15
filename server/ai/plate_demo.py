import sys
import os
import argparse
import time
from pathlib import Path

# Fix python path so it can import from `ai` package if run from repo root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    import cv2
except ImportError:
    print("ERROR: cv2 module not found. Please install opencv-python-headless.")
    sys.exit(1)

from ai.quality import FrameQualityAnalyzer
from ai.schemas import FrameQuality

def main():
    parser = argparse.ArgumentParser(description="REAL License Plate Detection Demo")
    parser.add_argument("image", help="Path to input image")
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists() or not image_path.is_file():
        print(f"ERROR: Image not found at {image_path}")
        sys.exit(1)

    print("\nG-VISTA REAL LICENSE PLATE DETECTION")
    print("====================================\n")

    # Resolve model path robustly based on this script's location
    base_dir = Path(__file__).parent.parent.parent # Root of repo prometheus-15/
    model_path = base_dir / "server" / "ai" / "models" / "plate" / "best.pt"
    
    print(f"Model:\n  YOLO26n")
    print(f"Model path:\n  {model_path}")
    print(f"Class:\n  license_plate\n")

    if not model_path.exists():
        print(f"ERROR: Model file not found at {model_path}.")
        print("Please ensure the model file is placed in this exact location before running.")
        sys.exit(1)

    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: ultralytics module not found. Please run: pip install ultralytics")
        sys.exit(1)

    # Load Model
    start_time = time.time()
    try:
        model = YOLO(str(model_path))
    except Exception as e:
        print(f"ERROR: Failed to load model. {e}")
        sys.exit(1)
        
    print(f"Model loaded successfully in {time.time() - start_time:.2f}s.")

    # Read Image
    frame = cv2.imread(str(image_path))
    if frame is None:
        print(f"ERROR: Failed to read image {image_path}. It might be invalid.")
        sys.exit(1)

    # Frame Quality Check
    quality = FrameQualityAnalyzer.analyze(frame)

    # Inference
    inf_start = time.time()
    try:
        # Conf=0.25 is default fallback threshold
        results = model.predict(source=frame, device="cpu", verbose=False, conf=0.25)
    except Exception as e:
        print(f"ERROR: Inference failed. {e}")
        sys.exit(1)
    
    inf_time = time.time() - inf_start

    print(f"\nInference: \n  SUCCESS ({inf_time:.3f}s)\n")

    detections = []
    if results and len(results) > 0:
        for r in results:
            boxes = r.boxes
            if boxes is None or len(boxes) == 0:
                continue
            
            for box in boxes:
                cls_id = int(box.cls[0].item())
                # Enforce YOLO26n Class 0 = license_plate
                if cls_id == 0:
                    conf = float(box.conf[0].item())
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    detections.append({
                        "bbox": [x1, y1, x2, y2],
                        "confidence": conf
                    })

    print(f"Detections:\n  {len(detections)}\n")

    if len(detections) == 0:
        print("NO LICENSE PLATE DETECTED\n")
    else:
        for idx, det in enumerate(detections, start=1):
            bbox = det["bbox"]
            conf = det["confidence"]
            print(f"Plate #{idx}")
            print(f"BBox: {bbox}")
            print(f"Confidence: {conf:.4f}")
            print(f"Quality: {quality.name}\n")
            
            # Draw bbox and confidence
            cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), (0, 255, 0), 2)
            label = f"plate: {conf:.2f}"
            (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(frame, (bbox[0], bbox[1] - h - 5), (bbox[0] + w, bbox[1]), (0, 255, 0), -1)
            cv2.putText(frame, label, (bbox[0], bbox[1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # Save output
    output_path = "plate_demo_output.jpg"
    cv2.imwrite(output_path, frame)
    print(f"Annotated output saved to: {output_path}\n")

    print("Final status:\n  PASS")

if __name__ == "__main__":
    main()
