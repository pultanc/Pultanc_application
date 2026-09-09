const fs = require('fs');
let content = fs.readFileSync('src/components/consumer/ConsumerFeed.tsx', 'utf8');

content = content.replace(
  /\`GHS \${subscribePrice\.toFixed\(2\)}\`/g,
  "'Subscribe to Creator'"
);

content = content.replace(
  /<UserPlus className="w-3\.5 h-3\.5"\/> GHS \{subscribePrice\.toFixed\(2\)\}/g,
  '<UserPlus className="w-3.5 h-3.5"/> Subscribe'
);

fs.writeFileSync('src/components/consumer/ConsumerFeed.tsx', content);
