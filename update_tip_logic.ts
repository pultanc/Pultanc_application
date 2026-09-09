import fs from 'fs';
let content = fs.readFileSync('src/components/profile/UserProfile.tsx', 'utf-8');
content = content.replace(
  'const handleTipSubmit = async () => {',
  `const handleTipSubmit = async () => {
    if (profileData?.status === 'under_review' || profileData?.status === 'banned') {
      alert("This account is currently under review and cannot receive payments.");
      return;
    }`
);
fs.writeFileSync('src/components/profile/UserProfile.tsx', content, 'utf-8');
console.log("Tip logic updated.");
