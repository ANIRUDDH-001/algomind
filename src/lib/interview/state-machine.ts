export type InterviewState =
    | 'idle'
    | 'problem-intro'      // AI introduces problem
    | 'user-thinking'      // User explains approach
    | 'ai-clarifying'      // AI asks questions
    | 'user-solving'       // User walks through solution
    | 'ai-feedback'        // AI provides hints/feedback
    | 'user-coding'        // User is writing code in editor
    | 'solution-review'    // Final discussion
    | 'complexity-analysis'// User explains time/space complexity
    | 'assessment'         // AI generates cognitive report
    | 'completed'
    | 'network-error'      // Edge state: User disconnected
    | 'paused';            // Edge state: User paused the interview

export type InterviewEvent =
    | 'START'
    | 'USER_FINISHED_SPEAKING'
    | 'AI_FINISHED_SPEAKING'
    | 'MOVE_TO_SOLVING'
    | 'MOVE_TO_COMPLEXITY'
    | 'REQUEST_HINT'
    | 'SUBMIT_SOLUTION'
    | 'FINISH_INTERVIEW'
    | 'TERMINATE_INTERVIEW'
    | 'USER_STARTED_CODING'
    | 'USER_SHARED_CODE'
    | 'USER_STOPPED_CODING'
    | 'NETWORK_DISCONNECT'
    | 'NETWORK_RECONNECT'
    | 'PAUSE_INTERVIEW'
    | 'RESUME_INTERVIEW';

export class InterviewStateMachine {
    private state: InterviewState = 'idle';
    private savedState: InterviewState | null = null;

    getState(): InterviewState {
        return this.state;
    }

    getSavedState(): InterviewState | null {
        return this.savedState;
    }

    transition(event: InterviewEvent): InterviewState {
        // Handle global edge case events first
        if (event === 'NETWORK_DISCONNECT' && !['completed', 'assessment', 'network-error'].includes(this.state)) {
            this.savedState = this.state;
            this.state = 'network-error';
            return this.state;
        }

        if (event === 'PAUSE_INTERVIEW' && !['completed', 'assessment', 'paused', 'network-error'].includes(this.state)) {
            this.savedState = this.state;
            this.state = 'paused';
            return this.state;
        }

        switch (this.state) {
            case 'idle':
                if (event === 'START') this.state = 'problem-intro';
                break;

            case 'problem-intro':
                if (event === 'AI_FINISHED_SPEAKING') this.state = 'user-thinking';
                break;

            case 'user-thinking':
                if (event === 'USER_FINISHED_SPEAKING') this.state = 'ai-clarifying';
                if (event === 'MOVE_TO_SOLVING') this.state = 'user-solving';
                if (event === 'TERMINATE_INTERVIEW') this.state = 'assessment';
                break;

            case 'ai-clarifying':
                if (event === 'AI_FINISHED_SPEAKING') this.state = 'user-thinking'; // Loop back
                if (event === 'MOVE_TO_SOLVING') this.state = 'user-solving';
                if (event === 'TERMINATE_INTERVIEW') this.state = 'assessment';
                break;

            case 'user-solving':
                if (event === 'USER_FINISHED_SPEAKING') this.state = 'ai-feedback';
                if (event === 'SUBMIT_SOLUTION') this.state = 'solution-review';
                if (event === 'USER_STARTED_CODING') this.state = 'user-coding';
                if (event === 'TERMINATE_INTERVIEW') this.state = 'assessment';
                break;

            case 'ai-feedback':
                if (event === 'AI_FINISHED_SPEAKING') this.state = 'user-solving';
                if (event === 'USER_FINISHED_SPEAKING') this.state = 'ai-feedback'; // mid-feedback
                if (event === 'SUBMIT_SOLUTION') this.state = 'solution-review';
                if (event === 'FINISH_INTERVIEW') this.state = 'assessment';
                if (event === 'USER_STARTED_CODING') this.state = 'user-coding';
                if (event === 'TERMINATE_INTERVIEW') this.state = 'assessment';
                break;

            case 'user-coding':
                if (event === 'USER_SHARED_CODE') this.state = 'ai-feedback';
                if (event === 'USER_STOPPED_CODING') this.state = 'user-solving';
                if (event === 'FINISH_INTERVIEW') this.state = 'assessment';
                if (event === 'TERMINATE_INTERVIEW') this.state = 'assessment';
                break;

            case 'solution-review':
                if (event === 'MOVE_TO_COMPLEXITY') this.state = 'complexity-analysis';
                if (event === 'FINISH_INTERVIEW') this.state = 'assessment';
                if (event === 'TERMINATE_INTERVIEW') this.state = 'assessment';
                break;

            case 'complexity-analysis':
                if (event === 'FINISH_INTERVIEW') this.state = 'assessment';
                if (event === 'TERMINATE_INTERVIEW') this.state = 'assessment';
                if (event === 'USER_FINISHED_SPEAKING') this.state = 'ai-feedback'; // AI evaluates complexity
                if (event === 'AI_FINISHED_SPEAKING') this.state = 'complexity-analysis';
                break;

            case 'assessment':
                if (event === 'AI_FINISHED_SPEAKING') this.state = 'completed';
                break;

            case 'network-error':
                if (event === 'NETWORK_RECONNECT' && this.savedState) {
                    this.state = this.savedState;
                    this.savedState = null;
                }
                if (event === 'TERMINATE_INTERVIEW') this.state = 'assessment';
                break;

            case 'paused':
                if (event === 'RESUME_INTERVIEW' && this.savedState) {
                    this.state = this.savedState;
                    this.savedState = null;
                }
                if (event === 'TERMINATE_INTERVIEW') this.state = 'assessment';
                break;

            case 'completed':
                // No transitions allowed
                break;
        }

        return this.state;
    }

    reset() {
        this.state = 'idle';
        this.savedState = null;
    }
}
