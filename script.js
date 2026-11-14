
'use strict';

const audio = document.getElementById('audio-player');
const trackCards = Array.from(document.querySelectorAll('.track-card'));
const visualizerTitle = document.getElementById('visualizer-title');
const visualizerInfo = document.getElementById('visualizer-info');
const visualizerPlay = document.getElementById('visualizer-play');
const visualizerProgress = document.getElementById('visualizer-progress');
const visualizerProgressActive = document.getElementById('visualizer-progress-active');
const visualizerTime = document.getElementById('visualizer-time');
const visualizerBars = Array.from(document.querySelectorAll('#visualizer-bars span'));
const playbackStatus = document.getElementById('playback-status');
const playerMessage = document.getElementById('player-message');
const statusContainer = document.querySelector('.visualizer-status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let currentCard = null;
let audioContext = null;
let analyser = null;
let source = null;
let frequencyData = null;
let animationFrame = null;
let smoothHeights = new Float32Array(visualizerBars.length).fill(8);
let playRequest = 0;

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function setStatus(kind, message = '') {
    playbackStatus.textContent = ({
        idle: 'READY TO PLAY',
        loading: 'LOADING AUDIO',
        playing: 'NOW PLAYING',
        paused: 'PAUSED',
        error: 'AUDIO ERROR'
    })[kind] || 'READY TO PLAY';

    statusContainer.classList.remove(
        'is-idle',
        'is-loading',
        'is-playing',
        'is-paused',
        'is-error'
    );

    statusContainer.classList.add(`is-${kind}`);
    playerMessage.textContent = message;

    trackCards.forEach(card => {
        card.classList.toggle(
            'loading',
            kind === 'loading' && card === currentCard
        );
    });
}

function updateButtons() {
    const playing = !audio.paused && !audio.ended;

    trackCards.forEach(card => {
        const button = card.querySelector('.play-button');
        const isActive = card === currentCard && playing;

        card.classList.toggle('playing', isActive);
        button.textContent = isActive ? '❚❚' : '▶';

        button.setAttribute(
            'aria-label',
            `${isActive ? 'Pause' : 'Play'} ${card.dataset.title}`
        );

        button.setAttribute('aria-pressed', String(isActive));
    });

    visualizerPlay.textContent = playing ? '❚❚' : '▶';

    visualizerPlay.setAttribute(
        'aria-label',
        playing ? 'Pause current track' : 'Play current track'
    );

    visualizerPlay.setAttribute('aria-pressed', String(playing));
}

function updateTrackDetails(card) {
    visualizerTitle.textContent = card.dataset.title;

    const genre = card.dataset.genre || 'BEAT';

    visualizerInfo.textContent = card.dataset.bpm
        ? `${genre} / ${card.dataset.bpm} BPM`
        : genre;
}

function resetProgress(card) {
    if (!card) return;

    card.querySelector('.progress-active').style.width = '0%';
    card.querySelector('.current-time').textContent = '00:00';
    card.querySelector('.progress').setAttribute('aria-valuenow', '0');
}

function updateProgress() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const elapsed = audio.currentTime || 0;

    const percent = duration > 0
        ? Math.min(100, Math.max(0, elapsed / duration * 100))
        : 0;

    visualizerProgressActive.style.width = `${percent}%`;

    visualizerTime.textContent =
        `${formatTime(elapsed)} / ${formatTime(duration)}`;

    visualizerProgress.setAttribute(
        'aria-valuenow',
        String(Math.round(percent))
    );

    visualizerProgress.setAttribute(
        'aria-valuetext',
        `${formatTime(elapsed)} of ${formatTime(duration)}`
    );

    if (currentCard) {
        currentCard.querySelector('.progress-active').style.width =
            `${percent}%`;

        currentCard.querySelector('.current-time').textContent =
            formatTime(elapsed);

        currentCard.querySelector('.progress').setAttribute(
            'aria-valuenow',
            String(Math.round(percent))
        );

        currentCard.querySelector('.progress').setAttribute(
            'aria-valuetext',
            `${formatTime(elapsed)} of ${formatTime(duration)}`
        );
    }
}

