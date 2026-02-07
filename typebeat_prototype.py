import time
import random
import readchar

# -----------------------------
# CONFIG
# -----------------------------
KEYS = ["a", "s", "d", "f"]
BEAT_INTERVAL = 0.6
TOTAL_BEATS = 20
MAX_POINTS = 100
MISS_WINDOW = 1.0  # seconds

# -----------------------------
# STATE
# -----------------------------
score = 0
hits = 0

print("=== TYPEBEAT (TERMINAL PROTOTYPE) ===")
print("Press the key ON THE BEAT")
print("Get ready...")
time.sleep(2)

start_time = time.time()

for beat in range(1, TOTAL_BEATS + 1):
    expected_time = start_time + beat * BEAT_INTERVAL
    key = random.choice(KEYS)

    # Wait until beat time
    while time.time() < expected_time:
        pass

    print(f"\nBeat {beat}/{TOTAL_BEATS}")
    print(f"TYPE:  {key.upper()}")

    # Read single keypress (no Enter)
    press = readchar.readkey()
    press_time = time.time()

    delta = press_time - expected_time
    abs_delta = abs(delta)

    if press != key or abs_delta > MISS_WINDOW:
        print("MISS")
        points = 0
    else:
        timing_score = max(0.0, 1.0 - (abs_delta / MISS_WINDOW))
        points = int(timing_score * MAX_POINTS)
        hits += 1

        if timing_score > 0.85:
            print("PERFECT")
        elif timing_score > 0.6:
            print("GOOD")
        else:
            print("OK")

    score += points
    print(f"Δt: {delta:+.3f}s | +{points} pts")

# -----------------------------
# RESULTS
# -----------------------------
total_time = time.time() - start_time
wpm = (hits / total_time) * 60

print("\n=== RESULTS ===")
print(f"Score: {score}")
print(f"Hits: {hits}/{TOTAL_BEATS}")
print(f"WPM: {wpm:.1f}")
