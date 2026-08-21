import assert from 'assert';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { dependencyManager } from '../services/dependencyManager';
import { zipImporterService } from '../services/zipImporter';

async function runDependencyManagerTests() {
  console.log('🧪 Running Intelligent Dependency Manager & Auto Installer Tests...');

  // Test 1: Node.js Built-in Module Detection
  assert.strictEqual(dependencyManager.isNodeBuiltin('fs'), true);
  assert.strictEqual(dependencyManager.isNodeBuiltin('node:path'), true);
  assert.strictEqual(dependencyManager.isNodeBuiltin('crypto'), true);
  assert.strictEqual(dependencyManager.isNodeBuiltin('axios'), false);
  assert.strictEqual(dependencyManager.isNodeBuiltin('fs-extra'), false);
  console.log('✅ [PASS] Node.js Built-in Module Detection');

  // Test 2: Dependency Extraction from Code
  const sampleCode = `
    // require('commented-out-pkg');
    const fs = require('fs');
    const path = require("node:path");
    const axios = require('axios');
    import lodash from 'lodash/get';
    import { fn } from '@napi-rs/canvas';

    module.exports = {
      config: {
        name: "testdep",
        packages: ["moment", "chalk"]
      },
      onStart: async function() {}
    };
  `;

  const extracted = dependencyManager.extractDependenciesFromCode(sampleCode);
  assert(extracted.builtins.includes('fs'), 'Should identify fs as builtin');
  assert(extracted.builtins.includes('path'), 'Should identify path as builtin');
  assert(extracted.requiredPackages.includes('axios'), 'Should identify axios');
  assert(extracted.requiredPackages.includes('lodash'), 'Should normalize lodash/get to lodash');
  assert(extracted.requiredPackages.includes('@napi-rs/canvas'), 'Should extract scoped package @napi-rs/canvas');
  assert(extracted.requiredPackages.includes('moment'), 'Should extract config.packages moment');
  assert(extracted.requiredPackages.includes('chalk'), 'Should extract config.packages chalk');
  assert(!extracted.requiredPackages.includes('commented-out-pkg'), 'Should ignore packages in comments');
  console.log('✅ [PASS] AST & Regex Dependency Extraction');

  // Test 3: Installed Package Check
  assert.strictEqual(dependencyManager.isPackageInstalled('axios'), true);
  assert.strictEqual(dependencyManager.isPackageInstalled('express'), true);
  assert.strictEqual(dependencyManager.isPackageInstalled('non_existent_fake_package_xyz_999'), false);
  console.log('✅ [PASS] Installed Package Status Checking');

  // Test 4: NPM Registry Validation
  const validCheck = await dependencyManager.validateNpmPackage('axios');
  assert.strictEqual(validCheck.valid, true);

  const invalidCheck = await dependencyManager.validateNpmPackage('this-package-does-not-exist-xyz-999-shipu');
  assert.strictEqual(invalidCheck.valid, false);
  console.log('✅ [PASS] NPM Registry Validation for Real and Fake Packages');

  // Test 5: ZIP Workspace Dependency Inspection and Smart Merging
  const tempZipDir = path.join(process.cwd(), 'tmp_test_zip_' + Date.now());
  fs.mkdirSync(tempZipDir, { recursive: true });

  const zipPkgJson = {
    name: "test-pkg-project",
    dependencies: {
      "axios": "^1.0.0",
      "unused-junk-dep": "^9.9.9"
    }
  };
  fs.writeFileSync(path.join(tempZipDir, 'package.json'), JSON.stringify(zipPkgJson, null, 2));

  const cmdCode1 = `
    const fs = require('fs');
    const axios = require('axios');
    module.exports = {
      config: { name: "weather" },
      onStart: async function({ message }) {
        message.reply("Weather output");
      }
    };
  `;
  fs.writeFileSync(path.join(tempZipDir, 'weather.js'), cmdCode1);

  const zip = new AdmZip();
  zip.addLocalFolder(tempZipDir);
  const zipBuffer = zip.toBuffer();

  // Run zip importer with the test buffer
  const importReport = await zipImporterService.importZip(zipBuffer);
  assert(importReport.dependencyAudit, 'Import report should contain dependencyAudit');
  assert.strictEqual(importReport.dependencyAudit.alreadyInstalled.includes('axios'), true);
  assert.strictEqual(importReport.dependencyAudit.skippedBuiltins.includes('fs'), true);
  assert(!importReport.dependencyAudit.alreadyInstalled.includes('unused-junk-dep'), 'Unused junk dep should NOT be merged');

  // Clean up temp test folder
  try {
    fs.rmSync(tempZipDir, { recursive: true, force: true });
  } catch {}

  console.log('✅ [PASS] ZIP Dependency Inspection & Smart Merger');

  console.log('===================================================');
  console.log('All Intelligent Dependency Manager Tests Succeeded!');
  console.log('===================================================');
  process.exit(0);
}

runDependencyManagerTests().catch(err => {
  console.error('❌ Dependency Manager Test Failed:', err);
  process.exit(1);
});
