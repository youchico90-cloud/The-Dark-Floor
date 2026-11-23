let audioCtx = null;
let masterGain = null;
let masterVolume = 0.8;
let ambient = null;

const FOOTSTEP_SAMPLES = { walk: [], sprint: [], crouch: [] };
const footstepBuffers = { walk: [], sprint: [], crouch: [] };
let noiseBuffer = null;
let stepSide = 1;
let gameAmbient = null;
let lampHum = null;
let tinnitus = null;

let reverbInput = null;
let convolverNode = null;
let reverbWetGain = null;
const reverbBuses = { low: null, medium: null, high: null };

let audioPaused = false;
let lifecycleBound = false;
let wasRunningBeforeHide = false;
let sprintStepCounter = 0;
let distantEventTimer = 6;
let lastAtmosphereUpdateMs = 0;
let _atmosAccum = 0;
let lastLampUpdateMs = 0;

let _audioCamPos = null;
let _audioCamFwd = null;
let _audioCamUp = null;
let _audioCamQuat = null;
const _lastListenerState = [NaN, NaN, NaN, NaN, NaN, NaN];

const MAX_ACTIVE_VOICES = 18;
const VOICE_CAPS = {
    footstep: 4,
    breath: 1,
    door: 4,
    click: 3,
    drip: 4,
    distant: 2,
    spark: 2,
    spatial: 5,
    horror: 3
};

let activeVoiceCount = 0;
const voiceCategoryCounts = Object.create(null);
const lastVoiceTimes = Object.create(null);
const activeVoiceForceStops = new Set();
const scheduledTimers = new Set();

function canPlayVoice(category, minIntervalMs = 0, allowOnGesture = false) {
    if (!audioCtx || !masterGain || document.hidden || audioCtx.state === 'closed') return false;
    if (audioCtx.state === 'suspended') {
        if (!allowOnGesture) return false;
        audioCtx.resume().catch(() => {});
    }
    if (activeVoiceCount >= MAX_ACTIVE_VOICES) return false;
    const cap = VOICE_CAPS[category] || 4;
    if ((voiceCategoryCounts[category] || 0) >= cap) return false;
    const nowMs = performance.now();
    if (minIntervalMs > 0 && nowMs - (lastVoiceTimes[category] || 0) < minIntervalMs) return false;
    lastVoiceTimes[category] = nowMs;
    return true;
}

function trackVoice(category, primaryNode, allNodes, extraCleanup = null, fallbackMs = 4500) {
    activeVoiceCount++;
    voiceCategoryCounts[category] = (voiceCategoryCounts[category] || 0) + 1;
    let released = false;
    let timerId = null;

    const release = () => {
        if (released) return;
        released = true;
        if (timerId !== null) {
            clearTimeout(timerId);
            timerId = null;
        }
        activeVoiceForceStops.delete(forceStop);
        activeVoiceCount = Math.max(0, activeVoiceCount - 1);
        voiceCategoryCounts[category] = Math.max(0, (voiceCategoryCounts[category] || 1) - 1);
        if (primaryNode) {
            try { primaryNode.onended = null; } catch (e) {}
        }
        for (let i = 0; i < allNodes.length; i++) {
            try { allNodes[i].disconnect(); } catch (e) {}
        }
        if (extraCleanup) {
            try { extraCleanup(); } catch (e) {}
        }
    };

    const forceStop = () => {
        for (let i = 0; i < allNodes.length; i++) {
            const n = allNodes[i];
            if (n && typeof n.stop === 'function') {
                try { n.stop(); } catch (e) {}
            }
        }
        release();
    };

    activeVoiceForceStops.add(forceStop);
    if (primaryNode) primaryNode.onended = release;
    timerId = setTimeout(forceStop, fallbackMs);
    return release;
}

function stopAllTransientVoices() {
    const stops = Array.from(activeVoiceForceStops);
    for (let i = 0; i < stops.length; i++) stops[i]();
}

function scheduleSoundTimer(fn, delayMs) {
    const id = setTimeout(() => {
        scheduledTimers.delete(id);
        if (!audioPaused && audioCtx && audioCtx.state !== 'closed') fn();
    }, delayMs);
    scheduledTimers.add(id);
    return id;
}

function clearScheduledTimers() {
    scheduledTimers.forEach(id => clearTimeout(id));
    scheduledTimers.clear();
}

function setupAudioLifecycle() {
    if (lifecycleBound) return;
    lifecycleBound = true;

    const unlock = () => {
        if (audioCtx && audioCtx.state === 'suspended' && !document.hidden) {
            audioCtx.resume().catch(() => {});
        }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });

    document.addEventListener('visibilitychange', () => {
        if (!audioCtx) return;
        if (document.hidden) {
            wasRunningBeforeHide = audioCtx.state === 'running';
            if (wasRunningBeforeHide) audioCtx.suspend().catch(() => {});
        } else if (wasRunningBeforeHide && audioCtx.state === 'suspended') {
            wasRunningBeforeHide = false;
            if (!audioPaused) audioCtx.resume().catch(() => {});
        }
    });
}

const FOOTSTEP_PROFILES = {
    walk:   { thudFrom: 95,  thudTo: 40, thudDur: 0.16, noiseFreq: 1100, noiseType: 'lowpass',  noiseDur: 0.09, thudGain: 0.22, noiseGain: 0.10 },
    sprint: { thudFrom: 140, thudTo: 55, thudDur: 0.10, noiseFreq: 2600, noiseType: 'highpass', noiseDur: 0.06, thudGain: 0.38, noiseGain: 0.22 },
    crouch: { thudFrom: 70,  thudTo: 35, thudDur: 0.20, noiseFreq: 500,  noiseType: 'lowpass',  noiseDur: 0.14, thudGain: 0.07, noiseGain: 0.03 }
};

const HEARTBEAT_START_STAGE = 6;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = masterVolume;

        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.knee.value = 18;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.2;

        const limiter = audioCtx.createDynamicsCompressor();
        limiter.threshold.value = -2;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.06;

        masterGain.connect(compressor);
        compressor.connect(limiter);
        limiter.connect(audioCtx.destination);

        initReverb();
        setupAudioLifecycle();
        loadFootstepSamples();
        loadDoorSample();
    }
}

function createCorridorImpulse(duration = 1.35, decay = 2.8) {
    const sr = audioCtx.sampleRate;
    const len = Math.max(1, Math.floor(sr * duration));
    const buf = audioCtx.createBuffer(2, len, sr);
    const left = buf.getChannelData(0);
    const right = buf.getChannelData(1);

    const earlyTaps = [
        [0.009, 0.34, -0.55],
        [0.015, 0.28,  0.60],
        [0.024, 0.21, -0.40],
        [0.036, 0.16,  0.45],
        [0.052, 0.11, -0.30],
        [0.072, 0.08,  0.25]
    ];
    for (let i = 0; i < earlyTaps.length; i++) {
        const [t, amp, pan] = earlyTaps[i];
        const idx = Math.floor(t * sr);
        if (idx + 2 < len) {
            const lGain = amp * (1 - Math.max(0, pan) * 0.7);
            const rGain = amp * (1 - Math.max(0, -pan) * 0.7);
            left[idx] += lGain * 0.6;
            left[idx + 1] += lGain * 0.4;
            right[idx] += rGain * 0.6;
            right[idx + 1] += rGain * 0.4;
        }
    }

    let lpL = 0;
    let lpR = 0;
    const tailStart = Math.floor(0.012 * sr);
    for (let i = tailStart; i < len; i++) {
        const tNorm = i / len;
        const env = Math.pow(1 - tNorm, decay) * 0.14;
        const damp = 0.35 + tNorm * 0.55;
        const nL = Math.random() * 2 - 1;
        const nR = Math.random() * 2 - 1;
        lpL = lpL * damp + nL * (1 - damp);
        lpR = lpR * damp + nR * (1 - damp);
        left[i] += lpL * env;
        right[i] += lpR * env;
    }
    return buf;
}

