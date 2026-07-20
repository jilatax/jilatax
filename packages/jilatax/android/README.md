# Jilatax Android host

This Gradle library is the Android runtime boundary shipped by the `jilatax` npm package. It is
intended to be included from `node_modules/jilatax/android` by `@jilatax/cli`.

The first host revision deliberately keeps bundle selection stateless:

- release applications always load `main.lynx.bundle` from packaged Android assets;
- debug applications also use the packaged bundle unless the CLI supplies an explicit bundle
  source through the `dev.jilatax.bundleSource` launch intent extra;
- remote sources are accepted only by debuggable applications;
- fonts emitted by Rspeedy are loaded from the development server or packaged Android assets;
- no persistent development URL or Sparkling debug-tool dependency is used.

Application-specific manifest entries, splash resources, icons, package identifiers, and Gradle
root configuration belong to the generated project and will be supplied by `create-jilatax`.
