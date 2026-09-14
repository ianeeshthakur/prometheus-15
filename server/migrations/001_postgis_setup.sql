-- PostGIS migration for the camera registry -- docs/backend.md §4/§12.4.
--
-- UNVERIFIED: written against standard PostGIS syntax but never run against a real
-- Postgres instance (none is available in this dev environment -- SQLite is the
-- default per .env.example). Review and dry-run against a real Postgres+PostGIS
-- database before applying to anything that matters.
--
-- Does NOT touch the SQLite dev path at all: models/camera.py keeps its plain
-- latitude/longitude Float columns regardless of which database is configured --
-- geom below is an additive, Postgres-only column kept in sync by the application
-- (see the note at the bottom), not a replacement. This keeps local dev on SQLite
-- working unchanged while giving Postgres deployments real spatial query support for
-- Model 1's GIS registry and the gap-analysis report.

-- 1. Enable the extension (once per database).
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add a geometry column alongside the existing latitude/longitude floats.
--    SRID 4326 = WGS 84, the standard lat/lng coordinate system (same as GPS).
ALTER TABLE cameras ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- 3. Backfill geom from any existing latitude/longitude data.
UPDATE cameras
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geom IS NULL;

-- 4. Spatial index -- required for ST_DWithin / bounding-box queries (map viewport
--    filtering, "cameras within N km" style queries) to actually use the index
--    instead of a full table scan.
CREATE INDEX IF NOT EXISTS idx_cameras_geom ON cameras USING GIST (geom);

-- 5. Keep geom in sync automatically whenever latitude/longitude change, so
--    application code (services/camera_service.py) doesn't need to remember to
--    maintain both columns itself.
CREATE OR REPLACE FUNCTION sync_camera_geom() RETURNS trigger AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    ELSE
        NEW.geom := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_camera_geom ON cameras;
CREATE TRIGGER trg_sync_camera_geom
    BEFORE INSERT OR UPDATE OF latitude, longitude ON cameras
    FOR EACH ROW EXECUTE FUNCTION sync_camera_geom();

-- Example queries this unlocks (for reference, not executed by this migration):
--
--   -- Cameras within 5km of a point (gap-analysis / coverage radius):
--   SELECT camera_uid, name FROM cameras
--   WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(72.57, 23.02), 4326)::geography, 5000);
--
--   -- Cameras within the current map viewport (a Leaflet bounding box):
--   SELECT camera_uid, name FROM cameras
--   WHERE geom && ST_MakeEnvelope(:west, :south, :east, :north, 4326);
