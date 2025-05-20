(function () {
    if (window.innerWidth > 980) return;
    const styleId = 'responsive-styles';

    const css = `

        body {
            overflow-x: hidden;
        }
        
        #welcome-message {
            white-space: nowrap;
            overflow-x: auto;
            text-overflow: ellipsis;
            width: 80%;
            font-size: 20px;
            text-align: center;
        }

        .welcome-message.up {
            top: 18%;
            opacity: 1;
        }

        .carousel {
            transform: scale(0.7);
            overflow-x: hidden;
        }

        #main-screen {
            position: absolute;
            top: 30px;
            z-index: 2;
        }

        .menuR {
            position: relative;
            display: flex;
            margin-bottom: 20px;
            top: 820px;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: left;
            gap: 0 10px;
            padding: 15px;
            box-sizing: border-box;
            width: 100%;
            margin-top: 20px;
        }

        .menu-item {
            padding: 2px 4px;
            cursor: pointer;
        }

        .menuL {
            position: absolute;
            left: 50%;
            top: 0px;
            margin: 0;
            transform: translateX(-50%);
        }

        .sheikh-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
            left: 0;
            right: 0;
            top: 180px;
            width: 100%;
            padding: 0 10px;
            position: absolute;
            min-width: 0;
            max-width: 100vw;
            box-sizing: border-box;
            max-height: none;   
            height: auto;          
            overflow-y: visible;
            z-index: 1;   
        }

        .sheikh-header {
            flex-direction: column;
            align-items: center;
            gap: 18px;
            right: 0;
            left: 0;
        }

        .sheikh-name {
            font-size: 7vw;
            white-space: normal;
            word-break: break-word;
            text-align: center;
        }

        .sheikh-photo {
            width: 180px;
            height: 220px;
        }

        .audio-controls {
            position: absolute;
            top: 470px;
        }

        .sheikh-stats {
            position: relative;
            top: 6000px;
            padding-bottom: 100px;
        }

        .sheikh-bio {
            position: relative;
            font: inherit;
            font-size: inherit;
            text-align: justify;
            padding: 10px;
            margin-bottom: 20px;
            width: 100%;
            box-sizing: border-box;
        }

        .media-info {
            position: relative;
            margin-top: 0;
            top: 370px;
            width: 100%;
            box-sizing: border-box;
        }

        .souratesContainer {
            position: relative;
            top: 820px;
            padding: 20px;
        }

        .sourate-list {
            padding-bottom: 0px;
            justify-content: center;
        }
        
        .surah-text-container {
            position: absolute;
            width: 100%;
            right: 15px;
            box-sizing: border-box;
            overflow-wrap: break-word;
            word-break: break-word;
            padding-left: 20px;
        }

        #cookie-alert {
            position: absolute;
            box-sizing: border-box;
            overflow-wrap: break-word;
            word-break: break-word;
        }
    `;

    function applyResponsiveStyles() {
        let styleTag = document.getElementById(styleId);
        if (window.innerWidth <= 980) {
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = styleId;
                styleTag.innerHTML = css;
                document.head.appendChild(styleTag);
            }
        } else {
            if (styleTag) {
                styleTag.remove();
            }
        }
    }

    function positionAudioControls() {
        const image = document.querySelector('.sheikh-photo');
        const audioControls = document.querySelector('.audio-controls');
        const sheikhBio = document.querySelector('.sheikh-bio');
        const menuR = document.querySelector('.menuR');
        const mediaInfo = document.querySelector('.media-info');
        const souratesContainer = document.querySelector('.souratesContainer');
        const sheikhStats = document.querySelector('.sheikh-stats');
        const cookieAlert = document.querySelector('#cookie-alert');

        if (!image || !audioControls || !sheikhBio) return;

        const rect = image.getBoundingClientRect();
        const scrollTop = window.scrollY || window.pageYOffset;
        const audioTop = rect.top + rect.height + scrollTop;

        void sheikhBio.offsetWidth;

        audioControls.style.top = `${audioTop + 10}px`;
        sheikhBio.style.top = `${audioTop - 80}px`;

        if (mediaInfo) {
            const bioTop = parseInt(sheikhBio.style.top, 10);
            mediaInfo.style.top = `${bioTop + 10}px`;
            cookieAlert.style.top = `${parseInt(mediaInfo.style.top, 10) + 350}px`;
            cookieAlert.style.left = `${mediaInfo.style.left + 150}px`;
            souratesContainer.style.top = `${bioTop + menuR.offsetHeight + 90}px`;
        }

        if (menuR && mediaInfo) {
            const mediaInfoRect = mediaInfo.getBoundingClientRect();
            const menuRParent = menuR.offsetParent;

            if (menuRParent) {
                const parentRect = menuRParent.getBoundingClientRect();
                const relativeTop = mediaInfoRect.top - parentRect.top;
                menuR.style.top = `${relativeTop + 80}px`;
            }
        }

        setTimeout(() => {
            if (sheikhStats && souratesContainer) {
                const souratesRect = souratesContainer.getBoundingClientRect();
                const parentOffset = audioControls.getBoundingClientRect().top;
                const relativeTop = souratesRect.bottom - parentOffset;
                sheikhStats.style.top = `${relativeTop}px`;
            }
        }, 2000);
    }

    const observer = new MutationObserver(() => {
        const image = document.querySelector('.sheikh-photo');
        const controls = document.querySelector('.audio-controls');
        if (image && controls) {
            observer.disconnect();
            positionAudioControls();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    function setupSheikhClickHandlers() {
        const sheikhItems = document.querySelectorAll('.menuR .menu-item');

        sheikhItems.forEach(item => {
            item.addEventListener('click', () => {
                requestAnimationFrame(() => {
                    positionAudioControls();
                });
            });
        });
    }

    function setupCircularBtnHandler() {
        const circularBtn = document.querySelector('.circular-btn');
        if (!circularBtn) return;

        let isAudioOnlyMode = false;

        circularBtn.addEventListener('click', () => {
            const menuL = document.querySelector('.menuL');
            const menuR = document.querySelector('.menuR');
            const body = document.querySelector('body');
            const audioControls = document.querySelector('.audio-controls');

            if (!menuL || !menuR || !audioControls) return;

            if (!isAudioOnlyMode) {
                Array.from(menuL.children).forEach(child => {
                    child.style.display = 'none';
                });

                Array.from(menuR.children).forEach(child => {
                    child.style.display = 'none';
                });

                setTimeout(() => {
                    window.scrollTo({
                        top: 0,
                        behavior: 'instant'
                    });
                }, 300);

                body.style.overflow = 'hidden';

                isAudioOnlyMode = true;
            } else {
                Array.from(menuL.children).forEach(child => {
                    child.style.display = '';
                });

                Array.from(menuR.children).forEach(child => {
                    child.style.display = '';
                });

                body.style.overflow = '';

                isAudioOnlyMode = false;
            }
        });
    }

    window.addEventListener('load', () => {
        applyResponsiveStyles();
        positionAudioControls();
        setupSheikhClickHandlers();
        setupCircularBtnHandler();
    });

    window.addEventListener('resize', () => {
        applyResponsiveStyles();
        positionAudioControls();
    });

})();