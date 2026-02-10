#!/usr/bin/env python3
"""
Installation script for Schoology AI Assistant Native Host
Sets up the native messaging host for Chrome/Edge
"""

import os
import sys
import json
import platform
from pathlib import Path


def get_native_host_manifest_path():
    """Get the path where native messaging host manifest should be installed"""
    system = platform.system()

    if system == 'Darwin':  # macOS
        return Path.home() / 'Library' / 'Application Support' / 'Google' / 'Chrome' / 'NativeMessagingHosts'
    elif system == 'Linux':
        return Path.home() / '.config' / 'google-chrome' / 'NativeMessagingHosts'
    elif system == 'Windows':
        # Windows uses registry, not file system
        return None
    else:
        raise OSError(f"Unsupported operating system: {system}")


def create_manifest(backend_path):
    """Create native messaging host manifest"""
    manifest = {
        "name": "com.schoology.ai.assistant",
        "description": "Schoology AI Assistant Native Host",
        "path": str(backend_path / "native_host.py"),
        "type": "stdio",
        "allowed_origins": [
            "chrome-extension://EXTENSION_ID_HERE/"
        ]
    }
    return manifest


def install():
    """Install the native messaging host"""
    print("Schoology AI Assistant - Native Host Installer")
    print("=" * 50)

    # Check if running on Windows
    if platform.system() == 'Windows':
        print("\nERROR: Windows installation requires registry modifications.")
        print("Please see README.md for manual installation instructions.")
        sys.exit(1)

    # Get current directory
    backend_path = Path(__file__).parent.absolute() / 'backend'

    if not backend_path.exists():
        print(f"\nERROR: Backend directory not found at {backend_path}")
        sys.exit(1)

    # Get manifest directory
    manifest_dir = get_native_host_manifest_path()

    if not manifest_dir:
        print("\nERROR: Could not determine native messaging host directory")
        sys.exit(1)

    # Create directory if it doesn't exist
    manifest_dir.mkdir(parents=True, exist_ok=True)

    # Create manifest
    manifest = create_manifest(backend_path)
    manifest_path = manifest_dir / 'com.schoology.ai.assistant.json'

    print(f"\nInstalling native host manifest to:")
    print(f"  {manifest_path}")

    # Write manifest
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print("\n✓ Native host manifest installed successfully!")

    print("\n" + "=" * 50)
    print("IMPORTANT: Update Extension ID")
    print("=" * 50)
    print("\n1. Load the extension in Chrome:")
    print("   - Open chrome://extensions/")
    print("   - Enable 'Developer mode'")
    print("   - Click 'Load unpacked'")
    print("   - Select the 'extension' directory")
    print("\n2. Copy the Extension ID from chrome://extensions/")
    print("\n3. Update the manifest file:")
    print(f"   {manifest_path}")
    print("\n4. Replace 'EXTENSION_ID_HERE' with your actual Extension ID")

    print("\n" + "=" * 50)
    print("Install Python Dependencies")
    print("=" * 50)
    print("\nRun:")
    print(f"  cd {backend_path}")
    print("  pip install -r requirements.txt")

    print("\n" + "=" * 50)
    print("Configure OpenAI API Key")
    print("=" * 50)
    print("\n1. Open the extension popup")
    print("2. Enter your OpenAI API key")
    print("3. Click 'Save Configuration'")

    print("\n✓ Installation complete!")


def uninstall():
    """Uninstall the native messaging host"""
    print("Uninstalling Schoology AI Assistant Native Host...")

    manifest_dir = get_native_host_manifest_path()

    if not manifest_dir:
        print("ERROR: Could not determine native messaging host directory")
        sys.exit(1)

    manifest_path = manifest_dir / 'com.schoology.ai.assistant.json'

    if manifest_path.exists():
        manifest_path.unlink()
        print(f"✓ Removed manifest: {manifest_path}")
    else:
        print(f"Manifest not found: {manifest_path}")

    print("✓ Uninstall complete!")


def main():
    """Main entry point"""
    if len(sys.argv) > 1 and sys.argv[1] == 'uninstall':
        uninstall()
    else:
        install()


if __name__ == '__main__':
    main()
