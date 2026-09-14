# shared/

Reserved for code genuinely shared between `client/` (JS) and `server/` (Python) --
e.g. a generated API type/schema contract, or constants that must stay in sync on
both sides (status enums, severity levels). Empty for now: nothing in this repo
currently needs that split, and forcing a placeholder abstraction into place before
there's real duplication to remove would just be overhead. Add to this directory when
a specific cross-language duplication actually shows up, not preemptively.
