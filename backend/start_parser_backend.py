
try:
    from fastapi import FastAPI
    import uvicorn
    import os
    from dotenv import load_dotenv
    from routers import document_parser
    print("Imports successful")
except Exception as e:
    print(f"Import Error: {e}")
    exit(1)

# Load env vars
load_dotenv()

app = FastAPI()

app.include_router(document_parser.router)

@app.get("/")
def read_root():
    return {"status": "Test Parser App Running"}

if __name__ == "__main__":
    print("Starting test backend for parser calling uvicorn...")
    try:
        uvicorn.run(app, port=8008)
    except Exception as e:
        print(f"Error starting uvicorn: {e}")
        import traceback
        traceback.print_exc()

