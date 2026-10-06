const audio =
    document.getElementById("audio-player");

const trackCards =
    document.querySelectorAll(".track-card");

const visualizerTitle =
    document.getElementById("visualizer-title");

const visualizerInfo =
    document.getElementById("visualizer-info");

const visualizerPlay =
    document.getElementById("visualizer-play");

const visualizerProgress =
    document.getElementById("visualizer-progress");

const visualizerProgressActive =
    document.getElementById(
        "visualizer-progress-active"
    );

const visualizerTime =
    document.getElementById("visualizer-time");

const visualizerBars =
    document.querySelectorAll(
        "#visualizer-bars span"
    );


let currentCard = null;

let audioContext = null;
let analyser = null;
let source = null;
let frequencyData = null;

let visualizerStarted = false;



function formatTime(seconds) {

    if (!Number.isFinite(seconds)) {
        return "00:00";
    }

    const minutes =
        Math.floor(seconds / 60);

    const secs =
        Math.floor(seconds % 60);

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(secs).padStart(2, "0")
    );
}


function initializeAudioVisualizer() {

    if (audioContext) {

        if (
            audioContext.state ===
            "suspended"
        ) {

            audioContext.resume();
        }

        return;
    }


    const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;


    if (!AudioContext) {

        console.warn(
            "Web Audio API is not supported."
        );

        return;
    }


    audioContext =
        new AudioContext();


    analyser =
        audioContext.createAnalyser();


    analyser.fftSize = 256;


    analyser.smoothingTimeConstant =
        0.72;


    source =
        audioContext
            .createMediaElementSource(
                audio
            );


    source.connect(analyser);

    analyser.connect(
        audioContext.destination
    );


    frequencyData =
        new Uint8Array(
            analyser.frequencyBinCount
        );


    if (!visualizerStarted) {

        visualizerStarted = true;

        animateVisualizer();
    }
}



function animateVisualizer() {

    requestAnimationFrame(
        animateVisualizer
    );


    if (
        !analyser ||
        !frequencyData
    ) {

        return;
    }


    analyser.getByteFrequencyData(
        frequencyData
    );


    const barCount =
        visualizerBars.length;


    const usefulBins =
        Math.floor(
            frequencyData.length * 0.72
        );


    visualizerBars.forEach(
        (bar, index) => {


            const ratio =
                index /
                Math.max(
                    barCount - 1,
                    1
                );


            const curvedRatio =
                Math.pow(
                    ratio,
                    1.35
                );


            const dataIndex =
                Math.min(
                    Math.floor(
                        curvedRatio *
                        usefulBins
                    ),
                    usefulBins - 1
                );


            const value =
                frequencyData[dataIndex];


            let normalized =
                value / 255;


            normalized =
                Math.pow(
                    normalized,
                    1.30
                );



            let height =
                8 +
                normalized * 237;


            height =
                Math.min(
                    height,
                    250
                );


            bar.style.height =
                `${height}px`;



            const glow =
                6 +
                normalized * 20;


            bar.style.boxShadow =
                `
                0 0 ${glow}px
                rgba(0, 229, 255, 0.45),

                0 0 ${glow / 2}px
                rgba(139, 92, 246, 0.65)
                `;

        }
    );
}



function resetVisualizer() {

    visualizerBars.forEach(
        bar => {

            bar.style.height =
                "8px";

            bar.style.boxShadow =
                "";

        }
    );
}


function resetButtons() {

    trackCards.forEach(
        card => {

            const button =
                card.querySelector(
                    ".play-button"
                );


            button.textContent =
                "▶";


            card.classList.remove(
                "playing"
            );

        }
    );
}


function resetTrackProgress(card) {

    if (!card) {
        return;
    }


    const activeProgress =
        card.querySelector(
            ".progress-active"
        );


    const currentTime =
        card.querySelector(
            ".current-time"
        );


    activeProgress.style.width =
        "0%";


    currentTime.textContent =
        "00:00";
}


function updateVisualizerInfo(card) {

    const title =
        card.dataset.title;

    const genre =
        card.dataset.genre;

    const bpm =
        card.dataset.bpm;


    visualizerTitle.textContent =
        title;


    if (bpm) {

        visualizerInfo.textContent =
            `${genre} / ${bpm} BPM`;

    }

    else {

        visualizerInfo.textContent =
            genre;

    }
}



function loadTrack(card) {

    if (currentCard === card) {
        return;
    }


    if (currentCard) {

        resetTrackProgress(
            currentCard
        );

    }


    audio.pause();


    resetButtons();


    currentCard =
        card;


    audio.src =
        card.dataset.src;


    audio.load();


    updateVisualizerInfo(
        card
    );


    visualizerProgressActive
        .style.width =
        "0%";


    visualizerTime.textContent =
        "00:00 / 00:00";
}


