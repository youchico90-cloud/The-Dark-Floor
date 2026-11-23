let scene, camera, renderer;
let composer, bloomPass, vignettePass, gammaPass, filmPass;
const PLAYER_BODY_CFG = {
    backOffsetStanding: 0.14,
    backOffsetCrouching: 0.28,
    floorY: 0,
    animSpeedMult: 1.0,
    baseFov: 75,
    sprintFov: 82
};
const _flashAnchorPos = new THREE.Vector3();
const playerBodyAnim = {
    phase: 0,
    idleTime: 0,
    moveBlend: 0,
    sprintBlend: 0,
    crouchBlend: 0,
    backOffset: PLAYER_BODY_CFG.backOffsetStanding
};
let playerBody = null;
let playerBodyModel = null;
let playerBodyParts = null;
let decorGroup = null;
let lampGlowSprites = [];
let flashlightBeam = null;

// Көрініс жарықтығы мен атмосфера константалары
const LOOK = {
    exposure: 1.0,
    ambient: 0.75,
    flashlight: 4.0,
    fogDensity: 0.11
};

// textures/ қалтасындағы күтілетін PBR файл аттары
const PBR_NAMES = ['concrete', 'floor', 'wood'];
const pbrNormalEntries = [];
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let isSprinting = false, isCrouching = false;
let prevTime = performance.now();

let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches);
let joyTouchId = null, lookTouchId = null;
let joyX = 0, joyY = 0;
let lastLookX = 0, lastLookY = 0;
let mobileSprint = false;

let isTransitioning = false;
let pendingPause = false;

let floorMesh, rightWallMesh, frontDoorMesh, backDoorMesh, frontDoorGroup, backDoorGroup;
let doorAnimTarget = null;
let brickTex = null, concreteTex = null, woodTex = null;
let ceilingLights = [];
let lampMeshes = [];
let specialPainting, specialPaintingCanvas;
let specialPlant, specialPlantCollider;
let extinguisherBodyGroup, extinguisherCollider;
let poster0Mesh, poster0NormalTex;
let stageSignMesh;
let dustPoints = null;
let dustSeeds = null;

let flashlight, flashlightTarget;
let flashlightOn = true;
const FLASHLIGHT_BASE_INTENSITY = LOOK.flashlight;
let flickerCooldown = 8 + Math.random() * 12;
let flickerTimeLeft = 0;
let flickerStep = 0;
let flickerType = 'stutter';

let gameStarted = false;
let mouseSensitivity = 1.0;
let inMenu = true;
let menuFlickerCooldown = 3 + Math.random() * 4;
let menuFlickerLeft = 0;
let menuFlickerStep = 0;
let menuFlickerLamp = 2;
let menuLampsDirty = false;
let heartbeatTimer = 0;
let heartbeatPulse = 0;
let panicLevel = 0;
let creakCooldown = 8 + Math.random() * 10;
let playTime = 0;
let mistakes = 0;
let footstepTimer = 0;
let stamina = 1.0;
let sprintExhausted = false;
let stageHintTimer = 0;
const shakeOffset = new THREE.Vector3();

const colliders = [];
const PLAYER_RADIUS = 0.25;
const QUALITY = (() => {
    const exp = LOOK.exposure;
    const presets = {
        high:   { level: 'high',   pixelRatioMax: 2,   lampShadows: [0, 1, 2, 3, 4], flashShadow: 'every', film: true,  dustCount: 140, canvasHz: 30, menuFrameMs: 16, tonemap: true,  exposure: exp, segs: 20, bevel: 3, pbr: '1k',  normalMaps: true,  decals: 24, glow: true,  beam: true,  bloom: true,  fakeAO: true  },
        medium: { level: 'medium', pixelRatioMax: 1.5, lampShadows: [0, 2, 4],       flashShadow: 'half',  film: true,  dustCount: 90,  canvasHz: 20, menuFrameMs: 32, tonemap: true,  exposure: exp, segs: 14, bevel: 2, pbr: '512', normalMaps: true,  decals: 12, glow: true,  beam: false, bloom: false, fakeAO: true  },
        low:    { level: 'low',    pixelRatioMax: 1,   lampShadows: [1, 3],          flashShadow: 'off',   film: false, dustCount: 50,  canvasHz: 15, menuFrameMs: 32, tonemap: false, exposure: exp, segs: 8,  bevel: 0, pbr: '',    normalMaps: false, decals: 0,  glow: false, beam: false, bloom: false, fakeAO: false }
    };
    let lvl = isMobile ? (((navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 3) ? 'low' : 'medium') : 'high';
    try {
        const uq = new URLSearchParams(window.location.search).get('q');
        if (uq && presets[uq]) lvl = uq;
        else {
            const sq = localStorage.getItem('quality');
            if (sq && presets[sq]) lvl = sq;
        }
    } catch (e) {}
    return presets[lvl];
})();
let _perfEffectLevel = 0;
let perfGlowEnabled = QUALITY.glow;
let perfBeamEnabled = QUALITY.beam;
let perfFlashShadowOverride = null;

// ===== Қолданушы параметрлері (localStorage-та сақталады) =====
function userGet(key, def) {
    try { const v = localStorage.getItem(key); return v === null ? def : v; } catch (e) { return def; }
}
function userSet(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (e) {}
}
let userFlashShadow = (() => {
    const v = userGet('flashShadow', 'auto');
    return ['auto', 'every', 'half', 'off'].indexOf(v) >= 0 ? v : 'auto';
})();
const userFx = (() => {
    const d = { bloom: true, film: true, beam: true, glow: true, decor: true };
    try {
        const o = JSON.parse(userGet('gfx', '{}'));
        for (const k in d) if (typeof o[k] === 'boolean') d[k] = o[k];
    } catch (e) {}
    return d;
})();
let perfAutoRes = userGet('autoRes', '1') !== '0';
let perfUserScale = Math.min(1, Math.max(0.4, (parseFloat(userGet('resScale', '100')) || 100) / 100));
let DEBUG_PERF = userGet('showFps', '0') === '1';
function perfFlashMode() {
    return userFlashShadow !== 'auto' ? userFlashShadow : (perfFlashShadowOverride || QUALITY.flashShadow);
}

// Түстік карталарды sRGB кеңістігіне белгілеу
function markSRGB(tex) {
    tex.encoding = THREE.sRGBEncoding;
    return tex;
}
const perfPixelRatioBase = Math.min(window.devicePixelRatio || 1, QUALITY.pixelRatioMax);
let perfPixelRatioCap = Math.max(0.3, perfPixelRatioBase * perfUserScale);
let perfPixelRatio = perfPixelRatioCap;
const _perfElCache = {};
function perfEl(id) {
    return Object.prototype.hasOwnProperty.call(_perfElCache, id)
        ? _perfElCache[id]
        : (_perfElCache[id] = document.getElementById(id));
}
let toastTimer = null;

const _animForward = new THREE.Vector3();
const _animRight = new THREE.Vector3();
const _flashOffset = new THREE.Vector3();
const _camDir = new THREE.Vector3();

function isGameplayInputActive() {
    return gameStarted && !inMenu && !isTransitioning && (isMobile || document.pointerLockElement === document.body);
}
function syncInGamePlayerBody() {
    if (playerBody) {
        scene.remove(playerBody);
        if (typeof window.disposeCharacterObject === 'function') {
            window.disposeCharacterObject(playerBody);
        }
        playerBody = null;
        playerBodyModel = null;
        playerBodyParts = null;
    }

    if (typeof window.getSelectedCharacter !== 'function') return;
    const ch = window.getSelectedCharacter();
    if (!ch) return;

    const isLow = (QUALITY.level === 'low');
    // Бірінші жақтан көрінетін дене: кейіпкер "көрінбейтін" болса да қол, фонарик және аяқ көрсетіледі
    let built = (typeof ch.build === 'function') ? ch.build({ lowDetail: isLow }) : null;
    if (!built && typeof buildGuardCharacter === 'function') built = buildGuardCharacter({ lowDetail: isLow });
    if (!built) return;

    built.rotation.y = Math.PI;

    playerBody = new THREE.Group();
    playerBody.userData.ignoreAnomaly = true;
    playerBody.userData.builtLowDetail = isLow;
    playerBody.add(built);

    playerBodyModel = built;
    playerBodyParts = (built.userData && built.userData.parts) ? built.userData.parts : null;

    if (playerBodyParts) {
        if (playerBodyParts.headGroup) playerBodyParts.headGroup.visible = false;
        if (playerBodyParts.collar) playerBodyParts.collar.visible = false;
    }

    if (playerBodyParts) {
        // Төмен қарағанда аяқ ұштары көрінуі үшін аяқтар кеудеден сәл алға тұрады
        if (playerBodyParts.legLeftPivot) playerBodyParts.legLeftPivot.position.z += 0.08;
        if (playerBodyParts.legRightPivot) playerBodyParts.legRightPivot.position.z += 0.08;
    }
    // Қараңғы дәлізде қол мен аяқ көрінуі үшін жеңіл өзіндік жарық (жарық көзі қосылмайды)
    const _fpMats = new Set();
    built.traverse(obj => {
        if (obj.isMesh && obj.material && obj.material.emissive && !_fpMats.has(obj.material)) {
            _fpMats.add(obj.material);
            if (obj.material.emissive.getHex() === 0) {
                obj.material.emissive.copy(obj.material.color).multiplyScalar(0.22);
            }
        }
    });

    const allowBodyShadow = (QUALITY.level === 'high' || QUALITY.level === 'medium');
    const noopRaycast = function () {};
    playerBody.traverse(obj => {
        if (obj.isMesh) {
            obj.raycast = noopRaycast;
            obj.receiveShadow = allowBodyShadow;
            // Дене көлеңке түсірмейді: шамдардың статикалық көлеңке картасында "елес көлеңке" қатып қалмауы үшін
            obj.castShadow = false;
        }
    });

    playerBody.visible = !inMenu;
    scene.add(playerBody);
    updatePlayerBody(0);
}
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020202);
    scene.fog = new THREE.FogExp2(0x020202, LOOK.fogDensity);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 8.5);
    camera.rotation.order = 'YXZ';

    renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
    renderer.setPixelRatio(perfPixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    if (QUALITY.tonemap) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = QUALITY.exposure;
    }
    document.body.appendChild(renderer.domElement);

    setupPostProcessing();

    const ambientLight = new THREE.AmbientLight(0x0a0a0a, LOOK.ambient);
    scene.add(ambientLight);

    flashlight = new THREE.SpotLight(0xffffee, LOOK.flashlight, 22, Math.PI / 5, 0.5, 1.2);
    flashlight.position.set(0, 1.6, 8.5);
    scene.add(flashlight);

    flashlightTarget = new THREE.Object3D();
    scene.add(flashlightTarget);
    flashlight.target = flashlightTarget;
    createCorridor();
    createDecorations();
    createLampGlows();
    createFlashlightBeam();
    createClutter();
    createWallDetails();
    createAtmosphereDetails();
    applyTextures();
    setupShadows();
    updateStageSign(false);
    resetStage(true);
    setupControls();
    createDustParticles();
    perfResetEffects();
    syncInGamePlayerBody();
    try { scEnsure(); } catch (e) {}
    try { renderer.compile(scene, camera); } catch (e) {}

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', () => setTimeout(onWindowResize, 180));
}

function updatePlayerBody(dt = 0, animState = null) {
    if (!playerBody) return;
    if (inMenu) {
        playerBody.visible = false;
        return;
    }
    playerBody.visible = true;

    const safeDt = Math.min(Math.max(dt || 0, 0), 0.1);
    const frozen = (typeof SC !== 'undefined' && SC.freeze > 0);
    const inputActive = isGameplayInputActive();

    let isMoving = false;
    let canSprint = false;
    let stepInterval = 0.45;
    if (inputActive) {
        if (animState) {
            isMoving = !!animState.isMoving;
            canSprint = !!animState.canSprint;
            stepInterval = animState.stepInterval || 0.45;
        } else {
            const moveZ = (moveForward ? 1 : 0) - (moveBackward ? 1 : 0) - joyY;
            const moveX = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0) + joyX;
            isMoving = Math.hypot(moveX, moveZ) > 0.08;
            const wantsSprint = isSprinting || mobileSprint;
            canSprint = wantsSprint && isMoving && !isCrouching && !sprintExhausted && stamina > 0;
            if (isCrouching) stepInterval = 0.7;
            else if (canSprint) stepInterval = 0.25;
        }
    }

    if (safeDt === 0 && !frozen) {
        playerBodyAnim.moveBlend = isMoving ? 1 : 0;
        playerBodyAnim.sprintBlend = canSprint ? 1 : 0;
    } else if (!frozen && safeDt > 0) {
        const blendAlpha = Math.min(1, safeDt * 10);
        const sprintAlpha = Math.min(1, safeDt * 8);

        playerBodyAnim.moveBlend += ((isMoving ? 1 : 0) - playerBodyAnim.moveBlend) * blendAlpha;
        playerBodyAnim.sprintBlend += ((canSprint ? 1 : 0) - playerBodyAnim.sprintBlend) * sprintAlpha;

        playerBodyAnim.idleTime += safeDt;
        if (isMoving) {
            const phaseSpeed = (Math.PI / Math.max(0.1, stepInterval)) * PLAYER_BODY_CFG.animSpeedMult;
            playerBodyAnim.phase = (playerBodyAnim.phase + phaseSpeed * safeDt) % (Math.PI * 2);
        }
    }

    // Отыру деңгейі камера биіктігінен алынады (1.6 м = тұру, 0.85 м = отыру): дене камерамен әрқашан сәйкес
    playerBodyAnim.crouchBlend = Math.max(0, Math.min(1, (1.6 - camera.position.y) / 0.75));
    playerBodyAnim.backOffset = PLAYER_BODY_CFG.backOffsetStanding +
        (PLAYER_BODY_CFG.backOffsetCrouching - PLAYER_BODY_CFG.backOffsetStanding) * playerBodyAnim.crouchBlend;

    const m = playerBodyAnim.moveBlend;
    const sp = playerBodyAnim.sprintBlend;
    const cr = playerBodyAnim.crouchBlend;
    const ph = playerBodyAnim.phase;

    let bodyFloorY = PLAYER_BODY_CFG.floorY;
    if (typeof NA !== 'undefined' && NA.pitFalling) {
        const expectedEyeY = 0.85 + (1 - cr) * 0.75;
        bodyFloorY = Math.min(PLAYER_BODY_CFG.floorY, camera.position.y - expectedEyeY);
    }

    const yaw = camera.rotation.y;
    playerBody.position.set(
        camera.position.x + Math.sin(yaw) * playerBodyAnim.backOffset,
        bodyFloorY,
        camera.position.z + Math.cos(yaw) * playerBodyAnim.backOffset
    );
    playerBody.rotation.set(0, yaw, 0);

    const parts = playerBodyParts;
    if (!parts) return;

    const breath = Math.sin(playerBodyAnim.idleTime * (1.8 + sp * 2.4));
    const sL = Math.sin(ph);
    const sR = -sL;

    const swingAmp = (0.48 + sp * 0.34) * (1 - cr * 0.45) * m;
    const hipBase = cr * -0.92;
    const hipL = hipBase - sL * swingAmp;
    const hipR = hipBase - sR * swingAmp;

    const kneeBase = cr * 1.72;
    const kneeSwingL = (0.12 + 0.48 * Math.max(0, Math.cos(ph)) + 0.15 * Math.max(0, sL)) * (1 + sp * 0.55) * m;
    const kneeSwingR = (0.12 + 0.48 * Math.max(0, Math.cos(ph + Math.PI)) + 0.15 * Math.max(0, sR)) * (1 + sp * 0.55) * m;
    const kneeL = Math.max(0, kneeBase + kneeSwingL * (1 - cr * 0.55));
    const kneeR = Math.max(0, kneeBase + kneeSwingR * (1 - cr * 0.55));

    const ankleComp = Math.max(cr, 0.4 * m);
    const ankleL = -(hipL + kneeL) * ankleComp;
    const ankleR = -(hipR + kneeR) * ankleComp;

    if (parts.legLeftPivot) parts.legLeftPivot.rotation.x = hipL;
    if (parts.legRightPivot) parts.legRightPivot.rotation.x = hipR;
    if (parts.kneeLeftPivot) parts.kneeLeftPivot.rotation.x = kneeL;
    if (parts.kneeRightPivot) parts.kneeRightPivot.rotation.x = kneeR;
    if (parts.ankleLeftPivot) parts.ankleLeftPivot.rotation.x = ankleL;
    if (parts.ankleRightPivot) parts.ankleRightPivot.rotation.x = ankleR;

    if (parts.torsoPivot) {
        parts.torsoPivot.position.y = 0.05 + breath * 0.008;
        parts.torsoPivot.rotation.x = 0.05 * m + 0.20 * sp + 0.34 * cr - breath * 0.015;
        parts.torsoPivot.rotation.y = sL * (0.07 + sp * 0.07) * m;
    }

    // Бірінші жақтан көрініс: қолдар камераның еңісіне ілесіп жүреді
    const fpPitch = Math.max(-1.4, Math.min(1.4, camera.rotation.x));
    const fpTorsoRx = parts.torsoPivot ? parts.torsoPivot.rotation.x : 0;
    if (parts.armRightPivot) {
        // Оң қол фонарикті алға ұстайды (экранның төменгі оң жағында көрінеді)
        const rx = -1.5 - fpPitch - fpTorsoRx + sL * 0.035 * m * (1 + sp) + breath * 0.008;
        parts.armRightPivot.rotation.x = rx;
        parts.armRightPivot.rotation.z = 0.30 - cr * 0.04 + breath * 0.01;
        // Фонарик камера қараған бағытқа бағытталады
        if (parts.flashlightGroup) parts.flashlightGroup.rotation.x = -fpPitch - fpTorsoRx - rx;
    }
    if (parts.armLeftPivot) {
        // Сол қол төмен түсірілген: төмен қарағанда көрінеді
        const lx = -0.8 - fpPitch * 0.6 - fpTorsoRx + sL * (0.12 + sp * 0.1) * m;
        parts.armLeftPivot.rotation.x = lx;
        parts.armLeftPivot.rotation.z = -0.22 - cr * 0.05 + breath * 0.012;
    }

    if (parts.bodyPivot) {
        const L1 = 0.43;
        const L2 = 0.345;
        const footH = 0.085;
        const worldFootL = hipL + kneeL + ankleL;
        const worldFootR = hipR + kneeR + ankleR;
        const dropL = L1 * Math.cos(hipL) + L2 * Math.cos(hipL + kneeL) +
            footH * Math.cos(worldFootL) + Math.abs(Math.sin(worldFootL)) * 0.115;
        const dropR = L1 * Math.cos(hipR) + L2 * Math.cos(hipR + kneeR) +
            footH * Math.cos(worldFootR) + Math.abs(Math.sin(worldFootR)) * 0.115;
        const bob = Math.abs(Math.sin(ph)) * (0.02 + sp * 0.035) * m * (1 - cr * 0.5);
        parts.bodyPivot.position.y = Math.max(dropL, dropR) + bob;
    }

    if (parts.flashlightLensMesh && parts.flashlightLensMesh.material) {
        parts.flashlightLensMesh.material.emissiveIntensity =
            Math.max(0, Math.min(1, flashlight.intensity / FLASHLIGHT_BASE_INTENSITY));
    }
}

