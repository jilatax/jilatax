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
   Android / iOS
```

## 📦 Packages

| Package | npm | Role |
|---------|-----|------|
| `jilatax` | `jilatax` | Public API, `defineConfig`, SDK entry |
| `@cli` | `@jilatax/cli` | Command parsing, user output |
| `create-jilatax` | `create-jilatax` | Scaffolding, templates |

### Planned

| Package | Role |
|---------|------|
| `@jilatax/core` | Orchestration, config loading |
| `@jilatax/config` | Schema, validation |
| `@jilatax/dev-server` | Dev server, QR, device discovery |
| `@jilatax/android` | Android host, Gradle generation |
| `@jilatax/ios` | iOS host, Xcode generation |
| `@jilatax/prebuild` | Native project generation |
| `@jilatax/autolinking` | Native module linking |
| `@jilatax/doctor` | Project diagnostics |

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
| `cli.yml` | `cli-v*` | `@jilatax/cli` |
| `create-jilatax.yml` | `create-jilatax-v*` | `create-jilatax` |

## 📌 Phase

```
Phase 1  ✓  Website & docs
Phase 2  ✓  Monorepo foundation
Phase 3  ·  Framework behavior (pending)
```
