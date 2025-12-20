from typing import Any

from openjiuwen.core.component.base import WorkflowComponent
from openjiuwen.core.graph.executable import Input, Output
from openjiuwen.core.runtime.base import ComponentExecutable
from openjiuwen.core.runtime.runtime import Runtime


class EmptyComponent(ComponentExecutable, WorkflowComponent):
    def __init__(self) -> None:
        super().__init__()

    async def invoke(self, inputs: Input, runtime: Runtime, context: Any) -> Output:
        return inputs