function resetPlayerBodyPose() {
    playerBodyAnim.phase = 0;
    playerBodyAnim.idleTime = 0;
    playerBodyAnim.moveBlend = 0;
    playerBodyAnim.sprintBlend = 0;
    playerBodyAnim.crouchBlend = 0;
    playerBodyAnim.backOffset = PLAYER_BODY_CFG.backOffsetStanding;
    updatePlayerBody(0);
}

window.syncInGamePlayerBody = syncInGamePlayerBody;

let _perfDbgEl = null, _perfDbgAcc = 0, _perfDbgFrames = 0, _perfDbgShown = true;
function perfDebugTick(delta) {
    if (!DEBUG_PERF) { if (_perfDbgEl) _perfDbgEl.style.display = 'none'; return; }
    if (!_perfDbgEl) {
        _perfDbgEl = document.createElement('div');
        _perfDbgEl.style.cssText = 'position:fixed;top:0;left:0;z-index:9999;font:12px monospace;color:#0f0;background:rgba(0,0,0,.6);padding:4px 6px;pointer-events:none';
        document.body.appendChild(_perfDbgEl);
        document.addEventListener('keydown', (e) => {
            if (e.code === 'F2') {
                _perfDbgShown = !_perfDbgShown;
                _perfDbgEl.style.display = _perfDbgShown ? 'block' : 'none';
            }
        });
    }
    _perfDbgEl.style.display = _perfDbgShown ? 'block' : 'none';
    _perfDbgAcc += delta;
    _perfDbgFrames++;
    if (_perfDbgAcc >= 0.5) {
        const ms = (_perfDbgAcc / _perfDbgFrames) * 1000;
        const fps = _perfDbgFrames / _perfDbgAcc;
        const info = renderer.info.render;
        _perfDbgEl.textContent = `FPS:${fps.toFixed(0)} ${ms.toFixed(1)}ms | calls:${info.calls} tris:${info.triangles} | DPR:${perfPixelRatio.toFixed(2)} (${QUALITY.level})`;
        _perfDbgAcc = 0;
        _perfDbgFrames = 0;
    }
}

// GammaCorrectionShader жүктелмесе қолданылатын өз sRGB шейдері
const GAMMA_FALLBACK_SHADER = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv;\nvoid main() {\n    vUv = uv;\n    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}',
    fragmentShader: 'uniform sampler2D tDiffuse;\nvarying vec2 vUv;\nvoid main() {\n    vec4 c = texture2D(tDiffuse, vUv);\n    gl_FragColor = vec4(pow(max(c.rgb, vec3(0.0)), vec3(1.0 / 2.2)), c.a);\n}'
};

function setupPostProcessing() {
    if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.ShaderPass || !THREE.CopyShader || !THREE.VignetteShader || !THREE.FilmPass || !THREE.FilmShader) {
        console.warn('Post-processing модульдері жүктелмеді');
        return;
    }

    try {
        let target = undefined;
        if (!isMobile && renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) {
            target = new THREE.WebGLMultisampleRenderTarget(window.innerWidth, window.innerHeight);
        }
        composer = new THREE.EffectComposer(renderer, target);
        if (composer.setPixelRatio) composer.setPixelRatio(renderer.getPixelRatio());

        composer.addPass(new THREE.RenderPass(scene, camera));

        if (QUALITY.bloom && THREE.UnrealBloomPass && THREE.LuminosityHighPassShader) {
            const w = Math.max(1, Math.floor(window.innerWidth * perfPixelRatio));
            const h = Math.max(1, Math.floor(window.innerHeight * perfPixelRatio));
            bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.35, 0.6, 0.85);
            composer.addPass(bloomPass);
        } else {
            bloomPass = null;
        }

        vignettePass = new THREE.ShaderPass(THREE.VignetteShader);
        vignettePass.uniforms['offset'].value = 1.0;
        vignettePass.uniforms['darkness'].value = 1.4;
        composer.addPass(vignettePass);

        // Көрініс екі рет гамма түзетілмейді: composer мақсаттары линейлік, sRGB тек gammaPass-та (не тікелей renderer-де) орындалады
        gammaPass = new THREE.ShaderPass(THREE.GammaCorrectionShader || GAMMA_FALLBACK_SHADER);
        composer.addPass(gammaPass);

        filmPass = new THREE.FilmPass(0.35, 0.05, 648, false);
        filmPass.renderToScreen = true;
        composer.addPass(filmPass);
        perfApplyPostQuality();
    } catch (e) {
        console.warn('Post-processing модульдері жүктелмеді', e);
        composer = null;
        bloomPass = null;
        vignettePass = null;
        gammaPass = null;
        filmPass = null;
    }
}
function perfSetFilm(on) {
    if (!filmPass) return;
    const last = gammaPass || vignettePass;
    if (on) {
        filmPass.enabled = true;
        filmPass.renderToScreen = true;
        if (last) last.renderToScreen = false;
    } else {
        filmPass.enabled = false;
        filmPass.renderToScreen = false;
        if (last) last.renderToScreen = true;
    }
}
function perfApplyPostQuality() {
    if (!QUALITY.film && filmPass) {
        filmPass.enabled = false;
        filmPass.renderToScreen = false;
        const lastPass = gammaPass || vignettePass;
        if (lastPass) lastPass.renderToScreen = true;
        if (gammaPass && vignettePass) vignettePass.renderToScreen = false;
    }
}
// Дөңгелектелген жиекті қорап геометриясы (low режимінде қарапайым BoxGeometry)
function makeBevelBox(w, h, d, r) {
    if (!QUALITY.bevel) return new THREE.BoxGeometry(w, h, d);
    const b = Math.min(r !== undefined ? r : Math.min(w, h, d) * 0.08, w * 0.3, h * 0.3, d * 0.3);
    if (b <= 0.0005) return new THREE.BoxGeometry(w, h, d);

    const sw = Math.max(0.001, w - b * 2);
    const sh = Math.max(0.001, h - b * 2);
    const sd = Math.max(0.001, d - b * 2);
    const hw = sw * 0.5, hh = sh * 0.5;
    const cr = Math.min(b * 0.5, hw * 0.8, hh * 0.8);

    const shape = new THREE.Shape();
    shape.moveTo(-hw + cr, -hh);
    shape.lineTo(hw - cr, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + cr);
    shape.lineTo(hw, hh - cr);
    shape.quadraticCurveTo(hw, hh, hw - cr, hh);
    shape.lineTo(-hw + cr, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - cr);
    shape.lineTo(-hw, -hh + cr);
    shape.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);

    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: sd,
        bevelEnabled: true,
        bevelThickness: b,
        bevelSize: b,
        bevelSegments: QUALITY.bevel,
        curveSegments: QUALITY.bevel
    });
    geo.center();

    // UV және 6 жақ тобын BoxGeometry-ге сәйкестендіру
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const triCount = pos.count / 3;
    const buckets = [[], [], [], [], [], []];
    const invW = 1 / w, invH = 1 / h, invD = 1 / d;

    for (let t = 0; t < triCount; t++) {
        const i = t * 3;
        const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
        const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
        const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);
        const nx = (y1 - y0) * (z2 - z0) - (z1 - z0) * (y2 - y0);
        const ny = (z1 - z0) * (x2 - x0) - (x1 - x0) * (z2 - z0);
        const nz = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
        const anx = Math.abs(nx), any = Math.abs(ny), anz = Math.abs(nz);
        const face = (anx >= any && anx >= anz) ? (nx >= 0 ? 0 : 1)
            : (any >= anx && any >= anz) ? (ny >= 0 ? 2 : 3)
            : (nz >= 0 ? 4 : 5);
        buckets[face].push(i);
    }

    const pArr = new Float32Array(pos.count * 3);
    const nArr = new Float32Array(norm.count * 3);
    const uArr = new Float32Array(uv.count * 2);
    geo.clearGroups();
    let cursor = 0;

    for (let f = 0; f < 6; f++) {
        const list = buckets[f];
        if (!list.length) continue;
        const start = cursor;
        for (let m = 0; m < list.length; m++) {
            const base = list[m];
            for (let k = 0; k < 3; k++) {
                const s = base + k, dIdx = cursor++;
                const px = pos.getX(s), py = pos.getY(s), pz = pos.getZ(s);
                pArr[dIdx * 3] = px; pArr[dIdx * 3 + 1] = py; pArr[dIdx * 3 + 2] = pz;
                nArr[dIdx * 3] = norm.getX(s); nArr[dIdx * 3 + 1] = norm.getY(s); nArr[dIdx * 3 + 2] = norm.getZ(s);
                let u = 0, v = 0;
                if (f === 0) { u = 0.5 - pz * invD; v = 0.5 + py * invH; }
                else if (f === 1) { u = 0.5 + pz * invD; v = 0.5 + py * invH; }
                else if (f === 2) { u = 0.5 + px * invW; v = 0.5 - pz * invD; }
                else if (f === 3) { u = 0.5 + px * invW; v = 0.5 + pz * invD; }
                else if (f === 4) { u = 0.5 + px * invW; v = 0.5 + py * invH; }
                else { u = 0.5 - px * invW; v = 0.5 + py * invH; }
                uArr[dIdx * 2] = u; uArr[dIdx * 2 + 1] = v;
            }
        }
        geo.addGroup(start, cursor - start, f);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nArr, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uArr, 2));
    geo.computeBoundingBox();
    return geo;
}

