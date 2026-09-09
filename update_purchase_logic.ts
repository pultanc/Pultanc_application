import fs from 'fs';
let content = fs.readFileSync('src/components/funnels/BioFunnels.tsx', 'utf-8');
content = content.replace(
  'const handleDownloadTeaser = async () => {',
  `const handleDownloadTeaser = async () => {
    if (selectedFunnelForSim?.status === 'under_review' || selectedFunnelForSim?.status === 'banned') {
      alert("This content is currently under review and cannot receive payments.");
      return;
    }`
);
fs.writeFileSync('src/components/funnels/BioFunnels.tsx', content, 'utf-8');
console.log("Teaser logic updated.");
