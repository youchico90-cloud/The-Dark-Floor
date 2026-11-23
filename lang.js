// ================= ТІЛ ЖҮЙЕСІ (i18n): kk / ru / en =================
const I18N_LANGS = { kk: 'Қазақша', ru: 'Русский', en: 'English' };
const I18N_ORDER = ['kk', 'ru', 'en'];
const I18N_STORAGE_KEY = 'gameLang';

const I18N_DICT = {
    kk: {
        'doc.title': 'Anomaly Corridor - Үрей ойыны',
        'menu.progress': 'Ашылған аномалиялар: {count} / {total}',
        'menu.start': 'Бастау',
        'menu.character': 'Кейіпкер',
        'menu.instructions': 'Нұсқаулық',
        'menu.settings': 'Параметрлер',
        'menu.language': 'Тіл',
        'common.back': 'Артқа',
        'char.title': 'КЕЙІПКЕР',
        'char.prev': 'Алдыңғы кейіпкер',
        'char.next': 'Келесі кейіпкер',
        'char.invisible': 'Көрінбейді',
        'char.select': 'Таңдау',
        'char.selected': 'Таңдалды ✓',
        'char.statusSelected': '✓ ҚАЗІРГІ ТАҢДАУ',
        'char.statusNot': 'ТАҢДАЛМАҒАН',
        'char.guard.name': 'Күзетші',
        'char.guard.desc': 'Түнгі кезекшіліктегі күзетші. Қызметтік күртеше, рация және қол шамы бар.',
        'char.default.name': 'Әдепкі',
        'char.default.desc': 'Көрінбейтін стандартты кейіпкер. Тек камера ғана қозғалады.',
        'char.plate': 'КҮЗЕТ ҚЫЗМЕТІ',
        'victory.title': 'ЖЕҢІС',
        'victory.sub': 'Сіз барлық 8 кезеңнен өтіп, дәліздің құпиясын ашып шықтыңыз.',
        'victory.time': 'Уақыт',
        'victory.mistakes': 'Қателер',
        'victory.anomalies': 'Аномалиялар',
        'victory.restart': 'Қайта бастау',
        'victory.menu': 'Мәзір',
        'btn.fullscreen': '⛶ ТОЛЫҚ ЭКРАН',
        'btn.pause': '⏸ ПАУЗА',
        'pause.title': 'ПАУЗА',
        'pause.resume': 'Жалғастыру',
        'settings.title': 'ПАРАМЕТРЛЕР',
        'settings.secLang': 'ТІЛ',
        'settings.language': 'Тіл',
        'settings.secAudio': 'ДЫБЫС ЖӘНЕ БАСҚАРУ',
        'settings.volume': 'Дыбыс деңгейі',
        'settings.sensitivity': 'Қарау сезгіштігі',
        'settings.secGfx': 'ГРАФИКА',
        'settings.quality': 'Сапа',
        'settings.auto': 'Авто',
        'settings.high': 'Жоғары',
        'settings.medium': 'Орташа',
        'settings.low': 'Төмен',
        'settings.nowQuality': 'қазір: {level}',
        'settings.flashShadow': 'Фонарик көлеңкесі',
        'settings.everyFrame': 'Әр кадр',
        'settings.half': 'Жартылай',
        'settings.off': 'Өшірулі',
        'settings.resolution': 'Ажыратымдылық',
        'settings.autoRes': 'Авто-ажыратымдылық',
        'settings.bloom': 'Bloom (жарқырау)',
        'settings.film': 'Film grain',
        'settings.beam': 'Фонарик сәулесі',
        'settings.glow': 'Шам жарқырауы',
        'settings.decor': 'Дақтар мен көлеңке',
        'settings.unavailable': 'бұл сапада жоқ',
        'settings.showFps': 'FPS көрсету',
        'settings.qualityNote': 'Сапа өзгерісі бетті қайта жүктегенде қолданылады (ойын 0-этаптан басталады). URL-дағы ?q= параметрі болса, ол басым.',
        'settings.apply': 'Қолдану (қайта жүктеу)',
        'help.title': 'НҰСҚАУЛЫҚ',
        'help.goal': '<b>Мақсат:</b> дәлізді соңына дейін мұқият тексеріп, аномалияны табу (0-этап — үлгі дәліз).',
        'help.noAnomaly': '<b>Аномалия жоқ</b> болса — алдыңғы есікке қарай жүріңіз.',
        'help.anomaly': '<b>Аномалия бар</b> болса — артқа қайтып, артқы есікке барыңыз.',
        'help.attention': '<b>Назар аударыңыз:</b> экранда өте сирек әрі кенеттен шығатын скримерлер <b>аномалия болып саналмайды</b> — аномалия тек дәліздегі объектілердің өзгерісі.',
        'help.mistake': 'Қателессеңіз — 0-этапқа қайта ораласыз. Жеңу үшін 8 кезеңнен өтіңіз.',
        'help.pc': '<b>Компьютер:</b> W A S D (жүру), Shift (жүгіру), Space (отыру), F (фонарик), Тышқан (қарау).',
        'help.mobile': '<b>Телефон:</b> сол жақ джойстик (жүру), экранды сипау (қарау), оң жақ батырмалар (шам, жүгіру, отыру).',
        'mob.crouch': 'ОТЫРУ',
        'mob.flash': 'ШАМ',
        'mob.sprint': 'ЖҮГІРУ',
        'hud.lockHint': 'Жалғастыру үшін экранды басыңыз',
        'hud.stageHint': '0-ЭТАП: Бұл қалыпты дәліз. Заттардың орнын, түсін және шамдарды есте сақтаңыз.',
        'hud.controls': 'Жүру: WASD | Жүгіру: Shift | Отыру: Space | Фонарик: F',
        'toast.wrongRule': 'АНОМАЛИЯ ЕРЕЖЕСІ БҰЗЫЛДЫ — 0-ЭТАП',
        'toast.abyss': 'ТҮПСІЗ ШЫҢЫРАУҒА ҚҰЛАДЫҢЫЗ — 0-ЭТАП',
        'news.0': 'ХАБАРШЫ',
        'news.1': 'КҮНДЕЛІК',
        'news.2': 'ЖАҢАЛЫҚ',
        'news.3': 'АЙҚАЙ',
        'writing.lookback': 'АРТЫҢА ҚАРАМА',
        'writing.noexit': 'ШЫҒУ ЖОҚ',
        'writing.return': 'ҚАЙТА ОРАЛ',
        'label.extinguisher': 'ӨРТ СӨНДІРГІШ',
        'stage.word': 'ЭТАП',
        'stage.glitch': 'ЭТΛП'
    },
    ru: {
        'doc.title': 'Anomaly Corridor - Хоррор-игра',
        'menu.progress': 'Открыто аномалий: {count} / {total}',
        'menu.start': 'Начать',
        'menu.character': 'Персонаж',
        'menu.instructions': 'Инструкция',
        'menu.settings': 'Настройки',
        'menu.language': 'Язык',
        'common.back': 'Назад',
        'char.title': 'ПЕРСОНАЖ',
        'char.prev': 'Предыдущий персонаж',
        'char.next': 'Следующий персонаж',
        'char.invisible': 'Невидим',
        'char.select': 'Выбрать',
        'char.selected': 'Выбран ✓',
        'char.statusSelected': '✓ ТЕКУЩИЙ ВЫБОР',
        'char.statusNot': 'НЕ ВЫБРАН',
        'char.guard.name': 'Охранник',
        'char.guard.desc': 'Охранник ночной смены. Служебная куртка, рация и ручной фонарь.',
        'char.default.name': 'По умолчанию',
        'char.default.desc': 'Невидимый стандартный персонаж. Двигается только камера.',
        'char.plate': 'СЛУЖБА ОХРАНЫ',
        'victory.title': 'ПОБЕДА',
        'victory.sub': 'Вы прошли все 8 этапов и раскрыли тайну коридора.',
        'victory.time': 'Время',
        'victory.mistakes': 'Ошибки',
        'victory.anomalies': 'Аномалии',
        'victory.restart': 'Заново',
        'victory.menu': 'Меню',
        'btn.fullscreen': '⛶ ПОЛНЫЙ ЭКРАН',
        'btn.pause': '⏸ ПАУЗА',
        'pause.title': 'ПАУЗА',
        'pause.resume': 'Продолжить',
        'settings.title': 'НАСТРОЙКИ',
        'settings.secLang': 'ЯЗЫК',
        'settings.language': 'Язык',
        'settings.secAudio': 'ЗВУК И УПРАВЛЕНИЕ',
        'settings.volume': 'Громкость',
        'settings.sensitivity': 'Чувствительность',
        'settings.secGfx': 'ГРАФИКА',
        'settings.quality': 'Качество',
        'settings.auto': 'Авто',
        'settings.high': 'Высокое',
        'settings.medium': 'Среднее',
        'settings.low': 'Низкое',
        'settings.nowQuality': 'сейчас: {level}',
        'settings.flashShadow': 'Тень фонаря',
        'settings.everyFrame': 'Каждый кадр',
        'settings.half': 'Половина',
        'settings.off': 'Выкл.',
        'settings.resolution': 'Разрешение',
        'settings.autoRes': 'Авто-разрешение',
        'settings.bloom': 'Bloom (свечение)',
        'settings.film': 'Film grain',
        'settings.beam': 'Луч фонаря',
        'settings.glow': 'Свечение ламп',
        'settings.decor': 'Пятна и тени',
        'settings.unavailable': 'недоступно на этом качестве',
        'settings.showFps': 'Показывать FPS',
        'settings.qualityNote': 'Смена качества применится после перезагрузки страницы (игра начнётся с этапа 0). Параметр ?q= в URL имеет приоритет.',
        'settings.apply': 'Применить (перезагрузка)',
        'help.title': 'ИНСТРУКЦИЯ',
        'help.goal': '<b>Цель:</b> внимательно осмотреть коридор до конца и найти аномалию (этап 0 — образец коридора).',
        'help.noAnomaly': 'Если <b>аномалии нет</b> — идите к передней двери.',
        'help.anomaly': 'Если <b>аномалия есть</b> — вернитесь назад и идите к задней двери.',
        'help.attention': '<b>Внимание:</b> очень редкие внезапные скримеры на экране <b>не считаются аномалией</b> — аномалия это только изменение объектов в коридоре.',
        'help.mistake': 'Если ошибётесь — вернётесь на этап 0. Чтобы победить, пройдите 8 этапов.',
        'help.pc': '<b>Компьютер:</b> W A S D (ходьба), Shift (бег), Space (приседание), F (фонарь), Мышь (обзор).',
        'help.mobile': '<b>Телефон:</b> левый джойстик (ходьба), касание экрана (обзор), правые кнопки (фонарь, бег, приседание).',
        'mob.crouch': 'СЕСТЬ',
        'mob.flash': 'ФОНАРЬ',
        'mob.sprint': 'БЕГ',
        'hud.lockHint': 'Нажмите на экран, чтобы продолжить',
        'hud.stageHint': 'ЭТАП 0: Это обычный коридор. Запомните расположение и цвет предметов и лампы.',
        'hud.controls': 'Ходьба: WASD | Бег: Shift | Присесть: Space | Фонарь: F',
        'toast.wrongRule': 'ПРАВИЛО АНОМАЛИЙ НАРУШЕНО — ЭТАП 0',
        'toast.abyss': 'ВЫ УПАЛИ В БЕЗДНУ — ЭТАП 0',
        'news.0': 'ВЕСТНИК',
        'news.1': 'ДНЕВНИК',
        'news.2': 'НОВОСТИ',
        'news.3': 'КРИК',
        'writing.lookback': 'НЕ ОГЛЯДЫВАЙСЯ',
        'writing.noexit': 'ВЫХОДА НЕТ',
        'writing.return': 'ВЕРНИСЬ НАЗАД',
        'label.extinguisher': 'ОГНЕТУШИТЕЛЬ',
        'stage.word': 'ЭТАП',
        'stage.glitch': 'ЭТΛП'
    },
    en: {
        'doc.title': 'Anomaly Corridor - Horror Game',
        'menu.progress': 'Anomalies discovered: {count} / {total}',
        'menu.start': 'Start',
        'menu.character': 'Character',
        'menu.instructions': 'How to play',
        'menu.settings': 'Settings',
        'menu.language': 'Language',
        'common.back': 'Back',
        'char.title': 'CHARACTER',
        'char.prev': 'Previous character',
        'char.next': 'Next character',
        'char.invisible': 'Invisible',
        'char.select': 'Select',
        'char.selected': 'Selected ✓',
        'char.statusSelected': '✓ CURRENTLY SELECTED',
        'char.statusNot': 'NOT SELECTED',
        'char.guard.name': 'Guard',
        'char.guard.desc': 'A night-shift security guard. Wears a uniform jacket and carries a radio and a flashlight.',
        'char.default.name': 'Default',
        'char.default.desc': 'The invisible default character. Only the camera moves.',
        'char.plate': 'SECURITY',
        'victory.title': 'VICTORY',
        'victory.sub': 'You passed all 8 stages and uncovered the secret of the corridor.',
        'victory.time': 'Time',
        'victory.mistakes': 'Mistakes',
        'victory.anomalies': 'Anomalies',
        'victory.restart': 'Play again',
        'victory.menu': 'Menu',
        'btn.fullscreen': '⛶ FULLSCREEN',
        'btn.pause': '⏸ PAUSE',
        'pause.title': 'PAUSED',
        'pause.resume': 'Resume',
        'settings.title': 'SETTINGS',
        'settings.secLang': 'LANGUAGE',
        'settings.language': 'Language',
        'settings.secAudio': 'AUDIO & CONTROLS',
        'settings.volume': 'Volume',
        'settings.sensitivity': 'Look sensitivity',
        'settings.secGfx': 'GRAPHICS',
        'settings.quality': 'Quality',
        'settings.auto': 'Auto',
        'settings.high': 'High',
        'settings.medium': 'Medium',
        'settings.low': 'Low',
        'settings.nowQuality': 'now: {level}',
        'settings.flashShadow': 'Flashlight shadow',
        'settings.everyFrame': 'Every frame',
        'settings.half': 'Half',
        'settings.off': 'Off',
        'settings.resolution': 'Resolution',
        'settings.autoRes': 'Auto resolution',
        'settings.bloom': 'Bloom (glow)',
        'settings.film': 'Film grain',
        'settings.beam': 'Flashlight beam',
        'settings.glow': 'Lamp glow',
        'settings.decor': 'Stains and shadows',
        'settings.unavailable': 'not available at this quality',
        'settings.showFps': 'Show FPS',
        'settings.qualityNote': 'Quality changes apply after the page reloads (the game restarts from stage 0). The ?q= URL parameter takes priority.',
        'settings.apply': 'Apply (reload)',
        'help.title': 'HOW TO PLAY',
        'help.goal': '<b>Goal:</b> carefully inspect the corridor to the end and find the anomaly (stage 0 is the reference corridor).',
        'help.noAnomaly': 'If there is <b>no anomaly</b> — walk to the front door.',
        'help.anomaly': 'If there <b>is an anomaly</b> — go back and head to the rear door.',
        'help.attention': '<b>Note:</b> very rare, sudden screen scares <b>do not count as anomalies</b> — an anomaly is only a change to the objects in the corridor.',
        'help.mistake': 'If you make a mistake, you return to stage 0. Pass 8 stages to win.',
        'help.pc': '<b>PC:</b> W A S D (move), Shift (sprint), Space (crouch), F (flashlight), Mouse (look).',
        'help.mobile': '<b>Phone:</b> left joystick (move), swipe the screen (look), right buttons (light, sprint, crouch).',
        'mob.crouch': 'CROUCH',
        'mob.flash': 'LIGHT',
        'mob.sprint': 'SPRINT',
        'hud.lockHint': 'Click the screen to continue',
        'hud.stageHint': 'STAGE 0: This is a normal corridor. Memorize the position and color of objects and the lamps.',
        'hud.controls': 'Move: WASD | Sprint: Shift | Crouch: Space | Flashlight: F',
        'toast.wrongRule': 'ANOMALY RULE BROKEN — STAGE 0',
        'toast.abyss': 'YOU FELL INTO THE ABYSS — STAGE 0',
        'news.0': 'HERALD',
        'news.1': 'DIARY',
        'news.2': 'NEWS',
        'news.3': 'SCREAM',
        'writing.lookback': 'DON\'T LOOK BACK',
        'writing.noexit': 'NO EXIT',
        'writing.return': 'GO BACK',
        'label.extinguisher': 'EXTINGUISHER',
        'stage.word': 'STAGE',
        'stage.glitch': 'STΛGΣ'
    }
};

