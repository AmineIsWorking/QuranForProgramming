// Variables globales
let isInitialLoad = true;
let controlsInitialized = false;
let statsWorker = null;
let currentAudio = null;
let currentSourateIndex = -1;
let currentVolume = 1.0;
let isPlaying = false;
let updateInterval;
let isLoopEnabled = false;
let currentHighlightInterval = null;
let currentSourateAudioUrl = null;
let currentSurahText = null;
let isLearning = false;
let carouselInitialized = false;
const statsCache = {};

// Global variable to store verse timings for highlighting
let currentVerseTimings = null;

// Variables pour les playlists
let isPlaylistMode = false;
let currentPlaylist = [];
let currentPlaylistIndex = 0;
let draftPlaylist = [];   // Playlist en cours de création/modification
let playlistAudio = null;

// Variables globales pour les métadonnées
let currentSurahName = '';
let currentSheikhName = '';
let currentSheikh = null;

// === Tutoriel interactif avec effet "spotlight" ===
let tutorialStep = 0;
let tutorialOverlay = null;
let originalCircularBtnDisplay = null;
const tutorialConfig = [
    {
        target: null,
        message: "As-salāmu ʿalaykum ! Ce tutoriel interactif va vous guider pour profiter pleinement du site.",
        placement: "center"
    },
    {
        target: ".souratesContainer",
        message: "Voici la liste des sourates du Coran. Cliquez sur une sourate lancer la lecture audio.",
        placement: "top"
    },
    {
        target: ".control-row",
        message: "Utilisez ces boutons pour contrôler la lecture :<ul><li>▶️ Lecture/Pause</li><li>⏭️ Sourate suivante</li><li>⏮️ Sourate précédente</li><li>⏩ Avance rapide (30s)</li><li>⏪ Retour rapide (30s)</li><li>🔊 Réglage du volume</li></ul>",
        placement: "right"
    },
    {
        target: '.menuR-container',
        message: "Ce menu vous permet de changer de sheikh à tout moment. Cliquez sur un nom pour découvrir son style de récitation.",
        placement: "top"
    },
    {
        target: '#menuR',
        message: "Ce menu vous permet de changer de sheikh à tout moment. Cliquez sur un nom pour découvrir son style de récitation.",
        placement: "bottom"
    },
    {
        target: "#quran-button",
        message: "Cliquez ici pour afficher ou masquer le texte de la sourate.",
        placement: "top"
    },
    {
        target: "#playlist",
        message: "Créer vos playlists personnalisées et lancez les sourates dans l'ordre que vous voulez",
        placement: "top"
    },
    {
        target: ".media-info",
        message: 'Ici, vous pouvez :<ul><li>Activer le mode "All" pour écouter toutes les sourates à la suite</li><li>Activer "Learning Path" pour réviser dans l\'ordre inverse</li></ul>Ajouter un réciteur à vos favoris ! ⭐',
        placement: "right"
    },
    {
        target: "#help-tutorial-btn",
        message: "Besoin d’aide ou envie de revoir le tutoriel ? Cliquez ici pour relancer la visite interactive à tout moment.",
        placement: "bottom"
    },
    {
        target: null,
        message: "Barak-Allahu fikum !<br>Qu'Allah facilite votre chemin vers la connaissance du Coran.",
        placement: "center"
    }
];

function startTutorial() {
    tutorialStep = 0;
    const circularBtn = document.getElementById('quran-button');
    if (circularBtn) {
        originalCircularBtnDisplay = circularBtn.style.display;
        circularBtn.style.display = 'flex';
    }

    showTutorialStep();
    setCookie('tuto', 'done', 365);
}


function showTutorialStep() {
    removeTutorialOverlay();

    if (tutorialStep < tutorialConfig.length) {
        const step = tutorialConfig[tutorialStep];

        // Gestion des étapes conditionnelles (existant déjà)
        if (step.target === '.menuR-container' && !document.querySelector('.menuR-container')) {
            tutorialStep++;
            return showTutorialStep();
        }
        if (step.target === '#menuR' && document.querySelector('.menuR-container')) {
            tutorialStep++;
            return showTutorialStep();
        }
    }

    if (tutorialStep >= tutorialConfig.length) {
        // Fin du tutoriel (existant déjà)
        return finalizeTutorial();
    }

    const step = tutorialConfig[tutorialStep];
    const targetEl = step.target ? document.querySelector(step.target) : null;

    if (step.target && !targetEl) {
        tutorialStep++;
        return showTutorialStep();
    }

    // 1. Calcul du scroll nécessaire AVANT création du msgBox
    if (targetEl && (step.target === '.media-info' || step.target === '.souratesContainer')) {
        const sheikhInfo = document.querySelector('.sheikh-info');
        if (sheikhInfo) {
            const targetRect = targetEl.getBoundingClientRect();
            const sheikhRect = sheikhInfo.getBoundingClientRect();
            
            // Calcul de la position relative dans le conteneur
            const positionRelative = targetRect.top - sheikhRect.top + sheikhInfo.scrollTop;
            const margeMsgBox = 250; // Estimation de la hauteur du msgBox + marge
            
            // Si l'élément cible est trop bas, scroll vers lui
            if (positionRelative + margeMsgBox > sheikhInfo.clientHeight) {
                sheikhInfo.scrollTo({
                    top: positionRelative - (sheikhInfo.clientHeight / 3), // Scroll pour centrer approximativement
                    behavior: 'instant' // Pas d'animation pour éviter le délai
                });
            }
        }
    }

    // 2. Création du msgBox seulement APRÈS le scroll
    createTutorialOverlay(step, targetEl);
}

// Fonction extraite pour plus de clarté
function finalizeTutorial() {
    const circularBtn = document.getElementById('quran-button');
    if (circularBtn) {
        circularBtn.style.display = originalCircularBtnDisplay || 'none';
    }
    removeTutorialOverlay();
}

function createTutorialOverlay(step, targetEl) {

    tutorialOverlay = document.createElement('div');
    tutorialOverlay.className = 'tutorial-overlay';
    Object.assign(tutorialOverlay.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        pointerEvents: 'auto'
    });

    const hole = calculateHolePosition(targetEl);
    
    tutorialOverlay.innerHTML = createSvgMask(hole);
    
    const msgBox = createMessageBox(step, hole);
    tutorialOverlay.appendChild(msgBox);

    setupEventListeners();

    // Gestion du défilement automatique pour media-info ET souratesContainer
    if (step.target === '.media-info' || step.target === '.souratesContainer') {
        let scrollCheckInterval;

        const getTargetElements = () => {
            const target = document.querySelector(step.target);
            const container = document.querySelector('.sheikh-info');
            return { target, container };
        };

        const checkScrollNeeded = () => {
            const { target, container } = getTargetElements();
            if (!target || !container) return false;

            const targetRect = target.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            if (step.target === '.media-info') {
                const basTarget = targetRect.bottom - containerRect.top + container.scrollTop;
                const basVisible = container.scrollTop + container.clientHeight;
                return (basTarget - basVisible) > 0;
            } else { // souratesContainer
                const hautTarget = targetRect.top - containerRect.top + container.scrollTop;
                return hautTarget < container.scrollTop;
            }
        };

        const performScroll = () => {
            const { target, container } = getTargetElements();
            if (!target || !container) return;

            const targetRect = target.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const msgBoxHeight = msgBox.offsetHeight;

            let targetScroll;

            if (step.target === '.media-info') {
                const basTarget = targetRect.bottom - containerRect.top + container.scrollTop;
                const basVisible = container.scrollTop + container.clientHeight;
                const difference = basTarget - basVisible;
                targetScroll = container.scrollTop + difference + msgBoxHeight + 20;
            } else { // souratesContainer
                const hautTarget = targetRect.top - containerRect.top + container.scrollTop;
                targetScroll = hautTarget - msgBoxHeight - 40;
            }

            container.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });
        };

        const nextBtn = tutorialOverlay.querySelector('#tutorial-next-btn');
        // Démarrer la vérification
        if (checkScrollNeeded()) {
            performScroll();
            scrollCheckInterval = setInterval(() => {
                if (!checkScrollNeeded()) {
                    clearInterval(scrollCheckInterval);
                } else {
                    performScroll();
                }
            }, 300);
        }

        // Nettoyage quand on passe à l'étape suivante
        if (nextBtn) {
            const originalNextHandler = nextBtn.onclick;
            nextBtn.onclick = (e) => {
                clearInterval(scrollCheckInterval);
                if (typeof originalNextHandler === 'function') {
                    originalNextHandler(e);
                }
            };
        }
    }

    document.body.appendChild(tutorialOverlay);
}

function calculateHolePosition(targetEl) {
    const padding = 12;
    const borderRadius = 12;
    
    if (!targetEl) {
        return { 
            x: -1000, 
            y: -1000, 
            width: 0, 
            height: 0,
            rx: 0
        };
    }
    
    const rect = targetEl.getBoundingClientRect();
    return {
        x: rect.left - padding,
        y: rect.top - padding,
        width: rect.width + 2 * padding,
        height: rect.height + 2 * padding,
        rx: borderRadius
    };
}

function createSvgMask(hole) {
    return `
        <svg width="100%" height="100%" style="position:absolute;top:0;left:0;pointer-events:none;">
            <defs>
                <mask id="spotlight-mask">
                    <rect x="0" y="0" width="100%" height="100%" fill="white"/>
                    <rect x="${hole.x}" y="${hole.y}" width="${hole.width}" height="${hole.height}" rx="${hole.rx}" fill="black"/>
                </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.8)" mask="url(#spotlight-mask)"/>
        </svg>
    `;
}

function createMessageBox(step, hole) {
    const msgBox = document.createElement('div');
    msgBox.className = 'tutorial-message';
    Object.assign(msgBox.style, {
        position: 'absolute',
        maxWidth: '320px',
        background: '#222',
        color: '#fff',
        padding: '1em 1.2em',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        zIndex: 100000,
        fontSize: '1.1em'
    });

    msgBox.innerHTML = `
        <div style="margin-bottom:1em;">${step.message}</div>
        <button id="tutorial-next-btn" style="background:#ffd600;color:#222;border:none;padding:0.5em 1.2em;border-radius:8px;cursor:pointer;font-weight:bold;">Suivant</button>
    `;

    const { top, left } = calculateMessagePosition(step.placement, hole, msgBox);
    msgBox.style.top = `${top}px`;
    msgBox.style.left = `${left}px`;

    return msgBox;
}

function calculateMessagePosition(placement, hole, msgBox) {
    let top, left;
    const msgBoxHeight = 120;
    
    switch (placement) {
        case 'top':
            top = hole.y - (msgBox.offsetHeight || msgBoxHeight) - 70;
            left = hole.x + hole.width / 2 - 160;
            break;
        case 'bottom':
            top = hole.y + hole.height + 20;
            left = hole.x + hole.width / 2 - 160;
            break;
        case 'left':
            top = hole.y + hole.height / 2 - 40;
            left = hole.x - 340;
            break;
        case 'right':
            top = hole.y + hole.height / 2 - 40;
            left = hole.x + hole.width + 20;
            break;
        default:
            top = window.innerHeight / 2 - 60;
            left = window.innerWidth / 2 - 160;
    }

    return {
        top: Math.max(20, Math.min(top, window.innerHeight - (msgBox.offsetHeight || msgBoxHeight))),
        left: Math.max(20, Math.min(left, window.innerWidth - 340))
    };
}

function setupEventListeners() {
    tutorialOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    const nextBtn = tutorialOverlay.querySelector('#tutorial-next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            tutorialStep++;
            showTutorialStep();
        });
    }
}

function removeTutorialOverlay() {
    if (tutorialOverlay) {
        tutorialOverlay.remove();
        tutorialOverlay = null;
    }
}

// === Observateur pour lancement automatique ===
const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 &&
                    node.classList.contains('sheikh-info') &&
                    !getCookie('tuto')) {
                    setTimeout(() => {
                        if (!getCookie('tuto')) startTutorial();
                    }, 1000);
                }
            });
        }
    }
});

if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
}

window.startTutorial = startTutorial;

// === Tutoriel interactif mobile avec effet "spotlight" ===
let mobileTutorialStep = 0;
let mobileTutorialOverlay = null;

const mobileTutorialConfig = [
    {
        target: null,
        message: "As-salāmu ʿalaykum ! Ce tutoriel interactif va vous guider pour profiter pleinement du site.",
        placement: "center"
    },
    {
        target: ".sheikh-photo-mobile",
        message: "Voici la photo du sheikh sélectionné. Touchez-la pour changer de sheikh.",
        placement: "top"
    },
    {
        target: ".control-row-mobile",
        message: "Contrôlez la lecture ici : lecture/pause, suivant/précédent...",
        placement: "top"
    },
    {
        target: ".media-info-mobile",
        message: 'Ici, vous pouvez :<ul><li>Activer le mode "All" pour écouter toutes les sourates à la suite</li><li>Activer "Learning Path" pour réviser dans l\'ordre inverse</li></ul>Ajouter un réciteur à vos favoris ! ⭐',
        placement: "bottom"
    },
    {
        target: ".souratesContainer",
        message: "Faites défiler la liste pour choisir une sourate à écouter.",
        placement: "top"
    },
    {
        target: ".circular-btn",
        message: "Ce bouton permet d'afficher/masquer le texte de la sourate.",
        placement: "top"
    },
    {
        target: null,
        message: "Barak-Allahu fikum !<br>Qu'Allah facilite votre chemin vers la connaissance du Coran.",
        placement: "center"
    }
];

function startMobileTutorial() {
    mobileTutorialStep = 0;
    const circularBtn = document.querySelector('.circular-btn');
    if (circularBtn) {
        originalCircularBtnDisplay = circularBtn.style.display;
        circularBtn.style.display = 'flex';
    }
    showMobileTutorialStep();
    setCookie('tutoMobile', 'done', 365);
}

function showMobileTutorialStep() {
    removeMobileTutorialOverlay();

    if (mobileTutorialStep >= mobileTutorialConfig.length) {
        const circularBtn = document.querySelector('.circular-btn');
        if (circularBtn) {
            circularBtn.style.display = originalCircularBtnDisplay || 'none';
        }
        removeMobileTutorialOverlay();
        return;
    }

    const step = mobileTutorialConfig[mobileTutorialStep];
    const targetEl = step.target ? document.querySelector(step.target) : null;

    if (step.target && !targetEl) {
        mobileTutorialStep++;
        showMobileTutorialStep();
        return;
    }

    // Faire défiler jusqu'à l'élément cible si nécessaire
    if (targetEl) {
        scrollToElement(targetEl).then(() => {
            createMobileTutorialOverlay(step, targetEl);
        });
    } else {
        createMobileTutorialOverlay(step, targetEl);
    }
}

function scrollToElement(element) {
    return new Promise((resolve) => {
        const rect = element.getBoundingClientRect();
        const isVisible = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );

        if (isVisible) {
            resolve();
            return;
        }

        const offset = 60;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });

        setTimeout(resolve, 400);
    });
}

function createMobileTutorialOverlay(step, targetEl) {
    mobileTutorialOverlay = document.createElement('div');
    mobileTutorialOverlay.className = 'mobile-tutorial-overlay';
    Object.assign(mobileTutorialOverlay.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
        pointerEvents: 'auto'
    });

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const hole = calculateMobileHolePosition(targetEl);
    mobileTutorialOverlay.innerHTML = createMobileSvgMask(hole);

    const msgBox = createMobileMessageBox(step, hole);
    mobileTutorialOverlay.appendChild(msgBox);

    setupMobileTutorialEvents();

    document.body.appendChild(mobileTutorialOverlay);
}

