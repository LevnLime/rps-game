var currentPlayerKey;
var currentGame;
const MENU_PANEL = "menu";
const GAME_PANEL = "game";
const ROCK = 0;
const PAPER = 1;
const SCISSORS = 2;
const ROUND_WIN = 0;
const ROUND_LOSE = 1;
const ROUND_TIE = 2;
const ACTION_NAMES = [ "rock", "paper", "scissors" ];   // Array indices correspond to ROCK/PAPER/SCISSORS

window.addEventListener("DOMContentLoaded", pageLoaded);
window.addEventListener("unload", quitGame);

function pageLoaded(event) {
    // Add event handlers
    var joinButton = document.getElementById("joinGameButton");
    joinButton.addEventListener("click", joinGameClick);
    document.getElementById("quitGameButton").addEventListener("click", quitGame);
    document.getElementById("submitRPS").addEventListener("click", submitActionClick);
    document.getElementById("quitRPS").addEventListener("click", quitGame);
    document.getElementById("nextRoundRPS").addEventListener("click", nextRoundClick);
}

function setMenuMessage(message) {
    messageBox = document.getElementById("menuMessage");
    messageBox.innerText = message;
}

function setRPSMessage(message) {
    messageBox = document.getElementById("rpsMessage");
    messageBox.innerText = message;
}

function activatePanel(panel) {
    if (panel === MENU_PANEL) {
        document.getElementById("menu").hidden = false;
        document.getElementById("game").hidden = true;
    } else {
        document.getElementById("menu").hidden = true;
        document.getElementById("game").hidden = false;
    }
}

function joinGameClick(event) {
    // Don't do anything if we've already joined a game
    if (currentPlayerKey) {
        return;
    }

    firebase.database().ref("/players").once("value").then(function(snapshot) {
        var playerName = document.getElementById("playerName").value;
        if (snapshot.exists()) {
            // There are players. How many?
            var numPlayers = Object.keys(snapshot.val()).length;
            if (numPlayers == 1) {
                // We can join the game
                addPlayerToGame();
            } else {
                // Already 2 or more players. Don't join
                setMenuMessage("Already two players. Not joining");
            }

        } else {
            // No players yet
            addPlayerToGame();
        }
    });
}

function addPlayerToGame() {
    if(!currentPlayerKey) {
        var playerName = document.getElementById("playerName").value;
        var newPlayer = firebase.database().ref("/players").push();
        newPlayer.set({
            name: playerName
        });
        currentPlayerKey = newPlayer.key;
        setMenuMessage("Joined game");
        document.getElementById("joinGameButton").disabled = true;

        // Listen for players to arrive
        firebase.database().ref("/players").on("value", onPlayerChanged);
    }
}

function quitGame() {
    if (currentPlayerKey) {
        // Remove the current player
        firebase.database().ref(`/players/${currentPlayerKey}`).remove();
        currentPlayerKey = undefined;
        setMenuMessage("Quit");
        document.getElementById("joinGameButton").disabled = false;

        // Cleanup firebase listeners
        firebase.database().ref("/players").off();

        // Cleanup firebase database
        firebase.database().ref("/rounds").remove();
    }
}

// Called when the /players node changes
function onPlayerChanged(snapshot) {
    var numPlayers;
    if (!snapshot.exists()) {
        // This happens if the last player quits, since Firebase deletes the whole "/players" node
        numPlayers = 0;
    } else {
        numPlayers = Object.keys(snapshot.val()).length;
    }

    if (numPlayers == 0) {
        setMenuMessage("");
        activatePanel(MENU_PANEL);
    } else if (numPlayers == 1) {
        setMenuMessage("Waiting on another player...");
        activatePanel(MENU_PANEL);
    } else if (numPlayers == 2) {
        setMenuMessage("Start game!");
        startGame();
        activatePanel(GAME_PANEL);
    } else {
        // This shouldn't happen
        console.log("More than 2 players joined?!");
        debugger;
    }
}

