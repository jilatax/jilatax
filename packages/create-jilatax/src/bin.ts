#!/usr/bin/env node
import { runCreateCli } from './cli.js';

void runCreateCli().then((exitCode) => {
  process.exitCode = exitCode;
});
