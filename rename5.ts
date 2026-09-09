import * as fs from 'fs';
import * as path from 'path';

const filepath = './src/components/profile/UserProfile.tsx';
let content = fs.readFileSync(filepath, 'utf8');
content = content.replace(/> Series/g, '> Clips');
content = content.replace(/ \/> Series/g, ' /> Clips');
fs.writeFileSync(filepath, content, 'utf8');
console.log('Modified UserProfile.tsx');
