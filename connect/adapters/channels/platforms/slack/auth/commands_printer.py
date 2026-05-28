from .commands import LOGIN, LOGOUT, STATUS, CANCEL

SECTIONS = [
    ("🔐 Authentication", [
        ("/" + LOGIN, "Login to OpenJiuwen backend"),
        ("/" + LOGOUT, "Logout"),
        ("/" + STATUS, "Check login status"),
        ("/" + CANCEL, "Cancel current operation"),
    ]),
]
