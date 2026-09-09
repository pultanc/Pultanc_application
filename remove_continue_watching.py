import re

with open("src/components/profile/UserProfile.tsx", "r") as f:
    content = f.read()

# Let's replace the Continue Watching block with an empty string
start_str = "            {/* Continue Watching Section - Only for Owner */}"
end_str = "            {/* Profile Content Tabs */}"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + content[end_idx:]
    with open("src/components/profile/UserProfile.tsx", "w") as f:
        f.write(new_content)
    print("Continue Watching Section removed.")
else:
    print("Could not find bounds.")

