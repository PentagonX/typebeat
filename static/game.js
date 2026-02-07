let KEYS = ["a","s","d","f","g","h","j","k","l",";"];
const BEAT_INTERVAL = 600;
const TOTAL_BEATS = 20;
const MISS_WINDOW = 1000; 
const MAX_POINTS = 100;

let sequence = [];
let currentIndex = 0;
let score = 0;
let hits = 0;
let gameActive = false;
let expectedTime = 0;
let currentKey = null;
let feedbackTimeout = null;
let gameStartTime = 0;

const keyDiv = document.getElementById("key");
const feedbackDiv = document.getElementById("feedback");
const scoreDiv = document.getElementById("score");
const sequenceDiv = document.getElementById("sequence");

function mulberry32(a) {
    return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function hashStringToNumber(str) {
    let hash = 0;
    for (let i=0; i<str.length; i++){
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function generateSequence(seed, length){
    const rand = mulberry32(seed);
    let seq = [];
    for (let i=0;i<length;i++){
        seq.push(KEYS[Math.floor(rand()*KEYS.length)]);
    }
    return seq;
}

function initGame({seedInput="", deterministic=false}={}){
    let seed = deterministic ? (isNaN(seedInput) || seedInput === "" ? hashStringToNumber(seedInput) : parseInt(seedInput)) : Math.floor(Math.random()*100000);
    sequence = generateSequence(seed, TOTAL_BEATS);
    renderSequence();
    keyDiv.textContent = "PRESS ENTER";

    document.addEventListener("keydown", startHandler);
}

function renderSequence(){
    sequenceDiv.innerHTML = "";
    for (let i=0;i<sequence.length;i++){
        const span = document.createElement("span");
        span.textContent = sequence[i].toUpperCase();
        sequenceDiv.appendChild(span);
    }
}

function startHandler(e){
    if (!gameActive && e.key==="Enter"){
        document.removeEventListener("keydown", startHandler);
        startGame();
    }
}

function startGame(){
    score = 0;
    scoreDiv.style.display = "block";
    feedbackDiv.style.display = "block";
    hits = 0;
    currentIndex = 0;
    gameActive = true;
    scoreDiv.textContent = "Score: 0";
    feedbackDiv.textContent = "";
    gameStartTime = performance.now();
    nextKey();
}

function nextKey(){
    if(currentIndex>=sequence.length){
        endGame();
        return;
    }
    currentKey = sequence[currentIndex];
    expectedTime = performance.now();
    highlightSequence();
    keyDiv.textContent = currentKey.toUpperCase();
}

function highlightSequence(){
    const spans = sequenceDiv.querySelectorAll("span");
    spans.forEach((s,i)=>s.style.color=i<currentIndex?"green":"white");
}

function showFeedback(text){
    feedbackDiv.textContent=text;
    if (text==="MISS") {
        feedbackDiv.style.color = "red";
    } else if (text === "PERFECT") {
        feedbackDiv.style.color = "gold";
    } else if (text === "GOOD") {
        feedbackDiv.style.color = "lightgreen";
    } else {
        feedbackDiv.style.color = "white";
    }
    if(feedbackTimeout) clearTimeout(feedbackTimeout);
    feedbackTimeout=setTimeout(()=>{feedbackDiv.textContent="";},1000);
}

document.addEventListener("keydown", (e)=>{
    if(!gameActive || !currentKey) return;
    const now = performance.now();
    const delta = now - expectedTime;
    const absDelta = Math.abs(delta);
    if(e.key!==currentKey || absDelta>MISS_WINDOW){
        showFeedback("MISS");
    } else {
        const timingScore = Math.max(0,1-absDelta/MISS_WINDOW);
        const points = Math.floor(timingScore*MAX_POINTS);
        score+=points;
        hits++;
        showFeedback(timingScore>0.85?"PERFECT":timingScore>0.6?"GOOD":"OK");
        scoreDiv.textContent=`Score: ${score}`;
    }
    currentIndex++;
    nextKey();
});

function endGame() {
    gameActive = false;
    currentKey = null;

    const totalTime = (performance.now() - gameStartTime) / 1000;
    const accuracy = (hits / TOTAL_BEATS) * 100;
    const wpm = (hits / totalTime) * 60;
    scoreDiv.style.display = "none";
    feedbackDiv.style.display = "none";
    keyDiv.innerHTML = `<div style="font-size: 48px;">RESULTS</div>
    <div style="font-size: 36px; margin-top: 10px;">
        Score: ${score}<br>
        Hits: ${hits} / ${TOTAL_BEATS}<br>
        Accuracy: ${accuracy.toFixed(1)}%<br>
        WPM: ${wpm.toFixed(1)}
    </div>
    <div style="margin-top: 12px; font-size: 36px; font-weight: bold; color: cyan;">
    Press Enter to play again
    </div>`;

    document.addEventListener("keydown", function restart(e){
        if(e.key === "Enter"){
            document.removeEventListener("keydown", restart);
            initGame({seedInput: prompt("Enter seed (number or leave blank for random):"), deterministic: true });
        }
    });
}