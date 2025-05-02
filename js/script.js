// === Hacker effect pour les textes (conservé uniquement pour chargement initial) ===
function hackerEffect(element, originalText, speed = 20, step = 3) {
    const chars = "!<>-_\\/[]{}—=+*^?#________";
    let revealed = 0;

    const interval = setInterval(() => {
        let output = "";

        for (let i = 0; i < originalText.length; i++) {
            if (i < revealed) {
                output += originalText[i];
            } else if (originalText[i] === " ") {
                output += " ";
            } else {
                output += chars[Math.floor(Math.random() * chars.length)];
            }
        }

        element.textContent = output;
        revealed += step;

        if (revealed >= originalText.length) {
            clearInterval(interval);
            element.textContent = originalText;
        }
    }, speed);
}

function formatDuration(durationMs) {
    const seconds = Math.floor((durationMs / 1000) % 60);
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);
    return (hours > 0 ? String(hours).padStart(2, '0') + ':' : '') +
           String(minutes).padStart(2, '0') + ':' +
           String(seconds).padStart(2, '0');
}

function formatSize(size) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index++;
    }
    return size.toFixed(2) + ' ' + units[index];
}

// === Fonction pour afficher les infos d'un Sheikh ===
function createOverlay(data) {
    const overlay = document.createElement('div');
    overlay.className = 'sheikh-info';

    const header = document.createElement('div');
    header.className = 'sheikh-header';

    const nameElement = document.createElement('h3');
    nameElement.className = 'sheikh-name';
    nameElement.textContent = data.name;
    header.appendChild(nameElement);

    if (data.photo) {
        const photoElement = document.createElement('img');
        photoElement.src = data.photo;
        photoElement.alt = data.name;
        photoElement.className = 'sheikh-photo';
        header.appendChild(photoElement);
    }

    overlay.appendChild(header);

    if (data.bio) {
        const bioContainer = document.createElement('div');
        bioContainer.className = 'sheikh-bio';
        const lines = data.bio.split(/(?<=\.)\s+/);
        lines.forEach((line) => {
            const span = document.createElement('span');
            span.style.display = "inline";
            span.style.whiteSpace = "normal";
            span.textContent = line;
            bioContainer.appendChild(span);
            bioContainer.appendChild(document.createTextNode(" "));
        });
        overlay.appendChild(bioContainer);
    }

    const mediaInfo = document.createElement('div');
    mediaInfo.className = 'media-info';

    
    const playSpan = document.createElement('span');
    playSpan.className = 'action play';
    playSpan.textContent = '[play]';
    playSpan.onclick = () => {
        let currentIndex = 0;
        const playNextSourate = () => {
            if (currentIndex < sourates.length) {
                const sourate = sourates[currentIndex];
                loadJSON('./js/quran-com_timestamps.json')
                    .then(datta => {
                        if (datta[data.name] && datta[data.name][sourate.number]) {
                            const audioUrl = datta[data.name][sourate.number]["audio_files"][0]["audio_url"];
                            const audio = new Audio(audioUrl);
                            audio.play();
                            audio.onended = () => {
                                currentIndex++;
                                playNextSourate();
                            };
                            const durationMs = datta[data.name][sourate.number]["audio_files"][0]["duration"];
                            detailsDuration.textContent = formatDuration(durationMs);
                            detailsB = datta[data.name][sourate.number]["audio_files"][0]["file_size"];
                            detailsSize.textContent = formatSize(detailsB);
                        } else {
                            console.error(`Erreur: Pas de données pour la sourate ${sourate.number}`);
                        }
                    })
                    .catch(error => console.error('Erreur lors du chargement du fichier JSON:', error));
            
            }
        };
        playNextSourate();
    };

    const detailsDuration = document.createElement('span');
    detailsDuration.className = 'details';
    detailsDuration.textContent = '...';

    playSpan.appendChild(detailsDuration);
    mediaInfo.appendChild(playSpan);

    const sourceSpan = document.createElement('span');
    sourceSpan.className = 'action source';
    sourceSpan.textContent = '[source]';
    sourceSpan.onclick = () => {};
    

    const detailsSize = document.createElement('span');
    detailsSize.className = 'details';
    detailsSize.textContent = '...';
    sourceSpan.appendChild(detailsSize);

    mediaInfo.appendChild(sourceSpan);
    overlay.appendChild(mediaInfo);

    
    const container = document.createElement('div');
    container.className = 'souratesContainer';
    container.innerHTML = "";

    const list = document.createElement('div');
    list.className = "sourate-list";
    
    let currentAudio = null;
    sourates.forEach((sourate) => {
        const item = document.createElement('li');
        item.className = "sourate-item";
        item.innerHTML = `<span class="sourate-number">${sourate.number}</span> ${sourate.name}
                          <div class="sourate-arabic">${sourate.arabicname}</div>
        `;
        item.onclick = () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            loadJSON('./js/quran-com_timestamps.json') 
                .then(datta => { 
                    if (datta[data.name]) {
                        currentAudio = new Audio(datta[data.name][sourate.number]["audio_files"][0]["audio_url"]);
                        currentAudio.play();
                        const durationMs = datta[data.name][sourate.number]["audio_files"][0]["duration"];
                        detailsDuration.textContent = formatDuration(durationMs);
                        detailsB = datta[data.name][sourate.number]["audio_files"][0]["file_size"];
                        detailsSize.textContent = formatSize(detailsB);
                        // Ouvrir un nouvel onglet avec la source datta[data.name][sourate.number]["audio_files"][0]["audio_url"]
                        sourceSpan.onclick = () => {
                            window.open(datta[data.name][sourate.number]["audio_files"][0]["audio_url"]);
                        };

                    } else {
                        console.error('Erreur: Pas de données pour cette sourate');
                    }

                })
                .catch(error => console.error('Erreur lors du chargement du fichier JSON:', error));
        };
    
        list.appendChild(item);
    });
    container.appendChild(list);
    overlay.appendChild(container);
    return overlay;
}