function createCorridor() {
    const floorGeo = new THREE.PlaneGeometry(4, 38);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.95, metalness: 0.22 });
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.z = -7;
    scene.add(floorMesh);

    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
    const ceiling = new THREE.Mesh(floorGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 4, -7);
    scene.add(ceiling);

    const wallGeo = new THREE.PlaneGeometry(38, 4);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.9 });
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-2, 2, -7);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    rightWallMesh = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.9 }));
    rightWallMesh.position.set(2, 2, -7);
    rightWallMesh.rotation.y = -Math.PI / 2;
    scene.add(rightWallMesh);

    // Еден плинтусы және төбе карнизі (6-аномалиямен бірге масштабталуы үшін X бойымен 38м)
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.88, metalness: 0.1 });
    const baseboardGeo = new THREE.BoxGeometry(38, 0.12, 0.03);
    const baseboardLipGeo = new THREE.BoxGeometry(38, 0.022, 0.042);
    const corniceGeo = new THREE.BoxGeometry(38, 0.07, 0.045);
    const corniceStepGeo = new THREE.BoxGeometry(38, 0.024, 0.075);
    [-1, 1].forEach(side => {
        const bb = new THREE.Mesh(baseboardGeo, trimMat);
        bb.rotation.y = Math.PI / 2;
        bb.position.set(side * 1.985, 0.06, -7);
        bb.userData.noShadowCast = true;
        bb.userData.corridorSpan = true;
        scene.add(bb);

        const lip = new THREE.Mesh(baseboardLipGeo, trimMat);
        lip.rotation.y = Math.PI / 2;
        lip.position.set(side * 1.979, 0.126, -7);
        lip.userData.noShadowCast = true;
        lip.userData.corridorSpan = true;
        scene.add(lip);

        const corn = new THREE.Mesh(corniceGeo, trimMat);
        corn.rotation.y = Math.PI / 2;
        corn.position.set(side * 1.977, 3.965, -7);
        corn.userData.noShadowCast = true;
        corn.userData.corridorSpan = true;
        scene.add(corn);

        const cStep = new THREE.Mesh(corniceStepGeo, trimMat);
        cStep.rotation.y = Math.PI / 2;
        cStep.position.set(side * 1.962, 3.988, -7);
        cStep.userData.noShadowCast = true;
        cStep.userData.corridorSpan = true;
        scene.add(cStep);
    });

    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x2d2b28, metalness: 0.65, roughness: 0.62 });
    const clampMat = new THREE.MeshStandardMaterial({ color: 0x1d1f21, metalness: 0.75, roughness: 0.55 });
    const pipeMainGeo = new THREE.CylinderGeometry(0.042, 0.042, 37.8, QUALITY.segs);
    const pipeThinGeo = new THREE.CylinderGeometry(0.025, 0.025, 37.8, QUALITY.segs);
    const clampGeo = new THREE.BoxGeometry(0.24, 0.09, 0.06);

    [[-1.78, 3.78, pipeMainGeo], [-1.66, 3.85, pipeThinGeo], [1.82, 3.83, pipeThinGeo]].forEach(cfg => {
        const pipe = new THREE.Mesh(cfg[2], pipeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(cfg[0], cfg[1], -7);
        pipe.userData.noShadowCast = true;
        scene.add(pipe);
    });
    for (let z = 8; z >= -24; z -= 6.4) {
        const cL = new THREE.Mesh(clampGeo, clampMat);
        cL.position.set(-1.74, 3.84, z);
        cL.userData.noShadowCast = true;
        scene.add(cL);

        const cR = new THREE.Mesh(clampGeo, clampMat);
        cR.position.set(1.82, 3.86, z);
        cR.userData.noShadowCast = true;
        scene.add(cR);
    }

    const ventTex = (() => {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 192;
        const g = c.getContext('2d');
        g.fillStyle = '#090a0b';
        g.fillRect(0, 0, 256, 192);
        for (let y = 16; y < 176; y += 14) {
            g.fillStyle = '#2d3135';
            g.fillRect(14, y, 228, 7);
            g.fillStyle = '#474c52';
            g.fillRect(14, y, 228, 2);
            g.fillStyle = '#050506';
            g.fillRect(14, y + 7, 228, 4);
        }
        for (let i = 0; i < 6; i++) {
            const x = 25 + Math.random() * 206, y = 12 + Math.random() * 168, r = 18 + Math.random() * 35;
            const gr = g.createRadialGradient(x, y, 1, x, y, r);
            gr.addColorStop(0, 'rgba(20,16,12,0.55)');
            gr.addColorStop(1, 'rgba(20,16,12,0)');
            g.fillStyle = gr;
            g.fillRect(0, 0, 256, 192);
        }
        g.strokeStyle = '#3b3e42';
        g.lineWidth = 12;
        g.strokeRect(6, 6, 244, 180);
        return markSRGB(new THREE.CanvasTexture(c));
    })();
    const ventFrameMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, metalness: 0.6, roughness: 0.6 });
    const ventFaceMat = new THREE.MeshStandardMaterial({ map: ventTex, metalness: 0.45, roughness: 0.72 });
    const ventRimGeo = new THREE.BoxGeometry(0.76, 0.04, 0.56);
    const ventFaceGeo = new THREE.PlaneGeometry(0.68, 0.48);

    [3.5, -10.5, -17.5].forEach(z => {
        const rim = new THREE.Mesh(ventRimGeo, ventFrameMat);
        rim.position.set(0.65, 3.98, z);
        rim.userData.noShadowCast = true;
        scene.add(rim);

        const face = new THREE.Mesh(ventFaceGeo, ventFaceMat);
        face.rotation.x = Math.PI / 2;
        face.position.set(0.65, 3.958, z);
        face.userData.noShadowCast = true;
        scene.add(face);
    });

    const doorGeo = new THREE.BoxGeometry(2, 3.5, 0.1);
    const frontDoorMat = new THREE.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.78 });
    const backDoorMat = frontDoorMat.clone();
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x26282a, metalness: 0.72, roughness: 0.55 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0x8f7744, metalness: 0.78, roughness: 0.36 });
    const doorTrimMat = new THREE.MeshStandardMaterial({ color: 0x2b1c13, roughness: 0.85 });
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x231a14, roughness: 0.84 });

    const kickGeo = new THREE.BoxGeometry(1.92, 0.42, 0.112);
    const barGeo = new THREE.BoxGeometry(1.96, 0.085, 0.114);
    const hingeSeg = Math.min(QUALITY.segs, 10);
    const hingeGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.14, hingeSeg);
    const plateGeo = new THREE.BoxGeometry(0.085, 0.27, 0.016);
    const keyholeGeo = new THREE.BoxGeometry(0.016, 0.042, 0.018);
    const neckGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.07, hingeSeg);
    const leverGeo = new THREE.BoxGeometry(0.15, 0.028, 0.028);
    const knobGeo = new THREE.SphereGeometry(0.03, hingeSeg, hingeSeg);

    const buildDoorDetails = (group, dirX, isFront) => {
        const kick = new THREE.Mesh(kickGeo, darkMetalMat);
        kick.position.set(dirX * 1.0, -1.52, 0);
        kick.userData.noShadowCast = true;
        group.add(kick);

        [0.58, -0.32].forEach(yPos => {
            const bar = new THREE.Mesh(barGeo, doorTrimMat);
            bar.position.set(dirX * 1.0, yPos, 0);
            bar.userData.noShadowCast = true;
            group.add(bar);
        });

        [-1.15, 0.0, 1.15].forEach(yPos => {
            const hinge = new THREE.Mesh(hingeGeo, darkMetalMat);
            hinge.position.set(dirX * 0.02, yPos, isFront ? 0.055 : -0.055);
            hinge.userData.noShadowCast = true;
            group.add(hinge);
        });

        [-1, 1].forEach(sideZ => {
            const plate = new THREE.Mesh(plateGeo, brassMat);
            plate.position.set(dirX * 1.72, -0.04, sideZ * 0.055);
            plate.userData.noShadowCast = true;
            group.add(plate);

            const keyhole = new THREE.Mesh(keyholeGeo, darkMetalMat);
            keyhole.position.set(dirX * 1.72, -0.105, sideZ * 0.058);
            keyhole.userData.noShadowCast = true;
            group.add(keyhole);

            const neck = new THREE.Mesh(neckGeo, brassMat);
            neck.rotation.x = Math.PI / 2;
            neck.position.set(dirX * 1.72, 0.02, sideZ * 0.08);
            neck.userData.noShadowCast = true;
            group.add(neck);

            const lever = new THREE.Mesh(leverGeo, brassMat);
            lever.position.set(dirX * 1.655, 0.02, sideZ * 0.11);
            lever.userData.noShadowCast = true;
            group.add(lever);

            const knob = new THREE.Mesh(knobGeo, brassMat);
            knob.position.set(dirX * 1.72, 0.02, sideZ * 0.11);
            knob.userData.noShadowCast = true;
            group.add(knob);
        });
    };

    frontDoorGroup = new THREE.Group();
    frontDoorMesh = new THREE.Mesh(doorGeo, frontDoorMat);
    frontDoorMesh.position.set(1, 0, 0);
    frontDoorGroup.add(frontDoorMesh);
    buildDoorDetails(frontDoorGroup, 1, true);
    frontDoorGroup.position.set(-1, 1.75, -25);
    scene.add(frontDoorGroup);

    backDoorGroup = new THREE.Group();
    backDoorMesh = new THREE.Mesh(doorGeo, backDoorMat);
    backDoorMesh.position.set(-1, 0, 0);
    backDoorGroup.add(backDoorMesh);
    buildDoorDetails(backDoorGroup, -1, false);
    backDoorGroup.position.set(1, 1.75, 11);
    scene.add(backDoorGroup);

    const jambGeo = new THREE.BoxGeometry(0.16, 3.65, 0.22);
    const headerGeo = new THREE.BoxGeometry(2.34, 0.18, 0.24);
    const thresholdGeo = new THREE.BoxGeometry(2.08, 0.03, 0.28);

    [-25, 11].forEach(zPos => {
        [-1.08, 1.08].forEach(xPos => {
            const jamb = new THREE.Mesh(jambGeo, doorFrameMat);
            jamb.position.set(xPos, 1.825, zPos);
            scene.add(jamb);
        });
        const header = new THREE.Mesh(headerGeo, doorFrameMat);
        header.position.set(0, 3.59, zPos);
        scene.add(header);

        const threshold = new THREE.Mesh(thresholdGeo, darkMetalMat);
        threshold.position.set(0, 0.015, zPos);
        threshold.userData.noShadowCast = true;
        scene.add(threshold);
    });

    const exitTex = (() => {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#092412';
        g.fillRect(0, 0, 256, 128);
        const gr = g.createRadialGradient(128, 64, 15, 128, 64, 130);
        gr.addColorStop(0, 'rgba(70,220,120,0.4)');
        gr.addColorStop(1, 'rgba(5,20,10,0.95)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 256, 128);
        g.strokeStyle = '#3d995c';
        g.lineWidth = 6;
        g.strokeRect(8, 8, 240, 112);
        g.fillStyle = '#7dffab';
        g.font = 'bold 60px monospace';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('EXIT', 128, 66);
        g.fillStyle = 'rgba(15,12,8,0.48)';
        for (let i = 0; i < 9; i++) {
            g.fillRect(Math.random() * 240, Math.random() * 116, 12 + Math.random() * 28, 4 + Math.random() * 14);
        }
        return markSRGB(new THREE.CanvasTexture(c));
    })();
    const exitBoxGeo = makeBevelBox(0.72, 0.32, 0.09, 0.012);
    const exitFaceGeo = new THREE.PlaneGeometry(0.64, 0.25);
    const exitRodGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.14, Math.min(QUALITY.segs, 10));
    const exitCaseMat = new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.7, metalness: 0.5 });
    const exitFaceMat = new THREE.MeshStandardMaterial({
        map: exitTex,
        emissiveMap: exitTex,
        emissive: 0x44cc77,
        emissiveIntensity: 0.48,
        roughness: 0.45
    });

    [[-24.92, 0], [10.92, Math.PI]].forEach(cfg => {
        const box = new THREE.Mesh(exitBoxGeo, exitCaseMat);
        box.position.set(0, 3.78, cfg[0]);
        box.userData.noShadowCast = true;
        scene.add(box);

        const face = new THREE.Mesh(exitFaceGeo, exitFaceMat);
        face.rotation.y = cfg[1];
        face.position.set(0, 3.78, cfg[0] + (cfg[1] === 0 ? 0.047 : -0.047));
        face.userData.noShadowCast = true;
        scene.add(face);

        [-0.22, 0.22].forEach(rx => {
            const rod = new THREE.Mesh(exitRodGeo, exitCaseMat);
            rod.position.set(rx, 3.96, cfg[0]);
            rod.userData.noShadowCast = true;
            scene.add(rod);
        });
    });
}
function createDecorations() {
    const lampPositions = [7, 0, -7, -14, -21];
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x26282a, metalness: 0.68, roughness: 0.55 });
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0x222426, metalness: 0.65, roughness: 0.58, side: THREE.DoubleSide });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.9 });

    const smallSeg = Math.min(QUALITY.segs, 10);
    const plateGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.04, QUALITY.segs);
    const stemGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.08, smallSeg);
    const hoodGeo = new THREE.CylinderGeometry(0.30, 0.48, 0.12, QUALITY.segs, 1, true);
    const rimGeo = new THREE.TorusGeometry(0.47, 0.02, 6, QUALITY.segs);
    const cageGeo = new THREE.BoxGeometry(0.76, 0.014, 0.016);
    const wireGeo = new THREE.CylinderGeometry(0.011, 0.011, 1.82, smallSeg);
    const bulbGeo = new THREE.CylinderGeometry(0.28, 0.39, 0.09, QUALITY.segs);

    lampPositions.forEach((zPos, idx) => {
        const plate = new THREE.Mesh(plateGeo, housingMat);
        plate.position.set(0, 3.98, zPos);
        plate.userData.noShadowCast = true;
        scene.add(plate);

        const stem = new THREE.Mesh(stemGeo, housingMat);
        stem.position.set(0, 3.95, zPos);
        stem.userData.noShadowCast = true;
        scene.add(stem);

        const hood = new THREE.Mesh(hoodGeo, hoodMat);
        hood.position.set(0, 3.90, zPos);
        hood.userData.noShadowCast = true;
        scene.add(hood);

        const rim = new THREE.Mesh(rimGeo, housingMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(0, 3.845, zPos);
        rim.userData.noShadowCast = true;
        scene.add(rim);

        for (let c = 0; c < 2; c++) {
            const cage = new THREE.Mesh(cageGeo, housingMat);
            cage.position.set(0, 3.835, zPos);
            cage.rotation.y = c * (Math.PI / 2);
            cage.userData.noShadowCast = true;
            scene.add(cage);
        }

        const wire = new THREE.Mesh(wireGeo, cableMat);
        wire.rotation.z = Math.PI / 2;
        wire.position.set(idx % 2 === 0 ? -0.92 : 0.92, 3.985, zPos);
        wire.userData.noShadowCast = true;
        scene.add(wire);

        const lampMat = new THREE.MeshStandardMaterial({
            color: 0xd8d2c0,
            emissive: 0xffeedd,
            emissiveIntensity: 0.8,
            roughness: 0.6
        });
        const lampMesh = new THREE.Mesh(bulbGeo, lampMat);
        lampMesh.position.set(0, 3.89, zPos);
        scene.add(lampMesh);
        lampMeshes.push(lampMesh);

        const light = new THREE.PointLight(0xffeedd, 0.6, 9);
        light.position.set(0, 3.7, zPos);
        scene.add(light);
        ceilingLights.push(light);
    });

    const signGeo = new THREE.PlaneGeometry(1.2, 0.6);
    const signMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    stageSignMesh = new THREE.Mesh(signGeo, signMat);
    stageSignMesh.position.set(-1.94, 2.5, -4);
    stageSignMesh.rotation.y = Math.PI / 2;
    scene.add(stageSignMesh);
    updateStageSign(false);

    const makePaintingTex = (variant) => {
        const c = document.createElement('canvas');
        c.width = 192; c.height = 256;
        const g = c.getContext('2d');
        const bg = g.createLinearGradient(0, 0, 0, 256);
        bg.addColorStop(0, variant === 0 ? '#8c9487' : '#9c8b78');
        bg.addColorStop(0.65, variant === 0 ? '#4d5448' : '#574636');
        bg.addColorStop(1, '#262420');
        g.fillStyle = bg;
        g.fillRect(0, 0, 192, 256);
        g.fillStyle = 'rgba(25,22,18,0.62)';
        if (variant === 0) {
            g.beginPath(); g.arc(96, 108, 30, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(96, 225, 68, 86, 0, Math.PI, Math.PI * 2); g.fill();
        } else {
            g.fillRect(28, 80, 18, 176);
            g.fillRect(140, 62, 24, 194);
            g.beginPath(); g.arc(95, 72, 20, 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = 'rgba(30,22,14,0.35)';
        g.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
            g.beginPath();
            const x = Math.random() * 192, y = Math.random() * 256;
            g.moveTo(x, y);
            g.lineTo(x + (Math.random() - 0.5) * 40, y + 18 + Math.random() * 40);
            g.stroke();
        }
        const vig = g.createRadialGradient(96, 128, 35, 96, 128, 150);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(15,12,8,0.72)');
        g.fillStyle = vig;
        g.fillRect(0, 0, 192, 256);
        return markSRGB(new THREE.CanvasTexture(c));
    };

    const outerFrameMat = new THREE.MeshStandardMaterial({ color: 0x26150a, roughness: 0.72, metalness: 0.12 });
    const innerGoldMat = new THREE.MeshStandardMaterial({ color: 0x4c3a20, roughness: 0.54, metalness: 0.45 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xd0dadc,
        transparent: true,
        opacity: 0.15,
        roughness: 0.06,
        metalness: 0.7,
        depthWrite: false
    });

    const frameBackGeo = makeBevelBox(0.08, 1.44, 1.04, 0.012);
    const canvasGeo = new THREE.PlaneGeometry(0.85, 1.25);
    const railVGeo = makeBevelBox(0.055, 1.46, 0.085, 0.01);
    const railHGeo = makeBevelBox(0.055, 0.085, 1.06, 0.01);
    const innerVGeo = new THREE.BoxGeometry(0.04, 1.29, 0.032);
    const innerHGeo = new THREE.BoxGeometry(0.04, 0.032, 0.89);
    const cornerBossGeo = new THREE.BoxGeometry(0.068, 0.115, 0.115);
    const glassGeo = new THREE.PlaneGeometry(0.86, 1.26);

    const paintingData = [
        { z: -10, color: 0x3b5e2b },
        { z: -18, color: 0x5c3a21 }
    ];

    paintingData.forEach((data, index) => {
        const paintingGroup = new THREE.Group();
        const frame = new THREE.Mesh(frameBackGeo, outerFrameMat);
        paintingGroup.add(frame);

        const canvasMat = new THREE.MeshStandardMaterial({
            color: data.color,
            map: makePaintingTex(index),
            roughness: 0.78
        });
        const canvas = new THREE.Mesh(canvasGeo, canvasMat);
        canvas.rotation.y = Math.PI / 2;
        canvas.position.x = 0.045;
        paintingGroup.add(canvas);

        [-0.485, 0.485].forEach(zp => {
            const rV = new THREE.Mesh(railVGeo, outerFrameMat);
            rV.position.set(0.052, 0, zp);
            rV.userData.noShadowCast = true;
            paintingGroup.add(rV);
        });
        [-0.685, 0.685].forEach(yp => {
            const rH = new THREE.Mesh(railHGeo, outerFrameMat);
            rH.position.set(0.052, yp, 0);
            rH.userData.noShadowCast = true;
            paintingGroup.add(rH);
        });
        [-0.435, 0.435].forEach(zp => {
            const iV = new THREE.Mesh(innerVGeo, innerGoldMat);
            iV.position.set(0.054, 0, zp);
            iV.userData.noShadowCast = true;
            paintingGroup.add(iV);
        });
        [-0.635, 0.635].forEach(yp => {
            const iH = new THREE.Mesh(innerHGeo, innerGoldMat);
            iH.position.set(0.054, yp, 0);
            iH.userData.noShadowCast = true;
            paintingGroup.add(iH);
        });
        [-0.68, 0.68].forEach(yp => {
            [-0.48, 0.48].forEach(zp => {
                const boss = new THREE.Mesh(cornerBossGeo, innerGoldMat);
                boss.position.set(0.056, yp, zp);
                boss.userData.noShadowCast = true;
                paintingGroup.add(boss);
            });
        });

        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.rotation.y = Math.PI / 2;
        glass.position.x = 0.062;
        glass.userData.noShadowCast = true;
        glass.userData.noReceiveShadow = true;
        paintingGroup.add(glass);

        paintingGroup.position.set(-1.95, 2.0, data.z);
        scene.add(paintingGroup);

        if (index === 0) {
            specialPainting = paintingGroup;
            specialPaintingCanvas = canvas;
        }
    });

    const potProfile = [
        [0.00, 0.00], [0.17, 0.00], [0.22, 0.36], [0.245, 0.37],
        [0.255, 0.44], [0.23, 0.45], [0.215, 0.41], [0.00, 0.41]
    ].map(p => new THREE.Vector2(p[0], p[1]));
    const potGeo = new THREE.LatheGeometry(potProfile, QUALITY.segs);
    const potMat = new THREE.MeshStandardMaterial({ color: 0x6b3518, roughness: 0.86 });
    const soilGeo = new THREE.CylinderGeometry(0.21, 0.20, 0.05, QUALITY.segs);
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x1b140e, roughness: 1.0 });

    const makeCurvedLeafGeo = (w, len, bend, kink) => {
        const g = new THREE.PlaneGeometry(w, len, 2, 6);
        g.translate(0, len * 0.5, 0);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const t = y / len;
            const taper = Math.sin(Math.pow(t, 0.72) * Math.PI);
            let zBend = t * t * bend;
            let yCurved = y - t * t * (bend * 0.28);
            if (kink && t > 0.52) {
                const kt = t - 0.52;
                zBend += kt * 0.55;
                yCurved -= kt * 0.32;
            }
            pos.setXYZ(i, x * (0.25 + 0.9 * taper), yCurved, zBend);
        }
        g.computeVertexNormals();
        return g;
    };

    const leafHealthyGeo = makeCurvedLeafGeo(0.14, 0.56, 0.22, false);
    const leafDroopGeo = makeCurvedLeafGeo(0.13, 0.62, 0.36, false);
    const leafBrokenGeo = makeCurvedLeafGeo(0.12, 0.54, 0.26, true);
    const spikeGeo = new THREE.ConeGeometry(0.05, 0.52, 5);
    spikeGeo.translate(0, 0.26, 0);
    const plantStemGeo = new THREE.CylinderGeometry(0.011, 0.018, 0.28, Math.min(QUALITY.segs, 8));
    plantStemGeo.translate(0, 0.14, 0);

    const leafMatDark = new THREE.MeshStandardMaterial({ color: 0x1b4628, roughness: 0.78, side: THREE.DoubleSide });
    const leafMatMid = new THREE.MeshStandardMaterial({ color: 0x25532f, roughness: 0.75, side: THREE.DoubleSide });
    const leafMatDry = new THREE.MeshStandardMaterial({ color: 0x453e20, roughness: 0.92, side: THREE.DoubleSide });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2a351e, roughness: 0.9 });

    function createPlant(x, z) {
        const plantGroup = new THREE.Group();
        const pot = new THREE.Mesh(potGeo, potMat);
        plantGroup.add(pot);

        const soil = new THREE.Mesh(soilGeo, soilMat);
        soil.position.y = 0.40;
        soil.userData.noShadowCast = true;
        plantGroup.add(soil);

        for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2 + 0.3;
            const stem = new THREE.Mesh(plantStemGeo, stemMat);
            stem.position.set(Math.cos(ang) * 0.04, 0.41, Math.sin(ang) * 0.04);
            stem.rotation.z = (Math.random() - 0.5) * 0.45;
            stem.rotation.x = (Math.random() - 0.5) * 0.45;
            stem.userData.noShadowCast = true;
            plantGroup.add(stem);

            const spike = new THREE.Mesh(spikeGeo, leafMatMid);
            spike.position.set(Math.cos(ang) * 0.03, 0.43, Math.sin(ang) * 0.03);
            spike.rotation.y = ang;
            spike.rotation.x = 0.15 + Math.random() * 0.25;
            spike.userData.noShadowCast = true;
            plantGroup.add(spike);
        }

        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
            const isBroken = i === 2 || i === 6;
            const geo = isBroken ? leafBrokenGeo : (i % 2 === 0 ? leafDroopGeo : leafHealthyGeo);
            const mat = isBroken ? leafMatDry : (i % 2 === 0 ? leafMatDark : leafMatMid);
            const leaf = new THREE.Mesh(geo, mat);
            leaf.position.set(Math.cos(ang) * 0.05, 0.43 + (i % 2) * 0.03, Math.sin(ang) * 0.05);
            leaf.rotation.y = ang;
            leaf.rotation.x = isBroken ? 0.62 : (0.28 + Math.random() * 0.28);
            leaf.userData.noShadowCast = true;
            plantGroup.add(leaf);
        }

        const fallen = new THREE.Mesh(leafBrokenGeo, leafMatDry);
        fallen.position.set(-0.24, 0.018, 0.16);
        fallen.rotation.x = Math.PI / 2 - 0.05;
        fallen.rotation.z = 0.9;
        fallen.scale.setScalar(0.65);
        fallen.userData.noShadowCast = true;
        plantGroup.add(fallen);

        plantGroup.position.set(x, 0, z);
        scene.add(plantGroup);
        return plantGroup;
    }

    specialPlant = createPlant(1.55, -5);
    specialPlantCollider = { x: 1.55, z: -5, r: 0.28 };
    colliders.push(specialPlantCollider);

    createPlant(-1.55, -14);
    colliders.push({ x: -1.55, z: -14, r: 0.28 });

    createPlant(1.55, -22);
    colliders.push({ x: 1.55, z: -22, r: 0.28 });
}

