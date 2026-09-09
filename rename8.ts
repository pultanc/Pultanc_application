import * as fs from 'fs';
import * as path from 'path';

const filepath = './src/data.ts';
let content = fs.readFileSync(filepath, 'utf8');
content = content.replace(/mockClips:/g, 'mockSeries:');
fs.writeFileSync(filepath, content, 'utf8');
console.log('Modified data.ts');
