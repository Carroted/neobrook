import parse from 'bash-parser';
import type { Command, ScriptAST, Word } from 'bash-parser';
import fs from 'fs';
import path from 'path';

function removeTrailingNewlines(str: string): string {
    while (str.endsWith('\n')) {
        str = str.substring(0, str.length - 1);
    }
    return str;
}

let dirsContainer = path.join(import.meta.dir, '..', 'dirs');
// create dirs container if it doesn't exist
if (!fs.existsSync(dirsContainer)) {
    fs.mkdirSync(dirsContainer);
}

function getUserPath(userID: string, p: string): string | null {
    // create user dir if it doesn't exist
    let userDir = path.join(dirsContainer, userID);
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir);
    }
    let dir = path.join(userDir, p);
    // make sure its in the user dir
    if (!dir.startsWith(userDir)) {
        return null;
    }
    return '/' + path.relative(userDir, dir);
}

let annihilated = false;

class ShellEnvironment {
    userID: string;
    cwd: string;
    env: {
        [key: string]: string
    };

    constructor(userID: string) {
        this.userID = userID;
        // we will run our setup script
        this.cwd = '/';
        const setupScript = `
        mkdir -p /home/${userID};
        mkdir -p /usr/bin;
        mkdir -p /usr/lib;
        mkdir -p /usr/include;
        mkdir -p /usr/share;
        mkdir -p /var;
        rm -rf /tmp;
        mkdir -p /tmp;
        mkdir -p /sys;
        mkdir -p /proc;
        mkdir -p /dev;
        mkdir -p /etc;

        echo 'echo "Welcome to the the brook shell :3"' > /usr/bin/help;
        `;
        this.run(setupScript);
        this.cwd = '/home/' + userID;
        this.env = {
            "HOME": "/home/" + userID,
            "REAL": "hii",
            "THE_ANSWER_TO_LIFE_THE_UNIVERSE_AND_EVERYTHING": "41.999999204",
            "PATH": "/usr/bin"
        };
    }

    getEnv(key: string): string {
        return this.env[key] ?? '';
    }

    handleWord(word: Word): string {
        if (!word) {
            console.log('wtf')
        }
        if (!word.expansion) {
            return word.text;
        }
        let substituted = word.text;
        for (let expansion of word.expansion) {
            if (expansion.type === 'ParameterExpansion') {
                substituted = substituted.substring(0, expansion.loc.start) + this.getEnv(expansion.parameter) + substituted.substring(expansion.loc.end + 1);
            }
            else if (expansion.type === 'CommandExpansion') {
                let out = this.handleScript(expansion.commandAST!).stdout;
                substituted = substituted.substring(0, expansion.loc.start) + removeTrailingNewlines(out) + substituted.substring(expansion.loc.end + 1);
            }
        }
        return substituted;
    }

    getPath(p: string): string | null {
        // replace leading ~ with /home/userID
        if (p.startsWith('~')) {
            p = p.replace('~', '/home/' + this.userID);
        }

        if (p.startsWith('/')) {
            return getUserPath(this.userID, p);
        }
        return getUserPath(this.userID, path.join(this.cwd, p));
    }

