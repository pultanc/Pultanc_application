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
    { target: 'Ep {', replacement: 'Clip {' },
    { target: 'Next Ep', replacement: 'Next Clip' },
    { target: 'Episode Locked', replacement: 'Clip Locked' },
    { target: 'Unlock Episode', replacement: 'Unlock Clip' },
    { target: 'bookmark episodes', replacement: 'bookmark clips' },
    { target: 'episodes every month', replacement: 'clips every month' },
    { target: 'watch this episode', replacement: 'watch this clip' },
    { target: 'Report episode issue', replacement: 'Report clip issue' },
    { target: 'paying episodes', replacement: 'paying clips' },
    { target: 'your episodes', replacement: 'your clips' },
    { target: 'per Episode', replacement: 'per Clip' },
    { target: 'all episodes', replacement: 'all clips' },
    { target: 'Episode Gated', replacement: 'Clip Gated' },
    { target: 'This episode', replacement: 'This clip' },
    { target: 'Active episodes', replacement: 'Active clips' },
    { target: 'Generating Episodes', replacement: 'Generating Clips' },
    { target: 'Generate Episodes', replacement: 'Generate Clips' },
    { target: 'Episodes Generated', replacement: 'Clips Generated' },
    { target: 'episode preview', replacement: 'clip preview' },
    { target: 'Episodes 1-4', replacement: 'Clips 1-4' },
    { target: 'Episodes 5-15', replacement: 'Clips 5-15' },
    { target: 'Active Episode', replacement: 'Active Clip' },
    { target: 'Dynamic Episode', replacement: 'Dynamic Clip' },
    { target: 'Locked episodes', replacement: 'Locked clips' },
    { target: '} Episodes', replacement: '} Clips' },
    { target: 'Series Context', replacement: 'Clip Context' },
    { target: 'New Series & Episode Releases', replacement: 'New Clip Releases' },
    { target: 'Series Placeholders', replacement: 'Clip Placeholders' },
    { target: 'Mock Series', replacement: 'Mock Clips' },
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
