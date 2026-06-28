/**
 * Setup Script for zkfetch-stellar-example
 * 
 * This script helps users set up the project environment and dependencies.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Creates a .env file from the example template
 */
function createEnvFile() {
  const envExamplePath = '.env.example';
  const envPath = '.env';
  
  if (fs.existsSync(envPath)) {
    console.log('.env file already exists');
    return;
  }
  
  if (!fs.existsSync(envExamplePath)) {
    console.log('.env.example file not found');
    return;
  }
  
  try {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('Created .env file from template');
    console.log('Please edit .env file with your actual seedphrase');
  } catch (error) {
    console.error('Failed to create .env file:', error.message);
  }
}

/**
 * Downloads required ZK files
 */
function downloadZkFiles() {
  try {
    console.log('Downloading ZK files...');
    execSync('npm run download-zk-files', { stdio: 'inherit' });
    console.log('ZK files downloaded successfully');
  } catch (error) {
    console.error('Failed to download ZK files:', error.message);
  }
}

/**
 * Checks if required dependencies are installed
 */
function checkDependencies() {
  try {
    console.log('Checking dependencies...');
    execSync('npm list --depth=0', { stdio: 'pipe' });
    console.log('All dependencies are installed');
    return true;
  } catch (error) {
    console.log('Some dependencies may be missing');
    return false;
  }
}

/**
 * Installs dependencies if needed
 */
function installDependencies() {
  try {
    console.log('Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('Dependencies installed successfully');
  } catch (error) {
    console.error('Failed to install dependencies:', error.message);
  }
}

/**
 * Validates the setup
 */
function validateSetup() {
  const checks = [
    { name: 'package.json', path: 'package.json' },
    { name: 'src directory', path: 'src' },
    { name: 'tests directory', path: 'tests' },
    { name: '.env file', path: '.env' },
  ];
  
  console.log('Validating setup...');
  
  let allValid = true;
  for (const check of checks) {
    if (fs.existsSync(check.path)) {
      console.log(`${check.name} exists`);
    } else {
      console.log(`${check.name} missing`);
      allValid = false;
    }
  }
  
  return allValid;
}

/**
 * Main setup function
 */
async function setup() {
  console.log('Setting up zkfetch-stellar-example...\n');
  
  // Check and install dependencies
  if (!checkDependencies()) {
    installDependencies();
  }
  
  // Create .env file
  createEnvFile();
  
  // Download ZK files
  downloadZkFiles();
  
  // Validate setup
  const isValid = validateSetup();
  
  console.log('\n' + '='.repeat(50));
  if (isValid) {
    console.log('Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Edit .env file with your Stellar seedphrase');
    console.log('2. Run: npm run request-proof');
    console.log('3. Run: npm run verify-proof');
  } else {
    console.log('Setup completed with issues');
    console.log('Please check the missing files and try again');
  }
}

export {
  createEnvFile,
  downloadZkFiles,
  checkDependencies,
  installDependencies,
  validateSetup,
  setup,
};

// Run setup if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setup().catch(console.error);
}