function calculateMobileHolePosition(targetEl) {
    const padding = 10;
    const borderRadius = 14;
    if (!targetEl) {
        return { x: -1000, y: -1000, width: 0, height: 0, rx: 0 };
    }
    const rect = targetEl.getBoundingClientRect();
    return {
        x: rect.left - padding,
        y: rect.top - padding,
        width: rect.width + 2 * padding,
        height: rect.height + 2 * padding,
        rx: borderRadius
    };
}

function createMobileSvgMask(hole) {
    return `
        <svg width="100%" height="100%" style="position:absolute;top:0;left:0;pointer-events:none;">
            <defs>
                <mask id="mobile-spotlight-mask">
                    <rect x="0" y="0" width="100%" height="100%" fill="white"/>
                    <rect x="${hole.x}" y="${hole.y}" width="${hole.width}" height="${hole.height}" rx="${hole.rx}" fill="black"/>
                </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.85)" mask="url(#mobile-spotlight-mask)"/>
        </svg>
    `;
}

function createMobileMessageBox(step, hole) {
    const msgBox = document.createElement('div');
    msgBox.className = 'mobile-tutorial-message';
    Object.assign(msgBox.style, {
        position: 'absolute',
        maxWidth: '90vw',
        background: '#222',
        color: '#fff',
        padding: '1em 1.2em',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        zIndex: 1000000,
        fontSize: '1em'
    });

    msgBox.innerHTML = `
        <div style="margin-bottom:1em;">${step.message}</div>
        <button id="mobile-tutorial-next-btn" style="background:#ffd600;color:#222;border:none;padding:0.5em 1.2em;border-radius:8px;cursor:pointer;font-weight:bold;">Suivant</button>
    `;

    const { top, left, right } = calculateMobileMessagePosition(step.placement, hole, msgBox);
    msgBox.style.top = `${top}px`;
    msgBox.style.left = `${left}px`;
    msgBox.style.right = `${right}px`;

    return msgBox;
}

function calculateMobileMessagePosition(placement, hole, msgBox) {
    const minMargin = 10;
    const spacing = 20;
    const maxBoxWidth = 320;

    const msgBoxRect = msgBox.getBoundingClientRect();
    const msgBoxHeight = msgBoxRect.height || 110;

    let top, left, right;

    switch (placement) {
        case 'top':
            top = hole.y - msgBoxHeight - spacing;
            break;
        case 'bottom':
            top = hole.y + hole.height + spacing;
            break;
        case 'left':
            top = hole.y + hole.height / 2 - msgBoxHeight / 2;
            left = hole.x - maxBoxWidth - minMargin;
            break;
        case 'right':
            top = hole.y + hole.height / 2 - msgBoxHeight / 2;
            left = hole.x + hole.width + minMargin;
            break;
        default:
            top = window.innerHeight / 2 - msgBoxHeight / 2;
            left = window.innerWidth / 2 - maxBoxWidth / 2;
    }

    if (placement === 'top' || placement === 'bottom') {
        left = hole.x + hole.width / 2 - maxBoxWidth / 2;
    }

    left = Math.max(minMargin, Math.min(left || 0, window.innerWidth - maxBoxWidth - minMargin));
    right = Math.max(minMargin, window.innerWidth - (left + maxBoxWidth));
    if (placement === 'top') {
        top = Math.min(top, hole.y - msgBoxHeight - spacing);
    }

    top = Math.max(minMargin, Math.min(top, window.innerHeight - msgBoxHeight - minMargin));

    return { top, left, right };
}


function setupMobileTutorialEvents() {
    mobileTutorialOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    const nextBtn = mobileTutorialOverlay.querySelector('#mobile-tutorial-next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileTutorialStep++;
            showMobileTutorialStep();
        });
    }
}

function removeMobileTutorialOverlay() {
    document.body.style.overflow = 'visible';
    document.documentElement.style.overflow = 'visible';
    if (mobileTutorialOverlay) {
        mobileTutorialOverlay.remove();
        mobileTutorialOverlay = null;
    }
}

// Lancement automatique du tutoriel mobile si pas déjà fait
const mobileTutorialObserver = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && node.id === 'main-screen-phone' && !getCookie('tutoMobile')) {
                    setTimeout(() => {
                        if (!getCookie('tutoMobile')) startMobileTutorial();
                    }, 1000);
                }
            });
        }
    }
});

if (document.body) {
    mobileTutorialObserver.observe(document.body, { childList: true, subtree: true });
}

window.startMobileTutorial = startMobileTutorial;

function textRevealAnimation(element, { duration = 1000, delay = 0, reverse = false, absolute = false, pointerEvents = false }) {
    const textNodes = getTextNodes(element); 
    const lengths = textNodes.map(node => node.nodeValue.length);
    const originalText = textNodes.map(node => node.nodeValue).join("");
    const placeholder = originalText.split(" ").map(word => {
        let placeholder = "";
        for (let i = 0; i < word.length; i++) placeholder += " ";
        return placeholder;
    }).join(" ");

    let currentText = placeholder;
    const maxRandomChars = reverse ? originalText.length * 0.25 : originalText.length * 1.5;
    const randomnessFactor = reverse ? 0.1 : 0.8;
    const direction = reverse ? -1 : 1;

    if (absolute) {
        element.style.position = "absolute";
        element.style.top = "0";
    }
    if (!pointerEvents) {
        element.style.pointerEvents = "none";
    }

    return {
        duration,
        delay,
        tick: (progress) => {
        progress = -(Math.cos(Math.PI * progress) - 1) / 2;
        progress = Math.pow(progress, 2);
        if (reverse) progress = 1 - progress;

        let revealedLength = Math.floor(originalText.length * Math.abs(progress * direction));
        let randomLength = Math.floor(2 * (0.5 - Math.abs(progress - 0.5)) * maxRandomChars);

        let newText = reverse 
            ? originalText.slice(0, Math.max(revealedLength - 1 - randomLength, 0))
            : originalText.slice(0, revealedLength);

        if (Math.random() < 0.5 && progress < 1 && progress != 0) {
            for (let i = 0; i < 20; i++) {
            const pos = revealedLength + Math.floor((1 - Math.random()) * randomLength * (i / 20));
            if (currentText[pos] != " ") {
                currentText = replaceCharAt(currentText, pos, getRandomChar(reverse));
            }
            }
        }

        if (reverse) {
            newText += currentText.slice(Math.max(revealedLength - 1 - randomLength, 0), Math.max(revealedLength - 1, 0));
            newText += originalText.slice(Math.max(revealedLength - 1, 0));
        } else {
            newText += currentText.slice(revealedLength, revealedLength + randomLength);
            newText += placeholder.slice(revealedLength + randomLength);
        }

        let offset = 0;
        for (let i = 0; i < textNodes.length; i++) {
            textNodes[i].nodeValue = newText.slice(offset, offset + lengths[i]);
            offset += lengths[i];
        }
        }
    };
}

function getTextNodes(element) {
    const textNodes = [];
    if (element.childNodes.length > 0) {
        element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "") {
            node.nodeValue = node.nodeValue.replace(/(\n|\r|\t)/gm, "");
            textNodes.push(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            textNodes.push(...getTextNodes(node));
        }
        });
    }
    return textNodes;
}

function replaceCharAt(str, index, char) {
    return str.substring(0, index) + char + str.substring(index + 1);
}

function getRandomChar(reverse) {
    const specialChars = "—~±§|[].+$^@*()•x%!?#";
    return reverse 
        ? "x".charAt(Math.floor(Math.random() * "x".length))
        : specialChars.charAt(Math.floor(Math.random() * specialChars.length));
}

function applyTextReveal(element, duration = 1000, delay = 0, reverse = false) {
    if (!element) return;
    
    const animation = textRevealAnimation(element, {
        duration,
        delay,
        reverse,
        absolute: false,
        pointerEvents: true
    });
    
    const start = performance.now();
    requestAnimationFrame(function step(timestamp) {
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / animation.duration, 1);
        animation.tick(progress);
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    });
}

// Fonction pour désactiver les contrôles
function disableControls() {
    const controlsToDisable = [
        'prev-sourate', 'prev-sourate-mobile',
        'backward-30', 'backward-30-mobile',
        'forward-30', 'forward-30-mobile',
        'next-sourate', 'next-sourate-mobile',
        'current-time', 'current-time-mobile',
        'volume-down', 'volume-down-mobile',
        'volume-level', 'volume-level-mobile',
        'volume-up', 'volume-up-mobile',
        'loop-mode', 'loop-mode-mobile'
    ];

    controlsToDisable.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('control-disabled');
    });
}

// Fonction pour activer les contrôles
function enableControls() {
    const controlsToEnable = [
        'prev-sourate', 'prev-sourate-mobile',
        'backward-30', 'backward-30-mobile',
        'forward-30', 'forward-30-mobile',
        'next-sourate', 'next-sourate-mobile',
        'current-time', 'current-time-mobile',
        'volume-down', 'volume-down-mobile',
        'volume-level', 'volume-level-mobile',
        'volume-up', 'volume-up-mobile',
        'loop-mode', 'loop-mode-mobile'
    ];

    controlsToEnable.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('control-disabled');
    });

    controlsInitialized = true;
}

function updateNavigationButtons() {
    // Désactiver [prev] si on est sur la première sourate
    const prevButtons = ['prev-sourate', 'prev-sourate-mobile'];
    const shouldDisablePrev = currentSourateIndex <= 0;
    
    prevButtons.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (shouldDisablePrev) {
                el.classList.add('control-disabled');
            } else {
                el.classList.remove('control-disabled');
            }
        }
    });

    // Désactiver [next] si on est sur la dernière sourate
    const nextButtons = ['next-sourate', 'next-sourate-mobile'];
    const shouldDisableNext = currentSourateIndex >= sourates.length - 1;
    
    nextButtons.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (shouldDisableNext) {
                el.classList.add('control-disabled');
            } else {
                el.classList.remove('control-disabled');
            }
        }
    });
}

function updateSourateName(sourate) {
    ['current-sourate', 'current-sourate-mobile'].forEach(id => {
        const marquee = document.getElementById(id);
        if (!marquee) return;

        const baseText = `${sourate.number}. ${sourate.name} (${sourate.arabicname})`;
        const marqueeText = `${baseText} • ${baseText} • ${baseText}`;
        marquee.textContent = marqueeText;

        const textWidth = marquee.scrollWidth / 3;
        const duration = Math.max(10, textWidth / 30);

        marquee.style.animation = `marquee-step ${duration}s steps(${Math.floor(textWidth/10)}) infinite`;

        marquee.style.animation = 'none';
        void marquee.offsetWidth;
        marquee.style.animation = `marquee-step ${duration}s steps(${Math.floor(textWidth/10)}) infinite`;
    });
}

function updateCurrentTime() {
    const audio = playlistAudio;
    if (audio) {
        const currentTimeMs = audio.currentTime * 1000;
        const seconds = Math.floor(currentTimeMs / 1000) % 60;
        const minutes = Math.floor(currentTimeMs / (1000 * 60)) % 60;
        const hours = Math.floor(currentTimeMs / (1000 * 60 * 60));
        
        ['current-time', 'current-time-mobile'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent =
                    String(hours).padStart(2, '0') + ':' +
                    String(minutes).padStart(2, '0') + ':' +
                    String(seconds).padStart(2, '0');
            }
        });
    }
}

function playNextSourate() {
    // Cas 1: Si on est à la fin d'une playlist unitaire terminée
    if (currentPlaylist.length === 1 && !isPlaying) {
        const nextSourateIndex = currentSourateIndex + 1;
        if (nextSourateIndex >= sourates.length) {
            updateNavigationButtons();
            return;
        }
        
        currentPlaylist = [nextSourateIndex];
        currentPlaylistIndex = 0;
        isPlaying = true;
        playNextInPlaylist();
        return;
    }
    
    // Cas 2: Lecture en cours dans une playlist unitaire
    if (isPlaying && currentPlaylist.length === 1) {
        if (currentAudio) {
            currentAudio.pause();
            clearInterval(updateInterval);
            clearInterval(currentHighlightInterval);
        }
        
        const nextSourateIndex = currentSourateIndex + 1;
        if (nextSourateIndex >= sourates.length) {
            updateNavigationButtons();
            return;
        }
        
        currentPlaylist = [nextSourateIndex];
        currentPlaylistIndex = 0;
        playNextInPlaylist();
        return;
    }
    
    // Cas 3: Mode playlist normal
    if (currentPlaylistIndex >= currentPlaylist.length - 1) {
        const nextSourateIndex = currentSourateIndex + 1;
        if (nextSourateIndex < sourates.length) {
            currentPlaylist.push(nextSourateIndex);
        } else {
            updateNavigationButtons();
            return;
        }
    }
    
    currentPlaylistIndex++;
    playNextInPlaylist();
}

function playPrevSourate() {
    // Cas 1: Si on est au début d'une playlist unitaire terminée
    if (currentPlaylist.length === 1 && !isPlaying) {
        const prevSourateIndex = currentSourateIndex - 1;
        if (prevSourateIndex < 0) {
            updateNavigationButtons();
            return;
        }

        currentPlaylist = [prevSourateIndex];
        currentPlaylistIndex = 0;
        isPlaying = true;
        playNextInPlaylist();
        return;
    }

    // Cas 2: Lecture en cours dans une playlist unitaire
    if (isPlaying && currentPlaylist.length === 1) {
        if (currentAudio) {
            currentAudio.pause();
            clearInterval(updateInterval);
            clearInterval(currentHighlightInterval);
        }

        const prevSourateIndex = currentSourateIndex - 1;
        if (prevSourateIndex < 0) {
            updateNavigationButtons();
            return;
        }

        currentPlaylist = [prevSourateIndex];
        currentPlaylistIndex = 0;
        playNextInPlaylist();
        return;
    }

    // Cas 3: Mode playlist normal
    if (currentPlaylistIndex <= 0) {
        const prevSourateIndex = currentSourateIndex - 1;
        if (prevSourateIndex >= 0) {
            currentPlaylist.unshift(prevSourateIndex);
            currentPlaylistIndex = 0;
        } else {
            updateNavigationButtons();
            return;
        }
    } else {
        currentPlaylistIndex--;
    }

    playNextInPlaylist();
}

// Fonction pour charger le texte d'une sourate
function loadSurahText(index) {
    return new Promise((resolve, reject) => {
        const surahNumber = String(index + 1);

        const isMobile = window.matchMedia('(max-width: 600px)').matches;
        
        loadJSON(`./js/surah/${surahNumber}.json`)
            .then(data => {
                currentSurahText = data;
                displaySurahText(currentSurahText, isMobile);
                resolve();
            })
            .catch(error => {
                console.error("Erreur chargement texte sourate:", error);
                reject(error);
            });
    });
}

