import { Series, LiveCreator } from './types';

export const mockSeries: Series[] = [
 {
 id:"demo1",
 title:"Urban Parkour Free-run",
 description:"Insane parkour jumps across the city skyline.",
 creator:"JumpMaster99",
 creatorName:"JumpMaster99",
 creatorHandle:"@jumpmaster99",
 creatorVerified: true,
 creatorAvatar:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
 unlocksCount:"12.4K",
 supportsCount:"24.5K",
 subscribersCount:"1.2K",
 thumbnailUrl:"https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=800&q=80",
 episodes: [
 {
 id:"demo1_1",
 title:"The Warmup",
 videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
 isLocked: false,
 isClimer: false,
 price: 0
 },
 {
 id:"demo1_2",
 title:"The Big Jump (Climax)",
 videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
 isLocked: true,
 isClimer: true,
 price: 5.00
 }
 ]
 },
 {
 id:"demo2",
 title:"Epic Dance Battle",
 description:"Underground dance off goes crazy at the end.",
 creator:"RhythmKing",
 creatorName:"RhythmKing",
 creatorHandle:"@rhythmking",
 creatorVerified: false,
 creatorAvatar:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
 unlocksCount:"8.9K",
 supportsCount:"18.2K",
 subscribersCount:"940",
 thumbnailUrl:"https://images.unsplash.com/photo-1535525153412-5a42439a89c9?auto=format&fit=crop&w=800&q=80",
 episodes: [
 {
 id:"demo2_1",
 title:"Opening Moves",
 videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
 isLocked: false,
 isClimer: false,
 price: 0
 },
 {
 id:"demo2_2",
 title:"The Final Spin (Climax)",
 videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
 isLocked: true,
 isClimer: true,
 price: 3.00
 }
 ]
 },
 {
 id:"demo3",
 title:"Highland Skate Drift",
 description:"Speed carving down winding mountain asphalt.",
 creator:"SkatePulse",
 creatorName:"SkatePulse",
 creatorHandle:"@skatepulse",
 creatorVerified: true,
 creatorAvatar:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
 unlocksCount:"15.1K",
 supportsCount:"31.8K",
 subscribersCount:"2.4K",
 thumbnailUrl:"https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?auto=format&fit=crop&w=800&q=80",
 episodes: [
 {
 id:"demo3_1",
 title:"The Hill Descent",
 videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
 isLocked: false,
 isClimer: false,
 price: 0
 },
 {
 id:"demo3_2",
 title:"Speed Carve Climax",
 videoUrl:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
 isLocked: true,
 isClimer: true,
 price: 4.50
 }
 ]
 }
];

export const mockLiveCreators: LiveCreator[] = [];

export const generateMockTransactions = () => {
 return [];
};

export const chartData = [
 { time: '18:00', bandwidth: 0, revenue: 0 },
 { time: '18:05', bandwidth: 0, revenue: 0 },
 { time: '18:10', bandwidth: 0, revenue: 0 },
 { time: '18:15', bandwidth: 0, revenue: 0 },
 { time: '18:20', bandwidth: 0, revenue: 0 },
 { time: '18:25', bandwidth: 0, revenue: 0 },
 { time: '18:30', bandwidth: 0, revenue: 0 },
];
