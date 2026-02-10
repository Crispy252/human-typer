"""Configuration management for Schoology AI Assistant"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Application configuration"""

    # OpenAI settings
    OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4-turbo-preview')
    OPENAI_TEMPERATURE = float(os.getenv('OPENAI_TEMPERATURE', '0.7'))
    MAX_TOKENS = int(os.getenv('MAX_TOKENS', '2000'))

    # Rate limiting
    RATE_LIMIT_REQUESTS = int(os.getenv('RATE_LIMIT_REQUESTS', '10'))
    RATE_LIMIT_WINDOW = int(os.getenv('RATE_LIMIT_WINDOW', '60'))  # seconds

    # Response settings
    MIN_ESSAY_WORDS = int(os.getenv('MIN_ESSAY_WORDS', '250'))
    MAX_ESSAY_WORDS = int(os.getenv('MAX_ESSAY_WORDS', '1000'))
    MIN_DISCUSSION_WORDS = int(os.getenv('MIN_DISCUSSION_WORDS', '100'))
    MAX_DISCUSSION_WORDS = int(os.getenv('MAX_DISCUSSION_WORDS', '300'))

    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'schoology_ai.log')

    @staticmethod
    def get_log_path():
        """Get full path to log file"""
        log_dir = Path.home() / '.schoology_ai'
        log_dir.mkdir(exist_ok=True)
        return log_dir / Config.LOG_FILE

    @staticmethod
    def validate():
        """Validate configuration"""
        errors = []

        if Config.MAX_TOKENS < 100:
            errors.append("MAX_TOKENS must be at least 100")

        if Config.RATE_LIMIT_REQUESTS < 1:
            errors.append("RATE_LIMIT_REQUESTS must be at least 1")

        return errors
