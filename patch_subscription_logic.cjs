const fs = require('fs');

// 1. Patch ConsumerFeed.tsx
let feed = fs.readFileSync('src/components/consumer/ConsumerFeed.tsx', 'utf8');

// Add the useEffect to listen to subscriptions
const feedUseEffectOld = `
 useEffect(() => {
 let unsubscribe = () => {};
 const unsubscribeAuth = auth.onAuthStateChanged((user) => {
 if (user && currentEpisode) {
 const savedDocRef = doc(db, 'users', user.uid, 'savedEpisodes', \`\${series.id}_\${currentEpisode.id}\`);
 unsubscribe = onSnapshot(savedDocRef, (snap) => {
 setIsSaved(snap.exists());
 }, (err) => {
 handleFirestoreError(err, OperationType.GET, \`users/\${user.uid}/savedEpisodes/\${series.id}_\${currentEpisode.id}\`);
 });
 } else {
 setIsSaved(false);
 }
 });

 return () => {
 unsubscribeAuth();
 unsubscribe();
 };
 }, [currentEpisodeIndex, series.id, currentEpisode]);
`;

const feedUseEffectNew = `
 useEffect(() => {
 let unsubscribe = () => {};
 let unsubscribeSub = () => {};
 const unsubscribeAuth = auth.onAuthStateChanged((user) => {
 if (user) {
 if (currentEpisode) {
 const savedDocRef = doc(db, 'users', user.uid, 'savedEpisodes', \`\${series.id}_\${currentEpisode.id}\`);
 unsubscribe = onSnapshot(savedDocRef, (snap) => {
 setIsSaved(snap.exists());
 }, (err) => {
 handleFirestoreError(err, OperationType.GET, \`users/\${user.uid}/savedEpisodes/\${series.id}_\${currentEpisode.id}\`);
 });
 }
 if (series.creatorId) {
 const subRef = doc(db, 'users', user.uid, 'subscriptions', series.creatorId);
 unsubscribeSub = onSnapshot(subRef, (snap) => {
 setIsSubscribed(snap.exists());
 });
 }
 } else {
 setIsSaved(false);
 setIsSubscribed(false);
 }
 });

 return () => {
 unsubscribeAuth();
 unsubscribe();
 unsubscribeSub();
 };
 }, [currentEpisodeIndex, series.id, currentEpisode, series.creatorId]);
`;

feed = feed.replace(feedUseEffectOld, feedUseEffectNew);

// Add saving logic to ConsumerFeed
const feedSaveSubOld = `
 if (currentUnlockType === 'subscribe') {
 setIsSubscribed(true);
 }
`;
const feedSaveSubNew = `
 if (currentUnlockType === 'subscribe') {
 setIsSubscribed(true);
 if (auth.currentUser && series.creatorId) {
 const subRef = doc(db, 'users', auth.currentUser.uid, 'subscriptions', series.creatorId);
 setDoc(subRef, {
 creatorId: series.creatorId,
 subscribedAt: Date.now(),
 amountPaid: subscribePrice
 }).catch(err => console.warn('Failed to save subscription:', err));
 }
 }
`;

feed = feed.replace(feedSaveSubOld, feedSaveSubNew);
fs.writeFileSync('src/components/consumer/ConsumerFeed.tsx', feed);


// 2. Patch UserProfile.tsx
let profile = fs.readFileSync('src/components/profile/UserProfile.tsx', 'utf8');

// Add isSubscribed state
profile = profile.replace(
  "const [showSubscribeModal, setShowSubscribeModal] = useState(false);",
  "const [isSubscribed, setIsSubscribed] = useState(false);\n const [showSubscribeModal, setShowSubscribeModal] = useState(false);"
);

// Add useEffect for isSubscribed in UserProfile
const profileUseEffectOld = `
 useEffect(() => {
 const unsubscribeAuth = auth.onAuthStateChanged((user) => {
 if (user && isOwner) {
 const walletRef = doc(db, 'users', user.uid);
 onSnapshot(walletRef, (doc) => {
 if (doc.exists() && doc.data().balance !== undefined) {
 setWalletBalance(doc.data().balance);
 }
 });
 }
 });
 return () => unsubscribeAuth();
 }, [isOwner]);
`;

const profileUseEffectNew = `
 useEffect(() => {
 let unsubscribeWallet = () => {};
 let unsubscribeSub = () => {};
 const unsubscribeAuth = auth.onAuthStateChanged((user) => {
 if (user) {
 if (isOwner) {
 const walletRef = doc(db, 'users', user.uid);
 unsubscribeWallet = onSnapshot(walletRef, (doc) => {
 if (doc.exists() && doc.data().balance !== undefined) {
 setWalletBalance(doc.data().balance);
 }
 });
 }
 const creatorId = profileData?.id || (isOwner ? user.uid : 'pultanc_studios');
 if (creatorId) {
 const subRef = doc(db, 'users', user.uid, 'subscriptions', creatorId);
 unsubscribeSub = onSnapshot(subRef, (snap) => {
 setIsSubscribed(snap.exists());
 });
 }
 }
 });
 return () => {
 unsubscribeAuth();
 unsubscribeWallet();
 unsubscribeSub();
 };
 }, [isOwner, profileData?.id]);
`;

profile = profile.replace(profileUseEffectOld, profileUseEffectNew);

// Add saving logic to UserProfile
const profileSaveSubOld = `
 toast.success('Thank you! Your monthly creator subscription has been unlocked successfully! 🚀');
 return true;
`;

const profileSaveSubNew = `
 if (auth.currentUser && creatorId) {
 const subRef = doc(db, 'users', auth.currentUser.uid, 'subscriptions', creatorId);
 setDoc(subRef, {
 creatorId: creatorId,
 subscribedAt: Date.now(),
 amountPaid: subscribePrice
 }).catch(err => console.warn('Failed to save subscription:', err));
 }
 setIsSubscribed(true);
 toast.success('Thank you! Your monthly creator subscription has been unlocked successfully! 🚀');
 return true;
`;

profile = profile.replace(profileSaveSubOld, profileSaveSubNew);

// Change Subscribe button text conditionally in UserProfile
const profileBtnReplaceOld = `
 <button 
 onClick={handleSubscribeClick}
 className="flex-1 bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-gray-200"
 >
 <UserPlus className="w-4 h-4"/>
 <span className="font-bold">GHS {subscribePrice.toFixed(2)}</span>
 </button>
`;
const profileBtnReplaceNew = `
 <button 
 onClick={isSubscribed ? undefined : handleSubscribeClick}
 className={\`flex-1 px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-2 border \${isSubscribed ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-default' : 'bg-white hover:bg-gray-100 text-black active:scale-95 border-gray-200'}\`}
 >
 {isSubscribed ? <CheckCircle2 className="w-4 h-4"/> : <UserPlus className="w-4 h-4"/>}
 <span className="font-bold">{isSubscribed ? 'Subscribed' : \`GHS \${subscribePrice.toFixed(2)}\`}</span>
 </button>
`;
profile = profile.replace(profileBtnReplaceOld, profileBtnReplaceNew);

fs.writeFileSync('src/components/profile/UserProfile.tsx', profile);
