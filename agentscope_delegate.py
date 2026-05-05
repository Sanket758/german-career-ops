import asyncio
import sys
import os

# Ensure we use the correct venv for AgentScope
VENV_PATH = "/home/sanket758/Tools/.venv/lib/python3.10/site-packages"
if VENV_PATH not in sys.path:
    sys.path.append(VENV_PATH)

try:
    import agentscope
    from agentscope.model import OllamaChatModel
    from agentscope.formatter import OllamaChatFormatter
    from agentscope.agent import AgentBase
    from agentscope.message import Msg
except ImportError as e:
    print(f"Error importing AgentScope: {e}")
    sys.exit(1)

class LocalSimpleAgent(AgentBase):
    def __init__(self, name, sys_prompt, model, formatter):
        super().__init__()
        self.name = name
        self._sys_prompt = sys_prompt
        self.model = model
        self.formatter = formatter

    async def reply(self, x: Msg = None) -> Msg:
        # Format the message
        prompt = await self.formatter.format([
            Msg("system", self._sys_prompt, "system"),
            x
        ])
        
        # Call the model
        res = await self.model(prompt)
        
        # In AgentScope 1.0.18, res is a ChatResponse object
        # which has a 'content' attribute (list of blocks)
        content = ""
        for block in res.content:
            if block.get("type") == "text":
                content += block.get("text", "")
        
        return Msg(self.name, content, "assistant")

async def run_delegation(task: str):
    # 1. Initialize models
    model_coder = OllamaChatModel(
        model_name="qwen2.5-coder:7b-instruct-q4_K_M"
    )
    model_career = OllamaChatModel(
        model_name="gemma4:e2b-it-q4_K_M"
    )
    model_general = OllamaChatModel(
        model_name="llama3:latest"
    )
    
    # 2. Formatters
    formatter = OllamaChatFormatter()
    
    # 3. Delegation Logic
    task_lower = task.lower()
    is_code = any(kw in task_lower for kw in ["python", "code", "script", "fix", "error", "function", "bash", "cli", "git", "json", "ts"])
    is_career = any(kw in task_lower for kw in ["cv", "resume", "cover letter", "job", "career", "german", "translate", "email", "linkedin", "evaluate"])
    
    if is_code:
        selected_model = model_coder
        agent_name = "CoderLocal"
    elif is_career:
        selected_model = model_career
        agent_name = "CareerLocal"
    else:
        selected_model = model_general
        agent_name = "GeneralLocal"
    
    sys_prompt = (
        "You are a local assistant helping with small tasks to save tokens for larger models. "
        "Be concise, precise, and direct. No conversational filler."
    )
    
    agent = LocalSimpleAgent(agent_name, sys_prompt, selected_model, formatter)
    
    # 4. Execute
    response = await agent(Msg("User", task, "user"))
    return response.content

def main():
    if len(sys.argv) < 2:
        print("Usage: python agentscope_delegate.py '<task_description>'")
        sys.exit(1)

    task = sys.argv[1]
    
    # Run the async loop
    result = asyncio.run(run_delegation(task))
    print(result)

if __name__ == "__main__":
    main()
