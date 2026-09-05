#!/usr/bin/env sh
# The build lives in build-pages.mjs so it runs on Windows too. This wrapper
# stays so existing callers and muscle memory keep working.
exec node "$(dirname "$0")/build-pages.mjs"
