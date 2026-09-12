# npm 发布指南

本文面向 `@xbongbong/xbbcli` 维护者，介绍 npm 发布流程。

## 发布前检查

确认 `package.json` 中的版本号尚未发布，并检查实际打包内容：

```bash
npm version <VERSION> --no-git-tag-version
npm pack --dry-run
```

每个版本只能发布一次；如果版本已存在，需要先递增版本号。

## 配置发布令牌

使用 npm Granular Access Token 发布时，Token 必须具备 `Read and write` 包权限，并启用 `Bypass 2FA`。`@xbongbong` 组织包还要求发布账号拥有该组织的发布权限。

不要将 Token 写入代码或提交到 Git：

```bash
npm config set "//registry.npmjs.org/:_authToken" "<NPM_TOKEN>"
```

## 发布

```bash
npm publish --access public
```

发布完成后删除本地 Token：

```bash
npm config delete "//registry.npmjs.org/:_authToken"
```