async function selectTrack(card) {

    initializeAudioVisualizer();


    if (currentCard !== card) {

        loadTrack(card);

    }


    await togglePlayback();
}



async function togglePlayback() {

    if (!currentCard) {
        return;
    }


    initializeAudioVisualizer();


    if (
        audioContext &&
        audioContext.state ===
        "suspended"
    ) {

        await audioContext.resume();
    }


    if (audio.paused) {

        try {

            await audio.play();

        }

        catch (error) {

            console.error(
                "Audio playback error:",
                error
            );

        }

    }

    else {

        audio.pause();

    }
}


trackCards.forEach(
    card => {

        const button =
            card.querySelector(
                ".play-button"
            );


        button.addEventListener(
            "click",
            () => {

                selectTrack(card);

            }
        );

    }
);



visualizerPlay.addEventListener(
    "click",
    async () => {

        initializeAudioVisualizer();



        if (!currentCard) {

            loadTrack(
                trackCards[0]
            );

        }


        await togglePlayback();

    }
);



audio.addEventListener(
    "loadedmetadata",
    () => {

        if (!currentCard) {
            return;
        }


        const duration =
            currentCard.querySelector(
                ".duration"
            );


        duration.textContent =
            formatTime(
                audio.duration
            );


        visualizerTime.textContent =
            `00:00 / ${formatTime(
                audio.duration
            )}`;

    }
);



audio.addEventListener(
    "timeupdate",
    () => {

        if (!currentCard) {
            return;
        }


        const currentTimeElement =
            currentCard.querySelector(
                ".current-time"
            );


        currentTimeElement.textContent =
            formatTime(
                audio.currentTime
            );


        const percent =
            audio.duration
                ?
                (
                    audio.currentTime /
                    audio.duration
                ) * 100
                :
                0;


        const activeProgress =
            currentCard.querySelector(
                ".progress-active"
            );


        activeProgress.style.width =
            `${percent}%`;


        visualizerProgressActive
            .style.width =
            `${percent}%`;


        visualizerTime.textContent =
            `${formatTime(
                audio.currentTime
            )} / ${formatTime(
                audio.duration
            )}`;

    }
);



trackCards.forEach(
    card => {

        const progress =
            card.querySelector(
                ".progress"
            );


        progress.addEventListener(
            "click",
            event => {

                initializeAudioVisualizer();


                if (
                    currentCard !==
                    card
                ) {

                    loadTrack(card);

                }


                const rect =
                    progress
                        .getBoundingClientRect();


                const clickPosition =
                    event.clientX -
                    rect.left;


                let percent =
                    clickPosition /
                    rect.width;


                percent =
                    Math.max(
                        0,
                        Math.min(
                            percent,
                            1
                        )
                    );


                if (
                    Number.isFinite(
                        audio.duration
                    )
                ) {

                    audio.currentTime =
                        percent *
                        audio.duration;

                }

            }
        );

    }
);



visualizerProgress.addEventListener(
    "click",
    event => {

        if (!currentCard) {
            return;
        }


        const rect =
            visualizerProgress
                .getBoundingClientRect();


        let percent =
            (
                event.clientX -
                rect.left
            ) /
            rect.width;


        percent =
            Math.max(
                0,
                Math.min(
                    percent,
                    1
                )
            );


        if (
            Number.isFinite(
                audio.duration
            )
        ) {

            audio.currentTime =
                percent *
                audio.duration;

        }

    }
);


audio.addEventListener(
    "play",
    () => {

        if (!currentCard) {
            return;
        }


        resetButtons();


        const button =
            currentCard.querySelector(
                ".play-button"
            );


        button.textContent =
            "❚❚";


        visualizerPlay.textContent =
            "❚❚";


        currentCard.classList.add(
            "playing"
        );

    }
);



audio.addEventListener(
    "pause",
    () => {

        if (!currentCard) {
            return;
        }


        const button =
            currentCard.querySelector(
                ".play-button"
            );


        button.textContent =
            "▶";


        visualizerPlay.textContent =
            "▶";


        currentCard.classList.remove(
            "playing"
        );

    }
);



audio.addEventListener(
    "ended",
    () => {

        resetButtons();


        visualizerPlay.textContent =
            "▶";


        visualizerProgressActive
            .style.width =
            "0%";


        resetTrackProgress(
            currentCard
        );


        resetVisualizer();


        audio.currentTime = 0;

    }
);


audio.addEventListener(
    "error",
    () => {

        console.error(
            "BEATLAB: Could not load:",
            audio.src
        );


        visualizerTitle.textContent =
            "AUDIO ERROR";


        visualizerInfo.textContent =
            "CHECK AUDIO FILE PATH";


        resetButtons();

        resetVisualizer();

    }
);