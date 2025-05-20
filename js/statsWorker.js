// statsWorker.js
self.onmessage = async function(e) {
    const { filename } = e.data;  // On reçoit directement le filename
    
    try {
        // Charger le fichier spécifique au sheikh
        const response = await fetch(`./sheikhs/${filename}`);
        if (!response.ok) {
            throw new Error(`Fichier non trouvé: ${filename}`);
        }
        
        const sheikhData = await response.json();
        
        let totalDurationMs = 0;
        let sourateCount = 0;
        
        // Calculer la durée totale et le nombre de sourates
        for (const sourateNum in sheikhData) {
            if (sheikhData[sourateNum]?.audio_files?.[0]?.duration) {
                totalDurationMs += sheikhData[sourateNum].audio_files[0].duration;
                sourateCount++;
            }
        }
        
        // Calculer les composants temporels
        const totalSeconds = Math.floor(totalDurationMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        // Envoyer les résultats
        postMessage({
            duration: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
            hours,
            minutes,
            seconds,
            sourateCount,
            fileSize: (response.headers.get('Content-Length') || '0') + ' octets'
        });
        
    } catch (error) {
        console.error("Erreur dans le worker:", {
            error: error.message,
            filename
        });
        
        postMessage({
            error: true,
            message: "Erreur de calcul des statistiques",
            details: error.message
        });
    }
};