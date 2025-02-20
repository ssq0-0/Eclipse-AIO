import inquirer from 'inquirer';

async function promptSelection(message: string, options: string[]): Promise<string> {
    const { selected } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selected',
            message: message,
            choices: options,
        }
    ]);
    return selected;
}

export async function userChoice(): Promise<string> {
    const mainMenu = [
        "1. Solar",
        "2. Orca",
        "3. Lifinity",
        "4. Underdog",
        "5. Relay",
        "6. Collector",
        "0. Exit",
    ];

    const rgx = /^\d+\.\s*/;

    while (true) {
        let selected = await promptSelection("Choose module:", mainMenu);
        selected = selected.replace(rgx, "");

        switch (selected) {
            case "Solar":
            case "Orca":
            case "Lifinity":
            case "Underdog":
            case "Relay":
            case "Collector":
                return selected;
            case "Exit":
                console.log("Exiting program.");
                return "";
            default:
                console.warn(`Invalid selection: ${selected}`);
        }
    }
}

export async function restoreProcess(): Promise<string> {
    const questions = [
        "0. Yes",
        "1. No",
    ];

    const selected = await promptSelection("A past state file has been detected. Do you want to pick up where you left off? (If no, the state will be reset)", questions);
    return selected.replace(/^\d+\.\s*/, "");
}
