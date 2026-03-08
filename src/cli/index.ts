#!/usr/bin/env node

import { Command } from 'commander';
import { registerInit } from './init.js';
import { registerBuild } from './build.js';
import { registerVerify } from './verify.js';
import { registerShow } from './show.js';

const program = new Command();

program
  .name('trustbundle')
  .description('Pack AI agent execution traces into verifiable bundles for audit and compliance.')
  .version('0.1.0');

registerInit(program);
registerBuild(program);
registerVerify(program);
registerShow(program);

program.parse();
