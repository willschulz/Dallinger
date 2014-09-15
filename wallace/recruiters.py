import os
from boto.mturk.question import Overview, FormattedContent, QuestionContent, \
    FreeTextAnswer, Question, AnswerSpecification, QuestionForm
from boto.mturk.connection import MTurkConnection


class Recruiter(object):
    """A recruiter manages the flow of participants to the experiment website,
    recruiting new participants and retaining those who are still needed."""
    def __init__(self):
        super(Recruiter, self).__init__()

    def recruit_new_participants(n=1):
        raise NotImplementedError

    def close_recruitment():
        raise NotImplementedError


class BotoRecruiter(Recruiter):

    def __init__(self):
        super(BotoRecruiter, self).__init__()

        # HOST = "mechanicalturk.amazonaws.com"
        HOST = "mechanicalturk.sandbox.amazonaws.com"  # For sandbox.

        # Open an MTurk connection.
        self.mtc = MTurkConnection(
            aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
            host=HOST)

        self.hit_description = self.HIT()
        self.hit = self.postHIT(self.hit_description)

    def recruit_new_participants(self, n=1):
        self.extendHIT(self.hit, n)

    def close_recruitment(self):
        self.deleteHIT(self.hit)

    def HIT(self):

        # Title of the HIT shown to MTurk workers.
        title = 'Learning game 4'

        # Description of the HIT shown to MTurk workers.
        description = ("Play a 10-minute game where you figure out the "
                       "relationship between two things.")

        # Keywords
        keywords = 'learning, game, psychology'

        # Step 1. Play the game.
        overview = Overview()
        overview.append_field('Title', "Step 1. Play the game "
                                       "on the following website:")
        overview.append(FormattedContent(
            '<a target="_blank" href="' + os.environ["EXPERIMENT_URL"] +
            '">Site</a>. Once you are done, you will get a completion code.'))

        # Step 2. Enter the completion code.
        qc1 = QuestionContent()
        qc1.append_field('Title', 'Step 2. Enter the completion code:')

        fta1 = FreeTextAnswer(num_lines=1)
        q1 = Question(identifier="completionCode",
                      content=qc1,
                      answer_spec=AnswerSpecification(fta1))

        # Step 3. Give feedback.
        qc2 = QuestionContent()
        qc2.append_field('Title', "Did you encounter any problems?"
                                  "Have any comments?")
        fta2 = FreeTextAnswer()
        q2 = Question(identifier="comments",
                      content=qc2,
                      answer_spec=AnswerSpecification(fta2))

        # Build the question form.
        question_form = QuestionForm()
        question_form.append(overview)
        question_form.append(q1)
        question_form.append(q2)

        # return the HIT.
        return {
            'questions': question_form,
            'max_assignments': 1,
            'title': title,
            'description': description,
            'keywords': keywords,
            'duration': 60*30,
            'reward': 1.00}

    def postHIT(self, h):
        """Post the HIT defined by the dictionary h."""
        return self.mtc.create_hit(
            questions=h["questions"],
            max_assignments=h["max_assignments"],
            title=h["title"],
            description=h["description"],
            keywords=h["keywords"],
            duration=h["duration"],
            reward=h["reward"],
            response_groups="Minimal")

    def extendHIT(self, hit, n=1):
        """Extend the HIT by recruiting one additional participant."""
        self.mtc.extend_hit(hit, assignments_increment=n)

    def deleteHIT(self, hit):
        """Delete the HIT."""
        self.mtc.disable_hit(hit.HITId)
