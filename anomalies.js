const TOTAL_ANOMALIES = 40;
let currentStage = 0;
let currentAnomalyType = 0;
let lastAnomalyType = 0;
let anomalyBag = [];
let frontTriggerZ = -23.5;
const NA = { ready: false };
const _perfCanvasLast = {};
function perfCanvasDue(key) {
    const now = performance.now();
    const last = _perfCanvasLast[key];
    if (last === undefined || now - last >= 1000 / QUALITY.canvasHz) {
        _perfCanvasLast[key] = now;
        return true;
    }
    return false;
}
let discoveredAnomalies = new Set();

function buildNewAnomalyObjects() {
    NA.ready = true;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const doors = [frontDoorGroup, backDoorGroup];

    NA.parts = []; NA.far = []; NA.frontEnds = [];
    const box = new THREE.Box3(), c = new THREE.Vector3();
    const pushObj = (o) => {
        if (o.isLight || o === camera || doors.indexOf(o) >= 0) return;
        if (o.userData && o.userData.ignoreAnomaly) return;
        if (typeof decorGroup !== 'undefined' && o === decorGroup) {
            decorGroup.children.forEach(pushObj);
            return;
        }
        if (o.isMesh && o.userData && o.userData.corridorSpan) { NA.parts.push(o); return; }
        if (o.isMesh && o.userData && o.userData.followFront) { NA.frontEnds.push(o); return; }
        if (o.isMesh && o.geometry.type === 'PlaneGeometry') {
            const p = o.geometry.parameters;
            if ((p.width === 4 && p.height === 38) || (p.width === 38 && p.height === 4)) { NA.parts.push(o); return; }
        }
        if (o.isMesh || o.isGroup) { box.setFromObject(o); box.getCenter(c); NA.far.push({ o: o, z: c.z }); }
    };
    scene.children.forEach(pushObj);

    const bt = rightWallMesh.material.map ? rightWallMesh.material.map.clone() : null;
    if (bt) { bt.repeat.set(4, 4); bt.needsUpdate = true; }
    const ewMat = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.9, map: bt });
    NA.wallF = new THREE.Mesh(new THREE.PlaneGeometry(4.02, 4.02), ewMat);
    NA.wallF.position.set(0, 2, -24.96);
    NA.wallF.receiveShadow = true;
    NA.wallF.visible = false;
    scene.add(NA.wallF);

    NA.eyeCv = document.createElement('canvas'); NA.eyeCv.width = NA.eyeCv.height = 256;
    NA.eyeTex = markSRGB(new THREE.CanvasTexture(NA.eyeCv));
    const wc = document.createElement('canvas'); wc.width = wc.height = 4;
    const wg = wc.getContext('2d'); wg.fillStyle = '#fff'; wg.fillRect(0, 0, 4, 4);
    NA.paintIdle = markSRGB(new THREE.CanvasTexture(wc));

    // 8: Тамшы және шұңқыр
    const sx = 0.4, sz = -3;
    NA.src = { x: sx, z: sz };
    const dg = new THREE.Group(); dg.visible = false; scene.add(dg); NA.drip = dg;
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshBasicMaterial({ color: 0x120404 }));
    stain.rotation.x = Math.PI / 2; stain.position.set(sx, 3.985, sz); dg.add(stain);
    const pc = document.createElement('canvas'); pc.width = pc.height = 128;
    const pg = pc.getContext('2d'), gr = pg.createRadialGradient(64, 64, 2, 64, 64, 62);
    gr.addColorStop(0, 'rgba(6,0,0,0.97)'); gr.addColorStop(0.7, 'rgba(28,0,0,0.85)'); gr.addColorStop(1, 'rgba(40,0,0,0)');
    pg.fillStyle = gr; pg.fillRect(0, 0, 128, 128);
    NA.pit = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshStandardMaterial({
        map: markSRGB(new THREE.CanvasTexture(pc)), transparent: true, depthWrite: false, roughness: 0.1, metalness: 0.3,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    }));
    NA.pit.rotation.x = -Math.PI / 2; NA.pit.position.set(sx, 0.012, sz); dg.add(NA.pit);
    NA.ripples = []; NA.drops = [];
    for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 24), new THREE.MeshBasicMaterial({
            color: 0x5a0b0b, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide
        }));
        r.rotation.x = -Math.PI / 2; r.position.set(sx, 0.02, sz); r.visible = false; r.userData.t = 1;
        dg.add(r); NA.ripples.push(r);
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0x6a0000, emissive: 0x200000, roughness: 0.2 }));
        d.scale.y = 1.8; d.position.set(sx + rnd(-0.03, 0.03), 3.9, sz + rnd(-0.03, 0.03));
        d.userData = { y: 3.9, vy: 0, wait: 0 };
        dg.add(d); NA.drops.push(d);
    }

    // 11: Көлеңкелі елес
    const gc = document.createElement('canvas'); gc.width = 128; gc.height = 256;
    const gg = gc.getContext('2d');
    gg.shadowColor = 'rgba(20,20,26,1)'; gg.shadowBlur = 6; gg.fillStyle = '#16161b';
    gg.beginPath(); gg.arc(64, 34, 20, 0, Math.PI * 2); gg.fill();
    gg.fillRect(56, 50, 16, 14);
    gg.beginPath(); gg.moveTo(30, 66); gg.lineTo(98, 66); gg.lineTo(104, 150); gg.lineTo(24, 150); gg.closePath(); gg.fill();
    gg.fillRect(16, 70, 12, 100); gg.fillRect(100, 70, 12, 100);
    gg.fillRect(36, 150, 22, 96); gg.fillRect(70, 150, 22, 96);
    gg.shadowBlur = 0; gg.fillStyle = '#d8e6e0'; gg.fillRect(55, 31, 5, 3); gg.fillRect(68, 31, 5, 3);
    NA.ghost = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.85), new THREE.MeshBasicMaterial({
        map: markSRGB(new THREE.CanvasTexture(gc)), transparent: true, fog: true, depthWrite: false, opacity: 0
    }));
    NA.ghost.position.set(0, 0.92, -16); NA.ghost.visible = false; scene.add(NA.ghost);

    // 12: Көлеңкелер аномалиясы
    NA.shadowCv = document.createElement('canvas'); NA.shadowCv.width = 256; NA.shadowCv.height = 512;
    NA.shadowTex = markSRGB(new THREE.CanvasTexture(NA.shadowCv));
    NA.shadowWall = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 2.2),
        new THREE.MeshBasicMaterial({
            map: NA.shadowTex, transparent: true, depthWrite: false, opacity: 0.44,
            polygonOffset: true, polygonOffsetFactor: -2
        })
    );
    NA.shadowWall.position.set(1.975, 1.1, 4.5);
    NA.shadowWall.rotation.y = -Math.PI / 2;
    NA.shadowWall.visible = false;
    scene.add(NA.shadowWall);

    // 13: Жоғалатын еден (Pitfall)
    NA.floorSplit = new THREE.Group();
    NA.floorSplit.visible = false;
    const makeSplitFloor = (len, zCenter) => {
        const tex = concreteTex ? concreteTex.clone() : null;
        if (tex) { tex.repeat.set(4, len); tex.needsUpdate = true; }
        const mat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9, map: tex });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(4, len), mat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(0, 0, zCenter);
        m.receiveShadow = true;
        return m;
    };
    NA.floorSplit.add(makeSplitFloor(19.5, 2.25));
    NA.floorSplit.add(makeSplitFloor(12.5, -19.75));
    scene.add(NA.floorSplit);

    NA.abyssGroup = new THREE.Group();
    NA.abyssGroup.visible = false;
    const pitWallMat = new THREE.MeshBasicMaterial({ color: 0x050507 });
    const pwFB = new THREE.PlaneGeometry(4, 18);
    const pwLR = new THREE.PlaneGeometry(6, 18);
    const pBack = new THREE.Mesh(pwFB, pitWallMat); pBack.position.set(0, -9, -7.5); pBack.rotation.y = Math.PI; NA.abyssGroup.add(pBack);
    const pFront = new THREE.Mesh(pwFB, pitWallMat); pFront.position.set(0, -9, -13.5); NA.abyssGroup.add(pFront);
    const pLeft = new THREE.Mesh(pwLR, pitWallMat); pLeft.position.set(-2, -9, -10.5); pLeft.rotation.y = Math.PI / 2; NA.abyssGroup.add(pLeft);
    const pRight = new THREE.Mesh(pwLR, pitWallMat); pRight.position.set(2, -9, -10.5); pRight.rotation.y = -Math.PI / 2; NA.abyssGroup.add(pRight);
    const pBottom = new THREE.Mesh(new THREE.PlaneGeometry(4, 6), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    pBottom.position.set(0, -18, -10.5); pBottom.rotation.x = -Math.PI / 2; NA.abyssGroup.add(pBottom);

    const epCv = document.createElement('canvas'); epCv.width = 128; epCv.height = 48;
    const epG = epCv.getContext('2d');
    const drawGlowEye = (cx) => {
        const g = epG.createRadialGradient(cx, 24, 1, cx, 24, 18);
        g.addColorStop(0, 'rgba(255,235,220,1)');
        g.addColorStop(0.35, 'rgba(210,30,30,0.85)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        epG.fillStyle = g; epG.fillRect(cx - 18, 6, 36, 36);
    };
    drawGlowEye(38); drawGlowEye(90);
    NA.glowEyeTex = markSRGB(new THREE.CanvasTexture(epCv));

    NA.abyssEyes = [];
    [[-0.9, -4.5, -9.2], [0.8, -6.8, -11.5], [-0.2, -9.5, -10.4], [1.1, -3.4, -12.1], [-1.1, -8.0, -11.9]].forEach(([ex, ey, ez]) => {
        const em = new THREE.Mesh(
            new THREE.PlaneGeometry(0.4, 0.15),
            new THREE.MeshBasicMaterial({ map: NA.glowEyeTex, transparent: true, fog: false, depthWrite: false })
        );
        em.position.set(ex, ey, ez);
        em.rotation.x = -Math.PI / 2;
        NA.abyssGroup.add(em);
        NA.abyssEyes.push(em);
    });
    scene.add(NA.abyssGroup);

    // 14: Айна қатесі
    NA.mirrorGroup = new THREE.Group();
    NA.mirrorGroup.visible = false;
    const mFrameMat = new THREE.MeshStandardMaterial({ color: 0x2e1a0f, metalness: 0.35, roughness: 0.5 });
    const mFrame = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.75, 1.18), mFrameMat);
    NA.mirrorGroup.add(mFrame);
    NA.mirrorCv = document.createElement('canvas'); NA.mirrorCv.width = 256; NA.mirrorCv.height = 384;
    NA.mirrorTex = markSRGB(new THREE.CanvasTexture(NA.mirrorCv));
    const mGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(1.04, 1.58),
        new THREE.MeshStandardMaterial({ map: NA.mirrorTex, roughness: 0.12, metalness: 0.45 })
    );
    mGlass.rotation.y = Math.PI / 2;
    mGlass.position.x = 0.05;
    NA.mirrorGroup.add(mGlass);
    NA.mirrorGroup.position.set(-1.95, 1.9, -10);
    scene.add(NA.mirrorGroup);

    // 15: Фонарик өшіру режимі
    NA.eyesGroup = new THREE.Group();
    NA.eyesGroup.visible = false;
    NA.blackoutEyes = [];
    const eyeSpots = [
        [-0.7, 1.55, -3.5], [0.85, 1.75, -6.5], [-0.2, 1.65, -10.5],
        [1.1, 1.35, -14.0], [-0.95, 1.85, -17.5], [0.25, 1.50, -21.0]
    ];
    eyeSpots.forEach(([x, y, z], idx) => {
        const mat = new THREE.MeshBasicMaterial({
            map: NA.glowEyeTex, transparent: true, fog: false, depthWrite: false, opacity: 0.55
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.08), mat);
        m.position.set(x, y, z);
        m.userData = { baseX: x, baseY: y, phase: idx * 1.4 };
        NA.eyesGroup.add(m);
        NA.blackoutEyes.push(m);
    });
    scene.add(NA.eyesGroup);

    // 18: Жалаң аяқ қанды іздер тізбегі
    NA.footprints = new THREE.Group();
    NA.footprints.visible = false;
    const fpCv = document.createElement('canvas'); fpCv.width = 64; fpCv.height = 128;
    const fpG = fpCv.getContext('2d');
    fpG.fillStyle = 'rgba(72, 4, 4, 0.85)';
    fpG.beginPath(); fpG.ellipse(32, 42, 14, 24, 0, 0, Math.PI * 2); fpG.fill();
    fpG.beginPath(); fpG.ellipse(32, 92, 10, 16, 0, 0, Math.PI * 2); fpG.fill();
    for (let t = 0; t < 5; t++) {
        fpG.beginPath(); fpG.arc(19 + t * 6.5, 14 + Math.abs(t - 2) * 2, 3.2, 0, Math.PI * 2); fpG.fill();
    }
    const fpTex = markSRGB(new THREE.CanvasTexture(fpCv));
    const fpMat = new THREE.MeshStandardMaterial({
        map: fpTex, transparent: true, depthWrite: false, roughness: 0.35,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    for (let i = 0; i < 10; i++) {
        const step = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.32), fpMat);
        step.rotation.x = -Math.PI / 2;
        step.rotation.z = (i % 2 === 0 ? 0.08 : -0.08);
        step.position.set((i % 2 === 0 ? -0.16 : 0.16) - 0.25, 0.01, -22 + i * 1.05);
        NA.footprints.add(step);
    }
    scene.add(NA.footprints);

    // 19: Сәл ашылған алдыңғы есік пен саңылаудан қараған саусақтар мен көз
    NA.doorVoid = new THREE.Mesh(
        new THREE.PlaneGeometry(2.1, 3.6),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    NA.doorVoid.position.set(0, 1.75, -25.12);
    NA.doorVoid.visible = false;
    scene.add(NA.doorVoid);

    NA.doorHand = new THREE.Group();
    NA.doorHand.visible = false;
    const paleMat = new THREE.MeshStandardMaterial({ color: 0x8d887e, roughness: 0.7 });
    for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.14, 8), paleMat);
        f.rotation.z = Math.PI / 2;
        f.position.set(0.95, 1.38 + i * 0.042, -24.75);
        NA.doorHand.add(f);
    }
    const peepEye = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, 0.08),
        new THREE.MeshBasicMaterial({ map: NA.glowEyeTex, transparent: true, depthWrite: false })
    );
    peepEye.position.set(0.88, 1.62, -25.0);
    NA.doorHand.add(peepEye);
    scene.add(NA.doorHand);

    // 20: Бұрмаланған қорқынышты плакат пен қосымша плакаттар
    const cpCv = document.createElement('canvas'); cpCv.width = 200; cpCv.height = 280;
    const cpg = cpCv.getContext('2d');
    cpg.beginPath();
    cpg.moveTo(0, 0); cpg.lineTo(200, 0); cpg.lineTo(200, 230); cpg.lineTo(165, 252);
    cpg.lineTo(178, 280); cpg.lineTo(0, 280); cpg.closePath();
    cpg.fillStyle = '#aba07d'; cpg.fill();
    cpg.save(); cpg.clip();
    cpg.fillStyle = '#38342b'; cpg.fillRect(20, 25, 160, 190);
    cpg.fillStyle = '#8e8674';
    cpg.beginPath(); cpg.ellipse(100, 112, 42, 58, 0, 0, Math.PI * 2); cpg.fill();
    cpg.fillStyle = '#080606';
    cpg.beginPath(); cpg.ellipse(80, 96, 11, 14, 0, 0, Math.PI * 2); cpg.fill();
    cpg.beginPath(); cpg.ellipse(120, 96, 11, 14, 0, 0, Math.PI * 2); cpg.fill();
    cpg.fillStyle = '#fff';
    cpg.fillRect(79, 95, 3, 3); cpg.fillRect(119, 95, 3, 3);
    cpg.fillStyle = '#050202';
    cpg.beginPath(); cpg.ellipse(100, 144, 16, 26, 0, 0, Math.PI * 2); cpg.fill();
    cpg.fillStyle = '#3a0505';
    cpg.fillRect(30, 232, 120, 6); cpg.fillRect(30, 248, 95, 6);
    cpg.restore();
    NA.creepyPosterTex = markSRGB(new THREE.CanvasTexture(cpCv));

    NA.extraPosters = new THREE.Group();
    NA.extraPosters.visible = false;
    const epMat = new THREE.MeshStandardMaterial({ map: NA.creepyPosterTex, alphaTest: 0.5, roughness: 1 });
    [[1.98, 1.85, -6.2, -Math.PI / 2, 0.05], [-1.98, 1.72, -11.5, Math.PI / 2, -0.08], [1.98, 1.78, -19.5, -Math.PI / 2, 0.04]].forEach(([x, y, z, ry, rz]) => {
        const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.72), epMat);
        pm.position.set(x, y, z);
        pm.rotation.y = ry;
        pm.rotation.z = rz;
        NA.extraPosters.add(pm);
    });
    scene.add(NA.extraPosters);

    // 21: Тұрақты қабырға сағаты (қалыптыда алға, 21-де кері жүреді)
    const clkCv = document.createElement('canvas'); clkCv.width = 256; clkCv.height = 256;
    const cg = clkCv.getContext('2d');
    cg.fillStyle = '#cdc6b4'; cg.beginPath(); cg.arc(128, 128, 124, 0, Math.PI * 2); cg.fill();
    const clkVig = cg.createRadialGradient(128, 128, 50, 128, 128, 126);
    clkVig.addColorStop(0, 'rgba(0,0,0,0)'); clkVig.addColorStop(1, 'rgba(40,32,20,0.38)');
    cg.fillStyle = clkVig; cg.beginPath(); cg.arc(128, 128, 124, 0, Math.PI * 2); cg.fill();
    cg.strokeStyle = '#201d18'; cg.lineWidth = 5;
    cg.beginPath(); cg.arc(128, 128, 118, 0, Math.PI * 2); cg.stroke();
    for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const maj = i % 5 === 0;
        const r0 = maj ? 94 : 103, r1 = 112;
        cg.strokeStyle = maj ? '#151310' : '#4a4338';
        cg.lineWidth = maj ? 4 : 1.5;
        cg.beginPath();
        cg.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0);
        cg.lineTo(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1);
        cg.stroke();
    }
    cg.fillStyle = '#181512'; cg.font = 'bold 26px serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
    cg.fillText('12', 128, 42); cg.fillText('3', 214, 130); cg.fillText('6', 128, 218); cg.fillText('9', 42, 130);

    NA.clockGroup = new THREE.Group();
    const clkRim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.25, 0.04, Math.max(16, QUALITY.segs)),
        new THREE.MeshStandardMaterial({ color: 0x201d1a, roughness: 0.65, metalness: 0.35 })
    );
    clkRim.rotation.x = Math.PI / 2;
    clkRim.userData.noShadowCast = true;
    NA.clockGroup.add(clkRim);

    const clkFace = new THREE.Mesh(
        new THREE.CircleGeometry(0.215, Math.max(16, QUALITY.segs)),
        new THREE.MeshStandardMaterial({ map: markSRGB(new THREE.CanvasTexture(clkCv)), roughness: 0.55 })
    );
    clkFace.position.z = 0.022;
    clkFace.userData.noShadowCast = true;
    NA.clockGroup.add(clkFace);

    const handDarkMat = new THREE.MeshStandardMaterial({ color: 0x151412, roughness: 0.7 });
    const handRedMat = new THREE.MeshStandardMaterial({ color: 0x7e1414, roughness: 0.6 });
    const mkHand = (w, h, yOff, zOff, mat) => {
        const pv = new THREE.Group();
        pv.position.z = zOff;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.005), mat);
        m.position.y = yOff;
        m.userData.noShadowCast = true;
        pv.add(m);
        NA.clockGroup.add(pv);
        return pv;
    };
    NA.clockHour = mkHand(0.015, 0.105, 0.045, 0.025, handDarkMat);
    NA.clockMin = mkHand(0.011, 0.155, 0.068, 0.028, handDarkMat);
    NA.clockSec = mkHand(0.006, 0.175, 0.070, 0.031, handRedMat);
    const clkCap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 10), handDarkMat);
    clkCap.rotation.x = Math.PI / 2; clkCap.position.z = 0.033;
    clkCap.userData.noShadowCast = true;
    NA.clockGroup.add(clkCap);

    NA.clockGroup.position.set(1.975, 2.55, -4.5);
    NA.clockGroup.rotation.y = -Math.PI / 2;
    NA.clockTime = 3720;
    scene.add(NA.clockGroup);
    NA.far.push({ o: NA.clockGroup, z: -4.5 });

    // 22 & 39: Екінші өсімдік (z = -14) және 31: Үшінші өсімдік (z = -22)
    NA.plant2 = scene.children.find(o => o.isGroup && Math.abs(o.position.x + 1.55) < 0.05 && Math.abs(o.position.z + 14) < 0.05) || null;
    NA.plant2Leaves = [];
    NA.plant2ShadowMeshes = [];
    NA.witherMat = new THREE.MeshStandardMaterial({ color: 0x3b2c17, roughness: 0.96, side: THREE.DoubleSide });
    if (NA.plant2) {
        NA.plant2.traverse(ch => {
            if (!ch.isMesh) return;
            if (ch.castShadow) NA.plant2ShadowMeshes.push({ mesh: ch, origCast: ch.castShadow });
            const gt = ch.geometry && ch.geometry.type;
            if (gt === 'PlaneGeometry' || gt === 'ConeGeometry' || (gt === 'CylinderGeometry' && ch.position.y > 0.405)) {
                NA.plant2Leaves.push({ mesh: ch, origMat: ch.material, origRx: ch.rotation.x });
            }
        });
    }

    NA.deadLeavesGroup = new THREE.Group();
    NA.deadLeavesGroup.visible = false;
    [[-1.30, -13.78, 0.4], [-1.76, -13.74, -0.8], [-1.22, -14.18, 1.3], [-1.72, -14.24, 2.1], [-1.45, -13.68, -1.7]].forEach(([lx, lz, rz]) => {
        const dl = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.25), NA.witherMat);
        dl.rotation.set(-Math.PI / 2 + 0.06, 0, rz);
        dl.position.set(lx, 0.014, lz);
        dl.userData.noShadowCast = true;
        NA.deadLeavesGroup.add(dl);
    });
    scene.add(NA.deadLeavesGroup);

    NA.plant3 = scene.children.find(o => o.isGroup && Math.abs(o.position.x - 1.55) < 0.05 && Math.abs(o.position.z + 22) < 0.05) || null;
    NA.plant3Collider = (typeof colliders !== 'undefined') ? colliders.find(col => Math.abs(col.x - 1.55) < 0.05 && Math.abs(col.z + 22) < 0.05) : null;

    // 23: Екінші сурет (z = -18)
    NA.painting2 = scene.children.find(o => o.isGroup && Math.abs(o.position.x + 1.95) < 0.05 && Math.abs(o.position.z + 18) < 0.05) || null;

    // 24: Айналы плакат текстурасы
    const mpCv = document.createElement('canvas'); mpCv.width = 200; mpCv.height = 280;
    const mpg = mpCv.getContext('2d');
    if (poster0NormalTex && poster0NormalTex.image) {
        mpg.translate(200, 0);
        mpg.scale(-1, 1);
        mpg.drawImage(poster0NormalTex.image, 0, 0);
    }
    NA.mirroredPosterTex = markSRGB(new THREE.CanvasTexture(mpCv));

    // 27: Жалғыз аяқ киім
    NA.shoeGroup = new THREE.Group();
    NA.shoeGroup.visible = false;
    const shoeLeather = new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.72, metalness: 0.1 });
    const shoeSoleMat = new THREE.MeshStandardMaterial({ color: 0x26211c, roughness: 0.92 });
    const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.022, 0.28), shoeSoleMat);
    shoeSole.position.set(0, 0.011, 0);
    shoeSole.userData.noShadowCast = true;
    NA.shoeGroup.add(shoeSole);
    const shoeHeel = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.08), shoeSoleMat);
    shoeHeel.position.set(0, 0.025, -0.095);
    shoeHeel.userData.noShadowCast = true;
    NA.shoeGroup.add(shoeHeel);
    const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.075, 0.18), shoeLeather);
    shoeUpper.position.set(0, 0.06, -0.035);
    shoeUpper.userData.noShadowCast = true;
    NA.shoeGroup.add(shoeUpper);
    const shoeToe = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.048, 0.105), shoeLeather);
    shoeToe.position.set(0, 0.044, 0.092);
    shoeToe.userData.noShadowCast = true;
    NA.shoeGroup.add(shoeToe);
    const shoeHole = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.025, 0.085), new THREE.MeshStandardMaterial({ color: 0x090808, roughness: 0.95 }));
    shoeHole.position.set(0, 0.095, -0.065);
    shoeHole.userData.noShadowCast = true;
    NA.shoeGroup.add(shoeHole);
    NA.shoeGroup.position.set(-1.38, 0, -16.8);
    NA.shoeGroup.rotation.y = 0.52;
    scene.add(NA.shoeGroup);

    // 28: Қабырғадағы қараңғы күйе-қол іздері
    const hpCv = document.createElement('canvas'); hpCv.width = 128; hpCv.height = 128;
    const hpg = hpCv.getContext('2d');
    hpg.fillStyle = 'rgba(18, 16, 15, 0.64)';
    hpg.beginPath(); hpg.ellipse(64, 78, 22, 26, 0, 0, Math.PI * 2); hpg.fill();
    [[-24, 52, -0.55, 18], [-13, 30, -0.18, 26], [-1, 24, -0.02, 29], [12, 28, 0.14, 26], [23, 38, 0.34, 21]].forEach(([ox, oy, ang, len]) => {
        hpg.save(); hpg.translate(64 + ox, oy); hpg.rotate(ang);
        hpg.beginPath(); hpg.ellipse(0, 0, 5.5, len * 0.52, 0, 0, Math.PI * 2); hpg.fill();
        hpg.restore();
    });
    const hpTex = markSRGB(new THREE.CanvasTexture(hpCv));
    const hpMat = new THREE.MeshStandardMaterial({
        map: hpTex, transparent: true, depthWrite: false, roughness: 0.95,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    NA.handprints = new THREE.Group();
    NA.handprints.visible = false;
    [[1.984, 1.44, -5.30, 0.15], [1.984, 1.52, -5.75, -0.22], [1.984, 1.34, -6.15, 0.10]].forEach(([hx, hy, hz, rz]) => {
        const hm = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.28), hpMat);
        hm.position.set(hx, hy, hz);
        hm.rotation.y = -Math.PI / 2;
        hm.rotation.z = rz;
        hm.userData.noShadowCast = true;
        NA.handprints.add(hm);
    });
    scene.add(NA.handprints);

    // 29: Ойыншыны бақылайтын бейнекамера
    NA.secCam = scene.children.find(o => o.isGroup && Math.abs(o.position.x - 1.80) < 0.05 && Math.abs(o.position.z + 23.2) < 0.05) || null;
    NA.secCamHead = null;
    NA.secCamLed = null;
    if (NA.secCam) {
        NA.secCamHead = NA.secCam.children.find(ch => ch.isGroup) || null;
        if (NA.secCamHead) {
            NA.secCamLed = NA.secCamHead.children.find(ch => ch.isMesh && ch.geometry && ch.geometry.type === 'SphereGeometry') || null;
            if (NA.secCamLed && NA.secCamLed.material) {
                NA.secCamLed.material = NA.secCamLed.material.clone();
            }
        }
    }

    // 30: Сәл ашық артқы есік артындағы қараңғылық
    NA.backDoorVoid = new THREE.Mesh(
        new THREE.PlaneGeometry(2.1, 3.6),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    NA.backDoorVoid.position.set(0, 1.75, 11.12);
    NA.backDoorVoid.rotation.y = Math.PI;
    NA.backDoorVoid.visible = false;
    NA.backDoorVoid.userData.noShadowCast = true;
    scene.add(NA.backDoorVoid);

    // 33: Едендегі реңкі өзгерген бетон плита
    const ftCv = document.createElement('canvas'); ftCv.width = 256; ftCv.height = 256;
    const ftg = ftCv.getContext('2d');
    ftg.fillStyle = '#c8cbc2'; ftg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
        ftg.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
        ftg.fillRect(rnd(0, 220), rnd(0, 220), rnd(12, 42), rnd(12, 42));
    }
    ftg.strokeStyle = 'rgba(25,25,25,0.85)'; ftg.lineWidth = 8;
    ftg.strokeRect(4, 4, 248, 248);
    NA.floorTile = new THREE.Mesh(
        new THREE.PlaneGeometry(1.38, 1.38),
        new THREE.MeshStandardMaterial({
            color: 0x3b3d37, map: markSRGB(new THREE.CanvasTexture(ftCv)), roughness: 0.92,
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
        })
    );
    NA.floorTile.rotation.x = -Math.PI / 2;
    NA.floorTile.position.set(0, 0.008, -10.5);
    NA.floorTile.receiveShadow = true;
    NA.floorTile.userData.noShadowCast = true;
    NA.floorTile.visible = false;
    scene.add(NA.floorTile);

    // 34: Артық қабырға ажыратқышы (z = -3.2 қасында)
    NA.extraSwitch = new THREE.Group();
    NA.extraSwitch.visible = false;
    const swB = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.13, 0.095), new THREE.MeshStandardMaterial({ color: 0x9b947f, roughness: 0.72 }));
    swB.userData.noShadowCast = true;
    NA.extraSwitch.add(swB);
    const swR = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 0.036), new THREE.MeshStandardMaterial({ color: 0x7a7361, roughness: 0.65 }));
    swR.position.set(0.012, 0, 0);
    swR.rotation.z = -0.32;
    swR.userData.noShadowCast = true;
    NA.extraSwitch.add(swR);
    NA.extraSwitch.position.set(-1.99, 1.32, -3.02);
    scene.add(NA.extraSwitch);

    // 35: Алдыңғы есік тұтқасының бөлшектері
    NA.frontHandleParts = [];
    frontDoorGroup.children.forEach(ch => {
        if (Math.abs(ch.position.x - 1.72) < 0.01 || Math.abs(ch.position.x - 1.655) < 0.01) {
            NA.frontHandleParts.push({ mesh: ch, origX: ch.position.x });
        }
    });

    // 36: Өрт сөндіргіш манометрі (қызыл аймақ) және жапсырма бағыты
    NA.exGauge = extinguisherBodyGroup.children.find(ch => ch.geometry && ch.geometry.type === 'CircleGeometry') || null;
    NA.exLabel = extinguisherBodyGroup.children.find(ch => ch.geometry && ch.geometry.type === 'CylinderGeometry' && Math.abs(ch.position.y - 1.06) < 0.004) || null;
    NA.exGaugeNormalMap = NA.exGauge ? NA.exGauge.material.map : null;
    const grCv = document.createElement('canvas'); grCv.width = grCv.height = 128;
    const grg = grCv.getContext('2d');
    grg.fillStyle = '#c7bfa8'; grg.beginPath(); grg.arc(64, 64, 60, 0, Math.PI * 2); grg.fill();
    grg.lineWidth = 10;
    grg.strokeStyle = '#9e1c1c';
    grg.beginPath(); grg.arc(64, 64, 42, Math.PI * 0.85, Math.PI * 1.35); grg.stroke();
    grg.strokeStyle = '#2b6e32';
    grg.beginPath(); grg.arc(64, 64, 42, Math.PI * 1.35, Math.PI * 1.75); grg.stroke();
    grg.strokeStyle = '#d91616'; grg.lineWidth = 13;
    grg.beginPath(); grg.arc(64, 64, 42, Math.PI * 1.75, Math.PI * 2.15); grg.stroke();
    grg.strokeStyle = '#181818'; grg.lineWidth = 4.5;
    grg.beginPath(); grg.moveTo(64, 64); grg.lineTo(100, 82); grg.stroke();
    grg.fillStyle = '#222'; grg.beginPath(); grg.arc(64, 64, 7, 0, Math.PI * 2); grg.fill();
    NA.exGaugeRedMap = markSRGB(new THREE.CanvasTexture(grCv));

    // 37: Артық газет парақтары
    NA.extraPapers = new THREE.Group();
    NA.extraPapers.visible = false;
    [[1.12, -12.35, 0.38, 0], [0.90, -11.55, 2.15, 1], [1.22, -13.10, -0.92, 2], [0.35, 6.10, 1.05, 3]].forEach(([px, pz, rz, idx], k) => {
        const tex = typeof makeNewsprintTexture === 'function' ? makeNewsprintTexture(idx) : null;
        const pm = new THREE.Mesh(
            new THREE.PlaneGeometry(0.45, 0.34),
            new THREE.MeshStandardMaterial({ map: tex, roughness: 1, side: THREE.DoubleSide })
        );
        pm.rotation.x = -Math.PI / 2;
        pm.rotation.z = rz;
        pm.position.set(px, 0.009 + k * 0.001, pz);
        pm.receiveShadow = true;
        pm.userData.noShadowCast = true;
        NA.extraPapers.add(pm);
    });
    scene.add(NA.extraPapers);

    // 38: Дәліз ортасындағы қоюланған тұман қабаттары
    const fvCv = document.createElement('canvas'); fvCv.width = fvCv.height = 128;
    const fvg = fvCv.getContext('2d');
    const fgr = fvg.createRadialGradient(64, 64, 4, 64, 64, 62);
    fgr.addColorStop(0, 'rgba(72, 74, 72, 0.85)');
    fgr.addColorStop(0.55, 'rgba(54, 56, 54, 0.38)');
    fgr.addColorStop(1, 'rgba(40, 42, 40, 0)');
    fvg.fillStyle = fgr; fvg.fillRect(0, 0, 128, 128);
    const fvMat = new THREE.MeshBasicMaterial({
        map: markSRGB(new THREE.CanvasTexture(fvCv)),
        transparent: true, depthWrite: false, fog: false, opacity: 0.16, side: THREE.DoubleSide
    });
    NA.fogVeils = new THREE.Group();
    NA.fogVeils.visible = false;
    [-6.5, -9.5, -12.5].forEach((fz, idx) => {
        const vm = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.6), fvMat);
        vm.position.set((idx - 1) * 0.15, 1.8, fz);
        vm.userData.noShadowCast = true;
        vm.userData.noReceiveShadow = true;
        NA.fogVeils.add(vm);
    });
    scene.add(NA.fogVeils);

    // 39: Қате бағытқа түскен өсімдік көлеңкесі
    const wsCv = document.createElement('canvas'); wsCv.width = 128; wsCv.height = 256;
    const wsg = wsCv.getContext('2d');
    const wsGr = wsg.createRadialGradient(64, 128, 6, 64, 128, 118);
    wsGr.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
    wsGr.addColorStop(0.55, 'rgba(0, 0, 0, 0.55)');
    wsGr.addColorStop(1, 'rgba(0, 0, 0, 0)');
    wsg.fillStyle = wsGr;
    wsg.save(); wsg.translate(64, 128); wsg.scale(0.45, 1.0);
    wsg.beginPath(); wsg.arc(0, 0, 118, 0, Math.PI * 2); wsg.fill();
    wsg.restore();
    NA.wrongShadow = new THREE.Group();
    NA.wrongShadow.visible = false;
    const wsPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 1.55),
        new THREE.MeshBasicMaterial({
            map: markSRGB(new THREE.CanvasTexture(wsCv)),
            transparent: true, depthWrite: false,
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
        })
    );
    wsPlane.rotation.x = -Math.PI / 2;
    wsPlane.position.set(0, 0.009, 0.72);
    wsPlane.userData.noShadowCast = true;
    wsPlane.userData.noReceiveShadow = true;
    NA.wrongShadow.add(wsPlane);
    NA.wrongShadow.position.set(-1.55, 0, -14);
    NA.wrongShadow.rotation.y = Math.PI / 2 + 0.18;
    scene.add(NA.wrongShadow);

    // 40: Қабырғадағы қосымша санақ (tally) сызықтары
    const drawExtraTallyTex = (blocks, extraSingle) => {
        const tc = document.createElement('canvas'); tc.width = 256; tc.height = 128;
        const tg = tc.getContext('2d');
        tg.strokeStyle = 'rgba(28, 18, 16, 0.74)';
        tg.lineWidth = 3.2;
        for (let b = 0; b < blocks; b++) {
            const bx = 26 + b * 72;
            for (let s = 0; s < 4; s++) {
                tg.beginPath();
                tg.moveTo(bx + s * 12, 22);
                tg.lineTo(bx + s * 12 + rnd(-2, 2), 68);
                tg.stroke();
            }
            tg.beginPath();
            tg.moveTo(bx - 6, 58);
            tg.lineTo(bx + 44, 28);
            tg.stroke();
        }
        const sx0 = 26 + blocks * 72;
        for (let s = 0; s < extraSingle; s++) {
            tg.beginPath();
            tg.moveTo(sx0 + s * 12, 22);
            tg.lineTo(sx0 + s * 12 + rnd(-2, 2), 68);
            tg.stroke();
        }
        return markSRGB(new THREE.CanvasTexture(tc));
    };
    NA.extraTallies = new THREE.Group();
    NA.extraTallies.visible = false;
    const tMatR = new THREE.MeshStandardMaterial({
        map: drawExtraTallyTex(2, 3), transparent: true, depthWrite: false, roughness: 1,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    const tR = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.42), tMatR);
    tR.position.set(1.976, 1.11, -2.5);
    tR.rotation.y = -Math.PI / 2;
    tR.userData.noShadowCast = true;
    NA.extraTallies.add(tR);

    const tMatL = new THREE.MeshStandardMaterial({
        map: drawExtraTallyTex(1, 4), transparent: true, depthWrite: false, roughness: 1,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    const tL = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.42), tMatL);
    tL.position.set(-1.976, 0.95, 6.2);
    tL.rotation.y = Math.PI / 2;
    tL.userData.noShadowCast = true;
    NA.extraTallies.add(tL);
    scene.add(NA.extraTallies);
}

