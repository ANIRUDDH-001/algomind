export const MOCK_INTERVIEW = {
    intro: {
        question: "Welcome to the interview. Could you explain the difference between a process and a thread?",
        answer: "A process is an execution of a program, while a thread is a lightweight process within the program.",
    },
    follow_up: {
        question: "Good. How do they handle memory differently?",
        answer: "Processes have separate memory spaces, but threads share the same memory space.",
    },
    interruption: {
        user_interruption: "Wait, actually, let me correct that.",
        ai_response: "Sure, go ahead.",
    },
    code_challenge: {
        problem: "Implement a binary search tree in Python.",
        solution: "class Node:\n    def __init__(self, key):\n        self.left = None\n        self.right = None\n        self.val = key",
    },
    assessment: {
        score: 8.5,
        feedback: "Strong understanding of operating system concepts.",
    }
};

export const MOCK_USER = {
    id: "test-user-123",
    email: "test@algomind.ai",
    name: "Test User",
};
