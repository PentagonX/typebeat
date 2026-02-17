from flask import Flask, request, send_from_directory
import librosa
import yt_dlp
import os

app = Flask(__name__)

REAL_TIME_MODE = True
AUDIO_FILE = "temp_audio"


# ---------------- DOWNLOAD ----------------
def download_audio(youtube_url):
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": AUDIO_FILE,
        "quiet": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([youtube_url])

    return AUDIO_FILE + ".mp3"


# ---------------- BEAT DETECTION ----------------
def detect_beats(audio_path):
    y, sr = librosa.load(audio_path, sr=None)

    # Separate percussion (important)
    y_harm, y_perc = librosa.effects.hpss(y)

    # Onset strength
    onset_env = librosa.onset.onset_strength(y=y_perc, sr=sr)

    # Detect onset frames
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        units="frames",
        backtrack=True   # shifts earlier = more accurate
    )

    beat_times = librosa.frames_to_time(onset_frames, sr=sr)

    tempo = librosa.beat.tempo(onset_envelope=onset_env, sr=sr)[0]

    return beat_times, int(tempo)


# ---------------- SERVE AUDIO ----------------
@app.route("/audio/<filename>")
def serve_audio(filename):
    return send_from_directory(".", filename)


# ---------------- MAIN PAGE ----------------
@app.route("/", methods=["GET", "POST"])
def index():

    html = """
    <h1>Typing Rhythm Game – Beat Prototype</h1>
    <form method="POST">
        <input name="url" placeholder="Paste YouTube URL" size="50" required>
        <button>Analyze</button>
    </form>
    """

    if request.method == "POST":

        url = request.form["url"]

        audio_file = download_audio(url)
        beat_times, tempo = detect_beats(audio_file)

        audio_name = os.path.basename(audio_file)

        html += f"""
        <h2>Begin:</h2>

        <audio id="audio" controls autoplay>
            <source src="/audio/{audio_name}">
        </audio>

        <ul id="beats"></ul>

        <script>
            const beatTimes = {beat_times.tolist()};
            const beatList = document.getElementById('beats');
            const audio = document.getElementById('audio');

            let beatIndex = 0;

            audio.addEventListener('timeupdate', () => {{

                while (
                    beatIndex < beatTimes.length &&
                    audio.currentTime >= beatTimes[beatIndex]
                ) {{

                    const li = document.createElement('li');
                    li.textContent = "BEAT @ " + beatTimes[beatIndex].toFixed(2) + "s";

                    beatList.appendChild(li);
                    beatIndex++;
                }}
            }});
        </script>

        <p>Tempo: {tempo} BPM</p>
        """

    return html


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=6767)