function applyClockHands(secVal) {
    if (!NA.clockSec) return;
    const tickSec = Math.floor(secVal);
    NA.clockSec.rotation.z = -tickSec * (Math.PI / 30);
    NA.clockMin.rotation.z = -(secVal / 60) * (Math.PI / 30);
    NA.clockHour.rotation.z = -(secVal / 3600) * (Math.PI / 6);
}

function drawWallShadow(detached, armRaise, time) {
    const g = NA.shadowCv.getContext('2d');
    g.clearRect(0, 0, 256, 512);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.95)';
    g.shadowBlur = 14;
    g.fillStyle = '#040406';

    g.beginPath();
    g.moveTo(96, 145); g.lineTo(160, 145); g.lineTo(176, 305); g.lineTo(154, 305);
    g.lineTo(148, 495); g.lineTo(116, 495); g.lineTo(112, 315); g.lineTo(106, 495);
    g.lineTo(78, 495); g.lineTo(76, 305); g.closePath();
    g.fill();

    g.fillRect(62, 152, 16, 145);
    g.save();
    g.translate(168, 155);
    g.rotate(-armRaise);
    g.fillRect(0, 0, 16, 155);
    g.restore();

    g.save();
    g.translate(128, 95);
    g.rotate(detached ? 0.28 + Math.sin(time * 3) * 0.05 : 0);
    g.beginPath(); g.ellipse(0, 0, 32, 46, 0, 0, Math.PI * 2); g.fill();
    if (detached) {
        g.shadowBlur = 6;
        g.shadowColor = '#ff2020';
        g.fillStyle = '#f5d8d8';
        g.beginPath(); g.arc(-11, -6, 3.6, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(11, -4, 3.6, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    g.restore();
    NA.shadowTex.needsUpdate = true;
}

function drawMirror(camZ, time) {
    const g = NA.mirrorCv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 256, 384);
    bg.addColorStop(0, '#181c22');
    bg.addColorStop(0.5, '#2b323b');
    bg.addColorStop(1, '#101216');
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 384);

    g.strokeStyle = 'rgba(130, 145, 165, 0.16)';
    g.lineWidth = 2;
    g.strokeRect(26, 36, 204, 312);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(26, 36);
    g.moveTo(256, 0); g.lineTo(230, 36);
    g.moveTo(0, 384); g.lineTo(26, 348);
    g.moveTo(256, 384); g.lineTo(230, 348);
    g.stroke();

    const shiftX = Math.max(-24, Math.min(24, (camZ + 10) * 3.5));
    const zoom = 1 + Math.max(0, 1 - Math.abs(camZ + 10) / 8) * 0.28;
    g.save();
    g.translate(128 + shiftX, 198);
    g.scale(zoom, zoom);

    g.fillStyle = '#090a0d';
    g.beginPath(); g.ellipse(0, 130, 88, 65, 0, Math.PI, Math.PI * 2); g.fill();

    const fg = g.createRadialGradient(0, -10, 10, 0, 0, 85);
    fg.addColorStop(0, '#b9b4a4');
    fg.addColorStop(1, '#585348');
    g.fillStyle = fg;
    g.beginPath(); g.ellipse(0, -8, 46, 66, 0, 0, Math.PI * 2); g.fill();

    [-17, 17].forEach(ex => {
        g.fillStyle = '#080606';
        g.beginPath(); g.ellipse(ex, -22, 11, 14, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffecec';
        g.beginPath(); g.arc(ex - shiftX * 0.08, -22, 2.2, 0, Math.PI * 2); g.fill();
    });

    const mouthOpen = 14 + Math.sin(time * 2.5) * 4;
    g.fillStyle = '#070304';
    g.beginPath(); g.ellipse(0, 24, 15, mouthOpen, 0, 0, Math.PI * 2); g.fill();
    g.restore();

    g.strokeStyle = 'rgba(220,235,255,0.14)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(22, 48); g.lineTo(148, 175); g.moveTo(210, 80); g.lineTo(110, 220); g.stroke();
    NA.mirrorTex.needsUpdate = true;
}

function drawWatcher(px, py) {
    const g = NA.eyeCv.getContext('2d');
    g.fillStyle = '#1c130c'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#a9a38b'; g.beginPath(); g.ellipse(128, 130, 72, 100, 0, 0, Math.PI * 2); g.fill();
    [98, 158].forEach(x => {
        g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(x, 108, 27, 17, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ece8d2'; g.beginPath(); g.ellipse(x, 108, 21, 11, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#6a0a0a'; g.beginPath(); g.arc(x + px, 108 + py, 8, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#000'; g.beginPath(); g.arc(x + px, 108 + py, 4, 0, Math.PI * 2); g.fill();
    });
    g.strokeStyle = '#3a2a1c'; g.lineWidth = 3; g.beginPath(); g.moveTo(104, 185); g.lineTo(152, 185); g.stroke();
    NA.eyeTex.needsUpdate = true;
}

function applyLength(shift) {
    const k = (38 + shift) / 38, cz = -7 - shift / 2, dz = -25 - shift;
    NA.parts.forEach(o => {
        if (o.geometry.parameters.width === 4) o.scale.y = k; else o.scale.x = k;
        o.position.z = cz;
    });
    if (NA.frontEnds) NA.frontEnds.forEach(o => { o.position.z = dz + 0.06; });
    if (brickTex) brickTex.repeat.set(38 + shift, 4);
    if (concreteTex) concreteTex.repeat.set(4, 38 + shift);
    // PBR текстуралары жүктелген болса, олардың repeat мәнін де жаңарту
    if (rightWallMesh && rightWallMesh.material) {
        const wm = rightWallMesh.material;
        if (wm.map && wm.map !== brickTex) wm.map.repeat.set(38 + shift, 4);
        if (wm.normalMap) wm.normalMap.repeat.set(38 + shift, 4);
        if (wm.roughnessMap) wm.roughnessMap.repeat.set(38 + shift, 4);
    }
    if (floorMesh && floorMesh.material) {
        const fm = floorMesh.material;
        if (fm.map && fm.map !== concreteTex) fm.map.repeat.set(4, 38 + shift);
        if (fm.normalMap) fm.normalMap.repeat.set(4, 38 + shift);
        if (fm.roughnessMap) fm.roughnessMap.repeat.set(4, 38 + shift);
    }
    const lastLampZ = -21 - shift * 0.85;
    if (ceilingLights[4]) ceilingLights[4].position.z = lastLampZ;
    if (lampMeshes[4]) lampMeshes[4].position.z = lastLampZ;

    frontDoorGroup.position.z = dz;
    NA.wallF.position.z = dz + 0.04;
    frontTriggerZ = -23.5 - shift;
    NA.far.forEach(f => {
        if (lampMeshes.indexOf(f.o) >= 0) return;
        f.o.visible = f.z > dz + 0.3;
    });
}

function setupNewAnomalies() {
    if (!NA.ready) buildNewAnomalyObjects();
    const t = currentAnomalyType, rnd = (a, b) => a + Math.random() * (b - a);
    NA.shift = 0; NA.shiftTarget = 0; applyLength(0);
    NA.drip.visible = false; NA.dripOn = false;
    NA.ghost.visible = false; NA.ghostState = -1;
    NA.wallF.visible = false;
    frontDoorGroup.visible = true;
    backDoorGroup.visible = true;
    NA.rollTarget = 0;

    NA.shadowWall.visible = false; NA.shadowDetached = false; NA.shadowArm = 0;
    floorMesh.visible = true; NA.floorSplit.visible = false; NA.abyssGroup.visible = false;
    NA.pitTriggered = false; NA.pitFalling = false; NA.pitVy = 0;
    specialPainting.visible = true; NA.mirrorGroup.visible = false; NA.mirrorScared = false;
    NA.eyesGroup.visible = false; NA.blackoutOn = false; NA.blackoutTimer = 4.2; NA.deadFlashTimer = 0;

    extinguisherBodyGroup.position.set(1.87, 0, 2);
    extinguisherBodyGroup.rotation.y = 0;
    if (extinguisherCollider) { extinguisherCollider.x = 1.87; extinguisherCollider.z = 2; }
    NA.footprints.visible = false;
    NA.doorVoid.visible = false; NA.doorHand.visible = false; NA.doorCreaked = false;
    poster0Mesh.material.map = poster0NormalTex;
    poster0Mesh.material.needsUpdate = true;
    NA.extraPosters.visible = false;

    specialPaintingCanvas.material.map = NA.paintIdle;
    specialPaintingCanvas.material.needsUpdate = true;

    // 21–40 күйлерін толық қалпына келтіру
    NA.clockTime = 3720 + Math.floor(Math.random() * 10) * 1800;
    applyClockHands(NA.clockTime);
    if (NA.plant2) {
        NA.plant2.scale.set(1, 1, 1);
        NA.plant2Leaves.forEach(l => {
            l.mesh.material = l.origMat;
            l.mesh.rotation.x = l.origRx;
        });
        NA.plant2ShadowMeshes.forEach(s => { s.mesh.castShadow = s.origCast; });
    }
    NA.deadLeavesGroup.visible = false;
    if (NA.plant3Collider) NA.plant3Collider.r = 0.28;
    if (NA.painting2) NA.painting2.position.y = 2.0;
    NA.shoeGroup.visible = false;
    NA.handprints.visible = false;
    if (NA.secCam) NA.secCam.rotation.y = -0.45;
    if (NA.secCamHead) NA.secCamHead.rotation.x = 0.35;
    if (NA.secCamLed && NA.secCamLed.material) NA.secCamLed.material.emissiveIntensity = 0.8;
    NA.backDoorVoid.visible = false;
    NA.floorTile.visible = false;
    NA.extraSwitch.visible = false;
    NA.frontHandleParts.forEach(p => { p.mesh.position.x = p.origX; });
    if (NA.exGauge && NA.exGaugeNormalMap) {
        NA.exGauge.material.map = NA.exGaugeNormalMap;
        NA.exGauge.material.needsUpdate = true;
    }
    if (NA.exLabel) NA.exLabel.rotation.set(0, 0, 0);
    NA.extraPapers.visible = false;
    NA.fogVeils.visible = false;
    if (scene && scene.fog) scene.fog.density = (typeof LOOK !== 'undefined' ? LOOK.fogDensity : 0.11);
    NA.wrongShadow.visible = false;
    NA.extraTallies.visible = false;

    if (t === 6) {
        NA.shiftTarget = Math.random() < 0.5 ? 6 : -4.5;
    } else if (t === 7) {
        specialPaintingCanvas.material.map = NA.eyeTex;
        specialPaintingCanvas.material.color.setHex(0xffffff);
        specialPaintingCanvas.material.needsUpdate = true;
        drawWatcher(0, 0);
    } else if (t === 8) {
        NA.drip.visible = true; NA.dripOn = true; NA.pitR = 0.09;
        NA.pit.scale.set(0.09, 0.09, 1);
        NA.drops.forEach(d => { d.userData.y = 3.9; d.userData.vy = 0; d.userData.wait = rnd(0.8, 2.0); d.visible = false; });
        NA.ripples.forEach(r => { r.userData.t = 1; r.visible = false; });
    } else if (t === 9) {
        NA.rollTarget = Math.random() < 0.5 ? 0.11 : -0.11;
    } else if (t === 10) {
        frontDoorGroup.visible = false;
        NA.wallF.visible = true;
    } else if (t === 11) {
        NA.ghost.position.x = rnd(-0.35, 0.35);
        NA.ghost.material.opacity = 0;
        NA.ghostState = 0; NA.ghostTimer = rnd(2.5, 5.5); NA.ghostFade = 0;
    } else if (t === 12) {
        NA.shadowWall.visible = false;
        NA.shadowWall.scale.set(1, 1, 1);
        NA.shadowWall.position.set(1.975, 1.1, 4.5);
        drawWallShadow(false, 0, 0);
    } else if (t === 14) {
        specialPainting.visible = false;
        NA.mirrorGroup.visible = true;
        drawMirror(camera.position.z, 0);
    } else if (t === 17) {
        extinguisherBodyGroup.position.set(-1.87, 0, -11);
        extinguisherBodyGroup.rotation.y = Math.PI;
        if (extinguisherCollider) { extinguisherCollider.x = -1.87; extinguisherCollider.z = -11; }
    } else if (t === 18) {
        NA.footprints.visible = true;
    } else if (t === 19) {
        frontDoorGroup.rotation.y = 0.24;
        NA.doorVoid.visible = true;
        NA.doorHand.visible = true;
    } else if (t === 20) {
        poster0Mesh.material.map = NA.creepyPosterTex;
        poster0Mesh.material.needsUpdate = true;
        NA.extraPosters.visible = true;
    } else if (t === 22) {
        if (NA.plant2) {
            NA.plant2.scale.set(0.94, 0.78, 0.94);
            NA.plant2Leaves.forEach(l => {
                l.mesh.material = NA.witherMat;
                l.mesh.rotation.x = l.origRx + 0.24;
            });
        }
        NA.deadLeavesGroup.visible = true;
    } else if (t === 23) {
        if (NA.painting2) NA.painting2.position.y = 2.72;
    } else if (t === 24) {
        poster0Mesh.material.map = NA.mirroredPosterTex;
        poster0Mesh.material.needsUpdate = true;
    } else if (t === 27) {
        NA.shoeGroup.visible = true;
    } else if (t === 28) {
        NA.handprints.visible = true;
    } else if (t === 30) {
        backDoorGroup.rotation.y = -0.22;
        NA.backDoorVoid.visible = true;
    } else if (t === 31) {
        if (NA.plant3) NA.plant3.visible = false;
        if (NA.plant3Collider) NA.plant3Collider.r = 0;
    } else if (t === 33) {
        NA.floorTile.visible = true;
    } else if (t === 34) {
        NA.extraSwitch.visible = true;
    } else if (t === 35) {
        NA.frontHandleParts.forEach(p => { p.mesh.position.x = 2.0 - p.origX; });
    } else if (t === 36) {
        if (NA.exGauge && NA.exGaugeRedMap) {
            NA.exGauge.material.map = NA.exGaugeRedMap;
            NA.exGauge.material.needsUpdate = true;
        }
        if (NA.exLabel) NA.exLabel.rotation.set(Math.PI, 0.55, 0);
    } else if (t === 37) {
        NA.extraPapers.visible = true;
    } else if (t === 38) {
        NA.fogVeils.visible = true;
    } else if (t === 39) {
        NA.plant2ShadowMeshes.forEach(s => { s.mesh.castShadow = false; });
        NA.wrongShadow.visible = true;
    } else if (t === 40) {
        NA.extraTallies.visible = true;
    }
    updateMobileBtnStates();
}

function updateNewAnomalies(delta) {
    if (!gameStarted || inMenu) return;
    if (!isMobile && document.pointerLockElement !== document.body) return;
    const dt = Math.min(delta, 0.1), time = performance.now() / 1000, t = currentAnomalyType, cam = camera.position;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    if (t === 13 && NA.pitFalling) {
        NA.pitVy += 26 * dt;
        cam.y -= NA.pitVy * dt;
        return;
    }
    if (isTransitioning) return;

    // 21: Сағат қалыпты кезде алға, 21-де кері жүреді
    if (NA.clockGroup) {
        NA.clockTime += (t === 21 ? -dt : dt);
        applyClockHands(NA.clockTime);
    }

    if (t === 6 && NA.shift !== NA.shiftTarget) {
        const diff = NA.shiftTarget - NA.shift;
        NA.shift += Math.sign(diff) * Math.min(Math.abs(diff), dt * 0.65);
        applyLength(NA.shift);
        if (NA.shift === NA.shiftTarget) updateStaticShadows();
    } else if (t === 7) {
        if (perfCanvasDue('watcher')) drawWatcher(clamp(-(cam.z + 10) * 1.2, -11, 11), clamp((2.0 - cam.y) * 8, -3, 3));
    } else if (t === 8 && NA.dripOn) {
        NA.drops.forEach(d => {
            const u = d.userData;
            if (u.wait > 0) { u.wait -= dt; d.visible = false; return; }
            d.visible = true; u.vy -= 9.8 * dt; u.y += u.vy * dt; d.position.y = u.y;
            if (u.y <= 0.03) {
                u.y = 3.9; u.vy = 0; u.wait = 1.1 + Math.random() * 1.4; d.visible = false; d.position.y = 3.9;
                const r = NA.ripples.find(x => x.userData.t >= 1);
                if (r) { r.userData.t = 0; r.visible = true; }
                NA.pitR = Math.min(0.65, NA.pitR + 0.02);
                NA.pit.scale.set(NA.pitR, NA.pitR, 1);
                playDripSound(Math.max(0, 1 - Math.hypot(cam.x - NA.src.x, cam.z - NA.src.z) / 11));
            }
        });
        NA.ripples.forEach(r => {
            if (r.userData.t >= 1) return;
            r.userData.t += dt * 1.3;
            const sc = 0.05 + r.userData.t * 0.45;
            r.scale.set(sc, sc, 1); r.material.opacity = 0.7 * (1 - r.userData.t);
            if (r.userData.t >= 1) r.visible = false;
        });
    } else if (t === 9) {
        if (cam.z < 5.0) {
            const wob = Math.sin(time * 0.7) * 0.02;
            camera.rotation.z += (NA.rollTarget + wob - camera.rotation.z) * Math.min(1, dt * 0.45);
        }
    } else if (t === 11 && NA.ghostState >= 0 && NA.ghostState < 2) {
        const g = NA.ghost, dx = cam.x - g.position.x, dz = cam.z - g.position.z;
        if (NA.ghostState === 0) {
            NA.ghostTimer -= dt;
            if (NA.ghostTimer <= 0) { NA.ghostState = 1; g.visible = true; }
        } else {
            NA.ghostFade = Math.min(1, NA.ghostFade + dt * 0.45);
            g.material.opacity = NA.ghostFade * (0.5 + 0.15 * Math.sin(time * 9));
            g.rotation.y = Math.atan2(dx, dz);
            if (Math.hypot(dx, dz) < 7.0) { NA.ghostState = 2; g.visible = false; }
        }
    } else if (t === 12) {
        if (!NA.shadowWall.visible && cam.z < 5.5) NA.shadowWall.visible = true;
        if (NA.shadowWall.visible) {
            if (!NA.shadowDetached) {
                const targetZ = cam.z - 1.3;
                NA.shadowWall.position.z += (targetZ - NA.shadowWall.position.z) * Math.min(1, dt * 6);
                NA.shadowWall.position.y = 1.1 + Math.sin(time * 8) * 0.015;
                if (cam.z < -1.0 || SC.still > 3.5) {
                    NA.shadowDetached = true;
                    scWhisper(1);
                }
            } else {
                NA.shadowWall.scale.y += (1.38 - NA.shadowWall.scale.y) * Math.min(1, dt * 1.5);
                NA.shadowWall.position.y = 1.1 * NA.shadowWall.scale.y;
                NA.shadowArm = Math.min(2.3, NA.shadowArm + dt * 0.85);
                if (perfCanvasDue('wallshadow')) drawWallShadow(true, NA.shadowArm, time);
            }
        }
    } else if (t === 13) {
        if (!NA.pitTriggered && cam.z < -2.5) {
            NA.pitTriggered = true;
            floorMesh.visible = false;
            NA.floorSplit.visible = true;
            NA.abyssGroup.visible = true;
            playWallCreak(0, false);
        }
        if (NA.pitTriggered) {
            NA.abyssEyes.forEach((em, idx) => {
                em.material.opacity = 0.45 + 0.35 * Math.sin(time * 3 + idx * 1.7);
            });
            if (cam.z < -7.75 && cam.z > -13.25) {
                triggerPitfall();
            }
        }
    } else if (t === 14) {
        if (perfCanvasDue('mirror')) drawMirror(cam.z, time);
        if (!NA.mirrorScared && Math.abs(cam.z + 10) < 3.5) {
            NA.mirrorScared = true;
            scWhisper(-1);
        }
    } else if (t === 15) {
        if (NA.deadFlashTimer > 0) NA.deadFlashTimer = Math.max(0, NA.deadFlashTimer - dt);
        if (!NA.blackoutOn) {
            NA.blackoutTimer -= dt;
            if (cam.z < 2.0 || NA.blackoutTimer <= 0) {
                NA.blackoutOn = true;
                playClickSound();
                restoreLamps();
                NA.eyesGroup.visible = true;
                updateMobileBtnStates();
                scWhisper(-1);
            }
        } else {
            NA.blackoutEyes.forEach(em => {
                const u = em.userData;
                em.rotation.y = Math.atan2(cam.x - em.position.x, cam.z - em.position.z);
                const blink = Math.sin(time * 1.8 + u.phase) > 0.92 ? 0.04 : 0.6;
                em.material.opacity = blink * (0.65 + 0.35 * Math.sin(time * 4 + u.phase));
            });
        }
    } else if (t === 18) {
        if (!SC.seq && !SC.busy) {
            const lvl = Math.sin(time * 27) * Math.sin(time * 11) > 0.35 ? 0.08 : 0.65;
            setLampLevel(3, lvl);
        }
    } else if (t === 19) {
        if (!NA.doorCreaked && cam.z < -16) {
            NA.doorCreaked = true;
            playWallCreak(0, false);
        }
        const pulse = 0.24 + Math.sin(time * 2.2) * 0.02;
        frontDoorGroup.rotation.y = pulse;
    } else if (t === 25) {
        if (!SC.seq && !SC.busy) setLampLevel(2, 0);
    } else if (t === 29) {
        if (NA.secCam && NA.secCamHead) {
            const dx = cam.x - NA.secCam.position.x;
            const dz = cam.z - NA.secCam.position.z;
            const dy = NA.secCam.position.y - cam.y;
            const targetYaw = Math.atan2(dx, dz);
            const targetPitch = Math.atan2(dy, Math.max(0.5, Math.hypot(dx, dz)));
            NA.secCam.rotation.y += (targetYaw - NA.secCam.rotation.y) * Math.min(1, dt * 3.5);
            NA.secCamHead.rotation.x += (targetPitch - NA.secCamHead.rotation.x) * Math.min(1, dt * 3.5);
        }
        if (NA.secCamLed && NA.secCamLed.material) {
            NA.secCamLed.material.emissiveIntensity = 1.0 + 0.85 * Math.sin(time * 6);
        }
    } else if (t === 38) {
        if (scene && scene.fog) {
            const baseFog = (typeof LOOK !== 'undefined' ? LOOK.fogDensity : 0.11);
            const factor = Math.max(0, 1 - Math.abs(cam.z + 9.5) / 8.5);
            scene.fog.density = baseFog + factor * 0.13;
        }
    }
}

function triggerPitfall() {
    if (isTransitioning || NA.pitFalling) return;
    NA.pitFalling = true;
    isTransitioning = true;
    scAbort();
    scScream();
    const fade = document.getElementById('fade');
    fade.style.opacity = 1;
    setTimeout(() => {
        mistakes++;
        showErrorToast(t('toast.abyss'));
        currentStage = 0;
        resetStage();
        setTimeout(() => {
            fade.style.opacity = 0;
            isTransitioning = false;
            if (pendingPause) { pendingPause = false; pauseGame(); }
            else updateLockHint();
        }, 150);
    }, 460);
}

function updateStageSign(glitched = false) {
    window._stageSignGlitched = glitched;
    const wrongNum = !!window._stageSignWrong && !glitched;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = glitched ? '#ded6d0' : '#e6e2dd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#111';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glitched ? t('stage.glitch') : t('stage.word'), canvas.width / 2, 38);

    ctx.font = 'bold 50px monospace';
    ctx.fillStyle = '#990000';
    const badText = currentStage === 8 ? '13 / 8' : '?? / 8';
    const fakeStage = currentStage >= 7 ? (currentStage - 1) : (currentStage + 1);
    const numText = glitched ? badText : (wrongNum ? (fakeStage + " / 8") : (currentStage + " / 8"));
    ctx.fillText(numText, canvas.width / 2, 90);

    if (glitched) {
        ctx.fillStyle = 'rgba(130, 0, 0, 0.25)';
        ctx.fillRect(28, 72, 200, 5);
    }

    const newTexture = markSRGB(new THREE.CanvasTexture(canvas));
    const oldTexture = stageSignMesh.material.map;

    stageSignMesh.material.map = newTexture;
    stageSignMesh.material.needsUpdate = true;

    if (oldTexture && oldTexture !== newTexture) {
        oldTexture.dispose();
    }
}

function applyStageLightingColors() {
    for (let i = 0; i < ceilingLights.length; i++) {
        let c = 0xffeedd;
        if (currentAnomalyType === 3 && i === 2) c = 0x4477ff;
        else if (currentAnomalyType === 32 && i === 1) c = 0xaee070;
        if (ceilingLights[i]) ceilingLights[i].color.setHex(c);
        if (lampMeshes[i]) lampMeshes[i].material.emissive.setHex(c);
        if (typeof lampGlowSprites !== 'undefined' && lampGlowSprites[i]) lampGlowSprites[i].material.color.setHex(c);
    }
}

function resetStage(silent = false) {
    NA.blackoutOn = false;
    scAbort();

    if (currentStage === 0) {
        currentAnomalyType = 0;
    } else if (Math.random() < 0.35) {
        currentAnomalyType = 0;
    } else {
        if (anomalyBag.length === 0) {
            for (let i = 1; i <= TOTAL_ANOMALIES; i++) anomalyBag.push(i);
            for (let i = anomalyBag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = anomalyBag[i];
                anomalyBag[i] = anomalyBag[j];
                anomalyBag[j] = tmp;
            }
            if (anomalyBag[anomalyBag.length - 1] === lastAnomalyType && anomalyBag.length > 1) {
                const j = Math.floor(Math.random() * (anomalyBag.length - 1));
                const tmp = anomalyBag[anomalyBag.length - 1];
                anomalyBag[anomalyBag.length - 1] = anomalyBag[j];
                anomalyBag[j] = tmp;
            }
        }
        const nextType = anomalyBag.pop();
        currentAnomalyType = nextType;
        lastAnomalyType = nextType;
        if (!silent) playHorrorHum();
    }

    rightWallMesh.material.color.setHex(0x262626);
    frontDoorMesh.material.color.setHex(0x4a3325);
    backDoorMesh.material.color.setHex(0x4a3325);
    frontDoorGroup.rotation.y = 0;
    backDoorGroup.rotation.y = 0;
    doorAnimTarget = null;

    applyStageLightingColors();

    specialPainting.rotation.x = 0;
    specialPaintingCanvas.material.color.setHex(0x3b5e2b);

    specialPlant.position.set(1.55, 0, -5);
    specialPlant.rotation.z = 0;

    if (currentAnomalyType === 1) {
        rightWallMesh.material.color.setHex(0x432121);
    } else if (currentAnomalyType === 2) {
        frontDoorMesh.material.color.setHex(0x313d22);
    } else if (currentAnomalyType === 4) {
        specialPainting.rotation.x = 0.13;
        specialPaintingCanvas.material.color.setHex(0x5a2e2e);
    } else if (currentAnomalyType === 5) {
        specialPlant.position.set(-1.55, 0, -5);
        specialPlant.rotation.z = 0.22;
    }

    if (specialPlantCollider) {
        specialPlantCollider.x = specialPlant.position.x;
        specialPlantCollider.z = specialPlant.position.z;
    }

    window._stageSignWrong = (currentAnomalyType === 26);
    updateStageSign(currentAnomalyType === 16);
    camera.position.set(0, 1.6, 8.5);
    camera.rotation.set(0, 0, 0);
    if (typeof resetPlayerBodyPose === 'function') resetPlayerBodyPose();
    setupNewAnomalies();
    restoreLamps();
    if (currentAnomalyType === 25) setLampLevel(2, 0);
    updateStaticShadows();
    updateStageHintVisibility();
}

function loadDiscoveredAnomalies() {
    try {
        const raw = localStorage.getItem('discoveredAnomalies');
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                discoveredAnomalies = new Set(arr.filter(x => Number.isInteger(x) && x >= 1 && x <= TOTAL_ANOMALIES));
            }
        }
    } catch (e) {
        discoveredAnomalies = new Set();
    }
}

function saveDiscoveredAnomalies() {
    try {
        localStorage.setItem('discoveredAnomalies', JSON.stringify(Array.from(discoveredAnomalies)));
    } catch (e) {}
}

function markAnomalyDiscovered(type) {
    if (!Number.isInteger(type) || type < 1 || type > TOTAL_ANOMALIES) return;
    if (!discoveredAnomalies.has(type)) {
        discoveredAnomalies.add(type);
        saveDiscoveredAnomalies();
    }
    updateAnomalyProgressUI();
}

function updateAnomalyProgressUI() {
    try {
        const count = discoveredAnomalies.size;
        const menuEl = document.getElementById('menu-progress');
        if (menuEl && typeof t === 'function') {
            menuEl.textContent = t('menu.progress', { count: count, total: TOTAL_ANOMALIES });
        }
        const vEl = document.getElementById('victory-anomalies');
        if (vEl) vEl.textContent = count + '/' + TOTAL_ANOMALIES;
    } catch (e) {}
}