function initReverb() {
    if (!audioCtx || !masterGain || convolverNode) return;
    try {
        reverbInput = audioCtx.createGain();
        reverbInput.gain.value = 1.0;

        const preFilter = audioCtx.createBiquadFilter();
        preFilter.type = 'lowpass';
        preFilter.frequency.value = 2800;
        preFilter.Q.value = 0.7;

        convolverNode = audioCtx.createConvolver();
        convolverNode.normalize = false;
        convolverNode.buffer = createCorridorImpulse(1.35, 2.8);

        reverbWetGain = audioCtx.createGain();
        reverbWetGain.gain.value = 0.34;

        reverbInput.connect(preFilter);
        preFilter.connect(convolverNode);
        convolverNode.connect(reverbWetGain);
        reverbWetGain.connect(masterGain);

        const busLevels = { low: 0.24, medium: 0.44, high: 0.72 };
        for (const key in busLevels) {
            const g = audioCtx.createGain();
            g.gain.value = busLevels[key];
            g.connect(reverbInput);
            reverbBuses[key] = g;
        }
    } catch (e) {
        convolverNode = null;
    }
}

function sendToReverb(node, level = 'low') {
    if (reverbBuses[level]) {
        try { node.connect(reverbBuses[level]); } catch (e) {}
    }
}


function startMenuAmbient() {
    if (!audioCtx || ambient) return;
    const now = audioCtx.currentTime;
    const nodes = [];

    const out = audioCtx.createGain();
    out.gain.setValueAtTime(0, now);
    out.gain.setTargetAtTime(0.55, now, 1.5);
    out.connect(masterGain);

    const droneGain = audioCtx.createGain();
    droneGain.gain.value = 0.6;
    droneGain.connect(out);
    [[55, 0.5], [55.6, 0.5], [110.3, 0.14], [164.9, 0.05]].forEach(([freq, vol]) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.value = vol;
        osc.connect(g);
        g.connect(droneGain);
        osc.start(now);
        nodes.push(osc);
    });

    const lfo1 = audioCtx.createOscillator();
    const lfo1Gain = audioCtx.createGain();
    lfo1.frequency.value = 0.07;
    lfo1Gain.gain.value = 0.2;
    lfo1.connect(lfo1Gain);
    lfo1Gain.connect(droneGain.gain);
    lfo1.start(now);
    nodes.push(lfo1);

    const wind = audioCtx.createBufferSource();
    wind.buffer = getNoiseBuffer();
    wind.loop = true;
    const windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.8;
    const windGain = audioCtx.createGain();
    windGain.gain.value = 0.07;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(out);
    wind.start(now);
    nodes.push(wind);

    const lfo2 = audioCtx.createOscillator();
    const lfo2Gain = audioCtx.createGain();
    lfo2.frequency.value = 0.05;
    lfo2Gain.gain.value = 260;
    lfo2.connect(lfo2Gain);
    lfo2Gain.connect(windFilter.frequency);
    lfo2.start(now);
    nodes.push(lfo2);

    const lfo3 = audioCtx.createOscillator();
    const lfo3Gain = audioCtx.createGain();
    lfo3.frequency.value = 0.09;
    lfo3Gain.gain.value = 0.035;
    lfo3.connect(lfo3Gain);
    lfo3Gain.connect(windGain.gain);
    lfo3.start(now);
    nodes.push(lfo3);

    ambient = { out, nodes };
}

function stopMenuAmbient() {
    if (!ambient || !audioCtx) return;
    const { out, nodes } = ambient;
    ambient = null;
    out.gain.cancelScheduledValues(audioCtx.currentTime);
    out.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
    setTimeout(() => {
        nodes.forEach(n => {
            try { n.stop(); } catch (e) {}
            try { n.disconnect(); } catch (e) {}
        });
        try { out.disconnect(); } catch (e) {}
    }, 1500);
}

function unlockMenuAudio() {
    if (!inMenu) return;
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startMenuAmbient();
}

function startGameAmbient() {
    initAudio();
    if (!audioCtx || !masterGain) return;
    if (audioCtx.state === 'suspended' && !document.hidden) {
        audioCtx.resume().catch(() => {});
    }
    audioPaused = false;
    if (gameAmbient) return;

    const now = audioCtx.currentTime;
    const nodes = [];

    const out = audioCtx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.setTargetAtTime(0.38, now, 1.1);
    out.connect(masterGain);

    const droneFilter = audioCtx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 108;
    droneFilter.Q.value = 1.4;

    const droneGain = audioCtx.createGain();
    droneGain.gain.value = 0.36;
    droneFilter.connect(droneGain);
    droneGain.connect(out);

    const subOsc = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.value = 41.2;
    subGain.gain.value = 0.55;
    subOsc.connect(subGain);
    subGain.connect(droneFilter);
    subOsc.start(now);
    nodes.push(subOsc, subGain);

    const bodyOsc = audioCtx.createOscillator();
    const bodyGain = audioCtx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.value = 61.7;
    bodyGain.gain.value = 0.22;
    bodyOsc.connect(bodyGain);
    bodyGain.connect(droneFilter);
    bodyOsc.start(now);
    nodes.push(bodyOsc, bodyGain);

    const dissonantOsc = audioCtx.createOscillator();
    const dissonantGain = audioCtx.createGain();
    dissonantOsc.type = 'sawtooth';
    dissonantOsc.frequency.value = 43.5;
    dissonantGain.gain.value = 0.001;
    dissonantOsc.connect(dissonantGain);
    dissonantGain.connect(droneFilter);
    dissonantOsc.start(now);
    nodes.push(dissonantOsc, dissonantGain);

    const droneLfo = audioCtx.createOscillator();
    const droneLfoGain = audioCtx.createGain();
    droneLfo.frequency.value = 0.08;
    droneLfoGain.gain.value = 32;
    droneLfo.connect(droneLfoGain);
    droneLfoGain.connect(droneFilter.frequency);
    droneLfo.start(now);
    nodes.push(droneLfo, droneLfoGain, droneFilter, droneGain);

    const ventNoise = audioCtx.createBufferSource();
    ventNoise.buffer = getNoiseBuffer();
    ventNoise.loop = true;
    const ventFilter = audioCtx.createBiquadFilter();
    ventFilter.type = 'bandpass';
    ventFilter.frequency.value = 210;
    ventFilter.Q.value = 1.6;
    const ventGain = audioCtx.createGain();
    ventGain.gain.value = 0.075;
    ventNoise.connect(ventFilter);
    ventFilter.connect(ventGain);
    ventGain.connect(out);
    ventNoise.start(now, Math.random());
    nodes.push(ventNoise, ventFilter, ventGain);

    const ventLfo = audioCtx.createOscillator();
    const ventLfoGain = audioCtx.createGain();
    ventLfo.frequency.value = 0.06;
    ventLfoGain.gain.value = 0.022;
    ventLfo.connect(ventLfoGain);
    ventLfoGain.connect(ventGain.gain);
    ventLfo.start(now);
    nodes.push(ventLfo, ventLfoGain);

    const elecFilter = audioCtx.createBiquadFilter();
    elecFilter.type = 'lowpass';
    elecFilter.frequency.value = 260;
    const elecGain = audioCtx.createGain();
    elecGain.gain.value = 0.022;
    elecFilter.connect(elecGain);
    elecGain.connect(out);

    const elecOsc1 = audioCtx.createOscillator();
    elecOsc1.type = 'triangle';
    elecOsc1.frequency.value = 120;
    elecOsc1.connect(elecFilter);
    elecOsc1.start(now);

    const elecOsc2 = audioCtx.createOscillator();
    elecOsc2.type = 'sine';
    elecOsc2.frequency.value = 180;
    elecOsc2.connect(elecFilter);
    elecOsc2.start(now);
    nodes.push(elecOsc1, elecOsc2, elecFilter, elecGain);

    distantEventTimer = 7 + Math.random() * 6;
    gameAmbient = {
        out,
        nodes,
        droneFilter,
        subOsc,
        dissonantOsc,
        dissonantGain,
        ventFilter
    };

    startLampHum();
}

