// Variables globales
let isFirstPlay = true;
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
let isLoadingSourate = false;
let isPlayAll = false;
let isLearning = false;
let carouselInitialized = false;
const statsCache = {};

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
        target: ".circular-btn",
        message: "Cliquez ici pour afficher ou masquer le texte de la sourate.",
        placement: "top"
    },
    {
        target: ".media-info",
        message: 'Ici, vous pouvez :<ul><li>Activer le mode "All" pour écouter toutes les sourates à la suite</li><li>Activer "Learning Path" pour réviser dans l\'ordre inverse</li></ul>Ajouter un réciteur à vos favoris ! ⭐',
        placement: "right"
    },
    {
        target: null,
        message: "Barak-Allahu fikum !<br>Qu'Allah facilite votre chemin vers la connaissance du Coran.",
        placement: "center"
    }
];

function startTutorial() {
    tutorialStep = 0;

    // Sauvegarder et modifier l'affichage du bouton
    const circularBtn = document.querySelector('.circular-btn');
    if (circularBtn) {
        originalCircularBtnDisplay = circularBtn.style.display; // Sauvegarder l'état original
        circularBtn.style.display = 'flex';
    }

    showTutorialStep();
    setCookie('tuto', 'done', 365);
}


function showTutorialStep() {
    removeTutorialOverlay();

    if (tutorialStep < tutorialConfig.length) {
        const step = tutorialConfig[tutorialStep];

        // Si le step est .menuR-container mais qu'il n'existe pas, passer au suivant (#menuR)
        if (step.target === '.menuR-container' && !document.querySelector('.menuR-container')) {
            tutorialStep++;
            showTutorialStep();
            return;
        }
        // Si le step est #menuR mais que .menuR-container existe déjà, sauter ce step
        if (step.target === '#menuR' && document.querySelector('.menuR-container')) {
            tutorialStep++;
            showTutorialStep();
            return;
        }
    }

    if (tutorialStep >= tutorialConfig.length) {
        // Restaurer l'affichage original du bouton
        const circularBtn = document.querySelector('.circular-btn');
        if (circularBtn && originalCircularBtnDisplay !== null) {
            circularBtn.style.display = originalCircularBtnDisplay;
        } else if (circularBtn) {
            circularBtn.style.display = 'none'; // Fallback si l'état original n'est pas disponible
        }

        removeTutorialOverlay();
        return;
    }

    const step = tutorialConfig[tutorialStep];
    const targetEl = step.target ? document.querySelector(step.target) : null;

    if (step.target && !targetEl) {
        tutorialStep++;
        showTutorialStep();
        return;
    }

    createTutorialOverlay(step, targetEl);
}

function createTutorialOverlay(step, targetEl) {
    // Créer l'overlay
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

    // Calculer la position du trou avec une valeur par défaut pour rx
    const hole = calculateHolePosition(targetEl);
    
    // Ajouter le masque SVG
    tutorialOverlay.innerHTML = createSvgMask(hole);
    
    // Créer et positionner le message
    const msgBox = createMessageBox(step, hole);
    tutorialOverlay.appendChild(msgBox);

    // Gestion des événements
    setupEventListeners();

    document.body.appendChild(tutorialOverlay);
}

