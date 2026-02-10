#!/bin/bash
exec /usr/local/bin/python3 "$(dirname "$0")/native_host.py" "$@"
