from flask import Flask, render_template, request, send_from_directory
import librosa
import yt_dlp
import os
import numpy as np

app = Flask(__name__)
AUDIO_DIR = "audio_cache"
if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

# ---------------- HELPERS ----------------
def download_audio(youtube_url):
    # Use a safe filename based on video ID or just overwrite a temp file for this prototype
    filename = "temp_audio"
    output_path = os.path.join(AUDIO_DIR, filename)
    
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "quiet": True,
        "overwrites": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([youtube_url])

    return filename + ".mp3"

def detect_beats(audio_path):
    y, sr = librosa.load(audio_path, sr=None)
    y_harm, y_perc = librosa.effects.hpss(y)
    onset_env = librosa.onset.onset_strength(y=y_perc, sr=sr)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    return beat_times, int(tempo)

# ---------------- ROUTES ----------------

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/solo", methods=["GET", "POST"])
def solo():
    if request.method == "POST":
        url = request.form.get("url")
        if url:
            filename = download_audio(url)
            full_path = os.path.join(AUDIO_DIR, filename)
            beat_times, tempo = detect_beats(full_path)
            return render_template("solo.html", audio_file=filename, beat_times=beat_times.tolist(), tempo=tempo)
            
    return render_template("solo.html")

@app.route("/settings")
def settings():
    return render_template("settings.html")

@app.route("/audio/<path:filename>")
def serve_audio(filename):
    return send_from_directory(AUDIO_DIR, filename)

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=6767)