function calculateHolePosition(targetEl) {
    const padding = 12;
    const borderRadius = 12; // Valeur fixe pour rx
    
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
    // Empêcher les clics sur l'overlay de se propager
    tutorialOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Gestion du bouton Suivant
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
        // Vérifier si l'élément est déjà visible
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

        // Ajouter un léger décalage pour la position (60px pour laisser de la marge)
        const offset = 60;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        // Faire le scroll en douceur
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });

        // Attendre que le scroll soit terminé
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

    // Prend la vraie hauteur de la boîte, ou une valeur de secours
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

    // Empêche le débordement horizontal
    left = Math.max(minMargin, Math.min(left || 0, window.innerWidth - maxBoxWidth - minMargin));
    right = Math.max(minMargin, window.innerWidth - (left + maxBoxWidth));

    // Empêche le débordement haut
    if (placement === 'top') {
        top = Math.min(top, hole.y - msgBoxHeight - spacing);
    }

    // Clamp final du top
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
    const textNodes = getTextNodes(element); // Récupère tous les nœuds texte dans l'élément
    const lengths = textNodes.map(node => node.nodeValue.length);
    const originalText = textNodes.map(node => node.nodeValue).join("");
    const placeholder = originalText.split(" ").map(word => {
        let placeholder = "";
        for (let i = 0; i < word.length; i++) placeholder += " "; // Espaces insécables
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
        progress = -(Math.cos(Math.PI * progress) - 1) / 2; // Courbe de progression
        progress = Math.pow(progress, 2); // Accélération
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

// Fonction pour mettre à jour le nom de la sourate
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

// Fonction pour mettre à jour le temps
function updateCurrentTime() {
    if (currentAudio) {
        const currentTimeMs = currentAudio.currentTime * 1000;
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

// Fonction pour charger et jouer une sourate
function loadAndPlaySourate(sheikh, sourateIndex) {

    if (isFirstPlay && sourateIndex !== 0) {
        isFirstPlay = false;
        isPlayAll = false;
    }

    if (isLoadingSourate) return;
    isLoadingSourate = true;

    const sourate = sourates[sourateIndex];
    currentSourateIndex = sourateIndex;
    updateNavigationButtons();
    currentSurahText = null;
    
    // Arrêter tout surlignage en cours
    if (currentHighlightInterval) {
        clearInterval(currentHighlightInterval);
        currentHighlightInterval = null;
    }

    // Charger le fichier JSON spécifique au sheikh
    loadSheikhData(sheikh)
        .then(sheikhData => {
            if (sheikhData && sheikhData[sourate.number]) {
                if (currentAudio) {
                    currentAudio.pause();
                    clearInterval(updateInterval);
                }

                const surahData = sheikhData[sourate.number];
                const audioUrl = surahData["audio_files"][0]["audio_url"];
                currentSourateAudioUrl = audioUrl; // Stocker l'URL courante
                
                currentAudio = new Audio(audioUrl);
                currentAudio.onplay = () => {
                    if (!controlsInitialized) {
                        enableControls();
                    }
                };
                currentAudio.volume = currentVolume;
                currentAudio.loop = isLoopEnabled;
                currentVerseTimings = surahData["audio_files"][0]["verse_timings"];

                // Mise à jour UI
                updateSourateName(sourate);
                document.querySelector('.circular-btn').style.display = 'flex';
                document.querySelector('.circular-btn').style.opacity = '1';
                document.querySelectorAll('.details')[0].textContent = formatDuration(surahData["audio_files"][0]["duration"]);
                document.querySelector('.source').onclick = () => window.open(audioUrl);
                document.querySelectorAll('.details')[1].textContent = formatSize(surahData["audio_files"][0]["file_size"]);
                
                // Gestionnaire pour le début de lecture
                const onAudioStarted = () => {
                    // Vérifier qu'on a bien le bon audio (au cas où l'utilisateur change rapidement)
                    if (currentAudio && currentAudio.src === currentSourateAudioUrl) {
                        isPlaying = true;
                        ['play-pause', 'play-pause-mobile'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.textContent = '[stop]';
                        });
                        
                        // Démarrer la mise à jour du temps
                        updateInterval = setInterval(updateCurrentTime, 1000);
                        
                        // Démarrer le surlignage SEULEMENT maintenant
                        currentHighlightInterval = setInterval(() => {
                            highlightCurrentVerse();
                        }, 200);
                    }
                };

                // Gestionnaire pour la fin de lecture
                currentAudio.onended = () => {
                    clearInterval(updateInterval);
                    clearInterval(currentHighlightInterval);
                    updateNavigationButtons();

                    if (isLoopEnabled) {
                        currentAudio.currentTime = 0;
                        currentAudio.play();
                        return;
                    }

                    const isMobile = window.matchMedia('(max-width: 600px)').matches;
                    const container = isMobile
                        ? document.getElementById('sourate-container-mobile')
                        : document.querySelector('.sourate-container');
                    const sheikh = isMobile ? sheikhs.find(s => s.name === document.querySelector('.sheikh-name-mobile').textContent) : sheikhs.find(s => s.name === document.querySelector('.sheikh-name').textContent);

                    if (isPlayAll && currentSourateIndex < sourates.length - 1) {
                        if (container.style.opacity === '1') {
                            container.style.transition = 'opacity 0.3s ease';
                            container.style.opacity = '0';
                            setTimeout(() => {
                                loadAndPlaySourate(sheikh, currentSourateIndex + 1);
                                loadSurahText(currentSourateIndex).then(() => {
                                    container.style.opacity = '1';
                                });
                            }, 300);
                        } else {
                            loadAndPlaySourate(sheikh, currentSourateIndex + 1);
                        }
                    } else if (isLearning && currentSourateIndex > 0) {
                        if (container.style.opacity === '1') {
                            container.style.transition = 'opacity 0.3s ease';
                            container.style.opacity = '0';
                            setTimeout(() => {
                                loadAndPlaySourate(sheikh, currentSourateIndex - 1);
                                loadSurahText(currentSourateIndex - 1).then(() => {
                                    container.style.opacity = '1';
                                });
                            }, 300);
                        } else {
                            loadAndPlaySourate(sheikh, currentSourateIndex - 1);
                        }
                    } else {
                        isPlayAll = false;
                        isPlaying = false;
                        isFirstPlay = false;
                        isPlayAll = false;
                        ['play-pause', 'play-pause-mobile'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.textContent = '[play]';
                        });
                    }
                };

                // Démarrer la lecture
                currentAudio.play()
                .then(() => {
                    onAudioStarted();
                    isLoadingSourate = false;
                })
                .catch(error => {
                    console.error('Erreur de lecture:', error);
                    isLoadingSourate = false;
                });
            }
        })
        .catch(error => console.error('Erreur lors du chargement du fichier JSON:', error));
}


function highlightCurrentVerse() {
    if (!currentAudio || !currentVerseTimings || currentAudio.paused || currentAudio.src !== currentSourateAudioUrl) {
        return;
    }

    const currentTime = currentAudio.currentTime * 1000; // en millisecondes
    const verseTexts = document.querySelectorAll('.verse-text');

    // Réinitialiser tout surlignage
    verseTexts.forEach(v => {
        v.innerHTML = v.textContent; // Supprime les balises <span>
        v.style.backgroundColor = '';
    });

    for (let i = 0; i < currentVerseTimings.length; i++) {
        const verseTiming = currentVerseTimings[i];

        if (currentTime >= verseTiming.timestamp_from && currentTime <= verseTiming.timestamp_to) {
            const verseNumber = parseInt(verseTiming.verse_key.split(':')[1]);
            const verseElement = document.querySelector(`.verse[data-verse="${verseNumber}"] .verse-text`);

            if (!verseElement || !verseTiming.segments) return;

            const verseText = verseElement.textContent;
            const words = verseText.trim().match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+(?:\s*[ۛۖۚۗۙۘۜ۝۞])*/g); // séparation des mots
            let highlightedHtml = '';
            let segmentHighlighted = false;
            // Défilement automatique
            const container = document.querySelector('.surah-text-container');
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const verseRect = verseElement.getBoundingClientRect();
                const buffer = 300; // Marge en pixels

                let scrollOffset = 0;

                if (verseRect.bottom > containerRect.bottom - buffer) {
                    scrollOffset = verseRect.bottom - containerRect.bottom + buffer;
                }

                if (scrollOffset !== 0) {
                    container.scrollTo({
                        top: container.scrollTop + scrollOffset,
                        behavior: 'smooth'
                    });
                }
            }


            for (let j = 0; j < verseTiming.segments.length; j++) {
                const segment = verseTiming.segments[j];
                if (segment.length < 3) continue;

                const [segmentIndex, from, to] = segment;
                if (currentTime >= from && currentTime <= to) {
                    const wordStart = segmentIndex - 1;
                    const wordEnd = wordStart; // ou autre logique si plusieurs mots

                    words.forEach((word, index) => {
                        if (index === wordStart) {
                            highlightedHtml += `<span style="background-color: rgba(200,200,200,0.3);">`;
                        }

                        highlightedHtml += word;

                        if (index === wordEnd) {
                            highlightedHtml += `</span>`;
                        }

                        if (index < words.length - 1) highlightedHtml += ' ';
                    });

                    verseElement.innerHTML = highlightedHtml;
                    segmentHighlighted = true;
                    break;
                }
            }

            if (!segmentHighlighted) {
                verseElement.innerHTML = words.join(' '); // pas de surlignage actif
            }

            return;
        }
    }
}