function formatDuration(durationMs) {
    const seconds = Math.floor((durationMs / 1000) % 60);
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)));
    
    return String(hours).padStart(2, '0') + ':' +
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
    overlay.style.display = 'block';
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';

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
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = '[tilāwah]';
    label.setAttribute('ontouchend', '')
    label.onclick = () => {
        isInitialLoad = false;
        currentPlaylist = Array.from({ length: sourates.length }, (_, i) => i);
        currentPlaylistIndex = 0;
        document.querySelector('.circular-btn').style.display = 'flex';
        document.querySelector('.circular-btn').style.opacity = '1';
        togglePlaylistMode();
        enableControls();
        playCurrentPlaylist();
    };
    
    const detailsDuration = document.createElement('span');
    detailsDuration.className = 'details';
    detailsDuration.textContent = '...';

    playSpan.appendChild(label);
    playSpan.appendChild(detailsDuration);
    mediaInfo.appendChild(playSpan);

    const sourceSpan = document.createElement('span');
    sourceSpan.className = 'action source';
    const labelsource = document.createElement('span');
    labelsource.className = 'label';
    labelsource.textContent = '[source]';

    const detailsSize = document.createElement('span');
    detailsSize.className = 'details';
    detailsSize.textContent = '...';
    sourceSpan.appendChild(labelsource);
    sourceSpan.appendChild(detailsSize);

    mediaInfo.appendChild(sourceSpan);

    const favoriteSpan = document.createElement('span');
    favoriteSpan.className = 'fav';
    // Récupérer la liste des favoris depuis les cookies
    let favSheikhs = getCookie('favSheikhs');
    favSheikhs = favSheikhs ? JSON.parse(favSheikhs) : [];
    const sheikhName = data.name;

    if (favSheikhs.includes(sheikhName)) {
        favoriteSpan.textContent = '[forget]';
    }
    else {
        favoriteSpan.textContent = '[favorite]';
    }

    favoriteSpan.onclick = () => {
        let favSheikhs = getCookie('favSheikhs');
        favSheikhs = favSheikhs ? JSON.parse(favSheikhs) : [];
        const sheikhName = data.name;

        if (favSheikhs.includes(sheikhName)) {
            favSheikhs = favSheikhs.filter(s => s !== sheikhName);
            favoriteSpan.classList.remove('active');
            favoriteSpan.textContent = '[favorite]';
        } else {
            favSheikhs.push(sheikhName);
            favoriteSpan.classList.add('active');
            favoriteSpan.textContent = '[forget]';
        }

        setCookie('favSheikhs', JSON.stringify(favSheikhs));
        updateSheikhHighlights();
    };

    mediaInfo.appendChild(favoriteSpan);

    const learning = document.createElement('span');
    learning.className = 'learning';
    learning.textContent = '[learningPath]';
    learning.onclick = async () => {
        isLearning = !isLearning;
        isInitialLoad = false;

        if (isLearning) {
            learning.classList.add('active');
            
            currentPlaylist = Array.from({ length: sourates.length }, (_, i) => sourates.length - 1 - i);
            currentPlaylistIndex = 0;
            
            document.querySelector('.circular-btn').style.display = 'flex';
            document.querySelector('.circular-btn').style.opacity = '1';
            
            if (isPlaying && playlistAudio && !playlistAudio.paused) {
                playlistAudio.pause();
                clearInterval(updateInterval);
                clearInterval(currentHighlightInterval);
            }
            
            togglePlaylistMode();
            enableControls();
            await playCurrentPlaylist();
        } else {
            learning.classList.remove('active');
            
            if (isPlaying && playlistAudio && !playlistAudio.paused) {
                playlistAudio.onended = () => {
                    ['play-pause', 'play-pause-mobile'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.textContent = '[play]';
                    });
                };
                
                currentPlaylist = [currentSourateIndex];
                currentPlaylistIndex = 0;

            } else {
                currentPlaylist = [currentSourateIndex];
                isPlaying = false;
            }
            
            updatePlaylistUI && updatePlaylistUI();
        }
    };

    mediaInfo.appendChild(learning);
    overlay.appendChild(mediaInfo);
    
    const container = document.createElement('div');
    container.className = 'souratesContainer';
    container.innerHTML = "";

    const list = document.createElement('div');
    list.className = "sourate-list";
    
    sourates.forEach((sourate) => {
        const item = document.createElement('li');
        item.className = "sourate-item";
        item.innerHTML = `<span class="sourate-number">${sourate.number}</span> ${sourate.name}
                          <div class="sourate-arabic">${sourate.arabicname}</div>
        `;
        item.onclick = () => {
            isInitialLoad = false;
            if (!controlsInitialized) {
                enableControls();
            }
            const sheikh = data;
            currentPlaylist = [sourates.indexOf(sourate)];
            currentPlaylistIndex = 0;
            document.querySelector('.circular-btn').style.display = 'flex';
            document.querySelector('.circular-btn').style.opacity = '1';
            togglePlaylistMode();
            playCurrentPlaylist();
        };
    
        list.appendChild(item);
    });
    container.appendChild(list);
    overlay.appendChild(container);
    return overlay;
}

function returnToCarousel() {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const sheikhNameElement = document.querySelector('.sheikh-name-mobile');
    if (!sheikhNameElement) {
        console.error("Élément .sheikh-name-mobile non trouvé");
        return;
    }

    const sheikhName = sheikhNameElement.textContent;
    const sheikhcurrent = sheikhs.find(s => s.name === sheikhName);
    
    if (!sheikhcurrent) {
        console.error("Sheikh non trouvé :", sheikhName);
        return;
    }

    const activeSlide = document.querySelector('[data-active]');
    if (!activeSlide) {
        console.error("Slide active non trouvée");
        return;
    }

    const sheikhImg = activeSlide.querySelector('img');
    const overlayImg = document.querySelector('.sheikh-photo-mobile');
    
    if (!sheikhImg || !overlayImg) {
        console.error("Éléments d'image non trouvés");
        return;
    }

    // 2. Cloner l'image de l'overlay
    const imgRect = overlayImg.getBoundingClientRect();
    const targetRect = sheikhImg.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(overlayImg);

    const imgClone = overlayImg.cloneNode(true);
    imgClone.style.position = 'fixed';
    imgClone.style.top = `${imgRect.top}px`;
    imgClone.style.left = `${imgRect.left}px`;
    imgClone.style.width = `${imgRect.width}px`;
    imgClone.style.height = `${imgRect.height}px`;
    imgClone.style.zIndex = '9999';
    imgClone.style.transition = 'all 0.8s ease-in-out';
    imgClone.style.borderRadius = computedStyle.borderRadius;
    imgClone.style.objectFit = computedStyle.objectFit;
    imgClone.style.boxShadow = computedStyle.boxShadow;
    imgClone.style.filter = computedStyle.filter;
    imgClone.style.opacity = '1';

    document.body.appendChild(imgClone);

    setTimeout(() => {
        const mainScreenPhone = document.getElementById('main-screen-phone');
        if (mainScreenPhone) {
            mainScreenPhone.style.opacity = '0';
            mainScreenPhone.style.pointerEvents = 'none';
            mainScreenPhone.style.display = 'none';
        }
    }, 200);

    // 4. Déclencher la transition de l'image vers sa position cible
    requestAnimationFrame(() => {
        imgClone.style.top = targetRect.top + 'px';
        imgClone.style.left = targetRect.left + 'px';
        imgClone.style.width = targetRect.width + 'px';
        imgClone.style.height = targetRect.height + 'px';
        imgClone.style.borderRadius = '16px';
    });

    setTimeout(() => {
        const welcomeMessage = document.querySelector('.welcome-message');
        const welcomeScreen = document.querySelector('.welcome-screen');
        
        if (welcomeMessage) {
            welcomeMessage.classList.remove('fade-out');
            welcomeMessage.style.display = 'inline';
            welcomeMessage.style.opacity = '0';
            welcomeMessage.style.pointerEvents = 'auto';
            welcomeMessage.style.transition = 'opacity 1s ease-in';
            setTimeout(() => {
                welcomeMessage.style.opacity = '1';
            }, 10);
        }
        
        if (welcomeScreen) {
            welcomeScreen.classList.remove('fade-in');
            welcomeScreen.style.display = 'block';
            welcomeScreen.style.transition = 'opacity 0.8s ease';
            welcomeScreen.style.opacity = '0';
            welcomeScreen.style.pointerEvents = 'auto';
            setTimeout(() => {
                welcomeScreen.style.opacity = '1';
            }, 100);
        }

        const carouselList = document.getElementById('sheikh-carousel');
        if (carouselList) {
            carouselList.classList.remove('fade-in-up');
        }
        const slides = [...document.querySelectorAll(".carousel__item")];
        slides.forEach((slide) => {
            slide.classList.remove("exit-left", "exit-right");
            slide.removeAttribute("data-active");
            if (slide.querySelector('.sheikh__name')?.textContent === sheikhcurrent.name) {
                slide.setAttribute("data-active", "true");
            }
        });

        // Recentrer le carousel
        const middleIndex = Math.floor(slides.length / 2);
        const currentIndex = slides.findIndex(slide =>
            slide.querySelector('.sheikh__name')?.textContent === sheikhcurrent.name
        );
        
        if (currentIndex >= 0) {
            const offset = currentIndex - middleIndex;
            if (offset > 0) {
                for (let i = 0; i < offset; i++) {
                    const $first = document.querySelectorAll(".carousel__item")[0];
                    carouselList.append($first);
                }
            } else if (offset < 0) {
                for (let i = 0; i < Math.abs(offset); i++) {
                    const $slides = document.querySelectorAll(".carousel__item");
                    const $last = $slides[$slides.length - 1];
                    carouselList.prepend($last);
                }
            }
        }

        setTimeout(() => {
            imgClone.remove();
        }, 100);

        if (auto) clearInterval(auto);
        auto = setInterval(() => {
            const $slides = document.querySelectorAll(".carousel__item");
            const $first = $slides[0];
            document.querySelector(".carousel__list").append($first);
            activateSlide(document.querySelectorAll(".carousel__item")[middleIndex]);
        }, 5000);
    }, 750);
}

function createOverlayMobile(data) {
    const overlay = document.getElementById('main-screen-phone');
    document.documentElement.style.overflow = 'visible'; 
    document.body.style.overflow = 'visible';          

    overlay.style.display = 'block';
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';

    overlay.classList.add('mobile-overlay');

    const nameElement = document.querySelector('.sheikh-name-mobile');
    nameElement.textContent = data.name;

    if (data.photo) {
        const photoElement = document.querySelector('.sheikh-photo-mobile');
        photoElement.src = data.photo;
        photoElement.alt = data.name;
        photoElement.loading = "lazy";
    }

    if (data.bio) {
        const bioContainer = document.querySelector('.sheikh-bio-mobile');
        if (bioContainer) {
            bioContainer.innerHTML = '';
            const lines = data.bio.split(/(?<=\.)\s+/);
            lines.forEach((line) => {
                const span = document.createElement('span');
                span.style.display = "inline";
                span.style.whiteSpace = "normal";
                span.textContent = line;
                bioContainer.appendChild(span);
                bioContainer.appendChild(document.createTextNode(" "));
            });
        }
    }

    const oKCookie = getCookie('oKCookie');
    if (!oKCookie) {
        showMobileCookieAlert(overlay);
    }

    if (overlay.querySelector('.media-info-mobile')) {
    } else {
        const mediaInfo = document.createElement('div');
        mediaInfo.className = 'media-info-mobile';

        const playSpan = document.createElement('span');
        playSpan.className = 'action play mobile';
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = '[tilāwah]';
        label.onclick = () => {
            isInitialLoad = false;
            currentPlaylist = Array.from({ length: sourates.length }, (_, i) => i);
            currentPlaylistIndex = 0;
            document.querySelector('.circular-btn').style.display = 'flex';
            document.querySelector('.circular-btn').style.opacity = '1';
            togglePlaylistMode();
            enableControls();
            playCurrentPlaylist();
        };
        
        const detailsDuration = document.createElement('span');
        detailsDuration.className = 'details mobile';
        detailsDuration.textContent = '...';

        playSpan.appendChild(label);
        playSpan.appendChild(detailsDuration);
        mediaInfo.appendChild(playSpan);

        const sourceSpan = document.createElement('span');
        sourceSpan.className = 'action source mobile';
        const labelsource = document.createElement('span');
        labelsource.className = 'label';
        labelsource.textContent = '[source]';

        const detailsSize = document.createElement('span');
        detailsSize.className = 'details mobile';
        detailsSize.textContent = '...';
        sourceSpan.appendChild(labelsource);
        sourceSpan.appendChild(detailsSize);

        mediaInfo.appendChild(sourceSpan);

        const favoriteSpan = document.createElement('span');
        favoriteSpan.className = 'fav mobile';

        let favSheikhs = getCookie('favSheikhs');
        favSheikhs = favSheikhs ? JSON.parse(favSheikhs) : [];
        const sheikhName = data.name;

        if (favSheikhs.includes(sheikhName)) {
            favoriteSpan.textContent = '[forget]';
        } else {
            favoriteSpan.textContent = '[favorite]';
        }

        favoriteSpan.onclick = () => {
            let favSheikhs = getCookie('favSheikhs');
            favSheikhs = favSheikhs ? JSON.parse(favSheikhs) : [];

            if (favSheikhs.includes(sheikhName)) {
                favSheikhs = favSheikhs.filter(s => s !== sheikhName);
                favoriteSpan.classList.remove('active');
                favoriteSpan.textContent = '[favorite]';
            } else {
                favSheikhs.push(sheikhName);
                favoriteSpan.classList.add('active');
                favoriteSpan.textContent = '[forget]';
            }

            setCookie('favSheikhs', JSON.stringify(favSheikhs));
            updateSheikhHighlights();
        };

        mediaInfo.appendChild(favoriteSpan);

        const learning = document.createElement('span');
        learning.className = 'learning mobile';
        learning.textContent = '[learningPath]';
        learning.onclick = async () => {
            isLearning = !isLearning;
            isInitialLoad = false;

            if (isLearning) {
                // Mode Learning Path activé
                learning.classList.add('active');
                
                // Créer la playlist inversée
                currentPlaylist = Array.from({ length: sourates.length }, (_, i) => sourates.length - 1 - i);
                currentPlaylistIndex = 0;
                
                // Préparer l'interface
                document.querySelector('.circular-btn').style.display = 'flex';
                document.querySelector('.circular-btn').style.opacity = '1';
                
                // Si déjà en lecture, on redémarre
                if (isPlaying && playlistAudio && !playlistAudio.paused) {
                    playlistAudio.pause();
                    clearInterval(updateInterval);
                    clearInterval(currentHighlightInterval);
                }
                
                // Démarrer la lecture
                togglePlaylistMode();
                enableControls();
                await playCurrentPlaylist();
            } else {
                // Mode Learning Path désactivé
                learning.classList.remove('active');
                
                // Si en cours de lecture
                if (isPlaying && playlistAudio && !playlistAudio.paused) {
                    // Option 1: Continuer la lecture de la sourate actuelle puis s'arrêter
                    playlistAudio.onended = () => {
                        ['play-pause', 'play-pause-mobile'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.textContent = '[play]';
                        });
                    };
                    
                    // On réduit la playlist à la sourate actuelle seulement
                    currentPlaylist = [currentSourateIndex];
                    currentPlaylistIndex = 0;

                } else {
                    // Si pas en lecture, juste réinitialiser
                    currentPlaylist = [currentSourateIndex];
                    isPlaying = false;
                }
                
                // Mettre à jour l'interface
                updatePlaylistUI && updatePlaylistUI();
            }
        };

    mediaInfo.appendChild(learning);
    overlay.appendChild(mediaInfo);

    }
        
        // Vérifier si le container existe déjà
        let container = overlay.querySelector('.souratesContainer');
        if (!container) {
            container = document.createElement('div');
            container.className = 'souratesContainer';
            container.innerHTML = "";
        } else {
            container.innerHTML = "";
        }

        // Vérifier si la liste existe déjà
        let list = container.querySelector('.sourate-list');
        if (!list) {
            list = document.createElement('div');
            list.className = "sourate-list";
        } else {
            list.innerHTML = "";
        }
        
        // Remove existing sourate items if any
        while (list.firstChild) {
            list.removeChild(list.firstChild);
        }

        sourates.forEach((sourate) => {
            const item = document.createElement('li');
            item.className = "sourate-item";
            item.innerHTML = `
            <span class="sourate-number">${sourate.number}</span> ${sourate.name}
            <div class="sourate-arabic">${sourate.arabicname}</div>
            `;
            item.onclick = () => {
            isInitialLoad = false;
            if (!controlsInitialized) {
                enableControls();
            }
            const sheikh = data;
            currentPlaylist = [sourates.indexOf(sourate)];
            currentPlaylistIndex = 0;
            document.querySelector('.circular-btn').style.display = 'flex';
            document.querySelector('.circular-btn').style.opacity = '1';
            togglePlaylistMode();
            playCurrentPlaylist();
        };
        
            list.appendChild(item);
        });
        container.appendChild(list);
        overlay.appendChild(container);

    const photo = overlay.querySelector('.sheikh-photo-mobile');
    if (photo) {
        photo.addEventListener('click', function(e) {
            e.stopPropagation();
            returnToCarousel();
        });
    }
    
    return overlay;
}

