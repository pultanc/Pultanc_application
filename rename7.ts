import * as fs from 'fs';
import * as path from 'path';

const filepath = './src/components/matrix/TransactionLedger.tsx';
let content = fs.readFileSync(filepath, 'utf8');
content = content.replace(/SERIES \/ CLIP/g, 'CLIP');
fs.writeFileSync(filepath, content, 'utf8');
console.log('Modified TransactionLedger.tsx');
