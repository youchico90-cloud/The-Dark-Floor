// ================= КЕЙІПКЕРЛЕР ЖҮЙЕСІ =================

function makeGuardPlateTexture(text, bgColor, textColor, borderColor) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = bgColor;
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = borderColor;
    g.lineWidth = 4;
    g.strokeRect(3, 3, c.width - 6, c.height - 6);
    g.fillStyle = textColor;
    g.font = 'bold 26px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
}

function makeGuardBadgeTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#e8eaee';
    g.fillRect(0, 0, 128, 96);
    g.strokeStyle = '#3b4252';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 124, 92);
    g.fillStyle = '#2563eb';
    g.fillRect(12, 16, 36, 48);
    g.fillStyle = '#d1b096';
    g.beginPath();
    g.arc(30, 32, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1f2937';
    g.fillRect(18, 44, 24, 18);
    g.fillStyle = '#374151';
    g.fillRect(58, 22, 54, 8);
    g.fillRect(58, 38, 48, 6);
    g.fillRect(58, 52, 40, 6);
    g.fillStyle = '#b91c1c';
    g.fillRect(12, 74, 104, 8);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
}

function buildGuardCharacter(options) {
    const lowDetail = !!(options && options.lowDetail);
    const cylSegs = lowDetail ? 6 : 10;
    // Домалақ, адамға ұқсас пішіндер үшін көмекші функциялар
    const bodySegs = lowDetail ? 8 : 16;
    const sphW = lowDetail ? 8 : 16, sphH = lowDetail ? 6 : 12;
    const TORSO_Z = 0.56; // кеуде қимасының ені мен тереңдігінің қатынасы (эллипс)
    function ellipsoid(rx, ry, rz, mat) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, sphW, sphH), mat);
        m.scale.set(rx, ry, rz);
        return m;
    }
    function taper(rTop, rBot, h, mat, zScale) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, bodySegs), mat);
        if (zScale && zScale !== 1) m.scale.z = zScale;
        return m;
    }
    function torsoR(y) {
        return 0.205 + 0.02 * Math.min(1, Math.max(0, (y - 0.01) / 0.39));
    }
    // Жалпақ бөлшекті (қалта, жапсырма, бейдж) кеуде бетіне бұрып жабыстыру
    function placeOnTorso(mesh, x, y, off, back) {
        const rx = torsoR(y), rz = rx * TORSO_Z;
        const k = Math.min(0.98, Math.abs(x) / rx);
        let z = rz * Math.sqrt(1 - k * k);
        const nx = x / (rx * rx), nz = z / (rz * rz), len = Math.hypot(nx, nz);
        let ux = nx / len, uz = nz / len;
        if (back) { z = -z; uz = -uz; }
        mesh.position.set(x + ux * off, y, z + uz * off);
        mesh.rotation.y = Math.atan2(ux, uz);
    }

    const root = new THREE.Group();
    root.name = 'GuardCharacter';

    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.85, metalness: 0.08 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x24242c, roughness: 0.88, metalness: 0.05 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x16161b, roughness: 0.82, metalness: 0.12 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.68, metalness: 0.18 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff5a2a, roughness: 0.65, metalness: 0.06 });
    const silverMat = new THREE.MeshStandardMaterial({
        color: 0xd4dae3,
        emissive: 0x2a2e36,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.65
    });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xb58d72, roughness: 0.78 });
    const faceShadowMat = new THREE.MeshStandardMaterial({ color: 0x100f14, roughness: 0.95 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8b24c, roughness: 0.35, metalness: 0.8 });
    const flashBodyMat = new THREE.MeshStandardMaterial({ color: 0x24272e, roughness: 0.45, metalness: 0.55 });
    const flashLensMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfff7dc,
        emissiveIntensity: 1.0,
        roughness: 0.2
    });
    const ledGreenMat = new THREE.MeshStandardMaterial({
        color: 0x33dd66,
        emissive: 0x22cc55,
        emissiveIntensity: 0.9
    });

    // Жамбас тірегі (тұрған кезде y = 0.86 м)
    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 0.86, 0);
    root.add(bodyPivot);

    // --- АЯҚ, ТІЗЕ ЖӘНЕ БЕРЦ ЕТІК (иерархиялық бүгілу үшін) ---
    function buildLeg(sideX) {
        const legPivot = new THREE.Group();
        legPivot.position.set(sideX, 0, 0);

        const thigh = taper(0.074, 0.058, 0.44, pantsMat, 1.05);
        thigh.position.set(0, -0.215, 0);
        legPivot.add(thigh);

        const kneePivot = new THREE.Group();
        kneePivot.position.set(0, -0.43, 0);
        legPivot.add(kneePivot);

        const knee = ellipsoid(0.059, 0.058, 0.062, pantsMat);
        kneePivot.add(knee);

        const shinPants = taper(0.058, 0.056, 0.10, pantsMat, 1.05);
        shinPants.position.set(0, -0.04, 0);
        kneePivot.add(shinPants);

        const shaft = taper(0.058, 0.05, 0.275, bootMat, 1.12);
        shaft.position.set(0, -0.21, -0.005);
        kneePivot.add(shaft);

        if (!lowDetail) {
            for (let i = 0; i < 4; i++) {
                const lace = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.014, 0.012), darkMat);
                lace.position.set(0, -0.31 + i * 0.052, 0.068);
                kneePivot.add(lace);
            }
        }

        const anklePivot = new THREE.Group();
        anklePivot.position.set(0, -0.345, 0);
        kneePivot.add(anklePivot);

        const foot = ellipsoid(0.056, 0.0425, 0.125, bootMat);
        foot.position.set(0, -0.0425, 0.04);
        anklePivot.add(foot);

        return { legPivot, kneePivot, anklePivot };
    }

    const legRight = buildLeg(-0.105);
    const legLeft = buildLeg(0.105);
    bodyPivot.add(legRight.legPivot);
    bodyPivot.add(legLeft.legPivot);

    // Жамбас және белдік
    const pelvis = taper(0.2, 0.2, 0.10, pantsMat, 0.56);
    pelvis.position.set(0, 0.01, 0);
    bodyPivot.add(pelvis);

    const belt = taper(0.21, 0.21, 0.048, darkMat, 0.56);
    belt.position.set(0, 0.045, 0);
    bodyPivot.add(belt);

    if (!lowDetail) {
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.052, 0.016), silverMat);
        buckle.position.set(0, 0.045, 0.123);
        bodyPivot.add(buckle);
    }

    // --- ЖОҒАРҒЫ ДЕНЕ / КҮРТЕШЕ (y = 0.91 -> 1.45 м) ---
    const torsoPivot = new THREE.Group();
    torsoPivot.position.set(0, 0.05, 0);
    bodyPivot.add(torsoPivot);

    const torsoLower = taper(0.225, 0.205, 0.39, jacketMat, TORSO_Z);
    torsoLower.position.set(0, 0.205, 0);
    torsoPivot.add(torsoLower);

    // Иық пен жоғарғы кеудедегі қызғылт-қызыл бөлік (#ff5a2a)
    const torsoYoke = taper(0.19, 0.235, 0.135, orangeMat, TORSO_Z);
    torsoYoke.position.set(0, 0.465, 0);
    torsoPivot.add(torsoYoke);

    // Жаға
    const collar = taper(0.078, 0.086, 0.055, darkMat, 1.0);
    collar.position.set(0, 0.545, 0);
    torsoPivot.add(collar);

    // Ортаңғы сыдырма және қалталар
    if (!lowDetail) {
        const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.36, 0.01), darkMat);
        zipper.position.set(0, 0.22, 0.121);
        torsoPivot.add(zipper);

        [-0.125, 0.125].forEach(px => {
            const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.015), darkMat);
            placeOnTorso(pocket, px, 0.12, 0.006, false);
            torsoPivot.add(pocket);
        });
    }

    // Арқадағы күміс шағылыстырғыш жолақ
    const chestReflectBack = taper(0.227, 0.227, 0.028, silverMat, TORSO_Z);
    chestReflectBack.position.set(0, 0.365, 0);
    torsoPivot.add(chestReflectBack);

    // Арқадағы "КҮЗЕТ ҚЫЗМЕТІ" жазуы
    const backPlateTex = makeGuardPlateTexture(t('char.plate'), '#222229', '#e5e7eb', '#9ca3af');
    const backPlateMat = new THREE.MeshStandardMaterial({ map: backPlateTex, roughness: 0.7 });
    const backPlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.072, 0.01), backPlateMat);
    placeOnTorso(backPlate, 0, 0.335, 0.004, true);
    torsoPivot.add(backPlate);

    // Алдыңғы оң жақ кеудедегі "КҮЗЕТ ҚЫЗМЕТІ" жапсырмасы
    const frontPatchTex = makeGuardPlateTexture(t('char.plate'), '#1d1d24', '#e5e7eb', '#9ca3af');
    const frontPatchMat = new THREE.MeshStandardMaterial({ map: frontPatchTex, roughness: 0.7 });
    const frontPatch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.034, 0.01), frontPatchMat);
    placeOnTorso(frontPatch, -0.12, 0.335, 0.004, false);
    torsoPivot.add(frontPatch);

    // Сол жақ кеудедегі рация
    const radioGroup = new THREE.Group();
    const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.105, 0.036), darkMat);
    radioGroup.add(radioBody);
    if (!lowDetail) {
        const radioGrille = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.042, 0.008), jacketMat);
        radioGrille.position.set(0, 0.012, 0.018);
        radioGroup.add(radioGrille);
        const radioLed = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.008), ledGreenMat);
        radioLed.position.set(-0.014, 0.04, 0.018);
        radioGroup.add(radioLed);
    }
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.085, 6), darkMat);
    antenna.position.set(0.015, 0.09, 0);
    radioGroup.add(antenna);
    placeOnTorso(radioGroup, 0.125, 0.39, 0.02, false);
    torsoPivot.add(radioGroup);

    // Сол жақ кеудедегі бейдж
    const badgeTex = makeGuardBadgeTexture();
    const badgeMat = new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.55 });
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.056, 0.008), badgeMat);
    placeOnTorso(badge, 0.125, 0.285, 0.004, false);
    torsoPivot.add(badge);

    // Мойындағы бау және кілт
    if (!lowDetail) {
        const lanyardL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.008), darkMat);
        lanyardL.position.set(-0.045, 0.43, 0.127);
        lanyardL.rotation.z = -0.36;
        torsoPivot.add(lanyardL);

        const lanyardR = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.008), darkMat);
        lanyardR.position.set(0.045, 0.43, 0.127);
        lanyardR.rotation.z = 0.36;
        torsoPivot.add(lanyardR);
    }

    const keyGroup = new THREE.Group();
    const keyHead = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.008), goldMat);
    keyHead.position.set(0, 0.018, 0);
    keyGroup.add(keyHead);
    const keyShaft = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.045, 0.006), goldMat);
    keyShaft.position.set(0, -0.016, 0);
    keyGroup.add(keyShaft);
    if (!lowDetail) {
        const keyTooth = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.014, 0.006), goldMat);
        keyTooth.position.set(0.008, -0.028, 0);
        keyGroup.add(keyTooth);
    }
    keyGroup.position.set(0, 0.305, 0.13);
    torsoPivot.add(keyGroup);

    // --- ҚОЛДАР ЖӘНЕ ФОНАРИК ---
    let flashlightGroup = null;
    let flashlightLensAnchor = null;
    let flashlightLensMesh = null;

    function buildArm(side) {
        // side: -1 = оң қол (фонарикпен), +1 = сол қол
        const armPivot = new THREE.Group();
        armPivot.position.set(side * 0.295, 0.475, 0);

        const sleeveTop = ellipsoid(0.082, 0.075, 0.072, orangeMat);
        sleeveTop.position.set(side * 0.004, -0.012, 0);
        armPivot.add(sleeveTop);

        const sleeveMain = taper(0.064, 0.053, 0.40, jacketMat, 1.05);
        sleeveMain.position.set(0, -0.26, 0);
        armPivot.add(sleeveMain);

        // Жеңнің сыртындағы қызғылт-қызыл тік жолақ
        const outerStripe = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.36, 0.056), orangeMat);
        outerStripe.position.set(side * 0.064, -0.24, 0);
        armPivot.add(outerStripe);

        // Жеңдегі 2 күміс шағылыстырғыш жолақ
        [-0.14, -0.35].forEach(ry => {
            const rr = 0.064 - 0.011 * ((-ry - 0.06) / 0.40) + 0.005;
            const refBand = taper(rr, rr, 0.038, silverMat, 1.05);
            refBand.position.set(0, ry, 0);
            armPivot.add(refBand);
        });

        // Қолдың басы
        const hand = ellipsoid(0.044, 0.056, 0.05, skinMat);
        hand.position.set(0, -0.505, 0);
        armPivot.add(hand);

        if (side === -1) {
            armPivot.rotation.z = -0.14;
            armPivot.rotation.x = -0.22;

            // Фонарик
            const flash = new THREE.Group();
            const fBody = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.021, 0.17, cylSegs), flashBodyMat);
            fBody.rotation.x = Math.PI / 2;
            flash.add(fBody);

            const fHead = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.048, cylSegs), flashBodyMat);
            fHead.rotation.x = Math.PI / 2;
            fHead.position.set(0, 0, 0.098);
            flash.add(fHead);

            const fLens = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.012, cylSegs), flashLensMat);
            fLens.rotation.x = Math.PI / 2;
            fLens.position.set(0, 0, 0.123);
            flash.add(fLens);

            const lensAnchor = new THREE.Object3D();
            lensAnchor.position.set(0, 0, 0.145);
            flash.add(lensAnchor);

            flash.position.set(-0.01, -0.525, 0.05);
            flash.rotation.x = 0.25;
            armPivot.add(flash);

            // SpotLight сәулесін бөгемеу үшін фонарик қолын белгілеу
            armPivot.traverse(obj => {
                obj.userData.noFlashShadow = true;
            });

            flashlightGroup = flash;
            flashlightLensAnchor = lensAnchor;
            flashlightLensMesh = fLens;
        } else {
            armPivot.rotation.z = 0.12;
        }

        return armPivot;
    }

    const armRightPivot = buildArm(-1);
    const armLeftPivot = buildArm(1);
    torsoPivot.add(armRightPivot);
    torsoPivot.add(armLeftPivot);

    // --- БАС ЖӘНЕ КЕПКА (1.45 -> 1.80 м) ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.54, 0);
    torsoPivot.add(headGroup);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.072, 0.085, cylSegs), skinMat);
    neck.position.set(0, 0.03, 0);
    headGroup.add(neck);

    const head = ellipsoid(0.094, 0.112, 0.102, skinMat);
    head.position.set(0, 0.16, 0);
    headGroup.add(head);

    // Иек, құлақ, мұрын, көз және ауыз — бет адамға ұқсасын деп
    const jaw = ellipsoid(0.07, 0.062, 0.078, skinMat);
    jaw.position.set(0, 0.108, 0.014);
    headGroup.add(jaw);

    [-1, 1].forEach(sx => {
        const ear = ellipsoid(0.014, 0.03, 0.022, skinMat);
        ear.position.set(sx * 0.097, 0.16, -0.004);
        headGroup.add(ear);
    });

    const nose = ellipsoid(0.014, 0.022, 0.02, skinMat);
    nose.position.set(0, 0.145, 0.1);
    headGroup.add(nose);

    if (!lowDetail) {
        const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.5 });
        [-1, 1].forEach(sx => {
            const eye = ellipsoid(0.014, 0.01, 0.007, eyeWhiteMat);
            eye.position.set(sx * 0.039, 0.172, 0.094);
            headGroup.add(eye);
            const pupil = ellipsoid(0.007, 0.007, 0.004, faceShadowMat);
            pupil.position.set(sx * 0.039, 0.172, 0.099);
            headGroup.add(pupil);
            const brow = ellipsoid(0.019, 0.004, 0.006, faceShadowMat);
            brow.position.set(sx * 0.039, 0.19, 0.093);
            brow.rotation.z = sx * -0.12;
            headGroup.add(brow);
        });
        const mouth = ellipsoid(0.024, 0.004, 0.006, faceShadowMat);
        mouth.position.set(0, 0.098, 0.088);
        headGroup.add(mouth);
    }

    const capCrown = new THREE.Mesh(new THREE.SphereGeometry(1, sphW, sphH, 0, Math.PI * 2, 0, Math.PI / 2), darkMat);
    capCrown.scale.set(0.106, 0.1, 0.113);
    capCrown.position.set(0, 0.235, -0.002);
    headGroup.add(capCrown);

    const capTop = ellipsoid(0.014, 0.01, 0.014, darkMat);
    capTop.position.set(0, 0.335, -0.002);
    headGroup.add(capTop);

    const capVisor = ellipsoid(0.098, 0.009, 0.075, darkMat);
    capVisor.position.set(0, 0.238, 0.14);
    capVisor.rotation.x = 0.12;
    headGroup.add(capVisor);

    const capStrap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.028, 0.016), jacketMat);
    capStrap.position.set(0, 0.25, -0.117);
    headGroup.add(capStrap);

    // 2-қадамда анимация мен бірінші жақтан басқару үшін буын сілтемелері
    root.userData.parts = {
        bodyPivot,
        torsoPivot,
        collar,
        headGroup,
        armLeftPivot,
        armRightPivot,
        legLeftPivot: legLeft.legPivot,
        kneeLeftPivot: legLeft.kneePivot,
        ankleLeftPivot: legLeft.anklePivot,
        legRightPivot: legRight.legPivot,
        kneeRightPivot: legRight.kneePivot,
        ankleRightPivot: legRight.anklePivot,
        flashlightGroup,
        flashlightLensAnchor,
        flashlightLensMesh
    };

    return root;
}

