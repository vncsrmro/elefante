# Elefante on a server

Elefante can run on a server you own, such as a VPS or a machine at home. On a server, routines keep running when your computer sleeps, and you use Elefante from a browser, on any computer or phone. The server runs Elefante's core on plain Node and serves the app's own screens to the browser. Nothing goes through a Elefante service: the server is yours, and so are the data and the logins on it.

Status: **new and experimental.** The core, the screens and the agents work in a browser, tested on Linux (Debian 12, Node 24) and macOS. A real agent turn on a server has only been tested with the test engine so far.

## What you need

| | |
|---|---|
| Linux, x64 or ARM64 | Any VPS with 2 GB of RAM or more |
| [Node.js](https://nodejs.org) 24+ | Elefante's database is Node's built-in SQLite |
| At least one harness, installed and signed in | Signed in **on the server**, as the user that runs Elefante (see below) |
| Optional: Docker Engine | For agents' isolated Linux computers |
| Optional: Chromium or Google Chrome | For agents' browsers (`apt install chromium`) |

## Install

As the user that will run Elefante (not root):

```bash
git clone https://github.com/viniciusromeiro/elefante.git
cd elefante
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci   # the server doesn't need Electron itself
npm run build
npm run server
```

It prints the address to open:

```
Elefante server: http://127.0.0.1:7337/?token=…
```

Open that link once. The token signs the browser in, and a cookie keeps it signed in. The token lives in `~/.elefante-server/server-token`. To sign every browser out, delete that file and restart Elefante.

### Signing the harnesses in

Sign each harness in on the server, in a terminal over SSH:

```bash
curl -fsSL https://claude.ai/install.sh | bash && claude auth login   # prints a link and asks for the code
npm install -g @openai/codex
```

Codex is signed in from Elefante's **Settings › Models**, like on a desktop. On a server, the **Sign in** button can't open a terminal, so it shows the command to run in your SSH session.

## Reaching it

By default the server only listens on the server itself (`127.0.0.1`), because anyone who has the token controls your agents. Pick one of these ways to reach it:

- **SSH tunnel**, the simplest: run `ssh -L 7337:127.0.0.1:7337 you@your-server`, then open the printed link on your computer.
- **Tailscale** (or another private network): set `ELEFANTE_HOST` to the server's Tailscale address, then open `http://<that address>:7337/?token=…` from any of your devices, including your phone.
- **A reverse proxy with HTTPS** (Caddy, nginx) on a domain of yours: keep Elefante on `127.0.0.1` and point the proxy at it. Turn off response buffering for `/events`, which is a live event stream. For example, with Caddy:

  ```
  elefante.example.com {
    reverse_proxy 127.0.0.1:7337 {
      flush_interval -1
    }
  }
  ```

Never expose port 7337 on a public address without HTTPS.

## Keeping it running

Run Elefante as a systemd service, under your own user. Save this as `/etc/systemd/system/elefante.service` and change the user and the path:

```ini
[Unit]
Description=Elefante
After=network-online.target

[Service]
User=you
WorkingDirectory=/home/you/elefante
ExecStart=/usr/bin/npm run server
Restart=on-failure
Environment=ELEFANTE_PORT=7337

[Install]
WantedBy=multi-user.target
```

Then run `sudo systemctl enable --now elefante`. The logs, including the address with the token, are in `journalctl -u elefante`.

To update Elefante, run `git pull && npm ci && npm run build && sudo systemctl restart elefante`.

## Settings

| Variable | Default | |
|---|---|---|
| `ELEFANTE_DATA` | `~/.elefante-server` | Where everything is kept: database, memory, agents' files, the key and the token |
| `ELEFANTE_HOST` | `127.0.0.1` | The address to listen on |
| `ELEFANTE_PORT` | `7337` | |
| `ELEFANTE_TOKEN` | a random token, kept in `server-token` | Set it to use a token of your own |

## How it differs from the desktop app

- **Connectors that sign in with OAuth** (an **Authorize in the browser** button): Elefante opens the authorization page in your browser. When you allow access, the page ends on an address starting with `http://127.0.0.1` that doesn't load, because that address is the server's own. Copy the whole address from the address bar and paste it into Elefante.
- **Secrets** (connector keys, Telegram, GitHub) are encrypted with AES-256-GCM. The key is in `server.key` in the data folder, and only your user can read that file. A desktop app keeps that key in the system's keychain instead. Back the key up together with the data folder: the secrets can't be read without it.
- **Notifications:** connect Telegram (**Settings › Phone and GitHub**) to get approvals, questions and results on your phone. The browser doesn't pop up notifications.
- **Agents' browsers** need Chromium or Chrome on the server, and run without a window. **Take over** doesn't open a window there: the live picture of the browser in the panel becomes the browser. Click on it, type, paste and scroll, then click **Hand back**. This is how you sign in to a site for an agent.
- **Pages agents serve** (a dashboard, an API) listen on the server's own `127.0.0.1`. Agents take their screenshots with the server's Chrome. When Elefante listens on a private address (Tailscale or a home network), it also passes each running page through on the same port at that address, so the preview panel and **Open** work from your computer. That doesn't happen on a public address, because those pages have no token. Over an SSH tunnel, forward the page's port too (`-L 5173:127.0.0.1:5173`).
- **Choosing a folder** asks for its path on the server, since the browser can't browse the server's disk.
- **No self-update.** Update with `git pull` (see above).
- **One Elefante per data folder.** Don't run the desktop app and the server on the same data folder at the same time.
