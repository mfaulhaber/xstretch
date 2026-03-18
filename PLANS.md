# XStretch Setup Plans

This file exists to help Codex set up and run this project for a non-developer on macOS.

## Primary Goal

Get XStretch running locally on a Mac and leave the user with:

- the project cloned locally
- all required dependencies installed
- the native PaulXStretch CLI built
- the local web app running
- a clear browser URL to open

## Success Criteria

Codex should aim to finish with:

- `pnpm install` completed
- `pnpm run setup` completed
- `pnpm native:build` completed
- `pnpm dev` running
- the user told to open `http://localhost:5173`

## Fresh Mac Plan

If the user is starting from a Mac with no developer tools:

1. Check whether Xcode is installed.
2. If Xcode is missing, stop and ask the user to install Xcode from the App Store, open it once, and accept the license prompts.
3. Check whether Apple command line tools are installed.
4. Install Homebrew if it is missing.
5. Install `git`, `node`, and `cmake` with Homebrew if any are missing.
6. Install `pnpm` with:

```bash
corepack enable
corepack prepare pnpm@10.29.3 --activate
```

7. Clone the repo if it is not already present:

```bash
git clone https://github.com/mfaulhaber/xstretch.git
cd xstretch
```

8. Inside the repo, run:

```bash
pnpm install
pnpm run setup
pnpm native:build
pnpm dev
```

9. Tell the user to open `http://localhost:5173`.

## Existing Repo Plan

If the repo is already cloned and opened in Codex:

1. Read `README.md` and `AGENTS.md`.
2. Check for missing tools.
3. Install what can be installed automatically.
4. Pause only for GUI-only steps such as App Store / Xcode actions.
5. Run:

```bash
pnpm install
pnpm run setup
pnpm native:build
pnpm dev
```

6. Confirm the app is running and give the local URL.

## User Prompt Templates

## Prompt: fresh Mac, repo not cloned yet

```text
Please set up XStretch on my Mac for local use. I am not a developer. Clone https://github.com/mfaulhaber/xstretch into this folder first, then read README.md, PLANS.md, and AGENTS.md in the repo and complete the setup. Install whatever you can automatically. If you hit a GUI-only step like installing Xcode from the App Store, stop and tell me exactly what to click, then continue after I confirm. Finish by running the app and telling me what browser URL to open.
```

## Prompt: repo already cloned

```text
Please set up and run this project on my Mac for local use. I am not a developer. Read README.md, PLANS.md, and AGENTS.md first, then complete the setup end to end. Install whatever you can automatically, pause only for GUI-only steps, and finish with the app running locally and the browser URL I should open.
```

## Important Repo Commands

- Use `pnpm run setup`, not `pnpm setup`
- `pnpm install`
- `pnpm native:build`
- `pnpm dev`

## Notes For Codex

- Keep explanations short and plain-language.
- Prefer doing the setup rather than listing instructions.
- If a step requires App Store interaction or a system dialog the agent cannot click through, explain the exact next action and continue after the user confirms.
- Do not stop after dependency installation; continue until the local app is running if possible.