function stopGameAmbient() {
    stopLampHum();
    stopTinnitus();
    clearScheduledTimers();
    stopAllTransientVoices();

    if (!gameAmbient || !audioCtx) {
        gameAmbient = null;
        return;
    }

    const { out, nodes } = gameAmbient;
    gameAmbient = null;

    const now = audioCtx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setTargetAtTime(0, now, 0.09);

    setTimeout(() => {
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            if (n && typeof n.stop === 'function') {
                try { n.stop(); } catch (e) {}
            }
            try { n.disconnect(); } catch (e) {}
        }
        try { out.disconnect(); } catch (e) {}
    }, 520);
}

function pauseGameAudio() {
    audioPaused = true;
    stopGameAmbient();
}

function resumeGameAudio() {
    audioPaused = false;
    if (typeof gameStarted !== 'undefined' && gameStarted && (typeof inMenu === 'undefined' || !inMenu)) {
        startGameAmbient();
    }
}

function updateGameAmbient(delta) {
    if (!gameAmbient || !audioCtx || audioPaused || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;
    const stage = typeof currentStage === 'number' ? Math.max(0, Math.min(8, currentStage)) : 0;
    const panic = typeof panicLevel === 'number' ? Math.max(0, Math.min(1, panicLevel)) : 0;
    const stageNorm = stage / 8;
    const threat = Math.min(1, stageNorm * 0.78 + panic * 0.35);

    gameAmbient.droneFilter.frequency.setTargetAtTime(105 + threat * 165, now, 0.3);
    gameAmbient.subOsc.frequency.setTargetAtTime(41.2 - stageNorm * 5.2, now, 0.4);
    gameAmbient.dissonantOsc.frequency.setTargetAtTime(43.5 + stageNorm * 3.8 + panic * 1.4, now, 0.35);
    gameAmbient.dissonantGain.gain.setTargetAtTime(0.001 + stageNorm * 0.14 + panic * 0.09, now, 0.35);
    gameAmbient.ventFilter.frequency.setTargetAtTime(210 - stageNorm * 55, now, 0.4);
    gameAmbient.out.gain.setTargetAtTime(0.36 + threat * 0.18, now, 0.3);

    if (performance.now() - lastLampUpdateMs > 500 && lampHum) {
        const flicker = (typeof currentAnomalyType === 'number' && currentAnomalyType > 0 && Math.random() < 0.04) ? 0.45 : 0;
        updateLampHum(1 - stageNorm * 0.2, flicker, true);
    }

    distantEventTimer -= delta;
    if (distantEventTimer <= 0) {
        distantEventTimer = (16 - threat * 9) + Math.random() * (10 - threat * 4);
        playDistantCorridorEvent(threat);
    }
}

function playDistantCorridorEvent(threat = 0) {
    if (!canPlayVoice('distant', 2400, false)) return;
    const now = audioCtx.currentTime;
    const side = (Math.random() * 2 - 1) * 0.85;
    const kind = Math.floor(Math.random() * (threat > 0.35 ? 4 : 3));

    const out = audioCtx.createGain();
    out.gain.value = 0.07 + threat * 0.05;

    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 950 - threat * 250;

    let dest = out;
    const nodes = [out, lp];
    if (audioCtx.createStereoPanner) {
        const pan = audioCtx.createStereoPanner();
        pan.pan.value = side;
        out.connect(pan);
        pan.connect(lp);
        nodes.push(pan);
    } else {
        out.connect(lp);
    }
    lp.connect(masterGain);
    sendToReverb(lp, 'high');

    if (kind === 0) {
        const o1 = audioCtx.createOscillator();
        const o2 = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o1.type = 'sine';
        o2.type = 'triangle';
        const base = 240 + Math.random() * 140;
        o1.frequency.setValueAtTime(base, now);
        o2.frequency.setValueAtTime(base * 2.41, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.28, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        o1.connect(g);
        o2.connect(g);
        g.connect(dest);
        o1.start(now);
        o2.start(now);
        o1.stop(now + 0.68);
        o2.stop(now + 0.68);
        nodes.push(o1, o2, g);
        trackVoice('distant', o1, nodes, null, 1200);
    } else if (kind === 1) {
        const thud = audioCtx.createOscillator();
        const tg = audioCtx.createGain();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(78, now);
        thud.frequency.exponentialRampToValueAtTime(28, now + 0.22);
        tg.gain.setValueAtTime(0.0001, now);
        tg.gain.linearRampToValueAtTime(0.45, now + 0.01);
        tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        thud.connect(tg);
        tg.connect(dest);
        thud.start(now);
        thud.stop(now + 0.26);
        nodes.push(thud, tg);
        trackVoice('distant', thud, nodes, null, 800);
    } else if (kind === 2) {
        const noise = audioCtx.createBufferSource();
        noise.buffer = getNoiseBuffer();
        const bp = audioCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 8;
        bp.frequency.setValueAtTime(340, now);
        bp.frequency.linearRampToValueAtTime(620, now + 0.6);
        bp.frequency.linearRampToValueAtTime(290, now + 1.3);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.32, now + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
        noise.connect(bp);
        bp.connect(g);
        g.connect(dest);
        noise.start(now, Math.random() * 0.5);
        noise.stop(now + 1.4);
        nodes.push(noise, bp, g);
        trackVoice('distant', noise, nodes, null, 1800);
    } else {
        const carrier = audioCtx.createOscillator();
        const mod = audioCtx.createOscillator();
        const modGain = audioCtx.createGain();
        const g = audioCtx.createGain();
        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(92, now);
        carrier.frequency.linearRampToValueAtTime(74, now + 1.6);
        mod.type = 'sine';
        mod.frequency.value = 18;
        modGain.gain.value = 14;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.24, now + 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.65);
        mod.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(g);
        g.connect(dest);
        mod.start(now);
        carrier.start(now);
        mod.stop(now + 1.7);
        carrier.stop(now + 1.7);
        nodes.push(carrier, mod, modGain, g);
        trackVoice('distant', carrier, nodes, null, 2100);
    }
}

function startLampHum() {
    if (lampHum || !audioCtx || !masterGain) return;
    const now = audioCtx.currentTime;

    const out = audioCtx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.setTargetAtTime(0.025, now, 0.35);
    out.connect(masterGain);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 1.2;
    filter.connect(out);

    const osc50 = audioCtx.createOscillator();
    const g50 = audioCtx.createGain();
    osc50.type = 'sine';
    osc50.frequency.value = 50;
    g50.gain.value = 0.65;
    osc50.connect(g50);
    g50.connect(filter);

    const osc100 = audioCtx.createOscillator();
    const g100 = audioCtx.createGain();
    osc100.type = 'sawtooth';
    osc100.frequency.value = 100;
    g100.gain.value = 0.24;
    osc100.connect(g100);
    g100.connect(filter);

    const osc150 = audioCtx.createOscillator();
    const g150 = audioCtx.createGain();
    osc150.type = 'triangle';
    osc150.frequency.value = 150;
    g150.gain.value = 0.12;
    osc150.connect(g150);
    g150.connect(filter);

    osc50.start(now);
    osc100.start(now);
    osc150.start(now);

    lampHum = {
        out,
        filter,
        osc50,
        osc100,
        osc150,
        nodes: [osc50, g50, osc100, g100, osc150, g150, filter, out]
    };
}

function stopLampHum() {
    if (!lampHum || !audioCtx) {
        lampHum = null;
        return;
    }
    const { out, nodes } = lampHum;
    lampHum = null;
    const now = audioCtx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setTargetAtTime(0, now, 0.05);
    setTimeout(() => {
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            if (n && typeof n.stop === 'function') {
                try { n.stop(); } catch (e) {}
            }
            try { n.disconnect(); } catch (e) {}
        }
    }, 250);
}

