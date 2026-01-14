const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Read current version
const packagePath = path.join(__dirname, '..', 'package.json');
const versionPath = path.join(__dirname, '..', 'lib', 'version.js');

const packageJson = require(packagePath);
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

// 2. Bump patch version
const newVersion = `${major}.${minor}.${patch + 1}`;
console.log(`🚀 Bumping version: ${currentVersion} -> ${newVersion}`);

// 3. Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

// 4. Update lib/version.js
const versionContent = `export const APP_VERSION = '${newVersion}';
export const BUILD_DATE = '${new Date().toISOString()}';
`;
fs.writeFileSync(versionPath, versionContent);

// 5. Run Git commands
try {
    const commitMsg = process.argv[2] || `Release version ${newVersion}`;

    console.log('📦 Staging files...');
    execSync('git add .', { stdio: 'inherit' });

    console.log(`💾 Committing: "${commitMsg}"...`);
    execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });

    console.log('☁️ Pushing to origin...');
    execSync('git push origin main', { stdio: 'inherit' });

    console.log('✅ Deployment successful!');
} catch (error) {
    console.error('❌ Failed to deploy:', error.message);
    process.exit(1);
}
