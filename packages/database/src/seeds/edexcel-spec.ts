import { SpecTopic } from "../models/spec-topic";
import { Module } from "../models/module";

const EDEXCEL_TOPICS = [
  // Topic 1: Computational Thinking (Paper 01)
  { code: "1.1.1", title: "Decomposition", topicGroup: "1.1", topicGroupTitle: "Computational Thinking", paper: "01" as const, sortOrder: 101 },
  { code: "1.1.2", title: "Abstraction", topicGroup: "1.1", topicGroupTitle: "Computational Thinking", paper: "01" as const, sortOrder: 102 },
  { code: "1.1.3", title: "Algorithmic thinking", topicGroup: "1.1", topicGroupTitle: "Computational Thinking", paper: "01" as const, sortOrder: 103 },
  { code: "1.2.1", title: "Sequence, selection and iteration", topicGroup: "1.2", topicGroupTitle: "Programming Constructs", paper: "01" as const, sortOrder: 104 },
  { code: "1.2.2", title: "Input, output and process", topicGroup: "1.2", topicGroupTitle: "Programming Constructs", paper: "01" as const, sortOrder: 105 },
  { code: "1.2.3", title: "Variables and constants", topicGroup: "1.2", topicGroupTitle: "Programming Constructs", paper: "01" as const, sortOrder: 106 },
  { code: "1.3.1", title: "Sorting algorithms (bubble, merge, insertion)", topicGroup: "1.3", topicGroupTitle: "Algorithms", paper: "01" as const, sortOrder: 107 },
  { code: "1.3.2", title: "Searching algorithms (linear, binary)", topicGroup: "1.3", topicGroupTitle: "Algorithms", paper: "01" as const, sortOrder: 108 },
  { code: "1.4.1", title: "Truth tables (AND, OR, NOT, XOR)", topicGroup: "1.4", topicGroupTitle: "Logic", paper: "01" as const, sortOrder: 109 },
  { code: "1.4.2", title: "Logic circuits and gate diagrams", topicGroup: "1.4", topicGroupTitle: "Logic", paper: "01" as const, sortOrder: 110 },

  // Topic 2: Data (Paper 01)
  { code: "2.1.1", title: "Binary, denary and hexadecimal conversion", topicGroup: "2.1", topicGroupTitle: "Number Systems", paper: "01" as const, sortOrder: 201 },
  { code: "2.1.2", title: "Binary arithmetic (addition, overflow)", topicGroup: "2.1", topicGroupTitle: "Number Systems", paper: "01" as const, sortOrder: 202 },
  { code: "2.1.3", title: "Sign and magnitude, two's complement", topicGroup: "2.1", topicGroupTitle: "Number Systems", paper: "01" as const, sortOrder: 203 },
  { code: "2.1.4", title: "Binary shifts (left and right)", topicGroup: "2.1", topicGroupTitle: "Number Systems", paper: "01" as const, sortOrder: 204 },
  { code: "2.2.1", title: "Character encoding (ASCII and Unicode)", topicGroup: "2.2", topicGroupTitle: "Data Representation", paper: "01" as const, sortOrder: 205 },
  { code: "2.2.2", title: "Images (pixels, colour depth, resolution)", topicGroup: "2.2", topicGroupTitle: "Data Representation", paper: "01" as const, sortOrder: 206 },
  { code: "2.2.3", title: "Sound (sample rate, bit depth, Nyquist)", topicGroup: "2.2", topicGroupTitle: "Data Representation", paper: "01" as const, sortOrder: 207 },
  { code: "2.2.4", title: "Compression (lossy, lossless, RLE, Huffman)", topicGroup: "2.2", topicGroupTitle: "Data Representation", paper: "01" as const, sortOrder: 208 },
  { code: "2.3.1", title: "Units of data (bits, bytes, KB, MB, GB, TB)", topicGroup: "2.3", topicGroupTitle: "Storage", paper: "01" as const, sortOrder: 209 },
  { code: "2.3.2", title: "Storage media and their characteristics", topicGroup: "2.3", topicGroupTitle: "Storage", paper: "01" as const, sortOrder: 210 },

  // Topic 3: Computers (Paper 01)
  { code: "3.1.1", title: "CPU components (ALU, CU, registers, cache)", topicGroup: "3.1", topicGroupTitle: "CPU Architecture", paper: "01" as const, sortOrder: 301 },
  { code: "3.1.2", title: "Von Neumann and Harvard architectures", topicGroup: "3.1", topicGroupTitle: "CPU Architecture", paper: "01" as const, sortOrder: 302 },
  { code: "3.1.3", title: "Fetch-decode-execute cycle", topicGroup: "3.1", topicGroupTitle: "CPU Architecture", paper: "01" as const, sortOrder: 303 },
  { code: "3.1.4", title: "CPU performance factors (clock speed, cores, cache)", topicGroup: "3.1", topicGroupTitle: "CPU Architecture", paper: "01" as const, sortOrder: 304 },
  { code: "3.2.1", title: "Primary and secondary storage", topicGroup: "3.2", topicGroupTitle: "Memory & Storage", paper: "01" as const, sortOrder: 305 },
  { code: "3.2.2", title: "Comparing storage types (HDD, SSD, optical, flash)", topicGroup: "3.2", topicGroupTitle: "Memory & Storage", paper: "01" as const, sortOrder: 306 },
  { code: "3.3.1", title: "Input, output and storage devices", topicGroup: "3.3", topicGroupTitle: "Hardware Devices", paper: "01" as const, sortOrder: 307 },
  { code: "3.3.2", title: "Embedded systems and their uses", topicGroup: "3.3", topicGroupTitle: "Hardware Devices", paper: "01" as const, sortOrder: 308 },
  { code: "3.4.1", title: "Operating system functions", topicGroup: "3.4", topicGroupTitle: "Software", paper: "01" as const, sortOrder: 309 },
  { code: "3.4.2", title: "Utility software", topicGroup: "3.4", topicGroupTitle: "Software", paper: "01" as const, sortOrder: 310 },
  { code: "3.4.3", title: "Open source vs closed source software", topicGroup: "3.4", topicGroupTitle: "Software", paper: "01" as const, sortOrder: 311 },
  { code: "3.5.1", title: "High-level and low-level programming languages", topicGroup: "3.5", topicGroupTitle: "Programming Languages", paper: "01" as const, sortOrder: 312 },
  { code: "3.5.2", title: "Translators: compiler, interpreter, assembler", topicGroup: "3.5", topicGroupTitle: "Programming Languages", paper: "01" as const, sortOrder: 313 },
  { code: "3.5.3", title: "IDE features (editor, debugger, translator)", topicGroup: "3.5", topicGroupTitle: "Programming Languages", paper: "01" as const, sortOrder: 314 },

  // Topic 4: Networks (Paper 01)
  { code: "4.1.1", title: "LAN and WAN", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 401 },
  { code: "4.1.2", title: "Network hardware (router, switch, NIC, WAP)", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 402 },
  { code: "4.1.3", title: "Network topologies (bus, star, mesh)", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 403 },
  { code: "4.1.4", title: "Client-server vs peer-to-peer", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 404 },
  { code: "4.1.5", title: "Protocols (TCP/IP, HTTP, HTTPS, FTP, SMTP, IMAP)", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 405 },
  { code: "4.1.6", title: "Network layers and the TCP/IP model", topicGroup: "4.1", topicGroupTitle: "Network Types & Concepts", paper: "01" as const, sortOrder: 406 },
  { code: "4.2.1", title: "Threats (malware, phishing, brute force, DDoS)", topicGroup: "4.2", topicGroupTitle: "Network Security", paper: "01" as const, sortOrder: 407 },
  { code: "4.2.2", title: "Security measures (firewall, encryption, authentication)", topicGroup: "4.2", topicGroupTitle: "Network Security", paper: "01" as const, sortOrder: 408 },

  // Topic 5: Issues and Impact (Paper 01)
  { code: "5.1.1", title: "Environmental impact of computing", topicGroup: "5.1", topicGroupTitle: "Environmental Issues", paper: "01" as const, sortOrder: 501 },
  { code: "5.2.1", title: "Ethical issues in computing", topicGroup: "5.2", topicGroupTitle: "Ethical & Legal Issues", paper: "01" as const, sortOrder: 502 },
  { code: "5.2.2", title: "Legal issues (Computer Misuse Act, DPA, Copyright)", topicGroup: "5.2", topicGroupTitle: "Ethical & Legal Issues", paper: "01" as const, sortOrder: 503 },
  { code: "5.3.1", title: "Cybersecurity threats and attack types", topicGroup: "5.3", topicGroupTitle: "Cybersecurity", paper: "01" as const, sortOrder: 504 },
  { code: "5.3.2", title: "Cybersecurity prevention and protection measures", topicGroup: "5.3", topicGroupTitle: "Cybersecurity", paper: "01" as const, sortOrder: 505 },

  // Topic 6: Problem Solving with Programming (Paper 02)
  { code: "6.1.1", title: "Develop code to solve problems", topicGroup: "6.1", topicGroupTitle: "Developing Code", paper: "02" as const, sortOrder: 601 },
  { code: "6.1.2", title: "Interpret, correct and complete code", topicGroup: "6.1", topicGroupTitle: "Developing Code", paper: "02" as const, sortOrder: 602 },
  { code: "6.2.1", title: "Sequence", topicGroup: "6.2", topicGroupTitle: "Programming Constructs", paper: "02" as const, sortOrder: 603 },
  { code: "6.2.2", title: "Selection (if, elif, else)", topicGroup: "6.2", topicGroupTitle: "Programming Constructs", paper: "02" as const, sortOrder: 604 },
  { code: "6.2.3", title: "Iteration (for loops, while loops)", topicGroup: "6.2", topicGroupTitle: "Programming Constructs", paper: "02" as const, sortOrder: 605 },
  { code: "6.3.1", title: "Integers, floats, strings and booleans", topicGroup: "6.3", topicGroupTitle: "Data Types & Structures", paper: "02" as const, sortOrder: 606 },
  { code: "6.3.2", title: "Lists and 2D lists", topicGroup: "6.3", topicGroupTitle: "Data Types & Structures", paper: "02" as const, sortOrder: 607 },
  { code: "6.3.3", title: "Records and file handling", topicGroup: "6.3", topicGroupTitle: "Data Types & Structures", paper: "02" as const, sortOrder: 608 },
  { code: "6.4.1", title: "Input, output and importing modules", topicGroup: "6.4", topicGroupTitle: "I/O and String Handling", paper: "02" as const, sortOrder: 609 },
  { code: "6.4.2", title: "String manipulation (slicing, methods, formatting)", topicGroup: "6.4", topicGroupTitle: "I/O and String Handling", paper: "02" as const, sortOrder: 610 },
  { code: "6.5.1", title: "Arithmetic, comparison, logical and assignment operators", topicGroup: "6.5", topicGroupTitle: "Operators", paper: "02" as const, sortOrder: 611 },
  { code: "6.6.1", title: "Functions and procedures", topicGroup: "6.6", topicGroupTitle: "Subprograms", paper: "02" as const, sortOrder: 612 },
  { code: "6.6.2", title: "Parameters and return values", topicGroup: "6.6", topicGroupTitle: "Subprograms", paper: "02" as const, sortOrder: 613 },
  { code: "6.6.3", title: "Local and global variables", topicGroup: "6.6", topicGroupTitle: "Subprograms", paper: "02" as const, sortOrder: 614 },
];

