# G-VISTA

Gujarat Video Intelligence & Surveillance Technology Architecture — a submission to the Gujarat Police CCTV Integration Hackathon 2026. See [docs/prd.md](docs/prd.md) for product scope, [docs/frontend.md](docs/frontend.md), [docs/backend.md](docs/backend.md), and [docs/ai_pipelines.md](docs/ai_pipelines.md) for implementation depth (docs/prd.md §15 has the decision log explaining every non-obvious choice below).

## Structure

```
client/     React (Vite) frontend -- docs/frontend.md
server/     FastAPI backend -- docs/backend.md
shared/     Reserved for real client/server-shared code (currently empty, see shared/README.md)
docs/       prd.md, backend.md, frontend.md, ai_pipelines.md
datasets/   Real-data intake structure -- ai_pipelines.md §6
```

No `contrib/` directory in the repo anymore: it held superseded-not-chosen code (a teammate's separately-evolved backend, considered and not chosen as production, and the earlier Next.js frontend `client/` superseded) and was removed on 2026-09-14 once its owner had it archived externally, rather than keeping a second copy in-tree (prd.md §15 decision log; frontend.md §6 names what was ported out of the Next.js side of it before it left).

## Quick start

```
cp .env.example .env              # server config
cp client/.env.example client/.env  # client config (optional -- has a working default)

cd server && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt && uvicorn main:app --reload
cd client && npm install && npm run dev
```

Or via Docker: `docker compose up --build` (server on :8000, client on :8080). The compose setup is written but unverified in this environment (no Docker available here) -- verify it builds before relying on it.