function updateLampHum(brightness = 1, flickerAmount = 0, _internal = false) {
    if (!_internal) lastLampUpdateMs = performance.now();
    if (!lampHum || !audioCtx || audioPaused || audioCtx.state !== 'running') return;

    const now = audioCtx.currentTime;
    const b = Math.max(0, Math.min(1, brightness));
    const f = Math.max(0, Math.min(1, typeof flickerAmount === 'boolean' ? (flickerAmount ? 0.8 : 0) : flickerAmount));

    if (b <= 0.02 && f <= 0.05) {
        lampHum.out.gain.setTargetAtTime(0.0001, now, 0.025);
        return;
    }

    if (f > 0.08) {
        const stutter = Math.random() < f * 0.55 ? (0.12 + Math.random() * 0.35) : (0.85 + Math.random() * 0.55);
        lampHum.osc50.frequency.setTargetAtTime(50 + (Math.random() - 0.5) * f * 8, now, 0.015);
        lampHum.osc100.frequency.setTargetAtTime(100 + (Math.random() - 0.5) * f * 16, now, 0.015);
        lampHum.osc150.frequency.setTargetAtTime(150 + (Math.random() - 0.5) * f * 24, now, 0.015);
        lampHum.filter.frequency.setTargetAtTime(340 + f * 1050, now, 0.015);
        lampHum.out.gain.setTargetAtTime((0.024 + f * 0.048) * Math.max(0.2, b) * stutter, now, 0.012);
        if (Math.random() < f * 0.42) playLampSpark(f);
    } else {
        lampHum.osc50.frequency.setTargetAtTime(50, now, 0.05);
        lampHum.osc100.frequency.setTargetAtTime(100, now, 0.05);
        lampHum.osc150.frequency.setTargetAtTime(150, now, 0.05);
        lampHum.filter.frequency.setTargetAtTime(320, now, 0.05);
        lampHum.out.gain.setTargetAtTime(0.026 * b, now, 0.04);
    }
}

function playLampSpark(intensity = 0.6) {
    if (!canPlayVoice('spark', 130, false)) return;
    const now = audioCtx.currentTime;
    const src = audioCtx.createBufferSource();
    src.buffer = getNoiseBuffer();

    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600 + Math.random() * 2200;
    bp.Q.value = 3.5;

    const g = audioCtx.createGain();
    const peak = 0.035 + Math.min(1, intensity) * 0.055;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

    src.connect(bp);
    bp.connect(g);
    g.connect(masterGain);
    sendToReverb(g, 'low');

    src.start(now, Math.random() * 1.2);
    src.stop(now + 0.06);
    trackVoice('spark', src, [src, bp, g], null, 300);
}

function getNoiseBuffer() {
    if (!noiseBuffer) {
        const len = audioCtx.sampleRate * 2;
        noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}
// ===== ЕСІК ДЫБЫСЫ (аудио файл) =====
// door.mp3 файлын index.html жанына салыңыз. Файл табылмаса, ескі синтезделген дыбыс қолданылады.
const DOOR_SAMPLE_URL = 'door.mp3';
const DOOR_SAMPLE_GAIN = 0.9;
const DOOR_SAMPLE_MAX_SEC = 3.5;
let doorBuffer = null;

async function loadDoorSample() {
    if (!audioCtx || doorBuffer) return;
    try {
        const res = await fetch(DOOR_SAMPLE_URL);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        doorBuffer = await audioCtx.decodeAudioData(await res.arrayBuffer());
    } catch (e) {
        doorBuffer = null;
    }
}

async function loadFootstepSamples() {
    for (const type in FOOTSTEP_SAMPLES) {
        for (const url of FOOTSTEP_SAMPLES[type]) {
            try {
                const res = await fetch(url);
                const buf = await audioCtx.decodeAudioData(await res.arrayBuffer());
                footstepBuffers[type].push(buf);
            } catch (err) {
                console.warn('Қадам дыбысы жүктелмеді:', url);
            }
        }
    }
}

function playFootstep(type = 'walk') {
    if (!canPlayVoice('footstep', 85, true)) return;
    const p = FOOTSTEP_PROFILES[type] || FOOTSTEP_PROFILES.walk;
    const now = audioCtx.currentTime;
    const pitch = 0.88 + Math.random() * 0.24;
    const filterVar = 0.86 + Math.random() * 0.28;
    const volume = 0.85 + Math.random() * 0.28;

    stepSide *= -1;
    const out = audioCtx.createGain();
    out.gain.value = volume;

    const nodes = [out];
    let routeDest = out;
    if (audioCtx.createStereoPanner) {
        const pan = audioCtx.createStereoPanner();
        pan.pan.value = stepSide * (0.12 + Math.random() * 0.06);
        out.connect(pan);
        pan.connect(masterGain);
        sendToReverb(pan, type === 'sprint' ? 'medium' : 'low');
        nodes.push(pan);
    } else {
        out.connect(masterGain);
        sendToReverb(out, type === 'sprint' ? 'medium' : 'low');
    }

    const bufs = footstepBuffers[type];
    if (bufs && bufs.length) {
        const src = audioCtx.createBufferSource();
        src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
        src.playbackRate.value = pitch;
        src.connect(routeDest);
        src.start(now);
        nodes.push(src);
        trackVoice('footstep', src, nodes, null, 1500);
        if (type === 'sprint') {
            sprintStepCounter = (sprintStepCounter + 1) % 4;
            if (sprintStepCounter === 0 || sprintStepCounter === 2) {
                playSprintBreath(sprintStepCounter === 0 ? 'exhale' : 'inhale');
            }
        }
        return;
    }

    const thud = audioCtx.createOscillator();
    const thudGain = audioCtx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(p.thudFrom * pitch, now);
    thud.frequency.exponentialRampToValueAtTime(p.thudTo * pitch, now + p.thudDur);
    thudGain.gain.setValueAtTime(p.thudGain, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + p.thudDur);
    thud.connect(thudGain);
    thudGain.connect(routeDest);
    thud.start(now);
    thud.stop(now + p.thudDur + 0.01);
    nodes.push(thud, thudGain);

    const tap = audioCtx.createBufferSource();
    tap.buffer = getNoiseBuffer();
    const tapFilter = audioCtx.createBiquadFilter();
    tapFilter.type = 'bandpass';
    tapFilter.frequency.value = (type === 'sprint' ? 1950 : (type === 'crouch' ? 720 : 1350)) * filterVar;
    tapFilter.Q.value = 2.1;
    const tapGain = audioCtx.createGain();
    const tapPeak = p.noiseGain * (type === 'crouch' ? 0.9 : 1.35);
    tapGain.gain.setValueAtTime(0.0001, now);
    tapGain.gain.linearRampToValueAtTime(tapPeak, now + 0.004);
    tapGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.038);
    tap.connect(tapFilter);
    tapFilter.connect(tapGain);
    tapGain.connect(routeDest);
    tap.start(now, Math.random() * 1.1);
    tap.stop(now + 0.045);
    nodes.push(tap, tapFilter, tapGain);

    const grit = audioCtx.createBufferSource();
    grit.buffer = getNoiseBuffer();
    const gritFilter = audioCtx.createBiquadFilter();
    gritFilter.type = type === 'crouch' ? 'lowpass' : 'highpass';
    gritFilter.frequency.value = (type === 'sprint' ? 3200 : (type === 'crouch' ? 900 : 2500)) * filterVar;
    const gritGain = audioCtx.createGain();
    const gritStart = type === 'walk' ? now + 0.018 : now;
    const gritDur = p.noiseDur;
    gritGain.gain.setValueAtTime(p.noiseGain * 0.55, gritStart);
    gritGain.gain.exponentialRampToValueAtTime(0.0005, gritStart + gritDur);
    grit.connect(gritFilter);
    gritFilter.connect(gritGain);
    gritGain.connect(routeDest);
    grit.start(gritStart, Math.random() * 1.1);
    grit.stop(gritStart + gritDur + 0.01);
    nodes.push(grit, gritFilter, gritGain);

    const lastNode = (gritStart + gritDur >= now + p.thudDur) ? grit : thud;
    trackVoice('footstep', lastNode, nodes, null, 700);

    if (type === 'sprint') {
        sprintStepCounter = (sprintStepCounter + 1) % 4;
        if (sprintStepCounter === 0 || sprintStepCounter === 2) {
            playSprintBreath(sprintStepCounter === 0 ? 'exhale' : 'inhale');
        }
    }
}

