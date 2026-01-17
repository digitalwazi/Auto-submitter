module.exports = {
    apps: [
        {
            name: "auto-submitter-web",
            script: "./start.sh",
            interpreter: "bash",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
                PORT: 3000
            }
        },
        {
            name: "auto-submitter-worker",
            script: "workers/queue-worker.js",
            instances: 1,  // SQLite requires single writer
            exec_mode: "fork",
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            cron_restart: "0 */4 * * *",  // Restart every 4 hours
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "direct-submit-worker",
            script: "workers/direct-submit-worker.js",
            instances: 1,  // Single instance to prevent duplicate submissions
            exec_mode: "cluster",
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "watchdog",
            script: "watchdog.mjs",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: "production"
            }
        }
    ]
}

