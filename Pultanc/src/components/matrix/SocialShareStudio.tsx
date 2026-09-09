import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { 
 Download, 
 Copy, 
 Check, 
 Smartphone, 
 Layers, 
 TrendingUp, 
 Coins, 
 Users, 
 Video,
 Award,
 ArrowRight,
 QrCode,
 Sparkles,
 Share2,
  Save,
  CheckCircle2,
  Pin
} from 'lucide-react';
import { auth, db } from '../../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ExternalLink } from 'lucide-react';

interface AchievementType {
 id: string;
 label: string;
 icon: React.ComponentType<any>;
 defaultVal: string;
 category: string;
 description: string;
 captionTemplate: string;
}

const ACHIEVEMENT_TYPES: AchievementType[] = [
 {
 id: 'payout',
 label: 'Net Take-Home Payout',
 icon: Coins,
 defaultVal: 'GHS 0.00',
 category: 'MONETIZATION MILESTONE',
 description: 'Direct cash flow cleared and payout settled to mobile money.',
 captionTemplate: 'Monetization milestone cleared! Just withdrew {value} from my cliffhanger video paywalls on Pultanc! 🚀 Lock clips, get paid. Start earning at pultanc.com'
 },
 {
 id: 'conversion',
 label: 'Paywall Conversion Rate',
 icon: TrendingUp,
 defaultVal: '0.0%',
 category: 'CONVERSION CHAMPION',
 description: 'Percentage of exclusive viewers who unlocked past the paywall.',
 captionTemplate: '12.4% paywall conversion on my latest releases! 📈 My fans love the cliffhanger clips, and Pultanc keeps payments seamless. Join the wave: pultanc.com'
 },
 {
 id: 'revenue',
 label: 'Total Accumulated Revenue',
 icon: Award,
 defaultVal: 'GHS 0.00',
 category: 'CREATOR EMPIRE',
 description: 'Cumulative gross revenue earned across all clips and channels.',
 captionTemplate: 'Hit my biggest creator milestone yet: {value} gross sales on Pultanc! 🍾 Thank you to all my supporters. Elevate your video income: pultanc.com'
 }
];

interface ThemeOption {
 id: string;
 name: string;
 bgGradient: string[]; // start, end
 textColor: string;
 accentColor: string;
 accentBg: string;
 glowColor: string;
}

const THEME_OPTIONS: ThemeOption[] = [
 {
 id: 'coca-cola',
 name: 'Classic Red',
 bgGradient: ['#F40009', '#F40009'],
 textColor: '#ffffff',
 accentColor: '#ffffff',
 accentBg: 'rgba(255, 255, 255, 0.2)',
 glowColor: 'rgba(255, 255, 255, 0.2)'
 }
];

const TEMP_SOCIAL_DRAFT_KEY = 'pultanc_temp_social_draft';

interface TempSocialDraft {
  cardTitle: string;
  cardSubtitle: string;
  aspectRatio: '1:1' | '9:16';
  platform?: string;
  signature?: string;
  updatedAt: number;
}

let sessionSocialCardDraft: TempSocialDraft | null = null;