async function toggleSheikhInfo() {
    const sheikhInfo = document.querySelector('.sheikh-info');
    const container = document.querySelector('.sourate-container');
    
    // Charger le texte de la sourate si nécessaire
    if (!currentSurahText && currentSourateIndex !== undefined) {
        try {
            const surahNumber = String(currentSourateIndex + 1);
            currentSurahText = await loadJSON(`./js/surah/${surahNumber}.json`);
        } catch (error) {
            console.error("Erreur chargement texte sourate:", error);
            return;
        }
    }

    if (sheikhInfo) {
        if (sheikhInfo.style.opacity === '1') {
            // Mode disparition
            sheikhInfo.style.opacity = '0';
            sheikhInfo.style.pointerEvents = 'none'; // Désactive les interactions
            container.style.opacity = '1';
            container.style.pointerEvents = 'auto'; // Réactive les interactions
            container.style.display = 'block';
            displaySurahText(currentSurahText);
            
        } else {
            // Mode apparition
            sheikhInfo.style.display = 'block'; 
            sheikhInfo.style.opacity = '1';
            sheikhInfo.style.pointerEvents = 'auto';
            container.style.opacity = '0';
            container.style.pointerEvents = 'none';
            container.style.display = 'none';
        }
    }
}

async function toggleMainScreenPhone() {
    const mainScreenPhone = document.getElementById('main-screen-phone');
    const container = document.getElementById('sourate-container-mobile');   

    // Charger le texte de la sourate si nécessaire
    if (!currentSurahText && currentSourateIndex !== undefined) {
        try {
            const surahNumber = String(currentSourateIndex + 1);
            currentSurahText = await loadJSON(`./js/surah/${surahNumber}.json`);
        } catch (error) {
            console.error("Erreur chargement texte sourate:", error);
            return;
        }
    }

    if (mainScreenPhone) {
        // Sélectionne tous les enfants sauf le premier
        const children = Array.from(mainScreenPhone.children).slice(1);

        if (container.style.opacity === '0') {
            // Mode disparition
            children.forEach(child => {
                child.style.opacity = '0';
                child.style.pointerEvents = 'none';
            });
            document.documentElement.style.overflow = 'hidden'; 
            document.body.style.overflow = 'hidden';
            container.style.opacity = '1';
            container.style.display = 'block';
            container.style.pointerEvents = 'auto';
            displaySurahText(currentSurahText, true);
        } else {
            children.forEach(child => {
                child.style.opacity = '1';
                child.style.pointerEvents = 'auto';
            });
            document.documentElement.style.overflow = 'visible'; 
            document.body.style.overflow = 'visible';
            if (container) {
                container.style.opacity = '0';
                container.style.display = 'none';
                container.style.pointerEvents = 'none';
            }
        }
    }
}

function highlightCurrentVerse() {
    // Vérifier si l'audio ou les timings sont disponibles ou si le conteneur n'existe pas
    // Détecter si on est en mode mobile ou desktop
    const container = document.querySelector('.sourate-container');
    if (!container || container.style.display === 'none' || container.style.opacity === '0') {
        return; // Ne rien faire si le conteneur n'est pas visible
    }

    const currentTime = playlistAudio.currentTime * 1000; // Convertir en millisecondes
    const verseTexts = document.querySelectorAll('.verse-text');

    // Réinitialiser tout surlignage précédent
    verseTexts.forEach(v => {
        v.innerHTML = v.textContent;
        v.style.backgroundColor = '';
    });
    // Trouver le verset correspondant au moment actuel
    for (let i = 0; i < currentVerseTimings.length; i++) {
        const verseTiming = currentVerseTimings[i];
        if (currentTime >= verseTiming.timestamp_from && currentTime <= verseTiming.timestamp_to) {
            const verseNumber = parseInt(verseTiming.verse_key.split(':')[1]);
            const verseElement = document.querySelector(`.verse[data-verse="${verseNumber}"] .verse-text`);

            if (!verseElement || !verseTiming.segments) return;

            const verseText = verseElement.textContent;
            const words = verseText.trim().match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+(?:\s*[ۛۖۚۗۙۘۜ۝۞])*/g);
            let highlightedHtml = '';
            let segmentHighlighted = false;

            // Défilement automatique pour garder le verset visible
            const container = document.querySelector('.surah-text-container');
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const verseRect = verseElement.getBoundingClientRect();
                const buffer = 300; // Marge en pixels

                if (verseRect.bottom > containerRect.bottom - buffer) {
                    container.scrollTo({
                        top: container.scrollTop + (verseRect.bottom - containerRect.bottom + buffer),
                        behavior: 'smooth'
                    });
                }
            }

            // Surligner le mot courant en fonction du segment audio
            for (let j = 0; j < verseTiming.segments.length; j++) {
                const segment = verseTiming.segments[j];
                if (segment.length < 3) continue;

                const [segmentIndex, from, to] = segment;
                if (currentTime >= from && currentTime <= to) {
                    const wordIndex = segmentIndex - 1; // Les segments commencent à 1

                    highlightedHtml = words.map((word, index) => {
                        return index === wordIndex 
                            ? `<span class="current-segment">${word}</span>`
                            : word;
                    }).join(' ');

                    verseElement.innerHTML = highlightedHtml;
                    segmentHighlighted = true;
                    break;
                }
            }

            // Si aucun segment n'est actif, afficher le texte normal
            if (!segmentHighlighted) {
                verseElement.innerHTML = words.join(' ');
            }

            return; // On a trouvé le verset, on peut sortir
        }
    }
}

// Appeler cette fonction régulièrement pendant la lecture
function startHighlightInterval() {
    clearInterval(currentHighlightInterval); // Nettoyer l'intervalle précédent
    currentHighlightInterval = setInterval(highlightCurrentVerse, 100); // Vérifier toutes les 100ms
}

// Arrêter le suivi du surlignage
function stopHighlightInterval() {
    clearInterval(currentHighlightInterval);
    currentHighlightInterval = null;
}

function displaySurahText(surahData, isMobile) {
    const containerSelector = isMobile ? 'sourate-container-mobile' : 'sourate-container';

    const container = document.getElementById(containerSelector);
    container.innerHTML = ''; // Vide le conteneur
    
    const textContainer = document.createElement('div');
    textContainer.className = 'surah-text-container';
    textContainer.style.opacity = '0'; // Commence invisible

    setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, 300);
    
    // Titre de la sourate avec animation
    const title = document.createElement('h3');
    title.textContent = `${surahData.index}. ${sourates[surahData.index - 1].name} - ${sourates[surahData.index - 1].arabicname}`;
    textContainer.appendChild(title);

    // Création des versets
    for (let i = 1; i <= surahData.count; i++) {
        const verseKey = `verse_${i}`;
        if (surahData.verse[verseKey]) {
            const verseElement = document.createElement('div');
            verseElement.className = 'verse';
            verseElement.dataset.verse = i;
            verseElement.style.opacity = '0'; // Commence invisible
            verseElement.style.transition = `opacity 0.2s ease ${i * 0.05}s`; // Animation en cascade

            const verseText = document.createElement('span');
            verseText.className = 'verse-text';
            verseText.textContent = surahData.verse[verseKey];

            const verseNumber = document.createElement('span');
            verseNumber.className = 'verse-number';
            verseNumber.textContent = ' ' + i;

            verseElement.appendChild(verseText);
            verseElement.appendChild(verseNumber);
            textContainer.appendChild(verseElement);
        }
    }

    container.appendChild(textContainer);
    
    // Animation d'apparition
    setTimeout(() => {
        textContainer.style.transition = 'opacity 0.3s ease';
        textContainer.style.opacity = '1';
        
        // Animation des versets en cascade
        const verses = textContainer.querySelectorAll('.verse');
        verses.forEach(verse => {
            verse.style.opacity = '1';
        });
    }, 10);
}


document.querySelector('.circular-btn').addEventListener('click', toggleSheikhInfo);
document.querySelector('.circular-btn').addEventListener('click', toggleMainScreenPhone);

window.onload = async () => {
    const welcomeMessage = document.getElementById('welcome-message');

    // Crée une balise image neuve avec un timestamp pour forcer le cache
    const gifImg = document.createElement('img');
    gifImg.src = `./assets/videos/welcome.gif?${Date.now()}`;
    gifImg.className = 'welcome-animation';

    // Crée et joue l'audio Bismillah en même temps que le gif
    const audio = new Audio('./assets/audio/Bismillah.mp3');
    audio.muted = true; // hack
    audio.play().then(() => {
        audio.pause();
        audio.muted = false;
        audio.currentTime = 0;
        return audio.play(); // relance sans mute
    }).catch(err => {
    });

    welcomeMessage.innerHTML = '';
    welcomeMessage.appendChild(gifImg);

    setTimeout(() => {
        welcomeMessage.style.display = 'none';
        welcomeMessage.innerHTML = '';
    }, 8500);

  setTimeout(() => {
    welcomeMessage.textContent = "Select your Sheikh to start:";
    welcomeMessage.style.display = 'block';
    
    const animation = textRevealAnimation(welcomeMessage, {
        duration: 2000,
        delay: 0,
        reverse: false
    });
    
    const start = performance.now();
    requestAnimationFrame(function step(timestamp) {
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / animation.duration, 1);
        animation.tick(progress);
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    });
    
    welcomeMessage.classList.add('up');
}, 8500);

  const carouselList = document.getElementById('sheikh-carousel');
  const welcomeScreen = document.querySelector('.welcome-screen');
  setTimeout(() => {
    carouselList.classList.add('fade-in-up');
    welcomeScreen.classList.add('fade-in');
  }, 9000);
};


// === Initialisation du carrousel ===
document.addEventListener("DOMContentLoaded", () => {
    const carouselList = document.getElementById('sheikh-carousel');
    
    // Récupérer les sheikhs favoris depuis les cookies
    let favSheikhs = getCookie('favSheikhs');
    favSheikhs = favSheikhs ? JSON.parse(favSheikhs) : [];

    // Trier les sheikhs pour mettre les favoris en premier
    const sortedSheikhs = [...sheikhs].sort((a, b) => {
        const aIsFav = favSheikhs.includes(a.name);
        const bIsFav = favSheikhs.includes(b.name);
        
        if (aIsFav && !bIsFav) return -1;
        if (!aIsFav && bIsFav) return 1;
        return 0;
    });

    // Créer les éléments du carrousel pour chaque sheikh (dans l'ordre trié)
    sortedSheikhs.forEach((sheikh, index) => {
        const carouselItem = document.createElement('li');
        carouselItem.className = 'carousel__item';
        carouselItem.tabIndex = 0;
        carouselItem.dataset.index = index; // Garder l'index original
        if (index == 0) carouselItem.setAttribute('data-active', 'true');

        carouselItem.innerHTML = `
            <div class="carousel__box">
                <div class="carousel__image">
                    <img src="${sheikh.photo}" width="480" height="720" alt="${sheikh.name}">
                </div>
                <div class="carousel__contents">
                    <h2 class="sheikh__name">${sheikh.name}</h2>
                </div>
            </div>
        `;
        
        carouselList.appendChild(carouselItem);
    });

    // Initialiser la logique du carrousel
    if (!carouselInitialized) {
        initCarouselLogic();
    }

});

function initCarouselLogic() {

    if (carouselInitialized) {
        const $prev = document.querySelector(".prev");
        const $next = document.querySelector(".next");
        const $list = document.querySelector(".carousel__list");
        
        // Cloner les éléments pour supprimer les écouteurs
        if ($prev) $prev.replaceWith($prev.cloneNode(true));
        if ($next) $next.replaceWith($next.cloneNode(true));
        if ($list) $list.replaceWith($list.cloneNode(true));
        
        // Arrêter les intervalles existants
        if (auto) clearInterval(auto);
        if (pauser) clearTimeout(pauser);
    }

    const d = document;
    const $q = d.querySelectorAll.bind(d);
    const $g = d.querySelector.bind(d);
    const $prev = $g(".prev");
    const $next = $g(".next");
    const $list = $g(".carousel__list");
    let auto;
    let pauser;

    const getActiveIndex = () => {
        const $active = $g("[data-active]");
        return getSlideIndex($active);
    };

    const getSlideIndex = ($slide) => {
        return [...$q(".carousel__item")].indexOf($slide);
    };

    const prevSlide = () => {
        const index = getActiveIndex();
        const $slides = $q(".carousel__item");
        const $last = $slides[$slides.length - 1];
        $last.remove();
        $list.prepend($last);
        activateSlide($q(".carousel__item")[index]);
    };

    const nextSlide = () => {
        const index = getActiveIndex();
        const $slides = $q(".carousel__item");
        const $first = $slides[0];
        $first.remove();
        $list.append($first);
        activateSlide($q(".carousel__item")[index]);
    };

    const activateSlide = ($slide) => {
        if (!$slide) return;
        const $slides = $q(".carousel__item");
        $slides.forEach((el) => el.removeAttribute("data-active"));
        $slide.setAttribute("data-active", true);
        $slide.focus();
    };

    const autoSlide = () => {
        nextSlide();
    };

    const pauseAuto = () => {
        clearInterval(auto);
        clearTimeout(pauser);
    };

    const handleNextClick = (e) => {
        pauseAuto();
        nextSlide(e);
    };

    const handlePrevClick = (e) => {
        pauseAuto();
        prevSlide(e);
    };

    const handleSlideClick = (e) => {
        pauseAuto();
        const $slide = e.target.closest(".carousel__item");
        if (!$slide) return;

        const index = parseInt($slide.dataset.index, 10);

        const isActive = $slide.hasAttribute("data-active");

        if (isActive) {
            // Sélection directe : on anime les autres
            const slides = [...document.querySelectorAll(".carousel__item")];
            const middleIndex = Math.floor(slides.length / 2);

            slides.forEach((slide, i) => {
                if (i < middleIndex) {
                    slide.classList.add("exit-left");
                } else if (i > middleIndex) {
                    slide.classList.add("exit-right");
                }
                // le Sheikh sélectionné reste sans classe
            });

            // Attend la fin de l'animation avant d'initialiser
            if (!window.isSheikhInitializing) {
                window.isSheikhInitializing = true;
                setTimeout(() => {
                    pauseAuto();
                    initializeSheikh(index);
                    window.isSheikhInitializing = false;
                }, 500); // durée identique à l'animation CSS
            }
        } else {
            // Recentrer ce Sheikh
            const slides = [...document.querySelectorAll(".carousel__item")];
            const middleIndex = Math.floor(slides.length / 2);
            const currentIndexInDOM = slides.indexOf($slide);
            const offset = currentIndexInDOM - middleIndex;

            if (offset > 0) {
                for (let i = 0; i < offset; i++) nextSlide();
            } else {
                for (let i = 0; i < Math.abs(offset); i++) prevSlide();
            }

            // Activer celui qui est maintenant au centre
            const newCenter = document.querySelectorAll(".carousel__item")[middleIndex];
            activateSlide(newCenter);
        }
    };

    const handleSlideKey = (e) => {
    switch (e.keyCode) {
        case 37: // Left arrow
        case 65: // 'A' key
        handlePrevClick();
        break;
        case 39: // Right arrow
        case 68: // 'D' key
        handleNextClick();
        break;
        case 13: // Enter key
        const $slide = e.target.closest(".carousel__item");
        if ($slide) {
            handleSlideClick({ target: $slide });
        }
        break;
    }
    };

    const startAuto = () => {
        auto = setInterval(autoSlide, 5000);
    };

    setTimeout(() => {
        startAuto();
    }, 10000);

    const pauseOnUserInteraction = () => {
        pauseAuto();
    };

    let touchStartX = 0;
    let touchEndX = 0;

    $list.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    $list.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleGesture();
    }, { passive: true });

    function handleGesture() {
    const delta = touchEndX - touchStartX;
    if (Math.abs(delta) < 30) return; // ignore petits mouvements

    if (delta < 0) {
        handleNextClick(); // swipe gauche → next
    } else {
        handlePrevClick(); // swipe droite → prev
    }
    }

    // === Activer le slide du milieu au chargement ===
    const slides = [...$q(".carousel__item")];
    const middleIndex = Math.floor(slides.length / 2);
    const offset = 0 - middleIndex; // car tu veux que le slide d'indice 0 soit au milieu

    if (offset > 0) {
        for (let i = 0; i < offset; i++) nextSlide();
    } else {
        for (let i = 0; i < Math.abs(offset); i++) prevSlide();
    }

    const newCenter = $q(".carousel__item")[middleIndex];
    activateSlide(newCenter);

    $list.addEventListener("touchstart", pauseOnUserInteraction, { passive: true });
    $list.addEventListener("wheel", pauseOnUserInteraction, { passive: true });
    $list.addEventListener("scroll", pauseOnUserInteraction, { passive: true });
    $list.addEventListener("keydown", handleSlideKey);
    $list.addEventListener("click", handleSlideClick);
    $prev.addEventListener("click", handlePrevClick);
    $next.addEventListener("click", handleNextClick);
    $list.addEventListener("focusin", handleSlideClick);

    carouselInitialized = true;
}

