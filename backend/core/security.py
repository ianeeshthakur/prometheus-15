# Security posture entry point. See docs/backend.md §7 for the full policy this backs.
#
# What's real today: no raw camera IP/RTSP URL ever reaches a frontend-facing response.
# This is currently enforced ad-hoc by omission -- schemas.camera.CameraResponse simply
# has no rtsp_url field, so SQLAlchemy models never serialize it out (see services/camera_service.py,
# routers/cameras.py). That pattern is the actual mechanism; there is nothing further to
# centralize here yet without inventing unbuilt auth.
#
# NOT YET BUILT (docs/backend.md §12 checklist) -- do not stub fake implementations of these,
# they need real product/security decisions first:
#   - Authentication (JWT or session-based) -- routers/auth.py is currently a placeholder.
#   - RBAC enforcement (department-scoped users vs. platform admin, docs/frontend.md §3.7/§3.8).
#   - Audit log writes (who/what/when) for alert views, case actions, config changes.
#   - Facial-recognition authorization gate (docs/prd.md §3 non-goal unless explicitly authorized).
