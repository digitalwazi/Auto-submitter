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
            instances: "max",  // Scale to all available CPU cores
            exec_mode: "cluster",
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            cron_restart: "0 */4 * * *",  // Restart every 4 hours (reduced freq)
            env: {
                NODE_ENV: "production"
            }
        }
    ]
}
