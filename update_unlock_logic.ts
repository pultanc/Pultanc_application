import fs from 'fs';
let content = fs.readFileSync('src/components/consumer/ConsumerFeed.tsx', 'utf-8');
content = content.replace(
  'const handleUnlock = async (type: \'episode\' | \'season\' | \'subscribe\') => {',
  `const handleUnlock = async (type: 'episode' | 'season' | 'subscribe') => {
    if (series?.status === 'under_review' || series?.status === 'banned') {
      onToast("This content is currently under review and cannot receive payments.");
      return;
    }`
);
fs.writeFileSync('src/components/consumer/ConsumerFeed.tsx', content, 'utf-8');
console.log("Unlock logic updated.");