function makeNewsprintTexture(headlineIdx) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 192;
    const g = c.getContext('2d');
    const widths = [];
    for (let i = 0; i < 33; i++) widths.push(50 + Math.random() * 20);
    const draw = () => {
        g.fillStyle = '#c9c2ad'; g.fillRect(0, 0, 256, 192);
        g.fillStyle = '#222';
        g.font = 'bold 26px serif';
        g.textAlign = 'center';
        g.fillText(t('news.' + headlineIdx), 128, 34);
        g.fillRect(14, 44, 228, 3);
        for (let col = 0; col < 3; col++) {
            for (let row = 0; row < 11; row++) {
                g.fillRect(16 + col * 76, 58 + row * 11, widths[col * 11 + row], 3);
            }
        }
        g.fillStyle = '#777'; g.fillRect(16, 100, 66, 44);
    };
    draw();
    const tex = markSRGB(new THREE.CanvasTexture(c));
    registerLocalizedTexture(() => { draw(); tex.needsUpdate = true; });
    return tex;
}

function createClutter() {
    const rnd = (a, b) => a + Math.random() * (b - a);

    const metal = new THREE.MeshStandardMaterial({ color: 0x4a4d4f, metalness: 0.7, roughness: 0.55 });
    const bin = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.8, QUALITY.segs, 1, true), metal);
    body.material.side = THREE.DoubleSide;
    body.position.y = 0.4;
    bin.add(body);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.25, 16), metal);
    bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.02;
    bin.add(bottom);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 20), metal);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.8;
    bin.add(rim);
    for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.285 - i * 0.012, 0.012, 6, 20), metal);
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.2 + i * 0.28;
        bin.add(ring);
    }
    const trashMat = new THREE.MeshStandardMaterial({ color: 0x2b2b26, roughness: 1 });
    for (let i = 0; i < 4; i++) {
        const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(rnd(0.1, 0.16), 0), trashMat);
        lump.position.set(rnd(-0.12, 0.12), 0.72 + rnd(0, 0.06), rnd(-0.12, 0.12));
        bin.add(lump);
    }
    bin.position.set(1.62, 0, -24.3);
    scene.add(bin);
    colliders.push({ x: 1.62, z: -24.3, r: 0.3 });

    const bucket = new THREE.Group();
    const bMat = new THREE.MeshStandardMaterial({ color: 0x7d8286, metalness: 0.85, roughness: 0.4, side: THREE.DoubleSide });
    const bBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.34, QUALITY.segs, 1, true), bMat);
    bBody.position.y = 0.17;
    bucket.add(bBody);
    const bBot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), bMat);
    bBot.rotation.x = -Math.PI / 2; bBot.position.y = 0.01;
    bucket.add(bBot);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 6, 16, Math.PI), bMat);
    handle.position.y = 0.34; handle.rotation.y = 0.3;
    bucket.add(handle);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14),
        new THREE.MeshStandardMaterial({ color: 0x0a0f0a, roughness: 0.1, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.24;
    bucket.add(water);
    bucket.position.set(-1.66, 0, 3);
    scene.add(bucket);
    colliders.push({ x: -1.66, z: 3, r: 0.23 });

    const profile = [[0, 0], [0.05, 0], [0.055, 0.02], [0.055, 0.17], [0.045, 0.21],
        [0.022, 0.26], [0.02, 0.32], [0.026, 0.33], [0.026, 0.34], [0, 0.34]]
        .map(p => new THREE.Vector2(p[0], p[1]));
    const bottleGeo = new THREE.LatheGeometry(profile, QUALITY.segs);
    const glassColors = [0x2f5a3a, 0x5a3a1a, 0xbfd8d8, 0x2f5a3a, 0x5a3a1a];
    const bottles = [
        [-1.4, -8.5, true], [-1.1, -9.2, false], [-1.75, -9.7, true],
        [1.5, -16.2, true], [1.2, -17.0, false], [1.75, -17.4, true],
        [0.3, -12.5, true], [1.3, 5.5, true], [-0.9, -3.2, false]
    ];
    bottles.forEach((b, i) => {
        const mat = new THREE.MeshStandardMaterial({
            color: glassColors[i % glassColors.length],
            transparent: true, opacity: 0.6, roughness: 0.08, metalness: 0.1
        });
        const m = new THREE.Mesh(bottleGeo, mat);
        if (b[2]) {
            m.rotation.z = Math.PI / 2;
            m.rotation.y = rnd(0, Math.PI * 2);
            m.position.set(b[0], 0.055, b[1]);
        } else {
            m.position.set(b[0], 0, b[1]);
        }
        scene.add(m);
    });

    const sideTex = (() => {
        const c = document.createElement('canvas'); c.width = 8; c.height = 64;
        const g = c.getContext('2d');
        for (let y = 0; y < 64; y += 2) { g.fillStyle = y % 4 ? '#b8b09a' : '#8f8873'; g.fillRect(0, y, 8, 2); }
        return markSRGB(new THREE.CanvasTexture(c));
    })();
    const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 1 });
    const paperPileGeo = makeBevelBox(0.5, 0.07, 0.36, 0.008);
    const pileX = 1.62, pileZ = -12.0;
    for (let i = 0; i < 6; i++) {
        const topMat = new THREE.MeshStandardMaterial({ map: makeNewsprintTexture(i % 4), roughness: 1 });
        const sheet = new THREE.Mesh(paperPileGeo,
            [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
        sheet.position.set(pileX + rnd(-0.03, 0.03), 0.035 + i * 0.07, pileZ + rnd(-0.04, 0.04));
        sheet.rotation.y = rnd(-0.3, 0.3) + Math.PI / 2;
        scene.add(sheet);
    }
    colliders.push({ x: pileX, z: pileZ, r: 0.28 });

    [[0.7, -19.5], [-1.2, -2.0], [-0.2, 6.5]].forEach((p, i) => {
        const mat = new THREE.MeshStandardMaterial({
            map: makeNewsprintTexture((i + 1) % 4), roughness: 1, side: THREE.DoubleSide
        });
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.34), mat);
        sheet.rotation.x = -Math.PI / 2;
        sheet.rotation.z = rnd(0, Math.PI * 2);
        sheet.position.set(p[0], 0.008 + i * 0.002, p[1]);
        scene.add(sheet);
    });
}
function createWallDetails() {
    const rnd = (a, b) => a + Math.random() * (b - a);
    const L = -1.985, R = 1.985;
    const faceY = x => (x < 0 ? Math.PI / 2 : -Math.PI / 2);

    function decal(tex, w, h, x, y, z, opts) {
        const mat = new THREE.MeshStandardMaterial(Object.assign({
            map: tex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
        }, opts));
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        m.position.set(x, y, z);
        m.rotation.y = faceY(x);
        m.rotation.z = rnd(-0.04, 0.04);
        m.userData.noShadowCast = true;
        scene.add(m);
        return m;
    }

    function stainTexture() {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d');
        for (let i = 0; i < 5; i++) {
            const x = rnd(100, 156), y = rnd(90, 150), r = rnd(40, 80);
            const gr = g.createRadialGradient(x, y, 2, x, y, r);
            gr.addColorStop(0, 'rgba(50,38,18,0.5)');
            gr.addColorStop(0.6, 'rgba(60,48,25,0.25)');
            gr.addColorStop(1, 'rgba(60,48,25,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        }
        for (let i = 0; i < 4; i++) {
            const x = rnd(100, 156), len = rnd(60, 120);
            const gr = g.createLinearGradient(0, 100, 0, 100 + len);
            gr.addColorStop(0, 'rgba(45,35,15,0.35)');
            gr.addColorStop(1, 'rgba(45,35,15,0)');
            g.fillStyle = gr; g.fillRect(x, 100, rnd(3, 7), len);
        }
        return markSRGB(new THREE.CanvasTexture(c));
    }
    [[R, 3.1, -19, 1.3, 1.6], [R, 2.9, 5, 1.0, 1.2], [R, 0.8, -12.5, 0.9, 1.1],
     [L, 1.2, -13.5, 0.9, 1.1], [L, 3.0, -1, 1.1, 1.3]].forEach(d => {
        decal(stainTexture(), d[3], d[4], d[0], d[1], d[2], { transparent: true, depthWrite: false });
    });

    function bloodSmearTexture(kind) {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d');
        for (let i = 0; i < 5; i++) {
            const x = 60 + i * 26 + rnd(-6, 6);
            const y0 = 35 + rnd(0, 25);
            const len = 95 + rnd(20, 90);
            const gr = g.createLinearGradient(x, y0, x + rnd(-12, 12), y0 + len);
            gr.addColorStop(0, kind === 0 ? 'rgba(46,9,8,0.65)' : 'rgba(38,8,7,0.52)');
            gr.addColorStop(0.55, 'rgba(32,7,7,0.34)');
            gr.addColorStop(1, 'rgba(28,6,6,0)');
            g.strokeStyle = gr;
            g.lineWidth = rnd(6, 15);
            g.lineCap = 'round';
            g.beginPath();
            g.moveTo(x, y0);
            g.quadraticCurveTo(x + rnd(-14, 14), y0 + len * 0.5, x + rnd(-18, 18), y0 + len);
            g.stroke();
        }
        for (let k = 0; k < 18; k++) {
            g.fillStyle = 'rgba(42,8,8,' + rnd(0.2, 0.5) + ')';
            g.beginPath();
            g.arc(rnd(40, 215), rnd(35, 215), rnd(2, 8), 0, Math.PI * 2);
            g.fill();
        }
        return markSRGB(new THREE.CanvasTexture(c));
    }
    decal(bloodSmearTexture(0), 0.72, 0.85, L + 0.008, 1.25, -6.9, { transparent: true, depthWrite: false });
    decal(bloodSmearTexture(1), 0.95, 0.72, R - 0.008, 0.65, -20.8, { transparent: true, depthWrite: false });
    decal(bloodSmearTexture(0), 0.65, 0.78, R - 0.008, 1.45, -13.1, { transparent: true, depthWrite: false });

    function writingTexture(textKey, tally) {
        const c = document.createElement('canvas'); c.width = 256; c.height = 192;
        const g = c.getContext('2d');
        const rot = rnd(-0.07, 0.07);
        const jit = []; for (let i = 0; i < 8; i++) jit.push(rnd(-2, 2));
        const draw = () => {
            g.clearRect(0, 0, 256, 192);
            const text = t(textKey);
            g.save();
            g.translate(128, 72);
            g.rotate(rot);
            let fs = 26;
            g.font = 'bold ' + fs + 'px monospace';
            while (g.measureText(text).width > 236 && fs > 12) { fs--; g.font = 'bold ' + fs + 'px monospace'; }
            g.textAlign = 'center';
            g.fillStyle = 'rgba(22,14,12,0.72)';
            g.fillText(text, 0, 0);
            g.fillStyle = 'rgba(40,10,9,0.45)';
            g.fillText(text, 2, 2);
            g.restore();
            if (tally) {
                g.strokeStyle = 'rgba(28,18,16,0.68)';
                g.lineWidth = 3;
                for (let b = 0; b < 2; b++) {
                    const bx = 54 + b * 82;
                    for (let s = 0; s < 4; s++) {
                        g.beginPath();
                        g.moveTo(bx + s * 13, 118);
                        g.lineTo(bx + s * 13 + jit[b * 4 + s], 160);
                        g.stroke();
                    }
                    g.beginPath();
                    g.moveTo(bx - 6, 152);
                    g.lineTo(bx + 46, 124);
                    g.stroke();
                }
            }
        };
        draw();
        const tex = markSRGB(new THREE.CanvasTexture(c));
        registerLocalizedTexture(() => { draw(); tex.needsUpdate = true; });
        return tex;
    }
    decal(writingTexture('writing.lookback', false), 1.05, 0.75, L + 0.008, 1.62, -16.5, { transparent: true, depthWrite: false });
    decal(writingTexture('writing.noexit', true), 0.95, 0.75, R - 0.008, 1.48, -2.5, { transparent: true, depthWrite: false });
    decal(writingTexture('writing.return', true), 0.95, 0.75, L + 0.008, 1.32, 6.2, { transparent: true, depthWrite: false });

    function posterTexture(kind) {
        const c = document.createElement('canvas'); c.width = 200; c.height = 280;
        const g = c.getContext('2d');
        g.beginPath();
        g.moveTo(0, 0); g.lineTo(200, 0); g.lineTo(200, 230); g.lineTo(165, 252);
        g.lineTo(178, 280); g.lineTo(0, 280); g.closePath();
        g.fillStyle = '#b3a784'; g.fill();
        g.save(); g.clip();
        const v = g.createRadialGradient(100, 140, 60, 100, 140, 190);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,40,10,0.6)');
        g.fillStyle = v; g.fillRect(0, 0, 200, 280);
        if (kind === 0) {
            g.fillStyle = '#5f5a4c'; g.fillRect(20, 25, 160, 190);
            g.fillStyle = '#2e2b24';
            g.beginPath(); g.arc(100, 95, 32, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(100, 215, 62, 55, 0, Math.PI, Math.PI * 2); g.fill();
            g.fillStyle = '#6d6451'; g.fillRect(30, 232, 110, 5); g.fillRect(30, 246, 80, 5);
        } else {
            g.fillStyle = '#4a4436'; g.fillRect(20, 24, 160, 34);
            for (let i = 0; i < 12; i++) g.fillRect(20, 78 + i * 15, 100 + Math.random() * 60, 4);
        }
        g.restore();
        g.fillStyle = 'rgba(200,185,140,0.75)';
        g.save(); g.translate(18, 8); g.rotate(-0.6); g.fillRect(-22, -7, 44, 14); g.restore();
        g.save(); g.translate(182, 8); g.rotate(0.6); g.fillRect(-22, -7, 44, 14); g.restore();
        return markSRGB(new THREE.CanvasTexture(c));
    }
    poster0NormalTex = posterTexture(0);
    poster0Mesh = decal(poster0NormalTex, 0.5, 0.7, R - 0.005, 1.8, -15, { alphaTest: 0.5 });
    decal(posterTexture(1), 0.5, 0.7, L + 0.005, 1.75, -22, { alphaTest: 0.5 });

    const socketTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#9a9380'; g.fillRect(0, 0, 128, 128);
        g.strokeStyle = '#4a453b'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
        const gr = g.createRadialGradient(64, 64, 10, 64, 64, 52);
        gr.addColorStop(0, 'rgba(20,16,12,0.52)'); gr.addColorStop(1, 'rgba(20,16,12,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        g.fillStyle = '#6f695a';
        g.beginPath(); g.arc(64, 64, 34, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111';
        g.beginPath(); g.arc(48, 64, 7, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(80, 64, 7, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3c3832';
        g.beginPath(); g.arc(64, 64, 3, 0, Math.PI * 2); g.fill();
        return markSRGB(new THREE.CanvasTexture(c));
    })();
    const socketGeo = new THREE.BoxGeometry(0.02, 0.12, 0.12);
    const socketMat = new THREE.MeshStandardMaterial({ map: socketTex, roughness: 0.75 });
    [[R - 0.005, 0.36, 4.5], [L + 0.005, 0.36, -11.5], [R - 0.005, 0.36, -20.5]].forEach(p => {
        const s = new THREE.Mesh(socketGeo, socketMat);
        s.position.set(p[0], p[1], p[2]);
        s.rotation.y = faceY(p[0]);
        s.rotation.z = Math.PI / 2;
        s.userData.noShadowCast = true;
        scene.add(s);
    });

    const swBaseGeo = new THREE.BoxGeometry(0.022, 0.13, 0.095);
    const swRockGeo = new THREE.BoxGeometry(0.028, 0.045, 0.036);
    const swMat = new THREE.MeshStandardMaterial({ color: 0x9b947f, roughness: 0.72 });
    const swRockMat = new THREE.MeshStandardMaterial({ color: 0x7a7361, roughness: 0.65 });
    [[L + 0.01, 1.32, 9.6], [R - 0.01, 1.32, -23.7], [L + 0.01, 1.32, -3.2]].forEach((p, idx) => {
        const base = new THREE.Mesh(swBaseGeo, swMat);
        base.position.set(p[0], p[1], p[2]);
        base.userData.noShadowCast = true;
        scene.add(base);

        const rock = new THREE.Mesh(swRockGeo, swRockMat);
        rock.position.set(p[0] + (p[0] < 0 ? 0.012 : -0.012), p[1], p[2]);
        rock.rotation.z = idx % 2 === 0 ? 0.32 : -0.32;
        rock.userData.noShadowCast = true;
        scene.add(rock);
    });

    const camBodyMat = new THREE.MeshStandardMaterial({ color: 0x6c6b64, roughness: 0.68, metalness: 0.25 });
    const camDarkMat = new THREE.MeshStandardMaterial({ color: 0x161719, roughness: 0.5, metalness: 0.6 });
    const camLedMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xaa0000, emissiveIntensity: 0.8 });
    const camArmGeo = new THREE.BoxGeometry(0.04, 0.04, 0.24);
    const camMountGeo = new THREE.BoxGeometry(0.11, 0.11, 0.03);
    const smallSeg = Math.min(QUALITY.segs, 10);
    const camHousingGeo = makeBevelBox(0.12, 0.11, 0.28, 0.01);
    const camVisorGeo = new THREE.BoxGeometry(0.135, 0.02, 0.32);
    const camLensGeo = new THREE.CylinderGeometry(0.038, 0.042, 0.06, smallSeg);
    const camLedGeo = new THREE.SphereGeometry(0.01, smallSeg, smallSeg);

    function createSecurityCamera(x, y, z, yaw, pitch) {
        const mount = new THREE.Mesh(camMountGeo, camDarkMat);
        mount.position.set(x > 0 ? 1.98 : -1.98, y, z);
        mount.rotation.y = faceY(x);
        mount.userData.noShadowCast = true;
        scene.add(mount);

        const camRig = new THREE.Group();
        const arm = new THREE.Mesh(camArmGeo, camDarkMat);
        arm.position.set(0, 0.02, -0.1);
        camRig.add(arm);

        const head = new THREE.Group();
        const housing = new THREE.Mesh(camHousingGeo, camBodyMat);
        head.add(housing);

        const visor = new THREE.Mesh(camVisorGeo, camBodyMat);
        visor.position.set(0, 0.058, 0.02);
        visor.userData.noShadowCast = true;
        head.add(visor);

        const lens = new THREE.Mesh(camLensGeo, camDarkMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, -0.005, 0.155);
        lens.userData.noShadowCast = true;
        head.add(lens);

        const led = new THREE.Mesh(camLedGeo, camLedMat);
        led.position.set(0.036, 0.028, 0.142);
        led.userData.noShadowCast = true;
        head.add(led);

        head.rotation.x = pitch;
        camRig.add(head);
        camRig.position.set(x, y, z);
        camRig.rotation.y = yaw;
        scene.add(camRig);
    }
    createSecurityCamera(1.80, 3.45, -23.2, -0.45, 0.35);
    createSecurityCamera(-1.80, 3.45, 8.8, 2.68, 0.35);

    const copper = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.4 });
    const wireTipGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.03, smallSeg);
    function wire(x, y, z, s, drop, color, jz) {
        const pts = [
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(x + s * 0.07, y + 0.02, z + jz * 0.3),
            new THREE.Vector3(x + s * 0.14, y - drop * 0.4, z + jz * 0.7),
            new THREE.Vector3(x + s * 0.17, y - drop, z + jz)
        ];
        scene.add(new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.009, 6, false),
            new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 })));
        const tip = new THREE.Mesh(wireTipGeo, copper);
        tip.position.set(pts[3].x, pts[3].y - 0.01, pts[3].z);
        tip.userData.noShadowCast = true;
        scene.add(tip);
    }

    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    hole.position.set(-1.985, 1.3, -6.5);
    hole.rotation.y = Math.PI / 2;
    scene.add(hole);
    wire(-1.98, 1.33, -6.54, 1, 0.35, 0x111111, -0.06);
    wire(-1.98, 1.30, -6.50, 1, 0.60, 0x8a1212, 0.03);
    wire(-1.98, 1.27, -6.45, 1, 0.20, 0xb59b1c, 0.08);

    const eb = new THREE.Group();
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x5d6266, metalness: 0.5, roughness: 0.6 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x6b7075, metalness: 0.5, roughness: 0.55 });
    eb.add(new THREE.Mesh(makeBevelBox(0.1, 0.5, 0.34, 0.012), boxMat));
    const ebDoor = new THREE.Mesh(makeBevelBox(0.02, 0.46, 0.30, 0.004), doorMat);
    ebDoor.position.x = -0.06;
    eb.add(ebDoor);
    const ebHandle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 }));
    ebHandle.position.set(-0.085, 0, 0.11);
    ebHandle.userData.noShadowCast = true;
    eb.add(ebHandle);
    const lc = document.createElement('canvas'); lc.width = lc.height = 64;
    const lg = lc.getContext('2d');
    lg.fillStyle = '#d8b800'; lg.fillRect(0, 0, 64, 64);
    lg.fillStyle = '#111';
    lg.beginPath(); lg.moveTo(32, 8); lg.lineTo(58, 54); lg.lineTo(6, 54); lg.closePath(); lg.fill();
    lg.fillStyle = '#d8b800'; lg.font = 'bold 30px monospace'; lg.textAlign = 'center';
    lg.fillText('!', 32, 48);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshStandardMaterial({ map: markSRGB(new THREE.CanvasTexture(lc)) }));
    label.rotation.y = -Math.PI / 2;
    label.position.set(-0.0712, 0.13, 0);
    label.userData.noShadowCast = true;
    eb.add(label);
    eb.position.set(1.96, 1.5, -8);
    scene.add(eb);
    wire(1.93, 1.26, -8.08, -1, 0.50, 0x111111, 0.05);
    wire(1.93, 1.26, -8.00, -1, 0.70, 0x8a1212, -0.04);
    wire(1.93, 1.26, -7.92, -1, 0.40, 0x1c3a8a, 0.07);

    const strapMat = new THREE.MeshStandardMaterial({ color: 0x2d3033, metalness: 0.65, roughness: 0.5 });
    const bracket = new THREE.Group();
    const plate = new THREE.Mesh(makeBevelBox(0.024, 0.56, 0.16, 0.005), strapMat);
    plate.position.set(0.115, 1.06, 0);
    plate.userData.noShadowCast = true;
    bracket.add(plate);
    const cradle = new THREE.Mesh(makeBevelBox(0.16, 0.02, 0.14, 0.004), strapMat);
    cradle.position.set(0.03, 0.83, 0);
    cradle.userData.noShadowCast = true;
    bracket.add(cradle);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.013, 6, 16), strapMat);
    strap.rotation.x = Math.PI / 2; strap.position.y = 1.12;
    strap.userData.noShadowCast = true;
    bracket.add(strap);
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 0.038), strapMat);
    latch.position.set(-0.095, 1.12, 0);
    latch.userData.noShadowCast = true;
    bracket.add(latch);
    bracket.position.set(1.87, 0, 2);
    scene.add(bracket);

    const exLabelTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d');
        const draw = () => {
            g.fillStyle = '#c8c2b4'; g.fillRect(0, 0, 128, 128);
            g.fillStyle = '#181818'; g.fillRect(0, 0, 128, 30);
            g.fillStyle = '#d8d2c6'; g.textAlign = 'center';
            const label = t('label.extinguisher');
            let fs = 16;
            g.font = 'bold ' + fs + 'px sans-serif';
            while (g.measureText(label).width > 116 && fs > 8) { fs--; g.font = 'bold ' + fs + 'px sans-serif'; }
            g.fillText(label, 64, 21);
            g.fillStyle = '#7a1212'; g.fillRect(10, 40, 108, 14);
            g.fillStyle = '#242424';
            for (let r = 0; r < 5; r++) g.fillRect(12, 66 + r * 11, 70 + (r % 2) * 28, 4);
            const gr = g.createRadialGradient(64, 64, 15, 64, 64, 85);
            gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,22,12,0.45)');
            g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        };
        draw();
        const tex = markSRGB(new THREE.CanvasTexture(c));
        registerLocalizedTexture(() => { draw(); tex.needsUpdate = true; });
        return tex;
    })();

    const gaugeTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#c7bfa8'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
        g.lineWidth = 10;
        g.strokeStyle = '#9e1c1c';
        g.beginPath(); g.arc(64, 64, 42, Math.PI * 0.85, Math.PI * 1.35); g.stroke();
        g.strokeStyle = '#2b6e32';
        g.beginPath(); g.arc(64, 64, 42, Math.PI * 1.35, Math.PI * 1.75); g.stroke();
        g.strokeStyle = '#9e1c1c';
        g.beginPath(); g.arc(64, 64, 42, Math.PI * 1.75, Math.PI * 2.15); g.stroke();
        g.strokeStyle = '#181818'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(64, 64); g.lineTo(32, 86); g.stroke();
        g.fillStyle = '#222'; g.beginPath(); g.arc(64, 64, 7, 0, Math.PI * 2); g.fill();
        return markSRGB(new THREE.CanvasTexture(c));
    })();

    const ex = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0x8f0d0d, emissive: 0x1a0000, roughness: 0.42, metalness: 0.34 });
    const blk = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.72 });
    const exBrass = new THREE.MeshStandardMaterial({ color: 0x9c8240, metalness: 0.78, roughness: 0.36 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.4, QUALITY.segs), red);
    body.position.y = 1.05; ex.add(body);
    const botRim = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.008, 6, QUALITY.segs), red);
    botRim.rotation.x = Math.PI / 2; botRim.position.y = 0.85;
    botRim.userData.noShadowCast = true; ex.add(botRim);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.085, QUALITY.segs, Math.max(6, Math.floor(QUALITY.segs / 2)), 0, Math.PI * 2, 0, Math.PI / 2), red);
    dome.position.y = 1.25; ex.add(dome);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.033, 0.04, smallSeg), exBrass);
    collar.position.y = 1.32; collar.userData.noShadowCast = true; ex.add(collar);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.05, smallSeg), blk);
    neck.position.y = 1.35; neck.userData.noShadowCast = true; ex.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.038, 0.115), blk);
    head.position.y = 1.385; head.userData.noShadowCast = true; ex.add(head);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.012, 0.11), blk);
    lever.position.set(0, 1.418, -0.015);
    lever.rotation.x = -0.18;
    lever.userData.noShadowCast = true; ex.add(lever);

    const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.003, 6, smallSeg), exBrass);
    pinRing.position.set(-0.028, 1.385, -0.02);
    pinRing.rotation.y = Math.PI / 2;
    pinRing.userData.noShadowCast = true; ex.add(pinRing);

    const gaugeBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.018, smallSeg), exBrass);
    gaugeBezel.rotation.z = Math.PI / 2;
    gaugeBezel.position.set(-0.032, 1.375, 0.022);
    gaugeBezel.userData.noShadowCast = true; ex.add(gaugeBezel);

    const gaugeDial = new THREE.Mesh(
        new THREE.CircleGeometry(0.02, smallSeg),
        new THREE.MeshStandardMaterial({ map: gaugeTex, roughness: 0.35 })
    );
    gaugeDial.rotation.y = -Math.PI / 2;
    gaugeDial.position.set(-0.042, 1.375, 0.022);
    gaugeDial.userData.noShadowCast = true; ex.add(gaugeDial);

    const hosePort = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.025, smallSeg), exBrass);
    hosePort.rotation.x = Math.PI / 2;
    hosePort.position.set(0, 1.365, 0.06);
    hosePort.userData.noShadowCast = true; ex.add(hosePort);

    const hoseCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.365, 0.07), new THREE.Vector3(-0.09, 1.33, 0.08),
        new THREE.Vector3(-0.115, 1.15, 0.09), new THREE.Vector3(-0.085, 0.96, 0.07)
    ]);
    ex.add(new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 16, 0.012, 6, false), blk));
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.028, 0.085, smallSeg), blk);
    nozzle.position.set(-0.085, 0.915, 0.07);
    nozzle.userData.noShadowCast = true; ex.add(nozzle);

    const exLabel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0875, 0.0875, 0.17, QUALITY.segs, 1, true, -Math.PI / 2 - 0.85, 1.7),
        new THREE.MeshStandardMaterial({ map: exLabelTex, roughness: 0.78 })
    );
    exLabel.position.y = 1.06;
    exLabel.userData.noShadowCast = true; ex.add(exLabel);

    ex.position.set(1.87, 0, 2);
    scene.add(ex);
    extinguisherBodyGroup = ex;
    extinguisherCollider = { x: 1.87, z: 2, r: 0.14 };
    colliders.push(extinguisherCollider);
}
    // Декоративті атмосфера тобын көрсету/жасыру