// === Animation en cascade à la fin du chargement (uniquement pour textes initiaux) ===
window.addEventListener("DOMContentLoaded", () => {
    const elements = Array.from(document.body.querySelectorAll("*"))
        .filter(el =>
            el.childNodes.length === 1 &&
            el.childNodes[0].nodeType === Node.TEXT_NODE &&
            el.textContent.trim().length > 0
        );

    elements.forEach((el, index) => {
        const text = el.textContent;
        el.textContent = "";

        setTimeout(() => {
            hackerEffect(el, text);
        }, index * 100);
    });

    // Génère le menu une fois que le DOM est prêt
    const menu = document.getElementById('menuR');
    sheikhs.sort((a, b) => a.name.localeCompare(b.name)); // Trie les sheikhs par ordre alphabétique

    sheikhs.forEach((sheikh) => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.textContent = sheikh.name;
        div.onclick = () => {
            // Supprime le style actif des autres éléments
            const activeItem = document.querySelector('.menu-item.active');
            if (activeItem) {
                activeItem.classList.remove('active');
            }
            // Applique le style actif à l'élément sélectionné
            div.classList.add('active');
            const current = document.querySelector('.sheikh-info');
            if (current) {
                current.replaceWith(createOverlay(sheikh));
            } else {
                document.body.appendChild(createOverlay(sheikh));
            }
        };
        menu.appendChild(div);
    });
});

