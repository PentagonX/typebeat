/* -------------------- CONFIGURATION -------------------- */
const FALL_SPEED = 4;        // Pixels per frame
const HIT_TOLERANCE = 80;    // Generous hit window
const MARGIN_X = 50;         // Left/Right margin for spawning
const FONT_SIZE = 60;        // Bigger letters

/* -------------------- STATE -------------------- */
let notes = [];
let particles = [];
let score = 0;
let missed = 0;
let perfectCount = 0;
let goodCount = 0;
let isGameRunning = false;
let hitLineY = 0;
let beatIndex = 0;
let beatTimes = [];
let audio = null;

/* -------------------- ELEMENTS -------------------- */
const canvas = document.getElementById("fallingLetters");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const feedbackEl = document.getElementById("feedback");
const keyEl = document.getElementById("key");

/* -------------------- SETUP -------------------- */
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Line at 75% down the screen
    hitLineY = canvas.height * 0.75;
}
window.addEventListener("resize", resize);
resize();

function initGame() {
    if (!window.GAME_CONFIG) return;

    notes = [];
    particles = [];
    score = 0;
    missed = 0;
    perfectCount = 0;
    goodCount = 0;
    isGameRunning = true;
    beatTimes = window.GAME_CONFIG.beatTimes;
    beatIndex = 0;
    
    if (scoreEl) scoreEl.textContent = "Score: 0";
    if (feedbackEl) feedbackEl.textContent = "";
    if (keyEl) keyEl.textContent = "PRESS START";
    
    audio = document.getElementById("audio-player");
    
    // Start loop immediately to draw background/line
    requestAnimationFrame(gameLoop);

    // Attempt autoplay, fallback to click if blocked
    if (audio) {
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                if (keyEl) keyEl.textContent = "TYPE TO THE BEAT";
            }).catch(error => {
                console.log("Autoplay prevented. Waiting for user interaction.");
                if (keyEl) keyEl.textContent = "CLICK TO START";
                
                // Add one-time click listener to start audio
                window.addEventListener('click', () => {
                    audio.play();
                    if (keyEl) keyEl.textContent = "TYPE TO THE BEAT";
                }, { once: true });
            });
        }

        audio.onended = () => {
            isGameRunning = false;
            showSummary();
        };
    }
}

/* -------------------- GAME LOOP -------------------- */
function gameLoop() {
    // 1. Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Neon Blue Line
    ctx.beginPath();
    ctx.moveTo(0, hitLineY);
    ctx.lineTo(canvas.width, hitLineY);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#00ffff"; // Neon Cyan
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#00ffff";
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset for text

    if (!isGameRunning && !audio) return;

    // 3. Spawn Logic (Sync with Audio)
    if (isGameRunning && audio && !audio.paused) {
        const currentTime = audio.currentTime;
        
        // Calculate how many seconds it takes for a note to fall to the line
        // 60 FPS approx
        const pixelsPerSec = FALL_SPEED * 60; 
        const timeToFall = hitLineY / pixelsPerSec;

        // Look ahead in the beat list
        while (beatIndex < beatTimes.length) {
            const beatTime = beatTimes[beatIndex];
            
            // If the beat is coming up exactly at (currentTime + timeToFall)
            if (beatTime <= currentTime + timeToFall) {
                spawnNotesForBeat();
                beatIndex++;
            } else {
                break; // Next beat is too far in future
            }
        }
    }

    // 4. Update & Draw Notes
    ctx.font = `bold ${FONT_SIZE}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = notes.length - 1; i >= 0; i--) {
        let note = notes[i];
        
        // Move
        note.y += FALL_SPEED;

        // Draw - Change color if in hit zone
        const dist = Math.abs(note.y - hitLineY);
        
        // "Green when about to be pressed"
        if (note.y < hitLineY && dist < HIT_TOLERANCE * 2) {
            ctx.fillStyle = "#00ff88"; 
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#00ff88";
        } else {
            ctx.fillStyle = "#ffffff";
            ctx.shadowBlur = 0;
        }
        
        ctx.fillText(note.char, note.x, note.y);

        // Miss (passed line and went off screen/behind UI)
        if (note.y > canvas.height) {
            notes.splice(i, 1);
            handleMiss();
        }
    }

    // 5. Update & Draw Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.y += p.speed;
        p.alpha -= 0.02;
        
        if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${FONT_SIZE}px monospace`;
        ctx.fillText(p.char, p.x, p.y);
        ctx.restore();
    }

    requestAnimationFrame(gameLoop);
}

