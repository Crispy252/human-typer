"""OpenAI GPT-4 integration for assignment processing"""

import logging
from typing import Dict, List, Any
from openai import OpenAI
from config import Config

logger = logging.getLogger(__name__)


class AIHandler:
    """Handles AI-powered assignment completion using OpenAI GPT-4"""

    def __init__(self, api_key: str):
        """
        Initialize AI handler

        Args:
            api_key: OpenAI API key
        """
        self.client = OpenAI(api_key=api_key)
        self.model = Config.OPENAI_MODEL

    def process_assignment(self, assignment_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process an assignment and generate appropriate response

        Args:
            assignment_type: Type of assignment ('quiz', 'essay', 'discussion')
            data: Assignment data

        Returns:
            Dict containing the generated response
        """
        logger.info(f"Processing {assignment_type} assignment")

        try:
            if assignment_type == 'quiz':
                return self.process_quiz(data)
            elif assignment_type == 'essay':
                return self.process_essay(data)
            elif assignment_type == 'discussion':
                return self.process_discussion(data)
            elif assignment_type == 'google_doc':
                return self.process_google_doc(data)
            elif assignment_type == 'google_slides':
                return self.process_google_slides(data)
            else:
                raise ValueError(f"Unknown assignment type: {assignment_type}")

        except Exception as e:
            logger.error(f"Error processing assignment: {e}")
            raise

    def process_quiz(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process quiz questions

        Args:
            data: Quiz data with questions

        Returns:
            Dict with answers array
        """
        questions = data.get('questions', [])
        answers = []

        for question in questions:
            question_text = question.get('text', '')
            question_type = question.get('type', 'multiple_choice')
            options = question.get('options', [])

            if question_type in ['multiple_choice', 'true_false']:
                # Generate answer selection
                answer_index = self._answer_multiple_choice(question_text, options)
                answers.append({
                    'selectedIndex': answer_index,
                    'explanation': f"Selected option {answer_index + 1}"
                })
            elif question_type in ['short_answer', 'long_answer']:
                # Generate text answer
                answer_text = self._answer_text_question(question_text, question_type)
                answers.append({
                    'text': answer_text
                })
            else:
                answers.append({
                    'text': 'Unable to answer this question type'
                })

        return {
            'success': True,
            'answers': answers
        }

    def _answer_multiple_choice(self, question: str, options: List[Dict]) -> int:
        """
        Select the best answer for a multiple choice question

        Args:
            question: Question text
            options: List of answer options

        Returns:
            Index of selected answer
        """
        options_text = "\n".join([
            f"{i + 1}. {opt.get('text', '')}"
            for i, opt in enumerate(options)
        ])

        prompt = f"""You are taking a quiz. Answer the following multiple choice question by selecting the best answer.

Question: {question}

Options:
{options_text}

Respond with ONLY the number (1, 2, 3, etc.) of the best answer. Do not include any explanation."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a knowledgeable student taking a quiz. Always select the most accurate answer."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=10
            )

            answer_text = response.choices[0].message.content.strip()

            # Extract number from response
            import re
            match = re.search(r'\d+', answer_text)
            if match:
                answer_num = int(match.group())
                # Convert to 0-indexed
                return min(max(answer_num - 1, 0), len(options) - 1)

        except Exception as e:
            logger.error(f"Error answering multiple choice: {e}")

        # Default to first option if error
        return 0

    def _answer_text_question(self, question: str, question_type: str) -> str:
        """
        Generate text answer for short/long answer questions

        Args:
            question: Question text
            question_type: Type of question

        Returns:
            Generated answer text
        """
        max_words = 50 if question_type == 'short_answer' else 200

        prompt = f"""Answer the following question clearly and concisely in {max_words} words or less.

Question: {question}

Provide a direct, accurate answer."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a knowledgeable student answering quiz questions."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=max_words * 2
            )

            return response.choices[0].message.content.strip()

        except Exception as e:
            logger.error(f"Error answering text question: {e}")
            return "Unable to generate answer"

    def process_essay(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate essay response

        Args:
            data: Essay assignment data

        Returns:
            Dict with generated essay text
        """
        instructions = data.get('instructions', '')
        requirements = data.get('requirements', {})

        min_words = requirements.get('minWords', Config.MIN_ESSAY_WORDS)
        max_words = requirements.get('maxWords', Config.MAX_ESSAY_WORDS)
        citations_required = requirements.get('citationsRequired', False)

        prompt = f"""Write a well-structured essay based on the following instructions.

Instructions: {instructions}

Requirements:
- Length: {min_words}-{max_words} words
- Citations required: {"Yes" if citations_required else "No"}

Write a complete, well-organized essay that addresses the prompt."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a skilled academic writer. Write clear, well-structured essays."},
                    {"role": "user", "content": prompt}
                ],
                temperature=Config.OPENAI_TEMPERATURE,
                max_tokens=Config.MAX_TOKENS
            )

            essay_text = response.choices[0].message.content.strip()

            return {
                'success': True,
                'text': essay_text,
                'wordCount': len(essay_text.split())
            }

        except Exception as e:
            logger.error(f"Error generating essay: {e}")
            raise

    def process_discussion(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate discussion post response

        Args:
            data: Discussion assignment data

        Returns:
            Dict with generated discussion post text
        """
        prompt_text = data.get('prompt', '')
        existing_posts = data.get('existingPosts', [])

        # Build context from existing posts
        context = ""
        if existing_posts:
            context = "\n\nExisting discussion posts:\n"
            for post in existing_posts[:3]:  # Include up to 3 posts
                author = post.get('author', 'Anonymous')
                content = post.get('content', '')
                if content:
                    context += f"\n{author}: {content[:200]}...\n"

        prompt = f"""Write a thoughtful discussion post responding to the following prompt.

Prompt: {prompt_text}{context}

Write a {Config.MIN_DISCUSSION_WORDS}-{Config.MAX_DISCUSSION_WORDS} word response that:
1. Directly addresses the prompt
2. Shows critical thinking
3. Adds value to the discussion
4. Is appropriate for an academic setting"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a thoughtful student participating in an academic discussion."},
                    {"role": "user", "content": prompt}
                ],
                temperature=Config.OPENAI_TEMPERATURE,
                max_tokens=500
            )

            discussion_text = response.choices[0].message.content.strip()

            return {
                'success': True,
                'text': discussion_text,
                'wordCount': len(discussion_text.split())
            }

        except Exception as e:
            logger.error(f"Error generating discussion post: {e}")
            raise

    def process_google_doc(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate content for Google Docs assignment

        Args:
            data: Google Doc assignment data

        Returns:
            Dict with generated document text
        """
        title = data.get('title', '')
        instructions = data.get('instructions', '')
        existing_content = data.get('existingContent', '')
        requirements = data.get('requirements', {})
        is_empty = data.get('isEmpty', True)

        min_words = requirements.get('minWords', Config.MIN_ESSAY_WORDS)
        max_words = requirements.get('maxWords', Config.MAX_ESSAY_WORDS)
        citations_required = requirements.get('citationsRequired', False)

        # Build context
        context = f"Document Title: {title}\n"
        if instructions:
            context += f"Instructions: {instructions}\n"
        if existing_content and not is_empty:
            context += f"\nExisting content in document:\n{existing_content[:500]}\n"

        prompt = f"""You are helping complete a Google Docs assignment.

{context}

Requirements:
- Length: {min_words}-{max_words} words
- Citations required: {"Yes" if citations_required else "No"}
- Document type: {"Empty document (write complete content)" if is_empty else "Document with existing content (add to or improve it)"}

{"Write a complete, well-structured document that fulfills the assignment requirements." if is_empty else "Continue or improve upon the existing content to fulfill the assignment requirements."}"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a skilled academic writer helping complete a Google Docs assignment."},
                    {"role": "user", "content": prompt}
                ],
                temperature=Config.OPENAI_TEMPERATURE,
                max_tokens=Config.MAX_TOKENS
            )

            doc_text = response.choices[0].message.content.strip()

            return {
                'success': True,
                'text': doc_text,
                'wordCount': len(doc_text.split())
            }

        except Exception as e:
            logger.error(f"Error generating Google Doc content: {e}")
            raise

    def process_google_slides(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate content for Google Slides presentation

        Args:
            data: Google Slides assignment data

        Returns:
            Dict with generated slides
        """
        title = data.get('title', '')
        instructions = data.get('instructions', '')
        requirements = data.get('requirements', {})

        min_slides = requirements.get('minSlides', 5)
        max_slides = requirements.get('maxSlides', min_slides)

        prompt = f"""Create a presentation outline for Google Slides.

Title: {title}
Instructions: {instructions}

Requirements:
- Number of slides: {min_slides}-{max_slides}

For each slide, provide:
1. Slide title
2. Key points/content (bullet points)

Format your response as:

Slide 1: [Title]
- [Point 1]
- [Point 2]
- [Point 3]

Slide 2: [Title]
...

Create a complete, well-organized presentation."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are creating a professional academic presentation."},
                    {"role": "user", "content": prompt}
                ],
                temperature=Config.OPENAI_TEMPERATURE,
                max_tokens=Config.MAX_TOKENS
            )

            slides_text = response.choices[0].message.content.strip()

            # Parse slides from response
            slides = self._parse_slides(slides_text)

            return {
                'success': True,
                'slides': slides,
                'slideCount': len(slides)
            }

        except Exception as e:
            logger.error(f"Error generating Google Slides content: {e}")
            raise

    def _parse_slides(self, text: str) -> List[Dict[str, str]]:
        """
        Parse slide content from AI response

        Args:
            text: AI-generated slides text

        Returns:
            List of slides with title and content
        """
        slides = []
        current_slide = None

        for line in text.split('\n'):
            line = line.strip()

            # Check if this is a slide title
            if line.startswith('Slide ') and ':' in line:
                if current_slide:
                    slides.append(current_slide)

                # Extract title
                title = line.split(':', 1)[1].strip()
                current_slide = {
                    'title': title,
                    'content': ''
                }
            elif current_slide and line:
                # Add content to current slide
                current_slide['content'] += line + '\n'

        # Add last slide
        if current_slide:
            slides.append(current_slide)

        return slides
