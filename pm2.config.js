module.exports = {
  apps: [
    {
      name: 'next-app',
      script: 'server.js', // In standalone mode, Next.js generates a server.js file
      env: {
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
    },
    {
      name: 'express-api',
      script: 'api/index.js',
      env: {
        PORT: 3001,
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
}
