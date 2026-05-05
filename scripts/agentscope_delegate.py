import sys
import os
import json

# Ensure we use the correct venv for AgentScope
AGENTSCOPE_VENV_PATH = "/home/sanket758/Tools/.venv/lib/python3.10/site-packages"
if AGENTSCOPE_VENV_PATH not in sys.path:
    sys.path.append(AGENTSCOPE_VENV_PATH)

import agentscope
from agentscope.agents import DialogAgent
from agentscope.message import Msg

def main():
    if len(sys.argv) < 2:
        print("Usage: python agentscope_delegate.py '<task_description>'")
        sys.exit(1)

    task = sys.argv[1]

    # Model configuration for Ollama
    model_configs = [
        {
            "config_name": "ollama_coder",
            "model_type": "ollama_chat",
            "model_name": "qwen2.5-coder:7b-instruct-q4_K_M",
            "generate_args": {
                "temperature": 0.1,
            }
        },
        {
            "config_name": "ollama_general",
            "model_type": "ollama_chat",
            "model_name": "llama3:latest",
        }
    ]

    # Initialize AgentScope
    agentscope.init(model_configs=model_configs)

    # Define a simple delegation agent (The Master)
    # For now, we just route everything to the coder or general model based on simple keyword matching
    # In a more advanced version, this would be a ReActAgent.
    
    is_code = any(kw in task.lower() for kw in ["python", "code", "script", "fix", "error", "function"])
    
    config_name = "ollama_coder" if is_code else "ollama_general"
    
    worker = DialogAgent(
        name="LocalWorker",
        sys_prompt="You are a helpful assistant running locally. Keep your answers concise and efficient.",
        model_config_name=config_name
    )

    # Process the task
    msg = Msg("User", task)
    response = worker(msg)

    print(response.content)

if __name__ == "__main__":
    main()
