from typing import TypedDict, Optional, Any

class AgentState(TypedDict):
    hashed_identifier: str
    user_pseudonym: str
    phone_number: str
    breach_match: Optional[dict]
    threat_assessment: Optional[dict]
    proof_result: Optional[dict]
    loop_count: int
    broadcaster: Optional[Any]
