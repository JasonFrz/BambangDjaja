const { spawn } = require('child_process');
const path = require('path');

const runCommand = (command, args, cwd, prefix) => {
  return new Promise((resolve, reject) => {
    console.log(`[${prefix}] Starting: ${command} ${args.join(' ')} in ${cwd}`);
    
    // spawn options: shell: true is useful on Windows for npm
    const child = spawn(command, args, { cwd, shell: true });

    child.stdout.on('data', (data) => {
      // Split by newline and add prefix to each line
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) process.stdout.write(`[${prefix}] ${line}\n`);
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) process.stderr.write(`[${prefix}] ${line}\n`);
      });
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`[${prefix}] Process exited with code ${code}`);
        reject(new Error(`[${prefix}] Process exited with code ${code}`));
      } else {
        console.log(`[${prefix}] Finished successfully.`);
        resolve();
      }
    });
  });
};

const main = async () => {
  const backendPath = path.join(__dirname, 'backend');
  const frontendPath = path.join(__dirname, 'frontend');

  try {
    console.log('=====================================');
    console.log('Installing dependencies (npm install)');
    console.log('=====================================\n');
    
    // Run npm install concurrently
    await Promise.all([
      runCommand('npm', ['install'], backendPath, 'BACKEND-INSTALL'),
      runCommand('npm', ['install'], frontendPath, 'FRONTEND-INSTALL')
    ]);

    console.log('\n=====================================');
    console.log('Starting applications (npm run dev)');
    console.log('=====================================\n');

    // Run applications concurrently without awaiting
    runCommand('npm', ['start'], backendPath, 'BACKEND');
    runCommand('npm', ['run', 'dev'], frontendPath, 'FRONTEND');

  } catch (error) {
    console.error('An error occurred during execution:', error);
  }
};

main();
