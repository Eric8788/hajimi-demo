export const STUDENT_GRADES = ['G7', 'G8', 'G9', 'G10', 'G11', 'G12', 'G13', '毕业生'] as const;
export const STUDENT_GRADE_COPY = 'G7-G13 / 毕业生';

export type StudentGrade = (typeof STUDENT_GRADES)[number];
