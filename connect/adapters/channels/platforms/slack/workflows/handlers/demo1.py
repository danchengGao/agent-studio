from openjiuwen.core.common.logging import logger


def demo1_handler(ack, respond, command):
    """Demo listener 1 - /demo1"""
    ack()
    message = "✅ Demo 1 Will be triggered here"
    logger.info(message)
    respond(message)
