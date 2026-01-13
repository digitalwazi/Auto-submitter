module.exports = {
    apps: [
        {
            name: "auto-submitter-web",
            script: "node_modules/next/dist/bin/next",
            args: "start",
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
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            cron_restart: "0 * * * *",  // Restart every hour at minute 0 (prevents memory buildup)
            env: {
                NODE_ENV: "production"
            }
        }
    ]
}
