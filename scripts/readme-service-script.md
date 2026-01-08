# 脚本概述

scripts/service.sh 是 Jiuwen Agent Studio 一站式部署工具，支持多架构交叉编译（如在 AMD 架构平台编译 ARM 架构镜像）、配置集中化管理，可一键完成服务的编译、部署、卸载等操作，操作简洁且高效。

## 部署目录说明

```bash
scripts/
├── .env                            # 脚本运行的部署相关的环境变量文件（自动生成）
├── .env.custom                     # 用户自定义变量覆盖文件（用户手动修改，优先级最高，用于覆盖默认变量）
├── .env.deploy.default             # 部署相关默认变量文件（禁止修改）
├── .env.runtime.default            # 运行时相关默认变量文件（禁止修改）
├── .envs/                          # 多实例服务变量文件归档目录（自动生成）
│   ├── env.deploy.<五位随机串>     # 某实例的部署变量备份文件（记录该实例的部署配置）
│   ├── env.runtime.<五位随机串>    # 某实例的运行时变量文件（直接挂载到容器的环境变量文件）
│   └── ...                         # 其他服务实例的变量文件
├── .ssl-dirs/                      # 多实例前端服务SSL证书存储目录（自动生成）
│   ├── ssl-<五位随机串>/           # 某前端服务实例的SSL证书目录（自动生成）
│   │   ├── certificate.crt         # SSL公钥证书（供Nginx配置HTTPS）（自动生成）
│   │   └── private.key             # SSL私钥文件（禁止泄露）（自动生成）
│   └── ...                         # 其他前端实例的证书目录
├── conf/                           # 服务配置模板与生成后的配置文件目录
│   ├── config.json                 # Agent Studio配置文件
│   ├── config.yaml                 # Agent Studio配置文件
│   ├── docker-jiuwen.template.yml  # Agent Studio主服务容器模板文件
│   ├── docker-jiuwen.yml           # 当前实例的Agent Studio容器最终配置文件（自动生成）
│   ├── docker-milvus.template.yml  # Milvus向量库容器模板文件
│   ├── docker-milvus.yml           # 当前实例的Milvus容器最终配置文件（自动生成）
│   ├── docker-mysql.template.yml   # MySQL数据库容器模板文件
│   ├── docker-mysql.yml            # 当前实例的MySQL容器最终配置文件（自动生成）
│   ├── docker-sandbox.template.yml # Sandbox沙箱容器模板文件
│   ├── docker-sandbox.yml          # 当前实例的Sandbox容器最终配置文件（自动生成）
│   ├── docker-plugin.template.yml  # Plugin Server插件服务容器模板文件
│   ├── docker-plugin.yml           # 当前实例的Plugin Server容器最终配置文件（自动生成）
│   ├── nginx.template.conf         # Nginx通用配置模板
│   └── .nginx-files/               # 多实例Nginx配置文件目录（自动生成）
│       ├── nginx.conf-<五位随机串> # 某前端实例的Nginx最终配置文件（自动生成）
│       └── ...                     # 其他实例的Nginx配置文件（自动生成）
├── examples/                       # 后端业务示例配置目录
├── logs/                           # 脚本运行日志与服务日志归档目录（自动生成）
├── readme-service-script.md        # 脚本使用直指导文档
├── service.sh                      # 部署脚本核心入口（接收用户指令，调度其他子脚本）
├── args_handler.sh                 # 命令行参数解析脚本
├── common.sh                       # 通用工具函数脚本
├── gen_ssl.sh                      # SSL证书生成脚本
├── prompt_handler.sh               # 交互式提示脚本
├── vars_handler.sh                 # 变量处理核心脚本
├── container_handler.sh            # 容器管理脚本
├── global_vars.sh                  # 全局变量定义脚本
├── envfile_handler.sh              # 环境文件处理脚本
├── ports_handler.sh                # 端口管理脚本
└── template_handler.sh             # 模板渲染脚本
```

本脚本支持多实例部署，所有配置按「五位随机串」区分不同服务实例；

脚本运行依赖环境变量配置：.env.deploy.default 和.env.runtime.default 为默认环境变量文件（内置基础默认值，请勿修改）；如需自定义配置，可在 .env.custom 中配置变量以覆写默认值；

对于启停(up/down)功能，无需拉取完整项目代码，仅需下载 scripts 目录即可执行启停操作。

服务启动时，系统会自动整合配置（.env.deploy.default + .env.custom），并生成最终生效的 .env 文件（该文件是当前服务运行的核心配置）, 并将该.env 文件备份成.envs/env.deploy.<五位随机串>（该文件是对应服务启动、运行和重启的核心配置，请勿删除）。 同时，也会整合配置（.env.runtime.default + .env.custom），并生成.envs/env.runtime.<五位随机串>，此文件会作为前后端容器的环境变量文件。