function setDecorVisible(visible) {
    if (decorGroup) decorGroup.visible = !!visible;
}

// Жалған AO жазықтықтары және декаль атласы
function createAtmosphereDetails() {
    decorGroup = new THREE.Group();
    decorGroup.userData.ignoreAnomaly = true;
    scene.add(decorGroup);
    if (!QUALITY.fakeAO && QUALITY.decals <= 0) {
        decorGroup.visible = false;
        return;
    }

    if (QUALITY.fakeAO) {
        // Бір градиент текстурасын барлық AO жолақтарында қайта пайдалану
        const aoCv = document.createElement('canvas');
        aoCv.width = 16; aoCv.height = 128;
        const ag = aoCv.getContext('2d');
        const gr = ag.createLinearGradient(0, 0, 0, 128);
        gr.addColorStop(0, 'rgba(0,0,0,0)');
        gr.addColorStop(0.55, 'rgba(0,0,0,0.22)');
        gr.addColorStop(1, 'rgba(0,0,0,0.65)');
        ag.fillStyle = gr;
        ag.fillRect(0, 0, 16, 128);
        const aoTex = new THREE.CanvasTexture(aoCv);

        const aoMat = new THREE.MeshBasicMaterial({
            map: aoTex,
            transparent: true,
            depthWrite: false,
            fog: true,
            polygonOffset: true,
            polygonOffsetFactor: -1
        });
        const spanGeo = new THREE.PlaneGeometry(38, 0.38);
        const cornerGeo = new THREE.PlaneGeometry(4.0, 0.38);

        const addAO = (geo, x, y, z, rx, ry, rz, span, followFront) => {
            const m = new THREE.Mesh(geo, aoMat);
            m.position.set(x, y, z);
            m.rotation.set(rx, ry, rz);
            m.userData.noShadowCast = true;
            m.userData.noReceiveShadow = true;
            if (span) m.userData.corridorSpan = true;
            if (followFront) m.userData.followFront = true;
            decorGroup.add(m);
        };

        // Еден-қабырға және төбе-қабырға түйістеріндегі қараңғылау жолақтары
        addAO(spanGeo, -1.78, 0.006, -7, -Math.PI / 2, 0, -Math.PI / 2, true, false);
        addAO(spanGeo,  1.78, 0.006, -7, -Math.PI / 2, 0,  Math.PI / 2, true, false);
        addAO(spanGeo, -1.78, 3.994, -7,  Math.PI / 2, 0, -Math.PI / 2, true, false);
        addAO(spanGeo,  1.78, 3.994, -7,  Math.PI / 2, 0,  Math.PI / 2, true, false);

        // Дәліздің 4 тік бұрышы
        addAO(cornerGeo, -1.985, 2, -24.8, 0,  Math.PI / 2,  Math.PI / 2, false, true);
        addAO(cornerGeo,  1.985, 2, -24.8, 0, -Math.PI / 2, -Math.PI / 2, false, true);
        addAO(cornerGeo, -1.985, 2,  10.8, 0,  Math.PI / 2, -Math.PI / 2, false, false);
        addAO(cornerGeo,  1.985, 2,  10.8, 0, -Math.PI / 2,  Math.PI / 2, false, false);
    }

    if (QUALITY.decals > 0) {
        // 512x512 өлшемді 4 дақ түрі бар ортақ атлас
        const atCv = document.createElement('canvas');
        atCv.width = 512; atCv.height = 512;
        const g = atCv.getContext('2d');
        const drawBlotch = (ox, oy, col1, col2, count) => {
            for (let i = 0; i < count; i++) {
                const cx = ox + 55 + Math.random() * 146;
                const cy = oy + 55 + Math.random() * 146;
                const rad = 22 + Math.random() * 44;
                const rg = g.createRadialGradient(cx, cy, 2, cx, cy, rad);
                rg.addColorStop(0, col1);
                rg.addColorStop(1, col2);
                g.fillStyle = rg;
                g.fillRect(ox, oy, 256, 256);
            }
        };
        // 0: ылғал көгеру дағы
        drawBlotch(0, 0, 'rgba(18,20,14,0.48)', 'rgba(18,20,14,0)', 7);
        // 1: аққан су ізі
        drawBlotch(256, 0, 'rgba(30,24,14,0.36)', 'rgba(30,24,14,0)', 4);
        for (let i = 0; i < 6; i++) {
            const x = 290 + Math.random() * 180;
            const len = 80 + Math.random() * 130;
            const lg = g.createLinearGradient(0, 28, 0, 28 + len);
            lg.addColorStop(0, 'rgba(26,20,12,0.42)');
            lg.addColorStop(1, 'rgba(26,20,12,0)');
            g.fillStyle = lg;
            g.fillRect(x, 28, 3 + Math.random() * 6, len);
        }
        // 2: сызаттар
        g.strokeStyle = 'rgba(15,12,10,0.62)';
        for (let i = 0; i < 9; i++) {
            g.lineWidth = 1.2 + Math.random() * 2;
            g.beginPath();
            const sx = 35 + Math.random() * 185, sy = 290 + Math.random() * 185;
            g.moveTo(sx, sy);
            g.lineTo(sx + (Math.random() - 0.5) * 70, sy + (Math.random() - 0.5) * 70);
            g.stroke();
        }
        // 3: тот және қара дақ
        drawBlotch(256, 256, 'rgba(46,20,10,0.44)', 'rgba(46,20,10,0)', 7);

        const atlasTex = markSRGB(new THREE.CanvasTexture(atCv));
        const decalMat = new THREE.MeshStandardMaterial({
            map: atlasTex,
            roughness: 0.95,
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2
        });

        // 4 квадрантқа арналған ортақ UV геометриялары
        const quadGeos = [];
        for (let q = 0; q < 4; q++) {
            const qg = new THREE.PlaneGeometry(1, 1);
            const col = q % 2, row = Math.floor(q / 2);
            const u0 = col * 0.5, v0 = (1 - row) * 0.5;
            const uv = qg.attributes.uv;
            for (let k = 0; k < uv.count; k++) {
                uv.setXY(k, u0 + uv.getX(k) * 0.5, v0 + uv.getY(k) * 0.5);
            }
            uv.needsUpdate = true;
            quadGeos.push(qg);
        }

        // Сурет, плакат, есік, өрт сөндіргіш және т.б. нысандарды айналып өту тізімі
        const avoidWalls = {
            '-1': [
                { y: 2.5, z: -4.0, d: 1.45 }, { y: 2.0, z: -10.0, d: 1.55 }, { y: 2.0, z: -18.0, d: 1.55 },
                { y: 1.75, z: -22.0, d: 1.2 }, { y: 1.62, z: -16.5, d: 1.25 }, { y: 1.32, z: 6.2, d: 1.25 },
                { y: 1.28, z: -6.7, d: 1.2 }, { y: 0.36, z: -11.5, d: 0.85 }, { y: 1.32, z: -3.2, d: 0.85 },
                { y: 0.5, z: -14.0, d: 0.95 }, { y: 0.3, z: 3.0, d: 0.85 }
            ],
            '1': [
                { y: 1.1, z: 2.0, d: 1.25 }, { y: 1.5, z: -8.0, d: 1.15 }, { y: 1.8, z: -15.0, d: 1.15 },
                { y: 1.48, z: -2.5, d: 1.25 }, { y: 1.45, z: -13.1, d: 1.15 }, { y: 0.65, z: -20.8, d: 1.15 },
                { y: 0.36, z: 4.5, d: 0.85 }, { y: 0.5, z: -5.0, d: 0.95 }, { y: 0.4, z: -12.0, d: 0.95 },
                { y: 1.1, z: 4.5, d: 1.35 }
            ]
        };
        const avoidFloor = [
            { x: 1.55, z: -5.0, d: 1.0 }, { x: -1.55, z: -5.0, d: 1.0 }, { x: -1.55, z: -14.0, d: 1.0 },
            { x: 1.55, z: -22.0, d: 1.0 }, { x: -1.66, z: 3.0, d: 0.9 }, { x: 1.62, z: -12.0, d: 0.9 },
            { x: 0.4, z: -3.0, d: 1.1 }
        ];
        const placedWall = { '-1': [], '1': [] };
        const placedFloor = [];

        for (let i = 0; i < QUALITY.decals; i++) {
            const onFloor = Math.random() < 0.34;
            const qIdx = Math.floor(Math.random() * 4);
            const sz = 0.65 + Math.random() * 0.75;
            let ok = false;

            for (let tries = 0; tries < 24 && !ok; tries++) {
                if (onFloor) {
                    const x = (Math.random() - 0.5) * 2.9;
                    const z = -19.0 + Math.random() * 27.6;
                    if (z > -14.2 && z < -6.8) continue; // 13-аномалия шұңқыры үстіне қоймау
                    if (avoidFloor.some(a => Math.hypot(x - a.x, z - a.z) < a.d)) continue;
                    if (placedFloor.some(p => Math.hypot(x - p.x, z - p.z) < 1.15)) continue;
                    placedFloor.push({ x, z });
                    const dm = new THREE.Mesh(quadGeos[qIdx], decalMat);
                    dm.position.set(x, 0.007, z);
                    dm.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
                    dm.scale.set(sz, sz, 1);
                    dm.userData.noShadowCast = true;
                    decorGroup.add(dm);
                    ok = true;
                } else {
                    const side = Math.random() < 0.5 ? -1 : 1;
                    const y = 0.55 + Math.random() * 2.75;
                    const z = -19.0 + Math.random() * 27.6;
                    if (avoidWalls[side].some(a => Math.hypot(y - a.y, z - a.z) < a.d)) continue;
                    if (placedWall[side].some(p => Math.hypot(y - p.y, z - p.z) < 1.05)) continue;
                    placedWall[side].push({ y, z });
                    const dm = new THREE.Mesh(quadGeos[qIdx], decalMat);
                    dm.position.set(side * 1.992, y, z);
                    dm.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
                    dm.rotation.z = (Math.random() - 0.5) * 0.35;
                    dm.scale.set(sz, sz * (0.85 + Math.random() * 0.45), 1);
                    dm.userData.noShadowCast = true;
                    decorGroup.add(dm);
                    ok = true;
                }
            }
        }
    }
}

