with open("src/components/consumer/ConsumerFeed.tsx", "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if line.strip() == "onNavigateToTab={onNavigateToTab}":
        continue
    if line.strip() == "onNavigateToTab={onRequireAuth}":
        continue
    if "export default function ConsumerFeed({" in line:
        new_lines.append("export default function ConsumerFeed({ onNavigateToProfile, onRequireAuth, onNavigateToTab }: { onNavigateToProfile?: () => void, onRequireAuth?: () => void, onNavigateToTab?: (tab: string) => void }) {\n")
        continue
    new_lines.append(line)

with open("src/components/consumer/ConsumerFeed.tsx", "w") as f:
    f.writelines(new_lines)
