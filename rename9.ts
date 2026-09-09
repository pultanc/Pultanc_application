import * as fs from 'fs';
import * as path from 'path';

const filepath = './src/components/consumer/ConsumerFeed.tsx';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/episodePrice, seasonPrice, subscribePrice/g, 'episodePrice, subscribePrice');
content = content.replace(/'episode' \| 'season' \| 'subscribe'/g, "'episode' | 'subscribe'");

// For line 370: pricePaid = seasonPrice
// We can just find the switch/if block handling 'season'
// Let's just remove the logic manually via edit_file, or script
content = content.replace(/} else if \(type === 'season'\) \{\n\s+amountGHS = seasonPrice;/g, '');

fs.writeFileSync(filepath, content, 'utf8');
console.log('Modified ConsumerFeed.tsx');
