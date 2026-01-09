
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

if __name__ == "__main__":
    print("Starting uvicorn...")
    try:
        uvicorn.run(app, port=8006)
    except Exception as e:
        print(f"Error: {e}")
