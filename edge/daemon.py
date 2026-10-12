#!/usr/bin/env python3
"""OmniHome Edge Daemon Compatibility Wrapper.

Redirects directly to `edge.cli.main()`.
"""

import sys
from edge.cli import main

if __name__ == "__main__":
    # If called without arguments, default to starting the edge daemon
    if len(sys.argv) == 1:
        sys.argv.append("start")
    main()
