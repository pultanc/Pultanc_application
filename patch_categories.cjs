const fs = require('fs');

const oldCatsList = "['Entertainment', 'Education', 'Gaming', 'Lifestyle', 'Music', 'Sports']";
const newCatsList = "['Entertainment', 'Education', 'Gaming', 'Lifestyle', 'Music', 'Sports', 'Movies', 'Drama', 'Documentary']";

function updateFile(file) {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(oldCatsList, newCatsList);
    // Remove <Hash .../> from Trending Categories heading
    content = content.replace(/<Hash className="w-5 h-5 text-red-500"\/>\s*Trending Categories/, "Trending Categories");
    content = content.replace(/<Hash className="w-5 h-5"\/>\s*Categories/g, "Categories");
    
    fs.writeFileSync(file, content);
}

updateFile('src/components/creator/CreatorPortal.tsx');
updateFile('src/components/funnels/BioFunnels.tsx');
updateFile('src/components/discover/DiscoverView.tsx');