let currentLang = (function () {
    let l = null;
    try { l = localStorage.getItem(I18N_STORAGE_KEY); } catch (e) {}
    if (l && I18N_DICT[l]) return l;
    const nav = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
    if (nav.indexOf('kk') === 0) return 'kk';
    if (nav.indexOf('ru') === 0) return 'ru';
    if (nav.indexOf('en') === 0) return 'en';
    return 'kk';
})();

function t(key, params) {
    let s = (I18N_DICT[currentLang] && I18N_DICT[currentLang][key]);
    if (s === undefined) s = I18N_DICT.kk[key];
    if (s === undefined) return key;
    if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
    return s;
}

// Әлемдегі (canvas) жазулар тілді ауыстырғанда қайта салынады
const I18N_TEXTURES = [];
function registerLocalizedTexture(redraw) {
    I18N_TEXTURES.push(redraw);
    return redraw;
}

function applyLanguage() {
    document.documentElement.lang = currentLang;
    document.title = t('doc.title');

    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    document.querySelectorAll('[data-i18n-label]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-label'))); });

    // Мобильді батырмалар: белгішесі (span.ico) сақталады
    [['mob-crouch', 'mob.crouch'], ['mob-flash', 'mob.flash'], ['mob-sprint', 'mob.sprint']].forEach(function (p) {
        const el = document.getElementById(p[0]);
        if (el && el.lastChild && el.lastChild.nodeType === 3) el.lastChild.nodeValue = t(p[1]);
    });

    const sel = document.getElementById('lang-select');
    if (sel) sel.value = currentLang;
    const mb = document.getElementById('lang-btn');
    if (mb) mb.textContent = t('menu.language') + ': ' + I18N_LANGS[currentLang];

    if (typeof updateAnomalyProgressUI === 'function') updateAnomalyProgressUI();
    const cm = document.getElementById('character-modal');
    if (cm && cm.style.display && cm.style.display !== 'none' && typeof renderPreviewCharacter === 'function') {
        try { renderPreviewCharacter(); } catch (e) {}
    }
    if (typeof syncSettingsUI === 'function') { try { syncSettingsUI(); } catch (e) {} }
    I18N_TEXTURES.forEach(function (fn) { try { fn(); } catch (e) {} });
    if (typeof stageSignMesh !== 'undefined' && stageSignMesh && typeof updateStageSign === 'function') {
        try { updateStageSign(!!window._stageSignGlitched); } catch (e) {}
    }
}

function setLanguage(lang) {
    if (!I18N_DICT[lang]) return;
    currentLang = lang;
    try { localStorage.setItem(I18N_STORAGE_KEY, lang); } catch (e) {}
    applyLanguage();
}

function cycleLanguage() {
    const i = I18N_ORDER.indexOf(currentLang);
    setLanguage(I18N_ORDER[(i + 1) % I18N_ORDER.length]);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLanguage);
else applyLanguage();