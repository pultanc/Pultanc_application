const fs = require('fs');

function fixFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    // Remove `Copy, ` from sonner import
    content = content.replace("import { Copy, toast } from 'sonner';", "import { toast } from 'sonner';");
    content = content.replace("import { Copy,toast } from 'sonner';", "import { toast } from 'sonner';");
    content = content.replace("import { Copy, toast } from \"sonner\";", "import { toast } from \"sonner\";");
    // Ensure `Copy` is in lucide-react
    if (content.includes('lucide-react')) {
        if (!content.includes('Copy')) {
            content = content.replace("import { ", "import { Copy, ");
        }
    } else {
        content = "import { Copy } from 'lucide-react';\n" + content;
    }
    fs.writeFileSync(file, content);
}

fixFile('src/components/matrix/TaskerCardStudio.tsx');
fixFile('src/components/matrix/SocialShareStudio.tsx');