const CHARACTERS = [
    {
        id: 'guard',
        get name() { return t('char.guard.name'); },
        get description() { return t('char.guard.desc'); },
        build: buildGuardCharacter
    },
    {
        id: 'default',
        get name() { return t('char.default.name'); },
        get description() { return t('char.default.desc'); },
        build: function () { return null; }
    }
];

const CHARACTER_STORAGE_KEY = 'selectedCharacterId';

function loadSelectedCharacterId() {
    let saved = null;
    try {
        saved = localStorage.getItem(CHARACTER_STORAGE_KEY);
    } catch (e) {}
    if (saved && CHARACTERS.some(c => c.id === saved)) {
        return saved;
    }
    return 'default';
}

function saveSelectedCharacterId(id) {
    window.selectedCharacterId = id;
    try {
        localStorage.setItem(CHARACTER_STORAGE_KEY, String(id));
    } catch (e) {}
}

function getSelectedCharacter() {
    const id = window.selectedCharacterId || 'default';
    return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

function disposeObject3D(root) {
    if (!root) return;
    root.traverse(obj => {
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (let i = 0; i < mats.length; i++) {
                const m = mats[i];
                if (!m) continue;
                if (m.map) m.map.dispose();
                if (m.emissiveMap) m.emissiveMap.dispose();
                if (m.normalMap) m.normalMap.dispose();
                if (m.roughnessMap) m.roughnessMap.dispose();
                m.dispose();
            }
        }
    });
}