// Төбе шамдарына арналған жалған glow спрайттары
function createLampGlows() {
    lampGlowSprites = [];
    if (!QUALITY.glow) return;

    const gc = document.createElement('canvas');
    gc.width = 128; gc.height = 128;
    const gg = gc.getContext('2d');
    const rg = gg.createRadialGradient(64, 64, 2, 64, 64, 62);
    rg.addColorStop(0, 'rgba(255,255,255,0.95)');
    rg.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    gg.fillStyle = rg;
    gg.fillRect(0, 0, 128, 128);
    const glowTex = markSRGB(new THREE.CanvasTexture(gc));

    for (let i = 0; i < lampMeshes.length; i++) {
        const mat = new THREE.SpriteMaterial({
            map: glowTex,
            color: 0xffeedd,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false
        });
        const sp = new THREE.Sprite(mat);
        sp.scale.set(0.95, 0.95, 1);
        sp.position.set(0, -0.07, 0);
        sp.userData.noShadowCast = true;
        lampMeshes[i].add(sp);
        lampGlowSprites.push(sp);
    }
}

// Қол шамына арналған жалған тозаң-сәуле конусы
function createFlashlightBeam() {
    if (!QUALITY.beam) return;
    const geo = new THREE.ConeGeometry(1.75, 7.5, QUALITY.segs, 1, true);
    geo.translate(0, -3.75, 0);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uColor: { value: new THREE.Color(0xfff6dd) },
            uOpacity: { value: 0.08 }
        },
        vertexShader: [
            'varying vec2 vUv;',
            'varying vec3 vNormalView;',
            'varying vec3 vViewPos;',
            'void main() {',
            '    vUv = uv;',
            '    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
            '    vViewPos = -mvPos.xyz;',
            '    vNormalView = normalize(normalMatrix * normal);',
            '    gl_Position = projectionMatrix * mvPos;',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform vec3 uColor;',
            'uniform float uOpacity;',
            'varying vec2 vUv;',
            'varying vec3 vNormalView;',
            'varying vec3 vViewPos;',
            'void main() {',
            '    float edge = pow(abs(dot(normalize(vNormalView), normalize(vViewPos))), 1.6);',
            '    float axial = pow(vUv.y, 1.8) * (1.0 - smoothstep(0.88, 1.0, vUv.y));',
            '    gl_FragColor = vec4(uColor, uOpacity * edge * axial);',
            '}'
        ].join('\n')
    });

    flashlightBeam = new THREE.Mesh(geo, mat);
    flashlightBeam.frustumCulled = false;
    flashlightBeam.renderOrder = 2;
    flashlightBeam.userData.noShadowCast = true;
    flashlightBeam.userData.noReceiveShadow = true;
    flashlightBeam.userData.ignoreAnomaly = true;
    scene.add(flashlightBeam);
}

function applyTextures() {
    const maxAniso = Math.min(isMobile ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
    const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const rnd = (a, b) => a + Math.random() * (b - a);
    function grain(g, w, h, amp) {
        const img = g.getImageData(0, 0, w, h), d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * amp;
            d[i] += n; d[i + 1] += n; d[i + 2] += n;
        }
        g.putImageData(img, 0, 0);
    }
    function blotches(g, count, a) {
        for (let i = 0; i < count; i++) {
            const x = rnd(80, 430), y = rnd(80, 430), r = rnd(30, 70);
            const gr = g.createRadialGradient(x, y, 1, x, y, r);
            const dark = Math.random() < 0.7;
            gr.addColorStop(0, dark ? 'rgba(0,0,0,' + a + ')' : 'rgba(255,255,255,' + (a * 0.7) + ')');
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
    }

    function brickTexture() {
        const c = mkCanvas(512, 512), g = c.getContext('2d');
        g.fillStyle = '#8a8580'; g.fillRect(0, 0, 512, 512);
        for (let r = 0; r < 8; r++) {
            const off = (r % 2) * 64;
            for (let b = -1; b < 5; b++) {
                const x = b * 128 + off + 2, y = r * 64 + 2, v = rnd(205, 255);
                g.fillStyle = 'rgb(' + (v | 0) + ',' + ((v * 0.9) | 0) + ',' + ((v * 0.85) | 0) + ')';
                g.fillRect(x, y, 124, 60);
                g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, 124, 3);
                g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + 57, 124, 3);
            }
        }
        blotches(g, 8, 0.22);
        grain(g, 512, 512, 30);
        return new THREE.CanvasTexture(c);
    }

    function concreteTexture() {
        const c = mkCanvas(512, 512), g = c.getContext('2d');
        g.fillStyle = 'rgb(225,225,225)'; g.fillRect(0, 0, 512, 512);
        blotches(g, 14, 0.12);
        grain(g, 512, 512, 28);
        g.fillStyle = 'rgba(30,30,30,0.45)';
        for (let i = 0; i < 120; i++) g.fillRect(rnd(0, 510), rnd(0, 510), rnd(1, 3), rnd(1, 3));
        g.strokeStyle = 'rgba(40,40,40,0.4)'; g.lineWidth = 1.2;
        for (let k = 0; k < 3; k++) {
            g.beginPath();
            let x = rnd(60, 450), y = rnd(60, 450);
            g.moveTo(x, y);
            for (let i = 0; i < 8; i++) { x += rnd(-30, 30); y += rnd(10, 35); g.lineTo(Math.min(470, Math.max(40, x)), Math.min(470, y)); }
            g.stroke();
        }
        g.strokeStyle = 'rgba(30,30,30,0.75)'; g.lineWidth = 6; g.strokeRect(0, 0, 512, 512);
        return new THREE.CanvasTexture(c);
    }

    function woodTexture() {
        const W = 256, H = 512, c = mkCanvas(W, H), g = c.getContext('2d');
        const pw = W / 5;
        for (let i = 0; i < 5; i++) {
            const v = rnd(222, 250);
            g.fillStyle = 'rgb(' + (v | 0) + ',' + ((v * 0.96) | 0) + ',' + ((v * 0.9) | 0) + ')';
            g.fillRect(i * pw, 0, pw, H);
            for (let k = 0; k < 22; k++) {
                const x0 = i * pw + rnd(2, pw - 2), amp = rnd(0.5, 2.5), ph = rnd(0, 6);
                g.strokeStyle = 'rgba(90,60,30,' + rnd(0.1, 0.32) + ')';
                g.lineWidth = rnd(0.5, 1.4);
                g.beginPath();
                for (let y = 0; y <= H; y += 16) {
                    const x = x0 + Math.sin(y * 0.02 + ph) * amp;
                    if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
                }
                g.stroke();
            }
        }
        for (let k = 0; k < 3; k++) {
            const x = rnd(30, W - 30), y = rnd(60, H - 60);
            const gr = g.createRadialGradient(x, y, 1, x, y, 14);
            gr.addColorStop(0, 'rgba(60,35,15,0.7)'); gr.addColorStop(1, 'rgba(60,35,15,0)');
            g.fillStyle = gr; g.fillRect(x - 14, y - 14, 28, 28);
        }
        g.fillStyle = 'rgba(20,10,5,0.9)';
        for (let i = 1; i < 5; i++) g.fillRect(i * pw - 1.5, 0, 3, H);
        [90, 410].forEach(y => {
            g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y, W, 30);
            g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, y, W, 2); g.fillRect(0, y + 29, W, 2);
        });
        grain(g, W, H, 20);
        return new THREE.CanvasTexture(c);
    }

    const prep = (t, rx, ry) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rx, ry);
        t.anisotropy = maxAniso;
        return t;
    };
    brickTex = prep(markSRGB(brickTexture()), 38, 4);
    concreteTex = prep(markSRGB(concreteTexture()), 4, 38);
    woodTex = markSRGB(woodTexture()); woodTex.anisotropy = maxAniso;

    const wallMats = [rightWallMesh.material];
    const setMap = (mat, tex) => { mat.map = tex; mat.needsUpdate = true; };
    setMap(rightWallMesh.material, brickTex);
    setMap(frontDoorMesh.material, woodTex);
    setMap(backDoorMesh.material, woodTex);
    scene.traverse(o => {
        if (!o.isMesh || o.geometry.type !== 'PlaneGeometry') return;
        const gp = o.geometry.parameters;
        if (gp.width === 4 && gp.height === 38) setMap(o.material, concreteTex);
        else if (gp.width === 38 && gp.height === 4 && o !== rightWallMesh) {
            setMap(o.material, brickTex);
            wallMats.push(o.material);
        }
    });

    // Fallback дайын болған соң PBR карталарын фондық түрде жүктеу
    loadPBR(PBR_NAMES[0], 38, 4, wallMats, maxAniso);
    loadPBR(PBR_NAMES[1], 4, 38, [floorMesh.material], maxAniso);
    loadPBR(PBR_NAMES[2], 1, 1, [frontDoorMesh.material, backDoorMesh.material], maxAniso);
}

// PBR текстураларын fallback-пен жүктеу (textures/*_color.jpg қараңғы тонды болуы керек)
function loadPBR(name, repeatX, repeatY, targets, maxAniso) {
    if (!QUALITY.pbr) return null;
    const aniso = maxAniso || Math.min(isMobile ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
    const loader = new THREE.TextureLoader();
    const bundle = { map: null, normalMap: null, roughnessMap: null };
    const mats = targets || [];

    const prepTex = (tex, isColor) => {
        if (isColor) markSRGB(tex);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
        tex.anisotropy = aniso;
        tex.needsUpdate = true;
        return tex;
    };

    const applySlot = (slot, tex) => {
        bundle[slot] = tex;
        for (let i = 0; i < mats.length; i++) {
            const mat = mats[i];
            if (!mat) continue;
            if (slot === 'map') mat.map = tex;
            else if (slot === 'normalMap') {
                pbrNormalEntries.push({ mat: mat, normalMap: tex });
                mat.normalMap = _perfEffectLevel >= 5 ? null : tex;
                if (mat.normalScale) mat.normalScale.set(0.8, 0.8);
            } else if (slot === 'roughnessMap') {
                mat.roughnessMap = tex;
            }
            mat.needsUpdate = true;
        }
    };

    const base = 'textures/' + name + '_' + QUALITY.pbr;
    loader.load(base + '_color.jpg', tex => applySlot('map', prepTex(tex, true)), undefined, () => {});
    if (QUALITY.normalMaps) {
        loader.load(base + '_normal.jpg', tex => applySlot('normalMap', prepTex(tex, false)), undefined, () => {});
    }
    loader.load(base + '_rough.jpg', tex => applySlot('roughnessMap', prepTex(tex, false)), undefined, () => {});
    return bundle;
}
function setupShadows() {
    const shadowBias = -0.0005;
    const shadowNormalBias = 0.02;

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = QUALITY.level === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

    const fShadow = isMobile ? 512 : 1024;
    const cShadow = isMobile ? 256 : 512;

    flashlight.castShadow = true;
    flashlight.shadow.mapSize.set(fShadow, fShadow);
    flashlight.shadow.camera.near = 0.1;
    flashlight.shadow.bias = shadowBias;
    flashlight.shadow.normalBias = shadowNormalBias;

    ceilingLights.forEach(l => {
        l.castShadow = true;
        l.shadow.mapSize.set(cShadow, cShadow);
        l.shadow.camera.near = 0.2;
        l.shadow.bias = shadowBias;
        l.shadow.normalBias = shadowNormalBias;
        l.shadow.autoUpdate = false;
        l.shadow.needsUpdate = true;
    });

    const skip = new Set(lampMeshes);
    const size = new THREE.Vector3();
    scene.traverse(o => {
        if (!o.isMesh || skip.has(o) || !o.material || !o.material.isMeshStandardMaterial) return;
        o.receiveShadow = !(o.userData && o.userData.noReceiveShadow);
        if (o.userData && o.userData.noShadowCast) return;
        const t = o.geometry.type;
        if (t === 'PlaneGeometry' || t === 'CircleGeometry' || t === 'TubeGeometry') return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        o.geometry.boundingBox.getSize(size);
        if (Math.max(size.x, size.y, size.z) < 0.07) return;
        o.castShadow = true;
    });
    perfApplyShadowQuality();
}

function updateStaticShadows() {
    ceilingLights.forEach(l => { l.shadow.needsUpdate = true; });
}
function perfApplyShadowQuality() {
    for (let i = 0; i < ceilingLights.length; i++) {
        ceilingLights[i].castShadow = QUALITY.lampShadows.includes(i);
    }
    const flashMode = perfFlashMode();
    if (flashMode === 'off') {
        flashlight.castShadow = false;
    } else if (flashMode === 'half') {
        flashlight.castShadow = true;
        flashlight.shadow.autoUpdate = false;
        flashlight.shadow.needsUpdate = true;
    } else {
        flashlight.castShadow = true;
        flashlight.shadow.autoUpdate = true;
    }

    if (playerBody) {
        if (playerBody.userData.builtLowDetail !== (QUALITY.level === 'low')) {
            syncInGamePlayerBody();
        } else {
            const allowBodyShadow = (QUALITY.level === 'high' || QUALITY.level === 'medium');
            playerBody.traverse(obj => {
                if (obj.isMesh) {
                    obj.receiveShadow = allowBodyShadow;
                    obj.castShadow = false;
                }
            });
        }
    }
}

let perfFlashFrame = 0;
function perfFlashShadowTick() {
    const flashMode = perfFlashMode();
    if (flashMode === 'half') {
        perfFlashFrame++;
        if (perfFlashFrame % 2 === 0) flashlight.shadow.needsUpdate = true;
    }
}

function updateStageHintVisibility() {
    const el = document.getElementById('stage-hint');
    if (!el) return;
    if (gameStarted && currentStage === 0) {
        stageHintTimer = 8.0;
        el.style.display = 'block';
    } else {
        stageHintTimer = 0;
        el.style.display = 'none';
    }
}

function setGameplayHudVisible(visible) {
    document.getElementById('crosshair').style.display = visible ? 'block' : 'none';
    document.getElementById('instructions').style.display = (visible && !isMobile) ? 'block' : 'none';
    document.getElementById('mobile-controls').style.display = (visible && isMobile) ? 'block' : 'none';
    const fsBtn = document.getElementById('fs-btn');
    if (fsBtn) {
        const canFs = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
        fsBtn.style.display = (visible && isMobile && canFs) ? 'block' : 'none';
    }
    if (!visible) {
        document.getElementById('stamina-wrap').style.display = 'none';
        document.getElementById('stage-hint').style.display = 'none';
        document.getElementById('lock-hint').style.display = 'none';
        document.getElementById('panic-vignette').style.opacity = 0;
    }
}

function updateLockHint() {
    const el = document.getElementById('lock-hint');
    if (!el) return;
    const show = !isMobile && gameStarted && !inMenu && !isTransitioning && document.pointerLockElement !== document.body;
    el.style.display = show ? 'block' : 'none';
}

function toggleFullscreen() {
    try {
        const doc = document;
        const el = document.documentElement;
        if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
            if (el.requestFullscreen) el.requestFullscreen();
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        } else {
            if (doc.exitFullscreen) doc.exitFullscreen();
            else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        }
    } catch (e) {}
}

function acquirePointerLock() {
    if (isMobile) return;
    try {
        const res = document.body.requestPointerLock();
        if (res && typeof res.catch === 'function') {
            res.catch(() => updateLockHint());
        }
    } catch (e) {
        updateLockHint();
    }
    updateLockHint();
}

function resetGameSessionState() {
    playTime = 0;
    mistakes = 0;
    currentStage = 0;
    lastAnomalyType = 0;
    anomalyBag = [];
    isTransitioning = false;
    pendingPause = false;
    stamina = 1.0;
    sprintExhausted = false;
    heartbeatTimer = 0;
    heartbeatPulse = 0;
    panicLevel = 0;
    creakCooldown = 8 + Math.random() * 10;
    footstepTimer = 0;

    flashlightOn = true;
    flashlight.visible = true;
    flashlight.intensity = FLASHLIGHT_BASE_INTENSITY;
    flickerTimeLeft = 0;
    flickerCooldown = 8 + Math.random() * 12;

    camera.fov = 75;
    camera.updateProjectionMatrix();

    SC.t = 0;
    SC.next = scRand0();
    SC.hardCool = 45;
    SC.lookBackCool = 35;
    scAbort();
    perfResetEffects();
    resetInput();
}