// Fonction pour afficher les stats
async function displaySheikhStats(sheikh) {  // On passe l'objet sheikh complet
    // Vérifier le cache d'abord
    if (statsCache[sheikh.name]) {
        updateStatsUI(statsCache[sheikh.name]);
        return;
    }

    // Détruire le worker précédent s'il existe
    if (statsWorker) {
        statsWorker.terminate();
    }
    
    // Créer un nouveau worker
    statsWorker = new Worker('./js/statsWorker.js');
    
    // Afficher un indicateur de chargement
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    if (isMobile) {
        document.getElementById('heures-mobile').textContent = '// ...';
        document.getElementById('minutes-mobile').textContent = '// ...';
        document.getElementById('secondes-mobile').textContent = '// ...';
    } else {
        document.getElementById('heures').textContent = '// ...';
        document.getElementById('minutes').textContent = '// ...';
        document.getElementById('secondes').textContent = '// ...';
    }
    
    statsWorker.onmessage = function(e) {
        const stats = e.data;
        if (!stats || stats.error) return;
        
        // Mettre en cache
        statsCache[sheikh.name] = stats;
        updateStatsUI(stats);
        
        // Terminer le worker
        statsWorker.terminate();
        statsWorker = null;
    };
    
    // Démarrer le calcul avec le filename exact
    statsWorker.postMessage({ 
        filename: sheikh.filename  // On utilise directement le champ filename
    });
}

function updateStatsUI(stats) {
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    if (isMobile) {
        document.getElementById('heures-mobile').textContent = '// ' + stats.hours;
        document.getElementById('minutes-mobile').textContent = '// ' + stats.minutes;
        document.getElementById('secondes-mobile').textContent = '// ' + stats.seconds;
    } else {
        document.getElementById('heures').textContent = '// ' + stats.hours;
        document.getElementById('minutes').textContent = '// ' + stats.minutes;
        document.getElementById('secondes').textContent = '// ' + stats.seconds;
    }
}


// Fonction pour initialiser l'écran principal avec le Sheikh sélectionné
window.initializeSheikh = function (index) {
    let favSheikhs = getCookie('favSheikhs');
    favSheikhs = favSheikhs ? JSON.parse(favSheikhs) : [];

    const sortedSheikhs = [...sheikhs].sort((a, b) => {
        const aIsFav = favSheikhs.includes(a.name);
        const bIsFav = favSheikhs.includes(b.name);
        
        if (aIsFav && !bIsFav) return -1;
        if (!aIsFav && bIsFav) return 1;
        return 0;
    });

    const sheikh = sortedSheikhs[index];
    currentSheikh = sheikh;
    displaySheikhStats(sheikh);

    const welcomeMessage = document.querySelector('.welcome-message');
    const welcomeScreen = document.querySelector('.welcome-screen');

    const mainScreen = document.getElementById('main-screen');
    
    const activeSlide = document.querySelector('[data-active]');

    // === Cloner l'image ===
    const sheikhImg = activeSlide.querySelector('img');
    const imgRect = sheikhImg.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(sheikhImg);

    const imgClone = sheikhImg.cloneNode(true);
    imgClone.style.position = 'fixed';
    imgClone.style.top = imgRect.top + 'px';
    imgClone.style.left = imgRect.left + 'px';
    imgClone.style.width = imgRect.width + 'px';
    imgClone.style.height = imgRect.height + 'px';
    imgClone.style.zIndex = '9999';
    imgClone.style.transition = 'all 0.8s ease-in-out';

    // 🧪 Copier les styles visuels
    imgClone.style.boxShadow = computedStyle.boxShadow;
    imgClone.style.objectFit = computedStyle.objectFit;
    imgClone.style.filter = computedStyle.filter;
    imgClone.style.opacity = computedStyle.opacity;
    imgClone.style.borderRadius = '16px';

    document.body.appendChild(imgClone);

    // Cacher temporairement menuL et menuR
    const menuL = document.querySelector('.menuL');
    const menuR = document.querySelector('.menuR');
    menuL.style.opacity = '0';
    menuR.style.opacity = '0';
    
    // === Fade-out de l'écran de bienvenue ===
    welcomeMessage.classList.add('fade-out');
    
    setTimeout(() => {
        welcomeMessage.style.opacity = '0';
        welcomeMessage.style.pointerEvents = 'none';
        welcomeMessage.style.display = 'none';
        welcomeScreen.style.opacity = '0';
        welcomeScreen.style.transition = 'none'; // Remove transition for instant effect
        welcomeScreen.style.pointerEvents = 'none';
        
        mainScreen.style.display = 'block';
        
        const currentOverlay = window.innerWidth <= 768
            ? document.getElementById('main-screen-phone')
            : document.querySelector('.sheikh-info');
        
        let newOverlay;
        if (window.innerWidth <= 768) {
            newOverlay = createOverlayMobile(sheikh);
        } else {
            newOverlay = createOverlay(sheikh);
        }

        newOverlay.style.opacity = '0'; // On cache
        document.body.appendChild(newOverlay);
        
        // === Transition de l'image ===
        const targetImg = newOverlay.querySelector('img');
        const targetRect = targetImg.getBoundingClientRect();

        requestAnimationFrame(() => {
            imgClone.style.top = targetRect.top + 'px';
            imgClone.style.left = targetRect.left + 'px';
            imgClone.style.width = targetRect.width + 'px';
            imgClone.style.height = targetRect.height + 'px';
        });

        // === Une fois l'image en place ===
        setTimeout(() => {
            // Afficher doucement menuL et menuR
            updateNavigationButtons();
            if (isInitialLoad) disableControls();
            menuL.style.transition = 'opacity 0.4s ease';
            menuR.style.transition = 'opacity 0.4s ease';
            menuL.style.opacity = '1';
            menuR.style.opacity = '1';

            imgClone.remove();
            newOverlay.style.transition = 'opacity 0.4s ease';
            newOverlay.style.opacity = '1';

            // === Animation textuelle ===
            // Desktop
            if (window.innerWidth > 768) {
                const sheikhName = newOverlay.querySelector('.sheikh-name');
                const sheikhBio = newOverlay.querySelector('.sheikh-bio');
                const mediaInfo = newOverlay.querySelector('.media-info');
                const souratesContainer = newOverlay.querySelector('.souratesContainer');
                if (sheikhName) applyTextReveal(sheikhName, 800, 0);
                if (sheikhBio) applyTextReveal(sheikhBio, 1200, 200);
                if (mediaInfo) applyTextReveal(mediaInfo, 800, 400);
                if (souratesContainer) applyTextReveal(souratesContainer, 1000, 600);

                // Animer les éléments du menuR
                document.querySelectorAll('.menu-item').forEach((item, i) => {
                    applyTextReveal(item, 600, 100 * i);
                });

                // Animer les éléments du menuL
                const codestyle = document.querySelector('.code-style');
                const audiocontrol = document.querySelector('.control-row');
                const sheikhstats = document.querySelector('.sheikh-stats');
                if (codestyle) applyTextReveal(codestyle, 600, 100);
                if (audiocontrol) applyTextReveal(audiocontrol, 600, 200);
                if (sheikhstats) applyTextReveal(sheikhstats, 600, 300);
            } else {
                // Mobile
                const sheikhName = newOverlay.querySelector('.sheikh-name-mobile');
                const sheikhBio = newOverlay.querySelector('.sheikh-bio-mobile');
                const mediaInfo = newOverlay.querySelector('.media-info-mobile');
                const souratesContainer = newOverlay.querySelector('.souratesContainer');
                const codestylemobile = newOverlay.querySelector('.code-style');
                if (sheikhName) applyTextReveal(sheikhName, 800, 0);
                if (sheikhBio) applyTextReveal(sheikhBio, 1200, 200);
                if (mediaInfo) applyTextReveal(mediaInfo, 800, 400);
                if (souratesContainer) applyTextReveal(souratesContainer, 1000, 600);
                if (codestylemobile) applyTextReveal(codestylemobile, 600, 100);

                // Animer les éléments du menuR
                document.querySelectorAll('.menu-item').forEach((item, i) => {
                    applyTextReveal(item, 600, 100 * i);
                });

                // Animer les éléments du menuL
                const codestyle = document.querySelector('.code-style');
                const audiocontrol = document.querySelector('.control-row-mobile');
                const sheikhstats = document.querySelector('.sheikh-stats-mobile');
                if (codestyle) applyTextReveal(codestyle, 600, 100);
                if (audiocontrol) applyTextReveal(audiocontrol, 600, 200);
                if (sheikhstats) applyTextReveal(sheikhstats, 600, 300);

            }
            if (!window.matchMedia('(max-width: 600px)').matches) {
                const playlistBtn = document.getElementById('playlist');
                playlistBtn.style.display = 'flex';
                playlistBtn.style.opacity = '1';
                playlistBtn.style.right = '20px';
                playlistBtn.addEventListener('click', togglePlaylistMode);

                const helpBtn = document.getElementById('help-tutorial-btn');
                if (helpBtn) {
                    helpBtn.style.display = 'flex';
                    helpBtn.style.opacity = '1';
                    helpBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Supprime le cookie pour forcer le tutoriel
                    setCookie('tuto', '', -1);
                    startTutorial();
                    });
                }
            }

        }, 800);

        // Active the menu item whose text matches the selected sheikh's name
        const sheikhName = document.querySelector('.sheikh-name')?.textContent;
        document.querySelectorAll('.menu-item').forEach(item => {
            if (item.textContent === sheikhName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

    }, 500);
};

// === Animation en cascade à la fin du chargement (uniquement pour textes initiaux) ===
window.addEventListener("DOMContentLoaded", () => {

    // Génère le menu une fois que le DOM est prêt
    const menu = document.getElementById('menuR');
    const copieSheikhs = [...sheikhs];
    
    // Trie les sheikhs : si pas de favoris, ordre alphabétique ; sinon, favoris d'abord puis alphabétique
    let favSheikhs = getCookie('favSheikhs');
    favSheikhs = favSheikhs ? JSON.parse(favSheikhs) : [];
    if (favSheikhs.length === 0) {
        copieSheikhs.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        copieSheikhs.sort((a, b) => {
            const aIsFav = favSheikhs.includes(a.name);
            const bIsFav = favSheikhs.includes(b.name);
            if (aIsFav && !bIsFav) return -1;
            if (!aIsFav && bIsFav) return 1;
            return a.name.localeCompare(b.name);
        });
    }

    copieSheikhs.forEach((sheikh) => {
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
                if (window.innerWidth <= 768) {
                    current.replaceWith(createOverlayMobile(sheikh));
                } else {
                    current.replaceWith(createOverlay(sheikh));
                }
            } else {
                if (window.innerWidth <= 768) {
                    document.body.appendChild(createOverlayMobile(sheikh));
                } else {
                    document.body.appendChild(createOverlay(sheikh));
                }
            }

            // Gérer le container selon le mode (mobile ou desktop)
            const container = window.innerWidth <= 768
                ? document.getElementById('sourate-container-mobile')
                : document.querySelector('.sourate-container');
            if (current.style.opacity === '0') {
                current.style.display = 'block'; 
                current.style.opacity = '1';
                current.style.pointerEvents = 'auto';
                container.style.opacity = '0';
                container.style.pointerEvents = 'none';
            }

            displaySheikhStats(sheikh);
        };
        menu.appendChild(div);
        updateSheikhHighlights();
    });

});

// Gestion des événements
['play-pause', 'play-pause-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', () => {
            if (isInitialLoad) {
                // Premier chargement ou pas d'audio chargé
                isInitialLoad = false;

                // Lance une playlist contenant toutes les sourates
                currentPlaylist = Array.from({ length: sourates.length }, (_, i) => i);
                currentPlaylistIndex = 0;
                document.querySelector('.circular-btn').style.display = 'flex';
                document.querySelector('.circular-btn').style.opacity = '1';
                togglePlaylistMode();
                enableControls();
                playCurrentPlaylist();
                return;
            }

            // Si une playlist est déjà en cours de lecture ou en pause
            if (playlistAudio) {
                if (playlistAudio.paused) {
                    playlistAudio.play();
                    isPlaying = true;
                    el.textContent = '[stop]';
                    updateInterval = setInterval(updateCurrentTime, 1000);
                } else {
                    playlistAudio.pause();
                    isPlaying = false;
                    el.textContent = '[play]';
                    clearInterval(updateInterval);
                }
            }
        });
    }
});

['next-sourate', 'next-sourate-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', playNextSourate);
    }
});
['prev-sourate', 'prev-sourate-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', playPrevSourate);
    }
});

['forward-30', 'forward-30-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', () => {
            const audio = playlistAudio;
            if (audio) {
                audio.currentTime = Math.min(audio.currentTime + 30, audio.duration);
                updateCurrentTime();
            }
        });
    }
});

['backward-30', 'backward-30-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', () => {
            const audio = playlistAudio;
            if (audio) {
                audio.currentTime = Math.max(audio.currentTime - 30, 0);
                updateCurrentTime();
            }
        });
    }
});

