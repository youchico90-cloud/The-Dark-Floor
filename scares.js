// ================= СКРИМЕР ЖҮЙЕСІ =================
function scRand0() { return 10 + Math.random() * 8; }

const SC = {
    t: 0, next: scRand0(), freeze: 0, after: null, busy: false, active: false, seq: null,
    sh: null, fig: null, ceil: null, shOn: false, shT: 0, cs: 0, ct: 0, flOff: 0, still: 0,
    hardCool: 45, lookBackCool: 35, turnAnim: null, lp: new THREE.Vector3(), timers: []
};
const _scDir = new THREE.Vector3();
const _scFwd = new THREE.Vector3();

const scR = (a, b) => a + Math.random() * (b - a);
const scOK = () => !!(audioCtx && masterGain);
const scSide = () => (Math.random() < 0.5 ? -1 : 1);

function scLater(fn, ms) {
    const id = setTimeout(() => {
        const idx = SC.timers.indexOf(id);
        if (idx >= 0) SC.timers.splice(idx, 1);
        fn();
    }, ms);
    SC.timers.push(id);
    return id;
}

function scClearTimers() {
    while (SC.timers.length) clearTimeout(SC.timers.pop());
}

function scOut(pan) {
    if (audioCtx.createStereoPanner) {
        const p = audioCtx.createStereoPanner();
        p.pan.value = pan;
        p.connect(masterGain);
        return p;
    }
    return masterGain;
}

function scNoise() {
    const n = audioCtx.createBufferSource();
    n.buffer = getNoiseBuffer();
    n.loop = true;
    return n;
}

function scMakeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

function scWhisper(side) { /* дыбыс өшірілген */ }

function scSpeak(forcedPhrase) { /* дыбыс өшірілген */ }

function scBreath(side) { /* дыбыс өшірілген */ }

function scHit(p) { /* дыбыс өшірілген */ }

function scPlayTerrifyingScream(durationMs = 1400) { /* дыбыс өшірілген */ }

function scScream() { /* дыбыс өшірілген */ }

function playWallCreak(side, heavy) { /* дыбыс өшірілген */ }

function scStep(vol, pan, f0) { /* дыбыс өшірілген */ }

function scPhantom() { /* дыбыс өшірілген */ }

function scKnock(side) {
    for (let i = 0; i < 3; i++) scLater(() => scStep(0.7, side * 0.8, 210), i * 320);
    if (Math.random() < 0.45) scLater(() => { scStep(1.1, side * 0.8, 160); scHit(0.35); }, 1900);
}

function scSilence(ms, then) { scLater(() => { if (then) then(); }, ms); }

function scFigTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512;
    const g = c.getContext('2d'), E = (x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
    g.shadowColor = '#000'; g.shadowBlur = 8; g.fillStyle = '#0c0c0e';
    g.beginPath(); g.moveTo(96, 120); g.lineTo(160, 120); g.lineTo(190, 170); g.lineTo(178, 300); g.lineTo(150, 300);
    g.lineTo(146, 500); g.lineTo(112, 500); g.lineTo(106, 300); g.lineTo(78, 300); g.lineTo(66, 170); g.closePath(); g.fill();
    g.fillRect(52, 150, 14, 250); g.fillRect(190, 150, 14, 250);
    g.save(); g.translate(128, 70); g.rotate(0.22);
    E(0, 0, 34, 52, '#b8b3a2'); E(-14, -12, 9, 15, '#000'); E(14, -12, 9, 15, '#000');
    g.fillStyle = '#fff'; g.fillRect(-15, -8, 2, 2); g.fillRect(13, -8, 2, 2);
    E(0, 26, 9, 22, '#000'); g.restore();
    return new THREE.CanvasTexture(c);
}

function scEnsure() {
    if (SC.fig) return;
    const tx = scFigTex(), geo = new THREE.PlaneGeometry(1.15, 2.3);
    SC.fig = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tx, transparent: true, fog: false, depthWrite: false, side: THREE.DoubleSide }));
    SC.fig.visible = false; scene.add(SC.fig);
    SC.sh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tx, transparent: true, fog: false, depthWrite: false, side: THREE.DoubleSide, opacity: 0, color: 0x777777 }));
    SC.sh.visible = false; scene.add(SC.sh);
    SC.ceil = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tx, transparent: true, side: THREE.DoubleSide }));
    SC.ceil.visible = false; scene.add(SC.ceil);
}

function scAhead(d, lat) {
    const f = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotation.y);
    const p = camera.position.clone().addScaledVector(f, d).add(new THREE.Vector3(-f.z, 0, f.x).multiplyScalar(lat || 0));
    p.x = Math.max(-1.85, Math.min(1.85, p.x)); p.z = Math.max(frontTriggerZ + 1, Math.min(9.5, p.z));
    return p;
}

