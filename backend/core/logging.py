# Logging setup. Extracted from contrib/aneesh/backend/main.py so it's configured once,
# importable anywhere, instead of re-running logging.basicConfig() per module.
import logging


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


logger = logging.getLogger("gvista-backend")
