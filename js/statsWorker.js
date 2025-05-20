// statsWorker.js
self.onmessage = async function(e) {
    const { sheikhName } = e.data;
    
    try {
        const response = await fetch('./quran-com_timestamps.json');
        const data = await response.json();
        const sheikhData = data[sheikhName];
        
        if (!sheikhData) {
            postMessage(null);
            return;
        }

        let totalDurationMs = 0;
        
        for (const sourateNum in sheikhData) {
            const audioFiles = sheikhData[sourateNum].audio_files;
            if (audioFiles && audioFiles.length > 0) {
                totalDurationMs += audioFiles[0].duration;
            }
        }
        
        const totalSeconds = Math.floor(totalDurationMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        postMessage({
            duration: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
            hours,
            minutes,
            seconds
        });
    } catch (error) {
        console.error("Erreur calcul stats:", error);
        postMessage(null);
    }
};