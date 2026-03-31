# NPM PUBLISH

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Simple steps to publish Devlink to npm.

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

### 1. Login to npm
```bash
npm login
```

### 2. Build package
```bash
npm run build
```

### 3. Check package contents
```bash
npm pack --dry-run
```

### 4. Publish
```bash
npm publish
```

### 5. Test install
```bash
npx devlink
```

### Optional scoped package
If `devlink` is taken:
```bash
npm publish --access public
```