export default function SocialShareStudio({ onNavigateToTab }: { onNavigateToTab?: (tab: string, creatorHandle?: string | null) => void }) {
  const getInitialSocialDraft = (): TempSocialDraft | null => {
    if (sessionSocialCardDraft) return sessionSocialCardDraft;
    try {
      const stored = sessionStorage.getItem(TEMP_SOCIAL_DRAFT_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  };

  const initialDraft = getInitialSocialDraft();
  const [cardTitle, setCardTitle] = useState<string>(() => initialDraft?.cardTitle || 'Net Take-Home Payout');
  const [cardSubtitle, setCardSubtitle] = useState<string>(() => initialDraft?.cardSubtitle || 'Direct cash flow cleared and payout settled to mobile money.');
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementType>(ACHIEVEMENT_TYPES[0]);
  const [customValue, setCustomValue] = useState<string>(ACHIEVEMENT_TYPES[0].defaultVal);

  const buildShareableUrl = (tag: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pultanc.com';
    const cleanTag = (tag || 'creator').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'creator';
    return `${origin}/@${cleanTag}?card=social`;
  };

  const getInitialHandle = () => {
    try {
      const stored = localStorage.getItem('pultanc_creator_handle') || localStorage.getItem('pultanc_user_handle');
      if (stored) return stored.toLowerCase().replace(/[^a-z0-9_]/g, '');
    } catch (e) {}
    if (auth.currentUser) {
      return (auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'creator').toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
    return 'creator';
  };

  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>(THEME_OPTIONS[0]);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16'>(() => initialDraft?.aspectRatio || '1:1');
  const [creatorName, setCreatorName] = useState<string>(getInitialHandle);
  const [referralUrl, setReferralUrl] = useState<string>(() => buildShareableUrl(getInitialHandle()));
  const [copied, setCopied] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string>('');
  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);

  const handleOpenConsumerPublicPage = () => {
    const clean = (creatorName || 'creator').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'creator';
    const targetUrl = `/@${clean}?card=social`;
    try {
      window.history.pushState({}, '', targetUrl);
      window.dispatchEvent(new CustomEvent('pultanc_card_view', { detail: { card: 'social', creator: clean } }));
    } catch (e) {}
    if (onNavigateToTab) {
      onNavigateToTab('profile', clean);
    }
  };

  // Keep temporary in-progress draft synchronized so leaving the screen doesn't lose work
  useEffect(() => {
    const draft: TempSocialDraft = {
      cardTitle,
      cardSubtitle,
      aspectRatio,
      platform: 'Powered by Pultanc',
      signature: 'Powered by Pultanc',
      updatedAt: Date.now()
    };
    sessionSocialCardDraft = draft;
    try {
      sessionStorage.setItem(TEMP_SOCIAL_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {}
  }, [cardTitle, cardSubtitle, aspectRatio]);

  const handleSaveTempDraft = () => {
    const draft: TempSocialDraft = {
      cardTitle,
      cardSubtitle,
      aspectRatio,
      platform: 'Powered by Pultanc',
      signature: 'Powered by Pultanc',
      updatedAt: Date.now()
    };
    sessionSocialCardDraft = draft;
    try {
      sessionStorage.setItem(TEMP_SOCIAL_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {}
    toast.success('Social Card draft saved!');
  };

  const handleResetDraft = () => {
    sessionSocialCardDraft = null;
    try {
      sessionStorage.removeItem(TEMP_SOCIAL_DRAFT_KEY);
    } catch (e) {}
    setCardTitle('Net Take-Home Payout');
    setCardSubtitle('Direct cash flow cleared and payout settled to mobile money.');
    setAspectRatio('1:1');
    toast.success('Social Card draft reset');
  };

 useEffect(() => {
 const unsubscribeAuth = auth.onAuthStateChanged((user) => {
 if (user) {
 // Fallback creator handle from display name / email
 if (user.photoURL) setProfilePicUrl(user.photoURL);
        const defaultTag = (user.displayName || user.email?.split('@')[0] || 'pultanc_creator')
 .toLowerCase()
 .replace(/[^a-z0-9_]/g, '_');
 setCreatorName(defaultTag);
 setReferralUrl(buildShareableUrl(defaultTag));

 const userDocRef = doc(db, 'users', user.uid);
 const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
 if (docSnap.exists()) {
 const data = docSnap.data();
 const candidateHandle = (data.username || data.handle?.replace(/^@/, '') || data.name || defaultTag).toLowerCase().replace(/[^a-z0-9_]/g, '');
						const tag = candidateHandle || defaultTag;
						setCreatorName(tag);
						setReferralUrl(buildShareableUrl(tag));
						try { localStorage.setItem('pultanc_creator_handle', tag); } catch(e){}
 if (data.photoURL) setProfilePicUrl(data.photoURL);
          if (data.balance !== undefined) {
 setAccountBalance(data.balance);
 }
 }
 }, (err) => {
 console.warn("Failed to listen to profile changes in SocialShareStudio:", err);
 });

 const verifyDocRef = doc(db, 'verifications', user.uid);
 const unsubscribeVerify = onSnapshot(verifyDocRef, (docSnap) => {
 if (docSnap.exists() && docSnap.data().status === 'verified') {
 setIsVerified(true);
 } else {
 setIsVerified(false);
 }
 }, (err) => {
 console.warn("Failed to listen to verification changes in SocialShareStudio:", err);
 });

 return () => {
 unsubscribeProfile();
 unsubscribeVerify();
 };
 } else {
 setCreatorName('pultanc_creator');
 setReferralUrl('pultanc.com/u/creator');
 setAccountBalance(null);
 setIsVerified(false);
 }
 });

 return () => unsubscribeAuth();
 }, []);

 // Sync custom value when achievement selection or account balance changes
 useEffect(() => {
 let calculatedValue = selectedAchievement.defaultVal;
 // user values handled directly
    if (selectedAchievement.id === 'payout') {
 const balanceToUse = accountBalance !== null ? accountBalance : 0.00;
 calculatedValue = `GHS ${Number(balanceToUse).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
 } else if (selectedAchievement.id === 'revenue') {
 const balanceToUse = accountBalance !== null ? accountBalance : 0.00;
 const totalAccumulated = balanceToUse > 0 ? (balanceToUse / 0.70) : 0.00; // Formula representing gross revenue split
 calculatedValue = `GHS ${Number(totalAccumulated).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
 } else if (selectedAchievement.id === 'conversion') {
 calculatedValue = '0.0%';
 }
 setCustomValue(calculatedValue);
 }, [selectedAchievement, accountBalance]);

 
  useEffect(() => {
    if (profilePicUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        avatarImgRef.current = img;
        drawCanvas();
      };
      img.src = profilePicUrl;
    }
  }, [profilePicUrl]);

  // Redraw canvas whenever options change
 useEffect(() => {
 drawCanvas();
 }, [cardTitle, cardSubtitle, selectedTheme, aspectRatio, creatorName, referralUrl, isVerified]);

 const drawQRCode = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, text: string) => {
 const modules = 21;
 const blockSize = size / modules;

 ctx.fillStyle = "#000000";
 const drawBlock = (col: number, row: number) => {
 ctx.fillRect(x + col * blockSize, y + row * blockSize, blockSize + 0.5, blockSize + 0.5);
 };

 const drawFinder = (colStart: number, rowStart: number) => {
 
 ctx.fillRect(x + colStart * blockSize, y + rowStart * blockSize, 7 * blockSize, 7 * blockSize);
 
 ctx.fillStyle = "#ffffff";
 ctx.fillRect(x + (colStart + 1) * blockSize, y + (rowStart + 1) * blockSize, 5 * blockSize, 5 * blockSize);
 
 ctx.fillStyle = "#000000";
 ctx.fillRect(x + (colStart + 2) * blockSize, y + (rowStart + 2) * blockSize, 3 * blockSize, 3 * blockSize);
 };

 drawFinder(0, 0);
 drawFinder(modules - 7, 0);
 drawFinder(0, modules - 7);

 
 ctx.fillRect(x + 14 * blockSize, y + 14 * blockSize, 5 * blockSize, 5 * blockSize);
 ctx.fillStyle = "#ffffff";
 ctx.fillRect(x + 15 * blockSize, y + 15 * blockSize, 3 * blockSize, 3 * blockSize);
 ctx.fillStyle = "#000000";
 ctx.fillRect(x + 16 * blockSize, y + 16 * blockSize, blockSize, blockSize);

 
 for (let i = 8; i < modules - 8; i += 2) {
 drawBlock(6, i);
 drawBlock(i, 6);
 }

 let hash = 0;
 for (let i = 0; i < text.length; i++) {
 hash = (hash << 5) - hash + text.charCodeAt(i);
 hash |= 0;
 }

 
 for (let col = 0; col < modules; col++) {
 for (let row = 0; row < modules; row++) {
 const isTL = col < 8 && row < 8;
 const isTR = col >= modules - 8 && row < 8;
 const isBL = col < 8 && row >= modules - 8;
 const isAlign = col >= 13 && col < 19 && row >= 13 && row < 19;
 const isTiming = col === 6 || row === 6;

 if (isTL || isTR || isBL || isAlign || isTiming) continue;

 const seed = Math.sin(col * 12.9898 + row * 78.233 + hash) * 43758.5453;
 const rand = seed - Math.floor(seed);
 if (rand > 0.42) {
 drawBlock(col, row);
 }
 }
 }
 };

 const drawCanvas = () => {
 const canvas = canvasRef.current;
 if (!canvas) return;
 const ctx = canvas.getContext('2d');
 if (!ctx) return;

 const width = 1080;
 const height = aspectRatio === '1:1' ? 1080 : 1920;
 canvas.width = width;
 canvas.height = height;
      // 1. SOLID BASE (Single color background)
      const baseColor = selectedTheme.bgGradient[0];
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, width, height);

      // 2. DIMENSIONAL LIGHTING & ORGANIC SHADOWS (To simulate matte 3D surface)
      const isLight = selectedTheme.id === 'alabaster' || selectedTheme.id === 'clay-pink' || selectedTheme.id === 'sage-green';
      
      // Top-left soft highlight
      const hlGrad = ctx.createRadialGradient(width * 0.2, height * 0.1, 0, width * 0.4, height * 0.3, width * 0.8);
      hlGrad.addColorStop(0, isLight ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)');
      hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hlGrad;
      ctx.fillRect(0, 0, width, height);

      // Bottom-right soft shadow
      const shGrad = ctx.createRadialGradient(width * 0.8, height * 0.9, 0, width * 0.6, height * 0.7, width * 0.8);
      shGrad.addColorStop(0, isLight ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.4)');
      shGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shGrad;
      ctx.fillRect(0, 0, width, height);

      // 2.5 PROCEDURAL NOISE / SUBTLE GRAIN (Paper / Matte texture)
      // We generate a tiny offscreen canvas with noise and pattern it
      const noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = 128;
      noiseCanvas.height = 128;
      const nCtx = noiseCanvas.getContext('2d');
      if (nCtx) {
        const idata = nCtx.createImageData(128, 128);
        const buffer32 = new Uint32Array(idata.data.buffer);
        const noiseIntensity = isLight ? 15 : 25; // alpha value for noise
        for (let i = 0; i < buffer32.length; i++) {
          const v = Math.random() < 0.5 ? 255 : 0;
          buffer32[i] = (noiseIntensity << 24) | (v << 16) | (v << 8) | v;
        }
        nCtx.putImageData(idata, 0, 0);
        const pattern = ctx.createPattern(noiseCanvas, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.globalCompositeOperation = 'overlay';
          ctx.fillRect(0, 0, width, height);
          ctx.globalCompositeOperation = 'source-over';
        }
      }

    // 3. 3D GLASS / CLAY CARD CONTAINER
 const isSquare = aspectRatio === '1:1';
 const cardX = 35;
 const cardY = isSquare ? 50 : 200;
 const cardW = width - (cardX * 2);
 const cardH = isSquare ? 980 : 1520;

 // Draw shadow first for 3D depth
 ctx.shadowColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.6)';
 ctx.shadowBlur = 40;
 ctx.shadowOffsetY = 20;

 const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
 ctx.beginPath();
 ctx.moveTo(x + r, y);
 ctx.lineTo(x + w - r, y);
 ctx.quadraticCurveTo(x + w, y, x + w, y + r);
 ctx.lineTo(x + w, y + h - r);
 ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
 ctx.lineTo(x + r, y + h);
 ctx.quadraticCurveTo(x, y + h, x, y + h - r);
 ctx.lineTo(x, y + r);
 ctx.quadraticCurveTo(x, y, x + r, y);
 ctx.closePath();
 };

 // Fill card with base color (matte clay feel)
 ctx.fillStyle = baseColor;
 drawRoundRect(cardX, cardY, cardW, cardH, 32);
 ctx.fill();

 // Reset shadow
 ctx.shadowBlur = 0;
 ctx.shadowOffsetY = 0;
 ctx.shadowColor = 'transparent';

 // 3D Specular inner highlight (liquid glass / molded edge)
 ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)';
 ctx.lineWidth = 2;
 drawRoundRect(cardX + 1, cardY + 1, cardW - 2, cardH - 2, 31);
 ctx.stroke();

 // Subtle inner shadow / bevel
 ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.3)';
 ctx.lineWidth = 2;
 drawRoundRect(cardX - 1, cardY - 1, cardW + 2, cardH + 2, 33);
 ctx.stroke();

 // Apply noise to card as well
 if (nCtx) {
    const pattern = ctx.createPattern(noiseCanvas, 'repeat');
    if (pattern) {
      ctx.save();
      drawRoundRect(cardX, cardY, cardW, cardH, 32);
      ctx.clip();
      ctx.fillStyle = pattern;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.restore();
    }
 }

 // 4. HEADER BRANDING & AVATAR
 const pillH = isSquare ? 110 : 130;
 const pillW = isSquare ? 480 : 560;
 const pillX = (width - pillW) / 2;
 const pillY = cardY + (isSquare ? 80 : 120);

 const handleText = `@${creatorName.toLowerCase()}`;
 ctx.font = isSquare ? '400 38px "Helvetica Neue", Helvetica, Arial, sans-serif' : '400 50px "Helvetica Neue", Helvetica, Arial, sans-serif';
 const textWidth = ctx.measureText(handleText).width;
 const badgeWidth = isVerified ? 30 : 0;
 const radius = isSquare ? 65 : 85;
 const gap = isSquare ? 15 : 20;
    
 const totalWidth = (radius * 2) + gap + textWidth + badgeWidth;
 const startX = (width - totalWidth) / 2;
    
 const avatarX = startX + radius;
 const avatarY = pillY + pillH / 2;

 // Avatar
 if (avatarImgRef.current) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatarImgRef.current, avatarX - radius, avatarY - radius, radius * 2, radius * 2);
  ctx.restore();
 } else {
  ctx.fillStyle = selectedTheme.id === 'pearl' ? '#000' : '#fff';
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
  ctx.fill();
 }

 ctx.strokeStyle = selectedTheme.id === 'pearl' ? 'rgba(0,0,0,0.1)' : 'rgba(255, 255, 255, 0.2)';
 ctx.lineWidth = 1;
 ctx.beginPath();
 ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
 ctx.stroke();

 // Handle text
 ctx.fillStyle = selectedTheme.textColor;
 ctx.textAlign = 'left';
 ctx.fillText(handleText, avatarX + radius + gap, avatarY + (isSquare ? 12 : 16));

 // Verified Badge
 if (isVerified) {
  const badgeX = avatarX + radius + gap + textWidth + 15;
  const badgeY = avatarY - 2;
  
  ctx.fillStyle = selectedTheme.id === 'pearl' ? '#000' : '#fff';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.strokeStyle = selectedTheme.id === 'pearl' ? '#fff' : '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(badgeX - 3, badgeY + 1);
  ctx.lineTo(badgeX - 1, badgeY + 3);
  ctx.lineTo(badgeX + 4, badgeY - 3);
  ctx.stroke();
 }

 // 7. GIANT STAT VALUE (Elegant & Thin)
 const valY = cardY + (isSquare ? 420 : 540);
 ctx.fillStyle = selectedTheme.textColor;
 ctx.textAlign = 'center';
 ctx.shadowBlur = 0;
 ctx.font = isSquare ? '700 60px "Helvetica Neue", Helvetica, Arial, sans-serif' : '700 75px "Helvetica Neue", Helvetica, Arial, sans-serif';
 ctx.fillText(customValue, width / 2, valY);

 // Elegant thin separator
 const barW = isSquare ? 120 : 160;
 const barH = 1;
 const barX = (width - barW) / 2;
 const barY = valY + (isSquare ? 35 : 50);

 ctx.fillStyle = selectedTheme.id === 'pearl' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
 ctx.fillRect(barX, barY, barW, barH);

 // 8. EXPLANATION SUBTEXT
 const descY = valY + (isSquare ? 90 : 130);
 ctx.fillStyle = selectedTheme.id === 'pearl' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
 ctx.font = isSquare ? '500 28px "Helvetica Neue", Helvetica, Arial, sans-serif' : '500 36px "Helvetica Neue", Helvetica, Arial, sans-serif';
    
 const wrapText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
 const words = text.split(' ');
 let line = '';
 let currentY = y;

 for (let n = 0; n < words.length; n++) {
 let testLine = line + words[n] + ' ';
 let metrics = ctx.measureText(testLine);
 let testWidth = metrics.width;
 if (testWidth > maxWidth && n > 0) {
 ctx.fillText(line, x, currentY);
 line = words[n] + ' ';
 currentY += lineHeight;
 } else {
 line = testLine;
 }
 }
 ctx.fillText(line, x, currentY);
 };

 wrapText(
 selectedAchievement.description,
 width / 2,
 descY,
 cardW - (isSquare ? 160 : 200),
 isSquare ? 42 : 54
 );

 // 9. QR DECORATION AND APP LINK BRANDING (Footer segment)
 const footY = cardY + cardH - (isSquare ? 230 : 290);

 // Visual divider
 ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
 ctx.lineWidth = 1.5;
 ctx.beginPath();
 ctx.moveTo(cardX + 60, footY - (isSquare ? 15 : 20));
 ctx.lineTo(cardX + cardW - 60, footY - (isSquare ? 15 : 20));
 ctx.stroke();

 // Side-by-side QR Code and CTA block
 const qrSize = isSquare ? 115 : 160;
 const qrX = cardX + 60;
 const qrY = footY + (isSquare ? 5 : 10);

 // Draw stylized QR Code background card
 ctx.fillStyle = '#ffffff';
 ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
 drawRoundRect(qrX - (isSquare ? 8 : 12), qrY - (isSquare ? 8 : 12), qrSize + (isSquare ? 16 : 24), qrSize + (isSquare ? 16 : 24), isSquare ? 14 : 20);
 ctx.fill();
 ctx.stroke();

 // Render QR Code
 drawQRCode(ctx, qrX, qrY, qrSize, referralUrl);

 // Render CTA details next to QR Code
 const textX = qrX + qrSize + (isSquare ? 25 : 40);
 const textY = qrY + (isSquare ? 26 : 40);

 ctx.textAlign = 'left';
 ctx.fillStyle = selectedTheme.textColor;
 ctx.font = isSquare ? 'bold 24px monospace' : 'bold 34px monospace';
 
 const ctaTitle = 'SCAN TO WATCH EXCLUSIVE SERIES';

  ctx.fillText(ctaTitle, textX, textY);

 // Custom referral URL
 ctx.font = isSquare ? 'bold 38px system-ui, sans-serif' : 'bold 50px system-ui, sans-serif';
 const displayUrl = referralUrl.split('?')[0].replace(/^https?:\/\//, '').toLowerCase();
 const urlWidth = ctx.measureText(displayUrl).width;
 
 const urlY = textY + (isSquare ? 15 : 20);
 const urlPillW = urlWidth + 40;
 const urlPillH = isSquare ? 60 : 80;

 ctx.fillStyle = '#ffffff';
 ctx.beginPath();
 drawRoundRect(textX, urlY, urlPillW, urlPillH, 12);
 ctx.fill();
 
 ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
 ctx.lineWidth = 2;
 ctx.stroke();
 
 ctx.fillStyle = '#000000';
 ctx.fillText(displayUrl, textX + 20, urlY + (isSquare ? 42 : 55));
 };

 
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `${creatorName}_milestone.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'My Milestone',
              text: selectedAchievement.captionTemplate.replace('{value}', customValue),
              files: [file]
            });
          } catch (err) {
            console.error('Share failed', err);
            handleDownload();
          }
        } else {
          handleDownload();
        }
      }, 'image/png');
  };


  const handleDownload = () => {
    // Ensure downloading exports the cute 1:1 square card so it never covers the entire phone screen
    if (aspectRatio !== '1:1') {
      setAspectRatio('1:1');
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${creatorName}_${selectedAchievement.id}_card.png`;
        link.href = dataUrl;
        link.click();
        toast.success('Social Card saved to device!');
      }, 100);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${creatorName}_${selectedAchievement.id}_card.png`;
    link.href = dataUrl;
    link.click();
    toast.success('Social Card saved to device!');
  };



 return (
 <div id="social-share-studio" className="layered-container p-5 md:p-8 pb-16 space-y-6 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-zinc-800 rounded-3xl max-w-5xl mx-auto shadow-sm">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-zinc-850">
 <div>
 
 <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
 My Social Card
 </h2>
 <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
 Generate high-resolution custom graphics to share your earnings, views, or paywall stats on socials.
 </p>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
 {/* Left 7 Columns: Creative Controls */}
        <div className="lg:col-span-7 space-y-5 text-left">
          {/* Aspect Ratio Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-wider block">
              1. Canvas Aspect Ratio
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  aspectRatio === '9:16'
                    ? 'bg-red-600 border-red-600 text-white shadow-sm'
                    : 'bg-gray-50/50 dark:bg-neutral-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Smartphone className="w-4 h-4"/> 9:16 Story / Reel
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('1:1')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  aspectRatio === '1:1'
                    ? 'bg-red-600 border-red-600 text-white shadow-sm'
                    : 'bg-gray-50/50 dark:bg-neutral-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Layers className="w-4 h-4"/> 1:1 Feed Square
              </button>
            </div>
          </div>

          {/* Title Input Field */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
              Title
            </label>
            <input
              type="text"
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              placeholder="Add your title (e.g. Net Take-Home Payout)"
              className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-zinc-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Subtitle Input Field */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
              Subtitle
            </label>
            <textarea
              rows={3}
              value={cardSubtitle}
              onChange={(e) => setCardSubtitle(e.target.value)}
              placeholder="Add your subtitle (e.g. Direct cash flow cleared and payout settled to mobile money.)"
              className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-zinc-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveTempDraft}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-red-500/20 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all text-xs font-semibold"
              title="Download Card"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all text-xs font-semibold"
              title="Share Card"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>
        </div>

        {/* Right 5 Columns: Visual Canvas & Live Preview Rendering */}
 <div className="lg:col-span-5 flex flex-col items-center justify-start lg:sticky lg:top-6 space-y-4 bg-gray-50/50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800/60">

 {/* Compact Wrapper */}
 <div className="relative w-full max-w-[200px] overflow-hidden bg-zinc-950 rounded-2xl border-2 border-zinc-800 shadow-xl flex items-center justify-center p-2 group">
 
 {/* Real Canvas element drawn dynamically */}
 <canvas 
 ref={canvasRef}
 className={`w-full h-auto bg-black rounded-xl max-h-[350px] transition-all object-contain ${
 aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'
 }`}
 />

 <div className="absolute bottom-2 left-2 right-2 text-center text-[8px] text-zinc-300 font-medium bg-black/80 backdrop-blur-sm p-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
 High-res export preview
 </div>
 </div>

        {/* Separate Copy Link Section */}
        <div className="w-full max-w-[220px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800/80 rounded-xl p-2.5 flex flex-col gap-1.5 shadow-2xs">
          <span className="text-[9px] font-mono text-gray-400 font-bold uppercase tracking-wider">Consumer Public Link</span>
          <div className="flex items-center gap-1.5">
            <input 
              type="text" 
              readOnly 
              value={referralUrl} 
              onClick={handleOpenConsumerPublicPage}
              className="flex-1 bg-transparent border-none outline-none text-[11px] text-black dark:text-zinc-100 font-mono font-bold truncate cursor-pointer hover:underline"
              title="Click to visit consumer public profile page"
            />
            <button 
              type="button"
              onClick={handleOpenConsumerPublicPage}
              className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors text-gray-500 hover:text-red-500"
              title="Open consumer public page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button 
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(referralUrl);
                toast.success("Consumer public card link copied!");
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-white"
              title="Copy Link"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

 {/* Action Buttons Row */}
 <div className="flex flex-col items-center gap-2.5 w-full max-w-[220px]">
 <div className="grid grid-cols-3 gap-2 w-full">
 <button
 type="button"
 onClick={handleShare}
 title="Share Card"
 className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-white rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-all"
 >
 <Share2 className="w-4 h-4"/>
 </button>
 <button
 type="button"
 onClick={handleDownload}
 title="Download PNG"
 className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-sm"
 >
 <Download className="w-4 h-4"/>
 </button>
               <button
                type="button"
                title="Keep Temporary Draft"
                onClick={handleSaveTempDraft}
                className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-all"
              >
                <Save className="w-4 h-4"/>
              </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