function spawnNotesForBeat() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    
    let count = 1;
    const r = Math.random();
    if (r > 0.9) count = 3;
    else if (r > 0.7) count = 2;

    for (let i = 0; i < count; i++) {
        const char = chars.charAt(Math.floor(Math.random() * chars.length));
        const x = MARGIN_X + Math.random() * (canvas.width - MARGIN_X * 2);
        
        notes.push({
            char: char,
            x: x,
            y: -FONT_SIZE
        });
    }
}

/* -------------------- INPUT HANDLING -------------------- */
document.addEventListener("keydown", (e) => {
    if (!isGameRunning) return;
    
    const key = e.key.toUpperCase();
    let bestIndex = -1;
    let lowestY = -Infinity;

    for (let i = 0; i < notes.length; i++) {
        if (notes[i].char === key) {
            if (notes[i].y > lowestY) {
                lowestY = notes[i].y;
                bestIndex = i;
            }
        }
    }

    if (bestIndex !== -1) {
        const note = notes[bestIndex];
        const dist = Math.abs(note.y - hitLineY);
        
        createParticle(note.char, note.x, note.y, "#00ff88");
        notes.splice(bestIndex, 1);
        handleHit(dist);
    }
});

function createParticle(char, x, y, color) {
    particles.push({
        char: char,
        x: x,
        y: y,
        speed: FALL_SPEED * 1.5,
        alpha: 1.0,
        color: color
    });
}

function handleHit(dist) {
    let points = (dist < HIT_TOLERANCE * 0.4) ? 100 : 50;
    let text = (points === 100) ? "PERFECT" : "GOOD";
    
    if (points === 100) perfectCount++;
    else goodCount++;

    score += points;
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    
    if (feedbackEl) {
        feedbackEl.textContent = text;
    feedbackEl.style.color = (points === 100) ? "cyan" : "lime";
        clearTimeout(feedbackEl.timeout);
    feedbackEl.timeout = setTimeout(() => feedbackEl.textContent = "", 500);
    }
}

function handleMiss() {
    missed++;
    score = Math.max(0, score - 20);
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    
    if (feedbackEl) {
        feedbackEl.textContent = "MISS";
        feedbackEl.style.color = "red";
        clearTimeout(feedbackEl.timeout);
        feedbackEl.timeout = setTimeout(() => feedbackEl.textContent = "", 500);
    }
}

function showSummary() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dark overlay
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Box dimensions
    const w = 500;
    const h = 400;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;

    // Draw Box
    ctx.fillStyle = "#111";
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 3;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // Text
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 40px monospace";
    ctx.fillText("SONG COMPLETE", x + w/2, y + 60);
    
    ctx.fillStyle = "#00ff88";
    ctx.font = "30px monospace";
    ctx.fillText(`Score: ${score}`, x + w/2, y + 120);
    
    // Stats
    ctx.font = "24px monospace";
    ctx.fillStyle = "cyan";
    ctx.fillText(`Perfect: ${perfectCount}`, x + w/2, y + 180);
    ctx.fillStyle = "lime";
    ctx.fillText(`Good:    ${goodCount}`, x + w/2, y + 220);
    ctx.fillStyle = "#ff5555";
    ctx.fillText(`Missed:  ${missed}`, x + w/2, y + 260);
    
    // Play Again Button
    ctx.fillStyle = "#ffff00";
    ctx.fillText("CLICK TO PLAY NEW SONG", x + w/2, y + 340);
    
    if (keyEl) keyEl.textContent = "";

    // Click to restart (redirect to solo page to enter new URL)
    canvas.addEventListener('click', () => {
        window.location.href = '/solo';
    }, { once: true });
}

// Initialize if config is present (moved from solo.html)
if (window.GAME_CONFIG) {
    initGame();
}