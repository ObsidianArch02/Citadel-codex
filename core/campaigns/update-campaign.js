'use strict';

const fs = require('fs');
const path = require('path');
const { getCampaignPaths, readCampaignFile } = require('./load-campaign');

function updateCampaignStatus(filePath, status) {
  let content = fs.readFileSync(filePath, 'utf8');

  if (/^(status:\s*).+$/im.test(content)) {
    content = content.replace(/^(status:\s*).+$/im, `$1${status}`);
  }

  if (/^(Status:\s*).+$/m.test(content)) {
    content = content.replace(/^(Status:\s*).+$/m, `$1${status}`);
  }

  fs.writeFileSync(filePath, content);
  return readCampaignFile(filePath);
}

function archiveCampaign(filePath, projectRoot) {
  const paths = getCampaignPaths(projectRoot);
  fs.mkdirSync(paths.completedDir, { recursive: true });
  const destination = path.join(paths.completedDir, path.basename(filePath));
  fs.renameSync(filePath, destination);
  return readCampaignFile(destination);
}

module.exports = {
  archiveCampaign,
  updateCampaignStatus,
};