// === Liste des sheikhs ===
const sheikhs = [
    {
        name: "Mishari Rashid al-`Afasy",
        photo: "./assets/images/Mishary-Rashid-Alafasy.jpeg",
        bio: "Mishary Rashid Alafasy, du Koweït, est mondialement reconnu pour sa voix apaisante et sa récitation émotive du Coran. Il a fondé la première chaîne de télévision entièrement dédiée à la récitation du Coran. Il est aussi le premier réciteur à avoir enregistré le Coran en entier dans les dix lectures (qira'at).",
        audio: "https://server.com/audio/"
    },
    {
        name: "Mahmoud Khalil Al-Husary",
        photo: "./assets/images/Mahmoud-Khalil-Al-Husary.jpeg",
        bio: "Mahmoud Khalil Al-Husary, un maître égyptien du tajwid, est connu pour sa récitation claire et méthodique. Il a été le premier réciteur à enregistrer le Coran complet en plusieurs styles de récitation, ce qui a grandement contribué à l'apprentissage du Coran dans le monde entier.",
        audio: "https://server.com/audio/"
    },
    {
        name: "Sa'ud ash-Shuraim",
        photo: "./assets/images/Saud-ash-Shuraim.jpeg",
        bio: "Saad Al-Ghamdi a mémorisé le Coran à l'âge de 22 ans et a ensuite étudié les dix lectures (al-qira'at al-‘ashr). Son enregistrement complet du Coran est l’un des plus utilisés dans les écoles coraniques du monde pour son style clair et parfait pour l’apprentissage.",
        audio: "https://server.com/audio/"
    },
    {
        name: "AbdulBaset AbdulSamad",
        photo: "./assets/images/Abdul-Basit-Abdus-Samad.jpeg",
        bio: "Abdul Basit Abdus Samad, légende égyptienne du tajwid, est le seul réciteur à avoir conquis le cœur de millions dans le monde entier sans aucun média moderne à l’époque. Il a récité le Coran à l’ONU en 1970, un événement marquant où plusieurs non-musulmans furent émus aux larmes par sa récitation.",
        audio: "https://server.com/audio/"
    },
    {
        name: "Abu Bakr al-Shatri",
        photo: "./assets/images/Abu-Bakr-al-Shatri.webp",
        bio: "Abu Bakr al-Shatri, connu pour sa récitation douce et mélodieuse, est un réciteur saoudien très apprécié. Il a participé à de nombreux événements islamiques internationaux et est souvent invité à diriger les prières dans différentes mosquées à travers le monde.",
        audio: "https://server.com/audio/"
    },
    {
        name: "Khalifah Al Tunaiji",
        photo: "./assets/images/Khalifa-al-Tunaiji.jpeg",
        bio: "Khalifah Al Tunaiji, originaire des Émirats arabes unis, est connu pour sa récitation captivante et son engagement dans l'enseignement du Coran. Il a inspiré de nombreux étudiants à travers ses programmes éducatifs et ses récitations.",
        audio: "https://server.com/audio/"
    },
    {
        name: "Hani ar-Rifai",
        photo: "./assets/images/Hani-ar-Rifai.jpeg",
        bio: "Hani ar-Rifai, imam de la mosquée Anani à Jeddah, est célèbre pour ses récitations émouvantes et ses dou’as pleines de ferveur. Sa voix unique a touché le cœur de millions de fidèles à travers le monde.",
        audio: "https://server.com/audio/"
    },
    {
        name: "Mohamed Siddiq al-Minshawi",
        photo: "./assets/images/Mohamed-Siddiq-El-Minshawi.jpeg",
        bio: "Mohamed Siddiq al-Minshawi, un maître égyptien du tajwid, est connu pour sa récitation profonde et spirituelle. Il est considéré comme l'un des plus grands récitateurs de tous les temps, ayant influencé des générations de musulmans.",
        audio: "https://server.com/audio/"
    },
    {
        name: "Abdur-Rahman as-Sudais",
        photo: "./assets/images/Abdur-Rahman_As-Sudais.jpg",
        bio: "Abdur-Rahman As-Sudais a mémorisé le Coran à l’âge de 12 ans. Il est devenu imam de la Mosquée sacrée de La Mecque à seulement 22 ans. En 2005, il a été nommé 'Personnalité islamique de l’année'. Il a dirigé les prières du tarawih avec des millions de fidèles derrière lui, un record historique en nombre de participants à une prière collective.",
        audio: "https://server.com/audio/"
    }
];

