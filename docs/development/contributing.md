# Contributing

We welcome contributions to G-VISTA from AI researchers, system integrators, and software engineers. 

## Architectural Rules

1. **Never commit secrets:** Never commit real `rtsp_url`s containing usernames or passwords into the database seeds or testing files.
2. **Never expose credentials to the frontend:** If you add a new endpoint, always use a Pydantic schema (like `CameraResponse`) that explicitly excludes private connection information.
3. **Do not break the AI Orchestrator:** If you add a new AI model, implement the relevant interface in `backend/ai/interfaces.py`. Do not inject custom logic directly into the Orchestrator.

## Where to add Code

- **New Camera Protocols:** Add new subclasses to `backend/adapters/base.py` (e.g., `class MQTTAdapter`).
- **New AI Models:** Add your PyTorch/ONNX wrapper to `backend/ai/custom_providers.py` and register it in `orchestrator.py`.
- **Model Weights:** Place large weights `.pt` files in `backend/ai/models/` and ensure they are added to `.gitignore`.

## Formatting and Linting
Please ensure code passes basic typing checks and does not use hard-coded infinite while-loops in the FastAPI request context.
