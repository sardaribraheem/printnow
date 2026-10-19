# Test PrintNow on your laptop

For the native Android app, use [mobile/README.md](mobile/README.md). The instructions below run the browser/admin application and its local database/worker.

The local sandbox runs the app, a background file worker and a PostgreSQL database. It creates sample customer, printer and admin accounts automatically. You do not need Supabase keys for this mode.

## Install prerequisites

- Install **Node.js 24** from [nodejs.org](https://nodejs.org/). Check `node --version` starts with `v24.`.
- Install and start **Docker Desktop** on macOS/Windows, or Docker Engine on Linux. Check `docker info` succeeds.
- Install **Poppler** for PDF previews:
  - macOS with Homebrew: `brew install poppler`
  - Ubuntu/Linux or Windows with Ubuntu in WSL: `sudo apt update && sudo apt install -y poppler-utils`

On Windows, run the commands below in **Ubuntu in WSL2**. Enable Docker Desktop's integration with that Ubuntu distribution, install Node.js inside WSL, and extract the source under your Linux home folder, such as `~/projects/printnow`. Use your normal Windows browser to open the app.

## Set up

Clone the app from GitHub and install its dependencies:

```bash
git clone https://github.com/sardaribraheem/printnow.git
cd printnow
npm ci
npm run sandbox
```

If you already cloned the repository, run `git pull --ff-only` inside your existing `printnow` folder, then run `npm ci` and `npm run sandbox`. You can also extract the source ZIP and run those two commands in the extracted folder.

The sandbox downloads PostgreSQL on its first run, applies the app schema and writes local settings to `.env.local`. Keep Docker running. You do not need to copy `.env.example` or configure hosted Supabase.

## Start the app

Keep this running in the first terminal:

```bash
npm run worker
```

Open a second terminal in the same `printnow` folder and run:

```bash
npm run dev -- --port 3001
```

Open `http://localhost:3001` in your browser. The initial page may take a moment while Next.js compiles it.

Use the sample-account selector at the top to try the workflow: choose the customer, upload a PDF/PNG/JPEG and post a request; switch to a printer and send an offer; switch back to the customer and accept it. You can then try chat and order progress with both accounts. The admin account exposes the local review tools.

This mode is for testing with synthetic files and data. Real email sign-in, Google OAuth and the hosted Supabase integration need the separate hosted configuration described in [DEPLOYMENT.md](DEPLOYMENT.md).

## Stop and restart

Press `Ctrl+C` in both terminals to stop the worker and app. Optionally stop the database:

```bash
docker stop printnow-development-db
```

For your next session, run `npm run sandbox` again, then start the worker and app as above. Local requests, accounts and uploaded files persist.

## Common setup issues

- **Cannot connect to Docker:** start Docker Desktop, or check WSL integration on Windows.
- **`pdftoppm` not found / previews fail:** install Poppler and check `pdftoppm -v` in the same terminal used for the worker.
- **Uploads stay processing:** keep `npm run worker` running and check its terminal for errors.
- **Port 3001 is busy:** use `npm run dev -- --port 3002`, then open `http://localhost:3002`.
- **Port 55432 is busy:** stop the other service using that port before starting the sandbox; it is the local PostgreSQL port.
- **Sample accounts are missing:** run `npm run sandbox` before starting `npm run dev`. Sample accounts require development mode; use `npm run dev` for this workflow.
