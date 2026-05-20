from .commands import START, HELP, HEALTH

SECTIONS = [
    ("ℹ️ Other Commands", [
        ("/" + START, "Welcome message"),
        ("/" + HEALTH, "Check backend status"),
        ("/" + HELP, "Show this help message"),
    ]),
]