export async function seedEdexcelSpec(): Promise<void> {
  console.log("Seeding Edexcel GCSE CS spec topics...");
  for (const topic of EDEXCEL_TOPICS) {
    await SpecTopic.findOneAndUpdate(
      { code: topic.code, examBoard: "Edexcel" },
      { ...topic, examBoard: "Edexcel" },
      { upsert: true, new: true },
    );
  }
  console.log(`Seeded ${EDEXCEL_TOPICS.length} Edexcel spec topics.`);
}

export async function seedEdexcelModules(): Promise<void> {
  console.log("Seeding Edexcel modules for each spec topic...");
  let created = 0;
  for (const topic of EDEXCEL_TOPICS) {
    const topicType = topic.paper === "02" ? "programming" : "theory";
    const existing = await Module.findOne({ examBoard: "Edexcel", moduleCode: topic.code });
    if (!existing) {
      await Module.create({
        examBoard: "Edexcel",
        moduleCode: topic.code,
        moduleName: topic.title,
        topicName: topic.topicGroupTitle,
        topicType,
        description: `Edexcel GCSE Computer Science — ${topic.topicGroupTitle}: ${topic.title} (${topic.code})`,
        specReferences: [topic.code],
        difficultyBands: ["easy", "medium", "hard"],
        sortOrder: topic.sortOrder,
      });
      created++;
    }
  }
  console.log(`Created ${created} new modules (${EDEXCEL_TOPICS.length - created} already existed).`);
}
