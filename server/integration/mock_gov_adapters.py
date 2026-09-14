# Clearly-labeled mock adapters for VAHAN/SARTHI/eGujCop/AFIS/NAFIS -- docs/backend.md
# §7/§12.4, docs/prd.md §13.2 differentiator: "named, clearly-labeled mock adapters so
# the architecture visibly answers the integration question" without claiming real
# access it doesn't have (docs/prd.md §0.1 mode-honesty rule).
#
# Real integration requires government-issued API credentials this project does not
# have and is out of scope for the pilot (docs/backend.md §10). Every response below
# carries `"mock": True` and an explanatory message so a caller can never mistake this
# for a real government-database hit.
from datetime import datetime, timezone
from typing import Any, Dict


def _mock_response(source: str, system_name: str, identifier: str) -> Dict[str, Any]:
    return {
        "source": source,
        "mock": True,
        "identifier": identifier,
        "status": "MOCK_NOT_CONNECTED",
        "message": (
            f"This is a mock response, not a real {system_name} lookup. Real integration "
            "requires government-issued API credentials this project does not have "
            "(docs/backend.md §7/§10)."
        ),
        "queried_at": datetime.now(timezone.utc).isoformat(),
    }


def lookup_vahan(registration_number: str) -> Dict[str, Any]:
    """VAHAN -- national vehicle registration database (Ministry of Road Transport)."""
    return _mock_response("VAHAN", "VAHAN vehicle-registration", registration_number)


def lookup_sarthi(license_number: str) -> Dict[str, Any]:
    """SARTHI -- national driving-license database (Ministry of Road Transport)."""
    return _mock_response("SARTHI", "SARTHI driving-license", license_number)


def lookup_egujcop(identifier: str) -> Dict[str, Any]:
    """eGujCop -- Gujarat Police's own case/crime-records system."""
    return _mock_response("eGujCop", "eGujCop police-records", identifier)


def lookup_afis(identifier: str) -> Dict[str, Any]:
    """AFIS -- Automated Fingerprint Identification System."""
    return _mock_response("AFIS", "AFIS fingerprint-identification", identifier)


def lookup_nafis(identifier: str) -> Dict[str, Any]:
    """NAFIS -- National Automated Fingerprint Identification System."""
    return _mock_response("NAFIS", "NAFIS fingerprint-identification", identifier)
