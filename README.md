# myai-novel-webui

AI 小说 WebUI 独立前端项目。

## 开发

```bash
npm install
npm run dev
```

## 脚本

- `npm run dev`：启动开发服务器
- `npm run build`：构建生产版本
- `npm run check`：TypeScript 类型检查
- `npm run test`：运行测试
- `npm run preview`：预览构建结果

## 目录

- `src/`：前端源码
- `dist/`：构建产物
- `vite.config.ts`：Vite 配置

## 说明

开发模式下，前端会把 `/api` 和 `/health` 转发到 `http://127.0.0.1:3000`。