function loadTrack(card) {
    if (!card || currentCard === card) return;

    playRequest++;
    audio.pause();
    resetProgress(currentCard);

    currentCard = card;
    audio.src = card.dataset.src;
    audio.load();

    updateTrackDetails(card);
    updateProgress();
    updateButtons();
    setStatus('loading');
}

async function initializeAudioVisualizer() {
    const Context = window.AudioContext || window.webkitAudioContext;

    if (!Context) return;

    try {
        if (!audioContext) {
            audioContext = new Context();
            analyser = audioContext.createAnalyser();

            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.82;

            source = audioContext.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioContext.destination);

            frequencyData = new Uint8Array(
                analyser.frequencyBinCount
            );
        }

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
    } catch (error) {
        console.warn(
            'BEATLAB: Audio visualizer unavailable:',
            error
        );
    }
}

async function togglePlayback() {
    if (!currentCard) {
        loadTrack(trackCards[0]);
    }

    if (!currentCard) return;

    if (!audio.paused) {
        audio.pause();
        return;
    }

    const requestId = ++playRequest;
    setStatus('loading');

    try {
        await initializeAudioVisualizer();

        if (requestId !== playRequest) return;

        await audio.play();

        if (requestId !== playRequest) {
            audio.pause();
            return;
        }
    } catch (error) {
        if (requestId !== playRequest) return;

        console.error(
            'BEATLAB: Audio playback failed:',
            error
        );

        setStatus(
            'error',
            'Unable to play audio. Check the file and try again.'
        );

        updateButtons();
    }
}

function selectTrack(card) {
    if (card !== currentCard) {
        loadTrack(card);
    }

    return togglePlayback();
}

function seekToPercent(percent) {
    if (
        !currentCard ||
        !Number.isFinite(audio.duration) ||
        audio.duration <= 0
    ) {
        return;
    }

    audio.currentTime =
        Math.max(0, Math.min(1, percent)) * audio.duration;

    updateProgress();
}

function bindSeek(element, card = null) {
    element.addEventListener('click', event => {
        if (card && card !== currentCard) {
            loadTrack(card);
        }

        const rect = element.getBoundingClientRect();

        if (rect.width > 0) {
            seekToPercent(
                (event.clientX - rect.left) / rect.width
            );
        }
    });

    element.addEventListener('keydown', event => {
        if (
            !['ArrowLeft', 'ArrowRight', 'Home', 'End']
                .includes(event.key)
        ) {
            return;
        }

        event.preventDefault();

        if (card && card !== currentCard) {
            loadTrack(card);
        }

        if (
            !Number.isFinite(audio.duration) ||
            audio.duration <= 0
        ) {
            return;
        }

        if (event.key === 'Home') {
            audio.currentTime = 0;
        } else if (event.key === 'End') {
            audio.currentTime = audio.duration;
        } else {
            const offset =
                event.key === 'ArrowRight' ? 5 : -5;

            audio.currentTime = Math.max(
                0,
                Math.min(
                    audio.duration,
                    audio.currentTime + offset
                )
            );
        }

        updateProgress();
    });
}

function resetVisualizer() {
    smoothHeights.fill(8);

    visualizerBars.forEach(bar => {
        bar.style.height = '8px';
        bar.style.boxShadow = '';
    });
}

function stopVisualizer() {
    if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
    }

    animationFrame = null;
    resetVisualizer();
}

