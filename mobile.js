// ================= МОБИЛЬДІ РЕЖИМ: толық экран + көлденең бағыт =================
(function () {
    var UA_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    var COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var IS_TOUCH_DEVICE = UA_MOBILE || COARSE;
    if (!IS_TOUCH_DEVICE) return;

    function isFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }

    function lockLandscape() {
        try {
            if (screen.orientation && screen.orientation.lock) {
                var p = screen.orientation.lock('landscape');
                if (p && p.catch) p.catch(function () {});
            }
        } catch (e) {}
    }

    // Толық экран + көлденең бағытты қосады. Браузер тек пайдаланушы басқанда рұқсат береді.
    function enterImmersive() {
        var el = document.documentElement;
        var rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (rfs && !isFullscreen()) {
            try {
                var p = rfs.call(el, { navigationUI: 'hide' });
                if (p && p.then) p.then(lockLandscape).catch(lockLandscape);
                else lockLandscape();
            } catch (e) { lockLandscape(); }
        } else {
            lockLandscape();
        }
    }
    window.enterImmersive = enterImmersive;

    // Экранды бірінші басқанда (және толық экраннан шықса, келесі басқанда) қайта қосады
    function onTap() {
        if (!isFullscreen()) enterImmersive();
    }
    document.addEventListener('pointerup', onTap, true);
    document.addEventListener('touchend', onTap, { capture: true, passive: true });

    // "Бастау" басылғанда міндетті түрде қосу
    if (typeof window.startGame === 'function') {
        var origStart = window.startGame;
        window.startGame = function () {
            enterImmersive();
            return origStart.apply(this, arguments);
        };
    }

    // Телефон тік қалыпқа бұрылса, ойын кідіреді (көлденең болғанда пауза мәзірінен жалғастырады)
    var portraitMq = window.matchMedia ? window.matchMedia('(orientation: portrait)') : null;
    function onOrient() {
        if (portraitMq && portraitMq.matches) {
            try { if (typeof gameStarted !== 'undefined' && gameStarted && typeof pauseGame === 'function') pauseGame(); } catch (e) {}
        }
        setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 200);
    }
    if (portraitMq) {
        if (portraitMq.addEventListener) portraitMq.addEventListener('change', onOrient);
        else if (portraitMq.addListener) portraitMq.addListener(onOrient);
    }
    document.addEventListener('fullscreenchange', function () { setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 200); });
    document.addEventListener('webkitfullscreenchange', function () { setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 200); });

    // Мобильді бетте жылжыту/ысыру/контекст мәзірін өшіру
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
})();