function playSprintBreath(phase = 'exhale') {
    if (!canPlayVoice('breath', 240, false)) return;
    const now = audioCtx.currentTime;
    const panic = typeof panicLevel === 'number' ? Math.max(0, Math.min(1, panicLevel)) : 0;
    const dur = phase === 'exhale' ? 0.25 : 0.19;
    const freq = (phase === 'exhale' ? 660 : 1120) * (0.93 + Math.random() * 0.14) * (1 + panic * 0.2);

    const src = audioCtx.createBufferSource();
    src.buffer = getNoiseBuffer();

    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 260;

    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, now);
    bp.frequency.linearRampToValueAtTime(freq * (phase === 'exhale' ? 0.82 : 1.14), now + dur);
    bp.Q.value = 2.2;

    const g = audioCtx.createGain();
    const peak = 0.048 + panic * 0.042;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.045);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(masterGain);

    src.start(now, Math.random() * 1.1);
    src.stop(now + dur + 0.01);
    trackVoice('breath', src, [src, hp, bp, g], null, 600);
}

function playDoorLatch() {
    if (!canPlayVoice('door', 35, true)) return;
    const now = audioCtx.currentTime;

    const clickNoise = audioCtx.createBufferSource();
    clickNoise.buffer = getNoiseBuffer();
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2300 + Math.random() * 400;
    bp.Q.value = 3.8;
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.linearRampToValueAtTime(0.18, now + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.0005, now + 0.04);
    clickNoise.connect(bp);
    bp.connect(ng);
    ng.connect(masterGain);
    sendToReverb(ng, 'low');

    const metal = audioCtx.createOscillator();
    const mg = audioCtx.createGain();
    metal.type = 'triangle';
    metal.frequency.setValueAtTime(1180, now + 0.015);
    metal.frequency.exponentialRampToValueAtTime(690, now + 0.06);
    mg.gain.setValueAtTime(0.0001, now + 0.015);
    mg.gain.linearRampToValueAtTime(0.09, now + 0.02);
    mg.gain.exponentialRampToValueAtTime(0.0005, now + 0.07);
    metal.connect(mg);
    mg.connect(masterGain);
    sendToReverb(mg, 'low');

    clickNoise.start(now, Math.random() * 1.1);
    clickNoise.stop(now + 0.045);
    metal.start(now + 0.015);
    metal.stop(now + 0.075);

    trackVoice('door', metal, [clickNoise, bp, ng, metal, mg], null, 400);
}

function playDoorOpen() {
    if (!canPlayVoice('door', 40, true)) return;
    const now = audioCtx.currentTime;

    const body = audioCtx.createOscillator();
    const bodyLp = audioCtx.createBiquadFilter();
    const bodyGain = audioCtx.createGain();
    body.type = 'sawtooth';
    body.frequency.setValueAtTime(68, now);
    body.frequency.linearRampToValueAtTime(52, now + 0.38);
    bodyLp.type = 'lowpass';
    bodyLp.frequency.value = 185;
    bodyLp.Q.value = 2.4;
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.linearRampToValueAtTime(0.16, now + 0.06);
    bodyGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.4);
    body.connect(bodyLp);
    bodyLp.connect(bodyGain);
    bodyGain.connect(masterGain);
    sendToReverb(bodyGain, 'medium');

    const creak = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    const creakBp = audioCtx.createBiquadFilter();
    const creakGain = audioCtx.createGain();
    creak.type = 'sawtooth';
    creak.frequency.setValueAtTime(290, now + 0.03);
    creak.frequency.linearRampToValueAtTime(430, now + 0.18);
    creak.frequency.linearRampToValueAtTime(260, now + 0.36);
    lfo.frequency.value = 17;
    lfoGain.gain.value = 32;
    lfo.connect(lfoGain);
    lfoGain.connect(creak.frequency);

    creakBp.type = 'bandpass';
    creakBp.frequency.value = 720;
    creakBp.Q.value = 4.6;
    creakGain.gain.setValueAtTime(0.0001, now + 0.03);
    creakGain.gain.linearRampToValueAtTime(0.085, now + 0.11);
    creakGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.38);

    creak.connect(creakBp);
    creakBp.connect(creakGain);
    creakGain.connect(masterGain);
    sendToReverb(creakGain, 'medium');

    body.start(now);
    body.stop(now + 0.42);
    lfo.start(now + 0.03);
    lfo.stop(now + 0.39);
    creak.start(now + 0.03);
    creak.stop(now + 0.39);

    trackVoice('door', body, [body, bodyLp, bodyGain, creak, lfo, lfoGain, creakBp, creakGain], null, 900);
}

function playDoorSlam() {
    if (!canPlayVoice('door', 40, true)) return;
    const now = audioCtx.currentTime;

    const thump = audioCtx.createOscillator();
    const tg = audioCtx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(118, now);
    thump.frequency.exponentialRampToValueAtTime(30, now + 0.22);
    tg.gain.setValueAtTime(0.0001, now);
    tg.gain.linearRampToValueAtTime(0.36, now + 0.006);
    tg.gain.exponentialRampToValueAtTime(0.0005, now + 0.25);
    thump.connect(tg);
    tg.connect(masterGain);
    sendToReverb(tg, 'high');

    const boom = audioCtx.createBufferSource();
    boom.buffer = getNoiseBuffer();
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, now);
    lp.frequency.exponentialRampToValueAtTime(130, now + 0.2);
    const bg = audioCtx.createGain();
    bg.gain.setValueAtTime(0.0001, now);
    bg.gain.linearRampToValueAtTime(0.24, now + 0.008);
    bg.gain.exponentialRampToValueAtTime(0.0005, now + 0.22);
    boom.connect(lp);
    lp.connect(bg);
    bg.connect(masterGain);
    sendToReverb(bg, 'high');

    const rattle = audioCtx.createBufferSource();
    rattle.buffer = getNoiseBuffer();
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1350;
    bp.Q.value = 2.6;
    const rg = audioCtx.createGain();
    rg.gain.setValueAtTime(0.0001, now + 0.025);
    rg.gain.linearRampToValueAtTime(0.09, now + 0.032);
    rg.gain.exponentialRampToValueAtTime(0.0005, now + 0.095);
    rattle.connect(bp);
    bp.connect(rg);
    rg.connect(masterGain);
    sendToReverb(rg, 'medium');

    thump.start(now);
    thump.stop(now + 0.26);
    boom.start(now, Math.random() * 1.1);
    boom.stop(now + 0.23);
    rattle.start(now + 0.025, Math.random() * 1.1);
    rattle.stop(now + 0.1);

    trackVoice('door', thump, [thump, tg, boom, lp, bg, rattle, bp, rg], null, 800);
}

