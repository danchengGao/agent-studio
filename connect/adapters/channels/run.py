import sys
import importlib
import traceback

from openjiuwen.core.common.logging import logger

HELP = """
OpenJiuwen Channels Runner
===========================
Launches any platform adapter by name.

  python -m connect.adapters.channels.run <platform> [args...]
  python -m connect.adapters.channels.run <platform> --help    ← platform-specific help
  python -m connect.adapters.channels.run --help               ← this message

Production-Ready Platforms (stable, tested, ready for production):
  cli               Terminal CLI           (stdin/stdout)
  email             Email bot              (IMAP polling + SMTP replies, stdlib only)
  telegram          Telegram bot           (long polling, no public URL needed)
  slack             Slack app              (Socket Mode, no public URL needed)
  webhook           FastAPI REST adapter   (stateless HTTP, any external system)

Experimental Platforms (functional but under development):
  wechat            WeChat Official Account bot (webhook, requires public URL)
  discord           Discord bot            (WebSocket gateway, no public URL needed)
  whatsapp          WhatsApp Business API  (webhook, requires public URL)
  teams             Microsoft Teams bot    (webhook, requires public URL)
  messenger         Facebook Messenger bot (webhook, requires public URL)
  github            GitHub bot             (slash commands in issue/PR comments, requires public URL)
  google_assistant  Google Assistant       (Actions SDK v3 fulfillment webhook)
  twilio            Twilio SMS             (webhook, requires public URL)
  alexa             Amazon Alexa skill     (fulfillment webhook, requires public URL)

For platform-specific help and setup instructions:
  python -m connect.adapters.channels.run <platform> --help
  channels/platforms/<platform>/SETUP.md (production platforms)
  channels/platforms/experimental/<platform>/SETUP.md (experimental platforms)
"""


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'):
        logger.info(HELP)
        return

    platform = sys.argv[1]
    remaining = sys.argv[2:]

    # Use __package__ to construct absolute import path that works from any working directory
    # __package__ will be 'connect.adapters.channels' when this module is run
    base_package = __package__ or 'connect.adapters.channels'

    # List of production-ready platforms (located directly in platforms/)
    production_platforms = {'cli', 'email', 'telegram', 'slack', 'webhook'}

    # Determine the launcher module path based on platform type
    if platform in production_platforms:
        launcher_module_path = f'{base_package}.platforms.{platform}.launcher'
    else:
        # Experimental platforms are in platforms/experimental/
        launcher_module_path = f'{base_package}.platforms.experimental.{platform}.launcher'

    try:
        launcher = importlib.import_module(launcher_module_path)
    except ModuleNotFoundError as e:
        logger.error(f"Error: Platform '{platform}' not found.")
        logger.error(f"  Module path attempted: {launcher_module_path}")
        logger.error(f"  Details: {e}")
        logger.error(f"\nRun `python -m connect.adapters.channels.run --help` to see available platforms.")
        return
    except ImportError as e:
        logger.error(f"Error: Failed to import launcher for platform '{platform}'.")
        logger.error(f"  Module path: {launcher_module_path}")
        logger.error(f"  Details: {e}")
        logger.error(f"\nThe platform exists but has import errors. Check the launcher module for issues.")
        return
    except Exception as e:
        logger.error(f"Error: Unexpected error loading platform '{platform}'.")
        logger.error(f"  Module path: {launcher_module_path}")
        logger.error(f"  Exception type: {type(e).__name__}")
        logger.error(f"  Details: {e}")
        logger.error("\nFull traceback:")
        traceback.print_exc()
        return

    # Verify the launcher has a main() function
    if not hasattr(launcher, 'main'):
        logger.error(f"Error: Launcher module for platform '{platform}' is missing a main() function.")
        logger.error(f"  Module path: {launcher_module_path}")
        logger.error(f"  Expected: {launcher_module_path}.main()")
        return

    # Strip the platform name so each launcher sees its own args at sys.argv[1:].
    # Each launcher handles --help itself:
    #   - argparse launchers: argparse catches -h/--help automatically
    #   - positional-arg launchers (telegram, slack, discord): explicit check in main()
    sys.argv = [sys.argv[0]] + remaining
    launcher.main()


if __name__ == '__main__':
    main()
