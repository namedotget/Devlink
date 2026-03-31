# DEVLINK SERVER

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This is the API server for Devlink.

It handles auth, database, AI, and messaging via Linq.

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

# Setup

### Create env file
```bash
cp .env.example .env
```

### Add required env vars
```bash
DATABASE_URL=
LINQ_API_KEY=
LINQ_FROM_NUMBER=
GROQ_API_KEY=
JWT_SECRET=
ADMIN_SECRET=
```

### Install
```bash
yarn install
```

### Run dev server
```bash
yarn dev
```

### Build
```bash
yarn build
```

# Deploy (Fly.io)

```bash
fly launch
fly secrets set DATABASE_URL=... LINQ_API_KEY=... LINQ_FROM_NUMBER=... GROQ_API_KEY=... JWT_SECRET=... ADMIN_SECRET=...
fly deploy
```
