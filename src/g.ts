import Database from 'bun:sqlite';

interface Term {
    term_id: number;
    start_date: number;
    state: string; // e.g., "In Voting", "In Term"
}

class Democracy {
    private currentTerm?: Term;
    private voting: boolean = false;
    private virtualTime: Date;
    private db: Database;

    constructor(db: Database, initialDate: Date) {
        this.db = db;
        this.virtualTime = initialDate;

        // Initialize DB if necessary
        this.db.run(`CREATE TABLE IF NOT EXISTS terms (
      term_id INTEGER PRIMARY KEY,
      start_date INTEGER,
      state TEXT
    )`);

        this.currentTerm = this.loadCurrentTerm();
        this.setupNextEvent();

        // Simulate passing of virtual days every second
        setInterval(() => this.advanceVirtualDay(), 1000);
    }

    private loadCurrentTerm(): Term | undefined {
        let stmt = this.db.query('SELECT * FROM terms ORDER BY start_date DESC LIMIT 1');
        let rows: Term[] = stmt.all() as Term[];
        return rows.length > 0 ? rows[0] : undefined;
    }

    private getMonthId(date: Date): number {
        return date.getFullYear() * 100 + (date.getMonth() + 1);
    }

    private setupNextEvent() {
        const currentMonthId = this.getMonthId(this.virtualTime);
        const virtualDay = this.virtualTime.getDate();

        // Logging state at each day during the interval
        this.logState();

        if (!this.voting && (virtualDay >= 24 || this.getMonthId(new Date(this.currentTerm?.start_date || 0)) !== currentMonthId)) {
            // If it's 24th or the current month ID does not match the current term, start voting
            this.startVoting();
        } else if (virtualDay === 1) {
            // On the 1st of the month, attempt to start a new term
            this.attemptToStartNewTerm();
        }
    }

    private startVoting() {
        console.log(`${this.virtualTime.toISOString().split('T')[0]}: Voting starting`);
        this.voting = true;

        // Update the state in the database
        const start_date = this.virtualTime.getTime();
        const termId = this.getMonthId(this.virtualTime);

        this.db.run('INSERT INTO terms (term_id, start_date, state) VALUES (?, ?, ?)', [
            termId,
            start_date,
            'In Voting',
        ]);

        this.currentTerm = { term_id: termId, start_date, state: 'In Voting' };
    }

    private attemptToStartNewTerm() {
        if (this.voting) {
            // Calculate days since voting started
            const daysSinceVotingStarted = Math.floor(
                (this.virtualTime.getTime() - (this.currentTerm?.start_date || 0)) / (1000 * 60 * 60 * 24)
            );

            if (daysSinceVotingStarted >= 3) {
                this.voting = false;
                this.startNewTerm();
            }
        }
    }

    private startNewTerm() {
        console.log(`${this.virtualTime.toISOString().split('T')[0]}: Term ended, starting new term`);

        const start_date = this.virtualTime.getTime();
        const termId = this.getMonthId(this.virtualTime);

        this.currentTerm = { term_id: termId, start_date, state: 'In Term' };
        this.db.run('UPDATE terms SET state = ? WHERE term_id = ?', ['In Term', termId]);
    }

    private advanceVirtualDay() {
        this.virtualTime.setDate(this.virtualTime.getDate() + 1);
        this.setupNextEvent();
    }

    private logState() {
        const currentTermState = this.currentTerm ? this.currentTerm.state : 'N/A';
        const termId = this.currentTerm?.term_id || 'N/A';
        console.log(`${this.virtualTime.toISOString().split('T')[0]}: State: ${currentTermState}. Current Term ID: ${termId}`);
    }
}

// Example initialization
const db = new Database('elections.db');
const startDate = new Date('2024-01-01T00:00:00Z'); // Initial virtual time
const democracy = new Democracy(db, startDate);