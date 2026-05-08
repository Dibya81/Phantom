# PhantomID — Intelligence Layer
# Public API: query_breach_db
def query_breach_db(hashed_identifier: str) -> dict:
    from intelligence.rag.query import query_breach_db as _fn
    return _fn(hashed_identifier)

__all__ = ["query_breach_db"]