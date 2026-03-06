// moduleCode is used only to link templates during seeding — not stored in DB
export type SeedTemplate = {
  moduleCode: string;
  questionType: "multiple_choice" | "short_answer" | "extended" | "coding" | "trace_table" | "fill_gap" | "predict_output" | "fix_code";
  templateName: string;
  promptTemplate: string;
  generationRules: { parameters: string[]; difficulty: "easy" | "medium" | "hard" };
  rubric: {
    maxMarks: number;
    markSchemePoints: string[];
    acceptedConcepts: string[];
    commonMisconceptions: string[];
  };
  hintFramework: string[];
  modelAnswerTemplate: string;
};

export const seedTemplates: SeedTemplate[] = [
  {
    moduleCode: "PROG-01",
    questionType: "short_answer",
    templateName: "Variable vs constant distinction",
    promptTemplate: "Explain the difference between a variable and a constant in programming, giving one example of each.",
    generationRules: { parameters: [], difficulty: "easy" },
    rubric: {
      maxMarks: 4,
      markSchemePoints: [
        "A variable can change value during program execution",
        "A constant has a fixed value that cannot change",
        "Example of a variable (e.g. score, name, counter)",
        "Example of a constant (e.g. PI, MAX_SIZE, GRAVITY)",
      ],
      acceptedConcepts: ["variable", "constant", "value", "change", "fixed"],
      commonMisconceptions: [
        "Confusing constants with read-only variables",
        "Thinking variables must be numbers",
      ],
    },
    hintFramework: [
      "Think about what 'variable' means in everyday language — something that can vary.",
      "A constant is the opposite — think of values in real life that never change, like the value of pi.",
      "Look at the keyword: 'variable' comes from 'vary', meaning to change.",
      "In Python, constants are usually written in UPPER_CASE by convention. What does that tell you?",
      "A variable is like a labelled box whose contents can be swapped. A constant is a box that is sealed shut.",
    ],
    modelAnswerTemplate: "A variable is a named storage location whose value can change during program execution (e.g. score = 0, then score = 10). A constant is a named value that remains fixed throughout (e.g. PI = 3.14159).",
  },
  {
    moduleCode: "PROG-02",
    questionType: "coding",
    templateName: "Loop accumulator challenge",
    promptTemplate: "Write a Python program that asks the user to enter 5 numbers one at a time and then prints the total of all numbers entered.",
    generationRules: { parameters: ["loopCount", "targetOperation"], difficulty: "medium" },
    rubric: {
      maxMarks: 6,
      markSchemePoints: [
        "Initialises a total/accumulator variable to 0 before the loop",
        "Uses a loop that runs exactly 5 times",
        "Uses input() inside the loop to collect each number",
        "Converts input to a number type (int() or float())",
        "Adds each number to the running total",
        "Prints the final total after the loop ends",
      ],
      acceptedConcepts: ["for loop", "while loop", "accumulator", "input", "int", "float"],
      commonMisconceptions: [
        "Forgetting to convert input() string to number",
        "Reinitialising total inside the loop",
        "Printing inside instead of after the loop",
      ],
    },
    hintFramework: [
      "Think about what information needs to be stored before the loop begins.",
      "You need a loop that repeats exactly 5 times — which loop type is best for a known number of iterations?",
      "Inside the loop, you need to ask for a number. Remember that input() always returns a string — how do you fix that?",
      "Try creating a variable called `total = 0` before your loop. Inside the loop, add each number to it with `total = total + number`.",
      "Your structure should be: total = 0, then a for loop with int(input()), updating total each time, then print(total) after the loop.",
    ],
    modelAnswerTemplate: "total = 0\nfor i in range(5):\n    num = int(input('Enter a number: '))\n    total = total + num\nprint('Total:', total)",
  },
  {
    moduleCode: "ALGO-02",
    questionType: "short_answer",
    templateName: "Binary search explanation",
    promptTemplate: "Explain how binary search works and state one advantage it has over linear search.",
    generationRules: { parameters: [], difficulty: "medium" },
    rubric: {
      maxMarks: 4,
      markSchemePoints: [
        "The list must be sorted first",
        "Check the middle element of the list",
        "If the target is less than the middle, search the left half; if greater, search the right half",
        "Advantage: faster than linear search for large lists / O(log n) vs O(n)",
      ],
      acceptedConcepts: ["sorted", "middle", "halve", "divide", "log n"],
      commonMisconceptions: [
        "Thinking binary search works on unsorted data",
        "Not mentioning the sorted requirement",
      ],
    },
    hintFramework: [
      "Think about what condition the list must satisfy before binary search can work.",
      "Binary search divides the problem in half each time — where does it start looking?",
      "After checking the midpoint, how does binary search decide which half to continue with?",
      "Compare binary search to looking up a word in a dictionary — you don't start from the first page.",
      "Binary search needs a sorted list, checks the midpoint, then discards the irrelevant half and repeats.",
    ],
    modelAnswerTemplate: "Binary search requires a sorted list. It checks the middle element, then discards the half where the target cannot be. This halving continues until the target is found or the list is exhausted. Advantage: O(log n) time complexity — much faster than linear search O(n) for large lists.",
  },
  {
    moduleCode: "DATA-01",
    questionType: "short_answer",
    templateName: "Binary to denary conversion",
    promptTemplate: "Convert the binary number 10110101 to denary (base 10). Show your working.",
    generationRules: { parameters: ["binaryValue"], difficulty: "easy" },
    rubric: {
      maxMarks: 3,
      markSchemePoints: [
        "Correctly identifies place values (128, 64, 32, 16, 8, 4, 2, 1)",
        "Correctly sums the place values where bit is 1 (128 + 32 + 16 + 4 + 1 = 181)",
        "Final answer: 181",
      ],
      acceptedConcepts: ["place value", "128", "32", "16", "4", "1", "181"],
      commonMisconceptions: [
        "Starting from the wrong end",
        "Forgetting to include a place value",
        "Adding place values where bit is 0",
      ],
    },
    hintFramework: [
      "Write out the binary place values from right to left: 1, 2, 4, 8, 16, 32, 64, 128.",
      "Align each bit of 10110101 with its place value.",
      "Only add the place values where the bit is 1, not where it is 0.",
      "10110101: positions 1, 4, 16, 32, and 128 have a 1. Add those values.",
      "128 + 32 + 16 + 4 + 1 = ?",
    ],
    modelAnswerTemplate: "Place values: 128  64  32  16  8  4  2  1\nBits:           1   0   1   1  0  1  0  1\nAdd where bit=1: 128 + 32 + 16 + 4 + 1 = 181",
  },
  {
    moduleCode: "PROG-03",
    questionType: "coding",
    templateName: "Function with return value",
    promptTemplate: "Write a Python function called `calculate_area` that takes two parameters, `width` and `height`, and returns the area of a rectangle. Then call the function with width=7 and height=4 and print the result.",
    generationRules: { parameters: ["functionName", "width", "height"], difficulty: "easy" },
    rubric: {
      maxMarks: 5,
      markSchemePoints: [
        "def keyword used with correct function name",
        "Two parameters (width and height) defined",
        "Area calculated as width * height inside the function",
        "return statement used to return the result",
        "Function called with correct arguments and result printed",
      ],
      acceptedConcepts: ["def", "return", "parameter", "argument", "width", "height"],
      commonMisconceptions: [
        "Using print inside the function instead of return",
        "Not calling the function after defining it",
        "Confusing parameters with arguments",
      ],
    },
    hintFramework: [
      "In Python, functions are defined with the `def` keyword followed by the function name and parentheses.",
      "Your function needs to accept two inputs — these are the parameters in the parentheses.",
      "Inside the function, calculate the area by multiplying the two parameters together.",
      "Use `return` to send the result back to the caller — do not use `print` inside the function.",
      "After the function definition, call it: `result = calculate_area(7, 4)` then `print(result)`.",
    ],
    modelAnswerTemplate: "def calculate_area(width, height):\n    return width * height\n\nresult = calculate_area(7, 4)\nprint(result)  # Output: 28",
  },
];
