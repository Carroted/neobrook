declare module 'bash-parser' {
    interface BaseNode {
        type: "Command" | "Redirect" | "LogicalExpression"
    }
    interface Word {
        type: "Word",
        text: string,
        expansion?: {
            loc: {
                start: number,
                end: number
            },
            parameter: string,
            type: "ParameterExpansion" | "CommandExpansion";
            commandAST?: ScriptAST
        }[];
    }
    interface Command {
        type: "Command",
        name: Word,
        suffix?: (Word | {
            type: "Redirect",
            op: {
                text: string,
                type: string
            },
            file: Word
        })[]
    }
    interface ScriptAST {
        type: "Script",
        commands: (Command | {
            type: "LogicalExpression",
            op: string,
            left: Command,
            right: Command,
        })[]
    };
    export default function parse(code: string): ScriptAST;
};