window.CHARACTERS = CHARACTERS;
window.selectedCharacterId = loadSelectedCharacterId();
window.getSelectedCharacter = getSelectedCharacter;
window.disposeCharacterObject = disposeObject3D;

// ================= 3D ПРЕВЬЮ МОДАЛЫ =================
let charPreviewIndex = 0;
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewMesh = null;
let previewRafId = null;
let previewLastTime = 0;

function initPreviewRenderer() {
    const canvas = document.getElementById('char-preview-canvas');
    if (!canvas || typeof THREE === 'undefined') return false;

    const wrap = document.getElementById('char-preview-wrap');
    const w = (wrap && wrap.clientWidth) ? wrap.clientWidth : 240;
    const h = (wrap && wrap.clientHeight) ? wrap.clientHeight : 280;

    try {
        previewRenderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'low-power'
        });
        previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        previewRenderer.setSize(w, h, false);
        previewRenderer.outputEncoding = THREE.sRGBEncoding;

        previewScene = new THREE.Scene();

        previewCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 20);
        previewCamera.position.set(0, 1.02, 3.05);
        previewCamera.lookAt(0, 0.90, 0);

        const hemi = new THREE.HemisphereLight(0xd8e0f0, 0x261a14, 0.95);
        previewScene.add(hemi);

        const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.25);
        keyLight.position.set(2.2, 3.2, 2.8);
        previewScene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0xb02020, 0.55);
        rimLight.position.set(-2.4, 2.0, -2.2);
        previewScene.add(rimLight);

        // Тұғыр дискі
        const ped = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.60, 0.04, 24),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.7, metalness: 0.3 })
        );
        ped.position.set(0, -0.02, 0);
        ped.userData.isPedestal = true;
        previewScene.add(ped);

        return true;
    } catch (e) {
        previewRenderer = null;
        return false;
    }
}

