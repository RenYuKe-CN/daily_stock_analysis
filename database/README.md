# 数据库 Schema

## 文件说明

| 文件 | 说明 |
|---|---|
| `schema_mysql.sql` | MySQL 完整建表 DDL（23 张表，含索引与外键）。可直接 `mysql -u root -p < schema_mysql.sql` 执行。 |

## 使用方式

### 全新部署

```bash
# 创建数据库并建表
mysql -u root -p < database/schema_mysql.sql
```

### 已有 SQLite 数据的迁移

```bash
# 1. 先创建 MySQL 表
mysql -u root -p < database/schema_mysql.sql

# 2. 配置 .env
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=dsa

# 3. 启动服务（自动创建默认管理员 admin/admin123 和默认角色）
python main.py --webui-only
```

## 注意事项

- 默认引擎为 InnoDB，字符集 utf8mb4
- `schema_mysql.sql` 由 SQLAlchemy 自动生成，每次模型变更后通过 `python -c "from src.storage import Base; Base.metadata.create_all(engine)"` 更新
- 生产环境请务必修改默认管理员密码
