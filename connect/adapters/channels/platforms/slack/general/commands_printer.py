from .commands import START, HEALTH, HELP

SECTIONS = [
    ("ℹ️ Other Commands", [
        ("/" + START, "Welcome message"),
        ("/" + HEALTH, "Check backend status"),
        ("/" + HELP, "Show this help message"),
    ]),
]