function renderPreviewCharacter() {
    const ch = CHARACTERS[charPreviewIndex];
    if (!ch) return;

    const nameEl = document.getElementById('char-name');
    const descEl = document.getElementById('char-desc');
    const statusEl = document.getElementById('char-status');
    const emptyEl = document.getElementById('char-empty-label');
    const selectBtn = document.getElementById('char-select-btn');

    if (nameEl) nameEl.textContent = ch.name;
    if (descEl) descEl.textContent = ch.description;

    const isSelected = (window.selectedCharacterId === ch.id);
    if (statusEl) {
        statusEl.textContent = isSelected ? t('char.statusSelected') : t('char.statusNot');
        statusEl.classList.toggle('is-selected', isSelected);
    }
    if (selectBtn) {
        selectBtn.textContent = isSelected ? t('char.selected') : t('char.select');
        selectBtn.disabled = isSelected;
    }

    if (previewMesh && previewScene) {
        previewScene.remove(previewMesh);
        disposeObject3D(previewMesh);
        previewMesh = null;
    }

    const built = typeof ch.build === 'function' ? ch.build({ lowDetail: false }) : null;
    if (built && previewScene) {
        previewMesh = built;
        previewMesh.rotation.y = 0.25;
        previewScene.add(previewMesh);
        if (emptyEl) emptyEl.style.display = 'none';
    } else {
        if (emptyEl) emptyEl.style.display = 'flex';
    }
}

