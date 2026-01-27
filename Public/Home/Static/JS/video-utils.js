// Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

export const detectFormat = (url, format = null) => {
    const lowerUrl = url.toLowerCase();
    
    // HLS detection (including non-standard extensions)
    if (lowerUrl.includes('.m3u8') || 
        lowerUrl.includes('.m3u') ||
        lowerUrl.includes('/hls/') || 
        lowerUrl.includes('/m3u8/') || 
        lowerUrl.includes('master.txt') || 
        lowerUrl.includes('/manifests/') ||
        lowerUrl.includes('playlist.m3u8') ||
        lowerUrl.includes('.ts') ||
        lowerUrl.includes('.m4s') ||
        lowerUrl.includes('seg-') ||
        lowerUrl.includes('segment-') ||
        lowerUrl.includes('chunk-') ||
        lowerUrl.includes('fragment') ||
        format === 'hls') {
        return 'hls';
    }
    if (lowerUrl.includes('.mp4') || lowerUrl.includes('/mp4/') || format === 'mp4') {
        return 'mp4';
    }
    if (lowerUrl.includes('.webm') || format === 'webm') {
        return 'webm';
    }
    if (lowerUrl.includes('.mkv') || format === 'mkv') {
        return 'mkv';
    }
    if (lowerUrl.includes('.avi') || format === 'avi') {
        return 'avi';
    }
    if (lowerUrl.includes('.mov') || format === 'mov') {
        return 'mov';
    }
    if (lowerUrl.includes('.flv') || format === 'flv') {
        return 'flv';
    }
    if (lowerUrl.includes('.wmv') || format === 'wmv') {
        return 'wmv';
    }
    
    return format || 'native';
};
