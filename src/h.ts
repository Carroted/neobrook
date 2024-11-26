import Database from 'bun:sqlite';

interface Term {
    term_id: number;
    start_date: number;
    state: "in_progress" | "voting_for_next_until_1st" | "voting_for_next_for_3_days" | "done";
    voting_for_next_start?: number;
}

class Democracy {
    db: Database;
    private virtualTime: Date;

    constructor(db: Database, initialDate: Date) {
        this.db = db;
        this.virtualTime = initialDate;

        this.db.run(`CREATE TABLE IF NOT EXISTS terms (
            term_id INTEGER,
            start_date INTEGER,
            state TEXT,
            voting_for_next_start INTEGER
          )`);

        setInterval(() => this.advanceVirtualDay(), 1000);
    }

    setState(state: "in_progress" | "voting_for_next_until_1st" | "voting_for_next_for_3_days" | "done") {
        const termId = this.getCurrentTerm()?.term_id;
        if (!termId) {
            throw new Error('Sudoers!');
        }
        this.db.run('UPDATE terms SET state = ? WHERE term_id = ?', [state, termId]);
    }

    setVotingStart(time: number) {
        const termId = this.getCurrentTerm()?.term_id;
        if (!termId) {
            throw new Error('Sudoers!');
        }
        this.db.run('UPDATE terms SET voting_for_next_start = ? WHERE term_id = ?', [time, termId]);
    }

    getMonthId(date: Date): number {
        return date.getUTCFullYear() * 100 + (date.getUTCMonth() + 1);
    }

    getCurrentTerm(): Term | undefined {
        let stmt = this.db.query('SELECT * FROM terms ORDER BY start_date DESC LIMIT 1');
        let rows: Term[] = stmt.all() as Term[];
        return rows.length > 0 ? rows[0] : undefined;
    }

    advanceVirtualDay() {
        this.virtualTime.setUTCDate(this.virtualTime.getUTCDate() + 1);
        this.setupNextEvent();
        this.logState();
    }

    private logState() {
        const term = this.getCurrentTerm();
        const currentTermState = term ? term.state : 'N/A';
        const termId = term?.term_id || 'N/A';
        console.log(`${this.virtualTime.toISOString().split('T')[0]}: State: ${currentTermState}. Current Term ID: ${termId}`);
    }

    private setupNextEvent() {
        const currentMonthId = this.getMonthId(this.virtualTime);
        const virtualDay = this.virtualTime.getUTCDate();
        const term = this.getCurrentTerm();

        if (!term) {
            const start_date = this.virtualTime.getTime();
            const termId = this.getMonthId(this.virtualTime);
            this.db.run('INSERT INTO terms (term_id, start_date, state) VALUES (?, ?, ?)', [
                termId,
                start_date,
                'in_progress',
            ]);
            this.startVoting(true);
            return;
        }

        const voting = term?.state === 'voting_for_next_until_1st' || term?.state === 'voting_for_next_for_3_days';

        //console.log('virtual day is', virtualDay, 'and that', (virtualDay === 1) ? 'is 1st' : 'is insane');

        if (!voting && (virtualDay >= 24 || this.getMonthId(new Date(term?.start_date || 0)) !== currentMonthId)) {
            // If it's 24th or the current month ID does not match the current term, start voting
            this.startVoting(virtualDay < 23);
            return;
        } else if (virtualDay === 1) { // first of a month and we are we are either Voting or idle
            if (term?.state === 'voting_for_next_until_1st') {
                // On the 1st of the month, attempt to start a new term
                this.startNewTerm();
                return;
            }
        }

        if (term?.state === 'voting_for_next_for_3_days' && ((term.voting_for_next_start || 0) + (1000 * 60 * 60 * 24 * 3) <= this.virtualTime.getTime())) {
            this.startNewTerm();
        }
    }

    private startVoting(three_day: boolean = false) {
        this.setState(three_day ? 'voting_for_next_for_3_days' : 'voting_for_next_until_1st');
        this.setVotingStart(this.virtualTime.getTime());
    }

    private startNewTerm() {
        this.setState('done');

        console.log(`${this.virtualTime.toISOString().split('T')[0]}: Term ended, starting new term`);

        const start_date = this.virtualTime.getTime();
        const termId = this.getMonthId(this.virtualTime);
        console.log('inserting', termId);

        this.db.run('INSERT INTO terms (term_id, start_date, state) VALUES (?, ?, ?)', [
            termId,
            start_date,
            'in_progress',
        ]);
    }
}

const db = new Database('elect.db');
const startDate = new Date('2027-06-03T00:00:00Z'); // Initial virtual time
const democracy = new Democracy(db, startDate);