from fastapi import FastAPI
from litigaforge_engine import forge_case
from pydantic import BaseModel

app = FastAPI(title="LitigaForge AI")

class PromptRequest(BaseModel):
    prompt: str

@app.post("/forge")
async def forge(request: PromptRequest):
    result = forge_case(request.prompt)
    return {
        "status": "success",
        "output": result
    }

@app.get("/")
async def root():
    return {
        "message": "🚀 LitigaForge AI is running!",
        "usage": "POST /forge with {'prompt': 'your legal prompt here'}"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