['volume-up', 'volume-up-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', () => {
            currentVolume = Math.min(currentVolume + 0.1, 1.0);
            if (currentAudio) currentAudio.volume = currentVolume;
            const percent = Math.round(currentVolume * 100);
            // Set the correct volume-level element depending on the button
            if (id === 'volume-up') {
                document.getElementById('volume-level').textContent =
                    `${percent}%`.length === 3 ? `${percent}%` : ` ${percent}%`;
            } else if (id === 'volume-up-mobile') {
                const mobileLevel = document.getElementById('volume-level-mobile');
                if (mobileLevel) {
                    mobileLevel.textContent =
                        `${percent}%`.length === 3 ? `${percent}%` : ` ${percent}%`;
                }
            }
        });
    }
});

['volume-down', 'volume-down-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', () => {
            currentVolume = Math.max(currentVolume - 0.1, 0);
            if (currentAudio) currentAudio.volume = currentVolume;
            const percent = Math.round(currentVolume * 100);
            // Set the correct volume-level element depending on the button
            if (id === 'volume-down') {
                document.getElementById('volume-level').textContent =
                    `${percent}%`.length === 3 ? `${percent}%` : ` ${percent}%`;
            } else if (id === 'volume-down-mobile') {
                const mobileLevel = document.getElementById('volume-level-mobile');
                if (mobileLevel) {
                    mobileLevel.textContent =
                        `${percent}%`.length === 3 ? `${percent}%` : ` ${percent}%`;
                }
            }
        });
    }
});

// Fonction pour basculer le mode loop
function toggleLoopMode() {
    isLoopEnabled = !isLoopEnabled;
    
    // Mettre à jour l'audio actif
    const activeAudio = playlistAudio;
    if (activeAudio) {
        activeAudio.loop = isLoopEnabled;
    }
    
    // Mettre à jour l'UI
    ['loop-mode', 'loop-mode-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const child = el.firstElementChild;
            if (child) {
                if (isLoopEnabled) {
                    child.classList.add('active');
                } else {
                    child.classList.remove('active');
                }
            }
        }
    });
}

['loop-mode', 'loop-mode-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', toggleLoopMode);
    }
});

// === Liste des sheikhs ===
const sheikhs = [
    {
        name: "Mishari Rashid al-`Afasy",
        filename: "Mishari_Rashid_al_Afasy.json",
        photo: "./assets/images/Mishary-Rashid-Alafasy.png",
        bio: "Mishary Rashid Alafasy ou Mishary ben Rashid Al-Afasy ou encore Mishary Rashid Ghareeb Mohammed Rashed Al-Afasy, alias Abou Nora est un imam et réciteur koweitien international du coran. Il est né le 5 septembre 1976 au Koweit (le 11 ramadan 1396 H).   Adolescent, Mishary Rashid Al-Afasy a étudié le coran dans le Collège Holy Coran et a fait des études islamiques à l'Université islamique de Médine (Arabie Saoudite).  Il a pu éblouir un grand nombre de grands savants après sa lecture du coran devant le cheikh Ahmed Abdulaziz Al-Zaiat, le cheikh Ibrahim Ali Shahata Al-Samanodei, et le cheikh Abdurarea Radwan.  Actuellement, Mishary Rashid Al-Afasy est l'imam de Masjid Al-Kabir (grande mosquée) à Koweit. Il dirige les prières de Tarawih chaque Ramadan dans cette mosquée.",
    },
    {
        name: "Mahmoud Khalil Al-Husary",
        filename: "Mahmoud_Khalil_Al_Husary.json",
        photo: "./assets/images/Mahmoud-Khalil-Al-Husary.png",
        bio: "Mahmoud Khalil AL Hussary est un grand réciteur égyptien du Coran, il est né le 17 septembre 1917 ( premier Zu AL Hijja 1335 de l'hégire) dans le village de Shubra Al-Namla à Tanta à la préfecture du Gharbia.   Avant la naissance du Sheikh AL Hussary, son père a quitté la préfecture du Fayoum vers le village de Shubra El Namla où Mahmoud Khalil Al Hussary a vu le jour. Son père l'a inscrit à l'école coranique à l'âge de 4 ans afin d'apprendre le Coran. A l'âge de 8 ans Cheikh Al Hussary a appris le Coran, puis a intégré l'Institut religieux de Tanta 4 ans plus tard.  Cheikh Mahmoud Khalil Al Husary a perfectionné la lecture du Coran dans les dix lectures après ses études à Al Azhar. Cheikh AL Hussary a commencé à réciter le Coran dans la mosquée de son village et en 1944 il a rejoint la radio égyptienne après avoir présenté une demande et passé un concours de lecture. Sa première récitation a été émise sur les ondes en direct le 16 novembre 1944. La radio égyptienne a gardé la diffusion exclusive de sa récitation du Coran durant 10 ans.  Il a été nommé cheikh du Maqra'a Sidi Abdul Muta'al à Tanta, puis il est devenu Muazin de la mosquée Sidi Hamza le 7 août 1948, avant de devenir le réciteur de la mosquée le 10 octobre de la même année.  Cheikh Mahmoud Khalil Al Hussary a été désigné par un arrêté ministériel comme superviseur des Maqari' de la préfecture de Gharbiya.",
    },
    {
        name: "Sa'ud ash-Shuraim",
        filename: "Saud_ash_Shuraim.json",
        photo: "./assets/images/Saud-ash-Shuraim.png",
        bio: "Saoud Shuraim est l'un des plus grands et célèbres récitateurs du saint coran, il est né en 1965 (1386 H) à Ryad (Arabie saoudite).   Diplomé de l'Université d'Al Imam Mohamed Ben Saoud (Riyad), Saoud Shuraim a décroché un diplôme dans Al Aqida wa Al Madahib Al Moassira en 1989 (1409 H) et a obtenu le diplôme du magistrat de l'institut supérieur de la magistrature en 1993 (1413 H).  Saoud Shuraim a appris la récitation du coran sous l'égide de grands enseignants comme : Abderrahmane El Berrak, Okail Ben Abdallah, Abdallah Al Jabrayn, Abdelaziz Errajhi, Cheikh Abdelaziz Ben Baz, Fahd Al Houmain, Saleh Ibn Fawzane…",
    },
    {
        name: "AbdulBaset AbdulSamad",
        filename: "AbdulBaset_AbdulSamad.json",
        photo: "./assets/images/Abdul-Basit-Abdus-Samad.png",
        bio: "Cheikh Abdelbasset bin Mohammed bin Salim bin Abdul Samad est un grand réciteur du Coran, il est né en 1927 dans le village de Alemraazza- Armant-Qena dans le sud de l'Egypte. Son père le Cheikh Mohammed Abdessamad fut un grand réciteur du coran dans son village.   Abdelbasset Abdessamad a appris le Coran à travers le Cheikh de l'école coranique du village, le Cheikh Mohammed El Amir et a étudié les lectures du Cheikh Mohammed Salim Hamadah. Il a accompli l'apprentissage du Coran à l'âge de 10 ans.  Cheikh Abdelbasset devint un grand réciteur dans le Sud de l'Egypte ( Assai'd), mais l'évènement qui bouscula sa vie fut sa visite en 1950 au mausolée du Sayida Zineb à l'occasion des festivités qui coïncidaient avec sa naissance et qui furent organisées par les grands cheikhs tels que Abdelfattah Che3cha3i, Moustafa Isma'il , Abdeladim Zaher, Abu L3inin Sh3esha3 et d'autres... Les organisateurs de ces festivités lui demandèrent alors de réciter quelques versets du Coran pendant une dizaine de minutes, le Cheikh lut Sourate Al Ahzab et attira l'attention du public qui demandait au cheikh de continuer sa récitation, une récitation qui a finalement duré une heure et demie.  En 1951, Cheikh Abdelbasset Abdessamad entre à la radio égyptienne, lors de sa première récitation il a lu Sourat Fatir. Une année plus tard il a été désigné comme réciteur de la mosquée Imam Shafe'i, puis de la mosquée Imam EL Hussein en 1985 succédant au Cheikh Mahmoud Ali El Banna.",
    },
    {
        name: "Abu Bakr al-Shatri",
        filename: "Abu_Bakr_al_Shatri.json",
        photo: "./assets/images/Abu-Bakr-al-Shatri.png",
        bio: "Abu Bakr Al Shatri de son nom complet Abu Bakr Ibn mohamed Al Shatriest est un réciteur et imam saoudien. Il est né en 1970 à Jedda.  Ayant grandi à Jedda, Abu Bakr Al Shatri a obtenu une licence dans le saint coran sous l'égide de cheikh 'Aymane Rochdi Suwaid' en 1416 H puis le master de comptabilité en 1420 H.   Abu Bakr Al Shatri a été l'imam de plusieurs mosquées, notamment : Al Rajihi, Said Ibn Jubair (à Kandara), abd Allatif Jamil, Attakwa (Al Rawda), AChouiâibi (Assalama). Actuellement, il est imam de la mosquée 'Al Furkane' à hay Ennassim (Jedda).",
    },
    {
        name: "Khalifah Al Tunaiji",
        filename: "Khalifah_Al_Tunaiji.json",
        photo: "./assets/images/Khalifa-al-Tunaiji.jpeg",
        bio: "Khalifah Al Tunaiji, originaire des Émirats arabes unis, est connu pour sa récitation captivante et son engagement dans l'enseignement du Coran. Il a inspiré de nombreux étudiants à travers ses programmes éducatifs et ses récitations.",
    },
    {
        name: "Hani ar-Rifai",
        filename: "Hani_ar_Rifai.json",
        photo: "./assets/images/Hani-ar-Rifai.png",
        bio: "Hani ar-Rifai, imam de la mosquée Anani à Jeddah, est célèbre pour ses récitations émouvantes et ses dou’as pleines de ferveur. Sa voix unique a touché le cœur de millions de fidèles à travers le monde.",
    },
    {
        name: "Mohamed Siddiq al-Minshawi",
        filename: "Mohamed_Siddiq_al_Minshawi.json",
        photo: "./assets/images/Mohamed-Siddiq-El-Minshawi.jpeg",
        bio: "Mohamed Seddik El Menchaoui est un imam né en 1920 dans le village Munsha'a à Sohage (Egypte). Il est l'un des meilleurs réciteurs égyptiens du coran.  Mohamed Seddik El Menchaoui est issu d'une ancienne famille de récitation de versets, son père est le Cheikh Seddik EL Menchaoui et son frère le cheikh Mahmoud El Menchaoui. A l'âge de huit ans, Mohamed Seddik El Menchaoui a terminé l'apprentissage du saint coran.  Connu pour la beauté de sa voix et sa bonne psalmodie, il a réalisé beaucoup d'enregistrements et de récitations du coran dans les mosquées Al Aqsa, le Koweït, la Syrie et la Libye.  De nombreuses stations de radio, chaines de télévision et sites internet diffusent sa récitation coranique.  Mohamed Seddik El Menchaoui a aussi participé à des récitations collectives enregistrées avec les deux recitateurs : Kamel Al Bahtimi et Fouad Al Aroussi.  Mohamed Seddik El Menchaoui s'est marié deux fois, il a eu quatre garçons et deux filles avec la première épouse en plus de cinq garçons et quatre filles avec la seconde femme. En 1968, sa deuxième épouse est morte en pèlerinage.  Mohamed Seddik El Menchaoui a toujours été une cible pour plusieurs ennemis qui ont tenté de le tuer en l'empoisonnant lors d'une soirée de récitation, mais Dieu l'a sauvé de leur complot.  Il est à mentionner qu'il a pu refuser de réciter le saint coran devant le président égyptien 'Abd Annasser'.  Mohamed Seddik El Menchaoui est décédé le vendredi 20 juin 1969 (5 Rabi'e II, 1389 H) suite à la maladie Dawali Al Mariê.",
    },
    {
        name: "Abdur-Rahman as-Sudais",
        filename: "Abdur_Rahman_as_Sudais.json",
        photo: "./assets/images/Abdur-Rahman_As-Sudais.png",
        bio: "Abdul Rahman Al Sudais est le premier imam de la Grande mosquée de la ville islamique, La Mecque. C'est un grand réciteur du saint coran de renommée internationale. D'origine du Clan Anza, Abdul Rahman Al Sudais est né en Arabie Saoudite. Abdul Rahman Al Sudais a pu mémoriser le coran alors qu'il n'avait que 12 ans. Il a décroché son diplôme en 1979 de l'institution scientifique 'Riyad' avec la mention 'Excellent'. En 1983, Abdul Rahman Al Sudais a entamé ses études à l'université où il a obtenu un diplôme de la charia et une maîtrise de la charia à l'université islamique de l'imam Muhammad ben Saud en 1987.",
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

function loadSheikhData(sheikh) {
    return fetch(`./js/sheikhs/${sheikh.filename}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Fichier non trouvé: ${sheikh.filename}`);
            }
            return response.json();
        })
        .catch(error => {
            console.error(`Erreur chargement ${sheikh.filename}:`, error);
            throw error;
        });
}

// Fonction pour jouer l'audio
function playAudio(audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play()
        .then(() => console.log('Lecture de l\'audio lancée!'))
        .catch(error => console.log('Erreur de lecture audio: ', error));
}

  
function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

function getCookie(name) {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
}

function updateSheikhHighlights() {
    const favSheikhs = getCookie('favSheikhs');
    const oKCookie = getCookie('oKCookie');
    const favList = favSheikhs ? JSON.parse(favSheikhs) : [];

    // 1. Mettre à jour le menu
    document.querySelectorAll('.menu-item').forEach(item => {
        const sheikhName = item.textContent;
        currentSheikh = sheikhs.find(s => s.name === sheikhName);
        item.classList.toggle('highlight', favList.includes(sheikhName));
    });

    if (!oKCookie) {
        showCookieAlert();
        return;
    }
}

function showCookieAlert() {
    if (document.getElementById('cookie-alert')) return; // éviter les doublons

    const alert = document.createElement('div');
    alert.id = 'cookie-alert';

    const menuL = document.querySelector('.menuL');
    alert.innerHTML = `
        <div style="margin-top: 1em; color: #dddd25; margin-bottom: 2em;">
            Do you know cookies are a thing?<br>
            <span id="ack-cookies" style="cursor: pointer;">[yes I'm aware]</span>
        </div>
    `;
    menuL.appendChild(alert);

    document.getElementById('ack-cookies').addEventListener('click', () => {
        setCookie('oKCookie', 'whatever');
        alert.remove();
    });
}

function showMobileCookieAlert(container) {
    if (document.getElementById('cookie-alert-mobile')) return;

    const alert = document.createElement('div');
    alert.id = 'cookie-alert-mobile';
    alert.style.marginBottom = '2em';
    alert.style.textAlign = 'center';
    alert.style.display = 'flex';
    alert.style.justifyContent = 'center';
    alert.style.alignItems = 'center';
    alert.style.width = '100%';

    alert.innerHTML = `
        <div style="color: #dddd25;">
            Do you know cookies are a thing?<br>
            <span id="ack-cookies-mobile" style="cursor: pointer;">[yes I'm aware]</span>
        </div>
    `;

    container.appendChild(alert);

    document.getElementById('ack-cookies-mobile').addEventListener('click', () => {
        setCookie('oKCookie', 'whatever');
        alert.remove();
    });
}