function playDoorSampleSound() {
    if (!doorBuffer || !canPlayVoice('door', 40, true)) return false;
    const now = audioCtx.currentTime;
    const dur = Math.min(doorBuffer.duration, DOOR_SAMPLE_MAX_SEC);

    const src = audioCtx.createBufferSource();
    src.buffer = doorBuffer;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(DOOR_SAMPLE_GAIN, now);
    if (doorBuffer.duration > DOOR_SAMPLE_MAX_SEC) {
        g.gain.setValueAtTime(DOOR_SAMPLE_GAIN, now + dur - 0.4);
        g.gain.linearRampToValueAtTime(0.0001, now + dur);
    }
    src.connect(g);
    g.connect(masterGain);
    sendToReverb(g, 'low');
    src.start(now);
    src.stop(now + dur + 0.02);
    trackVoice('door', src, [src, g], null, dur * 1000 + 600);
    return true;
}

function playDoorSound() {
    if (!audioCtx || audioPaused) return;
    if (playDoorSampleSound()) return;
    playDoorSynthSound();
}

function playDoorSynthSound() {
    playDoorLatch();
    scheduleSoundTimer(() => playDoorOpen(), 65);
    scheduleSoundTimer(() => playDoorSlam(), 470);
}
function playClickSound() {
    if (!canPlayVoice('click', 35, true)) return;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.024);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.028);
    osc.connect(g);
    g.connect(masterGain);

    const snap = audioCtx.createBufferSource();
    snap.buffer = getNoiseBuffer();
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3100;
    bp.Q.value = 2.8;
    const sg = audioCtx.createGain();
    sg.gain.setValueAtTime(0.09, now);
    sg.gain.exponentialRampToValueAtTime(0.0005, now + 0.02);
    snap.connect(bp);
    bp.connect(sg);
    sg.connect(masterGain);
    sendToReverb(sg, 'low');

    osc.start(now);
    osc.stop(now + 0.03);
    snap.start(now, Math.random() * 1.1);
    snap.stop(now + 0.024);

    trackVoice('click', osc, [osc, g, snap, bp, sg], null, 300);
}

function playFlashlightSound(isOn = (typeof flashlightOn !== 'undefined' ? flashlightOn : true)) {
    if (!canPlayVoice('click', 45, true)) return;
    const now = audioCtx.currentTime;
    const nodes = [];

    const press = audioCtx.createOscillator();
    const pg = audioCtx.createGain();
    press.type = 'sine';
    press.frequency.setValueAtTime(320, now);
    press.frequency.exponentialRampToValueAtTime(140, now + 0.018);
    pg.gain.setValueAtTime(0.13, now);
    pg.gain.exponentialRampToValueAtTime(0.0005, now + 0.02);
    press.connect(pg);
    pg.connect(masterGain);
    press.start(now);
    press.stop(now + 0.022);
    nodes.push(press, pg);

    const latchTime = now + 0.022;
    const latch = audioCtx.createBufferSource();
    latch.buffer = getNoiseBuffer();
    const lBp = audioCtx.createBiquadFilter();
    lBp.type = 'bandpass';
    lBp.frequency.value = isOn ? 3900 : 2950;
    lBp.Q.value = 3.2;
    const lg = audioCtx.createGain();
    lg.gain.setValueAtTime(0.16, latchTime);
    lg.gain.exponentialRampToValueAtTime(0.0005, latchTime + 0.024);
    latch.connect(lBp);
    lBp.connect(lg);
    lg.connect(masterGain);
    sendToReverb(lg, 'low');
    latch.start(latchTime, Math.random() * 1.1);
    latch.stop(latchTime + 0.028);
    nodes.push(latch, lBp, lg);

    const bodyPing = audioCtx.createOscillator();
    const bpg = audioCtx.createGain();
    bodyPing.type = 'triangle';
    bodyPing.frequency.setValueAtTime(isOn ? 1480 : 1080, latchTime);
    bodyPing.frequency.exponentialRampToValueAtTime(520, latchTime + 0.024);
    bpg.gain.setValueAtTime(0.08, latchTime);
    bpg.gain.exponentialRampToValueAtTime(0.0005, latchTime + 0.028);
    bodyPing.connect(bpg);
    bpg.connect(masterGain);
    bodyPing.start(latchTime);
    bodyPing.stop(latchTime + 0.032);
    nodes.push(bodyPing, bpg);

    let lastNode = bodyPing;
    if (isOn) {
        const whine = audioCtx.createOscillator();
        const wg = audioCtx.createGain();
        whine.type = 'sine';
        whine.frequency.setValueAtTime(2800, latchTime);
        whine.frequency.linearRampToValueAtTime(3450, latchTime + 0.045);
        wg.gain.setValueAtTime(0.0001, latchTime);
        wg.gain.linearRampToValueAtTime(0.014, latchTime + 0.01);
        wg.gain.exponentialRampToValueAtTime(0.0001, latchTime + 0.05);
        whine.connect(wg);
        wg.connect(masterGain);
        whine.start(latchTime);
        whine.stop(latchTime + 0.055);
        nodes.push(whine, wg);
        lastNode = whine;
    }

    trackVoice('click', lastNode, nodes, null, 350);
}

function playBrokenFlashlightSound() {
    if (!canPlayVoice('spark', 110, true)) return;
    const now = audioCtx.currentTime;
    const nodes = [];
    const bursts = 2 + Math.floor(Math.random() * 3);
    let offset = 0;
    let lastNode = null;

    for (let i = 0; i < bursts; i++) {
        const t = now + offset;
        const src = audioCtx.createBufferSource();
        src.buffer = getNoiseBuffer();
        const bp = audioCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2300 + Math.random() * 2400;
        bp.Q.value = 3.6;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.11 + Math.random() * 0.06, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 0.025);
        src.connect(bp);
        bp.connect(g);
        g.connect(masterGain);
        sendToReverb(g, 'low');
        src.start(t, Math.random() * 1.1);
        src.stop(t + 0.028);
        nodes.push(src, bp, g);
        lastNode = src;
        offset += 0.022 + Math.random() * 0.045;
    }

    const buzz = audioCtx.createOscillator();
    const buzzBp = audioCtx.createBiquadFilter();
    const bg = audioCtx.createGain();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(175 + Math.random() * 45, now);
    buzzBp.type = 'bandpass';
    buzzBp.frequency.value = 2100;
    buzzBp.Q.value = 4.5;
    bg.gain.setValueAtTime(0.0001, now);
    bg.gain.linearRampToValueAtTime(0.032, now + 0.01);
    bg.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.03);
    buzz.connect(buzzBp);
    buzzBp.connect(bg);
    bg.connect(masterGain);
    buzz.start(now);
    buzz.stop(now + offset + 0.035);
    nodes.push(buzz, buzzBp, bg);
    lastNode = buzz;

    trackVoice('spark', lastNode, nodes, null, 500);
}
function playHorrorHum() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

function playWinSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    [220, 277.18, 329.63, 440].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.18;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 1.7);
    });
}

