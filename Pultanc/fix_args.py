with open("src/components/consumer/ConsumerFeed.tsx", "r") as f:
    content = f.read()

content = content.replace("  onRequireAuth={onRequireAuth}\n  onNavigateToTab", "  onRequireAuth,\n  onNavigateToTab")
content = content.replace("export default function ConsumerFeed({ onNavigateToProfile, onRequireAuth={onRequireAuth} onNavigateToTab }", "export default function ConsumerFeed({ onNavigateToProfile, onRequireAuth, onNavigateToTab }")

with open("src/components/consumer/ConsumerFeed.tsx", "w") as f:
    f.write(content)
