from typing import Dict, Any


def get_workflow(client, workflow_id: str) -> Dict[str, Any]:
    return client.post('/workflows/canvas', data={
        'workflow_id': workflow_id,
        'space_id': client.space_id or '',
    })
