from django.test import TestCase
from materials.serializers import parse_mcq_options_helper

class MCQParserTestCase(TestCase):
    def test_parenthesized_format_with_letter(self):
        q_text = "What is the capital of France?\n(a) Berlin\n(b) Paris\n(c) Rome\n(d) Madrid"
        ans_text = "B"
        cleaned, options = parse_mcq_options_helper(q_text, ans_text)
        
        self.assertEqual(cleaned, "What is the capital of France?")
        self.assertEqual(len(options), 4)
        self.assertEqual(options[0]['text'], "Berlin")
        self.assertFalse(options[0]['is_correct'])
        self.assertEqual(options[1]['text'], "Paris")
        self.assertTrue(options[1]['is_correct'])
        self.assertEqual(options[2]['text'], "Rome")
        self.assertFalse(options[2]['is_correct'])

    def test_dot_format_with_letter_in_parens(self):
        q_text = "Which of these is prime?\nA. 4\nB. 6\nC. 7\nD. 9"
        ans_text = "(C)"
        cleaned, options = parse_mcq_options_helper(q_text, ans_text)
        
        self.assertEqual(cleaned, "Which of these is prime?")
        self.assertEqual(len(options), 4)
        self.assertEqual(options[2]['text'], "7")
        self.assertTrue(options[2]['is_correct'])
        
    def test_matching_by_exact_text(self):
        q_text = "Select red:\n(a) blue\n(b) red\n(c) green"
        ans_text = "red"
        cleaned, options = parse_mcq_options_helper(q_text, ans_text)
        
        self.assertEqual(cleaned, "Select red:")
        self.assertEqual(len(options), 3)
        self.assertEqual(options[1]['text'], "red")
        self.assertTrue(options[1]['is_correct'])
        
    def test_non_mcq_text(self):
        q_text = "Solve the equation: x + 5 = 10"
        ans_text = "x = 5"
        cleaned, options = parse_mcq_options_helper(q_text, ans_text)
        
        self.assertEqual(cleaned, q_text)
        self.assertEqual(options, [])

    def test_bracketed_format_options(self):
        q_text = "What color is the sky?\n[a] Blue\n[b] Red\n[c] Green\n[d] Yellow"
        ans_text = "A"
        cleaned, options = parse_mcq_options_helper(q_text, ans_text)
        
        self.assertEqual(cleaned, "What color is the sky?")
        self.assertEqual(len(options), 4)
        self.assertEqual(options[0]['text'], "Blue")
        self.assertTrue(options[0]['is_correct'])
        self.assertFalse(options[1]['is_correct'])

from materials.views import parse_questions_from_raw_text

class PDFImportEngineTestCase(TestCase):
    def test_raw_text_import_cleanup_and_structuring(self):
        raw_pdf_ocr_text = """
THE INSTITUTE OF CHARTERED ACCOUNTANTS OF INDIA
Intermediate Examination - May 2026
Booklet Code: A
General Instructions:
1. Candidates should darken OMR circles carefully.
2. Do not write anything on this booklet.
Signature of Candidate: ______________
RPJ1 4089257

Case Scenario 1:
ABC Ltd acquired XYZ Ltd on 1st April 2025.
The company is preparing accounts.

Questions:
1. Explain AS-16 borrowing costs. (5 Marks)
Answer: Option A

2. Which standard is applicable?
(a) AS-16
(b) AS-10
(c) AS-12
(d) AS-20
RPJ1 4089257 Page 2 of 10

SPACE FOR ROUGH WORK
Rough Work page contents
        """
        questions, attempt, year = parse_questions_from_raw_text(raw_pdf_ocr_text)
        
        self.assertEqual(attempt, "MAY")
        self.assertEqual(year, "2026")
        
        # Check that cover/instructions/rough work were cleaned
        self.assertEqual(len(questions), 1)
        cs = questions[0]
        self.assertTrue(cs['q_no'].startswith('CS'))
        self.assertIn("ABC Ltd acquired XYZ Ltd", cs['question_text'])
        
        # Verify sub-questions
        sub_qs = cs['sub_questions']
        self.assertEqual(len(sub_qs), 2)
        
        # Sub-question 1
        self.assertEqual(sub_qs[0]['identifier'], '1')
        self.assertIn("Explain AS-16 borrowing costs", sub_qs[0]['question_text'])
        self.assertEqual(sub_qs[0]['marks'], 5)
        self.assertEqual(sub_qs[0]['correct_answer'], 'Option A')
        
        # Sub-question 2
        self.assertEqual(sub_qs[1]['identifier'], '2')
        self.assertIn("Which standard is applicable?", sub_qs[1]['question_text'])
        
    def test_answer_key_page_parsing(self):
        raw_pdf_ocr_text = """
Case Scenario 1:
Company tax rates are high.

1. What is the tax rate?
(a) 25%
(b) 30%
(c) 35%
(d) 40%

2. Explain tax rebate.

Answer Key
1. (B) - Tax rate is 30% for corporate firms.
2. (C) - Rebate is allowed under section 87A.
        """
        questions, attempt, year = parse_questions_from_raw_text(raw_pdf_ocr_text)
        
        self.assertEqual(len(questions), 1)
        sub_qs = questions[0]['sub_questions']
        self.assertEqual(len(sub_qs), 2)
        
        # Verify correct answers are auto-filled from the Answer Key page
        self.assertIn("(B)", sub_qs[0]['correct_answer'])
        self.assertIn("Tax rate is 30%", sub_qs[0]['correct_answer'])
        
        self.assertIn("(C)", sub_qs[1]['correct_answer'])
        self.assertIn("Rebate is allowed under section 87A", sub_qs[1]['correct_answer'])

    def test_descriptive_theory_question_paper_import(self):
        raw_pdf_ocr_text = """
THE INSTITUTE OF CHARTERED ACCOUNTANTS OF INDIA
Intermediate Examination - May 2026
ZAN2 Booklet Code: A
General Instructions:
1. Candidates should read everything.

Question 1
1(a) Explain AS-16 Borrowing Costs. (5 Marks)
Additional Information:
ABC Ltd borrowed Rs. 10 Lakhs.
You are required to:
Calculate the interest to be capitalized.
Answer: The interest is calculated as follows.
Working Notes:
1. Borrowing rate is 10%.
W.N. 2. Capitalization period is 6 months.

1(b) Prepare the journal entries. (5 Marks)
Answer: Journal entries are as follows.
Working Note:
Interest A/c Dr. 1,00,000.
        """
        questions, attempt, year = parse_questions_from_raw_text(raw_pdf_ocr_text)

        self.assertEqual(len(questions), 1)
        q = questions[0]
        self.assertEqual(q['q_no'], '1')
        self.assertEqual(len(q['sub_questions']), 2)

        sq1 = q['sub_questions'][0]
        self.assertEqual(sq1['identifier'], 'a')
        self.assertIn("Explain AS-16 Borrowing Costs", sq1['question_text'])
        self.assertIn("Additional Information", sq1['question_text'])
        self.assertEqual(sq1['marks'], 5)
        
        # Verify split answers and working notes
        self.assertEqual(sq1['answer'], "The interest is calculated as follows.")
        self.assertIn("Working Notes:", sq1['working_notes'])
        self.assertIn("W.N. 2. Capitalization period is 6 months", sq1['working_notes'])

        sq2 = q['sub_questions'][1]
        self.assertEqual(sq2['identifier'], 'b')
        self.assertEqual(sq2['answer'], "Journal entries are as follows.")
        self.assertIn("Working Note:", sq2['working_notes'])
        self.assertIn("Interest A/c Dr. 1,00,000", sq2['working_notes'])