function startGame() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('pause-btn').style.display = 'block';
    inMenu = false;
    gameStarted = true;
    resetGameSessionState();
    restoreLamps();
    initAudio();
    stopMenuAmbient();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    startGameAmbient();
    resetStage(true);
    setGameplayHudVisible(true);
    updateStageHintVisibility();
    updateMobileBtnStates();
    prevTime = performance.now();
    acquirePointerLock();
}

function openInstructions() {
    document.getElementById('instructions-modal').style.display = 'flex';
}

function resetInput() {
    moveForward = moveBackward = moveLeft = moveRight = false;
    isSprinting = false;
    isCrouching = false;
    mobileSprint = false;
    joyTouchId = null;
    lookTouchId = null;
    joyX = 0;
    joyY = 0;
    const knob = document.getElementById('joystick-knob');
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
    updateMobileBtnStates();
}

function updateMobileBtnStates() {
    const fBtn = document.getElementById('mob-flash');
    const sBtn = document.getElementById('mob-sprint');
    const cBtn = document.getElementById('mob-crouch');
    if (fBtn) fBtn.classList.toggle('active', flashlightOn && !NA.blackoutOn);
    if (sBtn) sBtn.classList.toggle('active', mobileSprint);
    if (cBtn) cBtn.classList.toggle('active', isCrouching);
}

function pauseGame() {
    if (!gameStarted) return;
    gameStarted = false;
    pendingPause = false;
    scAbort();
    resetInput();
    setGameplayHudVisible(false);
    if (document.pointerLockElement) document.exitPointerLock();
    pauseGameAudio();
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
    document.getElementById('pause-menu').style.display = 'flex';
}

function resumeGame() {
    document.getElementById('pause-menu').style.display = 'none';
    gameStarted = true;
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    resumeGameAudio();
    setGameplayHudVisible(true);
    updateMobileBtnStates();
    prevTime = performance.now();
    acquirePointerLock();
}

function goToMainMenu() {
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('pause-btn').style.display = 'none';
    hideVictory();
    hideErrorToast();
    setGameplayHudVisible(false);
    document.getElementById('main-menu').style.display = 'flex';
    gameStarted = false;
    inMenu = true;
    document.getElementById('fade').style.opacity = 0;

    resetGameSessionState();
    resetStage(true);

    stopGameAmbient();
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startMenuAmbient();
}

function showErrorToast(text, duration = 1500) {
    const toast = document.getElementById('error-toast');
    toast.textContent = text;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function hideErrorToast() {
    clearTimeout(toastTimer);
    document.getElementById('error-toast').classList.remove('show');
}

function formatTime(sec) {
    const total = Math.floor(sec);
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const r = String(total % 60).padStart(2, '0');
    return m + ':' + r;
}

function showVictory() {
    hideErrorToast();
    scAbort();
    gameStarted = false;
    pendingPause = false;
    resetInput();
    setGameplayHudVisible(false);
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('pause-btn').style.display = 'none';
    document.getElementById('victory-time').textContent = formatTime(playTime);
    document.getElementById('victory-mistakes').textContent = mistakes;
    updateAnomalyProgressUI();

    const modal = document.getElementById('victory-modal');
    modal.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('show')));
    stopGameAmbient();
    playWinSound();
}

function hideVictory() {
    const modal = document.getElementById('victory-modal');
    modal.classList.remove('show');
    modal.style.display = 'none';
}

function restartGame() {
    hideVictory();
    resetGameSessionState();
    document.getElementById('pause-btn').style.display = 'block';
    gameStarted = true;
    inMenu = false;
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startGameAmbient();
    resetStage(true);
    setGameplayHudVisible(true);
    updateStageHintVisibility();
    updateMobileBtnStates();
    prevTime = performance.now();
    acquirePointerLock();
}

function openSettings() {
    syncSettingsUI();
    document.getElementById('settings-modal').style.display = 'flex';
}

let qualityChanged = false;
const FX_ROWS = {
    'fx-bloom': { key: 'bloom', avail: () => !!bloomPass },
    'fx-film':  { key: 'film',  avail: () => !!filmPass && !!QUALITY.film },
    'fx-beam':  { key: 'beam',  avail: () => !!flashlightBeam },
    'fx-glow':  { key: 'glow',  avail: () => lampGlowSprites.length > 0 },
    'fx-decor': { key: 'decor', avail: () => !!decorGroup && (QUALITY.fakeAO || QUALITY.decals > 0) }
};

function syncSettingsUI() {
    const $ = id => document.getElementById(id);
    const q = userGet('quality', 'auto');
    $('quality-select').value = ['auto', 'high', 'medium', 'low'].indexOf(q) >= 0 ? q : 'auto';
    $('quality-current').textContent = t('settings.nowQuality', { level: t('settings.' + QUALITY.level) });
    $('quality-note').style.display = qualityChanged ? 'block' : 'none';
    $('quality-reload').style.display = qualityChanged ? 'block' : 'none';
    $('flash-shadow-select').value = userFlashShadow;
    $('res-slider').value = Math.round(perfUserScale * 100);
    $('res-value').textContent = Math.round(perfUserScale * 100) + '%';
    $('auto-res').checked = perfAutoRes;
    $('show-fps').checked = DEBUG_PERF;
    for (const id in FX_ROWS) {
        const el = $(id), cfg = FX_ROWS[id];
        el.checked = userFx[cfg.key];
        el.closest('.setting-row').classList.toggle('disabled', !cfg.avail());
    }
}

function setupGraphicsSettings() {
    const $ = id => document.getElementById(id);

    $('quality-select').addEventListener('change', (e) => {
        const v = e.target.value;
        try {
            if (v === 'auto') localStorage.removeItem('quality');
            else localStorage.setItem('quality', v);
        } catch (err) {}
        qualityChanged = true;
        syncSettingsUI();
    });

    $('flash-shadow-select').addEventListener('change', (e) => {
        userFlashShadow = e.target.value;
        userSet('flashShadow', userFlashShadow);
        perfFlashShadowOverride = null;
        perfApplyShadowQuality();
    });

    $('res-slider').addEventListener('input', (e) => {
        $('res-value').textContent = e.target.value + '%';
    });
    $('res-slider').addEventListener('change', (e) => {
        perfUserScale = parseFloat(e.target.value) / 100;
        userSet('resScale', e.target.value);
        perfPixelRatioCap = Math.max(0.3, perfPixelRatioBase * perfUserScale);
        perfPixelRatio = perfPixelRatioCap;
        onWindowResize();
    });

    $('auto-res').addEventListener('change', (e) => {
        perfAutoRes = e.target.checked;
        userSet('autoRes', perfAutoRes ? '1' : '0');
    });

    $('show-fps').addEventListener('change', (e) => {
        DEBUG_PERF = e.target.checked;
        userSet('showFps', DEBUG_PERF ? '1' : '0');
    });

    Object.keys(FX_ROWS).forEach(id => {
        $(id).addEventListener('change', (e) => {
            userFx[FX_ROWS[id].key] = e.target.checked;
            userSet('gfx', JSON.stringify(userFx));
            perfResetEffects();
        });
    });
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

function setMouseSensitivity(percent) {
    mouseSensitivity = percent / 100;
    document.getElementById('sensitivity-value').textContent = Math.round(percent) + '%';
    try { localStorage.setItem('mouseSensitivity', String(percent)); } catch (e) {}
}

function setupSensitivitySlider() {
    const slider = document.getElementById('sensitivity-slider');
    try {
        const saved = localStorage.getItem('mouseSensitivity');
        if (saved !== null && !isNaN(parseFloat(saved))) slider.value = saved;
    } catch (e) {}
    setMouseSensitivity(parseFloat(slider.value));
    slider.addEventListener('input', () => setMouseSensitivity(parseFloat(slider.value)));
}

function closeInstructions() {
    document.getElementById('instructions-modal').style.display = 'none';
}

function toggleFlashlight() {
    if (NA.blackoutOn) {
        playBrokenFlashlightSound();
        NA.deadFlashTimer = 0.06;
        flashlightOn = false;
    } else {
        flashlightOn = !flashlightOn;
        playFlashlightSound(flashlightOn);
    }
    // visible ешқашан өшірілмейді: жарық саны өзгерсе барлық шейдер қайта компиляцияланып, ойын қатады.
    // Өшіру intensity = 0 арқылы updateFlashlightFlicker ішінде жасалады.
    flashlight.visible = true;
    updateMobileBtnStates();
}

function setupMobileTouchControls() {
    const joyZone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    const lookZone = document.getElementById('look-zone');
    const fBtn = document.getElementById('mob-flash');
    const sBtn = document.getElementById('mob-sprint');
    const cBtn = document.getElementById('mob-crouch');

    const updateJoyFromTouch = (touch) => {
        const rect = joyZone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const maxR = rect.width * 0.36;
        let dx = touch.clientX - cx;
        let dy = touch.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxR) {
            dx = (dx / dist) * maxR;
            dy = (dy / dist) * maxR;
        }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        joyX = dx / maxR;
        joyY = dy / maxR;
        if (Math.hypot(joyX, joyY) < 0.12) { joyX = 0; joyY = 0; }
    };

    joyZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (joyTouchId === null && e.changedTouches.length > 0) {
            const t = e.changedTouches[0];
            joyTouchId = t.identifier;
            updateJoyFromTouch(t);
        }
    }, { passive: false });

    joyZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        e.stopPropagation();
        for (const t of e.changedTouches) {
            if (t.identifier === joyTouchId) {
                updateJoyFromTouch(t);
                break;
            }
        }
    }, { passive: false });

    const endJoy = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === joyTouchId) {
                joyTouchId = null;
                joyX = 0;
                joyY = 0;
                knob.style.transform = 'translate(-50%, -50%)';
                break;
            }
        }
    };
    joyZone.addEventListener('touchend', endJoy);
    joyZone.addEventListener('touchcancel', endJoy);

    lookZone.addEventListener('touchstart', (e) => {
        if (!gameStarted || isTransitioning) return;
        e.preventDefault();
        if (lookTouchId === null && e.changedTouches.length > 0) {
            const t = e.changedTouches[0];
            lookTouchId = t.identifier;
            lastLookX = t.clientX;
            lastLookY = t.clientY;
        }
    }, { passive: false });

    lookZone.addEventListener('touchmove', (e) => {
        if (!gameStarted || isTransitioning) return;
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === lookTouchId) {
                const dx = t.clientX - lastLookX;
                const dy = t.clientY - lastLookY;
                lastLookX = t.clientX;
                lastLookY = t.clientY;

                camera.rotation.y -= dx * 0.0048 * mouseSensitivity;
                camera.rotation.x -= dy * 0.0042 * mouseSensitivity;
                const maxPitch = Math.PI / 2.2;
                camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, camera.rotation.x));
                break;
            }
        }
    }, { passive: false });

    const endLook = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === lookTouchId) {
                lookTouchId = null;
                break;
            }
        }
    };
    lookZone.addEventListener('touchend', endLook);
    lookZone.addEventListener('touchcancel', endLook);

    fBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!gameStarted) return;
        toggleFlashlight();
    }, { passive: false });

    sBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!gameStarted) return;
        mobileSprint = !mobileSprint;
        if (mobileSprint) isCrouching = false;
        updateMobileBtnStates();
    }, { passive: false });

    cBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!gameStarted) return;
        isCrouching = !isCrouching;
        if (isCrouching) mobileSprint = false;
        updateMobileBtnStates();
    }, { passive: false });
}

function setupControls() {
    setupVolumeSlider();
    setupSensitivitySlider();
    setupGraphicsSettings();
    setupMobileTouchControls();

    document.addEventListener('pointerdown', unlockMenuAudio);
    document.addEventListener('touchend', unlockMenuAudio, { passive: true });
    document.addEventListener('keydown', unlockMenuAudio);

    window.addEventListener('touchstart', () => {
        if (!isMobile && (!window.matchMedia || !window.matchMedia('(any-pointer: fine)').matches)) {
            isMobile = true;
            if (gameStarted && !inMenu) setGameplayHudVisible(true);
        }
    }, { once: true, passive: true });

    window.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && isMobile && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            isMobile = false;
            resetInput();
            if (gameStarted && !inMenu) setGameplayHudVisible(true);
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && gameStarted) pauseGame();
    });

    document.body.addEventListener('click', () => {
        if (!gameStarted || isTransitioning || isMobile) return;
        initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        acquirePointerLock();
    });

    document.addEventListener('mousemove', (event) => {
        if (!isMobile && gameStarted && document.pointerLockElement === document.body && !isTransitioning) {
            const movementX = event.movementX || event.mozMovementX || 0;
            const movementY = event.movementY || event.mozMovementY || 0;

            camera.rotation.y -= movementX * 0.002 * mouseSensitivity;
            camera.rotation.x -= movementY * 0.002 * mouseSensitivity;

            const maxPitch = Math.PI / 2.2;
            camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, camera.rotation.x));
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!gameStarted) return;
        if (e.code === 'KeyW') moveForward = true;
        if (e.code === 'KeyS') moveBackward = true;
        if (e.code === 'KeyA') moveLeft = true;
        if (e.code === 'KeyD') moveRight = true;

        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') isSprinting = true;

        if (e.code === 'Space') {
            e.preventDefault();
            isCrouching = true;
        }

        if (e.code === 'KeyF' && !e.repeat) toggleFlashlight();
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') moveForward = false;
        if (e.code === 'KeyS') moveBackward = false;
        if (e.code === 'KeyA') moveLeft = false;
        if (e.code === 'KeyD') moveRight = false;

        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') isSprinting = false;
        if (e.code === 'Space') isCrouching = false;
    });

    document.addEventListener('pointerlockchange', () => {
        if (isMobile) return;
        if (!document.pointerLockElement && gameStarted) {
            if (isTransitioning) pendingPause = true;
            else pauseGame();
        } else {
            pendingPause = false;
            updateLockHint();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyP') return;
        if (gameStarted) pauseGame();
        else if (document.getElementById('pause-menu').style.display === 'flex') resumeGame();
    });

    window.addEventListener('blur', () => {
        resetInput();
    });
}

let _perfStaminaDisp = '', _perfStaminaW = '', _perfStaminaBg = '';
function updateStaminaUI() {
    const wrap = perfEl('stamina-wrap');
    const fill = perfEl('stamina-fill');
    if (!wrap || !fill) return;
    if (!gameStarted || stamina >= 0.995) {
        if (_perfStaminaDisp !== 'none') {
            wrap.style.display = 'none';
            _perfStaminaDisp = 'none';
        }
        return;
    }
    if (_perfStaminaDisp !== 'block') {
        wrap.style.display = 'block';
        _perfStaminaDisp = 'block';
    }
    const w = Math.round(stamina * 100) + '%';
    if (_perfStaminaW !== w) {
        fill.style.width = w;
        _perfStaminaW = w;
    }
    const bg = sprintExhausted ? '#b00000' : '#c8c8c8';
    if (_perfStaminaBg !== bg) {
        fill.style.backgroundColor = bg;
        _perfStaminaBg = bg;
    }
}

