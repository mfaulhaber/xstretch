# XStretch

Local browser-based MVP for PaulXStretch on macOS.

## Prerequisites

- Xcode
- Homebrew
- Node.js and pnpm
- CMake

If CMake is missing, run:

```bash
brew install cmake
```

## Getting Started

```bash
pnpm install
pnpm run setup
pnpm native:build
pnpm dev
```

This starts:

- API server on `http://localhost:3100`
- Web app on `http://localhost:5173`

## Workspace

- `apps/web`: React + Vite frontend
- `apps/api`: local Node API for uploads, render jobs, and file streaming
- `packages/shared`: shared schemas and types
- `vendor/paulxstretch`: vendored native renderer with an added CLI target

## Tests

```bash
pnpm test
```
