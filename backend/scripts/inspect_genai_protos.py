
import google.generativeai as genai
import inspect

print("Attributes in genai.protos:")
for name, obj in inspect.getmembers(genai.protos):
    if "Search" in name or "Tool" in name:
        print(f" - {name}")

print("\nFields in genai.protos.Tool:")
try:
    tool = genai.protos.Tool()
    # Protobuf messages usually have descriptors or we can try directory
    print(dir(tool))
except Exception as e:
    print(f"Error inspecting Tool: {e}")
