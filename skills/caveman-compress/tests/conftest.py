"""Shared pytest fixtures for the caveman-compress test suite.

`scripts/compress.py` uses package-relative imports (`from .detect import ...`),
so the modules must be importable as the ``scripts`` package. The package lives
at ``caveman-compress/scripts/`` — putting ``caveman-compress/`` (this file's
parent's parent) on ``sys.path`` makes ``import scripts.compress`` resolve.
"""

import os
import sys
from pathlib import Path

import pytest

# Directory layout:
#   caveman-compress/
#     scripts/        <- the importable package
#     tests/conftest.py  <- this file
_SKILL_ROOT = Path(__file__).resolve().parent.parent
if str(_SKILL_ROOT) not in sys.path:
    sys.path.insert(0, str(_SKILL_ROOT))


@pytest.fixture
def isolated_backup_dir(tmp_path, monkeypatch):
    """Redirect compress.py's backup base dir into a tmp dir.

    ``backup_dir_for`` derives the backup location from ``$XDG_DATA_HOME`` (or
    ``~/.local/share``). Pointing it at ``tmp_path`` keeps tests hermetic so a
    real compress_file() call cannot touch the developer's home directory.
    Returns the resolved ``$XDG_DATA_HOME`` for assertions.
    """
    data_home = tmp_path / "xdg-data-home"
    monkeypatch.setenv("XDG_DATA_HOME", str(data_home))
    # Defensively unset LOCALAPPDATA so the Windows branch can't leak either.
    monkeypatch.delenv("LOCALAPPDATA", raising=False)
    return data_home
