# Cloudkeep — 4K60 gameplay retake

44 seconds, 60 fps, 2,640 independently rendered frames.

Download the videos from the [v1.0.0 release](https://github.com/0xmariowu/cloudkeep/releases/tag/v1.0.0).
Video binaries are distributed as release assets rather than tracked in Git.

- `Cloudkeep-4K60-Gameplay.mp4`: native 3840 x 2160, H.264 High Level 5.2, 166 MB.
- `Cloudkeep-1080p60-Share.mp4`: 1920 x 1080 at 60 fps, 32 MB.
- `Cloudkeep-4K60-Cover.jpg`: a frame from the finished 4K video.

## Sequence

- 0–13 seconds: boosted flight between islands, climbing, turning and passing sky creatures.
- 13–31 seconds: three consecutive captures, ten total collection events across the video,
  and three seed releases. Capture progress and active inputs remain visible.
- 31–44 seconds: a lower approach between gardens followed by a climb, turns and exploration.

All three shots use the game's existing simulation, AI, flight camera, models and effects.
A temporary director controls simulation inputs; positions are reset only at the two shot cuts.
Frames were rendered at fixed 1/60-second simulation steps and encoded with exact timestamps.
This is an offline game-engine capture, not a benchmark of real-time gameplay performance.
The native sound engine was rendered against the same simulation and event timeline.
The final audio is stereo AAC, 48 kHz, -18.1 LUFS integrated, with a -6.2 dBFS true peak.

Both files have exactly 2,640 frames and matching 44-second video/audio tracks. Both passed
complete FFmpeg decoding. The first 42 seconds of each output contain 2,520 distinct decoded
frames with zero consecutive duplicates. The final fade is excluded from that duplicate check.
Opening, boost, capture, coin collection and exploration frames were visually checked.
See `Verification-4K60.json` for machine-readable results.

The player's save and game source were preserved. The earlier 30 fps export is also retained.
