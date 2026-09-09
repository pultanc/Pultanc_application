import re

with open("src/components/consumer/ConsumerFeed.tsx", "r") as f:
    content = f.read()

pattern = r"      \{showTipModal && \(\n        <div className=\"fixed inset-0 z-\[200\].*?</div>\n      \)\}"
match = re.search(pattern, content, flags=re.DOTALL)
if match:
    tip_modal = match.group(0)
    content = content.replace(tip_modal, "")
    
    # We will split the file by "export default function ConsumerFeed"
    parts = content.split("export default function ConsumerFeed")
    if len(parts) == 2:
        # Before this is FeedPost ending
        part1 = parts[0]
        # Find the last </div>\n  );\n}\n
        if part1.endswith("    </div>\n  );\n}\n\n"):
            part1 = part1.replace("    </div>\n  );\n}\n\n", tip_modal + "\n    </div>\n  );\n}\n\n")
            content = part1 + "export default function ConsumerFeed" + parts[1]
        elif part1.endswith("    </div>\n  );\n}\n"):
            part1 = part1.replace("    </div>\n  );\n}\n", tip_modal + "\n    </div>\n  );\n}\n")
            content = part1 + "export default function ConsumerFeed" + parts[1]
        else:
            print("Could not find the end of FeedPost properly.")
            # Let's try regex substitution on part1
            part1 = re.sub(r"    </div>\n  \);\n}\n*$", tip_modal + "\n    </div>\n  );\n}\n\n", part1)
            content = part1 + "export default function ConsumerFeed" + parts[1]
    
    with open("src/components/consumer/ConsumerFeed.tsx", "w") as f:
        f.write(content)
else:
    print("tip_modal not found")

