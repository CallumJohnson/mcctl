<!-- This file is published, as it stands, as the text of the next stable release.
     A pull request that changes something a person would notice adds its line here, under the
     version it will ship in, so that release day is a read-through. Rewrite the top for each
     release; the build procedure at the bottom stays. -->
SpawnLoft 1.4 is a redesigned panel: the console stays on screen while a server's tools open beside it, every server has an overview, settings are one form, and a database can be backed up on its own. An AI assistant can now change your plugins' settings, not only read about them.

- **Windows 10/11 x64:** download `SpawnLoft-Setup-1.4.0.exe`, signed through Microsoft Azure Artifact Signing.
- **Mac with Apple Silicon:** download `SpawnLoft-1.4.0-mac-arm64.dmg`.
- **Mac with Intel:** download `SpawnLoft-1.4.0-mac-x64.dmg`.
- Both Mac builds are Developer ID signed, hardened, Apple-notarized and stapled. The app requires macOS 13 or later; managed MySQL requires macOS 15 or later.
- **Linux, Debian and Ubuntu (22.04+, Debian 12+):** `SpawnLoft-1.4.0-linux-amd64.deb`, or `-linux-arm64.deb` on arm64. Install with `sudo apt install ./<file>`.
- **Linux, Fedora, RHEL-family and openSUSE:** `SpawnLoft-1.4.0-linux-x86_64.rpm`, or `-linux-aarch64.rpm` on arm64. Install with `sudo dnf install ./<file>`.
- Java is separate on every platform, and which one depends on your Minecraft version. On Debian and Ubuntu: `sudo apt install openjdk-25-jre-headless`. On Fedora the newest is `sudo dnf install java-latest-openjdk-headless`.

Existing installs receive 1.4 through the built-in updater. ZIP files are used by the Mac updater; choose the DMG for a manual installation. A Linux install updates through a system password prompt, and takes the package of its own kind.

## New in 1.4

- **AI assistants can change configuration files.** Ask for a plugin setting to be changed and the assistant finds the file, reads it and changes the lines it means to, then reloads the plugin or restarts the server. Each change is snapshotted first, one file at a time, so it can be put back from the Backups tab without touching anything else. It stays inside the server's folder, works only on text configuration (YAML, JSON, properties, TOML and the like), and never sees worlds, logs, `eula.txt` or players' IP addresses. Passwords, tokens and webhook URLs in those files are shown to it as `[redacted]` and cannot be changed through it, and neither can the ports and RCON settings SpawnLoft manages. See [MCP.md](https://github.com/joogiebear/spawnloft/blob/main/MCP.md).
- **A redesigned panel.** Solid surfaces with quieter shadows, sharper type with the display cut of Segoe UI for headings, a dense backups table with column headings, compact metric widgets in place of the large Performance charts, and a smooth hover on every button, row and section. Both themes have new colours; Classic's faintest text is brighter so small labels are easier to read, and SpawnLoft keeps its tighter corners to match the website.
- **The console stays on screen.** Servers are tabs across the top instead of a list down the side, and a server's tools open from a dock on the right, beside its console rather than in place of it; Settings and Backups open full width, with the console's newest line and its error count along the bottom. Under the server's name are the numbers worth a glance - players online, TPS with its recent trend, memory, and how long ago the last backup was - read over one connection the server keeps open, so the console is not filled with RCON connection lines. The console's toolbar counts its warnings and errors, and a missing or outdated Java is a small chip in the header instead of a banner across the window. Plugins lists everything in the folder, including the jars you added by hand, and when a check finds updates it can install them all behind one snapshot and restart. SpawnLoft's own settings, and Feedback, are under the gear, in Preferences.
- **An overview of every server.** The first tab shows them all: each one's state, players, TPS, memory and last backup, with Start or Stop on its card, and how much of the machine's memory they are allowed between them. Above the cards, "Needs attention" collects what wants doing - a server that crashed or was restarted by crash guard today, plugin updates the last check found, a server never backed up or not backed up in a week, a Java too old to start a server - each with the one button that deals with it, such as turning on nightly backups.
- **Database backups of their own.** A MySQL database has its own Backups tool, kept apart from the servers' snapshots: Back up now writes a plain SQL dump of the databases your servers use in it, and each one in the list can be downloaded to keep somewhere else, put back, or deleted. Putting one back first saves a dump of how things are, so a restore can itself be undone. Redis keeps its own checkpoints and has nothing to dump, and says so.
- **Server settings as one form.** Its sections are listed down the side, with a dot on any holding an unsaved change; each setting is marked Default while it is still Minecraft's own and Changed until it is saved, with longer explanations behind a More. One bar at the bottom says how many changes are waiting and saves them, discards them, or saves and restarts the server. Memory is set here now, beside Java. And server.properties can be edited as a whole file for everything the form does not cover: the RCON password stays hidden, the ports and RCON SpawnLoft manages cannot be changed there, and the file is snapshotted on its own first, so the Backups tab can put it back.
- **Update checks for Purpur, Folia and Advanced Slime Paper**, as Paper already had. Settings, under Server software, says which build a server runs and offers the newest one, or a newer Minecraft version; so do `spawnloft upgrade` and the AI assistant tools. Advanced Slime Paper builds have no number, so they are compared by date.

## Fixed

- Upgrading a server to a newer Minecraft version left it recorded as the old one, so it kept being offered plugin builds for that version and was started on the Java that version needs rather than the new one's. It now records the version it moved to.
- Creating a MySQL database could leave the panel unresponsive for several seconds at the end, while it set up the server's database and user; on a slow or freshly installed machine its own requests timed out. That step no longer holds the panel up.

SpawnLoft does not insert database credentials into plugin configuration files.


## Release build procedure

Maintainers build every platform from the same clean `main` commit. On the Windows Azure signing machine, on `main`, run `npm run release:stable` in `desktop`. It dispatches `desktop-stable`, which builds, signs, notarizes and exercises both native Mac apps, including an installed beta-to-stable upgrade, and builds both Linux architectures, installs the `.deb` with apt on Ubuntu 24.04 and the `.rpm` with dnf on Fedora, and exercises the installed app. Meanwhile it builds and signs the Windows installer, verifies it, runs the packaged-app smoke test and records its manifest; then it collects every platform's files in `desktop/dist/stable-release` and verifies them together.

`npm run release:stable -- --publish` then publishes. Publication checks all package bytes, Windows Authenticode, matching clean source commits, the successful native workflow, and the uploaded GitHub digests before exposing the complete release. Both beta and stable feeds are included so existing installations can move to stable.