function scPlace(m, p, y) {
    m.position.set(p.x, y, p.z);
    m.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
}

function scAngle(p) {
    _scDir.subVectors(p, camera.position).normalize();
    camera.getWorldDirection(_scFwd);
    return Math.acos(Math.max(-1, Math.min(1, _scFwd.dot(_scDir))));
}

function scGlitch(ms) {
    const c = renderer.domElement;
    c.style.filter = 'hue-rotate(140deg) saturate(4) contrast(1.9)';
    c.style.transform = 'translate(' + scR(-14, 14) + 'px,' + scR(-6, 6) + 'px) scale(1.05)';
    scLater(() => { c.style.filter = ''; c.style.transform = ''; }, ms);
}

function scGlitchFreeze() {
    scGlitch(120); SC.freeze = scR(0.08, 0.16);
    SC.after = () => {
        scHit(0.3); scGlitch(70);
        ceilingLights.forEach(l => l.color.setHex(0xff0000));
        scLater(applyStageLightingColors, 160);
        scPlace(SC.fig, scAhead(scR(10, 14), 0), 1.15); SC.fig.material.color.setHex(0xffffff); SC.fig.visible = true;
        scLater(() => { if (SC.fig) SC.fig.visible = false; }, scR(120, 220));
    };
}

function scPeripheral() {
    const s = scSide(), l = scR(1.6, 2.4), p = scAhead(l / Math.tan(0.95), s * l);
    scPlace(SC.sh, p, 1.15); SC.sh.material.opacity = 0; SC.sh.visible = true; SC.shOn = true; SC.shT = 9;
}

function scLightsFigure() {
    SC.seq = { i: 0, ph: 0, t: scR(0.7, 1.1), hard: false };
    scHit(0.2);
}

function scCeiling() {
    const p = scAhead(scR(9, 12), 0); p.x = scR(-0.8, 0.8);
    SC.ceil.position.set(p.x, 2.85, p.z); SC.ceil.scale.y = -1;
    SC.ceil.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    SC.ceil.visible = true; SC.cs = 1; SC.ct = 25;
}

function scDontLookBack() {
    SC.lookBackCool = 60;
    scWhisper(-1); scWhisper(1);
    scSpeak('Артыңа қарама');
    scHit(0.95);
    scGlitch(140);

    SC.turnAnim = { rem: Math.PI, speed: Math.PI / 0.22, dir: scSide() };
    const figPos = new THREE.Vector3(
        Math.max(-1.4, Math.min(1.4, camera.position.x + scR(-0.4, 0.4))),
        1.15,
        camera.position.z - 3.6
    );
    scPlace(SC.fig, figPos, 1.15);
    SC.fig.material.color.setHex(0xffffff);
    SC.fig.visible = true;
    scLater(() => {
        if (SC.fig) SC.fig.visible = false;
        scBreath(scSide());
    }, 340);
}

function scPick() {
    const s = currentStage, w = [];
    w.push([22, () => { scWhisper(scSide()); if (Math.random() < 0.5) scSpeak(); }]);
    w.push([10, () => scBreath(scSide())]);
    w.push([12, () => scKnock(scSide())]);
    if (SC.still > 0.5) w.push([18, scPhantom]);

    if (currentAnomalyType > 0) {
        w.push([20, scPeripheral]);
        if (currentAnomalyType !== 15 && currentAnomalyType !== 18) w.push([16, scGlitchFreeze]);
        if (s >= 1 && currentAnomalyType !== 15 && currentAnomalyType !== 18) w.push([14, scLightsFigure]);
        if (s >= 1 && flashlightOn && !NA.blackoutOn) w.push([10, scCeiling]);
        if (s >= 2) w.push([9, () => scSilence(scR(2500, 4000), () => { scHit(1); scGlitch(120); scWhisper(-1); scWhisper(1); })]);
    }
    let r = Math.random() * w.reduce((a, b) => a + b[0], 0);
    for (const [wt, fn] of w) { if ((r -= wt) <= 0) { fn(); return; } }
}

function scAbort() {
    scClearTimers();
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    SC.active = false; SC.seq = null; SC.flOff = 0; SC.freeze = 0; SC.after = null; SC.shOn = false; SC.cs = 0; SC.busy = false; SC.turnAnim = null;
    const scCanvas = document.getElementById('scare-canvas');
    if (scCanvas) { scCanvas.style.display = 'none'; scCanvas.style.filter = ''; scCanvas.style.transform = ''; }
    if (masterGain && audioCtx) {
        masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
        masterGain.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
    }
    applyStageLightingColors();
    restoreLamps();
    if (SC.fig) { SC.fig.visible = false; SC.sh.visible = false; SC.ceil.visible = false; }
    if (renderer && renderer.domElement) {
        renderer.domElement.style.filter = '';
        renderer.domElement.style.transform = '';
    }
}

