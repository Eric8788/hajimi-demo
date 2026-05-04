#!/usr/bin/env node

const { spawn } = require('child_process');
const net = require('net');

const REQUESTED_PORT = Number(process.env.PORT || 0);
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
const BASE_PORT = REQUESTED_PORT || 3001;
const MAX_PORT = 3100;

async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

async function findAvailablePort() {
    if (REQUESTED_PORT) {
        if (await isPortAvailable(REQUESTED_PORT)) {
            return REQUESTED_PORT;
        }
        throw new Error(`Requested port ${REQUESTED_PORT} is already in use`);
    }

    for (let port = BASE_PORT; port <= MAX_PORT; port++) {
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    throw new Error(`No available port found between ${BASE_PORT} and ${MAX_PORT}`);
}

async function main() {
    try {
        const port = await findAvailablePort();
        console.log(`\n🚀 Starting development server on port ${port}...\n`);

        const nextDev = spawn('npx', ['next', 'dev', '-H', HOSTNAME, '-p', port.toString()], {
            stdio: 'inherit',
            cwd: process.cwd(),
            shell: true
        });

        nextDev.on('error', (err) => {
            console.error('Failed to start server:', err);
            process.exit(1);
        });

        nextDev.on('close', (code) => {
            process.exit(code);
        });

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
