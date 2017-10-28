const fs = require('fs-extra');
const exec = require('child_process').exec;
const process = require('process');

const executeCommand = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    childProcess = exec(command, options, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      if (stderr) {
        return resolve(stderr);
      }
      return resolve(stdout);
    });
    childProcess.stdout.on('data', console.log);
    childProcess.stderr.on('data', console.log);
  });
}

const getLatestRelease = async(repo) => {
  const response = await executeCommand(`aws ecr list-images --repository-name ${repo}`);
  const images = JSON.parse(response).imageIds;
  const tags = images.map(im => im.imageTag);
  const releases = tags.filter(tag => tag.startsWith('v'));
  return releases.reduce((x,y) => x > y ? x : y, "");
}

const getNewRelease = (latestRelease, buildType) => {
  const [major, minor, patch] = latestRelease.replace(/v/, '').split('.');
  switch (buildType) {
    case "PATCH":
      return `v${major}.${minor}.${Number(patch) +1}`;
    case "MINOR":
      return `v${major}.${Number(minor) +1}.0`;
    case "MAJOR":
      return `v${Number(major) +1}.0.0`;
    default:
      return latestRelease;
  }
}

const getReleaseInfo = async() => {
  const packageInfo = JSON.parse(await fs.readFile('./package.json'));
  return packageInfo.releaseInfo;
}

const start = async() => {
  const BUILD_TYPE = process.argv.length > 2 ? process.argv[2] : "PATCH";
  const releaseInfo = await getReleaseInfo();
  const latestRelease = await getLatestRelease(releaseInfo.ecrRepoName) || "v0.0.0";
  const newRelease = getNewRelease(latestRelease, BUILD_TYPE);
  
  try {
    await executeCommand(`git tag ${newRelease}`);
  } catch (e) {

  }
  await executeCommand(`git push --tags`);

  const buildObj = {
    projectName: releaseInfo.codebuildProjectName,
    sourceVersion: newRelease,
    environmentVariablesOverride: [
      {
        name: "IMAGE_TAG",
        value: newRelease
      }
    ]
  }
  await fs.writeFile('./build.json', JSON.stringify(buildObj));
  await executeCommand(`aws codebuild start-build --cli-input-json file://build.json`)
  console.log(buildObj);

}

start();
