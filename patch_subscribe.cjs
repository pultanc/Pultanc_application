const fs = require('fs');

let feedContent = fs.readFileSync('src/components/consumer/ConsumerFeed.tsx', 'utf8');

feedContent = feedContent.replace(
  "unlockType === 'episode' ? (isBlockedEntirely ? 'Unlock Premium Clip' : 'Unlock Next Clip') : 'Subscribe to Creator'",
  "unlockType === 'episode' ? (isBlockedEntirely ? 'Unlock Premium Clip' : 'Unlock Next Clip') : `GHS ${subscribePrice.toFixed(2)}`"
);

const feedBtnOld = `{isSubscribed ? (
 <>
 <CheckCircle2 className="w-3.5 h-3.5"/> Subscribed
 </>
 ) : (
 <>
 <UserPlus className="w-3.5 h-3.5"/> Subscribe
 </>
 )}`;

const feedBtnNew = `{isSubscribed ? (
 <>
 <CheckCircle2 className="w-3.5 h-3.5"/> Subscribed
 </>
 ) : (
 <>
 <UserPlus className="w-3.5 h-3.5"/> GHS {subscribePrice.toFixed(2)}
 </>
 )}`;
feedContent = feedContent.replace(feedBtnOld, feedBtnNew);

fs.writeFileSync('src/components/consumer/ConsumerFeed.tsx', feedContent);


let profileContent = fs.readFileSync('src/components/profile/UserProfile.tsx', 'utf8');

profileContent = profileContent.replace(
  '<h2 className="text-xl font-bold text-gray-900 mb-2">Subscribe to Creator</h2>',
  '<h2 className="text-xl font-bold text-gray-900 mb-2">GHS {subscribePrice.toFixed(2)}</h2>'
);

profileContent = profileContent.replace(
  "email: 'user@example.com',",
  "email: auth.currentUser?.email || 'user@example.com',"
);

profileContent = profileContent.replace(
  "alert('Thank you! Your monthly creator subscription has been unlocked successfully! 🚀');",
  "toast.success('Thank you! Your monthly creator subscription has been unlocked successfully! 🚀');"
);

profileContent = profileContent.replace(
  "alert('We checked, but the payment is not completed yet on the payment tab.');",
  "toast.error('We checked, but the payment is not completed yet on the payment tab.');"
);

profileContent = profileContent.replace(
  "alert('Verification check failed. Try again.');",
  "toast.error('Verification check failed. Try again.');"
);

const profileBtnOld = `<span className="font-bold">Subscribe</span>`;
const profileBtnNew = `<span className="font-bold">GHS {subscribePrice.toFixed(2)}</span>`;
profileContent = profileContent.replace(profileBtnOld, profileBtnNew);

fs.writeFileSync('src/components/profile/UserProfile.tsx', profileContent);

