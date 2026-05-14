from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, List
import operator
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
import os

load_dotenv()

class LitigaState(TypedDict):
    user_prompt: str
    api_results: dict
    forged_chains: List[str]
    meta_suggestions: List[str]
    final_output: str
    forge_memory: Annotated[List[str], operator.add]

# Initialize LLM
llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.3,
    api_key=os.getenv("OPENAI_API_KEY")
)

def orchestrator(state: LitigaState):
    """Decides the best API chains dynamically"""
    prompt = f"""
    User Prompt: {state['user_prompt']}
    You are LitigaForge Orchestrator.
    Create the optimal sequence of API chains using only: GSTIN, PAN, DigiLocker, VAHAN, SARATHI, e-District certificates, MSME, eCourts.
    """
    response = llm.invoke(prompt)
    state['forged_chains'] = ["GSTIN", "PAN", "DigiLocker", "eCourts"]
    return state

def execute_chain(state: LitigaState):
    """Placeholder for actual API calls - we will fill this later"""
    state['api_results'] = {
        "GSTIN": "Active - Last filed March 2026",
        "PAN": "Verified",
        "DigiLocker": "Income & Domicile certificates available",
        "eCourts": "2 related cases found"
    }
    return state

def meta_agent(state: LitigaState):
    """Self-evolving Meta Agent"""
    memory_context = "\n".join(state.get('forge_memory', []))
    prompt = f"""
    Chain Results: {state['api_results']}
    Past Memory: {memory_context}
    Invent 1-2 Unthought Chains and generate final professional output.
    """
    response = llm.invoke(prompt)
    
    state['meta_suggestions'] = ["Combined Eviction + Writ Chain", "Activate Watch Mode"]
    state['final_output'] = f"""
    🔥 LitigaForge Output

    {response.content}

    === MANDATORY LEGAL DISCLAIMER ===
    LitigaForge is an AI assistant only. All chains, drafts, and predictions are AI-generated. 
    The licensed advocate must independently verify every fact, citation, and government data before use.
    You take full professional responsibility under the Advocates Act and Bar Council Rules.
    """
    state['forge_memory'].append(f"Pattern: {state['user_prompt'][:100]} → {state['meta_suggestions']}")
    return state

# Build the Graph
workflow = StateGraph(LitigaState)
workflow.add_node("orchestrator", orchestrator)
workflow.add_node("execute_chain", execute_chain)
workflow.add_node("meta_agent", meta_agent)

workflow.set_entry_point("orchestrator")
workflow.add_edge("orchestrator", "execute_chain")
workflow.add_edge("execute_chain", "meta_agent")
workflow.add_edge("meta_agent", END)

app = workflow.compile()

# Test Function
def forge_case(user_prompt: str):
    initial_state = {
        "user_prompt": user_prompt,
        "api_results": {},
        "forged_chains": [],
        "meta_suggestions": [],
        "final_output": "",
        "forge_memory": []
    }
    result = app.invoke(initial_state)
    print(result['final_output'])
    return result

if __name__ == "__main__":
    test_prompt = "Forge full strategy for rent eviction + GST dispute - client Ramesh Reddy, Kukatpally"
    forge_case(test_prompt)
