"""Create a RevOps user from the command line.

Usage
-----
    python scripts/create_user.py --email admin@revops.pro --name "Alex Admin" --role admin
    python scripts/create_user.py --email rep@revops.pro --name "Sam Rep" --role sales-executive
    python scripts/create_user.py --email temp@revops.pro --name "Temp User"   # random password

If ``--password`` is omitted a strong random password is generated and printed
once — there is no password reset flow, so copy it from the output.

Passwords are hashed with the same bcrypt helper the API uses
(``app.core.security.get_password_hash``) and stored through the same data-store
layer, so users created here can log in via ``/api/auth/login`` immediately.
"""
from __future__ import annotations

import argparse
import getpass
import os
import secrets
import sys

# Allow running as `python scripts/create_user.py` from the backend folder.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import data_store as ds  # noqa: E402

VALID_ROLES = ("admin", "manager", "sales-executive")


def generate_password(length: int = 16) -> str:
    """A random, shell-safe password with mixed case, digits and symbols."""
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_=+"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def prompt_password() -> str:
    """Read a hidden password, falling back to plain input when there is no TTY."""
    first = getpass.getpass("Password: ")
    if not first:
        raise SystemExit("Error: password cannot be empty.")
    if sys.stdin.isatty():
        second = getpass.getpass("Confirm password: ")
        if first != second:
            raise SystemExit("Error: passwords do not match.")
    return first


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a RevOps Pro user account.")
    parser.add_argument("--email", required=True, help="Login email address.")
    parser.add_argument("--name", required=True, help="Display name.")
    parser.add_argument(
        "--role",
        default="sales-executive",
        choices=VALID_ROLES,
        help="Role to assign (default: sales-executive).",
    )
    parser.add_argument(
        "--password",
        default=None,
        help="Password. Omit to generate a strong random one and print it.",
    )
    args = parser.parse_args()

    email = args.email.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise SystemExit(f"Error: '{args.email}' is not a valid email address.")

    if ds.get_user(email):
        raise SystemExit(f"Error: a user with email '{email}' already exists.")

    generated = args.password is None
    password = args.password or prompt_password()
    if len(password) < 8:
        raise SystemExit("Error: password must be at least 8 characters.")

    user = ds.create_user(
        {
            "name": args.name.strip() or email,
            "email": email,
            "password": password,
            "role": args.role,
        }
    )

    print(f"\nCreated user: {user['email']}")
    print(f"  id   : {user['id']}")
    print(f"  name : {user['name']}")
    print(f"  role : {user['role']}")
    if generated:
        print(f"  pass : {password}")
        print("\n  ^ Save this now — it is stored hashed and cannot be recovered.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

