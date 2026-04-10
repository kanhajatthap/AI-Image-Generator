const fs = require('fs');
const path = require('path');

console.log('Starting cleanup...');

// 1. Delete the .next cache folder to fix the "rope into string / compiler corruption" error
const nextDir = path.join(__dirname, '.next');
if (fs.existsSync(nextDir)) {
  try {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log('✅ Deleted corrupted .next cache folder');
  } catch (err) {
    console.error('❌ Failed to delete .next folder:', err.message);
  }
} else {
  console.log('✅ .next folder already clean');
}

// 2. Rename the parent directory's package-lock.json which is confusing Turbopack
const parentLock = path.join(__dirname, '../package-lock.json');
const parentLockBackup = path.join(__dirname, '../package-lock-backup.json');

if (fs.existsSync(parentLock)) {
  try {
    fs.renameSync(parentLock, parentLockBackup);
    console.log('✅ Renamed D:\\ReactJS\\package-lock.json to avoid monorepo confusion');
  } catch (err) {
    console.error('❌ Failed to rename parent lockfile:', err.message);
  }
} else {
  console.log('✅ Parent package-lock.json already handled');
}

console.log('\nCleanup complete! You can now start the app normally.');
