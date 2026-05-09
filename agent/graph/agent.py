import asyncio
from langgraph.graph import StateGraph, END
from .state import AgentState
from .nodes import perceive, reason, act


def _perceive_edge(state: AgentState) -> str:
    risk = (state.get("breach_match") or {}).get("risk_score", 0)
    loops = state.get("loop_count", 0)
    print(f"[graph] Perceive edge: risk={risk}, loops={loops}")
    # Always go to reason so the user gets a summary even if 0 risk
    res = "reason"
    print(f"[graph] Next node: {res}")
    return res


def _reason_edge(state: AgentState) -> str:
    ta = state.get("threat_assessment") or {}
    level = ta.get("risk_level", "LOW")
    print(f"[graph] Reason edge: level={level}")
    res = "act" if level in ("LOW", "MEDIUM", "HIGH", "CRITICAL") else END
    print(f"[graph] Next node: {res}")
    return res


def build_graph():
    g = StateGraph(AgentState)

    g.add_node("perceive", perceive)
    g.add_node("reason", reason)
    g.add_node("act", act)

    g.set_entry_point("perceive")

    g.add_conditional_edges(
        "perceive",
        _perceive_edge,
        {"reason": "reason", "perceive": "perceive", END: END},
    )
    g.add_conditional_edges(
        "reason",
        _reason_edge,
        {"act": "act", "perceive": "perceive"},
    )
    g.add_edge("act", END)

    return g.compile()


async def run_agent(
    hashed_identifier: str,
    raw_identifier: str,
    user_pseudonym: str,
    phone_number: str,
    broadcaster=None,
):
    """
    Entry point called by the API layer after /register.
    Runs the full perceive → reason → act pipeline.
    """
    graph = build_graph()

    initial_state: AgentState = {
        "hashed_identifier": hashed_identifier,
        "raw_identifier": raw_identifier,
        "user_pseudonym": user_pseudonym,
        "phone_number": phone_number,
        "breach_match": None,
        "threat_assessment": None,
        "proof_result": None,
        "loop_count": 0,
        "broadcaster": broadcaster,
        "errors": [],
    }

    final_state = await graph.ainvoke(initial_state)
    return final_state
