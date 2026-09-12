from abc import ABC, abstractmethod
from typing import Optional
from .schemas import CanonicalExternalRecord

class GovernmentDataConnector(ABC):
    @abstractmethod
    def query_vehicle(self, plate_number: str) -> CanonicalExternalRecord:
        pass
        
    @abstractmethod
    def query_person(self, person_id: str) -> CanonicalExternalRecord:
        pass

class MockVahanConnector(GovernmentDataConnector):
    def __init__(self):
        self.mock_data = {
            "GJ05XX7821": {
                "owner": "John Doe",
                "status": "ACTIVE",
                "make": "Toyota",
                "model": "Innova"
            },
            "GJ01AB1234": {
                "owner": "Jane Smith",
                "status": "STOLEN",
                "make": "Honda",
                "model": "City"
            }
        }
        
    def query_vehicle(self, plate_number: str) -> CanonicalExternalRecord:
        if plate_number in self.mock_data:
            return CanonicalExternalRecord(
                source="VAHAN",
                status="MOCK",
                data=self.mock_data[plate_number]
            )
        return CanonicalExternalRecord(
            source="VAHAN",
            status="MOCK",
            data={}
        )
        
    def query_person(self, person_id: str) -> CanonicalExternalRecord:
        return CanonicalExternalRecord(
            source="VAHAN",
            status="UNAVAILABLE",
            data={}
        )

class MockEGujCopConnector(GovernmentDataConnector):
    def query_vehicle(self, plate_number: str) -> CanonicalExternalRecord:
        return CanonicalExternalRecord(
            source="eGujCop",
            status="NOT_CONFIGURED",
            data={}
        )
        
    def query_person(self, person_id: str) -> CanonicalExternalRecord:
        if person_id == "WANTED-123":
            return CanonicalExternalRecord(
                source="eGujCop",
                status="MOCK",
                data={"status": "WANTED", "crimes": ["Theft"]}
            )
        return CanonicalExternalRecord(
            source="eGujCop",
            status="MOCK",
            data={}
        )
