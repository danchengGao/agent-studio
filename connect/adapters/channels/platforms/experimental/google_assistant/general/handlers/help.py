HELP_TEXT = """OpenJiuwen Google Assistant — Available Commands

Authentication:
  Say login to log in to the backend.
  Say logout to log out.
  Say status to check your login status.
  Say cancel to cancel any active operation.

Workflows:
  Say workflows to list all workflows.
  Say workflows search followed by a keyword to search.
  Say workflow execute followed by an ID to run a workflow.
  Say workflow skip to skip an optional parameter.
  Say workflow cancel to cancel parameter collection.

Agents:
  Say agents to list all agents.
  Say agents search followed by a keyword to search.
  Say agent execute followed by an ID and your message for a single reply.
  Say agent start followed by an ID to start a chat session.
  Say agent end to finish the chat.

Say help to hear this message again.
"""


async def handle_help(user_id, say, user_data):
    await say(HELP_TEXT)
