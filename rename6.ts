import * as fs from 'fs';
import * as path from 'path';

const filepath = './src/components/profile/UserProfile.tsx';
let content = fs.readFileSync(filepath, 'utf8');
content = content.replace(/Episodes in this folder/g, 'Clips in this folder');
fs.writeFileSync(filepath, content, 'utf8');
console.log('Modified UserProfile.tsx');
