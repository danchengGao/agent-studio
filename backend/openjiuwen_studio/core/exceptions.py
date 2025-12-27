class ModelConfigNotFoundError(Exception):
    """模型配置不存在异常"""
    pass


class ModelConfigNameExistsError(Exception):
    """模型配置名称已存在异常"""
    pass


class ValidationError(Exception):
    """数据验证失败异常"""
    pass


class ModelTestError(Exception):
    """模型测试失败异常"""
    pass

class ModelApiKeyDecryptError(Exception):
    """模型api key解密失败异常"""
    pass

class EmbeddingModelInUseError(Exception):
    """Embedding 模型正在被知识库使用异常"""
    pass