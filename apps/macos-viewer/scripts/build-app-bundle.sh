#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
VIEWER_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(CDPATH= cd -- "$VIEWER_ROOT/../.." && pwd)
PACKAGE_DIR="$VIEWER_ROOT/MicrocanvasViewer"
PRODUCT_NAME="MicrocanvasViewer"
BUNDLE_ID="com.microcanvas.viewer"
APP_NAME="MicrocanvasViewer"
CONFIGURATION="${CONFIGURATION:-debug}"
OUTPUT_DIR="${MICROCANVAS_VIEWER_APP_OUTPUT_DIR:-$VIEWER_ROOT/build}"

usage() {
  cat <<EOF
Usage: $0 [--configuration debug|release] [--output-dir PATH]

Builds the SwiftPM MicrocanvasViewer product and materializes:
  apps/macos-viewer/build/MicrocanvasViewer.app

Environment:
  CONFIGURATION                         Build configuration, default: debug
  MICROCANVAS_VIEWER_APP_OUTPUT_DIR     Output directory, default: apps/macos-viewer/build
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --configuration|-c)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --configuration" >&2
        exit 2
      fi
      CONFIGURATION="$1"
      ;;
    --output-dir|-o)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --output-dir" >&2
        exit 2
      fi
      OUTPUT_DIR="$1"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if [ "$(uname -s)" != "Darwin" ]; then
  echo "MicrocanvasViewer.app can only be built on macOS." >&2
  exit 1
fi

if ! command -v swift >/dev/null 2>&1; then
  echo "swift is required to build MicrocanvasViewer.app." >&2
  exit 1
fi

CLANG_MODULE_CACHE_PATH="${CLANG_MODULE_CACHE_PATH:-$PACKAGE_DIR/.build/module-cache}"
export CLANG_MODULE_CACHE_PATH
mkdir -p "$CLANG_MODULE_CACHE_PATH"

case "$CONFIGURATION" in
  debug|release)
    ;;
  *)
    echo "Unsupported configuration: $CONFIGURATION" >&2
    exit 2
    ;;
esac

swift build \
  --package-path "$PACKAGE_DIR" \
  --configuration "$CONFIGURATION" \
  --product "$PRODUCT_NAME"

BIN_DIR=$(swift build \
  --package-path "$PACKAGE_DIR" \
  --configuration "$CONFIGURATION" \
  --show-bin-path)
EXECUTABLE="$BIN_DIR/$PRODUCT_NAME"

if [ ! -x "$EXECUTABLE" ]; then
  echo "Expected executable was not built: $EXECUTABLE" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR=$(CDPATH= cd -- "$OUTPUT_DIR" && pwd)
BUNDLE_DIR="$OUTPUT_DIR/$APP_NAME.app"
CONTENTS_DIR="$BUNDLE_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

case "$BUNDLE_DIR" in
  "$VIEWER_ROOT"/build/*.app|"$OUTPUT_DIR"/*.app)
    rm -rf "$BUNDLE_DIR"
    ;;
  *)
    echo "Refusing to replace unexpected bundle path: $BUNDLE_DIR" >&2
    exit 1
    ;;
esac

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"
cp "$EXECUTABLE" "$MACOS_DIR/$PRODUCT_NAME"
chmod 755 "$MACOS_DIR/$PRODUCT_NAME"

cat > "$CONTENTS_DIR/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundleExecutable</key>
  <string>$PRODUCT_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleSupportedPlatforms</key>
  <array>
    <string>MacOSX</string>
  </array>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF

printf 'APPL????' > "$CONTENTS_DIR/PkgInfo"

echo "Built $BUNDLE_DIR"
echo "Launch with: open -n \"$BUNDLE_DIR\" --args --repo-root \"$REPO_ROOT\""
