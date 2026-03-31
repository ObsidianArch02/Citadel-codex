'use strict';

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const raw = kv[2].trim().replace(/^["']|["']$/g, '');
    result[kv[1]] = raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
  }

  return result;
}

function parseSection(content, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^##\\s+${escaped}\\s*\\r?\\n([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'm');
  const match = content.match(regex);
  return match ? match[1] : null;
}

function parseBulletSection(content, sectionName) {
  const section = parseSection(content, sectionName);
  if (!section) return [];
  return section
    .split(/\r?\n/)
    .map(line => line.replace(/^[-*\s]+/, '').trim())
    .filter(Boolean);
}

function parseCampaignContent(content, options = {}) {
  const slug = options.slug || null;
  const frontmatter = parseFrontmatter(content);
  const bodyStatusMatch = content.match(/^Status:\s*(\S+)$/im);
  const titleMatch = content.match(/^#\s+Campaign:\s*(.+)$/im);

  return {
    slug,
    content,
    frontmatter,
    title: titleMatch ? titleMatch[1].trim() : slug,
    bodyStatus: bodyStatusMatch ? bodyStatusMatch[1].trim() : null,
    claimedScope: parseBulletSection(content, 'Claimed Scope'),
    restrictedFiles: parseBulletSection(content, 'Restricted Files'),
  };
}

module.exports = {
  parseCampaignContent,
  parseFrontmatter,
  parseSection,
};