const sourates = [
    { number: 1, name: "Al-Fatiha", arabicname: "الفاتحة", nbrversets: 7 },
    { number: 2, name: "Al-Baqara", arabicname: "البقرة", nbrversets: 286 },
    { number: 3, name: "Aali Imran", arabicname: "آل عمران", nbrversets: 200 },
    { number: 4, name: "An-Nisa", arabicname: "النساء", nbrversets: 176 },
    { number: 5, name: "Al-Ma'idah", arabicname: "المائدة", nbrversets: 120 },
    { number: 6, name: "Al-An'am", arabicname: "الأنعام", nbrversets: 165 },
    { number: 7, name: "Al-A'raf", arabicname: "الأعراف", nbrversets: 206 },
    { number: 8, name: "Al-Anfal", arabicname: "الأنفال", nbrversets: 75 },
    { number: 9, name: "At-Tawbah", arabicname: "التوبة", nbrversets: 129 },
    { number: 10, name: "Yunus", arabicname: "يونس", nbrversets: 109 },
    { number: 11, name: "Hud", arabicname: "هود", nbrversets: 123 },
    { number: 12, name: "Yusuf", arabicname: "يوسف", nbrversets: 111 },
    { number: 13, name: "Ar-Ra'd", arabicname: "الرعد", nbrversets: 43 },
    { number: 14, name: "Ibrahim", arabicname: "إبراهيم", nbrversets: 52 },
    { number: 15, name: "Al-Hijr", arabicname: "الحجر", nbrversets: 99 },
    { number: 16, name: "An-Nahl", arabicname: "النحل", nbrversets: 128 },
    { number: 17, name: "Al-Isra", arabicname: "الإسراء", nbrversets: 111 },
    { number: 18, name: "Al-Kahf", arabicname: "الكهف", nbrversets: 110 },
    { number: 19, name: "Maryam", arabicname: "مريم", nbrversets: 98 },
    { number: 20, name: "Ta-Ha", arabicname: "طه", nbrversets: 135 },
    { number: 21, name: "Al-Anbiya", arabicname: "الأنبياء", nbrversets: 112 },
    { number: 22, name: "Al-Hajj", arabicname: "الحج", nbrversets: 78 },
    { number: 23, name: "Al-Mu'minun", arabicname: "المؤمنون", nbrversets: 118 },
    { number: 24, name: "An-Nur", arabicname: "النور", nbrversets: 64 },
    { number: 25, name: "Al-Furqan", arabicname: "الفرقان", nbrversets: 77 },
    { number: 26, name: "Ash-Shu'ara", arabicname: "الشعراء", nbrversets: 227 },
    { number: 27, name: "An-Naml", arabicname: "النمل", nbrversets: 93 },
    { number: 28, name: "Al-Qasas", arabicname: "القصص", nbrversets: 88 },
    { number: 29, name: "Al-Ankabut", arabicname: "العنكبوت", nbrversets: 69 },
    { number: 30, name: "Ar-Rum", arabicname: "الروم", nbrversets: 60 },
    { number: 31, name: "Luqman", arabicname: "لقمان", nbrversets: 34 },
    { number: 32, name: "As-Sajda", arabicname: "السجدة", nbrversets: 30 },
    { number: 33, name: "Al-Ahzab", arabicname: "الأحزاب", nbrversets: 73 },
    { number: 34, name: "Saba", arabicname: "سبإ", nbrversets: 54 },
    { number: 35, name: "Fatir", arabicname: "فاطر", nbrversets: 45 },
    { number: 36, name: "Ya-Sin", arabicname: "يس", nbrversets: 83 },
    { number: 37, name: "As-Saffat", arabicname: "الصافات", nbrversets: 182 },
    { number: 38, name: "Sad", arabicname: "ص", nbrversets: 88 },
    { number: 39, name: "Az-Zumar", arabicname: "الزمر", nbrversets: 75 },
    { number: 40, name: "Ghafir", arabicname: "غافر", nbrversets: 85 },
    { number: 41, name: "Fussilat", arabicname: "فصلت", nbrversets: 54 },
    { number: 42, name: "Ash-Shura", arabicname: "الشورى", nbrversets: 53 },
    { number: 43, name: "Az-Zukhruf", arabicname: "الزخرف", nbrversets: 89 },
    { number: 44, name: "Ad-Dukhan", arabicname: "الدخان", nbrversets: 59 },
    { number: 45, name: "Al-Jathiya", arabicname: "الجاثية", nbrversets: 37 },
    { number: 46, name: "Al-Ahqaf", arabicname: "الأحقاف", nbrversets: 35 },
    { number: 47, name: "Muhammad", arabicname: "محمد", nbrversets: 38 },
    { number: 48, name: "Al-Fath", arabicname: "الفتح", nbrversets: 29 },
    { number: 49, name: "Al-Hujurat", arabicname: "الحجرات", nbrversets: 18 },
    { number: 50, name: "Qaf", arabicname: "ق", nbrversets: 45 },
    { number: 51, name: "Adh-Dhariyat", arabicname: "الذاريات", nbrversets: 60 },
    { number: 52, name: "At-Tur", arabicname: "الطور", nbrversets: 49 },
    { number: 53, name: "An-Najm", arabicname: "النجم", nbrversets: 62 },
    { number: 54, name: "Al-Qamar", arabicname:"القمر", nbrversets :55},
    { number :55 , name :"Ar-Rahman" ,arabicname :"الرحمن", nbrversets :78},
    { number :56 , name :"Al-Waqia" ,arabicname :"الواقعة", nbrversets :96},
    { number :57 , name :"Al-Hadid" ,arabicname :"الحديد", nbrversets :29},
    { number :58 , name :"Al-Mujadila" ,arabicname :"المجادلة", nbrversets :22},
    { number :59 , name :"Al-Hashr" ,arabicname :"الحشر", nbrversets :24},
    { number :60 , name :"Al-Mumtahana" ,arabicname :"الممتحنة", nbrversets :13},
    { number :61 , name :"As-Saff" ,arabicname :"الصف", nbrversets :14},
    { number :62 , name :"Al-Jumu'a" ,arabicname :"الجمعة", nbrversets :11},
    { number :63 , name :"Al-Munafiqun" ,arabicname :"المنافقون", nbrversets :11},
    { number :64 , name :"At-Taghabun" ,arabicname :"التغابن", nbrversets :18},
    { number :65 , name :"At-Talaq" ,arabicname :"الطلاق", nbrversets :12},
    { number :66 , name :"At-Tahrim" ,arabicname :"التحريم", nbrversets :12},
    { number :67 , name :"Al-Mulk" ,arabicname :"المُلك", nbrversets :30},
    { number :68 , name :"Al-Qalam" ,arabicname :"القلم", nbrversets :52},
    { number :69 , name :"Al-Haaqqa" ,arabicname :"الحاقة", nbrversets :52},
    { number :70, name: "Al-Ma'arij", arabicname: "المعارج", nbrversets: 44 },
    { number: 71, name: "Nuh", arabicname: "نوح", nbrversets: 28 },
    { number: 72, name: "Al-Jinn", arabicname: "الجن", nbrversets: 28 },
    { number: 73, name: "Al-Muzzammil", arabicname: "المزمل", nbrversets: 20 },
    { number: 74, name: "Al-Muddathir", arabicname: "المدثر", nbrversets: 56 },
    { number: 75, name: "Al-Qiyama", arabicname: "القيامة", nbrversets: 40 },
    { number: 76, name: "Al-Insan", arabicname: "الإنسان", nbrversets: 31 },
    { number: 77, name: "Al-Mursalat", arabicname: "المرسلات", nbrversets: 50 },
    { number: 78, name: "An-Naba", arabicname: "النبأ", nbrversets: 40 },
    { number: 79, name: "An-Nazi'at", arabicname: "النازعات", nbrversets: 46 },
    { number: 80, name: "Abasa", arabicname: "عبس", nbrversets: 42 },
    { number: 81, name: "At-Takwir", arabicname: "التكوير", nbrversets: 29 },
    { number: 82, name: "Al-Infitar", arabicname: "الإنفطار", nbrversets: 19 },
    { number: 83, name: "Al-Mutaffifin", arabicname: "المطففين", nbrversets: 36 },
    { number: 84, name: "Al-Inshiqaq", arabicname: "الإنشقاق", nbrversets: 25 },
    { number: 85, name: "Al-Burooj", arabicname: "البروج", nbrversets: 22 },
    { number: 86, name: "At-Tariq", arabicname: "الطارق", nbrversets: 17 },
    { number: 87, name: "Al-A'la", arabicname: "الأعلى", nbrversets: 19 },
    { number: 88, name: "Al-Ghashiya", arabicname:"الغاشية" ,nbrversets :26},
    { number :89 , name :"Al-Fajr" ,arabicname :"الفجر" ,nbrversets :30},
    { number :90 , name :"Al-Balad" ,arabicname :"البلد" ,nbrversets :20},
    { number :91 , name :"Ash-Shams" ,arabicname :"الشمس" ,nbrversets :15},
    { number :92 , name :"Al-Lail" ,arabicname :"الليل" ,nbrversets :21},
    { number :93 , name :"Ad-Duha" ,arabicname :"الضحى" ,nbrversets :11},
    { number :94 , name :"Ash-Sharh" ,arabicname :"الشرح" ,nbrversets :8},
    { number :95 , name :"At-Tin" ,arabicname :"التين" ,nbrversets :8},
    { number :96 , name :"Al-Alaq" ,arabicname :"العلق" ,nbrversets :19},
    { number :97 , name :"Al-Qadr" ,arabicname :"القدر" ,nbrversets :5},
    { number :98 , name :"Al-Bayyina" ,arabicname :"البينة" ,nbrversets :8},
    { number :99 , name :"Az-Zalzala" ,arabicname :"الزلزلة" ,nbrversets :8},
    { number :100 , name :"Al-Adiyaat" ,arabicname :"العاديات" ,nbrversets :11},
    { number :101 , name :"Al-Qari'a" ,arabicname :"القارعة" ,nbrversets :11},
    { number :102 , name :"At-Takathur" ,arabicname :"التكاثر" ,nbrversets :8},
    { number :103 , name :"Al-Asr" ,arabicname :"العصر" ,nbrversets :3},
    { number :104 , name :"Al-Humaza" ,arabicname :"الهمزة" ,nbrversets :9},
    { number :105, name: "Al-Fil", arabicname: "الفيل", nbrversets: 5 },
    { number: 106, name: "Quraish", arabicname: "قريش", nbrversets: 4 },
    { number: 107, name: "Al-Ma'un", arabicname: "الماعون", nbrversets: 7 },
    { number: 108, name: "Al-Kawthar", arabicname: "الكوثر", nbrversets: 3 },
    { number: 109, name: "Al-Kafirun", arabicname: "الكافرون", nbrversets: 6 },
    { number: 110, name: "An-Nasr", arabicname: "النصر", nbrversets: 3 },
    { number: 111, name: "Al-Masad", arabicname: "المسد", nbrversets: 5 },
    { number: 112, name: "Al-Ikhlas", arabicname: "الإخلاص", nbrversets: 4 },
    { number: 113, name: "Al-Falaq", arabicname: "الفلق", nbrversets: 5 },
    { number: 114, name: "An-Nas", arabicname: "الناس", nbrversets: 6 }
];


// Fonction pour charger un fichier JSON
function loadJSON(url) {
    return fetch(url)  // Utilise la variable url passée en paramètre
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();  // Convertit la réponse en JSON
        })
        .catch(error => {
            console.error('Erreur lors du chargement du fichier JSON:', error);
            throw error;  // Relance l'erreur pour la gestion en amont
        });
}

  

// Fonction pour jouer l'audio
function playAudio(audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play()
        .then(() => console.log('Lecture de l\'audio lancée!'))
        .catch(error => console.log('Erreur de lecture audio: ', error));
}
