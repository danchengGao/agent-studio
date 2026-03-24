# clients/deepsearch_http.py
import json
import logging
from typing import AsyncGenerator, Optional, Dict, Any, List, Tuple
import httpx
from openjiuwen_studio.core.config import settings
from openjiuwen_studio.core.common.status_code import StatusCode
from openjiuwen_studio.core.common.exceptions import DeepSearchClientError

logger = logging.getLogger(__name__)


class LazyDeepSearchHttpClient:
    """
    通用的、懒加载的 DeepSearch Agent HTTP 客户端。
    支持任意 GET/POST，流式/非流式，由调用方指定。
    """
    _instance: Optional["LazyDeepSearchHttpClient"] = None
    _client: Optional[httpx.AsyncClient] = None
    _initialized: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def _initialize(self) -> bool:
        try:
            if not settings.deepsearch_agent_host or not settings.deepsearch_agent_port:
                raise ValueError("DeepSearch agent host/port not configured")

            base_url = f"http://{settings.deepsearch_agent_host}:{settings.deepsearch_agent_port}"
            self._client = httpx.AsyncClient(
                base_url=base_url,
                timeout=httpx.Timeout(
                    timeout=3600.0,
                    connect=10.0
                ),
                limits=httpx.Limits(max_connections=50),
                follow_redirects=True,
                verify=False
            )

            try:
                resp = await self._client.get("/", timeout=5.0)
                resp.raise_for_status()
            except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as ex:
                raise RuntimeError(f"DeepSearch service unreachable: {ex}") from ex

            self._initialized = True
            logger.info(f"DeepSearch HTTP client ready. Base URL: {base_url}")
            return True
        except Exception as e:
            self._client = None
            self._initialized = False
            logger.error(f"Failed to initialize DeepSearch HTTP client: {e}")
            raise DeepSearchClientError(
                error_code=StatusCode.TASK_SPACE_THIRDPARTY_CLIENT_ERROR.code,
                message=StatusCode.TASK_SPACE_THIRDPARTY_CLIENT_ERROR.errmsg.format(msg=str(e))
            ) from e

    async def request(
        self,
        method: str,
        url: str,
        *,
        jsons: Any = None,
        params: Dict[str, Any] = None,
        headers: Dict[str, str] = None
    ):
        """通用 HTTP 请求方法"""
        if not self._initialized or self._client is None:
            await self._initialize()
        try:
            resp = await self._client.request(method, url, json=jsons, params=params, headers=headers)
            resp.raise_for_status()
            return resp
        except httpx.HTTPStatusError:
            # Let HTTP errors bubble up so caller can handle them meaningfully
            raise
        except Exception as e:
            # 可选：重置状态，允许下次重试
            self._client = None
            self._initialized = False
            raise RuntimeError(f"DeepSearch service call failed: {e}") from e

    async def request_multipart(
        self,
        method: str,
        url: str,
        *,
        data: Optional[Dict[str, Any]] = None,
        files: Optional[List[Tuple[str, Tuple[str, bytes, str]]]] = None,
    ):
        """发送 multipart/form-data 请求（用于文件上传）"""
        if not self._initialized or self._client is None:
            await self._initialize()
        try:
            resp = await self._client.request(method, url, data=data, files=files)
            resp.raise_for_status()
            return resp
        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            self._client = None
            self._initialized = False
            raise RuntimeError(f"DeepSearch service call failed: {e}") from e

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
            self._initialized = False

    async def stream(self, method: str, url: str, **kwargs):
        """用于流式请求，返回异步上下文管理器"""
        if not self._initialized or self._client is None:
            await self._initialize()
        return self._client.stream(method, url, **kwargs)


