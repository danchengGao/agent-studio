from openjiuwen.core.common.logging import logger


def demo2_handler(ack, respond, command):
    """Demo listener 2 - /demo2"""
    ack()
    message = "🚀 Demo 2 Will be triggered here"
    logger.info(message)
    respond(message)