function updateAudioListener(cam) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    if (!cam && typeof camera !== 'undefined') cam = camera;
    if (!cam || !cam.position) return;

    let px = cam.position.x, py = cam.position.y, pz = cam.position.z;
    let fx = 0, fy = 0, fz = -1;
    let ux = 0, uy = 1, uz = 0;

    if (typeof THREE !== 'undefined' && cam.getWorldDirection && cam.getWorldPosition && cam.getWorldQuaternion) {
        if (!_audioCamPos) _audioCamPos = new THREE.Vector3();
        if (!_audioCamFwd) _audioCamFwd = new THREE.Vector3();
        if (!_audioCamUp)  _audioCamUp  = new THREE.Vector3();
        if (!_audioCamQuat) _audioCamQuat = new THREE.Quaternion();

        cam.getWorldPosition(_audioCamPos);
        cam.getWorldDirection(_audioCamFwd);
        cam.getWorldQuaternion(_audioCamQuat);
        _audioCamUp.set(0, 1, 0).applyQuaternion(_audioCamQuat);

        px = _audioCamPos.x; py = _audioCamPos.y; pz = _audioCamPos.z;
        fx = _audioCamFwd.x; fy = _audioCamFwd.y; fz = _audioCamFwd.z;
        ux = _audioCamUp.x;  uy = _audioCamUp.y;  uz = _audioCamUp.z;
    } else if (cam.matrixWorld && cam.matrixWorld.elements) {
        const e = cam.matrixWorld.elements;
        fx = -e[8]; fy = -e[9]; fz = -e[10];
        ux = e[4];  uy = e[5];  uz = e[6];
    }

    const l = _lastListenerState;
    if (
        Math.abs(px - l[0]) < 0.002 && Math.abs(py - l[1]) < 0.002 && Math.abs(pz - l[2]) < 0.002 &&
        Math.abs(fx - l[3]) < 0.002 && Math.abs(fy - l[4]) < 0.002 && Math.abs(fz - l[5]) < 0.002
    ) return;

    l[0] = px; l[1] = py; l[2] = pz;
    l[3] = fx; l[4] = fy; l[5] = fz;

    const listener = audioCtx.listener;
    const now = audioCtx.currentTime;
    if (listener.positionX) {
        listener.positionX.setValueAtTime(px, now);
        listener.positionY.setValueAtTime(py, now);
        listener.positionZ.setValueAtTime(pz, now);
        listener.forwardX.setValueAtTime(fx, now);
        listener.forwardY.setValueAtTime(fy, now);
        listener.forwardZ.setValueAtTime(fz, now);
        listener.upX.setValueAtTime(ux, now);
        listener.upY.setValueAtTime(uy, now);
        listener.upZ.setValueAtTime(uz, now);
    } else if (listener.setPosition) {
        listener.setPosition(px, py, pz);
        if (listener.setOrientation) listener.setOrientation(fx, fy, fz, ux, uy, uz);
    }
}

function createSpatialPanner(x = 0, y = 0, z = 0, opts = {}) {
    const panner = audioCtx.createPanner();
    try {
        panner.panningModel = 'HRTF';
    } catch (e) {
        panner.panningModel = 'equalpower';
    }
    panner.distanceModel = opts.distanceModel || 'inverse';
    panner.refDistance = opts.refDistance || 1.1;
    panner.maxDistance = opts.maxDistance || 26;
    panner.rolloffFactor = opts.rolloffFactor || 1.5;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;

    const now = audioCtx.currentTime;
    if (panner.positionX) {
        panner.positionX.setValueAtTime(x, now);
        panner.positionY.setValueAtTime(y, now);
        panner.positionZ.setValueAtTime(z, now);
    } else if (panner.setPosition) {
        panner.setPosition(x, y, z);
    }

    panner.connect(masterGain);
    sendToReverb(panner, opts.reverb || 'medium');
    return panner;
}

function triggerDripNodes(vol, destNode, extraNodes = [], category = 'drip') {
    const t = audioCtx.currentTime;
    const v = Math.max(0, Math.min(1.5, vol));
    const pitch = 0.88 + Math.random() * 0.24;

    const bubble = audioCtx.createOscillator();
    const bg = audioCtx.createGain();
    bubble.type = 'sine';
    bubble.frequency.setValueAtTime(690 * pitch, t);
    bubble.frequency.exponentialRampToValueAtTime(1780 * pitch, t + 0.036);
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(0.22 * v, t + 0.004);
    bg.gain.exponentialRampToValueAtTime(0.0005, t + 0.065);
    bubble.connect(bg);
    bg.connect(destNode);

    const ripple = audioCtx.createOscillator();
    const rg = audioCtx.createGain();
    ripple.type = 'sine';
    ripple.frequency.setValueAtTime(360 * pitch, t);
    ripple.frequency.exponentialRampToValueAtTime(190 * pitch, t + 0.055);
    rg.gain.setValueAtTime(0.08 * v, t);
    rg.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
    ripple.connect(rg);
    rg.connect(destNode);

    const splash = audioCtx.createBufferSource();
    splash.buffer = getNoiseBuffer();
    const sBp = audioCtx.createBiquadFilter();
    sBp.type = 'bandpass';
    sBp.frequency.value = 2300 * pitch;
    sBp.Q.value = 2.8;
    const sg = audioCtx.createGain();
    sg.gain.setValueAtTime(0.045 * v, t);
    sg.gain.exponentialRampToValueAtTime(0.0005, t + 0.026);
    splash.connect(sBp);
    sBp.connect(sg);
    sg.connect(destNode);

    bubble.start(t);
    bubble.stop(t + 0.072);
    ripple.start(t);
    ripple.stop(t + 0.065);
    splash.start(t, Math.random() * 1.1);
    splash.stop(t + 0.03);

    const allNodes = extraNodes.concat([bubble, bg, ripple, rg, splash, sBp, sg]);
    trackVoice(category, bubble, allNodes, null, 500);
}

function playDripSound(vol) {
    if (!isFinite(vol) || vol <= 0) return;
    if (!canPlayVoice('drip', 45, false)) return;
    const out = audioCtx.createGain();
    out.gain.value = 1.0;
    out.connect(masterGain);
    sendToReverb(out, 'medium');
    triggerDripNodes(vol, out, [out], 'drip');
}

function playSpatialDrip(vol = 0.85, x = 0, y = 0, z = 0) {
    if (!isFinite(vol) || vol <= 0) return;
    if (!canPlayVoice('drip', 45, false)) return;
    let px = x, py = y, pz = z;
    if (typeof x === 'object' && x !== null) {
        px = x.x || 0; py = x.y || 0; pz = x.z || 0;
    }
    const panner = createSpatialPanner(px, py, pz, { refDistance: 1.0, maxDistance: 22, rolloffFactor: 1.6, reverb: 'medium' });
    triggerDripNodes(vol, panner, [panner], 'drip');
}

function playSpatialSound(type, x = 0, y = 0, z = 0, vol = 0.7) {
    if (!isFinite(vol) || vol <= 0) return;
    let px = x, py = y, pz = z;
    if (typeof x === 'object' && x !== null) {
        px = x.x || 0; py = x.y || 0; pz = x.z || 0;
    }
    if (type === 'drip') {
        playSpatialDrip(vol, px, py, pz);
        return;
    }
    if (!canPlayVoice('spatial', 70, false)) return;

    const now = audioCtx.currentTime;
    const v = Math.max(0, Math.min(1.5, vol));
    const panner = createSpatialPanner(px, py, pz, { refDistance: 1.3, maxDistance: 28, rolloffFactor: 1.4, reverb: 'medium' });

    if (type === 'knock') {
        const osc = audioCtx.createOscillator();
        const og = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(52, now + 0.11);
        og.gain.setValueAtTime(0.32 * v, now);
        og.gain.exponentialRampToValueAtTime(0.0005, now + 0.12);
        osc.connect(og);
        og.connect(panner);
        osc.start(now);
        osc.stop(now + 0.13);
        trackVoice('spatial', osc, [panner, osc, og], null, 600);
    } else if (type === 'spark') {
        const src = audioCtx.createBufferSource();
        src.buffer = getNoiseBuffer();
        const bp = audioCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 3100;
        bp.Q.value = 3.2;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.14 * v, now);
        g.gain.exponentialRampToValueAtTime(0.0005, now + 0.065);
        src.connect(bp);
        bp.connect(g);
        g.connect(panner);
        src.start(now, Math.random() * 1.1);
        src.stop(now + 0.07);
        trackVoice('spatial', src, [panner, src, bp, g], null, 500);
    } else {
        const src = audioCtx.createBufferSource();
        src.buffer = getNoiseBuffer();
        const bp = audioCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(420, now);
        bp.frequency.linearRampToValueAtTime(760, now + 0.35);
        bp.Q.value = 6.0;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.16 * v, now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0005, now + 0.42);
        src.connect(bp);
        bp.connect(g);
        g.connect(panner);
        src.start(now, Math.random() * 1.0);
        src.stop(now + 0.45);
        trackVoice('spatial', src, [panner, src, bp, g], null, 900);
    }
}

