import fs from 'fs';
let content = fs.readFileSync('src/components/creator/CreatorPortal.tsx', 'utf-8');
content = content.replace('                            </div>                          ) : (', '                            </div>\\n                          ) : (');
fs.writeFileSync('src/components/creator/CreatorPortal.tsx', content, 'utf-8');
