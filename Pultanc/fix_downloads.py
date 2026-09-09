import re

with open("src/components/funnels/BioFunnels.tsx", "r") as f:
    content = f.read()

# Replace MoMo Revenue
content = content.replace(">MoMo Revenue</span>", ">Revenue</span>")

# Remove "Pultanc MoMo Secure"
content = content.replace("Pultanc MoMo Secure", "")

# We also need to change the teaser download message:
# "Social sharing/teaser downloads only export the free portion up to {editorLockTime.toFixed(1)}s. The full video is restricted to our platform."
# to just something like:
# "Download the full video directly to your device."
old_message = """Social sharing/teaser downloads only export the free portion up to {editorLockTime.toFixed(1)}s. The full video is restricted to our platform."""
new_message = """Download the full video directly to your device."""
content = content.replace(old_message, new_message)
content = content.replace("Climer Teaser Only (Active)", "Video Download Ready")
content = content.replace("Fully Protected", "Full Video")

with open("src/components/funnels/BioFunnels.tsx", "w") as f:
    f.write(content)