function animateVisualizer() {
    animationFrame = null;

    if (
        audio.paused ||
        audio.ended ||
        reducedMotion.matches ||
        !analyser ||
        !frequencyData
    ) {
        resetVisualizer();
        return;
    }

    analyser.getByteFrequencyData(frequencyData);

    const barCount = visualizerBars.length;

    const maxBin = Math.max(
        1,
        Math.floor(frequencyData.length * 0.72)
    );

    const bassBins = frequencyData.subarray(
        1,
        Math.min(12, frequencyData.length)
    );

    const bass = bassBins.length
        ? bassBins.reduce((sum, value) => sum + value, 0)
            / bassBins.length / 255
        : 0;

    visualizerBars.forEach((bar, index) => {
        const ratio = index / Math.max(1, barCount - 1);

        const bin = Math.min(
            maxBin - 1,
            Math.floor(Math.pow(ratio, 1.35) * maxBin)
        );

        const energy = Math.pow(
            frequencyData[bin] / 255,
            1.25
        );

        const boosted = Math.min(
            1,
            energy * 0.85 + bass * 0.25
        );

        const target = 8 + boosted * 235;

        smoothHeights[index] +=
            (target - smoothHeights[index]) *
            (target > smoothHeights[index] ? 0.34 : 0.18);

        bar.style.height =
            `${Math.min(250, smoothHeights[index]).toFixed(1)}px`;

        const glow = 6 + boosted * 24;

        bar.style.boxShadow =
            `0 0 ${glow}px rgba(0,229,255,.48), ` +
            `0 0 ${glow / 2}px rgba(139,92,246,.65)`;
    });

    animationFrame = requestAnimationFrame(
        animateVisualizer
    );
}

function startVisualizer() {
    stopVisualizer();

    if (
        !reducedMotion.matches &&
        analyser &&
        frequencyData &&
        !audio.paused
    ) {
        animationFrame = requestAnimationFrame(
            animateVisualizer
        );
    }
}

trackCards.forEach(card => {
    const button = card.querySelector('.play-button');

    button.addEventListener('click', () => {
        selectTrack(card);
    });

    bindSeek(card.querySelector('.progress'), card);
});

bindSeek(visualizerProgress);

visualizerPlay.addEventListener(
    'click',
    togglePlayback
);

audio.addEventListener('loadstart', () => {
    if (currentCard) {
        setStatus('loading');
    }
});

audio.addEventListener('waiting', () => {
    if (currentCard && !audio.paused) {
        setStatus('loading');
    }
});

audio.addEventListener('loadedmetadata', () => {
    if (currentCard) {
        currentCard.querySelector('.duration').textContent =
            formatTime(audio.duration);
    }

    updateProgress();
});

audio.addEventListener(
    'durationchange',
    updateProgress
);

audio.addEventListener(
    'timeupdate',
    updateProgress
);

audio.addEventListener('playing', () => {
    setStatus('playing');
    updateButtons();
    startVisualizer();
});

audio.addEventListener('pause', () => {
    stopVisualizer();
    updateButtons();

    if (currentCard && !audio.ended && !audio.error) {
        setStatus('paused');
    }
});

audio.addEventListener('ended', () => {
    stopVisualizer();

    audio.currentTime = 0;

    updateProgress();
    updateButtons();
    setStatus('paused');
});

audio.addEventListener('error', () => {
    if (!currentCard) return;

    stopVisualizer();
    updateButtons();

    setStatus(
        'error',
        'Could not load this audio file. Check its path in the audio folder.'
    );

    console.error(
        'BEATLAB: Could not load:',
        audio.src
    );
});

reducedMotion.addEventListener?.('change', () => {
    if (reducedMotion.matches) {
        stopVisualizer();
    } else if (!audio.paused) {
        startVisualizer();
    }
});

document.addEventListener('keydown', event => {
    const target = event.target;

    if (
        target.closest(
            'button, a, input, textarea, select, [role="slider"], [contenteditable="true"]'
        )
    ) {
        return;
    }

    if (event.code === 'Space') {
        event.preventDefault();
        togglePlayback();
    } else if (
        event.key === 'ArrowLeft' &&
        currentCard
    ) {
        event.preventDefault();

        audio.currentTime = Math.max(
            0,
            audio.currentTime - 5
        );
    } else if (
        event.key === 'ArrowRight' &&
        currentCard &&
        Number.isFinite(audio.duration)
    ) {
        event.preventDefault();

        audio.currentTime = Math.min(
            audio.duration,
            audio.currentTime + 5
        );
    }
});

