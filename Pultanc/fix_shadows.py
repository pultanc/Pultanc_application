import os
import re

def remove_shadow_classes(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Remove any word starting with shadow- or drop-shadow-
    # Also remove "shadow" if used as a standalone class (but careful not to match standard properties in style={})
    # We will look for classNames and modify them
    
    # Simple regex substitution for shadow utility classes
    new_content = re.sub(r'\b(shadow-[a-zA-Z0-9/-]+|drop-shadow-[a-zA-Z0-9/-]+|shadow|drop-shadow)\b', '', content)
    
    # Fix multiple spaces that might have been left
    new_content = re.sub(r' +', ' ', new_content)
    # Fix spaces before quotes in className="..."
    new_content = re.sub(r' "', '"', new_content)
    new_content = re.sub(r'" ', '"', new_content)

    if content != new_content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Removed shadows from {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.css', '.html')):
            remove_shadow_classes(os.path.join(root, file))
