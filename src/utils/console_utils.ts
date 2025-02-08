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

async function handleSubMenu(menuName: string, subMenu: string[]): Promise<string> {
    while (true) {
        const selected = await promptSelection(`Choose ${menuName} sub-module:`, subMenu);

        if (selected === "Back") {
            return "";
        }

        return selected;
    }
}

export async function userChoice(): Promise<string> {
    const mainMenu = [
        "1. Solar",
        "2. Orca",
        "3. Lifinity",
        "4. Underdog",
        "5. Relay",
        // "2. Ionic",
        // "3. Relay",
        // "4. Portal",
        // "5. BalanceCheck",
        // "6. Wrap_Unwrap",
        "0. Exit",
    ];

    // const subMenus: { [key: string]: string[] } = {
    //     "Ionic": [
    //         "1. Ionic71Supply",
    //         "2. Ionic15Borrow",
    //         "3. IonicWithdrawAll",
    //         "4. IonicRepayAll",
    //         "0. Back",
    //     ],
    //     "Portal": [
    //         "1. Checker",
    //         "2. Portal_daily_check",
    //         "3. Portal_main_tasks",
    //         "0. Back",
    //     ],
    // };

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
            // case "Relay":
            // case "BalanceCheck":
            // case "Wrap_Unwrap":
                return selected;
            // case "Ionic":
            // case "Portal":
            //     const subSelected = await handleSubMenu(selected, subMenus[selected]);
            //     if (subSelected !== "") {
            //         return subSelected;
            //     }
            //     break;
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
