import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent))
from sqlalchemy import create_engine, text
from openjiuwen.core.common.logging import logger
from app.models.db_fun_base import Base
from app.models.agent import AgentBaseDB, AgentPublishDB, AgentBaseDBPd, AgentPublishDBPd
from app.models.user import UserDB, SpaceDB, SpaceUserDB
from app.models.workflow import WorkflowBaseDB, WorkflowPublishDB, WorkflowBaseDBPd, WorkflowPublishDBPd
from sqlalchemy.orm import sessionmaker

# 替换为你的MySQL数据库信息
USERNAME = 'root'
PASSWORD = ''
HOST = 'localhost'  # 例如：'localhost' 或 '127.0.0.1'
PORT = '33306'  # 通常是 3306
DATABASE = 'testdb'

# 创建连接引擎
# engine = create_engine(f'mysql+pymysql://{USERNAME}:{PASSWORD}@{HOST}:{PORT}/{DATABASE}')

engine = create_engine(f'mysql+mysqldb://{USERNAME}:{PASSWORD}@{HOST}:{PORT}/{DATABASE}',
                        pool_size=10,       # 连接池大小
                        max_overflow=20,    # 超过连接池大小外最多创建的连接
                        pool_timeout=30,
                        echo=True           # 可选：打印 SQL 日志
                        )
Base.metadata.create_all(engine)

Session = sessionmaker(bind=engine,
                       autoflush=True,
                       autocommit=False,
                       expire_on_commit=True)
session = Session()


def get_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()


# -------------------- 快速测试 --------------------
if __name__ == "__main__":
    agent_dict = {"space_id": "1234", "agent_id": "agent-001",
        "agent_version": "draft", "other": "others", "create_time": 123}
    agent_db = AgentBaseDB.from_dict(agent_dict)
    session.query(AgentBaseDB).filter_by(agent_id="agent-001").delete()
    session.add(agent_db)
    session.commit()

    logger.info(agent_db)
    agent_publish_dict = {"space_id": "1234", "agent_id": "agent-001", "agent_version": "v1.0.0", "other": "others"}
    agent_publish_db = AgentPublishDB.from_dict(agent_publish_dict)
    session.query(AgentPublishDB).filter_by(agent_id="agent-001").delete()
    session.add(agent_publish_db)
    session.commit()
    logger.info(agent_publish_db)

    workflow_dict = {"space_id": "1234", "workflow_id": "wf-001", "workflow_version": "draft", "name": "test_name", 
                     "key1": "value1", "key2": "value2",
                     "schema": "{\"node\":dfkajfkjdkfhajdfhda jhfahdfjahdjfhlahkdfjhajdhfjahfjahdfjadlkfjkldhafjadklfdhfjlkhfaldfhafjhfhadjafhjdhfjhf}"}
    workflow_db = WorkflowBaseDB.from_dict(workflow_dict)
    session.query(WorkflowBaseDB).filter_by(workflow_id="wf-001").delete()
    session.add(workflow_db)
    session.commit()
    logger.info(workflow_db)
    workflow_publish_dict = {"space_id": "1234", "workflow_id": "wf-001", "workflow_version": "v1.0.0", "desc": "测试一下"}
    workflow_publish_db = WorkflowPublishDB.from_dict(workflow_publish_dict)
    session.query(WorkflowPublishDB).filter_by(workflow_id="wf-001").delete()
    session.add(workflow_publish_db)
    session.commit()
    
    user_dict = {"user_id_str": "test_user", "others": {"key1": "value1", "key2": "value2"}}
    user_db = UserDB.from_dict(user_dict)
    session.query(UserDB).filter_by(user_id_str="test_user").delete()
    session.add(user_db)
    session.commit()
    logger.info(user_db)

    space_dict = {"space_id": "1234", "user_id_str": "test", "description": "this is a test space"}
    space_db = SpaceDB.from_dict(space_dict)
    session.query(SpaceDB).filter_by(space_id="1234").delete()
    session.add(space_db)
    session.commit()
    logger.info(space_db)

    space_user_dict = {"space_id": "1234", "user_id_str": "test"}
    space_user_db = SpaceUserDB.from_dict(space_user_dict)
    session.query(SpaceUserDB).filter_by(space_id="1234").delete()
    session.add(space_user_db)
    session.commit()
    logger.info(space_user_db)

    a = 0

