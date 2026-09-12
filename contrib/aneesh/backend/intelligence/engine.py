import uuid
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from ai.schemas import AIAnalysisResult
from .schemas import (
    IntelligenceEntityCreate, 
    IntelligenceObservationCreate,
    IntelligenceEventCreate,
    WatchlistMatchCreate,
    CorrelatedIntelligenceResult,
    EntityType,
    IntelligenceEntityResponse,
    IntelligenceObservationResponse,
    IntelligenceEventResponse,
    WatchlistMatchResponse
)
from .models import IntelligenceEntity, IntelligenceObservation, IntelligenceEvent, WatchlistMatchRecord
from models import Camera
from .watchlist import WatchlistEngine
from .connectors import MockVahanConnector, MockEGujCopConnector

class IntelligenceEngine:
    def __init__(self):
        self.watchlist_engine = WatchlistEngine()
        self.vahan_connector = MockVahanConnector()
        self.egujcop_connector = MockEGujCopConnector()

    def process(self, ai_result: AIAnalysisResult, db: Session) -> CorrelatedIntelligenceResult:
        # 1. Fetch Context
        camera = db.query(Camera).filter(Camera.camera_uid == ai_result.camera_uid).first()
        department = camera.department if camera else "UNKNOWN"
        district = camera.district if camera else "UNKNOWN"
        location = camera.location if camera else "UNKNOWN"

        result = CorrelatedIntelligenceResult()
        
        # 2 & 3. Entity Extraction and Normalization
        extracted_entities = self._extract_entities(ai_result)
        observations = []
        for entity_data in extracted_entities:
            # Check if entity exists or create new
            entity_record = self._get_or_create_entity(db, entity_data)
            
            # Create Observation
            obs_id = f"OBS-{uuid.uuid4().hex[:8]}"
            obs = IntelligenceObservation(
                observation_id=obs_id,
                entity_id=entity_record.entity_id,
                camera_uid=ai_result.camera_uid,
                department=department,
                timestamp=ai_result.timestamp,
                confidence=entity_data.attributes.get("confidence", 0.0),
                attributes=entity_data.attributes
            )
            db.add(obs)
            observations.append(obs)
            
            obs_resp = IntelligenceObservationResponse(
                id=0, # temp
                observation_id=obs.observation_id,
                entity_id=obs.entity_id,
                camera_uid=obs.camera_uid,
                department=obs.department,
                timestamp=obs.timestamp,
                confidence=obs.confidence,
                attributes=obs.attributes
            )
            result.observations.append(obs_resp)

            # 4. Watchlist Matching
            matches = self.watchlist_engine.evaluate(entity_data)
            for match in matches:
                wm_record = WatchlistMatchRecord(
                    match_id=match.match_id,
                    watchlist_id=match.watchlist_id,
                    entity_id=match.entity_id,
                    match_type=match.match_type,
                    confidence=match.confidence
                )
                db.add(wm_record)
                result.watchlist_matches.append(WatchlistMatchResponse(
                    id=0, timestamp=datetime.now(), **match.model_dump()
                ))
                
                # Generate Watchlist Event
                self._generate_event(
                    db, result, 
                    event_type="WATCHLIST_MATCH_CANDIDATE",
                    severity="HIGH",
                    confidence=match.confidence,
                    description=f"Watchlist {match.watchlist_id} match for entity {match.entity_id}",
                    entities=[match.entity_id],
                    evidence={"match_type": match.match_type, "watchlist": match.watchlist_id}
                )

            # 5. External Connectors
            if entity_data.entity_type == EntityType.LICENSE_PLATE:
                plate_text = entity_data.attributes.get("normalized_text", "")
                if plate_text:
                    ext_data = self.vahan_connector.query_vehicle(plate_text)
                    if ext_data.status == "MOCK" and ext_data.data:
                        # Event for external correlation
                        self._generate_event(
                            db, result,
                            event_type="EXTERNAL_DATA_CORRELATION",
                            severity="INFO",
                            confidence=0.9,
                            description=f"Correlated plate {plate_text} with VAHAN data.",
                            entities=[entity_record.entity_id],
                            evidence={"source": "VAHAN", "data": ext_data.data}
                        )

            # 6. Cross-Camera & Cross-Department Correlation
            self._correlate_history(db, result, entity_record, obs, department, district, location)
            
        # Commit to DB
        db.commit()
        
        # We might need to refresh to get actual IDs, but for the result response we can just return what we have
        return result

    def _extract_entities(self, ai_result: AIAnalysisResult) -> List[IntelligenceEntityCreate]:
        entities = []
        
        # Vehicles
        for v in ai_result.vehicles:
            entities.append(IntelligenceEntityCreate(
                entity_id=f"ENT-V-{uuid.uuid4().hex[:8]}",
                entity_type=EntityType.VEHICLE,
                attributes={"class_name": v.class_name, "confidence": v.confidence, "bbox": v.bbox, "detection_id": v.detection_id}
            ))
            
        # Persons
        for p in ai_result.persons:
            entities.append(IntelligenceEntityCreate(
                entity_id=f"ENT-P-{uuid.uuid4().hex[:8]}",
                entity_type=EntityType.PERSON,
                attributes={"class_name": p.class_name, "confidence": p.confidence, "bbox": p.bbox, "detection_id": p.detection_id}
            ))

        # Generic Objects
        for d in ai_result.detections:
            entities.append(IntelligenceEntityCreate(
                entity_id=f"ENT-O-{uuid.uuid4().hex[:8]}",
                entity_type=EntityType.OBJECT,
                attributes={"class_name": d.class_name, "confidence": d.confidence, "bbox": d.bbox, "detection_id": d.detection_id}
            ))
            
        # Plates (Note: Plates could be tied to vehicles, but we treat them as entities here for simplicity)
        for plt in ai_result.plates:
            entities.append(IntelligenceEntityCreate(
                entity_id=f"ENT-L-{plt.normalized_text if plt.normalized_text else uuid.uuid4().hex[:8]}",
                entity_type=EntityType.LICENSE_PLATE,
                attributes={"normalized_text": plt.normalized_text, "confidence": plt.final_confidence, "bbox": plt.bbox, "raw_text": plt.raw_text}
            ))
            
        # Anomalies -> Contextual Anomaly Events
        # Anomalies might not be entities, but if they are objects we can extract them
        for a in ai_result.anomalies:
            entities.append(IntelligenceEntityCreate(
                entity_id=f"ENT-A-{uuid.uuid4().hex[:8]}",
                entity_type=EntityType.EVENT, # or OBJECT
                attributes={"anomaly_type": a.anomaly_type, "confidence": a.confidence, "status": a.status}
            ))

        return entities

    def _get_or_create_entity(self, db: Session, entity_data: IntelligenceEntityCreate) -> IntelligenceEntity:
        # Simplistic matching: if license plate text is the same, it's the same entity
        if entity_data.entity_type == EntityType.LICENSE_PLATE:
            plate_text = entity_data.attributes.get("normalized_text")
            if plate_text:
                existing = db.query(IntelligenceEntity).filter(
                    IntelligenceEntity.entity_type == EntityType.LICENSE_PLATE,
                    # We might need a proper JSON query here, but for sqlite let's just use entity_id which we prefixed with plate text
                ).filter(IntelligenceEntity.entity_id == f"ENT-L-{plate_text}").first()
                
                if existing:
                    existing.last_seen = datetime.now()
                    return existing

        # For others, we just create a new one for now (a real system would use embeddings)
        new_entity = IntelligenceEntity(
            entity_id=entity_data.entity_id,
            entity_type=entity_data.entity_type.value,
            attributes=entity_data.attributes
        )
        db.add(new_entity)
        db.flush() # flush to get it tracked
        return new_entity

    def _correlate_history(self, db: Session, result: CorrelatedIntelligenceResult, entity: IntelligenceEntity, current_obs: IntelligenceObservation, current_dept: str, current_district: str, current_location: str):
        # 1. Immediate Contextual Intelligence (Plate-independent)
        # We can generate intelligence based on location/department context without needing historical identity tracking.
        if entity.entity_type == EntityType.EVENT.value:
            anomaly_type = entity.attributes.get("anomaly_type", "unknown")
            self._generate_event(
                db, result,
                event_type="CONTEXTUAL_ANOMALY",
                severity="MEDIUM",
                confidence=current_obs.confidence,
                description=f"Contextual anomaly ({anomaly_type}) observed at {current_location} ({current_dept}).",
                entities=[entity.entity_id],
                evidence={"location": current_location, "department": current_dept, "anomaly": anomaly_type}
            )

        # 2. Historical tracking (Requires identity resolution)
        # For this to work well, the entity must have been correctly matched in _get_or_create_entity
        # Currently only license plates are matched robustly across time in this mock
        if entity.entity_type not in [EntityType.LICENSE_PLATE.value]:
            return
            
        past_obs = db.query(IntelligenceObservation).filter(
            IntelligenceObservation.entity_id == entity.entity_id,
            IntelligenceObservation.observation_id != current_obs.observation_id
        ).order_by(IntelligenceObservation.timestamp.desc()).limit(10).all()
        
        if not past_obs:
            return
            
        # Check cross camera
        cameras_seen = set([o.camera_uid for o in past_obs])
        if current_obs.camera_uid not in cameras_seen and len(cameras_seen) > 0:
            self._generate_event(
                db, result,
                event_type="CROSS_CAMERA_ENTITY_OBSERVATION",
                severity="INFO",
                confidence=0.8,
                description=f"Entity {entity.entity_id} observed across multiple cameras.",
                entities=[entity.entity_id],
                evidence={"cameras": list(cameras_seen) + [current_obs.camera_uid]}
            )
            
        # Check cross department
        depts_seen = set([o.department for o in past_obs if o.department])
        if current_dept and current_dept not in depts_seen and len(depts_seen) > 0:
            self._generate_event(
                db, result,
                event_type="CROSS_DEPARTMENT_CORRELATION",
                severity="MEDIUM",
                confidence=0.85,
                description=f"Entity {entity.entity_id} observed by {current_dept} and {list(depts_seen)}.",
                entities=[entity.entity_id],
                evidence={"departments": list(depts_seen) + [current_dept]}
            )
            
        # Historical Timeline / Repeated
        if len(past_obs) > 2:
            self._generate_event(
                db, result,
                event_type="REPEATED_ENTITY_OBSERVATION",
                severity="INFO",
                confidence=0.9,
                description=f"Entity {entity.entity_id} seen {len(past_obs) + 1} times.",
                entities=[entity.entity_id],
                evidence={"count": len(past_obs) + 1}
            )

    def _generate_event(self, db: Session, result: CorrelatedIntelligenceResult, event_type: str, severity: str, confidence: float, description: str, entities: List[str], evidence: Dict[str, Any]):
        evt = IntelligenceEvent(
            event_id=f"EVT-{uuid.uuid4().hex[:8]}",
            event_type=event_type,
            timestamp=datetime.now(),
            severity=severity,
            confidence=confidence,
            description=description,
            related_entities=entities,
            evidence=evidence,
            status="NEW"
        )
        db.add(evt)
        result.events.append(IntelligenceEventResponse(
            id=0, timestamp=evt.timestamp, **{k: getattr(evt, k) for k in ["event_id", "event_type", "severity", "confidence", "description", "related_entities", "evidence", "status"]}
        ))
