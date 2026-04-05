#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildEmptySkillManifest,
  detectSkillDrift,
  loadSkillProjectionManifest,
  projectSkillToCodex,
  writeSkillProjectionManifest,
} = require('../../../core/skills/project-skill');

function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function projectCodexSkills(options = {}) {
  const citadelRoot = options.citadelRoot || path.resolve(__dirname, '..', '..', '..');
  const projectRoot = options.projectRoot || process.cwd();
  const skillName = options.skillName || null;
  const dryRun = options.dryRun === true;
  const force = options.force === true;
  const prune = options.prune === true;

  const sourceBase = path.join(citadelRoot, 'skills');
  const targetBase = path.join(projectRoot, '.agents', 'skills');
  const selectedSkills = skillName
    ? [skillName]
    : fs.readdirSync(sourceBase).filter((name) => fs.existsSync(path.join(sourceBase, name, 'SKILL.md')));

  const { manifestPath, manifest } = loadSkillProjectionManifest(targetBase);
  const nextManifest = buildEmptySkillManifest();
  nextManifest.skills = { ...manifest.skills };

  const results = selectedSkills.map((name) => {
    const result = projectSkillToCodex(path.join(sourceBase, name), targetBase, name, {
      dryRun,
      force,
      manifestEntry: manifest.skills[name] || null,
    });

    if (result.nextManifestEntry) {
      nextManifest.skills[name] = result.nextManifestEntry;
    }

    return result;
  });

  if (prune) {
    for (const [managedSkillName, managedEntry] of Object.entries(manifest.skills || {})) {
      if (selectedSkills.includes(managedSkillName)) continue;

      const targetSkillPath = path.join(targetBase, managedSkillName, 'SKILL.md');
      const targetYamlPath = path.join(targetBase, managedSkillName, 'agents', 'openai.yaml');
      const drift = detectSkillDrift(managedSkillName, targetSkillPath, targetYamlPath, managedEntry);

      if (drift.length > 0 && !force) {
        results.push({
          skillName: managedSkillName,
          status: 'skipped-prune-drift',
          warnings: [
            `Skipping prune for ${managedSkillName}: managed files drifted from manifest. Re-run with force to prune.`,
          ],
          drift,
          outputs: {
            skillPath: targetSkillPath,
            openaiYamlPath: targetYamlPath,
          },
        });
        continue;
      }

      if (!dryRun) {
        removeDirectory(path.join(targetBase, managedSkillName));
      }
      delete nextManifest.skills[managedSkillName];
      results.push({
        skillName: managedSkillName,
        status: 'pruned',
        warnings: [],
        drift,
        outputs: {
          skillPath: targetSkillPath,
          openaiYamlPath: targetYamlPath,
        },
      });
    }
  }

  nextManifest.generatedAt = new Date().toISOString();

  if (!dryRun) {
    writeSkillProjectionManifest(targetBase, nextManifest);
  }

  results.manifest = {
    path: manifestPath,
    schemaVersion: nextManifest.schemaVersion,
  };

  return results;
}

module.exports = Object.freeze({
  projectCodexSkills,
});
