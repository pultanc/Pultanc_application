import re

with open("src/components/funnels/BioFunnels.tsx", "r") as f:
    content = f.read()

# Let's replace the whole handleDownloadClimerVideo function
def replace_func(func_name, var_url, var_title):
    pattern = rf"  const {func_name} = async \(\) => {{[\s\S]*?    }} catch \(err\) {{[\s\S]*?      // Fallback: download original video file directly[\s\S]*?        a\.click\(\);\n      }}\n    }}\n  }};"
    
    new_func = f"""  const {func_name} = async () => {{
    if (!{var_url}) {{
      alert("No video URL available!");
      return;
    }}
    try {{
      setIsRecordingTeaser(true);
      setIsRecordingSimTeaser(true);
      const videoUrl = {var_url};
      const fileExt = getFileExtension(videoUrl, 'mp4');
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanName = ({var_title}).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      a.download = `${{cleanName}}_full.${{fileExt}}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }} catch (fallbackErr) {{
      const a = document.createElement('a');
      a.href = {var_url};
      a.target = '_blank';
      a.download = `${{{var_title}}}_full.mp4`;
      document.body.appendChild(a);
      a.click();
    }} finally {{
      setIsRecordingTeaser(false);
      setIsRecordingSimTeaser(false);
    }}
  }};"""
    
    # We will use regex to find the start and the end of the function.
    # Actually, it's easier to just find "const handleDownloadClimerVideo = async () => {" and track the braces.
    pass

with open("src/components/funnels/BioFunnels.tsx", "r") as f:
    lines = f.readlines()

def replace_func_lines(func_name, var_url, var_title, lines):
    start_idx = -1
    for i, line in enumerate(lines):
        if line.startswith(f"  const {func_name} = async () => {{"):
            start_idx = i
            break
            
    if start_idx == -1:
        return lines
        
    end_idx = start_idx
    brace_count = 0
    for i in range(start_idx, len(lines)):
        brace_count += lines[i].count('{')
        brace_count -= lines[i].count('}')
        if brace_count == 0:
            end_idx = i
            break
            
    new_func = f"""  const {func_name} = async () => {{
    if (selectedFunnelForSim?.status === 'under_review' || selectedFunnelForSim?.status === 'banned') {{
      alert("This content is currently under review and cannot receive payments.");
      return;
    }}
    if (!{var_url}) {{
      alert("No video URL available!");
      return;
    }}
    try {{
      setIsRecordingTeaser(true);
      setIsRecordingSimTeaser(true);
      const videoUrl = {var_url};
      const fileExt = getFileExtension(videoUrl, 'mp4');
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanName = ({var_title}).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      a.download = `${{cleanName}}_full.${{fileExt}}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }} catch (fallbackErr) {{
      const a = document.createElement('a');
      a.href = {var_url};
      a.target = '_blank';
      a.download = `${{{var_title}}}_full.mp4`;
      document.body.appendChild(a);
      a.click();
    }} finally {{
      setIsRecordingTeaser(false);
      setIsRecordingSimTeaser(false);
    }}
  }};\n"""
    
    return lines[:start_idx] + [new_func] + lines[end_idx+1:]

lines = replace_func_lines("handleDownloadClimerVideo", "selectedFunnelForSim?.videoUrl", "selectedFunnelForSim?.title || 'video'", lines)
lines = replace_func_lines("handleDownloadTeaser", "editorVideoUrl", "editorTitle || 'video'", lines)

with open("src/components/funnels/BioFunnels.tsx", "w") as f:
    f.writelines(lines)
