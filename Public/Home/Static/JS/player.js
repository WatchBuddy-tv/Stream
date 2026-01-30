import VideoPlayer from './components/VideoPlayer.min.js';

document.addEventListener('DOMContentLoaded', () => {
    const player = new VideoPlayer();
    window.__videoPlayer = player;
});
