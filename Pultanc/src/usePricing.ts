import { useState, useEffect } from 'react';

const VALID_SUB_PRICES = [5, 15, 50];

export const usePricing = () => {
 const [episodePrice, setEpisodePrice] = useState(1.00);
 const [subscribePrice, setSubscribePrice] = useState(15);
 const [livePrice, setLivePrice] = useState(50);

 const loadFromStorage = () => {
 // episodePrice is now a fixed standard price of 1 GHS
 const savedSub = localStorage.getItem('creator_subscribe_price');
 const savedLive = localStorage.getItem('creator_live_price');

 if (savedSub) {
  const parsed = Number(savedSub);
  if (VALID_SUB_PRICES.includes(parsed)) {
   setSubscribePrice(parsed);
  } else {
   setSubscribePrice(15);
   localStorage.setItem('creator_subscribe_price', '15');
  }
 }
 if (savedLive) setLivePrice(Number(savedLive));
 };

 useEffect(() => {
 loadFromStorage();
 
 const handleSync = () => {
 loadFromStorage();
 };

 window.addEventListener('pricing-updated', handleSync);
 window.addEventListener('storage', handleSync);
 return () => {
 window.removeEventListener('pricing-updated', handleSync);
 window.removeEventListener('storage', handleSync);
 };
 }, []);

 const savePrices = (ep: number, sub: number, live: number) => {
 setEpisodePrice(1.00);
 const validSub = VALID_SUB_PRICES.includes(sub) ? sub : 15;
 setSubscribePrice(validSub);
 setLivePrice(live);
 
 localStorage.setItem('creator_episode_price', '1.00');
 localStorage.setItem('creator_subscribe_price', validSub.toString());
 localStorage.setItem('creator_live_price', live.toString());

 window.dispatchEvent(new Event('pricing-updated'));
 };

 return {
 episodePrice,
 subscribePrice,
 livePrice,
 savePrices
 };
};
