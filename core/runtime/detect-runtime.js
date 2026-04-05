#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { listRuntimeIds } = require('./registry');

const VALID_RUNTIMES = listRuntimeIds();

function detectRuntime(projectRoot) {
  const root = projectRoot || process.env.CITADEL_PROJECT_DIR || process.cwd();

  const envRuntime = process.env.CITADEL_RUNTIME;
  if (envRuntime && VALID_RUNTIMES.includes(envRuntime)) {
    return { runtime: envRuntime, method: 'env' };
  }

  try {
    const isWin = process.platform === 'win32';
    let parentInfo = '';
    if (isWin) {
      try {
        parentInfo = execSync(
          `wmic process where "ProcessId=${process.ppid}" get CommandLine /format:list`,
          { encoding: 'utf8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toLowerCase();
      } catch {
        parentInfo = execSync(
          `tasklist /FI "PID eq ${process.ppid}" /FO CSV /NH`,
          { encoding: 'utf8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toLowerCase();
      }
    } else {
      parentInfo = execSync(
        `ps -p ${process.ppid} -o command= 2>/dev/null || true`,
        { encoding: 'utf8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toLowerCase();
    }

    if (parentInfo.includes('codex')) {
      return { runtime: 'codex', method: 'process-tree' };
    }
  } catch {
    // Ignore and continue to directory markers.
  }

  const hasCodexDir = fs.existsSync(path.join(root, '.codex'));

  if (hasCodexDir) {
    return { runtime: 'codex', method: 'directory-marker' };
  }

  return { runtime: 'unknown', method: 'default' };
}

module.exports = Object.freeze({
  VALID_RUNTIMES,
  detectRuntime,
});
