#!/usr/bin/env python3
"""
Native Messaging Host for Schoology AI Assistant
Handles communication between Chrome extension and Python backend
"""

import sys
import json
import struct
import logging
from typing import Dict, Any
from ai_handler import AIHandler
from config import Config

# Setup logging
logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename=str(Config.get_log_path())
)
logger = logging.getLogger(__name__)


class NativeMessagingHost:
    """Native messaging host for Chrome extension communication"""

    def __init__(self):
        """Initialize the native messaging host"""
        self.ai_handler = None
        logger.info("Native messaging host initialized")

    def read_message(self) -> Dict[str, Any]:
        """
        Read a message from the extension

        Returns:
            Dict containing the message data
        """
        # Read message length (first 4 bytes)
        raw_length = sys.stdin.buffer.read(4)

        if not raw_length:
            logger.info("No message to read, exiting")
            sys.exit(0)

        message_length = struct.unpack('@I', raw_length)[0]

        # Read the message
        message = sys.stdin.buffer.read(message_length).decode('utf-8')

        return json.loads(message)

    def send_message(self, message: Dict[str, Any]) -> None:
        """
        Send a message to the extension

        Args:
            message: Dict to send
        """
        encoded_content = json.dumps(message).encode('utf-8')
        encoded_length = struct.pack('@I', len(encoded_content))

        sys.stdout.buffer.write(encoded_length)
        sys.stdout.buffer.write(encoded_content)
        sys.stdout.buffer.flush()

    def handle_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle incoming message from extension

        Args:
            message: Message from extension

        Returns:
            Response dict
        """
        message_type = message.get('type')
        request_id = message.get('requestId')

        logger.info(f"Handling message type: {message_type}")

        try:
            if message_type == 'ping':
                return {
                    'requestId': request_id,
                    'success': True,
                    'message': 'pong'
                }

            elif message_type == 'process_assignment':
                api_key = message.get('apiKey')
                assignment = message.get('assignment')

                if not api_key:
                    return {
                        'requestId': request_id,
                        'error': 'API key not provided'
                    }

                if not assignment:
                    return {
                        'requestId': request_id,
                        'error': 'Assignment data not provided'
                    }

                # Initialize AI handler with API key
                if not self.ai_handler or self.ai_handler.client.api_key != api_key:
                    self.ai_handler = AIHandler(api_key)

                # Process the assignment
                result = self.ai_handler.process_assignment(
                    assignment.get('type'),
                    assignment.get('data')
                )

                return {
                    'requestId': request_id,
                    'success': True,
                    'result': result
                }

            else:
                return {
                    'requestId': request_id,
                    'error': f'Unknown message type: {message_type}'
                }

        except Exception as e:
            logger.error(f"Error handling message: {e}", exc_info=True)
            return {
                'requestId': request_id,
                'error': str(e)
            }

    def run(self) -> None:
        """Main loop - read messages and send responses"""
        logger.info("Native messaging host starting")

        try:
            while True:
                # Read message from extension
                message = self.read_message()

                # Process message
                response = self.handle_message(message)

                # Send response
                self.send_message(response)

        except KeyboardInterrupt:
            logger.info("Host interrupted by user")
            sys.exit(0)

        except Exception as e:
            logger.error(f"Fatal error in main loop: {e}", exc_info=True)
            sys.exit(1)


def main():
    """Entry point"""
    try:
        host = NativeMessagingHost()
        host.run()
    except Exception as e:
        logger.error(f"Failed to start host: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