## 核心功能

- 一键启停 /卸载 Jiuwen Agent Studio 完整容器集群（包含 MySQL、Milvus 等依赖服务）
- 独立启停 / 卸载 指定的一个或多个组件服务（MySQL、Milvus、Plugin Server、 Sandbox Server、 JiuWen 组件服务）

注意，启动时，自动创建服务依赖的网络、数据卷；停止时，只是停掉容器，并不删除容器；卸载时，会删除容器、集群网络，但不会删除数据卷；如需清理数据，需手动删除对应数据卷。

```
#
# 进入脚本目录
cd scripts

# 一键启动全套全新服务：请根据实际部署环境需求，在 .env.custom 文件中配置需自定义的变量
./service.sh up

# 如需重启已有服务
./service.sh up -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>

# 一键停止.env文件指定的服务（最近一次启动的服务）
./service.sh stop

# 一键停止指定的服务
./service.sh stop down -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>

# 一键卸载.env文件指定的服务（停止并删除容器）（最近一次启动的服务）
./service.sh down

# 一键卸载指定的服务（停止并删除容器）
./service.sh down -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
```

## 独立启停/卸载指定的一个或多个组件服务

```
# 进入脚本目录
cd scripts

# 启动指定的某个组件服务（MYSQL/MILVUS/JIUWEN/PLUGIN)：请根据实际部署环境需求，在 .env.custom 文件中配置需自定义的变量
./service.sh mysql up
./service.sh milvus up
./service.sh jiuwen up
./service.sh plugin up
./service.sh sandbox up

# 如需重启已有组件服务
./service.sh mysql up -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh milvus up -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh jiuwen up -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh plugin up -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh sandbox up -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>

# 一键停止.env文件指定的组件服务（最近一次启动的组件服务）
./service.sh mysql stop
./service.sh milvus stop
./service.sh jiuwen stop
./service.sh plugin stop
./service.sh sandbox stop

# 一键停止指定的组件服务
./service.sh mysql stop -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh milvus stop -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh jiuwen stop -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh plugin stop -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh sandbox stop -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>

# 一键卸载.env文件指定的组件服务（停止并删除容器）
./service.sh mysql down
./service.sh milvus down
./service.sh jiuwen down
./service.sh plugin down
./service.sh sandbox down

# 一键卸载指定的组件服务（停止并删除容器）
./service.sh mysql down -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh milvus down -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh jiuwen down -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh plugin down -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh sandbox down -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
```

除此之外，可以支持一次启动/停止/卸载任意数量的组件比如：

```
./service.sh milvus mysql plugin jiuwen up
./service.sh milvus plugin sandbox jiuwen down
./service.sh milvus mysql plugin sandbox jiuwen stop

./service.sh milvus mysql plugin jiuwen up -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh milvus plugin sandbox jiuwen down -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>
./service.sh milvus mysql plugin sandbox jiuwen stop -f <之前启动时脚本自动备份的配置文件：.envs/env.deploy.<五位随机串>文件>

```

# 附录

## 变量说明