class DeepSearchAgentClient:
    """
    业务层 client，封装具体 API 调用。
    清晰、可读、可测试。
    """

    def __init__(self):
        self._http = LazyDeepSearchHttpClient()

    async def run_deepsearch_stream(self, payload: Dict[str, Any]) -> AsyncGenerator[str, None]:
        """流式运行深度搜索"""
        async with (await self._http.stream("POST", "/api/v1/agent/deepsearch/run", json=payload)) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                yield line

    async def import_templates(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """导入模板"""
        resp = await self._http.request("POST", "/api/v1/agent/deepsearch/template", jsons=payload)
        return resp.json()

    async def list_templates(self, space_id: str) -> list:
        """列出模板"""
        resp = await self._http.request("GET", f"/api/v1/agent/deepsearch/template/{space_id}")
        return resp.json()

    async def get_templates(self, space_id: str, template_id: int) -> list:
        """列出模板"""
        resp = await self._http.request("GET", f"/api/v1/agent/deepsearch/template/{space_id}/{template_id}")
        return resp.json()

    async def delete_templates(self, space_id: str, template_id: int) -> list:
        """列出模板"""
        resp = await self._http.request("DELETE", f"/api/v1/agent/deepsearch/template/{space_id}/{template_id}")
        return resp.json()

    async def update_templates(self, payload: Dict[str, Any]) -> list:
        """列出模板"""
        resp = await self._http.request("PUT", "/api/v1/agent/deepsearch/template", jsons=payload)
        return resp.json()

    async def create_web_searchs(self, payload: Dict[str, Any]) -> list:
        """创建web搜索引擎"""
        resp = await self._http.request("POST", "/api/v1/agent/deepsearch/web_search/", jsons=payload)
        return resp.json()

    async def get_web_search_engines(self, space_id: str, web_search_engine_id: int) -> list:
        """列出模板"""
        resp = await self._http.request("GET",
                                        f"/api/v1/agent/deepsearch/web_search/{space_id}/{web_search_engine_id}")
        return resp.json()

    async def get_web_search_engine_lists(self, space_id: str) -> list:
        """列出模板"""
        resp = await self._http.request("GET", f"/api/v1/agent/deepsearch/web_search/{space_id}")
        return resp.json()

    async def delete_web_search_engines(self, space_id: str, web_search_engine_id: int) -> list:
        """删除模板"""
        resp = await self._http.request("DELETE",
                                        f"/api/v1/agent/deepsearch/web_search/{space_id}/{web_search_engine_id}")
        return resp.json()

    async def update_web_search_engines(self, payload: Dict[str, Any]) -> list:
        """更新模板"""
        resp = await self._http.request("PUT", "/api/v1/agent/deepsearch/web_search/", jsons=payload)
        return resp.json()

    async def access_web_search_engines(self, space_id: str, web_search_engine_id: int, query: str):
        """测试模板"""
        resp = await self._http.request("POST",
                                        f"/api/v1/agent/deepsearch/web_search/{space_id}/{web_search_engine_id}",
                                        jsons=query)
        return resp.json()

    async def report_converts(self, payload: Dict[str, Any]) -> list:
        """列出模板"""
        resp = await self._http.request("POST", "/api/v1/agent/deepsearch/reports/convert", jsons=payload)
        return resp.json()

    # ---------- DeepSearch 知识库 API（/api/kb） ----------

    async def create_knowledge_base(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """创建 DeepSearch 知识库，返回响应 body"""
        resp = await self._http.request("POST", "/api/kb/create", jsons=payload)
        return resp.json()

    async def update_knowledge_base(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """更新 DeepSearch 知识库（含 embed_model_config、llm_config 等 config）"""
        resp = await self._http.request("POST", "/api/kb/update", jsons=payload)
        return resp.json()

    async def delete_knowledge_base(self, space_id: str, ds_kb_id: str) -> Dict[str, Any]:
        """删除 DeepSearch 知识库"""
        resp = await self._http.request(
            "POST", "/api/kb/delete", jsons={"space_id": space_id, "kb_id": ds_kb_id}
        )
        return resp.json()

    async def upload_knowledge_base_files(
        self,
        space_id: str,
        ds_kb_id: str,
        files: List[Tuple[str, bytes, str]],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """上传文件到 DeepSearch 知识库。files: [(filename, file_bytes, content_type), ...]"""
        data = {"space_id": space_id, "kb_id": ds_kb_id}
        if metadata is not None:
            data["metadata"] = json.dumps(metadata)
        file_parts = [
            ("files", (fn, content, ct)) for fn, content, ct in files
        ]
        resp = await self._http.request_multipart(
            "POST", "/api/kb/upload", data=data, files=file_parts
        )
        return resp.json()

    async def process_knowledge_base_documents(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """触发 DeepSearch 知识库文档处理/建索引"""
        resp = await self._http.request("POST", "/api/kb/process", jsons=payload)
        return resp.json()

    async def list_knowledge_bases(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """查询 DeepSearch 知识库列表（含索引状态等）"""
        resp = await self._http.request("POST", "/api/kb/list", jsons=payload)
        return resp.json()

    async def list_embedding_configs(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """查询 DeepSearch 侧当前空间可用的 Embedding 配置（供同步时选择嵌入模型）"""
        resp = await self._http.request("POST", "/api/kb/embedding-configs/list", jsons=payload)
        return resp.json()

    async def list_documents(
        self,
        space_id: str,
        kb_id: str,
        page: int = 1,
        size: int = 10,
    ) -> Dict[str, Any]:
        """查询 DeepSearch 知识库文档列表（用于仅存在于 DeepSearch 的知识库，如同步产生的 deepsearch_xxx）"""
        resp = await self._http.request(
            "POST",
            "/api/kb/documents/list",
            jsons={"space_id": space_id, "kb_id": kb_id, "page": page, "size": size},
        )
        return resp.json()

    async def get_document_status(
        self,
        space_id: str,
        kb_id: str,
        doc_id_list: list,
    ) -> Dict[str, Any]:
        """批量查询 DeepSearch 知识库文档状态（用于同步后的知识库文档状态展示）"""
        resp = await self._http.request(
            "POST",
            "/api/kb/documents/status",
            jsons={
                "space_id": space_id,
                "kb_id": kb_id,
                "doc_id_list": doc_id_list,
            },
        )
        return resp.json()

    async def delete_documents(
        self,
        space_id: str,
        kb_id: str,
        document_ids: list,
    ) -> Dict[str, Any]:
        """批量删除 DeepSearch 知识库文档（用于更新同步前清空 DS 侧文档以实现覆盖）"""
        resp = await self._http.request(
            "POST",
            "/api/kb/documents/delete",
            jsons={"space_id": space_id, "kb_id": kb_id, "document_ids": document_ids},
        )
        return resp.json()

    async def task_progress(
        self,
        space_id: str,
        kb_id: str,
        task_id: str,
    ) -> Dict[str, Any]:
        """查询 DeepSearch 知识库文档处理任务进度"""
        resp = await self._http.request(
            "POST",
            "/api/kb/task/progress",
            jsons={"space_id": space_id, "kb_id": kb_id, "task_id": task_id},
        )
        return resp.json()