// Fonctions pour jouer suivant/précédent (version optimisée)
function playNextSourate() {
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    const container = isMobile
        ? document.getElementById('sourate-container-mobile')
        : document.querySelector('.sourate-container');
    const sheikh = isMobile ? sheikhs.find(s => s.name === document.querySelector('.sheikh-name-mobile').textContent) : sheikhs.find(s => s.name === document.querySelector('.sheikh-name').textContent);
    
    if (container.style.opacity === '1') {
        if (currentSourateIndex < sourates.length - 1) {
            // Transition visuelle
            container.style.transition = 'opacity 0.3s ease';
            container.style.opacity = '0';
            
            setTimeout(() => {
                loadAndPlaySourate(sheikh, currentSourateIndex + 1);
                loadSurahText(currentSourateIndex).then(() => {
                    container.style.opacity = '1';
                });
            }, 300);
        } else {
            updateNavigationButtons();
            return;
        }
    } else if (currentAudio) {
        // Mode audio seul
        currentAudio.pause();
        if (currentSourateIndex < sourates.length - 1) {
            loadAndPlaySourate(sheikh, currentSourateIndex + 1);
        }
    }
}

function playPrevSourate() {
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    const container = isMobile
        ? document.getElementById('sourate-container-mobile')
        : document.querySelector('.sourate-container');
    const sheikh = isMobile ? sheikhs.find(s => s.name === document.querySelector('.sheikh-name-mobile').textContent) : sheikhs.find(s => s.name === document.querySelector('.sheikh-name').textContent);
    if (container.style.opacity === '1') {
        if (currentSourateIndex > 0) {
            container.style.transition = 'opacity 0.3s ease';
            container.style.opacity = '0';
            
            setTimeout(() => {
                loadAndPlaySourate(sheikh, currentSourateIndex - 1);
                loadSurahText(currentSourateIndex).then(() => {
                    container.style.opacity = '1';
                });
            }, 300);
        } else {
            updateNavigationButtons();
            return;
        }
    } else if (currentAudio) {
        currentAudio.pause();
        if (currentSourateIndex > 0) {
            loadAndPlaySourate(sheikh, currentSourateIndex - 1);
        }
    }
}

