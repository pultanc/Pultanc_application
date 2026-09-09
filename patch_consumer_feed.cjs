const fs = require('fs');
let content = fs.readFileSync('src/components/consumer/ConsumerFeed.tsx', 'utf8');

// Move the clips line up (top-[60px] to top-14 or top-12)
content = content.replace(
  'absolute top-[60px] inset-x-0 h-1 flex gap-0.5 z-20 px-2',
  'absolute top-12 inset-x-0 h-1 flex gap-0.5 z-20 px-2'
);

fs.writeFileSync('src/components/consumer/ConsumerFeed.tsx', content);
