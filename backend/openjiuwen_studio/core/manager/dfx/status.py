from openjiuwen_studio.core.manager.repositories.workflow_repository import workflow_repository
from openjiuwen_studio.schemas.space import SpaceInfo, SpaceStatus, SpaceAWPQuery


def get_workflow_num_by_space(space_id: str) -> tuple:
    res = workflow_repository.workflow_list(SpaceAWPQuery(space_id=space_id, page=1, page_size=10000))
    workflow_tuples = []
    if not res.data:
        return (0, 0)
    for item in res.data['workflow_list']:
        if 'workflow_id' and 'update_time' in item:
            workflow_tuples.append((item['workflow_id'], item['update_time']))

    total_count = res.data.get('total', 0)
    if len(workflow_tuples) == 0:
        return (0, 0)
    latest_workflow_tuple = sorted(workflow_tuples, key=lambda x: x[1], reverse=True)[0]
    latest_workflow_id = latest_workflow_tuple[0]
    return (latest_workflow_id, total_count)


def get_space_status_by_id(space_info: SpaceInfo, space_id: str):
    workflow_status = get_workflow_num_by_space(space_id)
    space_info.status.workflow_num = workflow_status[1]
    space_info.status.recent_workflow = workflow_status[0]
