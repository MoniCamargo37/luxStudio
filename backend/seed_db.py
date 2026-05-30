"""Deprecated seed entrypoint.

The application must never populate the luminaire database by scanning
``backend/ldt``. Luminaires are created only through the admin database flow.
This file is intentionally non-mutating so accidental execution cannot import
or modify records.
"""


def main() -> None:
    print(
        "No action taken. Luminaire records must be created through "
        "/api/admin/luminaires/upload."
    )


if __name__ == "__main__":
    main()
