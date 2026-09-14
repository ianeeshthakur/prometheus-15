# G-VISTA — AI & Intelligence Pipelines

Governs everything from "a normalized video frame arrives" to "a scored alert or investigation lead exists": detector contracts, the AI orchestrator, intelligence correlation, and the real-data/dataset strategy. Backend plumbing that gets a frame to this point (adapters, registry, APIs) lives in [backend.md](backend.md); how results surface on screen lives in [frontend.md](frontend.md).

Stack: Python detector interfaces behind a swappable mock/real boundary (`server/ai/interfaces.py`), profile-driven orchestration (TRAFFIC/SECURITY/RTO).

---

## 1. AI orchestrator (`server/ai/orchestrator.py`)

A profile-driven orchestrator (profiles: **TRAFFIC**, **SECURITY**, **RTO**) sits behind swappable detector interfaces (`server/ai/interfaces.py`), so every detector below can run as a mock provider (`server/ai/mock_providers.py`) today and be swapped for a real fine-tuned model later without changing the orchestrator or any downstream consumer (frontend.md §3.8 "AI & datasets" tab is where that swap is selected per camera).

- [ ] **Mock-provider interface boundary** — how a real model plugs in at `server/ai/interfaces.py` without changing callers. Not yet documented in code; this is the seed of that contract.
- [ ] Profiles, thresholds, and the `AIAnalysisResult` schema (Pipeline 3 below) — not yet defined.
- [ ] Quality gating (`server/ai/quality.py`) — reject low-quality frames (blur, occlusion, extreme low-light) before they reach a detector, rather than letting detectors silently guess on unusable input.

## 2. Detector contracts

Each detector has a canonical output contract it must honor regardless of whether it's the mock provider or a real fine-tuned model:

