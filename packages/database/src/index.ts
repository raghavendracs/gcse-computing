export { connectToDatabase, disconnectFromDatabase } from "./connection";

export { User } from "./models/user";
export { Module } from "./models/module";
export { QuestionTemplate } from "./models/question-template";
export { GeneratedQuestion } from "./models/generated-question";
export { QuestionAttempt } from "./models/question-attempt";
export { HintEvent } from "./models/hint-event";
export { StudySession } from "./models/study-session";
export { StudentProgress } from "./models/student-progress";
export { SpecTopic } from "./models/spec-topic";

export type { IUser } from "./models/user";
export type { IModule } from "./models/module";
export type { IQuestionTemplate } from "./models/question-template";
export type { IGeneratedQuestion, ITestCase } from "./models/generated-question";
export type { IQuestionAttempt } from "./models/question-attempt";
export type { IHintEvent } from "./models/hint-event";
export type { IStudySession } from "./models/study-session";
export type { IStudentProgress, IModuleProgress, IWeakArea, IModuleWeakAreaFlags } from "./models/student-progress";
export type { ISpecTopic } from "./models/spec-topic";

export { seedEdexcelSpec, seedEdexcelModules } from "./seeds/edexcel-spec";
