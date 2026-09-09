import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string, callback: (filepath: string) => void) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        if (stat && stat.isDirectory()) {
            walk(filepath, callback);
        } else {
            callback(filepath);
        }
    });
}

const replacements = [
    { target: 'Unlock This Episode', replacement: 'Unlock This Clip' },
    { target: 'Turn Long-Form Videos Into Paying Episodes', replacement: 'Turn Long-Form Videos Into Paying Clips' },
    { target: 'Generated Episodes Grid', replacement: 'Generated Clips Grid' },
    { target: 'Unlock Clip {current', replacement: 'Unlock Clip {current' },
];

walk('./src', (filepath) => {
    if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
        let content = fs.readFileSync(filepath, 'utf8');
        let modified = false;
        replacements.forEach(r => {
            if (content.includes(r.target)) {
                content = content.split(r.target).join(r.replacement);
                modified = true;
            }
        });
        if (modified) {
            fs.writeFileSync(filepath, content, 'utf8');
            console.log(`Modified ${filepath}`);
        }
    }
});