- **Vehicle detection** — canonical `VEHICLE` class; this is the mock-vs-real model swap point (§1). [ ] Contract not yet written.
- **Person detection** — canonical `PERSON` class; filtering rules (e.g. minimum bounding-box size, occlusion threshold) still to be defined. [ ] Not yet written.
- **Plate detection** — **two-stage**: detect the plate *within a vehicle crop*, never scan the full frame directly — this bounds false positives and matches how ANPR is judged (a plate detected off a vehicle isn't a real read). [ ] Two-stage pipeline not yet implemented.
- **OCR** (on the detected plate) — contract distinguishes `raw_text` (whatever the OCR engine returns) from `normalized_text` (cleaned to the plate format), with a hard **never-hallucinate-a-plate rule**: if confidence is below threshold, the result is `UNREADABLE`, never a guessed string. This directly protects the hackathon's live vehicle-tracking test (backend.md §5 Pipeline 5) from false matches. [ ] Not yet implemented.
- **Anomaly detection** — `anomaly_type` is an **open string, not a fixed enum** — new incident types (theft, loitering, wrong-way driving, crowd gathering, unattended object, ...) get added as real data defines them, not guessed in advance. [ ] Detector not yet implemented; this rule governs the schema once it is.

## 3. Pipeline 3 — AI video analytics

Orchestrator → detector interfaces → thresholds → `AIAnalysisResult`. This is the pipeline that turns a `NormalizedFrame` (backend.md §3) into zero or more detections, each carrying a detector type, bounding box, confidence, and (where applicable) OCR/anomaly-type payload per §2's contracts.
- [ ] `AIAnalysisResult` schema — not yet defined; must carry enough for frontend.md §3.2's "distinct shape+label, not color-only" detection overlay and for the fused-alert differentiator below (§5).

## 4. Pipeline 4 — Intelligence correlation

Event store, watchlist/VAHAN-style correlation, and GIS path tracing — **currently unimplemented; scope must be defined before building**, per the original design note. This is the pipeline behind:
- Watchlist matching (stolen vehicle / wanted person / custom, frontend.md §3.4) feeding alerts.
- Cross-camera entity trace — search a plate/description → timeline → map route (frontend.md §3.5) — **this is the literal hackathon-day live test**, so its correlation logic must work against the real ingest API, not only mock data.
- [ ] Event store schema — not yet defined.
- [ ] Watchlist/database correlation logic — not yet defined; real VAHAN/SARTHI/eGujCop/AFIS/NAFIS access is out of scope for the pilot (backend.md §7) — model as clearly-labeled mocks.
- [ ] GIS path tracing (sequencing an entity's camera sightings into a route) — not yet defined; depends on backend.md §4's PostGIS migration.

## 5. Differentiators owned by this domain (prd.md §13.2 — what makes this competitive, not just compliant)

- **Appearance-based re-identification**, not plate-text-only tracking: person/vehicle embedding match so an entity can still be traced across cameras when the plate is unreadable (§2's `UNREADABLE` fallback) or the subject is a pedestrian. Highest-leverage single feature against the hackathon's "evidence of interoperability, onboarding efficiency, analytics" scoring and its "advanced cross-camera tracking" bonus line.
- **Edge-side inference option**: run detection near the adapter and ship metadata/events instead of full video where bandwidth is constrained — the concrete answer to the ~80,000-camera scalability question (backend.md §9) and the "bandwidth optimization" bonus line, demoable rather than only claimed on a slide.
- **Fused, explainable alerts**: one alert record shows *why* it fired — which detector, which watchlist/database entry, confidence score, evidence crop — rather than a raw detection dump. This is `AIAnalysisResult` (§3) joined with the correlation result (§4) into a single record before it ever reaches backend.md §5 Pipeline 5's severity scoring.
- **Automated demo-report generation**: the live-feed demo must produce "a report showing detected vehicles/number plates with timestamps" — build this as a real Analytics & Reports export (frontend.md §3.6) sourced directly from `AIAnalysisResult` + OCR output, not a manually-assembled slide.

## 6. Dataset strategy — incremental, real-data intake

No dataset exists yet at the time of writing; this section defines where each one lands the moment it's collected, so intake never blocks other work. Note the hackathon itself also now provides a live, real streaming source (backend.md §2, ~50 simulated feeds from 30+ real cameras) — that's a *streaming* source for inference, separate from the *training* datasets below, which are for fine-tuning the detectors in §2.

### 6.1 Categories being collected

| Category | Contents | Feeds |
|---|---|---|
| Video footage | Recorded or live RTSP/CCTV clips | Adapter testing (backend.md §3), AI orchestrator inference (§1) |
| Camera metadata | Real camera records: location, district, vendor, protocol | Camera registry (backend.md §5 Pipeline 1) |
| Vehicle/plate images | Labeled images for ANPR | Plate detector + OCR fine-tuning (§2) |
| Anomaly/incident data | Labeled clips/images per incident type — theft, loitering, wrong-way driving, crowd gathering, unattended object, etc. | Anomaly detector fine-tuning (§2) |

### 6.2 Intake structure

A fixed folder contract so any dataset can be dropped in without a schema negotiation each time:

```
datasets/
  raw/
    video/            # <camera_uid>/<clip>.mp4 + a manifest.csv (camera_uid, timestamp, source, duration)
    camera_metadata/  # CSV/JSON exports of real camera records
    plates/           # images/ + labels.csv (image_id, plate_text, bbox)
    anomalies/        # one subfolder per anomaly_type (THEFT, LOITERING, WRONG_WAY, CROWD, ...), each with clips/images + labels.csv
  processed/          # normalized/cleaned outputs of the above, same subfolder shape
  splits/             # train/ val/ test/ manifests -- generated, never hand-edited
  DATASET_CARD.md      # one card per category: source, collection date, size, license, known limitations
```

`anomaly_type` stays an **open string, not a fixed enum** (§2) — new incident types get added as real data defines them, not guessed in advance.

### 6.3 Onboarding loop, per dataset as it arrives

1. Drop raw files under `datasets/raw/<category>/` per the structure above; write/update that category's `DATASET_CARD.md`.
2. Run the existing mock-provider pipeline (§1) against a sample to see where it currently fails on real data.
3. Label/correct using a human-in-the-loop tool (CVAT or Label Studio) rather than labeling from zero.
4. Fine-tune the relevant detector (§2); version the dataset (DVC) and the run (MLflow/W&B) so results are reproducible.
5. Hold out a validation split before fine-tuning and never train on it; report the metric that matches the category (mAP@0.5 for detection, plate exact-match + character error rate for ANPR, precision/recall for anomaly alerts).
6. Update frontend.md §3.8 "AI & datasets" tab to point the relevant profile at the newly fine-tuned model version.

This loop runs independently per category — video footage arriving doesn't block wiring in an anomaly dataset later, and vice versa.

## 7. Dataset/model sourcing plan (real AI, pre-collection)

Where the vehicle/plate/person/OCR/re-identification models themselves come from before any real dataset in §6 has landed — recovered from the prior `prometheus-1` design work (`G-VISTA-Blueprint.md` §11, archived externally 2026-09-14 — see prd.md §15), which researched this before the fresh-start rebuild. The reasoning in that source doc: the pipeline is evaluated on real, unfamiliar Indian-road footage, not a staged demo clip, so pretrained-source fit matters more than architecture choice.

| Task | Recommended dataset(s) | Why it fits |
|---|---|---|
| General vehicle/person detection | COCO, BDD100K, UA-DETRAC | Strong generic pretrained backbones (YOLOv8/v9) to fine-tune from |
| Indian road/traffic realism | **IDD — India Driving Dataset** (IIIT Hyderabad) | The only major dataset with Indian road density, autorickshaws, two-wheeler dominance, and lane-discipline patterns the live cameras will actually show |
| License plate detection + OCR | Curated Indian ANPR sets (Kaggle "Indian Vehicle Number Plate" collections, Roboflow Universe "India ANPR" projects) + active-learning labels pulled from the hackathon's own live feeds | Indian plates vary wildly: HSRP vs. legacy, single- vs. two-line (common on two-wheelers), state-code prefixes — generic ALPR models (built for US/EU/Chinese plates) under-perform without this |
| Person re-identification (§5 differentiator) | Market-1501, MSMT17 | Standard Re-ID benchmarks; **avoid DukeMTMC-reID** — withdrawn over consent concerns, noted so nobody quietly pulls it in later |
| Soft-biometric attributes | PA-100K, RAP | Clothing/attribute labels without requiring face recognition — the privacy-safe path consistent with backend.md §7's facial-recognition gate |
| Low-light / adverse-weather robustness | ExDark (low light), Rain100/RainCityscapes, or synthetic Albumentations augmentation | State CCTV runs 24/7; night IR and monsoon footage must not silently zero out detection confidence |
| Suspicious-activity / anomaly cues | UCF-Crime, ShanghaiTech Campus, Avenue | Seeds for anomaly types (§2's open-string `anomaly_type`) beyond simple object detection |

This table is a starting point for licensing/access verification, not a final commitment — confirm each dataset's license permits this use before fine-tuning against it. The onboarding loop once real data lands is §6.3; the same profile → label → fine-tune → validate → report loop applies to these pretrained sources too.

### 7.1 Theft/shoplifting candidates found 2026-09-13 (suspicious-activity row, not yet downloaded or evaluated)

Real, specific links for the "Suspicious-activity / anomaly cues" row above, found by the team rather than sourced from the prior `prometheus-1` research. Listed here, not integrated: nothing has been downloaded, licensed, labeled, or evaluated against the mock pipeline yet — that's §6's onboarding loop, unstarted for these. Important scope note: these are theft/shoplifting **behavior classification** datasets, which fit `AnomalyDetector` (§2's open-string `anomaly_type`, e.g. a `SHOPLIFTING`/`THEFT` type) — they do **not** help either of backend.md §12.7's still-open items (fuzzy watchlist matching needs labeled *OCR reading vs. ground-truth plate* pairs; re-identification needs a labeled *same-person/vehicle-across-cameras* dataset like Market-1501 above). Don't conflate the two when scoping follow-up work.

| Resource | Type | Relevance |
|---|---|---|
| [Theft Detection Dataset (Kaggle, prachisury11)](https://www.kaggle.com/datasets/prachisury11/theft-detection-dataset) | Labeled video/frames | Direct candidate for a `SHOPLIFTING`/`THEFT` anomaly type — license unverified |
| [DCSASS Dataset (Kaggle, mateohervas)](https://www.kaggle.com/datasets/mateohervas/dcsass-dataset) | Multi-category surveillance anomaly clips | Broader than theft alone (DCSASS = multiple anomaly categories) — could seed several `anomaly_type` values at once, not just theft |
| [Suspicious Shoplifting Activity Detection (Kaggle, sgsparsh06)](https://www.kaggle.com/datasets/sgsparsh06/suspicious-shoplifting-activity-detection) | Labeled shoplifting clips | Same category as the first row — cross-check for overlap/duplication before using both |
| [Kudosware Theft Detection Model (Kaggle notebook, desolationofsmaug)](https://www.kaggle.com/code/desolationofsmaug/kudosware-theft-detection-model) | Reference notebook (existing model, not a dataset) | A worked baseline approach to read before designing this project's own fine-tuning run — not something to import directly, since its training data/license/eval methodology need the same verification as everything else in this table |
| [arXiv 2511.02563](https://arxiv.org/pdf/2511.02563) | Research paper | Unread as of this entry — flagged for the person who picks up this differentiator to review before committing to an architecture, not yet assessed for relevance |
| [Dropbox folder (prachisury11's dataset host?)](https://www.dropbox.com/scl/fo/2aczdnx37hxvcfdo4rq4q/AOjRokSTaiKxXmgUyqdcI6k) | Unknown — not inspected | Access-gated (`rlkey` in the URL); contents, license, and relationship to the Kaggle datasets above are unverified. Don't assume it's a mirror of any specific row above without checking |

None of this is a commitment to build shoplifting/theft detection for the pilot scope (§13.1/§13.2, prd.md) — it's dataset sourcing for a differentiator that isn't currently scheduled. Whoever picks this up next should start with §6.3's loop: download one dataset, run it through the existing `MockAnomalyDetector` path to see where it fails, then decide if it's worth a real fine-tuning pass before the hackathon deadline.

## 8. AI/pipelines feature checklist

Every detector, orchestrator, and correlation file named above is currently a 1-line placeholder — nothing is implemented yet.

- [ ] Mock-provider interface boundary documented + implemented (§1)
- [ ] Orchestrator profiles (TRAFFIC/SECURITY/RTO) + thresholds + `AIAnalysisResult` schema (§1, §3)
- [ ] Quality gating before detection (§1)
- [ ] Vehicle detector contract (§2)
- [ ] Person detector contract (§2)
- [ ] Two-stage plate detector (crop-then-detect, never full-frame) (§2)
- [ ] OCR contract: raw_text/normalized_text split + `UNREADABLE` fallback, never-hallucinate rule (§2)
- [ ] Anomaly detector with open-string `anomaly_type` (§2)
- [ ] Event store schema (§4)
- [ ] Watchlist/mock-database correlation (§4)
- [ ] GIS path tracing, depends on backend.md PostGIS migration (§4)
- [ ] Fused explainable alert record joining detection + correlation (§5)
- [ ] Automated demo-report export sourced from real detection output (§5)
- [ ] Re-identification (appearance embedding) for plate-unreadable/pedestrian tracking — differentiator (§5)
- [ ] Edge-inference option — differentiator (§5)
- [ ] Real dataset intake started for at least one category (§6) with a before/after fine-tuning metric reported (prd.md §11 success metric)