function setMasterVolume(percent) {
    masterVolume = Math.max(0, Math.min(1, percent / 100));
    document.getElementById('volume-value').textContent = Math.round(percent) + '%';
    if (masterGain && audioCtx) masterGain.gain.setTargetAtTime(masterVolume, audioCtx.currentTime, 0.02);
    try { localStorage.setItem('masterVolume', String(percent)); } catch (e) {}
}

function setupVolumeSlider() {
    const slider = document.getElementById('volume-slider');
    try {
        const saved = localStorage.getItem('masterVolume');
        if (saved !== null && !isNaN(parseFloat(saved))) slider.value = saved;
    } catch (e) {}
    setMasterVolume(parseFloat(slider.value));

    slider.addEventListener('input', () => setMasterVolume(parseFloat(slider.value)));
    slider.addEventListener('change', () => {
        initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        playFootstep('walk');
    });
}

function playHeartbeat(strength) {
    const s = Math.max(0.05, Math.min(1, Number(strength) || 0.35));
    heartbeatPulse = Math.max(heartbeatPulse, Math.min(1, s * 1.4));
    if (!audioCtx || !masterGain || audioPaused || document.hidden || audioCtx.state !== 'running') return;

    const now = audioCtx.currentTime;
    const dubDelay = 0.175 - s * 0.03;
    const nodes = [];
    let lastThump = null;

    [[0, 1.0, 68, 28], [dubDelay, 0.72, 86, 36]].forEach(([offset, rel, fStart, fEnd]) => {
        const t = now + offset;
        const vol = s * rel;

        const thump = audioCtx.createOscillator();
        const thumpGain = audioCtx.createGain();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(fStart, t);
        thump.frequency.exponentialRampToValueAtTime(fEnd, t + 0.15);
        thumpGain.gain.setValueAtTime(0.0001, t);
        thumpGain.gain.exponentialRampToValueAtTime(vol, t + 0.016);
        thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.21);
        thump.connect(thumpGain);
        thumpGain.connect(masterGain);
        thump.start(t);
        thump.stop(t + 0.23);

        const body = audioCtx.createOscillator();
        const bodyGain = audioCtx.createGain();
        body.type = 'triangle';
        body.frequency.setValueAtTime(fStart * 1.65, t);
        body.frequency.exponentialRampToValueAtTime(fEnd * 1.4, t + 0.1);
        bodyGain.gain.setValueAtTime(0.0001, t);
        bodyGain.gain.exponentialRampToValueAtTime(vol * 0.32, t + 0.012);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        body.connect(bodyGain);
        bodyGain.connect(masterGain);
        body.start(t);
        body.stop(t + 0.14);

        const rush = audioCtx.createBufferSource();
        rush.buffer = getNoiseBuffer();
        const rushLp = audioCtx.createBiquadFilter();
        rushLp.type = 'lowpass';
        rushLp.frequency.value = 145;
        const rushGain = audioCtx.createGain();
        rushGain.gain.setValueAtTime(0.0001, t);
        rushGain.gain.linearRampToValueAtTime(vol * 0.26, t + 0.02);
        rushGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
        rush.connect(rushLp);
        rushLp.connect(rushGain);
        rushGain.connect(masterGain);
        rush.start(t, Math.random() * 1.1);
        rush.stop(t + 0.12);

        nodes.push(thump, thumpGain, body, bodyGain, rush, rushLp, rushGain);
        lastThump = thump;
    });

    trackVoice('horror', lastThump, nodes, null, 700);
}

function stopTinnitus() {
    if (!tinnitus || !audioCtx) {
        tinnitus = null;
        return;
    }
    const { out, nodes } = tinnitus;
    tinnitus = null;
    const now = audioCtx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setTargetAtTime(0, now, 0.08);
    setTimeout(() => {
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            if (n && typeof n.stop === 'function') {
                try { n.stop(); } catch (e) {}
            }
            try { n.disconnect(); } catch (e) {}
        }
        try { out.disconnect(); } catch (e) {}
    }, 350);
}

function updateTinnitus(delta, panic) {
    if (!audioCtx || !masterGain) return;
    const active = !audioPaused && !document.hidden && audioCtx.state === 'running' &&
        typeof gameStarted !== 'undefined' && gameStarted &&
        (typeof inMenu === 'undefined' || !inMenu);

    if (!active || panic < 0.52) {
        if (tinnitus) {
            tinnitus.lowTime += delta;
            tinnitus.out.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.12);
            if (!active || tinnitus.lowTime > 0.45) stopTinnitus();
        }
        return;
    }

    if (!tinnitus && panic >= 0.55) {
        const now = audioCtx.currentTime;
        const out = audioCtx.createGain();
        out.gain.setValueAtTime(0.0001, now);
        out.connect(masterGain);

        const osc1 = audioCtx.createOscillator();
        const g1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 3850;
        g1.gain.value = 0.65;
        osc1.connect(g1);
        g1.connect(out);

        const osc2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 5420;
        g2.gain.value = 0.35;
        osc2.connect(g2);
        g2.connect(out);

        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.value = 5.5;
        lfoGain.gain.value = 0.004;
        lfo.connect(lfoGain);
        lfoGain.connect(out.gain);

        const rush = audioCtx.createBufferSource();
        rush.buffer = getNoiseBuffer();
        rush.loop = true;
        const bp = audioCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 3900;
        bp.Q.value = 4.0;
        const rg = audioCtx.createGain();
        rg.gain.value = 0.18;
        rush.connect(bp);
        bp.connect(rg);
        rg.connect(out);

        osc1.start(now);
        osc2.start(now);
        lfo.start(now);
        rush.start(now, Math.random());

        tinnitus = {
            out,
            lowTime: 0,
            nodes: [osc1, g1, osc2, g2, lfo, lfoGain, rush, bp, rg, out]
        };
    }

    if (tinnitus) {
        tinnitus.lowTime = 0;
        const t = Math.max(0, Math.min(1, (panic - 0.55) / 0.45));
        const targetGain = t * t * 0.036;
        tinnitus.out.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.15);
    }
}

function updateGameAudio(delta) {
    if (audioPaused || !audioCtx || audioCtx.state !== 'running') return;
    updateAudioListener();

    _atmosAccum += Math.min(delta || 0.016, 0.1);
    if (_atmosAccum < 0.1) return;
    const dt = _atmosAccum;
    _atmosAccum = 0;

    const panic = typeof panicLevel === 'number' ? panicLevel : 0;
    updateGameAmbient(dt);
    updateTinnitus(dt, panic);
}

function updateHeartbeat(delta, panic) {
    updateGameAudio(delta);
    if (audioPaused || !gameStarted || (currentStage < HEARTBEAT_START_STAGE && panic < 0.22)) {
        heartbeatTimer = 0;
        return;
    }
    const effectivePanic = Math.max(panic, currentStage >= HEARTBEAT_START_STAGE + 1 ? 0.65 : (currentStage >= HEARTBEAT_START_STAGE ? 0.35 : 0));
    const interval = 1.15 - effectivePanic * 0.65;
    const strength = 0.26 + effectivePanic * 0.38;

    heartbeatTimer += Math.min(delta, 0.1);
    if (heartbeatTimer >= interval) {
        heartbeatTimer = 0;
        playHeartbeat(strength);
    }
}