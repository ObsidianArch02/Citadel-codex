#!/usr/bin/env node

'use strict';

const path = require('path');
const { normalizeCodexHookInput } = require(path.join(__dirname, '..', 'runtimes', 'codex', 'adapters', 'hook-input'));
const { toLegacyHookPayload } = require(path.join(__dirname, '..', 'core', 'hooks', 'hook-context'));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  const codexEnvelope = normalizeCodexHookInput({
    hook_event_name: 'PreToolUse',
    session_id: 'sess-1',
    turn_id: 'turn-1',
    cwd: 'C:\\repo',
    transcript_path: 'C:\\repo\\.codex\\history.jsonl',
    model: 'gpt-5.4',
    tool_name: 'edit',
    tool_input: {
      file_path: 'C:\\repo\\src\\file.ts',
    },
  });

  if (codexEnvelope.runtime !== 'codex') fail('Codex envelope runtime mismatch');
  if (codexEnvelope.event_id !== 'pre_tool') fail('Codex envelope event id mismatch');
  if (codexEnvelope.tool_name !== 'Edit') fail('Codex envelope tool normalization mismatch');
  if (codexEnvelope.tool_input.file_path !== 'C:/repo/src/file.ts') fail('Codex envelope path normalization mismatch');

  const legacy = toLegacyHookPayload(codexEnvelope);
  if (legacy.tool_name !== 'Edit') fail('Legacy hook payload tool mismatch');
  if (legacy._runtime !== 'codex') fail('Legacy hook payload runtime metadata mismatch');
  if (legacy._event_id !== 'pre_tool') fail('Legacy hook payload event metadata mismatch');

  console.log('Hook event normalization tests pass.');
}

main();
