#!/usr/bin/env node

'use strict';

const { isPlainObject } = require('./defaults');

function stripComment(line) {
  let inQuote = false;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inQuote) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (char === '#' && !inQuote) {
      return line.slice(0, index);
    }
  }

  return line;
}

function splitTopLevel(raw, delimiter = ',') {
  const parts = [];
  let current = '';
  let braceDepth = 0;
  let bracketDepth = 0;
  let inQuote = false;
  let escaped = false;

  for (const char of raw) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && inQuote) {
      current += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      current += char;
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote) {
      if (char === '{') braceDepth += 1;
      else if (char === '}') braceDepth -= 1;
      else if (char === '[') bracketDepth += 1;
      else if (char === ']') bracketDepth -= 1;
      else if (char === delimiter && braceDepth === 0 && bracketDepth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseInlineTable(rawValue) {
  const inner = rawValue.slice(1, -1).trim();
  if (!inner) return {};

  const table = {};
  for (const part of splitTopLevel(inner)) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`Invalid TOML inline table entry: ${part}`);
    }
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    table[key] = parseTomlValue(value);
  }
  return table;
}

function parseTomlValue(rawValue) {
  const value = rawValue.trim();
  if (!value) return '';
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.startsWith('{') && value.endsWith('}')) return parseInlineTable(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner).map(parseTomlValue);
  }
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return Number.parseFloat(value);
  return value;
}

function setNestedValue(target, pathParts, value) {
  let cursor = target;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const part = pathParts[index];
    if (!isPlainObject(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[pathParts[pathParts.length - 1]] = value;
}

function parseToml(text) {
  const result = {};
  let currentPath = [];

  for (const originalLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = stripComment(originalLine).trim();
    if (!line) continue;

    const tableMatch = line.match(/^\[([^\]]+)\]$/);
    if (tableMatch) {
      currentPath = tableMatch[1].split('.').map((part) => part.trim()).filter(Boolean);
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = parseTomlValue(line.slice(separatorIndex + 1));
    setNestedValue(result, currentPath.concat(key), value);
  }

  return result;
}

function renderTomlValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map(renderTomlValue).join(', ')}]`;
  }
  if (isPlainObject(value)) {
    const pairs = Object.entries(value)
      .filter(([, nested]) => nested !== null && nested !== undefined)
      .map(([key, nested]) => `${key} = ${renderTomlValue(nested)}`);
    return `{ ${pairs.join(', ')} }`;
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  throw new Error(`Unsupported TOML value: ${typeof value}`);
}

function sortKeys(keys, preferredOrder) {
  if (!Array.isArray(preferredOrder) || preferredOrder.length === 0) {
    return [...keys].sort();
  }

  const preferred = new Map(preferredOrder.map((key, index) => [key, index]));
  return [...keys].sort((left, right) => {
    const leftIndex = preferred.has(left) ? preferred.get(left) : Number.MAX_SAFE_INTEGER;
    const rightIndex = preferred.has(right) ? preferred.get(right) : Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.localeCompare(right);
  });
}

function stringifyToml(config, options = {}) {
  const lines = [];
  const tableQueue = [];
  const preferredOrder = options.preferredOrder || {};
  const rootKeys = sortKeys(Object.keys(config), preferredOrder.root);

  for (const key of rootKeys) {
    const value = config[key];
    if (value === null || value === undefined) continue;
    if (isPlainObject(value)) {
      tableQueue.push({ path: [key], value });
      continue;
    }
    lines.push(`${key} = ${renderTomlValue(value)}`);
  }

  if (lines.length > 0) lines.push('');

  while (tableQueue.length > 0) {
    const current = tableQueue.shift();
    const sectionName = current.path.join('.');
    lines.push(`[${sectionName}]`);

    const keys = sortKeys(Object.keys(current.value), preferredOrder[sectionName]);
    for (const key of keys) {
      const value = current.value[key];
      if (value === null || value === undefined) continue;
      if (isPlainObject(value)) {
        tableQueue.push({ path: current.path.concat(key), value });
        continue;
      }
      lines.push(`${key} = ${renderTomlValue(value)}`);
    }

    lines.push('');
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}

module.exports = Object.freeze({
  parseToml,
  parseTomlValue,
  stringifyToml,
});
