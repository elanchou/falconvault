# FalconVault - 安全私钥签名服务

FalconVault 是一个基于 Web 的去中心化私钥管理与签名服务。它允许用户在一个隔离的安全环境中导入和管理多个以太坊（EVM）钱包私钥，并通过模拟的 API 接口进行签名操作。

## 核心特性

- **🛡️ 安全性优先**: 所有私钥均使用 **AES-256-GCM** 算法在本地浏览器端加密存储。私钥**永远不会**以明文形式离开您的设备或传输到网络。
- **💼 多钱包管理**: 支持批量导入 (CSV)、生成和管理多个 EVM 兼容钱包地址。
- **✍️ 签名工具**: 提供可视化界面进行交易签名 (`eth_signTransaction`)、消息签名 (`personal_sign`) 和结构化数据签名 (`eth_signTypedData`)。
- **💸 转账中心**: 内置简易的转账界面，支持 ETH 及主流 ERC20 代币（USDT, USDC）转账。
- **🐳 Docker 部署**: 提供完整的 Docker 容器化部署方案，基于 Nginx + Alpine，体积小巧且安全。

## 安全架构

FalconVault 采用“零信任”客户端架构设计：

1. **主密码派生**: 用户设置的主密码通过 PBKDF2 算法派生出加密密钥。
2. **本地加密存储**: 业务数据加密后存储在浏览器 `localStorage` 中。即使服务器端被攻破，攻击者也无法获取您的私钥数据。
3. **无后端逻辑**: 本项目是一个纯静态的 SPA (Single Page Application)，服务器仅负责分发 HTML/JS 资源，不接触业务逻辑。

## 部署指南

本项目已配置 Docker 环境，可一键部署。

### 前置要求

请确保您的环境已安装：
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

### 快速启动

1. **下载代码**
   下载本项目代码到本地目录。

2. **构建并启动容器**
   在项目根目录下终端运行：

   ```bash
   docker-compose up -d --build
   ```

3. **访问服务**
   服务启动后，打开浏览器访问：

   ```
   http://localhost:8080
   ```

### 常用运维命令

- **查看日志**:
  ```bash
  docker-compose logs -f
  ```

- **停止服务**:
  ```bash
  docker-compose down
  ```

- **重新构建**:
  若修改了代码，需强制重新构建镜像：
  ```bash
  docker-compose up -d --build --force-recreate
  ```

## 本地开发

如果您希望在本地进行代码修改或调试：

1. 安装 Node.js 依赖:
   ```bash
   npm install
   ```

2. 启动开发服务器 (Vite):
   ```bash
   npm run dev
   ```
   访问 `http://localhost:3000`。

3. 构建生产版本:
   ```bash
   npm run build
   ```

## API 模拟

在应用的“Signer Tool”页面，您可以模拟标准的 JSON-RPC 请求，例如：

- `eth_getBalance`
- `eth_signTransaction`
- `personal_sign`
- `vault_importPrivateKey` (API 方式导入私钥)

详细载荷格式请参考应用内的 **API Docs** 页面。