```

# ----------------------- MYSQL 配置 ------------------------

# 启动 MYSQL 容器使用的 image（默认无需设置，确保对应的镜像已存在或可正常拉取）

MYSQL_IMAGE=<MySQL 镜像地址，如 mysql:8.4.5>

# MYSQL 服务名称（Docker Compose 中唯一服务标识，避免与其他服务冲突）

MYSQL_SERVICE=<自定义服务名称，如需设置请保证唯一，如 mysql>

# MYSQL 容器名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

MYSQL_DOCKER=<自定义容器名称，如需设置请保证唯一，如 jiuwen-mysql>

# MYSQL 服务对外暴露的端口（默认无需设置，部署脚本会自动分配未占用端口；如需设置，请更改此变量）

MYSQL_HOST_PORT=<自定义端口号，如需设置请保证不冲突，如 3307>

# MYSQL 使用的卷名（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

MYSQL_VOLUME=<数据卷名称，如需设置请保证唯一，如 mysql-data>

# 数据库配置（如果使用本脚本部署的 MYSQL 容器，默认无需设置，部署脚本会自动产生匹配值，如果使用外部 MYSQL，请更改这几个变量）

DB_HOST=<MySQL 服务地址，如 mysql>
DB_PORT=<MySQL 服务端口，如 3306>
DB_USER=<MySQL 数据库用户名，如 root>
DB_PASSWORD=<MySQL 数据库用户名${DB_USER}使用的密码>
OPS_DB_NAME=<MySQL 运维数据库名，如 jiuwen_ops>
AGENT_DB_NAME=<MySQL Agent 核心数据库名，如 jiuwen_agent>
DB_ROOT_PASSWORD=<MySQL 数据库 root 用户的密码，如果是本部署脚本拉起的 MYSQL 容器，值为 root>

# ----------------------- ETCD 配置 ------------------------

# 启动 ETCD 容器使用的 image（默认无需设置，确保对应的镜像已存在或可正常拉取）

ETCD_IMAGE=<ETCD 镜像地址，如 bitnami/etcd:3.5.18>

# ETCD 服务名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

ETCD_SERVICE=<服务名称，如需设置请保证唯一，如 etcd>

# ETCD 容器名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

ETCD_DOCKER=<容器名称，如需设置请保证唯一，如 jiuwen-milvus-etcd>

# ETCD 服务对外暴露的端口（默认无需设置，部署脚本会自动分配未占用端口；如需设置，请更改此变量）

ETCD_HOST_PORT=<自定义端口号，如需设置请保证不冲突，如 2379>

# ETCD 使用的卷名（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

ETCD_VOLUME=<数据卷名称，如需设置请保证唯一，如 etcd-data>

# ----------------------- MINIO 配置 ------------------------

# 启动 MINIO 容器使用的 image（默认无需设置，确保对应的镜像已存在或可正常拉取）

MINIO_IMAGE=<MINIO 镜像地址，如 minio/minio:RELEASE.2024-12-18T13-15-44Z>

# MINIO 服务名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

MINIO_SERVICE=<服务名称，如需设置请保证唯一，如 minio>

# MINIO 容器名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

MINIO_DOCKER=<容器唯一名称，如需设置请保证唯一，如 jiuwen-milvus-minio>

# MINIO 服务对外暴露的端口（默认无需设置，部署脚本会自动分配未占用端口；如需设置，请更改此变量）

MINIO_SERVICE_HOST_PORT=<自定义端口号，如需设置请保证不冲突，如 8129>

# MINIO 控制台对外暴露的端口（默认无需设置，部署脚本会自动分配未占用端口；如需设置，请更改此变量）

MINIO_CONSOLE_HOST_PORT=<自定义端口号，如需设置请保证不冲突，如 8130>

# MINIO 使用的卷名（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

MINIO_VOLUME=<数据卷名称，如需设置请保证唯一，如 minio-data>

# ----------------------- MILVUS 配置 ------------------------

# 启动 MILVUS 容器使用的 image（默认无需设置，但请确保你的机器上有这个镜像）

MILVUS_IMAGE=<Milvus 镜像地址，如 milvusdb/milvus:v2.6.2>

# MILVUS 服务名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

MILVUS_SERVICE=<服务名称，如需设置请保证唯一，如 milvus>

# MILVUS 容器名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

MILVUS_DOCKER=<容器唯一名称，如需设置请保证唯一，如 jiuwen-milvus-standalone>

# MILVUS 服务对外暴露的端口（默认无需设置，部署脚本会自动分配未占用端口；如需设置，请更改此变量）

MILVUS_HOST_PORT=<自定义端口号，如需设置请保证不冲突，如 8131>

# MILVUS 使用的数据卷名（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

MILVUS_VOLUME=<数据卷名称，如需设置请保证唯一，如 milvus-data>

# MILVUS 配置（如果使用本脚本部署的 MILVUS 容器，默认无需设置，部署脚本会自动产生匹配值，如果使用外部 MILVUS，请更改这几个变量）

MILVUS_HOST=<Milvus 服务地址，如 milvus>
MILVUS_PORT=<Milvus 服务端口，默认 19530>
MILVUS_COLLECTION_NAME=<向量集合名称，如 memory_vector>
MILVUS_TOKEN=<Milvus 认证 Token，Milvus 认证 Token，无认证需求则留空（或不配置该变量）>

# ----------------------- 前端配置 ------------------------

# 启动前端容器使用的 image（默认无需设置，如要设置，请确保对应的镜像已存在或可正常拉取）

FRONTEND_IMAGE=<前端镜像地址，如 studio-frontend:latest>

# FRONTEND 服务名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

FRONTEND_SERVICE=<服务名称，如需设置请保证唯一，如 frontend>

# FRONTEND 容器名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

FRONTEND_DOCKER=<容器唯一名称，如需设置请保证唯一，如 jiuwen-frontend>

# FRONTEND 服务对外暴露的端口（默认无需设置，部署脚本会自动分配未占用端口；如需设置，请更改此变量）

FRONTEND_HOST_PORT=<自定义端口号，如需设置请保证不冲突，如 3000>

# ----------------------- 后端配置 ------------------------

# 启动后端容器使用的 image（默认无需设置，如要设置，请确保对应的镜像已存在或可正常拉取）

BACKEND_IMAGE=<后端镜像地址，如 studio-backend:latest>

# BACKEND 服务名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

BACKEND_SERVICE=<服务名称，如需设置请保证唯一，如 backend>

# BACKEND 容器名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

BACKEND_DOCKER=<容器唯一名称，如需设置请保证唯一，如 jiuwen-backend>

# BACKEND 服务对外暴露的端口（默认无需设置，部署脚本会自动分配未占用端口；如需设置，请更改此变量）

BACKEND_HOST_PORT=<自定义端口号，如需设置请保证不冲突，如 8000>

# 提供 BACKEND 服务地址（如果使用本脚本部署的 BACKEND 服务，默认无需设置，部署脚本会自动产生匹配值，如果使用 BACKEND 服务，请更改这个变量）

VITE_API_PROXY_TARGET=<后端API地址，如http://backend:8000/>

# ----------------------- 插件服务配置 ------------------------

# 启动插件服务容器使用的 image（默认无需设置，如要设置，请确保对应的镜像已存在或可正常拉取）

PLUGIN_SERVER_IMAGE=<插件服务镜像地址，如 studio-plugin-server:latest>

# 插件服务名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

PLUGIN_SERVER_SERVICE=plugin-server

# 插件容器名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

PLUGIN_SERVER_DOCKER=jiuwen-plugin-server

# 插件服务对外暴露的端口（默认无需设置，部署脚本会自动分配未占用端口；如需设置，请更改此变量）

PLUGIN_SERVER_HOST_PORT=2030

# 提供插件服务的地址（如果使用本脚本部署的插件服务，默认无需设置，部署脚本会自动产生匹配值，如果使用外部插件服务，请更改这个变量）

VITE_PLUGIN_SERVICE_URL=<插件服务地址>

# ----------------------- SANDBOX 服务配置 ------------------------

# 启动 SANDBOX GATWAY 容器使用的 image（默认无需设置，如要设置，请确保对应的镜像已存在或可正常拉取）

SANDBOX_GATEWAY_IMAGE=studio-sandbox-gateway:latest

# SANDBOX GATWAY 服务名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

SANDBOX_GATEWAY_SERVICE=sandbox-gateway

# SANDBOX GATWAY 容器名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

SANDBOX_GATEWAY_DOCKER=jiuwen-sandbox-gateway

# SANDBOX GATWAY 服务对外暴露的端口（默认无需设置，部署脚本会自动分配未占用端口；如需设置，请更改此变量）

SANDBOX_GATEWAY_HOST_PORT=2031

# 提供 SANDBOX GATWAY 服务的地址（如果使用本脚本部署的 SANDBOX GATWAY 服务，默认无需设置，部署脚本会自动产生匹配值，如果使用外部 SANDBOX GATWAY 服务，请更改这个变量）

CODE_SANDBOX_URL=<SANDBOX GATWAY 服务地址>

# 启动 SANDBOX PYTHON SERVER 容器使用的 image（默认无需设置，如要设置，请确保对应的镜像已存在或可正常拉取）

PYTHON_SERVER_IMAGE=studio-python-server:latest

# SANDBOX PYTHON SERVER 服务名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

PYTHON_SERVER_SERVICE=python-server

# SANDBOX PYTHON SERVER 容器名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

PYTHON_SERVER_DOCKER=jiuwen-python-server

# SANDBOX PYTHON SERVER 服务对外暴露的端口（默认无需设置，部署脚本会自动分配未占用端口；如需设置，请更改此变量）

PYTHON_SERVER_HOST_PORT=2032

# 启动 SANDBOX JS SERVER 容器使用的 image（默认无需设置，如要设置，请确保对应的镜像已存在或可正常拉取）

JS_SERVER_IMAGE=studio-js-server:latest

# SANDBOX JS SERVER 服务名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

JS_SERVER_SERVICE=js-server

# SANDBOX JS SERVER 容器名称（默认无需设置，部署脚本会自动生成唯一名称，如需设置，请更改此变量）

JS_SERVER_DOCKER=jiuwen-js-server

# SANDBOX JS SERVER 服务对外暴露的端口（默认无需设置，部署脚本会自动分配未占用端口；如需设置，请更改此变量）

JS_SERVER_HOST_PORT=2033
```