function previewAnimate(now) {
    previewRafId = requestAnimationFrame(previewAnimate);
    if (!previewRenderer || !previewScene || !previewCamera) return;

    const dt = previewLastTime ? Math.min((now - previewLastTime) / 1000, 0.1) : 0.016;
    previewLastTime = now;

    if (previewMesh) {
        previewMesh.rotation.y += dt * 0.75;
    }

    previewRenderer.render(previewScene, previewCamera);
}

function cleanupPreviewRenderer() {
    if (previewRafId !== null) {
        cancelAnimationFrame(previewRafId);
        previewRafId = null;
    }
    previewLastTime = 0;

    if (previewMesh && previewScene) {
        previewScene.remove(previewMesh);
        disposeObject3D(previewMesh);
        previewMesh = null;
    }
    if (previewScene) {
        disposeObject3D(previewScene);
        previewScene = null;
    }
    previewCamera = null;

    if (previewRenderer) {
        try { previewRenderer.dispose(); } catch (e) {}
        previewRenderer = null;
    }

    // WebGL контекстін толық босату үшін canvas элементін жаңасымен алмастыру
    const oldCanvas = document.getElementById('char-preview-canvas');
    if (oldCanvas && oldCanvas.parentNode) {
        const freshCanvas = document.createElement('canvas');
        freshCanvas.id = 'char-preview-canvas';
        oldCanvas.parentNode.replaceChild(freshCanvas, oldCanvas);
    }
}

function openCharacterModal() {
    const modal = document.getElementById('character-modal');
    if (!modal) return;

    const idx = CHARACTERS.findIndex(c => c.id === window.selectedCharacterId);
    charPreviewIndex = idx >= 0 ? idx : 0;

    modal.style.display = 'flex';
    cleanupPreviewRenderer();

    const ok = initPreviewRenderer();
    renderPreviewCharacter();
    if (ok) {
        previewLastTime = 0;
        previewRafId = requestAnimationFrame(previewAnimate);
    }
}

function closeCharacterModal() {
    cleanupPreviewRenderer();
    const modal = document.getElementById('character-modal');
    if (modal) modal.style.display = 'none';
}

function prevCharacter() {
    charPreviewIndex = (charPreviewIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
    renderPreviewCharacter();
}

function nextCharacter() {
    charPreviewIndex = (charPreviewIndex + 1) % CHARACTERS.length;
    renderPreviewCharacter();
}

function selectPreviewCharacter() {
    const ch = CHARACTERS[charPreviewIndex];
    if (!ch) return;
    saveSelectedCharacterId(ch.id);
    if (typeof window.syncInGamePlayerBody === 'function') {
        window.syncInGamePlayerBody();
    }
    renderPreviewCharacter();
}