function updateScares(delta) {
    const dt = Math.min(delta, 0.1);
    if (!isGameplayInputActive()) {
        if (SC.active) scAbort();
        return;
    }
    scEnsure(); SC.active = true;
    const cam = camera.position;
    SC.still = cam.distanceTo(SC.lp) < 0.002 ? SC.still + dt : 0; SC.lp.copy(cam);
    if (SC.hardCool > 0) SC.hardCool -= dt;
    if (SC.lookBackCool > 0) SC.lookBackCool -= dt;

    if (SC.freeze > 0) { SC.freeze -= dt; if (SC.freeze <= 0 && SC.after) { const a = SC.after; SC.after = null; a(); } }

    if (SC.turnAnim) {
        const step = Math.min(SC.turnAnim.rem, SC.turnAnim.speed * dt);
        camera.rotation.y += step * SC.turnAnim.dir;
        SC.turnAnim.rem -= step;
        if (SC.turnAnim.rem <= 0) SC.turnAnim = null;
    } else if (
        currentStage >= 1 &&
        currentAnomalyType > 0 &&
        SC.lookBackCool <= 0 &&
        !SC.busy && !SC.seq &&
        cam.z > 5.0 && cam.z < 8.4 &&
        Math.cos(camera.rotation.y) < -0.5 &&
        Math.random() < dt * 0.45
    ) {
        scDontLookBack();
    }

    if (SC.seq) {
        const q = SC.seq, S = [[11, 0.14], [7, 0.14], [3.2, 0.35]];
        q.t -= dt;
        if (q.ph === 0) {
            for (let i = 0; i < ceilingLights.length; i++) setLampLevel(i, 0);
            flashlight.intensity = 0; SC.fig.visible = false;
            if (q.t <= 0) {
                q.ph = 1; q.t = S[q.i][1];
                const p = scAhead(S[q.i][0], 0); p.x = Math.max(-1.1, Math.min(1.1, p.x));
                scPlace(SC.fig, p, 1.15); SC.fig.material.color.setHex(0xffffff); SC.fig.visible = true;
                restoreLamps(); scHit(0.4 + q.i * 0.3); scGlitch(60);
            }
        } else if (q.t <= 0) {
            SC.fig.visible = false; q.i++;
            if (q.i >= 3) { SC.seq = null; scLater(() => { scWhisper(scSide()); scBreath(scSide()); }, 500); }
            else { q.ph = 0; q.t = scR(0.5, 0.9); }
        }
    }

    if (SC.shOn) {
        const m = SC.sh, ang = scAngle(m.position), dist = cam.distanceTo(m.position);
        SC.shT -= dt; m.material.opacity = Math.min(0.6, m.material.opacity + dt * 0.9);
        m.rotation.y = Math.atan2(cam.x - m.position.x, cam.z - m.position.z);
        if (ang < 0.3 && m.material.opacity > 0.15) {
            SC.shOn = false; m.visible = false; scHit(0.35);
            if (Math.random() < 0.5) scGlitch(80);
            if (Math.random() < 0.5) scLater(() => scWhisper(scSide()), 600);
            SC.t = Math.max(SC.t, SC.next - scR(4, 8));
        } else if (SC.shT <= 0 || dist < 0.8 || ang > 2.2) { SC.shOn = false; m.visible = false; }
    }

    if (SC.cs === 1) {
        SC.ct -= dt;
        if (flashlightOn && scAngle(SC.ceil.position) < 0.2 && cam.distanceTo(SC.ceil.position) < 17) { SC.cs = 2; SC.ct = 0.6; scHit(0.5); scGlitch(90); }
        else if (SC.ct <= 0) { SC.cs = 0; SC.ceil.visible = false; }
    } else if (SC.cs === 2) {
        SC.ct -= dt;
        if (SC.ct <= 0) {
            SC.cs = 0; SC.ceil.visible = false; SC.flOff = 1.1;
            playHeartbeat(0.9); scLater(() => { scWhisper(-1); scWhisper(1); }, 900);
        }
    }

    if (SC.flOff > 0) { SC.flOff -= dt; flashlight.intensity = 0; }

    if (!SC.seq && !SC.busy && !SC.shOn && !SC.cs && SC.freeze <= 0) {
        SC.t += dt;
        if (SC.t >= SC.next) { SC.t = 0; SC.next = scR(16, 34) / (1 + currentStage * 0.22); scPick(); }
    }
}