from .commands import LOGIN, LOGOUT, STATUS, CANCEL

SECTIONS = [
    ("🔐 Authentication", [
        (LOGIN, "Log in to the OpenJiuwen backend"),
        (LOGOUT, "Log out"),
        (STATUS, "Check your login status"),
        (CANCEL, "Cancel the current operation"),
    ]),
]
