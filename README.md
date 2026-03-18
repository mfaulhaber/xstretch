# XStretch

XStretch is a local, browser-based PaulXStretch MVP for macOS.

You run it on your own Mac, open it in your browser, upload an audio file, preview renders, and export stretched audio. Nothing here requires cloud hosting.

## Attribution

This project is derived from [PaulXStretch](https://github.com/essej/paulxstretch) by Jesse Chappell, based on earlier PaulStretch and PaulXStretch work by Xenakios and Nasca Octavian Paul.

This repository includes modified PaulXStretch source code and is distributed under the same license terms as upstream PaulXStretch. See [LICENSE](./LICENSE), [NOTICE](./NOTICE), and [vendor/paulxstretch/LICENSE](./vendor/paulxstretch/LICENSE).

## Who This Guide Is For

This README assumes:

- you are on a Mac
- you have never set up developer tools before
- you want copy/paste instructions

## Fastest Option: Let Codex Do The Setup

If you do not want to do the terminal setup yourself, you can let OpenAI Codex walk through most of it for you.

OpenAI's official Codex app pages are here:

- [Get started with Codex](https://openai.com/codex/get-started/)
- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)

High-level flow:

1. Create an OpenAI / ChatGPT account first if you do not already have one.
2. Install the Codex app for macOS from OpenAI's official download page.
3. Drag Codex into your Applications folder.
4. Open Codex and sign in.
5. Point Codex at a folder on your Mac where you want the project to live.
6. Ask Codex to clone this repo, install dependencies, build it, and run it.

### ChatGPT Go Plan Option

As of March 18, 2026, OpenAI says Codex is available to ChatGPT `Free` and `Go` users for a limited time.

If you want a low-cost paid option before trying this setup:

1. Open [ChatGPT](https://chatgpt.com)
2. Sign in or create an account
3. Click your profile icon
4. Click `Upgrade Plan`
5. Select `Try Go`
6. Complete checkout
7. Install and open the Codex app
8. Sign into Codex with the same ChatGPT account

Important:

- ChatGPT Go may be enough for a focused setup session like cloning this repo, installing dependencies, building it, and launching the app.
- OpenAI does not publish a simple guaranteed Codex token/message number for this exact task size.
- Codex usage depends on task size and can vary.

### Plus Fallback If Go Runs Out

If ChatGPT Go hits its included Codex limit during setup, the safest fallback is ChatGPT `Plus`.

Why Plus is the safer fallback:

- Plus includes Codex access
- Plus has higher usage limits than Free or Go
- Codex credits and top-ups currently apply to Plus and Pro, not Go

To switch to Plus:

1. Open [ChatGPT](https://chatgpt.com)
2. Click your profile icon
3. Open `Settings` or `Upgrade Plan`
4. Choose `Plus`
5. Reopen the Codex app and continue the setup task

If you want the highest chance of finishing the setup in one pass on a fresh Mac, start with Plus instead of Go.

If you want Codex to do as much as possible for you, use this prompt in the Codex app:

```text
Please set up XStretch on my Mac for local use. I am not a developer. Clone https://github.com/mfaulhaber/xstretch into this folder first, then read README.md, PLANS.md, and AGENTS.md in the repo and complete the setup. Install whatever you can automatically. If you hit a GUI-only step like installing Xcode from the App Store, stop and tell me exactly what to click, then continue after I confirm. Finish by running the app and telling me what browser URL to open.
```

Notes:

- Codex can usually handle Terminal work for you.
- Codex may still need you to do App Store or macOS permission steps yourself.
- If Xcode is missing, Codex should pause and tell you to install it, then continue after you confirm.
- This repo includes [PLANS.md](./PLANS.md) and [AGENTS.md](./AGENTS.md) to help Codex complete the setup smoothly.
- ChatGPT Go is reasonable to try first, but ChatGPT Plus is the better fallback if you hit usage limits.

## What You Need To Install

This project needs:

- Xcode
- Apple command line tools
- Homebrew
- Git
- Node.js
- pnpm
- CMake

## 1. Open Terminal

1. Press `Command + Space`
2. Type `Terminal`
3. Press `Return`

You will use Terminal for all the steps below.

## 2. Install Xcode

1. Open the App Store
2. Search for `Xcode`
3. Install it
4. Open Xcode once after it finishes installing
5. Accept any license prompts

This is the biggest download and may take a while.

## 3. Install Apple Command Line Tools

In Terminal, run:

```bash
xcode-select --install
```

If macOS says the tools are already installed, that is fine. Continue to the next step.

## 4. Install Homebrew

In Terminal, run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

When Homebrew finishes, follow any instructions it prints. If it tells you to add Homebrew to your shell profile, do that first.

Then close Terminal and open it again before continuing.

## 5. Install Git, Node.js, and CMake

In Terminal, run:

```bash
brew install git node cmake
```

That installs:

- `git` so you can clone the project
- `node` so the web app and API can run
- `cmake` so the native PaulXStretch renderer can compile

## 6. Install pnpm

This project uses `pnpm` for package management.

In Terminal, run:

```bash
corepack enable
corepack prepare pnpm@10.29.3 --activate
```

To confirm it worked, run:

```bash
pnpm --version
```

## 7. Clone This Project From GitHub

In Terminal, run:

```bash
git clone https://github.com/mfaulhaber/xstretch.git
cd xstretch
```

If you are using Codex instead of Terminal, you can skip this manual clone step and let Codex do it for you with the prompt above.

## 8. Install Project Dependencies

Run these commands inside the project folder:

```bash
pnpm install
pnpm run setup
pnpm native:build
```

What each command does:

- `pnpm install` downloads the JavaScript dependencies
- `pnpm run setup` checks your Mac and prepares local runtime folders
- `pnpm native:build` compiles the native PaulXStretch CLI used by the app

The first native build can take a few minutes.

## 9. Start The App

Run:

```bash
pnpm dev
```

Then open this in your browser:

```text
http://localhost:5173
```

While the app is running:

- the web app is available at `http://localhost:5173`
- the local API runs at `http://127.0.0.1:3100`

Leave that Terminal window open while you use the app.

To stop the app, go back to Terminal and press `Control + C`.

## Starting It Again Later

The next time you want to run the project:

```bash
cd ~/xstretch
pnpm dev
```

If you cloned the repo somewhere else, replace `~/xstretch` with that location.

## Typical First Use

1. Start the app with `pnpm dev`
2. Open `http://localhost:5173`
3. Upload an audio file
4. Adjust the stretch controls
5. Click the preview render button
6. Export the final WAV when you are happy with the result

## Troubleshooting

### `xcodebuild` or Xcode problems

If setup says Xcode is missing:

1. Make sure Xcode is installed from the App Store
2. Open Xcode once
3. Run `xcode-select --install` again

### `brew: command not found`

Homebrew is either not installed or not added to your shell yet.

Re-run the Homebrew install step and carefully follow the instructions Homebrew prints at the end.

Then close and reopen Terminal.

### `cmake: command not found`

Run:

```bash
brew install cmake
```

### `pnpm: command not found`

Run:

```bash
corepack enable
corepack prepare pnpm@10.29.3 --activate
```

### Port already in use

If `pnpm dev` says a port is already in use, another copy of the app may still be running. Close the other Terminal window or stop the old process with `Control + C`.

### Codex is waiting for me

If Codex stops and asks you to do something manually, it is usually because the step needs a GUI action, system permission, or App Store interaction.

Common examples:

- installing Xcode from the App Store
- accepting Xcode's license prompts
- approving a macOS permission dialog

Do the requested step, then tell Codex it is complete so it can continue.

## Workspace

- `apps/web`: React + Vite frontend
- `apps/api`: local Node API for uploads, render jobs, and file streaming
- `packages/shared`: shared schemas and types
- `vendor/paulxstretch`: vendored native renderer with an added CLI target

## Tests

Run all automated tests with:

```bash
pnpm test
```

## License

This repository is licensed under the GNU GPL v3 with the same upstream Section 7 additional permission used by PaulXStretch. See [LICENSE](./LICENSE) for the full text.
