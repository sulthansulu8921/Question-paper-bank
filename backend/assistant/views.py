import os
import requests
from rest_framework import viewsets, permissions, status, mixins
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import ChatSession, ChatMessage
from .serializers import ChatSessionSerializer, ChatMessageSerializer
from materials.models import SubjectiveQuestion
from subscriptions.permissions import HasAIAssistantAccess

class ChatSessionViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSessionSerializer
    permission_classes = [permissions.IsAuthenticated, HasAIAssistantAccess]

    def get_queryset(self):
        return ChatSession.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ChatMessageListAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasAIAssistantAccess]

    def get(self, request, session_id):
        try:
            session = ChatSession.objects.get(id=session_id, user=request.user)
        except ChatSession.DoesNotExist:
            return Response({"error": "Chat session not found"}, status=status.HTTP_404_NOT_FOUND)

        messages = session.messages.all()
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data)

class ChatAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasAIAssistantAccess]

    def post(self, request, session_id):
        try:
            session = ChatSession.objects.get(id=session_id, user=request.user)
        except ChatSession.DoesNotExist:
            return Response({"error": "Chat session not found"}, status=status.HTTP_404_NOT_FOUND)

        user_message = request.data.get('message', '').strip()
        question_id = request.data.get('question_id')

        if not user_message:
            return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Credit System Check & Deduction
        from subscriptions.permissions import user_has_active_subscription
        is_unlimited = (
            request.user.is_staff or 
            request.user.is_superuser or 
            request.user.role in ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'INSTRUCTOR'] or
            user_has_active_subscription(request.user, None, check_type='ai')
        )

        CREDIT_COSTS = {
            'explain_mcq': 1,
            'explain_pyq': 2,
            'generate_mcqs': 3,
            'summarize_notes': 5,
            'ai_study_plan': 10,
            'mock_test_analysis': 15,
            'weekly_report': 20,
            'chat': 1
        }

        action_type = request.data.get('action_type')
        if not action_type:
            if question_id:
                try:
                    q = SubjectiveQuestion.objects.get(id=question_id)
                    if q.question_type == 'MCQ':
                        action_type = 'explain_mcq'
                    else:
                        action_type = 'explain_pyq'
                except SubjectiveQuestion.DoesNotExist:
                    action_type = 'chat'
            else:
                action_type = 'chat'

        cost = CREDIT_COSTS.get(action_type, 1)

        if not is_unlimited:
            if getattr(request.user, 'ai_credits', 0) < cost:
                return Response({
                    "error": "credits_exhausted",
                    "message": "You've used all your AI Credits. Upgrade to Mentor Pass or buy Credit Packs to continue."
                }, status=status.HTTP_403_FORBIDDEN)

            # Deduct credits
            request.user.ai_credits = max(0, request.user.ai_credits - cost)
            request.user.save(update_fields=['ai_credits'])

        # 1. Save user's message
        ChatMessage.objects.create(session=session, role='user', content=user_message)

        # Update session title automatically if it is default
        if session.title == 'New Chat' or not session.title:
            session.title = user_message[:40] + ('...' if len(user_message) > 40 else '')
            session.save()

        # 2. Get API key from environment
        gemini_api_key = os.environ.get('GEMINI_API_KEY')

        # 3. Check if we should run in Mock Tutor Mode
        if not gemini_api_key:
            mock_response = self.get_mock_response(user_message, question_id)
            # Save assistant's message
            db_msg = ChatMessage.objects.create(session=session, role='assistant', content=mock_response)
            serializer = ChatMessageSerializer(db_msg)
            return Response({
                "message": serializer.data,
                "ai_credits": request.user.ai_credits,
                "warning": "GEMINI_API_KEY is missing from environment. Operating in mock accounting mode."
            }, status=status.HTTP_201_CREATED)

        # 4. Prepare system instruction & context
        system_instruction = (
            "You are 'qubook.in AI Assistant', an advanced, professional, and friendly AI tutor specializing in "
            "CA (Chartered Accountancy) and accounting subjects.\n"
            "Explain concepts clearly, break down formulas and ledger entries in step-by-step formats, use tables "
            "for financial data, and provide concise, accurate explanations.\n"
            "Use markdown formatting extensively (bold, headers, bullet lists, math equations, and tables) to make "
            "solutions extremely legible and visually structured."
        )

        if question_id:
            try:
                q = SubjectiveQuestion.objects.get(id=question_id)
                context_info = (
                    f"\n\n[CONTEXT: The student is asking about this specific question: \n"
                    f"- Source: {q.source} ({q.attempt} {q.year})\n"
                    f"- Question No: {q.q_no}\n"
                    f"- Marks: {q.marks}\n"
                    f"- Question Text:\n{q.question_text}\n"
                )
                if q.correct_answer:
                    context_info += f"- Suggested Answer:\n{q.correct_answer}\n"
                if q.table_data:
                    context_info += f"- Question Table Data:\n{q.table_data}\n"
                if q.answer_table_data:
                    context_info += f"- Answer Table/Ledgers Data:\n{q.answer_table_data}\n"
                context_info += "Please frame your response keeping this question and answer key in mind.]"
                system_instruction += context_info
            except SubjectiveQuestion.DoesNotExist:
                pass

        # 5. Fetch previous session messages to build chat history
        previous_messages = session.messages.all().order_by('created_at')
        contents = []
        for msg in previous_messages:
            # Map roles: django uses 'user'/'assistant', Gemini uses 'user'/'model'
            role = 'user' if msg.role == 'user' else 'model'
            contents.append({
                "role": role,
                "parts": [{"text": msg.content}]
            })

        # 6. Call Google Gemini API
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
        headers = {
            "x-goog-api-key": gemini_api_key
        }
        payload = {
            "contents": contents,
            "systemInstruction": {
                "parts": [{"text": system_instruction}]
            }
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=20)
            if response.status_code == 200:
                res_data = response.json()
                # Parse response text
                text_response = res_data['candidates'][0]['content']['parts'][0]['text']
            else:
                # API returned an error, fallback to error message
                text_response = (
                    f"I apologize, but I encountered an error communicating with the AI service. "
                    f"Status Code: {response.status_code}. Response: {response.text[:200]}"
                )
        except Exception as e:
            text_response = f"I apologize, but I failed to reach the AI service due to a connection issue: {str(e)}"

        # 7. Save assistant response
        db_msg = ChatMessage.objects.create(session=session, role='assistant', content=text_response)
        serializer = ChatMessageSerializer(db_msg)
        return Response({
            "message": serializer.data,
            "ai_credits": request.user.ai_credits
        }, status=status.HTTP_201_CREATED)

    def get_mock_response(self, user_msg, question_id):
        """Returns a high-quality formatted mock response for local testing/deployment where key is missing."""
        system_banner = (
            "> [!NOTE]\n"
            "> **qubook.in AI Assistant (Demo Mode)**\n"
            "> To activate live responses, add your `GEMINI_API_KEY` to the backend `.env` file.\n\n"
        )

        user_lower = user_msg.lower()

        if question_id:
            try:
                q = SubjectiveQuestion.objects.get(id=question_id)
                return system_banner + (
                    f"### Contextual Question Explanation: {q.source} Q{q.q_no}\n\n"
                    f"I see you are studying **Question {q.q_no}** from **{q.source}** worth **{q.marks} marks**.\n\n"
                    f"**Here is a step-by-step breakdown of the concept:**\n"
                    f"1. **Core Topic:** {q.topic.name if q.topic else 'Accounting Standard / Chapters'}\n"
                    f"2. **Problem Analysis:** The question tests your knowledge of accounting rules and preparation of financial statements.\n"
                    f"3. **Suggested Solution Strategy:**\n"
                    f"   - Step 1: Read all adjustments carefully (Depreciation, Outstanding items, etc.).\n"
                    f"   - Step 2: Prepare Ledger Accounts or pass Journal Entries as required.\n"
                    f"   - Step 3: Match closing balances to verify mathematical accuracy.\n\n"
                    f"**Suggested Solution/Answer details:**\n"
                    f"```text\n"
                    f"{q.correct_answer[:400] if q.correct_answer else 'Suggested answer data is being processed.'}...\n"
                    f"```\n\n"
                    f"What specific section or adjustment in this question would you like me to explain in further detail?"
                )
            except SubjectiveQuestion.DoesNotExist:
                pass

        if "partnership" in user_lower:
            return system_banner + (
                "### Partnership Accounts Guide\n\n"
                "Partnership accounts are governed by the **Indian Partnership Act, 1932** (or local laws). Key areas include:\n\n"
                "1. **Profit & Loss Appropriation Account**:\n"
                "   Used to distribute net profit among partners after adjustments like:\n"
                "   - Interest on Capital (+ Dr. P&L Appr / - Cr. Capital)\n"
                "   - Interest on Drawings (- Cr. P&L Appr / + Dr. Capital)\n"
                "   - Partner Salaries & Commissions\n\n"
                "2. **Capital Accounts System**:\n"
                "   - *Fixed Capital Method*: Separate Capital and Current Accounts are maintained.\n"
                "   - *Fluctuating Capital Method*: All adjustments are recorded directly in the Capital Account.\n\n"
                "#### Quick Summary Table:\n"
                "| Transaction | Fixed Capital Method | Fluctuating Capital Method |\n"
                "| :--- | :--- | :--- |\n"
                "| Interest on Capital | Partner's Current A/c | Partner's Capital A/c |\n"
                "| Drawings by Partner | Partner's Current A/c | Partner's Capital A/c |\n"
                "| Share of Profit | Partner's Current A/c | Partner's Capital A/c |\n\n"
                "Would you like me to generate a practice question on partnership admission or retirement?"
            )
        elif "cash flow" in user_lower:
            return system_banner + (
                "### Cash Flow Statement (AS 3 / Ind AS 7)\n\n"
                "A Cash Flow Statement tracks inflows and outflows of cash and cash equivalents categorized into three key activities:\n\n"
                "1. **Operating Activities**:\n"
                "   Principal revenue-producing activities (calculated via Direct or Indirect method). Adjust net profit for non-cash items (Depreciation, Goodwill written off) and working capital changes.\n"
                "2. **Investing Activities**:\n"
                "   Acquisition and disposal of long-term assets (Property, Plant, Equipment) and other investments.\n"
                "3. **Financing Activities**:\n"
                "   Activities that change the size and composition of owner's equity and borrowings (Issuing shares, repaying loans, paying dividends).\n\n"
                "#### Flow Calculation Example:\n"
                "$$\\text{Net Cash Flow} = \\text{Operating Cash Flow} + \\text{Investing Cash Flow} + \\text{Financing Cash Flow}$$\n\n"
                "Let me know if you want to walk through a specific indirect operating cash flow reconciliation!"
            )
        else:
            return system_banner + (
                f"### Welcome to qubook.in AI!\n\n"
                f"I am ready to help you with your CA Intermediate accounting preparation.\n\n"
                f"**Here are some topics we can discuss:**\n"
                f"- **Accounting Standards** (AS 10 PPE, AS 12 Government Grants, AS 16 Borrowing Costs, etc.)\n"
                f"- **Company Accounts** (Redemption of Debentures, Buyback of Shares)\n"
                f"- **Financial Statements** (Balance Sheets, Cash Flow Statement preparation)\n"
                f"- **Special Transactions** (Partnership, Branch Accounts)\n\n"
                f"You asked: *\"{user_msg}\"*\n\n"
                f"To test my full capabilities, try asking about **Partnership Accounts** or **Cash Flow Statements**, or open a subjective question and click **\"Ask AI Tutor\"** to start a context-specific learning session!"
            )
