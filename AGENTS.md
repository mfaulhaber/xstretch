# AGENTS.md

This repository is frequently used by non-developers who want Codex to perform local setup on macOS.

## Setup Defaults

When the user asks to install, set up, or run this project locally on macOS:

1. Read `README.md` and `PLANS.md` first.
2. Prefer completing the setup instead of only explaining it.
3. Assume the user may have no developer tools installed unless local checks show otherwise.
4. Use plain language and keep user-facing instructions short.

## Setup Workflow

Follow this order:

1. Verify whether Xcode is installed.
2. If Xcode is missing, pause and ask the user to install it from the App Store, open it once, and accept license prompts.
3. Ensure Apple command line tools are installed.
4. Ensure Homebrew is installed.
5. Ensure `git`, `node`, and `cmake` are installed.
6. Ensure `pnpm` is installed with Corepack.
7. Run the project setup commands.
8. Verify the local app starts.

## Required Commands

Use these commands for this repo:

```bash
pnpm install
pnpm run setup
pnpm native:build
pnpm dev
```

Important:

- Do not use `pnpm setup`; that triggers pnpm's built-in command instead of the project script.
- Prefer `brew install git node cmake` for missing toolchain packages.
- Prefer:

```bash
corepack enable
corepack prepare pnpm@10.29.3 --activate
```

for `pnpm`.

## Expected Finish State

The preferred end state is:

- dependencies installed
- native CLI built
- `pnpm dev` running
- user told to open `http://localhost:5173`

## User Experience

- The user may not be comfortable with Terminal output.
- Summarize what happened in everyday language.
- If the user must do something manually, explain the exact click or command needed and why.
- Resume the setup after the user confirms the manual step is complete.