setStatus('idle');
updateButtons();


// Demo producer profiles and detailed profile window
const producerCards = Array.from(document.querySelectorAll('.producer-card'));
const producerTrackCards = Array.from(document.querySelectorAll('.track-card'));
const producerSelectionTitle = document.getElementById('producer-selection-title');
const producerSelectionDescription = document.getElementById('producer-selection-description');
const showAllTracksButton = document.getElementById('show-all-tracks');
const profileModal = document.getElementById('producer-modal');
const profileModalPanel = profileModal?.querySelector('.producer-modal-panel');
const profileModalTracks = document.getElementById('profile-modal-tracks');
const profileModalStats = document.getElementById('profile-modal-stats');
const showProfileTracksButton = document.getElementById('show-profile-tracks');
let activeProfileId = null;
let lastProfileTrigger = null;

const producerProfiles = {
    egor: {
        name: 'EGOR', initials: 'E', role: 'MAIN PRODUCER', avatar: 'avatar-egor',
        genres: 'TRAP · HIP-HOP · EXPERIMENTAL',
        bio: 'A sound built around melodic ideas, heavy drums and experiments with different genres. EGOR brings together atmospheric melodies and energetic rhythm sections to shape a distinctive BEATLAB sound.'
    },
    nightwave: {
        name: 'NIGHTWAVE', initials: 'N', role: 'DEMO PRODUCER', avatar: 'avatar-nightwave',
        genres: 'DARK TRAP · AMBIENT',
        bio: 'Atmospheric textures, spacious melodies and late-night moods. This demo profile explores darker harmonies, spacious arrangements and subtle details in sound design.'
    },
    ghost: {
        name: '808 GHOST', initials: '808', role: 'DEMO PRODUCER', avatar: 'avatar-ghost',
        genres: 'DRILL · TRAP',
        bio: 'Hard-hitting low end, sharp rhythms and dark urban energy. The 808 GHOST selection focuses on punchy drums, deep bass and tense, minimal arrangements.'
    },
    synthx: {
        name: 'SYNTHX', initials: 'SX', role: 'DEMO PRODUCER', avatar: 'avatar-synthx',
        genres: 'ELECTRONIC · EXPERIMENTAL',
        bio: 'Synthetic sound design, unusual textures and futuristic tones. This profile brings together electronic influences and experimental approaches to beatmaking.'
    }
};

function getProfileTracks(producerId) {
    return producerTrackCards.filter(card =>
        (card.dataset.producers || '').split(',').map(item => item.trim()).includes(producerId)
    );
}

function setProducerSelection(producerId) {
    const profile = producerProfiles[producerId];
    if (!profile) return;
    producerCards.forEach(card => {
        const active = card.dataset.producer === producerId;
        card.classList.toggle('is-active', active);
        card.setAttribute('aria-pressed', String(active));
    });
    producerTrackCards.forEach(card => {
        const visible = (card.dataset.producers || '').split(',').map(item => item.trim()).includes(producerId);
        card.classList.toggle('is-filtered-out', !visible);
        card.classList.toggle('is-filtered-in', visible);
    });
    if (producerSelectionTitle) producerSelectionTitle.innerHTML = `${profile.name} <span>— TRACKS</span>`;
    if (producerSelectionDescription) producerSelectionDescription.textContent = 'Showing tracks connected to this demo profile.';
}