function startGame() {
    // Figure out the opponent's name and start a game
    firebase.database().ref('/players').once("value").then(snapshot => {
        var players = snapshot.val();
        var oppPlayerName;
        for (playerId in players) {
            if (playerId !== currentPlayerKey) {
                oppPlayerName = players[playerId].name;
                break;
            }
        }
        currentGame = new Game(currentPlayerKey, oppPlayerName);
        currentGame.renderScore();
        currentGame.nextRound();
    });
}

function submitActionClick() {
    if (currentGame) {
        action = document.querySelector("input[name=rps]:checked");
        if (action) {
            currentGame.submitAction(Number(action.value));
        }
    }
}

function nextRoundClick() {
    if (currentGame) {
        currentGame.nextRound();
    }
}

class Game {
    constructor(myPlayerId, oppPlayerName) {
        this.playerId = myPlayerId;
        this.playerName = document.getElementById("playerName").value;
        this.playerScoreElement = document.getElementById("myScore");
        this.oppScoreElement = document.getElementById("oppScore");
        this.oppName = oppPlayerName;
        this.roundNum = 0;
        this.playerScore = 0;
        this.oppScore = 0;
        this.nextRoundButton = document.getElementById("nextRoundRPS");
    }

    nextRound() {
        this.roundNum++;
        document.getElementById("submitRPS").disabled = false;
        this.nextRoundButton.hidden = true;
        setRPSMessage("");
    }

    renderScore() {
        this.playerScoreElement.innerText = `${this.playerName}: ${this.playerScore}`;
        this.oppScoreElement.innerText = `${this.oppName}: ${this.oppScore}`;
    }

    submitAction(action) {
        // Disable the submit button
        document.getElementById("submitRPS").disabled = true;
        setRPSMessage(`You used ${ACTION_NAMES[action]}! Waiting on opponent...`);

        // Submit this player's action to the server
        firebase.database().ref(`/rounds/${this.roundNum}/${this.playerId}`).set(action);

        // Listen and wait for the opponent to make a move
        firebase.database().ref(`/rounds/${this.roundNum}`).on("value", snapshot => {
            // Wait until there are two submissions in the round (ours and the opponent's)
            if (snapshot.exists() && Object.keys(snapshot.val()).length === 2) {
                // Find the opponent's submitted action
                var oppAction;
                var submissions = snapshot.val();
                for (playerId in submissions) {
                    if (playerId !== this.playerId) {
                        oppAction = submissions[playerId];
                        break;
                    }
                }
                var result = this.computeRoundResult(action, oppAction);
                this.updateScoreAndShowResults(result, oppAction);

                // Listener for this round no longer needed. Remove it
                firebase.database().ref(`/rounds/${this.roundNum}`).off();
            }
        });
    }

    // Figures out the result from the round and returns a result code
    computeRoundResult(myAction, oppAction) {
        if (myAction === oppAction) {
            return ROUND_TIE;
        } else if (myAction === ROCK && oppAction === PAPER) {
            return ROUND_LOSE;
        } else if (myAction === ROCK && oppAction === SCISSORS) {
            return ROUND_WIN;
        } else if (myAction === PAPER && oppAction === ROCK) {
            return ROUND_WIN;
        } else if (myAction === PAPER && oppAction === SCISSORS) {
            return ROUND_LOSE;
        } else if (myAction === SCISSORS && oppAction === ROCK) {
            return ROUND_LOSE;
        } else if (myAction === SCISSORS && oppAction === PAPER) {
            return ROUND_WIN;
        }
    }

    updateScoreAndShowResults(roundResult, oppAction) {
        var message = `${this.oppName} used ${ACTION_NAMES[oppAction]}! `;
        if (roundResult === ROUND_WIN) {
            this.playerScore++;
            message += "You win!";
        } else if (roundResult === ROUND_LOSE) {
            this.oppScore++;
            message += "You lose!";
        } else {
            message += "Tie!";
        }
        setRPSMessage(message);

        document.getElementById("myScore").innerText = `${this.playerName}: ${this.playerScore}`;
        document.getElementById("oppScore").innerText = `${this.oppName}: ${this.oppScore}`;

        this.nextRoundButton.hidden = false;
    }
}