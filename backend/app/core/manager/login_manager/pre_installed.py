import json
import os
import uuid

from app.core.database import SessionLocal, milliseconds
from openjiuwen.core.common.logging import logger

from app.models.workflow import WorkflowBaseDBPd
from app.models.agent import AgentBaseDBPd
from app.core.manager.repositories.workflow_repository import workflow_repository
from app.core.manager.repositories.agent_repository import agent_repository
import app.core.manager.convertor.workflow as convert


def pre_install(space_id: str):
    db = SessionLocal()
    try:
        create_examples(space_id)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[Template] Error during pre-installation: {str(e)}")
    finally:
        db.close()


def _read_json(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
            result = json.loads(content)
            return result
    except Exception as e:
        logger.error(f"[Template] Error reading template file: {str(e)}, path: {path}")
        return {}


def create_examples(space_id: str):
    base_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../../examples")
    )

    current_time = milliseconds()

    # create agent template
    travel_agent = _read_json(os.path.join(base_dir, "agent.travel.template.json"))
    travel_agent_id = str(uuid.uuid4())
    # 从模板读取系统提示词到configs
    _ag_configs = travel_agent.get("configs") or {}
    _ag_pt = travel_agent.get("prompt_template") or []
    if isinstance(_ag_pt, list):
        for _m in _ag_pt:
            if (_m or {}).get("role") == "system" and (_m or {}).get("content"):
                _ag_configs.setdefault("system_prompt", _m.get("content"))
                break

    travel_agent = AgentBaseDBPd(
        agent_id=travel_agent_id,
        agent_name=travel_agent.get("agent_name") or "模板智能体",
        space_id=space_id,
        description=travel_agent.get("description") or "这是一个示例智能体，可用于快速上手。",
        agent_type=travel_agent.get("agent_type") or "react",
        icon=travel_agent.get("icon") or "🤖",
        edit_mode="manual",
        workflows=[],
        model=None,
        prompt_template_name=travel_agent.get("prompt_template_name") or "",
        prompt_template=travel_agent.get("prompt_template") or None,
        auto_generated_prompt=travel_agent.get("auto_generated_prompt") or "",
        configs=_ag_configs,
        plugins=[],
        prompt_tuning=travel_agent.get("prompt_tuning") or {},
        triggers=travel_agent.get("triggers") or [],
        knowledge=travel_agent.get("knowledge") or [],
        constraint={"reserved_max_chat_rounds": 10, "max_iteration": 5},
        opening_remarks="您好！我是您的智能助手，很高兴为您服务。请问有什么可以帮助您的吗？",
        memory={},
        create_time=current_time,
        update_time=current_time,
    )
    agent_repository.create_agent_db(travel_agent)