function openProducerProfile(producerId, trigger) {
    const profile = producerProfiles[producerId];
    if (!profile || !profileModal) return;
    activeProfileId = producerId;
    lastProfileTrigger = trigger || document.activeElement;
    const tracks = getProfileTracks(producerId);
    const genres = [...new Set(tracks.map(card => card.dataset.genre).filter(Boolean))];

    document.getElementById('profile-modal-role').textContent = profile.role;
    document.getElementById('profile-modal-name').textContent = profile.name;
    document.getElementById('profile-modal-genres').textContent = profile.genres;
    document.getElementById('profile-modal-bio').textContent = profile.bio;
    document.getElementById('profile-modal-initials').textContent = profile.initials;
    const avatar = document.getElementById('profile-modal-avatar');
    avatar.className = `profile-modal-avatar ${profile.avatar}`;

    profileModalStats.innerHTML = '';
    [
        { value: String(tracks.length).padStart(2, '0'), label: 'CONNECTED TRACKS' },
        { value: String(genres.length).padStart(2, '0'), label: 'TRACK STYLES' },
        { value: 'DEMO', label: 'PROFILE TYPE' }
    ].forEach(stat => {
        const item = document.createElement('div');
        item.className = 'profile-stat';
        const value = document.createElement('strong');
        value.textContent = stat.value;
        const label = document.createElement('span');
        label.textContent = stat.label;
        item.append(value, label);
        profileModalStats.append(item);
    });

    profileModalTracks.innerHTML = '';
    tracks.forEach((card, index) => {
        const item = document.createElement('article');
        item.className = 'profile-track-item';
        const image = card.querySelector('.track-cover img');
        if (image) {
            const cover = document.createElement('img');
            cover.src = image.getAttribute('src');
            cover.alt = '';
            cover.loading = 'lazy';
            item.append(cover);
        }
        const details = document.createElement('div');
        details.className = 'profile-track-details';
        const number = document.createElement('span');
        number.textContent = `TRACK ${String(index + 1).padStart(2, '0')}`;
        const title = document.createElement('strong');
        title.textContent = card.dataset.title || 'UNTITLED';
        const genre = document.createElement('span');
        genre.textContent = card.dataset.genre || 'BEAT';
        details.append(number, title, genre);
        const play = document.createElement('button');
        play.type = 'button';
        play.className = 'profile-track-play';
        play.textContent = '▶';
        play.setAttribute('aria-label', `Play ${card.dataset.title || 'track'}`);
        play.addEventListener('click', () => {
            closeProducerProfile();
            card.querySelector('.play-button')?.click();
        });
        item.append(details, play);
        profileModalTracks.append(item);
    });

    document.getElementById('profile-modal-track-count').textContent = `${tracks.length} TRACK${tracks.length === 1 ? '' : 'S'}`;
    profileModal.classList.add('is-open');
    profileModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('profile-modal-open');
    profileModal.querySelector('.producer-modal-close')?.focus();
}

function closeProducerProfile() {
    if (!profileModal) return;
    profileModal.classList.remove('is-open');
    profileModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('profile-modal-open');
    lastProfileTrigger?.focus?.();
}

function showAllProducerTracks() {
    producerTrackCards.forEach(card => card.classList.remove('is-filtered-out', 'is-filtered-in'));
    producerCards.forEach(card => {
        card.classList.remove('is-active');
        card.setAttribute('aria-pressed', 'false');
    });
    if (producerSelectionTitle) producerSelectionTitle.innerHTML = 'ALL <span>TRACKS</span>';
    if (producerSelectionDescription) producerSelectionDescription.textContent = 'Showing the complete BEATLAB music collection.';
}

producerCards.forEach(card => {
    const activate = () => openProducerProfile(card.dataset.producer, card);
    card.addEventListener('click', activate);
    card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate();
        }
    });
});

profileModal?.querySelectorAll('[data-close-profile]').forEach(button =>
    button.addEventListener('click', closeProducerProfile)
);
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && profileModal?.classList.contains('is-open')) closeProducerProfile();
});
showProfileTracksButton?.addEventListener('click', () => {
    if (!activeProfileId) return;
    setProducerSelection(activeProfileId);
    closeProducerProfile();
    document.getElementById('music')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
showAllTracksButton?.addEventListener('click', showAllProducerTracks);
