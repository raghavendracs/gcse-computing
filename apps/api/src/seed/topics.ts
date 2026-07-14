export const seedTopics = [
  // Area 1: Fundamentals (areaSortOrder: 1)
  {
    area: "Fundamentals",
    areaSortOrder: 1,
    name: "Variables & assignment",
    slug: "variables-assignment",
    sortOrder: 1,
    description:
      "Declaring variables, assigning values, naming conventions and basic data types in Python.",
  },
  {
    area: "Fundamentals",
    areaSortOrder: 1,
    name: "Data types & casting",
    slug: "data-types-casting",
    sortOrder: 2,
    description:
      "Integer, float, string, boolean; type() and explicit casting with int(), str(), float().",
  },
  {
    area: "Fundamentals",
    areaSortOrder: 1,
    name: "Input & output",
    slug: "input-output",
    sortOrder: 3,
    description: "Using input() and print(), f-strings, and formatting output.",
  },
  {
    area: "Fundamentals",
    areaSortOrder: 1,
    name: "Arithmetic & operators",
    slug: "arithmetic-operators",
    sortOrder: 4,
    description:
      "Arithmetic operators (+, -, *, /, //, %, **), operator precedence, and expressions.",
  },

  // Area 2: Selection (areaSortOrder: 2)
  {
    area: "Selection",
    areaSortOrder: 2,
    name: "if / elif / else",
    slug: "if-elif-else",
    sortOrder: 1,
    description: "Writing conditional branches with if, elif, and else in Python.",
  },
  {
    area: "Selection",
    areaSortOrder: 2,
    name: "Comparison & logical operators",
    slug: "comparison-logical-operators",
    sortOrder: 2,
    description:
      "Comparison operators (==, !=, <, >, <=, >=) and logical operators (and, or, not).",
  },
  {
    area: "Selection",
    areaSortOrder: 2,
    name: "Nested conditionals",
    slug: "nested-conditionals",
    sortOrder: 3,
    description: "Nesting if statements inside other if blocks and managing complex logic.",
  },
  {
    area: "Selection",
    areaSortOrder: 2,
    name: "Boolean expressions",
    slug: "boolean-expressions",
    sortOrder: 4,
    description:
      "Constructing and evaluating boolean expressions, truth tables, and short-circuit evaluation.",
  },

  // Area 3: Iteration (areaSortOrder: 3)
  {
    area: "Iteration",
    areaSortOrder: 3,
    name: "for loops",
    slug: "for-loops",
    sortOrder: 1,
    description: "Iterating with for loops, range(), and over sequences.",
  },
  {
    area: "Iteration",
    areaSortOrder: 3,
    name: "while loops",
    slug: "while-loops",
    sortOrder: 2,
    description: "Using while loops with conditions, avoiding infinite loops.",
  },
  {
    area: "Iteration",
    areaSortOrder: 3,
    name: "Nested loops",
    slug: "nested-loops",
    sortOrder: 3,
    description: "Writing loops inside loops for grids, tables, and multi-level iteration.",
  },
  {
    area: "Iteration",
    areaSortOrder: 3,
    name: "break & continue",
    slug: "break-continue",
    sortOrder: 4,
    description: "Controlling loop flow with break (exit) and continue (skip to next iteration).",
  },

  // Area 4: Data Structures (areaSortOrder: 4)
  {
    area: "Data Structures",
    areaSortOrder: 4,
    name: "Lists",
    slug: "lists",
    sortOrder: 1,
    description: "Creating, indexing, slicing, and modifying lists; append, remove, pop.",
  },
  {
    area: "Data Structures",
    areaSortOrder: 4,
    name: "2D lists",
    slug: "2d-lists",
    sortOrder: 2,
    description: "Two-dimensional lists (lists of lists) for grids and tabular data.",
  },
  {
    area: "Data Structures",
    areaSortOrder: 4,
    name: "Strings & string methods",
    slug: "strings-string-methods",
    sortOrder: 3,
    description:
      "String operations, methods (upper, lower, split, strip, replace), and indexing.",
  },
  {
    area: "Data Structures",
    areaSortOrder: 4,
    name: "Dictionaries",
    slug: "dictionaries",
    sortOrder: 4,
    description: "Key-value pairs, accessing, adding, updating, and iterating dictionaries.",
  },

  // Area 5: Functions & Procedures (areaSortOrder: 5)
  {
    area: "Functions & Procedures",
    areaSortOrder: 5,
    name: "Defining & calling functions",
    slug: "defining-calling-functions",
    sortOrder: 1,
    description: "def keyword, calling functions, void vs value-returning functions.",
  },
  {
    area: "Functions & Procedures",
    areaSortOrder: 5,
    name: "Parameters & arguments",
    slug: "parameters-arguments",
    sortOrder: 2,
    description: "Passing data into functions via parameters and arguments.",
  },
  {
    area: "Functions & Procedures",
    areaSortOrder: 5,
    name: "Return values",
    slug: "return-values",
    sortOrder: 3,
    description: "Using return to send values back from functions.",
  },
  {
    area: "Functions & Procedures",
    areaSortOrder: 5,
    name: "Scope",
    slug: "scope",
    sortOrder: 4,
    description: "Local vs global scope, the global keyword, and avoiding side effects.",
  },

  // Area 6: Algorithms (areaSortOrder: 6)
  {
    area: "Algorithms",
    areaSortOrder: 6,
    name: "Searching algorithms",
    slug: "searching-algorithms",
    sortOrder: 1,
    description: "Linear search and binary search: implementation, comparison, and complexity.",
  },
  {
    area: "Algorithms",
    areaSortOrder: 6,
    name: "Sorting algorithms",
    slug: "sorting-algorithms",
    sortOrder: 2,
    description: "Bubble sort, insertion sort, and merge sort: implementation and trace.",
  },
  {
    area: "Algorithms",
    areaSortOrder: 6,
    name: "Decomposition & abstraction",
    slug: "decomposition-abstraction",
    sortOrder: 3,
    description:
      "Breaking problems into sub-problems; identifying what matters and ignoring the rest.",
  },
  {
    area: "Algorithms",
    areaSortOrder: 6,
    name: "Pseudo-code & flowcharts",
    slug: "pseudocode-flowcharts",
    sortOrder: 4,
    description: "Writing pseudo-code and drawing flowcharts to represent algorithms.",
  },

  // Area 7: File Handling & Exceptions (areaSortOrder: 7)
  {
    area: "File Handling & Exceptions",
    areaSortOrder: 7,
    name: "Reading files",
    slug: "reading-files",
    sortOrder: 1,
    description: "Opening and reading text files with open(), read(), and readlines().",
  },
  {
    area: "File Handling & Exceptions",
    areaSortOrder: 7,
    name: "Writing files",
    slug: "writing-files",
    sortOrder: 2,
    description: "Writing and appending to files, using with open() context manager.",
  },
  {
    area: "File Handling & Exceptions",
    areaSortOrder: 7,
    name: "try / except",
    slug: "try-except",
    sortOrder: 3,
    description: "Handling runtime errors with try/except blocks, catching specific exceptions.",
  },
  {
    area: "File Handling & Exceptions",
    areaSortOrder: 7,
    name: "Validation & error handling",
    slug: "validation-error-handling",
    sortOrder: 4,
    description: "Defensive design: input validation, range checks, and graceful error handling.",
  },

  // Area 8: Object-Oriented Programming (areaSortOrder: 8)
  {
    area: "Object-Oriented Programming",
    areaSortOrder: 8,
    name: "Classes & objects",
    slug: "classes-objects",
    sortOrder: 1,
    description: "Defining classes, creating object instances, and the __init__ constructor.",
  },
  {
    area: "Object-Oriented Programming",
    areaSortOrder: 8,
    name: "Attributes & methods",
    slug: "attributes-methods",
    sortOrder: 2,
    description: "Instance attributes, instance methods, and using self.",
  },
  {
    area: "Object-Oriented Programming",
    areaSortOrder: 8,
    name: "Inheritance",
    slug: "inheritance",
    sortOrder: 3,
    description: "Subclasses, super(), overriding methods, and the is-a relationship.",
  },
  {
    area: "Object-Oriented Programming",
    areaSortOrder: 8,
    name: "Encapsulation",
    slug: "encapsulation",
    sortOrder: 4,
    description:
      "Public vs private attributes, getters and setters, and hiding implementation details.",
  },
];
