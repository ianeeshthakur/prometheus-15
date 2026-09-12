# Local Development Setup

## Prerequisites
- Python 3.9+
- Node.js 18+
- FFmpeg (must be installed on your system path)
- SQLite3

## 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

*(Note: `opencv-python-headless` is used. Do not install the GUI version of cv2 on production servers).*

### Running the Backend

```bash
python -m uvicorn main:app --reload
```
The API documentation will be available at `http://localhost:8000/docs`.

## 2. Frontend Setup

```bash
cd app
npm install
npm run dev
```

The Command Center will be available at `http://localhost:3000`.

## 3. Running Tests

To verify the installation:

```bash
cd backend
source venv/bin/activate
python test_api.py
python test_adapters.py
python test_ai.py
```
