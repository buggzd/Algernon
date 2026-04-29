# 脑力训练营 (Brain Gym)

基于 [Perhacept/train_brain](https://github.com/Perhacept/train_brain) 改进的脑力认知训练应用。

## 功能

内置 9 种认知训练模块：

| 模块 | 训练目标 |
|------|----------|
| 舒尔特方格 | 专注力与视野扫描 |
| T-Back / N-Back | 工作记忆节奏训练 |
| Stroop 斯特鲁普 | 抑制控制，看颜色不看字义 |
| Go / No-Go | 冲动克制与行为抑制 |
| 反扫视 | 眼动控制与注意切换 |
| 凝视专注 | 抗干扰定视训练 |
| 反应时 | 多轮视觉反应速度 |
| 持续注意 | 目标警觉与漏报抑制 |
| 节拍呼吸 | 吸 4 秒、呼 6 秒的节律慢练 |

训练记录自动保存在本地（浏览器 localStorage 或桌面端文件），支持导出/导入 JSON 备份。

## 技术栈

- **前端**：Vite + 原生 HTML/CSS/JS（零框架依赖）
- **桌面端**：[Tauri v2](https://v2.tauri.app/)（Rust 后端），支持 macOS / Windows / Linux
- **持久化**：浏览器用 localStorage，桌面端自动迁移到本地文件系统

## 快速开始

```bash
# 安装依赖
npm install

# 浏览器开发
npm run dev          # 打开 http://localhost:1420

# 桌面端开发
npm run tauri dev    # 启动 Tauri 桌面应用（开发模式）

# 桌面端打包
npm run tauri build  # 产出在 src-tauri/target/release/bundle/
```

也可以直接在浏览器中打开 `brain-training-camp.html`（旧版单文件版本，无需构建）。

## 致谢

本项目基于 [Perhacept/train_brain](https://github.com/Perhacept/train_brain) 二次开发，主要改动：

- 从单文件 HTML 拆分为 Vite 工程，CSS/JS 模块化
- 接入 Tauri v2，支持原生桌面端运行与文件系统持久化
- 新增训练记录导入/导出功能
- 新增训练偏好记忆（网格尺寸、节奏速度等）

## License

ISC
