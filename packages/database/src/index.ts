export { connectToDatabase, disconnectFromDatabase } from "./connection";

export { User } from "./models/user";
export { ProgrammingTopic } from "./models/programming-topic";
export { Question } from "./models/question";
export { QuestionProgress } from "./models/question-progress";
export { QuestionAttempt } from "./models/question-attempt";
export { HintEvent } from "./models/hint-event";
export { StudySession } from "./models/study-session";
export { QuestionDraft } from "./models/question-draft";

export type { IUser } from "./models/user";
export type { IProgrammingTopic } from "./models/programming-topic";
export type { IQuestion, ITestCase, IEvalCase, QuestionDifficulty, QuestionType } from "./models/question";
export type { IQuestionDraft } from "./models/question-draft";
export type { IQuestionProgress } from "./models/question-progress";
export type { IQuestionAttempt, IAttemptTestResult } from "./models/question-attempt";
export type { IHintEvent } from "./models/hint-event";
export type { IStudySession } from "./models/study-session";
