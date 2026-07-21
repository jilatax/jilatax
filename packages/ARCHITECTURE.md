# 🏗️ Architecture

## 📁 Project Structure

```
jilatax/
├── apps/                                # Deployable web applications
│   ├── website/                         # Marketing site → jilatax.dev
│   └── docs/                            # Documentation site → doc.jilatax.dev
│
├── packages/                            # Publishable npm packages
│   ├── jilatax/                         # Public framework API
│   ├── @cli/                            # CLI implementation
│   ├── @svg/                            # SVG compiler and ReactLynx icons
│   └── create-jilatax/                  # Project scaffolder
│
├── plan/                                # Internal planning (gitignored)
│
└── .github/workflows/                   # CI/CD pipelines
```

## 🧭 Ownership

```
Application code
       │
       ▼
   Jilatax                 ── workflow, config, native hosts, builds
       │
       ▼
   Lynx / Rspeedy         ── engine, compilation, dev server
       │
       ▼
   Android                  ── only supported native platform in this phase
```

## 📦 Packages

| Package | npm | Role |
|---------|-----|------|
| `jilatax` | `jilatax` | Public API, app configuration, Android host |
| `@cli` | `@jilatax/cli` | Command parsing, user output |
| `@svg` | `@jilatax/svg` | SVG validation, Rspeedy compilation, ReactLynx icon components |
| `create-jilatax` | `create-jilatax` | Scaffolding, templates |

### Internal boundaries

These remain modules inside the four public packages; they are not additional npm packages.

| Boundary | Owner | Role |
|----------|-------|------|
| Config and schema | `jilatax` | Load, validate, and normalize `app.json` |
| Android host | `jilatax` | Native runtime and packaged-bundle boundary |
| Commands | `@jilatax/cli` | Development, device, APK, and AAB orchestration |
| SVG compiler | `@svg` | Build-time icon validation and ReactLynx module generation |
| Templates | `create-jilatax` | Initial project files and assets |

## 🔧 Build

```
src/index.ts
     │
     ▼
   tsdown
     │
     ├── dist/index.js      (ESM)
     ├── dist/index.cjs     (CJS)
     ├── dist/index.d.ts    (ESM types)
     └── dist/index.d.cts   (CJS types)
```

Validation: `publint` + `@arethetypeswrong/core`

## 🚀 CI/CD

| Workflow | Trigger | Publishes |
|----------|---------|-----------|
| `publish.yml` | `v*` | `jilatax` |
| `svg.yml` | `svg-v*` | `@jilatax/svg` |
| `cli.yml` | `cli-v*` | `@jilatax/cli` |
| `create-jilatax.yml` | `create-jilatax-v*` | `create-jilatax` |

## 📌 Phase

```
Phase 1  ✓  Website & docs
Phase 2  ✓  Monorepo foundation
Phase 3  ◐  Android framework behavior (in progress)
```
