# Contributing

INKWAVE uses browser-native JavaScript modules, local Three.js files, and static
assets. No package installation or build step is required to play.

## Local development

1. Fork and clone the repository, then create a branch for your change.
2. Run `python3 -m http.server 8088 --bind 127.0.0.1` from the repository root.
   On Windows, use `py -3` instead of `python3`.
3. Open `http://127.0.0.1:8088` in a desktop browser with WebGL2 and import maps.
4. With Node.js 22+, Python 3, and Bash available, run `bash scripts/check.sh`.

Keep changes focused, use the existing code style, and explain the problem,
behavior change, and verification in your pull request. Discuss substantial
architecture or dependency changes in an issue before implementing them.
Do not commit credentials, personal data, generated test output, or local settings.
Include source and license information with any new third-party component.

## Manual smoke checklist

For gameplay, rendering, input, or asset changes:

- Wait for the title screen to finish loading; check the console for errors.
- Enter the menu and start a match. Confirm the arena, actors, and HUD render.
- Move, aim, shoot, swim with Shift, and throw a bomb with E or right-click.
- Open the map with Tab, pause/resume, and confirm the match can reach results.
- Exercise both arena layouts and the relevant quality setting when affected.
- For gamepad changes, test with a real controller and record the mapping.

Report the browser, OS, GPU, quality setting, and any untested flows. Automated
checks cover syntax and local references only; they do not run a browser or
measure frame rate.

## Issues

For bugs, include reproduction steps, expected and actual behavior, browser/OS,
and relevant console output with private information removed. Screenshots help
with rendering issues. Use private reporting for security issues (see SECURITY.md).

By submitting a contribution, you agree to license your original contribution
under the project's MIT license. Third-party work retains its own license.