function computePanicLevel() {
    if (!gameStarted || inMenu) return 0;
    let p = currentStage >= 5 ? (currentStage - 4) * 0.14 : 0;

    if (SC.still > 4.5) p += Math.min(0.42, (SC.still - 4.5) * 0.055);

    const cam = camera.position;
    const t = currentAnomalyType;
    if (t === 8 && NA.dripOn) {
        const d = Math.hypot(cam.x - NA.src.x, cam.z - NA.src.z);
        if (d < 5.5) p += (1 - d / 5.5) * 0.45;
    } else if (t === 11 && NA.ghost && NA.ghost.visible) {
        p += 0.52;
    } else if (t === 12 && NA.shadowDetached) {
        const d = Math.abs(cam.z - NA.shadowWall.position.z);
        p += d < 6 ? 0.55 : 0.25;
    } else if (t === 13 && NA.pitTriggered) {
        const d = Math.max(0, cam.z - (-7.5));
        p += d < 5 ? 0.62 * (1 - d / 5) + 0.15 : 0.15;
    } else if (t === 14 && NA.mirrorGroup && NA.mirrorGroup.visible) {
        const d = Math.abs(cam.z + 10);
        if (d < 5.5) p += (1 - d / 5.5) * 0.48;
    } else if (t === 15 && NA.blackoutOn) {
        p += 0.7;
    } else if (t === 18 && cam.z < -9) {
        p += 0.35;
    } else if (t === 19 && cam.z < -15) {
        p += 0.45;
    }
    return Math.min(1, p);
}
let _perfLastPv = -1;
let _perfLastRender = 0;
function animate() {
    requestAnimationFrame(animate);
    if (document.hidden) { prevTime = performance.now(); return; }

    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    const dt = Math.min(delta, 0.1);
    const inputActive = isGameplayInputActive();
    perfAdaptResolution(delta);
    if (inputActive) {
        playTime += dt;
    }

    if (stageHintTimer > 0) {
        stageHintTimer -= dt;
        if (stageHintTimer <= 0) {
            perfEl('stage-hint').style.display = 'none';
        }
    }

    if (isTransitioning && doorAnimTarget) {
        doorAnimTarget.rotation.y += (0.85 - doorAnimTarget.rotation.y) * Math.min(1, delta * 10);
    }

    let bodyIsMoving = false;
    let bodyCanSprint = false;
    let bodyStepInterval = 0.45;

    if (inputActive) {
        const targetHeight = isCrouching ? 0.85 : 1.6;
        camera.position.y += (targetHeight - camera.position.y) * 12 * dt;

        let moveZ = (moveForward ? 1 : 0) - (moveBackward ? 1 : 0) - joyY;
        let moveX = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0) + joyX;
        const mag = Math.hypot(moveX, moveZ);
        if (mag > 1) { moveX /= mag; moveZ /= mag; }
        const isMoving = mag > 0.08;

        const wantsSprint = isSprinting || mobileSprint;
        const canSprint = wantsSprint && isMoving && !isCrouching && !sprintExhausted && stamina > 0;

        if (canSprint) {
            stamina = Math.max(0, stamina - dt * 0.28);
            if (stamina === 0) {
                sprintExhausted = true;
                mobileSprint = false;
                updateMobileBtnStates();
            }
        } else {
            stamina = Math.min(1, stamina + dt * 0.20);
            if (sprintExhausted && stamina >= 0.25) sprintExhausted = false;
        }
        updateStaminaUI();

        let baseSpeed = 4.5;
        let stepInterval = 0.45;
        let stepType = 'walk';
        let targetFov = PLAYER_BODY_CFG.baseFov;

        if (isCrouching) {
            baseSpeed = 2.2;
            stepInterval = 0.7;
            stepType = 'crouch';
        } else if (canSprint) {
            baseSpeed = 8.0;
            stepInterval = 0.25;
            stepType = 'sprint';
            targetFov = PLAYER_BODY_CFG.sprintFov;
        }

        bodyIsMoving = isMoving;
        bodyCanSprint = canSprint;
        bodyStepInterval = stepInterval;

        if (Math.abs(camera.fov - targetFov) > 0.1) {
            camera.fov += (targetFov - camera.fov) * 10 * dt;
            camera.updateProjectionMatrix();
        }

        const moveSpeed = baseSpeed * dt;
        const yaw = camera.rotation.y;
        _animForward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        _animRight.set(Math.cos(yaw), 0, -Math.sin(yaw));

        const moveLen = isMoving ? moveSpeed * Math.hypot(moveX, moveZ) : 0;
        const steps = isMoving ? Math.max(1, Math.ceil(moveLen / 0.1)) : 1;
        const stepSpeed = moveSpeed / steps;

        for (let s = 0; s < steps; s++) {
            if (isMoving) {
                camera.position.addScaledVector(_animForward, moveZ * stepSpeed);
                camera.position.addScaledVector(_animRight, moveX * stepSpeed);
            }

            for (const c of colliders) {
                const dx = camera.position.x - c.x, dz = camera.position.z - c.z;
                const d = Math.hypot(dx, dz), minD = c.r + PLAYER_RADIUS;
                if (d < minD && d > 0.0001) {
                    camera.position.x = c.x + dx / d * minD;
                    camera.position.z = c.z + dz / d * minD;
                }
            }

            if (camera.position.x > 1.7) camera.position.x = 1.7;
            if (camera.position.x < -1.7) camera.position.x = -1.7;
        }

        if (isMoving) {
            footstepTimer += dt;
            if (footstepTimer > stepInterval) {
                playFootstep(stepType);
                footstepTimer = 0;
            }
            creakCooldown -= dt;
            if (creakCooldown <= 0) {
                playWallCreak(scSide(), false);
                creakCooldown = 9 + Math.random() * 14;
            }
        }

        if (NA.wallF && NA.wallF.visible) {
            if (camera.position.z < -24.2) camera.position.z = -24.2;
        } else if (camera.position.z < frontTriggerZ) {
            checkPlayerChoice(true);
        }
        if (camera.position.z > 10.0) checkPlayerChoice(false);
    } else {
        updateStaminaUI();
        if (Math.abs(camera.fov - PLAYER_BODY_CFG.baseFov) > 0.1) {
            camera.fov += (PLAYER_BODY_CFG.baseFov - camera.fov) * 10 * dt;
            camera.updateProjectionMatrix();
        }
    }

    updateNewAnomalies(delta);
    if (inMenu) updateMenuScene(time / 1000, delta);
    else if (menuLampsDirty) restoreLamps();

    updateFlashlightFlicker(delta);
    updateScares(delta);
    updatePlayerBody(dt, {
        isMoving: bodyIsMoving,
        canSprint: bodyCanSprint,
        stepInterval: bodyStepInterval
    });

    const targetPanic = computePanicLevel();
    panicLevel += (targetPanic - panicLevel) * Math.min(1, dt * 3);
    updateHeartbeat(delta, panicLevel);

    if (heartbeatPulse > 0) heartbeatPulse = Math.max(0, heartbeatPulse - dt * 2.4);
    if (vignettePass) {
        vignettePass.uniforms['darkness'].value = 1.4 + panicLevel * 0.95 + heartbeatPulse * 0.25;
    }
    const pv = perfEl('panic-vignette');
    if (pv) {
        const pvVal = gameStarted ? Math.min(0.85, panicLevel * 0.65 + heartbeatPulse * 0.22) : 0;
        if (Math.abs(pvVal - _perfLastPv) > 0.01) {
            pv.style.opacity = pvVal;
            _perfLastPv = pvVal;
        }
    }

    if (playerBody && playerBody.visible && playerBodyParts && playerBodyParts.flashlightLensAnchor) {
        playerBody.updateMatrixWorld(true);
        playerBodyParts.flashlightLensAnchor.getWorldPosition(_flashAnchorPos);
        flashlight.position.copy(_flashAnchorPos);
    } else {
        _flashOffset.set(0.2, -0.2, -0.1).applyQuaternion(camera.quaternion);
        flashlight.position.copy(camera.position).add(_flashOffset);
    }
    camera.getWorldDirection(_camDir);
    flashlightTarget.position.copy(camera.position).add(_camDir.multiplyScalar(10));
    if (flashlightBeam) {
        const beamVisible = perfBeamEnabled && flashlightOn && !NA.blackoutOn && SC.flOff <= 0 && !SC.busy && flashlight.intensity > 0.05;
        flashlightBeam.visible = beamVisible;
        if (beamVisible) {
            flashlightBeam.position.copy(flashlight.position);
            flashlightBeam.lookAt(flashlightTarget.position);
            flashlightBeam.material.uniforms.uOpacity.value = 0.08 * Math.min(1, flashlight.intensity / FLASHLIGHT_BASE_INTENSITY);
        }
    }
    perfFlashShadowTick();
    if (gameStarted && !inMenu && !isTransitioning && panicLevel > 0.22 && SC.freeze <= 0) {
        const s = (panicLevel - 0.22) * 0.015;
        shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
        camera.position.add(shakeOffset);
    } else {
        shakeOffset.set(0, 0, 0);
    }
    updateDustParticles(dt);
    prevTime = time;
    if (!inMenu || time - _perfLastRender >= QUALITY.menuFrameMs) {
        _perfLastRender = time;
        if (SC.freeze <= 0) {
            if (composer) composer.render(delta);
            else renderer.render(scene, camera);
        }
    }
    camera.position.sub(shakeOffset);
    perfDebugTick(delta);
}

function createDustParticles() {
    const count = QUALITY.dustCount;
    const pos = new Float32Array(count * 3);
    dustSeeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
        const bx = (Math.random() - 0.5) * 3.6;
        const by = 0.3 + Math.random() * 3.4;
        const bz = -24 + Math.random() * 34;
        const ph = Math.random() * Math.PI * 2;
        dustSeeds[i * 4] = bx; dustSeeds[i * 4 + 1] = by; dustSeeds[i * 4 + 2] = bz; dustSeeds[i * 4 + 3] = ph;
        pos[i * 3] = bx; pos[i * 3 + 1] = by; pos[i * 3 + 2] = bz;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xb9a98f, size: 0.022, transparent: true, opacity: 0.4, depthWrite: false, sizeAttenuation: true });
    dustPoints = new THREE.Points(geo, mat);
    dustPoints.frustumCulled = false;
    scene.add(dustPoints);
}
let _perfDustAcc = 0;

function updateDustParticles(dt) {
    _perfDustAcc += dt;
    if (_perfDustAcc < 1 / 30) return;
    _perfDustAcc = 0;
    if (!dustPoints || !dustSeeds) return;
    const t = performance.now() * 0.001;
    const attr = dustPoints.geometry.attributes.position;
    const arr = attr.array;
    const n = dustSeeds.length / 4;
    for (let i = 0; i < n; i++) {
        const b = i * 4, ph = dustSeeds[b + 3];
        arr[i * 3] = dustSeeds[b] + Math.sin(t * 0.23 + ph) * 0.14;
        arr[i * 3 + 1] = dustSeeds[b + 1] + Math.sin(t * 0.17 + ph * 1.7) * 0.10;
        arr[i * 3 + 2] = dustSeeds[b + 2] + Math.cos(t * 0.19 + ph * 1.3) * 0.18;
    }
    attr.needsUpdate = true;
}

function setLampLevel(i, level) {
    if (ceilingLights[i]) ceilingLights[i].intensity = 0.6 * level;
    if (lampMeshes[i]) lampMeshes[i].material.emissiveIntensity = 0.8 * level;
    if (lampGlowSprites[i]) {
        lampGlowSprites[i].visible = perfGlowEnabled && level > 0.01;
        lampGlowSprites[i].material.opacity = 0.35 * level;
    }
}

function restoreLamps() {
    for (let i = 0; i < ceilingLights.length; i++) {
        if (NA.blackoutOn) setLampLevel(i, i === 0 ? 0.1 : 0);
        else setLampLevel(i, 1);
    }
    menuFlickerLeft = 0;
    menuLampsDirty = false;
}

function updateMenuScene(t, delta) {
    camera.position.x = Math.sin(t * 0.3) * 0.35;
    camera.position.y = 1.6 + Math.sin(t * 0.5) * 0.03;
    camera.position.z = 7 + Math.sin(t * 0.12) * 1.5;
    camera.rotation.y = Math.sin(t * 0.2) * 0.18;
    camera.rotation.x = Math.sin(t * 0.27) * 0.03;

    const dt = Math.min(delta, 0.1);
    if (menuFlickerLeft > 0) {
        menuLampsDirty = true;
        menuFlickerLeft -= dt;
        menuFlickerStep -= dt;
        if (menuFlickerLeft <= 0) {
            setLampLevel(menuFlickerLamp, 1);
            menuFlickerCooldown = 4 + Math.random() * 8;
        } else if (menuFlickerStep <= 0) {
            menuFlickerStep = 0.04 + Math.random() * 0.08;
            setLampLevel(menuFlickerLamp, Math.random() < 0.5 ? 0 : 0.2 + Math.random() * 0.5);
        }
    } else {
        menuFlickerCooldown -= dt;
        if (menuFlickerCooldown <= 0) {
            menuFlickerLamp = 1 + Math.floor(Math.random() * 3);
            menuFlickerLeft = 0.3 + Math.random() * 0.6;
            menuFlickerStep = 0;
            playClickSound();
        }
    }
}

function updateFlashlightFlicker(delta) {
    if (NA.blackoutOn || SC.busy) {
        flashlight.intensity = (NA.blackoutOn && NA.deadFlashTimer > 0) ? 0.35 : 0;
        return;
    }
    if (!flashlightOn) {
        flickerTimeLeft = 0;
        flashlight.intensity = 0;
        return;
    }
    if (!gameStarted || !flashlightOn || isTransitioning) {
        flickerTimeLeft = 0;
        flashlight.intensity = FLASHLIGHT_BASE_INTENSITY;
        return;
    }

    const dt = Math.min(delta, 0.1);

    if (flickerTimeLeft > 0) {
        flickerTimeLeft -= dt;
        flickerStep -= dt;

        if (flickerTimeLeft <= 0) {
            flashlight.intensity = FLASHLIGHT_BASE_INTENSITY;
            flickerCooldown = 8 + Math.random() * 17;
            playClickSound();
        } else if (flickerStep <= 0) {
            flickerStep = 0.03 + Math.random() * 0.07;
            if (flickerType === 'out' && flickerTimeLeft > 0.15) {
                flashlight.intensity = 0;
            } else {
                flashlight.intensity = Math.random() < 0.4 ? 0 :
                    FLASHLIGHT_BASE_INTENSITY * (0.15 + Math.random() * 0.6);
            }
        }
    } else {
        flashlight.intensity = FLASHLIGHT_BASE_INTENSITY;
        flickerCooldown -= dt;
        if (flickerCooldown <= 0) {
            flickerType = Math.random() < 0.3 ? 'out' : 'stutter';
            flickerTimeLeft = flickerType === 'out' ? 0.5 + Math.random() * 0.8 : 0.2 + Math.random() * 0.4;
            flickerStep = 0;
            playClickSound();
        }
    }
}

function checkPlayerChoice(wentForward) {
    if (isTransitioning) return;
    isTransitioning = true;
    scAbort();
    doorAnimTarget = wentForward ? frontDoorGroup : backDoorGroup;
    playDoorSound();

    const fade = document.getElementById('fade');
    fade.style.opacity = 1;

    setTimeout(() => {
        let hasAnomaly = (currentAnomalyType > 0);
        let correct = (wentForward && !hasAnomaly) || (!wentForward && hasAnomaly);

        if (correct) {
            if (hasAnomaly) { try { markAnomalyDiscovered(currentAnomalyType); } catch (e) { console.warn(e); } }
            currentStage++;
            if (currentStage > 8) {
                currentStage = 0;
                resetStage(true);
                showVictory();
                setTimeout(() => {
                    fade.style.opacity = 0;
                    isTransitioning = false;
                    pendingPause = false;
                }, 150);
                return;
            }
        } else {
            mistakes++;
            showErrorToast(t('toast.wrongRule'));
            currentStage = 0;
        }

        resetStage();

        setTimeout(() => {
            fade.style.opacity = 0;
            isTransitioning = false;
            if (pendingPause) {
                pendingPause = false;
                pauseGame();
            } else {
                updateLockHint();
            }
        }, 150);
    }, 300);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(perfPixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
        if (composer.setPixelRatio) composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(window.innerWidth, window.innerHeight);
        if (bloomPass) {
            bloomPass.setSize(
                Math.max(1, Math.floor((window.innerWidth * perfPixelRatio) / 2)),
                Math.max(1, Math.floor((window.innerHeight * perfPixelRatio) / 2))
            );
        }
    }
}
let _perfWinTime = 0, _perfWinFrames = 0, _perfLastAdapt = 0, _perfFastStreak = 0;
function perfAdaptResolution(delta) {
    if (!perfAutoRes) return;
    if (!gameStarted || inMenu || document.hidden) return;
    if (delta > 0.25) return;
    _perfWinTime += delta;
    _perfWinFrames++;
    if (_perfWinTime < 2.0) return;

    const avgMs = (_perfWinTime / _perfWinFrames) * 1000;
    _perfWinTime = 0;
    _perfWinFrames = 0;

    const now = performance.now();
    let changed = false;
    if (avgMs > 22 && now - _perfLastAdapt >= 5000) {
        const next = Math.max(Math.min(0.6, perfPixelRatioCap), perfPixelRatio - 0.15);
        if (next < perfPixelRatio) {
            perfPixelRatio = next;
            changed = true;
        } else {
            // pixelRatio 0.6 шегіне жеткенде эффекттерді кезекпен өшіру
            perfDowngradeNextEffect();
            _perfLastAdapt = now;
        }
        _perfFastStreak = 0;
    } else {
        _perfFastStreak = 0;
    }

    if (changed) {
        _perfLastAdapt = now;
        renderer.setPixelRatio(perfPixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (composer) {
            if (composer.setPixelRatio) composer.setPixelRatio(perfPixelRatio);
            composer.setSize(window.innerWidth, window.innerHeight);
            if (bloomPass) {
                bloomPass.setSize(
                    Math.max(1, Math.floor((window.innerWidth * perfPixelRatio) / 2)),
                    Math.max(1, Math.floor((window.innerHeight * perfPixelRatio) / 2))
                );
            }
        }
    }
}

// FPS төмендегенде эффекттерді бір-бірден өшіру
function perfDowngradeNextEffect() {
    while (_perfEffectLevel < 5) {
        _perfEffectLevel++;
        if (_perfEffectLevel === 1) {
            if (bloomPass && bloomPass.enabled) { bloomPass.enabled = false; return; }
        } else if (_perfEffectLevel === 2) {
            if (perfBeamEnabled && flashlightBeam) { perfBeamEnabled = false; flashlightBeam.visible = false; return; }
        } else if (_perfEffectLevel === 3) {
            if (perfGlowEnabled && lampGlowSprites.length) {
                perfGlowEnabled = false;
                for (let i = 0; i < lampGlowSprites.length; i++) lampGlowSprites[i].visible = false;
                return;
            }
        } else if (_perfEffectLevel === 4) {
            if (decorGroup && decorGroup.visible) { setDecorVisible(false); return; }
        } else if (_perfEffectLevel === 5) {
            let applied = false;
            for (let i = 0; i < pbrNormalEntries.length; i++) {
                const e = pbrNormalEntries[i];
                if (e.mat && e.mat.normalMap) {
                    e.mat.normalMap = null;
                    e.mat.needsUpdate = true;
                    applied = true;
                }
            }
            const curFlash = perfFlashMode();
            if (userFlashShadow !== 'auto') { /* қолданушы таңдауы автоматты өзгермейді */ }
            else if (curFlash === 'every') { perfFlashShadowOverride = 'half'; perfApplyShadowQuality(); applied = true; }
            else if (curFlash === 'half') { perfFlashShadowOverride = 'off'; perfApplyShadowQuality(); applied = true; }
            if (applied) return;
        }
    }
}

// Жаңа ойын не мәзір кезінде эффекттерді QUALITY күйіне қайтару
function perfResetEffects() {
    _perfEffectLevel = 0;
    if (bloomPass) bloomPass.enabled = !!QUALITY.bloom && userFx.bloom;
    perfBeamEnabled = !!QUALITY.beam && userFx.beam;
    if (flashlightBeam) {
        flashlightBeam.visible = perfBeamEnabled && flashlightOn && (typeof NA === 'undefined' || !NA.blackoutOn);
    }
    perfGlowEnabled = !!QUALITY.glow && userFx.glow;
    for (let i = 0; i < lampGlowSprites.length; i++) {
        lampGlowSprites[i].visible = perfGlowEnabled;
    }
    setDecorVisible(!!(QUALITY.fakeAO || QUALITY.decals > 0) && userFx.decor);
    perfSetFilm(!!QUALITY.film && userFx.film);
    if (QUALITY.normalMaps) {
        for (let i = 0; i < pbrNormalEntries.length; i++) {
            const e = pbrNormalEntries[i];
            if (e.mat && e.normalMap && e.mat.normalMap !== e.normalMap) {
                e.mat.normalMap = e.normalMap;
                e.mat.needsUpdate = true;
            }
        }
    }
    perfFlashShadowOverride = null;
    perfApplyShadowQuality();
}


loadDiscoveredAnomalies();
init();
animate();