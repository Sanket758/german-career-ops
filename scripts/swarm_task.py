import os
import asyncio
import agentscope
from agentscope.agent import ReActAgent
from agentscope.message import Msg
from agentscope.model import OpenAIChatModel
from agentscope.formatter import OpenAIChatFormatter
from agentscope.memory import InMemoryMemory
from agentscope.tool import Toolkit

async def main():
    print("Initializing Swarm with Ollama (qwen2.5-coder:7b-instruct-q4_K_M)...")
    
    agentscope.init()
    
    model = OpenAIChatModel(
        model_name="qwen2.5-coder:7b-instruct-q4_K_M",
        api_key="ollama",
        client_kwargs={"base_url": "http://127.0.0.1:11434/v1"}
    )
    
    empty_toolkit = Toolkit()
    
    architect = ReActAgent(
        name="Architect",
        sys_prompt="You are a senior system Architect. You design lightweight, reliable messaging protocols. Keep responses extremely concise (1 paragraph max).",
        model=model,
        memory=InMemoryMemory(),
        formatter=OpenAIChatFormatter(),
        toolkit=empty_toolkit
    )

    security = ReActAgent(
        name="SecurityExpert",
        sys_prompt="You are a Security Expert. Review the Architect's protocol for vulnerabilities and propose strict JSON rules. Keep responses extremely concise (1 paragraph max).",
        model=model,
        memory=InMemoryMemory(),
        formatter=OpenAIChatFormatter(),
        toolkit=empty_toolkit
    )

    developer = ReActAgent(
        name="Developer",
        sys_prompt="You are a Lead Developer. Synthesize the Architect and Security Expert notes into a single valid JSON template. Output NOTHING but the JSON.",
        model=model,
        memory=InMemoryMemory(),
        formatter=OpenAIChatFormatter(),
        toolkit=empty_toolkit
    )

    initial_task = Msg("User", "Design a local messaging protocol for AI agents to pass data to one another.", "user")
    
    print("\n--- [1] Architect Designing ---")
    msg1 = await architect(initial_task)
    print(msg1.content)
    
    print("\n--- [2] Security Expert Reviewing ---")
    msg2 = await security(msg1)
    print(msg2.content)
    
    print("\n--- [3] Developer Synthesizing ---")
    msg3 = await developer(msg2)
    print(msg3.content)
    
    print("\n--- Swarm Complete ---")

if __name__ == "__main__":
    asyncio.run(main())