// === Fusion menuR/menuL pour tablette ===
function handleTabletMenus() {
    const menuL = document.querySelector('.menuL');
    const menuR = document.querySelector('.menuR');
    if (!menuL || !menuR) return;

    // Détecte la largeur tablette (ex: 768px à 1024px)
    const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024;
    
    // Crée un conteneur pour le menuR si il n'existe pas
    let menuRContainer = menuL.querySelector('.menuR-container');
    if (!menuRContainer && isTablet) {
        menuRContainer = document.createElement('div');
        menuRContainer.className = 'menuR-container';
        menuL.appendChild(menuRContainer);
    }

    if (isTablet) {
        // Déplace le contenu de menuR dans le conteneur
        while (menuR.firstChild) {
            menuRContainer.appendChild(menuR.firstChild);
        }
        menuR.style.display = 'none'; // Cache le menuR original
        
        // Ajoute des classes pour le style tablette
        menuL.classList.add('tablet-mode');
    } else {
        // Mode desktop - restaure le menuR
        if (menuRContainer) {
            while (menuRContainer.firstChild) {
                menuR.appendChild(menuRContainer.firstChild);
            }
            menuRContainer.remove();
            menuR.classList.remove('tablet-menuR');
        }
        menuR.style.display = 'block'; // Réaffiche le menuR
        menuL.classList.remove('tablet-mode');
    }
}

// Gestion des événements avec debounce pour performance
let resizeTimer;
function debouncedHandleTabletMenus() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(handleTabletMenus, 100);
}

window.addEventListener('resize', debouncedHandleTabletMenus);
window.addEventListener('DOMContentLoaded', handleTabletMenus);
document.addEventListener('astro:after-swap', handleTabletMenus);

// Fonction pour gérer les playlists
function togglePlaylistMode() {
    isPlaylistMode = !isPlaylistMode;
    
    // Afficher/cacher les boutons d'ajout aux playlists
    document.querySelectorAll('.sourate-item').forEach(item => {
        // Cherche le bouton d'ajout existant
        item.style.pointerEvents = isPlaylistMode ? 'none' : 'auto';
        let addBtn = item.querySelector('.add-to-playlist');
        if (isPlaylistMode && !addBtn) {
            // Crée le bouton rond avec un +
            addBtn = document.createElement('span');
            addBtn.className = 'add-to-playlist';

            addBtn.innerHTML = `
                <span style="
                    display: flex;
                    justify-content: center;
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    background: #2c3e50;
                    color: #fff;
                    font-weight: bold;
                    font-size: 23px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                    transition: background-color 0.3s, transform 0.2s;
                    z-index: 1000;
                    border: none;
                    cursor: pointer;
                    pointer-events: auto;
                ">+</span>
            `;
            addBtn.style.setProperty('justify-content', 'center');
            addBtn.style.setProperty('align-items', 'center');
            addBtn.style.setProperty('pointer-events', 'auto');
            addBtn.style.setProperty('width', '100px');
            addBtn.style.setProperty('height', '70px');
            addBtn.style.setProperty('background', 'transparent');
            addBtn.style.setProperty('top', '50%');
            addBtn.style.setProperty('right', '20px');
            addBtn.style.setProperty('transform', 'translateY(-50%)');
            addBtn.style.setProperty('display', 'flex');
            addBtn.style.setProperty('alignItems', 'center');
            addBtn.style.setProperty('justifyContent', 'center'); 
            addBtn.style.setProperty('zIndex', '2');
            addBtn.style.setProperty('position', 'absolute');
            addBtn.style.setProperty('opacity', '0');
            addBtn.style.setProperty('transition', 'opacity 0.2s');
            addBtn.style.setProperty('cursor', 'pointer');
            addBtn.style.setProperty('border', 'none');
            addBtn.style.setProperty('boxSizing', 'content-box');

            // Hover/active effect for the button
            addBtn.onmouseenter = () => {
                const inner = addBtn.firstElementChild;
                inner.style.backgroundColor = '#34495e';
                inner.style.transform = 'scale(1.1)';
            };
            addBtn.onmouseleave = () => {
                const inner = addBtn.firstElementChild;
                inner.style.backgroundColor = '#2c3e50';
                inner.style.transform = 'scale(1)';
            };
            addBtn.onmousedown = () => {
                const inner = addBtn.firstElementChild;
                inner.style.transform = 'scale(0.95)';
            };
            addBtn.onmouseup = () => {
                const inner = addBtn.firstElementChild;
                inner.style.transform = 'scale(1.1)';
            };

            // Empêche la lecture de la sourate au clic sur le bouton +
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sourateNumber = parseInt(item.querySelector('.sourate-number').textContent);
                addSourateToPlaylist(sourateNumber - 1);
            });

            // Ajoute le bouton à l'item
            item.style.position = 'relative';
            item.appendChild(addBtn);

            // Affiche le bouton uniquement au survol
            item.addEventListener('mouseenter', () => {
                addBtn.style.opacity = '1';
            });
            item.addEventListener('mouseleave', () => {
                addBtn.style.opacity = '0';
            });
        } else if (!isPlaylistMode && addBtn) {
            addBtn.remove();
        }
    });
    
    // Afficher/cacher l'interface de playlist
    const playlistInterface = document.getElementById('playlist-interface');
    if (playlistInterface) {
        playlistInterface.style.display = isPlaylistMode ? 'block' : 'none';
    } else if (isPlaylistMode) {
        createPlaylistInterface();
    }
    
    // Mettre à jour l'apparence du bouton playlist
    const playlistBtn = document.getElementById('playlist');
    if (isPlaylistMode) {
        playlistBtn.classList.add('active');
    } else {
        playlistBtn.classList.remove('active');
    }
}

function createPlaylistInterface() {
    // Trouver le bouton playlist pour positionner l'interface juste au-dessus
    const playlistBtn = document.getElementById('playlist');
    const container = document.createElement('div');
    container.id = 'playlist-interface';
    container.style.position = 'absolute';
    container.style.backgroundColor = '#222';
    container.style.padding = '20px';
    container.style.borderRadius = '10px';
    container.style.zIndex = '100000';
    container.style.width = '350px';
    container.style.height = '450px';
    container.style.overflow = 'auto';
    const btnRect = playlistBtn.getBoundingClientRect();
    container.style.bottom = `${window.innerHeight - btnRect.top + 20}px`;
    container.style.right = '20px';
    
    container.innerHTML = `
        <div style="display:flex;gap:10px;margin-bottom:20px;">
            <button id="tab-current-playlist" class="playlist-tab active" style="border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-weight:bold;">En cours</button>
            <button id="tab-create-playlist" class="playlist-tab" style="border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-weight:bold;">Créer</button>
            <button id="tab-my-playlists" class="playlist-tab" style="border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-weight:bold;">Mes playlists</button>
        </div>
        <div id="playlist-tabs-content" style="position:relative;height:400px;overflow:auto;overflow-x:hidden;">
            <div id="current-playing-playlist">
                <div id="current-playing-items" style="margin:0;height:360px;display:flex;flex-direction:column;align-items:stretch;overflow-y:auto;overflow-x:hidden;scroll-behavior:smooth;"></div>
            </div>
            <div id="create-playlist" style="display:none;height:100%;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                    <input id="playlist-name" type="text" placeholder="Nom de la playlist" style="flex:1;padding:6px 10px;border-radius:5px;border:1px solid #444;background:#222;color:#ffd600;font-size:1em;">
                    <button id="save-playlist" title="Enregistrer la playlist" style="background:none;border:none;cursor:pointer;padding:0;">
                        <span style="font-size:1.5em;color:#ffd600;vertical-align:middle;">&#128190;</span>
                    </button>
                </div>
                <button id="clear-playlist" style="background:transparent;color:#fff;cursor:pointer;border:transparent;font-size: 13px;">Effacer</button>
                <hr style="border:0;border-top:1px solid #444;margin:0px;margin-bottom:10px;">
                <div style="margin-bottom:15px;">
                    <div style="display:flex;gap:8px;align-items:center;">
                        <select id="start-surah" class="custom-select compact">
                            ${sourates.map(s => `<option value="${s.number-1}">${s.number}. ${s.name}</option>`).join('')}
                        </select>
                        <select id="end-surah" class="custom-select compact">
                            ${sourates.map(s => `<option value="${s.number-1}">${s.number}. ${s.name}</option>`).join('')}
                        </select>
                        <button id="add-range" class="custom-button compact">Ajouter</button>
                    </div>
                </div>
                <div id="playlist-items" style="margin:0;min-height:160px;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;text-align:center;width:100%;"></div>
            </div>
            <div id="saved-playlists" style="display:none;height:100%;">
                <h4>Playlists sauvegardées</h4>
                <div id="saved-playlists-list" style="height:calc(100% - 30px);overflow:auto;"></div>
            </div>
        </div>
        <button id="play-playlist" style="background:#55ff55;color:#222;border:none;padding:5px 10px;border-radius:15px;cursor:pointer;width: 20%;position:absolute;left:50%;transform:translateX(-50%);bottom:20px;z-index:100001;margin-top:40px;">
            <span style="font-size:1.5em;vertical-align:middle;">&#9654;</span>
        </button>
        <button id="close-playlist" style="position:absolute;top:10px;right:10px;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">×</button>
    `;

    // Ajouter le style pour les onglets
    const style = document.createElement('style');
    style.textContent = `
        .playlist-tab {
            background: #333;
            color: #ffd600;
            transition: all 0.2s ease;
        }
        .playlist-tab.active {
            background: #ffd600 !important;
            color: #222 !important;
        }
        .playlist-tab:hover:not(.active) {
            background: #444;
        }
    `;
    container.appendChild(style);

    document.body.appendChild(container);
    
    // Éléments DOM
    const tabCurrent = container.querySelector('#tab-current-playlist');
    const tabCreate = container.querySelector('#tab-create-playlist');
    const tabMy = container.querySelector('#tab-my-playlists');
    const currentPlayingDiv = container.querySelector('#current-playing-playlist');
    const createPlaylistDiv = container.querySelector('#create-playlist');
    const savedPlaylistsDiv = container.querySelector('#saved-playlists');

    // Fonction pour changer d'onglet
    function switchTab(activeTab) {
        // Désactiver tous les onglets
        [tabCurrent, tabCreate, tabMy].forEach(tab => tab.classList.remove('active'));
        [currentPlayingDiv, createPlaylistDiv, savedPlaylistsDiv].forEach(div => div.style.display = 'none');

        // Activer l'onglet sélectionné
        activeTab.classList.add('active');
        if (activeTab === tabCurrent) {
            currentPlayingDiv.style.display = '';
            updateCurrentPlayingUI();
        } else if (activeTab === tabCreate) {
            createPlaylistDiv.style.display = '';
        } else if (activeTab === tabMy) {
            savedPlaylistsDiv.style.display = '';
            loadSavedPlaylists();
        }
    }

    // Écouteurs d'événements
    tabCurrent.addEventListener('click', () => switchTab(tabCurrent));
    tabCreate.addEventListener('click', () => switchTab(tabCreate));
    tabMy.addEventListener('click', () => switchTab(tabMy));
    
    document.getElementById('close-playlist').addEventListener('click', togglePlaylistMode);
    document.getElementById('save-playlist').addEventListener('click', saveCurrentPlaylist);
    document.getElementById('clear-playlist').addEventListener('click', clearCurrentPlaylist);
    document.getElementById('play-playlist').addEventListener('click', playCurrentPlaylist);
    document.getElementById('add-range').addEventListener('click', addSurahRangeToPlaylist);

    // Activer l'onglet "En cours" par défaut
    switchTab(tabCurrent);
    updatePlaylistUI();
}

function updatePlaylistUI() {
    const playlistItems = document.getElementById('playlist-items');
    if (!playlistItems) return;
    
    playlistItems.innerHTML = '';
    
    if (draftPlaylist.length === 0) {
        playlistItems.innerHTML = '<p>Aucune sourate dans la playlist</p>';
        return;
    }
    
    draftPlaylist.forEach((sourateIndex, index) => {
        const sourate = sourates[sourateIndex];
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.margin = '5px 0';
        item.style.padding = '5px';
        item.style.backgroundColor = '#333';
        item.style.borderRadius = '5px';
        
        item.innerHTML = `
            <span>${sourate.number}. ${sourate.name} (${sourate.arabicname})</span>
            <span class="remove-from-playlist" data-index="${index}" style="cursor:pointer;color:#ff5555;">[×]</span>
        `;
        
        playlistItems.appendChild(item);
    });
    
    document.querySelectorAll('.remove-from-playlist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            draftPlaylist.splice(index, 1);
            updatePlaylistUI();
        });
    });
}


