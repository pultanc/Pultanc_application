with open("src/components/consumer/ConsumerFeed.tsx", "r") as f:
    content = f.read()
import re
content = re.sub(r"              onRequireAuth(,?)\n", r"              onRequireAuth\1\n              onNavigateToTab={onNavigateToTab}\n", content)
with open("src/components/consumer/ConsumerFeed.tsx", "w") as f:
    f.write(content)
