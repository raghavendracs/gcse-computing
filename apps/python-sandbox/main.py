import subprocess
import sys
import re
import json
import os as _os
import time
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

MAX_TIMEOUT_MS = int(_os.environ.get("MAX_TIMEOUT_MS", "5000"))

BLOCKED_IMPORTS = {
    "os", "subprocess", "socket", "sys", "shutil", "pathlib",
    "importlib", "ctypes", "multiprocessing", "threading",
    "urllib", "http", "ftplib", "smtplib", "telnetlib",
}

class TestCase(BaseModel):
    input: str
    expectedOutput: str

class ExecuteRequest(BaseModel):
    code: str
    testCases: list[TestCase]
    timeoutMs: int = 5000

class TestResult(BaseModel):
    input: str
    expectedOutput: str
    actualOutput: str
    passed: bool

class ExecuteResponse(BaseModel):
    testResults: list[TestResult]
    stdout: str
    stderr: str
    executionTimeMs: int
    timedOut: bool
    blocked: bool
    blockReason: Optional[str] = None

def check_blocked_imports(code: str) -> Optional[str]:
    # Match: import os, import os.path, from os import ..., __import__("os")
    patterns = [
        r'^\s*import\s+(\w+)',
        r'^\s*from\s+(\w+)',
        r'__import__\s*\(\s*["\'](\w+)',
    ]
    for line in code.splitlines():
        for pattern in patterns:
            m = re.search(pattern, line)
            if m:
                mod = m.group(1)
                if mod in BLOCKED_IMPORTS:
                    return f"import {mod}"
    return None

# input(prompt) writes the prompt to STDOUT, which would pollute the output we
# compare against expectedOutput (a program that reads from stdin and prints its
# answer should not have "Enter a value:" prepended to that answer). This shim
# reads from stdin exactly like the builtin but drops the prompt. Kept on a
# single physical line so user tracebacks keep their original line numbers.
INPUT_PROMPT_SHIM = "_orig_input = input; input = lambda *a, **k: _orig_input()\n"


def run_single_test(code: str, test_input: str, timeout_s: float) -> tuple[str, str, bool, bool]:
    """Returns (stdout, stderr, timed_out, errored)"""
    try:
        result = subprocess.run(
            [sys.executable, "-c", INPUT_PROMPT_SHIM + code],
            input=test_input,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
        errored = result.returncode != 0
        return result.stdout.strip(), result.stderr.strip(), False, errored
    except subprocess.TimeoutExpired:
        return "", "", True, False

@app.post("/execute", response_model=ExecuteResponse)
def execute(req: ExecuteRequest):
    # Safety check
    blocked = check_blocked_imports(req.code)
    if blocked:
        empty_results = [
            TestResult(
                input=tc.input,
                expectedOutput=tc.expectedOutput,
                actualOutput="",
                passed=False,
            )
            for tc in req.testCases
        ]
        return ExecuteResponse(
            testResults=empty_results,
            stdout="", stderr="",
            executionTimeMs=0,
            timedOut=False,
            blocked=True,
            blockReason=blocked,
        )

    timeout_s = min(req.timeoutMs, MAX_TIMEOUT_MS) / 1000
    results: list[TestResult] = []
    all_stderr = ""
    timed_out = False
    start = time.time()

    for tc in req.testCases:
        stdout, stderr, did_timeout, errored = run_single_test(req.code, tc.input, timeout_s)
        if did_timeout:
            timed_out = True
            results.append(TestResult(
                input=tc.input,
                expectedOutput=tc.expectedOutput,
                actualOutput="",
                passed=False,
            ))
            break
        if stderr:
            all_stderr += ("\n" if all_stderr else "") + stderr
        results.append(TestResult(
            input=tc.input,
            expectedOutput=tc.expectedOutput,
            actualOutput=stdout,
            passed=(not errored) and (stdout == tc.expectedOutput.strip()),
        ))

    elapsed_ms = int((time.time() - start) * 1000)

    return ExecuteResponse(
        testResults=results,
        stdout="",
        stderr=all_stderr,
        executionTimeMs=elapsed_ms,
        timedOut=timed_out,
        blocked=False,
        blockReason=None,
    )

@app.get("/health")
def health():
    return {"status": "ok"}