// Fonction pour charger le texte d'une sourate
function loadSurahText(index) {
    return new Promise((resolve, reject) => {
        const surahNumber = String(index + 1);

        // Détection automatique : moins de 768px = mobile
        const isMobile = window.matchMedia('(max-width: 600px)').matches;
        
        loadJSON(`./js/surah/${surahNumber}.json`)
            .then(data => {
                currentSurahText = data;
                displaySurahText(currentSurahText, isMobile); // passe l'info mobile
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
    
    // Toujours afficher les heures, même si elles sont à 0
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
    label.textContent = '[all]';
    label.setAttribute('ontouchend', '')
    label.onclick = () => {
        isPlayAll = !isPlayAll;
        if (isPlayAll) {
            label.classList.add('active');
        } else {
            label.classList.remove('active');
        }
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
        // Mettre à jour la liste des favoris lors du clic
        let favSheikhs = getCookie('favSheikhs');
        favSheikhs = favSheikhs ? JSON.parse(favSheikhs) : [];
        const sheikhName = data.name;

        if (favSheikhs.includes(sheikhName)) {
            // Supprimer des favoris
            favSheikhs = favSheikhs.filter(s => s !== sheikhName);
            favoriteSpan.classList.remove('active');
            favoriteSpan.textContent = '[favorite]';
        } else {
            // Ajouter aux favoris
            favSheikhs.push(sheikhName);
            favoriteSpan.classList.add('active');
            favoriteSpan.textContent = '[forget]';
        }

        setCookie('favSheikhs', JSON.stringify(favSheikhs));
        updateSheikhHighlights(); // Cette ligne va maintenant aussi réorganiser le carrousel
    };

    mediaInfo.appendChild(favoriteSpan);

    const learning = document.createElement('span');
    learning.className = 'learning';
    learning.textContent = '[learningPath]';
    learning.onclick = () => {
        isLearning = !isLearning;
        if (isLearning) {
            learning.classList.add('active');
        } else {
            learning.classList.remove('active');
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
            loadAndPlaySourate(sheikh, sourates.indexOf(sourate));
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

    const sheikhcurrent = sheikhs.find(s => s.name === document.querySelector('.sheikh-name-mobile').textContent);

    // 1. Préparer les éléments
    const activeSlide = document.querySelector('[data-active]');
    const sheikhImg = activeSlide?.querySelector('img');
    const overlayImg = document.querySelector('.sheikh-photo-mobile');

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

    // 3. Masquer l'écran principal pendant l'animation
    // Attendre que le clone soit créé avant de masquer l'écran principal
    setTimeout(() => {
        const mainScreenPhone = document.getElementById('main-screen-phone');
        if (mainScreenPhone) {
            mainScreenPhone.style.opacity = '0';
            mainScreenPhone.style.pointerEvents = 'none';
            mainScreenPhone.style.display = 'none';
        }
    }, 200); // petit délai pour garantir que le clone est dans le DOM

    // 4. Déclencher la transition de l'image vers sa position cible (slide)
    requestAnimationFrame(() => {
        imgClone.style.top = targetRect.top + 'px';
        imgClone.style.left = targetRect.left + 'px';
        imgClone.style.width = targetRect.width + 'px';
        imgClone.style.height = targetRect.height + 'px';
        imgClone.style.borderRadius = '16px'; // pour ressembler à la slide si elle est carrée
    });
    // 5. Après l'animation (0.8s), afficher le carousel + nettoyage
    setTimeout(() => {
        // Réactiver l'écran d'accueil
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

        // Remove fade-in-up from carouselList
        const carouselList = document.getElementById('sheikh-carousel');
        if (carouselList) {
            carouselList.classList.remove('fade-in-up');
        }

        // Mettre à jour les slides pour activer celui du sheikh
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

        // Nettoyage du clone
        setTimeout(() => {
            imgClone.remove();
        }, 100); // petit délai pour éviter un flash si la transition n'est pas terminée
 
        // Redémarrer l’auto-slide
        if (auto) clearInterval(auto);
        auto = setInterval(() => {
            const $slides = document.querySelectorAll(".carousel__item");
            const $first = $slides[0];
            document.querySelector(".carousel__list").append($first);
            activateSlide(document.querySelectorAll(".carousel__item")[middleIndex]);
        }, 5000);
    }, 750); // délai = durée transition + 50ms
}

function createOverlayMobile(data) {
    const overlay = document.getElementById('main-screen-phone');
    // Réactive le scroll
    document.documentElement.style.overflow = 'visible'; 
    document.body.style.overflow = 'visible';          


    // Rendre visible l'overlay mobile
    overlay.style.display = 'block';
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';

    // Ajouter la classe mobile-overlay racine
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

    // Vérifie si media-info-mobile existe déjà
    if (overlay.querySelector('.media-info-mobile')) {
        // Si déjà présent, ne rien faire
    } else {
        // Media info
        const mediaInfo = document.createElement('div');
        mediaInfo.className = 'media-info-mobile';

        const playSpan = document.createElement('span');
        playSpan.className = 'action play mobile';
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = '[all]';
        label.onclick = () => {
            isPlayAll = !isPlayAll;
            if (isPlayAll) {
                label.classList.add('active');
            } else {
                label.classList.remove('active');
            }
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
        learning.onclick = () => {
            isLearning = !isLearning;
            if (isLearning) {
                learning.classList.add('active');
            } else {
                learning.classList.remove('active');
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
            const sheikh = data;
            loadAndPlaySourate(sheikh, sourates.indexOf(sourate));
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
            disableControls();
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

            const container = document.querySelector('.sourate-container');
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
            if (isInitialLoad || !currentAudio) {
                // Premier chargement ou pas d'audio chargé
                isInitialLoad = false;
                isFirstPlay = true;
                isPlayAll = true;
                
                loadAndPlaySourate(window.matchMedia('(max-width: 600px)').matches ?
                    sheikhs.find(s => s.name === document.querySelector('.sheikh-name-mobile').textContent) : 
                    sheikhs.find(s => s.name === document.querySelector('.sheikh-name').textContent), 0); 
                return;
            }

            if (isPlaying) {
                // Comportement normal stop
                currentAudio.pause();
                isPlaying = false;
                el.textContent = '[play]';
                clearInterval(updateInterval);
                clearInterval(currentHighlightInterval);
                isFirstPlay = false;
            } else {
                currentAudio.play()
                    .then(() => {
                        if (!controlsInitialized) {
                            enableControls();
                        }
                        isPlaying = true;
                        el.textContent = '[stop]';
                        updateInterval = setInterval(updateCurrentTime, 1000);

                        if (currentHighlightInterval) clearInterval(currentHighlightInterval);
                        currentHighlightInterval = setInterval(() => {
                            highlightCurrentVerse();
                        }, 200);
                    });
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
            if (currentAudio) {
                currentAudio.currentTime = Math.min(currentAudio.currentTime + 30, currentAudio.duration);
                updateCurrentTime();
            }
        });
    }
});

['backward-30', 'backward-30-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', () => {
            if (currentAudio) {
                currentAudio.currentTime = Math.max(currentAudio.currentTime - 30, 0);
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
    
    // Si on active le loop et qu'un audio est en cours, modifier son comportement
    if (currentAudio && isLoopEnabled) {
        currentAudio.loop = true;
    } else if (currentAudio) {
        currentAudio.loop = false;
    }
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
        photo: "./assets/images/Mishary-Rashid-Alafasy.jpeg",
        bio: "Mishary Rashid Alafasy, du Koweït, est mondialement reconnu pour sa voix apaisante et sa récitation émotive du Coran. Il a fondé la première chaîne de télévision entièrement dédiée à la récitation du Coran. Il est aussi le premier réciteur à avoir enregistré le Coran en entier dans les dix lectures (qira'at).",
    },
    {
        name: "Mahmoud Khalil Al-Husary",
        filename: "Mahmoud_Khalil_Al_Husary.json",
        photo: "./assets/images/Mahmoud-Khalil-Al-Husary.jpeg",
        bio: "Mahmoud Khalil Al-Husary, un maître égyptien du tajwid, est connu pour sa récitation claire et méthodique. Il a été le premier réciteur à enregistrer le Coran complet en plusieurs styles de récitation, ce qui a grandement contribué à l'apprentissage du Coran dans le monde entier.",
    },
    {
        name: "Sa'ud ash-Shuraim",
        filename: "Saud_ash_Shuraim.json",
        photo: "./assets/images/Saud-ash-Shuraim.jpeg",
        bio: "Saad Al-Ghamdi a mémorisé le Coran à l'âge de 22 ans et a ensuite étudié les dix lectures (al-qira'at al-‘ashr). Son enregistrement complet du Coran est l’un des plus utilisés dans les écoles coraniques du monde pour son style clair et parfait pour l’apprentissage.",
    },
    {
        name: "AbdulBaset AbdulSamad",
        filename: "AbdulBaset_AbdulSamad.json",
        photo: "./assets/images/Abdul-Basit-Abdus-Samad.jpeg",
        bio: "Abdul Basit Abdus Samad, légende égyptienne du tajwid, est le seul réciteur à avoir conquis le cœur de millions dans le monde entier sans aucun média moderne à l’époque. Il a récité le Coran à l’ONU en 1970, un événement marquant où plusieurs non-musulmans furent émus aux larmes par sa récitation.",
    },
    {
        name: "Abu Bakr al-Shatri",
        filename: "Abu_Bakr_al_Shatri.json",
        photo: "./assets/images/Abu-Bakr-al-Shatri.webp",
        bio: "Abu Bakr al-Shatri, connu pour sa récitation douce et mélodieuse, est un réciteur saoudien très apprécié. Il a participé à de nombreux événements islamiques internationaux et est souvent invité à diriger les prières dans différentes mosquées à travers le monde.",
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
        photo: "./assets/images/Hani-ar-Rifai.jpeg",
        bio: "Hani ar-Rifai, imam de la mosquée Anani à Jeddah, est célèbre pour ses récitations émouvantes et ses dou’as pleines de ferveur. Sa voix unique a touché le cœur de millions de fidèles à travers le monde.",
    },
    {
        name: "Mohamed Siddiq al-Minshawi",
        filename: "Mohamed_Siddiq_al_Minshawi.json",
        photo: "./assets/images/Mohamed-Siddiq-El-Minshawi.jpeg",
        bio: "Mohamed Siddiq al-Minshawi, un maître égyptien du tajwid, est connu pour sa récitation profonde et spirituelle. Il est considéré comme l'un des plus grands récitateurs de tous les temps, ayant influencé des générations de musulmans.",
    },
    {
        name: "Abdur-Rahman as-Sudais",
        filename: "Abdur_Rahman_as_Sudais.json",
        photo: "./assets/images/Abdur-Rahman_As-Sudais.jpg",
        bio: "Abdur-Rahman As-Sudais a mémorisé le Coran à l’âge de 12 ans. Il est devenu imam de la Mosquée sacrée de La Mecque à seulement 22 ans. En 2005, il a été nommé 'Personnalité islamique de l’année'. Il a dirigé les prières du tarawih avec des millions de fidèles derrière lui, un record historique en nombre de participants à une prière collective.",
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
document.addEventListener('astro:after-swap', handleTabletMenus); // Pour Astro