function updateCurrentPlayingUI() {
    const playlistItems = document.getElementById('current-playing-items');
    if (!playlistItems) return;
    
    // Sauvegarder la position de scroll
    const scrollTop = playlistItems.scrollTop;
    
    playlistItems.innerHTML = '';
    
    if (currentPlaylist.length === 0) {
        playlistItems.innerHTML = '<p>Aucune sourate dans la playlist en cours</p>';
        return;
    }
    
    // Créer le style pour le drag-and-drop (une seule fois)
    if (!document.getElementById('playlist-dnd-style')) {
        const style = document.createElement('style');
        style.id = 'playlist-dnd-style';
        style.textContent = `
            #current-playing-items .dragging {
                opacity: 0.5;
                background: transparent !important;
            }
            
            #current-playing-items .dragging * {
                opacity: 0;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Créer les éléments de playlist
    currentPlaylist.forEach((sourateIndex, index) => {
        const sourate = sourates[sourateIndex];
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.dataset.index = index;
        item.dataset.sourateId = sourateIndex;
        item.draggable = true;
        
        // Appliquer le style textuel existant
        Object.assign(item.style, {
            display: 'flex',
            justifyContent: 'space-between',
            margin: '5px 0',
            padding: '12px',
            backgroundColor: index === currentPlaylistIndex ? '#444' : '#333',
            borderRadius: '5px',
            transition: 'all 0.2s ease',
            cursor: 'grab',
            userSelect: 'none'
        });
        
        item.innerHTML = `
            <span>${sourate.number}. ${sourate.name} (${sourate.arabicname})</span>
            <div>
                ${index === currentPlaylistIndex ? '<span style="color:#ffd600;">[en cours]</span>' : ''}
                <span class="remove-from-current-playlist" data-index="${index}" style="cursor:pointer;color:#ff5555;margin-left:10px;">[×]</span>
            </div>
        `;
        
        playlistItems.appendChild(item);
    });
    
    // Drag & drop implementation
    let draggingItem = null;
    
    playlistItems.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('dragstart', () => {
            draggingItem = item;
            setTimeout(() => item.classList.add('dragging'), 0);
        });
        
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggingItem = null;
            updatePlaylistOrderFromDOM();
        });
    });
    
    playlistItems.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!draggingItem) return;
        
        // Défilement automatique
        autoScrollDuringDrag(playlistItems, e);
        
        // Gestion du positionnement
        const afterElement = getDragAfterElement(playlistItems, e.clientY);
        if (afterElement) {
            playlistItems.insertBefore(draggingItem, afterElement);
        } else {
            playlistItems.appendChild(draggingItem);
        }
        
        // Optimisation des performances
        e.dataTransfer.dropEffect = "move";
    });
    
    // Gestion des boutons de suppression
    document.querySelectorAll('.remove-from-current-playlist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(e.target.getAttribute('data-index'));
            currentPlaylist.splice(index, 1);
            
            // Ajuster l'index courant si nécessaire
            if (currentPlaylistIndex > index) {
                currentPlaylistIndex--;
            } else if (currentPlaylistIndex === index) {
                currentPlaylistIndex = 0;
            }
            
            updateCurrentPlayingUI();
        });
    });
    
    // Restaurer la position de scroll
    playlistItems.scrollTop = scrollTop;
    
    // Helper functions
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.playlist-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    function updatePlaylistOrderFromDOM() {
        const items = [...playlistItems.querySelectorAll('.playlist-item')];
        const newOrder = items.map(item => parseInt(item.dataset.sourateId));
        
        // Trouver le nouvel index courant
        const currentItem = items.find(item => 
            item.querySelector('[style*="color:#ffd600"]')
        );
        const newCurrentIndex = currentItem ? items.indexOf(currentItem) : currentPlaylistIndex;
        
        // Mettre à jour les données
        currentPlaylist = newOrder;
        currentPlaylistIndex = newCurrentIndex;
        
        // Rafraîchir sans animation pour éviter le clignotement
        const newScroll = playlistItems.scrollTop;
        updateCurrentPlayingUI();
        playlistItems.scrollTop = newScroll;
    }
}

function autoScrollDuringDrag(container, event) {
    // Configuration de base
    const baseScrollSpeed = 5; // Vitesse de base
    const scrollThreshold = 50; // Zone d'activation (en pixels)
    const maxScrollSpeed = 50; // Vitesse maximale
    const accelerationZone = 150; // Zone d'accélération (au-delà du threshold)
    
    const rect = container.getBoundingClientRect();
    const mouseY = event.clientY;
    const containerTop = rect.top;
    const containerBottom = rect.bottom;
    
    // Calcul de la distance au-delà des seuils
    let distanceBeyondThreshold = 0;
    let scrollDirection = 0; // 0 = pas de scroll, -1 = up, 1 = down
    
    // Vérifier si on est dans la zone haute
    if (mouseY < containerTop + scrollThreshold) {
        distanceBeyondThreshold = Math.max(0, (containerTop + scrollThreshold) - mouseY);
        scrollDirection = -1; // Scroll up
    } 
    // Vérifier si on est dans la zone basse
    else if (mouseY > containerBottom - scrollThreshold) {
        distanceBeyondThreshold = Math.max(0, mouseY - (containerBottom - scrollThreshold));
        scrollDirection = 1; // Scroll down
    }
    
    // Retirer les classes de feedback visuel
    container.classList.remove('scrolling-up', 'scrolling-down');
    
    // Si on doit scroller
    if (scrollDirection !== 0) {
        // Calcul de la vitesse avec accélération progressive
        let speed = baseScrollSpeed;
        
        if (distanceBeyondThreshold > 0) {
            // Accélération proportionnelle à la distance, limitée à maxScrollSpeed
            const accelerationFactor = Math.min(distanceBeyondThreshold / accelerationZone, 1);
            speed += (maxScrollSpeed - baseScrollSpeed) * accelerationFactor;
        }
        
        // Appliquer le scroll
        container.scrollTop += speed * scrollDirection;
        
        // Feedback visuel
        container.classList.add(scrollDirection === -1 ? 'scrolling-up' : 'scrolling-down');
        
        // Planifier le prochain frame de scroll pour fluidité
        requestAnimationFrame(() => {
            // On rappelle la fonction avec le même event pour continuer le scroll
            // On vérifie d'abord si le drag est toujours en cours
            if (document.querySelector('.dragging')) {
                autoScrollDuringDrag(container, event);
            }
        });
    }
    
    // Optimisation des performances
    container.style.willChange = 'scroll-position';
}

function addSourateToPlaylist(sourateIndex) {
    if (!draftPlaylist.includes(sourateIndex)) {
        draftPlaylist.push(sourateIndex);
        updatePlaylistUI();
    }
}

function addSurahRangeToPlaylist() {
    const startIndex = parseInt(document.getElementById('start-surah').value);
    const endIndex = parseInt(document.getElementById('end-surah').value);
    
    // Ajouter à draftPlaylist au lieu de currentPlaylist
    const step = startIndex <= endIndex ? 1 : -1;
    
    for (let i = startIndex; i !== endIndex + step; i += step) {
        if (!draftPlaylist.includes(i)) {
            draftPlaylist.push(i);
        }
    }
    
    updatePlaylistUI();
}

function saveCurrentPlaylist() {
    if (draftPlaylist.length === 0) {  // Utiliser draftPlaylist au lieu de currentPlaylist
        showPlaylistError("La playlist est vide !");
        return;
    }
    
    let playlistName = document.getElementById('playlist-name').value.trim();
    if (!playlistName) {
        playlistName = `SansNom_${Date.now().toString().slice(-4)}`;
    }
    
    const savedPlaylists = JSON.parse(getCookie('savedPlaylists') || {});
    savedPlaylists[playlistName] = [...draftPlaylist];  // Sauvegarder la copie de draft
    setCookie('savedPlaylists', JSON.stringify(savedPlaylists));
    
    // Feedback visuel
    const saveBtn = document.getElementById('save-playlist');
    saveBtn.innerHTML = '✓';
    setTimeout(() => saveBtn.innerHTML = '💾', 1000);
    
    loadSavedPlaylists();
}

function loadSavedPlaylists() {
    const savedPlaylistsList = document.getElementById('saved-playlists-list');
    if (!savedPlaylistsList) return;
    
    savedPlaylistsList.innerHTML = '';
    
    const savedPlaylists = getCookie('savedPlaylists');
    if (!savedPlaylists) {
        savedPlaylistsList.innerHTML = '<p>Aucune playlist sauvegardée</p>';
        return;
    }
    
    const playlists = JSON.parse(savedPlaylists);
    
    Object.entries(playlists).forEach(([name, playlist]) => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.margin = '5px 0';
        item.style.padding = '5px';
        item.style.backgroundColor = '#333';
        item.style.borderRadius = '5px';
        
        item.innerHTML = `
            <span>${name}</span>
            <div>
                <span class="load-playlist" data-name="${name}" style="cursor:pointer;color:#55ff55;margin-right:10px;">[charger]</span>
                <span class="delete-playlist" data-name="${name}" style="cursor:pointer;color:#ff5555;">[suppr]</span>
            </div>
        `;
        
        savedPlaylistsList.appendChild(item);
    });
    
    document.querySelectorAll('.load-playlist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.getAttribute('data-name');
            loadPlaylist(name);
        });
    });
    
    document.querySelectorAll('.delete-playlist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.getAttribute('data-name');
            deletePlaylist(name);
        });
    });
}

function loadPlaylist(name) {
    const savedPlaylists = getCookie('savedPlaylists');
    if (!savedPlaylists) return;
    
    const playlists = JSON.parse(savedPlaylists);
    if (playlists[name]) {
        currentPlaylist = playlists[name];
        updatePlaylistUI();

        // Revenir à l'onglet "Créer une playlist"
        const tabCreate = document.getElementById('tab-create-playlist');
        const tabMy = document.getElementById('tab-my-playlists');
        const currentPlaylistDiv = document.getElementById('current-playlist');
        const savedPlaylistsDiv = document.getElementById('saved-playlists');
        if (tabCreate && tabMy && currentPlaylistDiv && savedPlaylistsDiv) {
            tabCreate.classList.add('active');
            tabMy.classList.remove('active');
            currentPlaylistDiv.style.display = '';
            savedPlaylistsDiv.style.display = 'none';
        }
    }
}

function deletePlaylist(name) {
    const savedPlaylists = getCookie('savedPlaylists');
    if (!savedPlaylists) return;
    
    const playlists = JSON.parse(savedPlaylists);
    delete playlists[name];
    
    setCookie('savedPlaylists', JSON.stringify(playlists));
    loadSavedPlaylists();
}

function clearCurrentPlaylist() {
    currentPlaylist = [];
    updatePlaylistUI();
}

async function playCurrentPlaylist() {
    // Déterminer quelle playlist utiliser
    const activeTab = document.querySelector('.playlist-tab.active').id;
    
    // Si on est dans l'onglet "Créer", utiliser draftPlaylist
    if (activeTab === 'tab-create-playlist') {
        if (draftPlaylist.length === 0) {
            showPlaylistError("La playlist est vide !");
            return;
        }
        currentPlaylist = [...draftPlaylist]; // Copie la draft
    } 
    // Sinon utiliser currentPlaylist (pour l'onglet "En cours")
    else if (currentPlaylist.length === 0) {
        showPlaylistError("Aucune sourate dans la playlist en cours");
        return;
    }

    // Fermer l'interface playlist
    isInitialLoad = false;
    enableControls();
    togglePlaylistMode();
    updateCurrentPlayingUI();
    
    // Réinitialiser l'index
    currentPlaylistIndex = 0;
    
    // Arrêter toute lecture en cours
    if (currentAudio) {
        currentAudio.pause();
        clearInterval(updateInterval);
        clearInterval(currentHighlightInterval);
    }
    
    if (playlistAudio) {
        playlistAudio.pause();
    }
    
    // Créer un nouvel objet Audio pour la playlist
    playlistAudio = new Audio();
    playlistAudio.volume = currentVolume;
    playlistAudio.loop = isLoopEnabled;
    
    isPlaying = true;
    ['play-pause', 'play-pause-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '[stop]';
    });
    
    playNextInPlaylist();
}

// Fonction helper pour les messages d'erreur
function showPlaylistError(message) {
    let errorMsg = document.getElementById('playlist-empty-msg');
    if (errorMsg) errorMsg.remove();
    
    errorMsg = document.createElement('div');
    errorMsg.id = 'playlist-empty-msg';
    errorMsg.textContent = message;
    errorMsg.style.cssText = `
        text-align: center;
        font-weight: bold;
        margin-bottom: 10px;
        color: #ff2222;
        opacity: 1;
        transition: opacity 0.2s ease-in-out;
        position: absolute;
        width: calc(100% - 40px);
        bottom: 60px;
        left: 20px;
    `;
    
    const playBtn = document.getElementById('play-playlist');
    if (playBtn?.parentNode) {
        playBtn.parentNode.insertBefore(errorMsg, playBtn);
    }
    
    // Animation clignotante
    let flashCount = 0;
    const flashInterval = setInterval(() => {
        errorMsg.style.opacity = errorMsg.style.opacity === '1' ? '0.3' : '1';
        if (++flashCount >= 6) {
            clearInterval(flashInterval);
            setTimeout(() => errorMsg.remove(), 200);
        }
    }, 200);
}

async function playNextInPlaylist() {
    if (currentPlaylistIndex >= currentPlaylist.length) {
        // Fin de la playlist
        isPlaying = false;
        ['play-pause', 'play-pause-mobile'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '[play]';
        });
        clearInterval(updateInterval);
        return;
    }
    
    const sourateIndex = currentPlaylist[currentPlaylistIndex];
    const sourate = sourates[sourateIndex];
    currentSourateIndex = sourateIndex;
    
    // Mettre à jour l'interface
    ['play-pause', 'play-pause-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '[stop]';
    });
    updateSourateName(sourate);
    updateNavigationButtons();

    // Ajout : mise à jour de la playlist en cours si l'onglet est affiché
    const currentPlayingDiv = document.getElementById('current-playing-playlist');
    if (currentPlayingDiv && currentPlayingDiv.style.display !== 'none') {
        updateCurrentPlayingUI();
    }
    
    // Charger les données du sheikh
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    const sheikh = isMobile ? 
        sheikhs.find(s => s.name === document.querySelector('.sheikh-name-mobile').textContent) : 
        sheikhs.find(s => s.name === document.querySelector('.sheikh-name').textContent);
    
    currentSurahName = `${sourate.number}. ${sourate.name} (${sourate.arabicname})`;
    currentSheikhName = currentSheikh.name;
    
    setupMediaSession();
    updatePlayPauseUI(true);
    
    try {
        const sheikhData = await loadSheikhData(sheikh);
        if (sheikhData && sheikhData[sourate.number]) {
            const surahData = sheikhData[sourate.number];
            const audioUrl = surahData["audio_files"][0]["audio_url"];

            // Initialiser les timings des versets
            currentVerseTimings = surahData["audio_files"][0]["verse_timings"] || [];

            document.querySelectorAll('.details')[0].textContent = formatDuration(surahData["audio_files"][0]["duration"]);
            document.querySelectorAll('.details')[1].textContent = formatSize(surahData["audio_files"][0]["file_size"]);
            document.querySelector('.source').onclick = () => window.open(audioUrl);

            // Configurer l'audio
            playlistAudio.src = audioUrl;
            playlistAudio.loop = isLoopEnabled; 
            playlistAudio.currentTime = 0;
            
            // Démarrer la lecture
            await playlistAudio.play();
            startHighlightInterval();
            
            // Mettre à jour le temps
            updateInterval = setInterval(updateCurrentTime, 1000);
            
            // Gestionnaire de fin de lecture
            playlistAudio.onended = () => {
                clearInterval(updateInterval);
                stopHighlightInterval();
                currentPlaylistIndex++;
                playNextInPlaylist();
            };
            
            // Charger le texte de la sourate si l'interface est ouverte
            if (
                (isMobile && document.getElementById('sourate-container-mobile')?.style.opacity === '1') ||
                (!isMobile && document.querySelector('.sourate-container')?.style.opacity === '1')
            ) {
                loadSurahText(sourateIndex);
            }
        }
    } catch (error) {
        console.error('Erreur de lecture:', error);
    }
}

function clearCurrentPlaylist() {
    // Efface uniquement la playlist en cours de création
    draftPlaylist = [];
    updatePlaylistUI();
}

function updatePlayPauseUI(isPlaying) {
    // Mise à jour des boutons desktop et mobile
    ['play-pause', 'play-pause-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = isPlaying ? '[stop]' : '[play]';
            el.classList.toggle('playing', isPlaying);
            el.classList.toggle('paused', !isPlaying);
        }
    });
}

// Écouteurs pour la synchronisation
playlistAudio.addEventListener('play', () => {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
    }
    updatePlayPauseUI(true);
});

playlistAudio.addEventListener('pause', () => {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
    }
    updatePlayPauseUI(false);
});

playlistAudio.addEventListener('ended', () => {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';

        // Redéfinir les métadonnées pour maintenir la Media Session affichée
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentSurahName,
            artist: currentSheikhName,
            artwork: [
                { src: currentSheikh.photo, sizes: '96x96', type: 'image/png' },
                { src: currentSheikh.photo, sizes: '128x128', type: 'image/png' },
                { src: currentSheikh.photo, sizes: '192x192', type: 'image/png' },
                { src: currentSheikh.photo, sizes: '256x256', type: 'image/png' },
                { src: currentSheikh.photo, sizes: '384x384', type: 'image/png' },
                { src: currentSheikh.photo, sizes: '512x512', type: 'image/png' }
            ]
        });

        // Réaffecter toutes les actions Media Session à chaque fin de lecture
        navigator.mediaSession.setActionHandler('play', () => {
            playlistAudio.play();
            updatePlayPauseUI(true);
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            playlistAudio.pause();
            updatePlayPauseUI(false);
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            playPrevSourate();
        });
        
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            playNextSourate();
        });
    }
});

// Gestion du retour à l'application
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        updatePlayPauseUI(!playlistAudio.paused);
    }
});

function setupMediaSession() {
    if ('mediaSession' in navigator) {
        // 1. Mise à jour des métadonnées avec plus de détails
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentSurahName,
            artist: currentSheikhName,
            artwork: [
                { src: currentSheikh.photo, sizes: '96x96', type: 'image/png' },
                { src: currentSheikh.photo, sizes: '128x128', type: 'image/png' },
                { src: currentSheikh.photo, sizes: '192x192', type: 'image/png' },
                { src: currentSheikh.photo, sizes: '256x256', type: 'image/png' },
                { src: currentSheikh.photo, sizes: '384x384', type: 'image/png' },
                { src: currentSheikh.photo, sizes: '512x512', type: 'image/png' }
            ]
        });

        // 2. Configuration des actions (inchangé)
        navigator.mediaSession.setActionHandler('play', () => {
            playlistAudio.play();
            updatePlayPauseUI(true);
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            playlistAudio.pause();
            updatePlayPauseUI(false);
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            playPrevSourate();
        });
        
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            playNextSourate();
        });

    }
}