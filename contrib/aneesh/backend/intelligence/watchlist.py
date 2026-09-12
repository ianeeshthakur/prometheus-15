from typing import List, Dict, Any
from .schemas import IntelligenceEntityBase, WatchlistMatchCreate
import uuid

class WatchlistEngine:
    def __init__(self):
        # In a real system, this would be backed by a DB or external API
        self.mock_watchlists = {
            "WL-STOLEN-VEHICLES": [
                {"type": "LICENSE_PLATE", "value": "GJ01AB1234"},
                {"type": "LICENSE_PLATE", "value": "GJ05XX7821"}
            ],
            "WL-WANTED-PERSONS": [
                {"type": "PERSON_ATTRIBUTE", "attribute": "face_embedding_id", "value": "WANTED-123"}
            ]
        }

    def evaluate(self, entity: IntelligenceEntityBase) -> List[WatchlistMatchCreate]:
        matches = []
        
        for wl_id, items in self.mock_watchlists.items():
            for item in items:
                # License Plate matching
                if entity.entity_type == "LICENSE_PLATE" and item["type"] == "LICENSE_PLATE":
                    plate_text = entity.attributes.get("normalized_text", "")
                    if item["value"] == plate_text:
                        matches.append(WatchlistMatchCreate(
                            match_id=f"WM-{uuid.uuid4().hex[:8]}",
                            watchlist_id=wl_id,
                            entity_id=entity.entity_id,
                            match_type="EXACT",
                            confidence=1.0
                        ))
                    elif item["value"] in plate_text or plate_text in item["value"]:
                        # Fuzzy match candidate
                        matches.append(WatchlistMatchCreate(
                            match_id=f"WM-{uuid.uuid4().hex[:8]}",
                            watchlist_id=wl_id,
                            entity_id=entity.entity_id,
                            match_type="CANDIDATE",
                            confidence=0.7
                        ))
                
                # Person matching (mock using some hypothetical attribute like face_embedding_id)
                elif entity.entity_type == "PERSON" and item["type"] == "PERSON_ATTRIBUTE":
                    attr_name = item["attribute"]
                    if attr_name in entity.attributes and entity.attributes[attr_name] == item["value"]:
                        matches.append(WatchlistMatchCreate(
                            match_id=f"WM-{uuid.uuid4().hex[:8]}",
                            watchlist_id=wl_id,
                            entity_id=entity.entity_id,
                            match_type="EXACT",
                            confidence=0.9
                        ))
                        
        return matches
