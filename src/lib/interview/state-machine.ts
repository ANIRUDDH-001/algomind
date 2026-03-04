export type InterviewState =
    | 'idle'
    | 'problem-intro'      // AI introduces problem
    | 'user-thinking'      // User explains approach
    | 'ai-clarifying'      // AI asks questions
    | 'user-solving'       // User walks through solution
    | 'ai-feedback'        // AI provides hints/feedback
    | 'user-coding'        // User is writing code in editor
    | 'solution-review'    // Final discussion
    | 'assessment'         // AI generates cognitive report
    | 'completed';

export type InterviewEvent =
    | 'START'
    | 'USER_FINISHED_SPEAKING'
    | 'AI_FINISHED_SPEAKING'
    | 'MOVE_TO_SOLVING'
    | 'REQUEST_HINT'
    | 'SUBMIT_SOLUTION'
    | 'FINISH_INTERVIEW'
    | 'TERMINATE_INTERVIEW'
    | 'USER_STARTED_CODING'
    | 'USER_SHARED_CODE'
    | 'USER_STOPPED_CODING';

export class InterviewStateMachine {
    private state: InterviewState = 'idle';

    getState(): InterviewState {
        return this.state;
    }

    transition(event: InterviewEvent): InterviewState {
        const _previous = this.state;

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
                if (event === 'AI_FINISHED_SPEAKING') this.state = 'user-thinking'; // Loop back for more discussion
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
                if (event === 'USER_FINISHED_SPEAKING') this.state = 'ai-feedback'; // User responds mid-feedback → re-evaluate
                if (event === 'SUBMIT_SOLUTION') this.state = 'solution-review';    // User submits final solution
                if (event === 'FINISH_INTERVIEW') this.state = 'assessment';         // Force end (end button)
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
                if (event === 'FINISH_INTERVIEW') this.state = 'assessment';
                if (event === 'TERMINATE_INTERVIEW') this.state = 'assessment';
                break;

            case 'assessment':
                if (event === 'AI_FINISHED_SPEAKING') this.state = 'completed';
                break;

            case 'completed':
                // No transitions allowed from completed state
                // Any call to transition() from here is a no-op
                break;
        }

        return this.state;
    }

    reset() {
        this.state = 'idle';
    }
}
