import * as fs from 'fs';

const file = 'src/components/consumer/ConsumerFeed.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const [showComments, setShowComments] = useState(false);",
  "const [showComments, setShowComments] = useState(false);\n  const [showShareModal, setShowShareModal] = useState(false);\n  const [shareSearchQuery, setShareSearchQuery] = useState('');\n  const [shareUsers, setShareUsers] = useState<any[]>([]);"
);

content = content.replace(
  "<button onClick={() => onToast('Link copied!')} className=\"flex items-center gap-1.5 group hover:opacity-80 transition-opacity md:flex-col md:gap-1\">",
  "<button onClick={() => setShowShareModal(true)} className=\"flex items-center gap-1.5 group hover:opacity-80 transition-opacity md:flex-col md:gap-1\">"
);

fs.writeFileSync(file, content);
