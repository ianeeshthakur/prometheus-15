# Free-text input sanitization -- docs/backend.md §7.1/§12.6, closing the "free-text
# camera fields aren't sanitized against stored-XSS" gap.
#
# Strips HTML/script markup at the INPUT boundary rather than HTML-escaping it: this is
# a JSON API, not a template renderer, so storing "AT&amp;T Junction" instead of
# "AT&T Junction" would be actively wrong for every consumer except an HTML template
# (entity-escaping belongs at the render layer, not in stored data). Stripping tags
# outright means no consumer -- this API today, a future frontend, anything else that
# ever reads this data -- can be tricked into rendering injected markup as live HTML,
# without corrupting the plain-text value for everyone else. Legitimate free text
# (camera names, case titles, descriptions) essentially never contains literal
# angle-bracket markup, so this has no real cost for real inputs.
#
# No external dependency (e.g. `bleach`) -- a regex is enough for "reject/strip
# anything that looks like a tag" on short free-text fields; this isn't parsing or
# sanitizing arbitrary rich-text/HTML content, which would need a real parser.
import re

_TAG_PATTERN = re.compile(r"<[^>]*>")


def strip_html_tags(value: str) -> str:
    if not value:
        return value
    return _TAG_PATTERN.sub("", value).strip()