    handleCommand(command: Command): {
        stdout: string,
        stderr: string,
        exitCode: number
    } {
        let commandName = this.handleWord(command.name);
        let commandStdout: string = '';
        let commandStderr: string = '';

        let args: string[] = [];
        let redirects: {
            operator: string,
            file: string
        }[] = [];

        if (command.suffix) {
            for (let suffix of command.suffix) {
                if (suffix.type === 'Word') {
                    args.push(this.handleWord(suffix));
                }
                else if (suffix.type === 'Redirect') {
                    redirects.push({
                        operator: suffix.op.text,
                        file: this.handleWord(suffix.file)
                    });
                }
            }
        }
        console.log('running', commandName, 'with', args, 'and redirects', redirects);

        let pathCommands = this.env['PATH'].split(':').map((p) => {
            let newPath = this.getPath(p);
            if (newPath === null) {
                return null;
            }
            let joined = path.join(dirsContainer, this.userID, newPath);
            if (!fs.existsSync(joined)) {
                return null;
            }
            let files = fs.readdirSync(joined).map((file) => {
                return path.join(newPath!, file);
            });
            console.log('files', files);
            return files;
        }).flat().filter((file) => {
            if (!file) return false;

            // basename
            let basename = path.basename(file);
            return basename === commandName;
        });

        if (commandName === 'echo') {
            commandStdout += args.join(' ') + '\n';
        }
        // cd
        else if (commandName === 'cd') {
            let newPath = this.getPath(args[0]);
            let failed = false;
            let message = 'No such file or directory';
            if (newPath === null) {
                failed = true;
            }
            else {
                let joined = path.join(dirsContainer, this.userID, newPath);
                if (!fs.existsSync(joined)) {
                    failed = true;
                }
                else if (!fs.lstatSync(joined).isDirectory() || fs.lstatSync(joined).isSymbolicLink()) { // for security reasons, symlinks are not allowed
                    failed = true;
                    message = 'Not a directory';
                }
            }
            if (failed) {
                commandStderr += 'cd: ' + args[0] + ': ' + message + '\n';
            }
            else {
                this.cwd = newPath!;
            }
        }
        // cat
        else if (commandName === 'cat') {
            for (let file of args) {
                let newPath = this.getPath(args[0]);
                let failed = false;
                let message = 'No such file or directory';
                if (newPath === null) {
                    failed = true;
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath);
                    if (!fs.existsSync(joined)) {
                        failed = true;
                    }
                    else if (fs.lstatSync(joined).isDirectory()) {
                        failed = true;
                        message = 'Is a directory';
                    }
                }
                if (failed) {
                    commandStderr += 'cat: ' + args[0] + ': ' + message + '\n';
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath!);
                    commandStdout += fs.readFileSync(joined);
                }
            }
        }
        // ls
        else if (commandName === 'ls') {
            const handleFile = (file: string) => {
                let newPath = this.getPath(file);
                let failed = false;
                let message = 'cannot access \'' + file + '\': No such file or directory';
                if (newPath === null) {
                    failed = true;
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath);
                    if (!fs.existsSync(joined)) {
                        failed = true;
                    }
                    else if (!fs.lstatSync(joined).isDirectory() || fs.lstatSync(joined).isSymbolicLink()) { // for security reasons, symlinks are not allowed
                        failed = true;
                        message = 'Not a directory';
                    }
                }
                if (failed) {
                    commandStderr += 'ls: ' + message + '\n';
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath!);
                    //commandStdout += fs.readdirSync(joined).join('\n') + '\n';
                    // first get everything alphabetically
                    let files = fs.readdirSync(joined).sort();
                    let newFiles: string[] = [];
                    // now we want to give them colors and bolding, normal files are untouched, dirs are bold and blue
                    for (let file of files) {
                        let joinedFile = path.join(joined, file);
                        if (fs.lstatSync(joinedFile).isDirectory()) {
                            newFiles.push('\x1b[1;34m' + file + '\x1b[0m');
                        } else {
                            newFiles.push(file);
                        }
                    }
                    // ls returns a table, so we need to format it. for now, just join with 2 spaces
                    if (newFiles.length > 0) {
                        commandStdout += newFiles.join('  ') + '\n';
                    }
                }
            };
            if (args.length === 0) {
                handleFile('.');
            } else {
                for (let file of args) {
                    handleFile(file);
                }
            }
        }
        // mkdir
        else if (commandName === 'mkdir') {
            let parents = false; // no error if existing, make parent dirs as needed

            let files: string[] = [];

            /*for (let file of args) {
                let newPath = this.getPath(args[0]);
                let failed = false;
                let message = 'cannot create directory \'' + file + '\': File exists';
                if (newPath === null) {
                    failed = true;
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath);
                    if (fs.existsSync(joined)) {
                        failed = true;
                    }
                }
                if (failed) {
                    commandStderr += 'mkdir: ' + message + '\n';
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath!);
                    fs.mkdirSync(joined);
                }
            }*/

            for (let arg of args) {
                if (arg.startsWith('-')) {
                    // split by chars
                    let chars = arg.slice(1).split('');
                    for (let char of chars) {
                        if (char === 'p') {
                            parents = true;
                        } else {
                            commandStderr += 'mkdir: invalid option -- \'' + char + '\'\n';
                        }
                    }
                } else {
                    files.push(arg);
                }
            }

            for (let file of files) {
                let newPath = this.getPath(file);
                let failed = false;
                let message = 'cannot create directory \'' + file + '\': File exists';
                if (newPath === null) {
                    failed = true;
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath);
                    if (fs.existsSync(joined)) {
                        // if parents is passed, we don't care if it exists, continue
                        if (parents) {
                            continue;
                        }
                        failed = true;
                    }
                }
                if (failed) {
                    commandStderr += 'mkdir: ' + message + '\n';
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath!);
                    fs.mkdirSync(joined, { recursive: parents });
                }
            }
        }
        else if (commandName === 'touch') {
            for (let file of args) {
                let newPath = this.getPath(args[0]);
                let failed = false;
                let message = 'cannot touch \'' + file + '\': No such file or directory';
                if (newPath === null) {
                    failed = true;
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath);
                }
                if (failed) {
                    commandStderr += 'touch: ' + message + '\n';
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath!);
                    // if it doesn't exist, create it, otherwise update the mtime
                    if (!fs.existsSync(joined)) {
                        fs.writeFileSync(joined, '');
                    } else {
                        fs.utimesSync(joined, new Date(), new Date());
                    }
                }
            }
        }

        // pwd
        else if (commandName === 'pwd') {
            commandStdout += this.cwd + '\n';
        }
        else if (commandName === 'rm') {
            // for each arg, if its not a param, remove it, unless its a dir and -r isn't passed
            let recursive = false;
            let force = false;

            let files: string[] = [];

            for (let arg of args) {
                if (arg.startsWith('-')) {
                    // split by chars
                    let chars = arg.slice(1).split('');
                    for (let char of chars) {
                        if (char === 'r') {
                            recursive = true;
                        }
                        else if (char === 'f') {
                            force = true;
                        } else {
                            commandStderr += 'rm: invalid option -- \'' + char + '\'\n';
                        }
                    }
                } else {
                    files.push(arg);
                }
            }

            for (let file of files) {
                let newPath = this.getPath(file);
                let failed = false;
                let message = 'No such file or directory';
                if (newPath === null) {
                    failed = true;
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath);
                    if (!fs.existsSync(joined)) {
                        failed = true;
                    }
                    else if (!force && fs.lstatSync(joined).isDirectory() && !recursive) {
                        failed = true;
                        message = 'Is a directory';
                    }
                }
                if (failed) {
                    commandStderr += 'rm: cannot remove \'' + file + '\': ' + message + '\n';
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, newPath!);
                    if (fs.lstatSync(joined).isDirectory() && recursive) {
                        fs.rmdirSync(joined, { recursive: true });
                    } else if (fs.lstatSync(joined).isDirectory() && !recursive) {
                        commandStderr += 'rm: Looks like uh oh\n'; // this should never happen
                    } else {
                        fs.unlinkSync(joined);
                    }
                }
            }
        } // mv
        else if (commandName === 'mv') {
            let force = false;
            let files: string[] = [];

            for (let arg of args) {
                if (arg.startsWith('-')) {
                    // split by chars
                    let chars = arg.slice(1).split('');
                    for (let char of chars) {
                        if (char === 'f') {
                            force = true;
                        } else {
                            commandStderr += 'mv: invalid option -- \'' + char + '\'\n';
                        }
                    }
                } else {
                    files.push(arg);
                }
            }

            if (files.length < 2) {
                commandStderr += 'mv: missing file operand\n';
            } else {
                let sourcePath = this.getPath(files[0]);
                let destPath = this.getPath(files[1]);
                let failed = false;
                let message = 'No such file or directory';
                if (sourcePath === null) {
                    failed = true;
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, sourcePath);
                    if (!fs.existsSync(joined)) {
                        failed = true;
                    }
                }
                if (failed) {
                    commandStderr += 'mv: cannot move \'' + files[0] + '\': ' + message + '\n';
                }
                else {
                    let joined = path.join(dirsContainer, this.userID, sourcePath!);
                    let destJoined = path.join(dirsContainer, this.userID, destPath!);
                    if (fs.existsSync(destJoined) && !force) {
                        commandStderr += 'mv: cannot move \'' + files[0] + '\': File exists\n';
                    } else {
                        fs.renameSync(joined, destJoined);
                    }
                }
            }
        } // lsblk, lists all the dirsContainer dirs (admins can mount another users' /, this can lead to multiplayer)
        else if (commandName === 'lsblk') {
            let dirs = fs.readdirSync(dirsContainer).filter((dir) => {
                return fs.lstatSync(path.join(dirsContainer, dir)).isDirectory();
            });
            commandStdout += dirs.join('\n') + '\n';
        } // whoami, prints the userID
        else if (commandName === 'whoami') {
            commandStdout += this.userID + '\n';
        }
        // switch user, admin only
        else if (commandName === 'su') {
            if (this.userID !== '742396813826457750') {
                commandStderr += 'su: Permission denied\n';
            } else {
                let user = args[0];
                if (!fs.existsSync(path.join(dirsContainer, user))) {
                    commandStderr += 'su: user ' + user + ' does not exist\n';
                } else {
                    this.userID = user;
                    this.cwd = '/home/' + user;
                }
            }
        }

        // if its a relative or absolute path, run it, but if its relative it has to start with ./ or ../ otherwise it wouldnt work
        else if (commandName.includes('/')) { // cheaty way but it works
            // first we set args, stuff like $0, in env
            for (let i = 0; i < args.length; i++) {
                this.env[i] = args[i];
            }
            // $@ is
            this.env['@'] = args.join(' ');
            let scriptPath = this.getPath(commandName);
            let failed = false;
            let message = 'No such file or directory';
            if (scriptPath === null) {
                failed = true;
            }
            else {
                let joined = path.join(dirsContainer, this.userID, scriptPath);
                if (!fs.existsSync(joined)) {
                    failed = true;
                }
                else if (fs.lstatSync(joined).isDirectory()) {
                    failed = true;
                    message = 'Is a directory';
                }
            }
            if (failed) {
                commandStderr += commandName + ': ' + message + '\n';
            }
            else {
                let joined = path.join(dirsContainer, this.userID, scriptPath!);
                let code = fs.readFileSync(joined).toString();
                let scriptAST = parse(code);
                let handled = this.handleScript(scriptAST);
                commandStdout += handled.stdout;
                commandStderr += handled.stderr;
            }
        }
        else if (pathCommands.length > 0) {
            for (let i = 0; i < args.length; i++) {
                this.env[i] = args[i];
            }
            // $@ is
            this.env['@'] = args.join(' ');
            let newPath = this.getPath(pathCommands[0]!);
            let failed = false;
            let message = 'No such file or directory';
            if (newPath === null) {
                failed = true;
            }
            else {
                let joined = path.join(dirsContainer, this.userID, newPath);
                if (!fs.existsSync(joined)) {
                    failed = true;
                }
                else if (fs.lstatSync(joined).isDirectory()) {
                    failed = true;
                    message = 'Is a directory';
                }
            }
            if (failed) {
                commandStderr += commandName + ': ' + message + '\n';
            }
            else {
                let joined = path.join(dirsContainer, this.userID, newPath!);
                let code = fs.readFileSync(joined).toString();
                let scriptAST = parse(code);
                let handled = this.handleScript(scriptAST);
                commandStdout += handled.stdout;
                commandStderr += handled.stderr;
            }
        } // else, command not found

        else {
            commandStderr += commandName + ': command not found\n';
        }

        let redirected = false;

        for (let redirect of redirects) {
            console.log('wrote "' + (commandStdout + commandStderr) + '" to', redirect.file);
            if (redirect.operator === '>') {
                fs.writeFileSync(path.join(dirsContainer, this.userID, this.getPath(redirect.file)!), commandStdout + commandStderr);
            } else if (redirect.operator === '>>') {
                fs.appendFileSync(path.join(dirsContainer, this.userID, this.getPath(redirect.file)!), commandStdout + commandStderr);
            }
            redirected = true;
        }

        if (!redirected) {
            return {
                stdout: commandStdout,
                stderr: commandStderr,
                exitCode: 0
            };
        }
        return {
            stdout: '',
            stderr: '',
            exitCode: 0
        };
    }

    handleScript(scriptAST: ScriptAST): {
        stdout: string,
        stderr: string,
    } {
        let stdout: string = '';
        let stderr: string = '';

        try {
            for (let command of scriptAST.commands) {
                if (command.type === 'Command') {
                    let out = this.handleCommand(command);
                    stdout += out.stdout;
                    stderr += out.stderr;
                }
                else if (command.type === 'LogicalExpression') {
                    console.log('uh oh its a')
                }
            }
        }
        catch (e: any) {
            stderr += e.toString();
        }

        return {
            stdout,
            stderr
        };
    }

    run(code: string): {
        stdout: string,
        stderr: string,
    } {
        let scriptAST = parse(code);
        let handled = this.handleScript(scriptAST);
        return handled;
    }
}

export default ShellEnvironment;